import cron from 'node-cron';
import { prisma } from '../prisma.js';
import {
  refreshAccountToken,
  fetchPlatformInsights,
  ensureFreshAccessToken,
} from './platform-router.service.js';
import { decryptToken } from './token-crypto.service.js';
import { resolvePendingPermalinks } from './permalink.service.js';
import { extractSocialApiError, isSoftInsightSkip, logSocialError } from './safe-error.js';
import { publishDestination, claimDestination, finalizePostStatus } from './publish-destination.service.js';

/**
 * Run `fn` only if no other run of the same job is in progress — in this
 * process (an in-memory flag, since node-cron happily starts a tick while the
 * previous one is still running) or on any other instance (a MySQL named lock).
 *
 * GET_LOCK is held by a database session, so it is taken and released inside
 * one interactive transaction, which pins a single pooled connection for the
 * duration; the job itself uses the normal client. If the process dies, MySQL
 * drops the session and the lock with it.
 */
const runningJobs = new Set<string>();
const JOB_LOCK_MAX_MS = 2 * 60 * 60 * 1000;

async function withJobLock(name: string, fn: () => Promise<void>): Promise<void> {
  if (runningJobs.has(name)) {
    console.warn(`[social-scheduler] ${name} still running from a previous tick — skipping this one`);
    return;
  }
  runningJobs.add(name);
  const lockName = `hirdan:social:${name}`;
  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ got: unknown }>>`SELECT GET_LOCK(${lockName}, 0) AS got`;
        if (Number(rows[0]?.got) !== 1) {
          console.warn(`[social-scheduler] ${name} is running on another instance — skipping`);
          return;
        }
        try {
          await fn();
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => {});
        }
      },
      { maxWait: 30_000, timeout: JOB_LOCK_MAX_MS },
    );
  } catch (err: unknown) {
    logSocialError(`Error in ${name} job`, err);
  } finally {
    runningJobs.delete(name);
  }
}

/** A destination held longer than this is treated as abandoned (crash/restart). */
const STALE_LOCK_MS = 30 * 60 * 1000;

async function recoverStalePublishing(): Promise<void> {
  // Reclaim destinations abandoned mid-publish (server crash/restart while
  // PUBLISHING). Destinations are now claimed one at a time right before their
  // own publish, so lockedAt is the start of that single attempt; nothing
  // legitimate holds one this long (the slowest known step, Meta video
  // container polling, tops out around 100s; large YouTube uploads a few
  // minutes). A stuck destination never re-matches the claim query on its own,
  // so without this it would sit in PUBLISHING forever.
  const staleCutoff = new Date(Date.now() - STALE_LOCK_MS);
  const stalePublishing = await prisma.socialPostDestination.findMany({
    where: { status: 'PUBLISHING', lockedAt: { lt: staleCutoff } },
  });
  for (const dest of stalePublishing) {
    try {
      // It went live but the PUBLISHED write was lost — never publish it again.
      if (dest.platformPostId) {
        await prisma.socialPostDestination.updateMany({
          where: { id: dest.id, status: 'PUBLISHING', lockedAt: dest.lockedAt },
          data: { status: 'PUBLISHED', lockedAt: null, publishedAt: dest.publishedAt ?? new Date() },
        });
        continue;
      }
      const nextAttempts = dest.attempts + 1;
      const failedPermanently = nextAttempts >= 3;
      // Conditional on the lock we saw, so a destination another run just
      // re-claimed is not yanked out from under it.
      const { count } = await prisma.socialPostDestination.updateMany({
        where: { id: dest.id, status: 'PUBLISHING', lockedAt: dest.lockedAt },
        data: {
          status: failedPermanently ? 'FAILED' : 'QUEUED',
          attempts: nextAttempts,
          lockedAt: null,
          lastError: 'Recovered after being stuck in PUBLISHING (likely a server restart mid-publish).',
        },
      });
      if (count === 1 && !failedPermanently) {
        // Covers destinations claimed by publish-now/retry too, whose post is
        // PUBLISHING rather than SCHEDULED — push the post back to SCHEDULED
        // (due now) so the claim step below picks it back up the normal way.
        await prisma.socialPost.updateMany({
          where: { id: dest.postId, status: { not: 'SCHEDULED' } },
          data: { status: 'SCHEDULED', scheduledFor: new Date(Date.now() - 60 * 1000) },
        });
      }
    } catch (err: unknown) {
      logSocialError(`Could not recover stale destination ${dest.id}`, err);
    }
  }

  // Posts a manual publish left in PUBLISHING (crash before its finally ran)
  // with nothing actually in flight: re-derive their status. Queued
  // destinations there were ones the user asked to publish now, so they go to
  // the scheduler as due.
  const stuckPosts = await prisma.socialPost.findMany({
    where: {
      status: 'PUBLISHING',
      updatedAt: { lt: staleCutoff },
      destinations: { none: { status: 'PUBLISHING' } },
    },
    select: { id: true, scheduledFor: true },
    take: 200,
  });
  for (const post of stuckPosts) {
    try {
      const hasQueued = await prisma.socialPostDestination.count({ where: { postId: post.id, status: 'QUEUED' } });
      if (hasQueued > 0 && (!post.scheduledFor || post.scheduledFor > new Date())) {
        await prisma.socialPost.updateMany({
          where: { id: post.id, status: 'PUBLISHING' },
          data: { scheduledFor: new Date(Date.now() - 60 * 1000) },
        });
      }
      await finalizePostStatus(post.id, 'SCHEDULED');
    } catch (err: unknown) {
      logSocialError(`Could not recover stuck post ${post.id}`, err);
    }
  }
}

export async function processDuePosts(): Promise<void> {
  await withJobLock('processDuePosts', runDuePosts);
}

async function runDuePosts(): Promise<void> {
  try {
    await recoverStalePublishing();
  } catch (err: unknown) {
    logSocialError('Error recovering stale social publishes', err);
  }

  // 1. Find candidates: QUEUED destinations of due SCHEDULED posts, on accounts
  // that are still connected, not rate limited (claiming a throttled account
  // used to burn its retry budget before the cooldown even ended), and whose
  // client is ACTIVE — a PAUSED or CHURNED client, or a disconnected account,
  // must never keep publishing.
  //
  // This is only a candidate list. Each destination is claimed individually,
  // right before it is published (step 2): this used to claim the whole batch
  // with one lockedAt and then publish sequentially, so a long run outlived the
  // stale-lock cutoff and the next tick re-queued and republished destinations
  // that were simply waiting their turn.
  const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT spd.id
    FROM social_post_destinations spd
    JOIN social_posts sp ON sp.id = spd.post_id
    JOIN social_accounts sa ON sa.id = spd.social_account_id
    JOIN clients c ON c.id = sp.client_id
    WHERE spd.status = 'QUEUED'
      AND spd.locked_at IS NULL
      AND sp.status = 'SCHEDULED'
      AND sp.scheduled_for <= UTC_TIMESTAMP()
      AND sa.is_active = 1
      AND sa.client_id = sp.client_id
      AND c.status = 'ACTIVE'
      AND (sa.rate_limited_until IS NULL OR sa.rate_limited_until <= UTC_TIMESTAMP())
    ORDER BY sp.scheduled_for ASC
    LIMIT 500
  `;
  if (candidates.length === 0) return;

  // 2. Claim → publish, one destination at a time, each isolated so one
  // failure (or a DB error) doesn't abort the rest of the run.
  const touchedPostIds = new Set<string>();
  for (const { id } of candidates) {
    try {
      if (!(await claimDestination(id, ['QUEUED']))) continue; // someone else has it
      const dest = await prisma.socialPostDestination.findUnique({
        where: { id },
        include: { post: true, socialAccount: true },
      });
      if (!dest) continue;
      touchedPostIds.add(dest.postId);

      // The post may have been unscheduled/edited between the candidate query
      // and the claim — release rather than publish it.
      if (dest.post.status !== 'SCHEDULED') {
        await prisma.socialPostDestination.update({
          where: { id },
          data: { status: 'QUEUED', lockedAt: null },
        });
        continue;
      }

      // The claim query already excludes rate-limited accounts, but one can
      // become rate-limited in between — publishDestination() re-checks and
      // releases it back to QUEUED without counting a failed attempt.
      await publishDestination(dest, dest.post, { maxAttempts: 3, skippedStatus: 'QUEUED' });
    } catch (err: unknown) {
      logSocialError(`Error processing social destination ${id}`, err);
    }
  }

  // 3. Roll destination outcomes up to each post. Still-QUEUED destinations
  // leave the post SCHEDULED so the next tick retries them.
  for (const postId of touchedPostIds) {
    await finalizePostStatus(postId, null);
  }
}

export async function refreshExpiringTokens(): Promise<void> {
  // X and TikTok rotate refresh tokens on use: two instances refreshing the
  // same account at once would leave one of them holding a dead token.
  await withJobLock('refreshExpiringTokens', runRefreshExpiringTokens);
}

async function runRefreshExpiringTokens(): Promise<void> {
  try {
    // Meta/TikTok: refresh within 7 days. YouTube access tokens last ~1h, so
    // also pick up any YouTube account whose token is already expired / near expiry.
    const expiryThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const accounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
        OR: [
          { tokenExpiresAt: { lte: expiryThreshold } },
          { platform: 'youtube', refreshTokenEnc: { not: null } },
        ],
      },
    });

    for (const account of accounts) {
      if (!account.refreshTokenEnc) continue;
      const platform = account.platform.toLowerCase();
      // Skip YouTube tokens that are still fresh (>20 min left) to avoid hammering Google.
      if (platform === 'youtube' && account.tokenExpiresAt) {
        const msLeft = new Date(account.tokenExpiresAt).getTime() - Date.now();
        if (msLeft > 20 * 60 * 1000) continue;
      }

      // X rotates its refresh token on every use (one-time-use) — refreshing on
      // every tick regardless of freshness burns a fresh rotation ~32x/day for
      // no reason, and a crash between the API call succeeding and the DB write
      // strands an already-invalidated refresh token, killing the account until
      // manual reconnect. Only refresh once the access token is actually close
      // to expiring, same skip pattern as YouTube above.
      if (platform === 'x' && account.tokenExpiresAt) {
        const msLeft = new Date(account.tokenExpiresAt).getTime() - Date.now();
        if (msLeft > 20 * 60 * 1000) continue;
      }

      // Meta multi-client: never remint from the USER token just because expiry is
      // near. Reminting uses /me/accounts for the shared Facebook login — if the
      // latest FLB grant only includes one Page, reminting would "expire" every
      // other client's still-valid page token. Probe the stored page token first.
      if (platform === 'facebook' || platform === 'instagram') {
        const probeId = account.pageId || account.platformUserId;
        if (probeId) {
          try {
            const { isPageTokenStillValid } = await import('./meta.service.js');
            const stillValid = await isPageTokenStillValid(
              probeId,
              decryptToken(account.accessTokenEnc),
            );
            if (stillValid) {
              await prisma.socialAccount.update({
                where: { id: account.id },
                data: {
                  // Keep the working page token; push expiry out so cron backs off.
                  tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  healthStatus: 'healthy',
                  healthMessage: null,
                },
              });
              console.log(
                `Kept valid Meta page token for ${account.displayName} (${account.platform}) — skipped user-token remint`,
              );
              continue;
            }
          } catch (probeErr: unknown) {
            console.warn(
              `Meta page-token probe failed for ${account.id}:`,
              extractSocialApiError(probeErr),
            );
          }
        }
      }

      try {
        const refreshData = await refreshAccountToken(account);
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessTokenEnc: refreshData.accessTokenEnc,
            refreshTokenEnc: refreshData.refreshTokenEnc,
            tokenExpiresAt: refreshData.tokenExpiresAt,
            healthStatus: 'healthy',
            healthMessage: null,
          },
        });
        console.log(`Successfully refreshed token for social account: ${account.displayName} (${account.platform})`);
      } catch (err: unknown) {
        const msg = extractSocialApiError(err);
        console.error(`Failed to refresh token for account ${account.id}:`, msg);

        // Meta: if remint failed but we couldn't prove the page token is dead,
        // do not mark expired — Sync/publish will surface a real auth failure.
        if (platform === 'facebook' || platform === 'instagram') {
          console.warn(
            `Leaving Meta account ${account.id} untouched after remint failure (preserve multi-client tokens)`,
          );
          continue;
        }

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            healthStatus: 'expired',
            healthMessage: `Token refresh failed: ${msg}`,
          },
        });
        // Create an system notification for admins
        await prisma.notification.create({
          data: {
            title: 'Social Account Disconnected',
            message: `The access token for ${account.displayName} (${account.platform}) has expired and could not be refreshed. Please reconnect the account.`,
            type: 'SOCIAL_ACCOUNT_EXPIRED',
            category: 'WARNING',
            entityType: 'CLIENT',
            entityId: account.clientId,
          },
        });
      }
    }
  } catch (err: unknown) {
    logSocialError('Error in refreshExpiringTokens job', err);
  }
}

export async function syncAccount(accountId: string): Promise<void> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) return;

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  let metrics: { followers: number; reach: number | null; impressions: number | null; profileVisits: number | null } = { followers: 0, reach: 0, impressions: 0, profileVisits: 0 };
  let isMock = false;
  let syncError: string | null = null;
  let isRealSync = false;

  try {
    const decryptedToken = decryptToken(account.accessTokenEnc);
    if (decryptedToken === 'mock_access_token_data' || decryptedToken.startsWith('mock_')) {
      isMock = true;
    } else {
      isRealSync = true;
      metrics = await fetchPlatformInsights(account);
    }
  } catch (err: unknown) {
    const errorMsg = extractSocialApiError(err);
    console.warn(`Real API sync failed for account ${account.id}:`, errorMsg);
    syncError = `API Error: ${errorMsg}`;
  }

  // Update health message based on whether sync succeeded or failed
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      healthStatus: syncError ? 'warning' : 'healthy',
      healthMessage: syncError,
    },
  });

  if (syncError && isRealSync) {
    // Real sync failed. Do not write mock data, do not seed mock history.
    return;
  }

  const platform = account.platform.toLowerCase();
  
  if (isRealSync && platform === 'tiktok') {
    try {
      const decryptedToken = decryptToken(account.accessTokenEnc);
      const axios = (await import('axios')).default;
      const { getTikTokCreatorInfo } = await import('./tiktok.service.js');
      
      let username = account.displayName;
      let avatarUrl = account.avatarUrl;

      // Try user/info
      try {
        const { data: infoData } = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
          params: { fields: 'open_id,union_id,avatar_url,display_name' },
          headers: { Authorization: `Bearer ${decryptedToken}` },
        });
        const user = infoData?.data?.user;
        if (user) {
          username = user.display_name || username;
          avatarUrl = user.avatar_url || avatarUrl;
        }
      } catch (err) {
        logSocialError('Failed to fetch TikTok user info during sync', err);
      }

      // Try creator_info
      try {
        const creatorInfo = await getTikTokCreatorInfo(decryptedToken);
        if (creatorInfo) {
          if (!username || username === 'TikTok User' || username === 'Unknown Account') {
            username = creatorInfo.creator_nickname || creatorInfo.creator_username || username;
          }
          if (!avatarUrl) {
            avatarUrl = creatorInfo.creator_avatar_url || avatarUrl;
          }
        }
      } catch (err) {
        logSocialError('Failed to fetch TikTok creator info during sync', err);
      }

      // Update the account details if changed
      if (username !== account.displayName || avatarUrl !== account.avatarUrl) {
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            displayName: username,
            platformUsername: username,
            avatarUrl,
          },
        });
      }
    } catch (err) {
      console.warn('Failed to update TikTok account details on sync:', err);
    }
  }

  // Refresh Meta profile pictures on sync — stored CDN URLs expire while the
  // web browser may still show a cached image from an earlier session.
  if (isRealSync && (platform === 'facebook' || platform === 'instagram' || platform === 'threads')) {
    try {
      const decryptedToken = decryptToken(account.accessTokenEnc);
      if (decryptedToken && !decryptedToken.startsWith('mock_')) {
        const { fetchMetaAvatarUrl } = await import('./meta.service.js');
        const fresh = await fetchMetaAvatarUrl({
          platform,
          accessToken: decryptedToken,
          pageId: account.pageId,
          igAccountId: account.igAccountId,
          platformUserId: account.platformUserId,
        });
        if (fresh && fresh !== account.avatarUrl) {
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: { avatarUrl: fresh },
          });
        }
      }
    } catch (err) {
      console.warn('Failed to refresh Meta avatar on sync:', err);
    }
  }
  
  // NOTE: never delete historical insight rows during live sync. Older code wiped
  // YouTube history when sum(reach) > lifetime views (common with mock seeds),
  // which also destroyed real accumulated days. History is append-only for live accounts.

  if (isMock) {
    const baseFollowers: Record<string, number> = {
      facebook: 12500,
      instagram: 24300,
      linkedin: 8400,
      youtube: 42000,
      tiktok: 31200,
      x: 15400,
      threads: 4300,
      pinterest: 9500,
    };
    const base = baseFollowers[platform] || 5000;
    metrics = {
      followers: base + Math.floor(Math.random() * 500 - 250),
      reach: Math.floor(base * 0.15) + Math.floor(Math.random() * 200),
      impressions: Math.floor(base * 0.25) + Math.floor(Math.random() * 400),
      profileVisits: Math.floor(base * 0.02) + Math.floor(Math.random() * 50),
    };
  }

  let reachIncrement: number | null = metrics.reach;
  let impressionsIncrement: number | null = metrics.impressions;
  let profileVisitsVal: number | null = metrics.profileVisits;
  let lifetimeViewsSnapshot: number | null = null;

  if (isRealSync && platform === 'youtube') {
    const lastRecord = await prisma.accountInsightDaily.findFirst({
      where: {
        socialAccountId: account.id,
        date: { lt: today },
      },
      orderBy: { date: 'desc' },
    });

    const currentLifetimeViews = metrics.reach || 0;
    // FIX: read the previous snapshot from its own dedicated column now,
    // instead of profileVisits (which meant something else entirely).
    const previousLifetimeViews = lastRecord?.lifetimeViewsSnapshot || 0;

    if (previousLifetimeViews > 0) {
      reachIncrement = Math.max(0, currentLifetimeViews - previousLifetimeViews);
      impressionsIncrement = reachIncrement;
    } else {
      reachIncrement = Math.max(1, Math.floor(currentLifetimeViews / 180));
      impressionsIncrement = reachIncrement;
    }
    lifetimeViewsSnapshot = currentLifetimeViews;
    profileVisitsVal = null; // YouTube doesn't expose a real profile-visits metric
  }

  // Engagement rate is NOT reach/followers. The real definition (engagement ÷
  // reach) needs per-post engagement we don't have at account-daily sync time,
  // so we no longer store a misleading number here — the analytics route computes
  // the true rate from engagement ÷ reach (and imported rows carry their own).
  const engagementRate = null;

  // Don't let the daily live sync clobber a row that was populated from an
  // imported export (TikTok Studio) — those rows are richer than the API. When
  // the date already has imported data, only refresh the follower count.
  //
  // Also: never let a flaky API response overwrite good numbers with zeros.
  // Sync is upsert-today only; past days are never rewritten.
  const existing = await prisma.accountInsightDaily.findUnique({
    where: { socialAccountId_date: { socialAccountId: account.id, date: today } },
    select: {
      source: true,
      followers: true,
      reach: true,
      impressions: true,
      profileVisits: true,
      lifetimeViewsSnapshot: true,
    },
  });
  const isImported = existing?.source === 'import';

  const keepPositive = (incoming: number | null | undefined, prev: number | null | undefined): number | null => {
    if (incoming == null) return prev ?? null;
    if (incoming === 0 && (prev ?? 0) > 0) return prev ?? null;
    return incoming;
  };

  const apiData = {
    followers: keepPositive(metrics.followers, existing?.followers) ?? 0,
    reach: keepPositive(reachIncrement, existing?.reach),
    impressions: keepPositive(impressionsIncrement, existing?.impressions),
    profileVisits: keepPositive(profileVisitsVal, existing?.profileVisits),
    lifetimeViewsSnapshot:
      lifetimeViewsSnapshot && lifetimeViewsSnapshot > 0
        ? lifetimeViewsSnapshot
        : (existing?.lifetimeViewsSnapshot ?? null),
    engagementRate,
    source: 'api' as const,
  };

  await prisma.accountInsightDaily.upsert({
    where: {
      socialAccountId_date: {
        socialAccountId: account.id,
        date: today,
      },
    },
    create: {
      socialAccountId: account.id,
      date: today,
      ...apiData,
    },
    update: isImported
      ? { followers: keepPositive(metrics.followers, existing?.followers) ?? existing?.followers ?? 0 }
      : apiData,
  });

  // FIX (fake analytics history): this used to seed 30 days of history for ANY
  // account with <=1 existing daily record — including real, freshly-connected
  // accounts — using Math.random() noise scaled off of today's single real
  // snapshot. That meant every newly-connected real account's 30-day chart was
  // entirely fabricated, not actual past data, with no indication to the user
  // that it was synthetic.
  //
  // Real accounts now simply accumulate real history one day at a time from
  // whichever day they were connected — no backfilled/guessed days. Only mock/
  // demo accounts (isMock) still get a synthetic 30-day history seeded, since
  // that's an intentional demo-mode convenience, not something shown as real data.
  if (isMock) {
    const historyCount = await prisma.accountInsightDaily.count({
      where: { socialAccountId: account.id },
    });

    if (historyCount <= 1) {
      const baseFollowers: Record<string, number> = {
        facebook: 12500,
        instagram: 24300,
        linkedin: 8400,
        youtube: 42000,
        tiktok: 31200,
        x: 15400,
        threads: 4300,
        pinterest: 9500,
      };
      const dailyGrowth: Record<string, number> = {
        facebook: 15,
        instagram: 45,
        linkedin: 20,
        youtube: 110,
        tiktok: 75,
        x: 35,
        threads: 10,
        pinterest: 25,
      };

      const base = baseFollowers[platform] || 5000;
      const growth = dailyGrowth[platform] || 10;

      for (let i = 30; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

        const dailyFollowers = base - i * growth + Math.floor(Math.random() * 20 - 10);
        const reach = growth * 100 + Math.floor(Math.random() * 1500);
        const impressions = reach * 1.5 + Math.floor(Math.random() * 2000);
        const profileVisits = Math.floor(reach * 0.05) + Math.floor(Math.random() * 50);

        await prisma.accountInsightDaily.upsert({
          where: {
            socialAccountId_date: {
              socialAccountId: account.id,
              date,
            },
          },
          create: {
            socialAccountId: account.id,
            date,
            followers: Math.max(0, dailyFollowers),
            reach,
            impressions,
            profileVisits,
            engagementRate: 2.5 + Math.random() * 3,
          },
          update: {
            followers: Math.max(0, dailyFollowers),
            reach,
            impressions,
            profileVisits,
            engagementRate: 2.5 + Math.random() * 3,
          },
        });
      }
    }
  }
}

export interface CollectDailyInsightsResult {
  accountsTotal: number;
  accountErrors: number;
  postInsightErrors: number;
}

export async function collectDailyInsights(clientId?: string): Promise<CollectDailyInsightsResult> {
  const result: CollectDailyInsightsResult = { accountsTotal: 0, accountErrors: 0, postInsightErrors: 0 };
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
        healthStatus: { not: 'expired' },
        ...(clientId ? { clientId } : {}),
      },
    });
    result.accountsTotal = accounts.length;

    for (const account of accounts) {
      try {
        await syncAccount(account.id);
      } catch (err: unknown) {
        result.accountErrors++;
        logSocialError(`Failed to collect daily insights for account ${account.id}`, err);
      }
    }

    // Collect post insights for posts published in the last 90 days
    const recentPosts = await prisma.socialPost.findMany({
      where: {
        // Include PARTIAL so successful destinations still collect insights
        // when another platform (e.g. YouTube) failed.
        status: { in: ['PUBLISHED', 'PARTIAL'] },
        publishedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
        ...(clientId ? { clientId } : {}),
      },
      include: {
        destinations: {
          include: {
            socialAccount: true,
          },
        },
      },
    });

    for (const post of recentPosts) {
      for (const dest of post.destinations) {
        if (dest.status !== 'PUBLISHED') continue;
        try {
          const platform = dest.platform.toLowerCase();
          let metrics = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, views: 0 };
          
          const decryptToken = (await import('./token-crypto.service.js')).decryptToken;
          let socialAccount = dest.socialAccount;
          if (socialAccount?.refreshTokenEnc) {
            socialAccount = await ensureFreshAccessToken(socialAccount);
          }
          const token = socialAccount?.accessTokenEnc ? decryptToken(socialAccount.accessTokenEnc) : '';
          if (!token) {
            // No token at all (missing account credentials, or decryption
            // failed) — a real error, not a demo account. Skip rather than
            // fabricate engagement numbers into this client's real analytics.
            result.postInsightErrors++;
            console.warn(`[insights] No usable access token for destination ${dest.id} — skipping instead of fabricating metrics.`);
            continue;
          }
          const isMock = token === 'mock_access_token_data' || token.startsWith('mock_');

          if (isMock) {
            // For mock or test accounts, generate deterministic non-zero mock metrics if missing
            const seedNum = (post.id.charCodeAt(0) || 1) + (dest.platform.charCodeAt(0) || 1);
            const baseLikes = (seedNum * 7) % 65 + 12;
            const baseComments = (seedNum * 3) % 15 + 2;
            const baseShares = (seedNum * 2) % 8 + 1;
            metrics = {
              impressions: (baseLikes + baseComments) * 12,
              reach: (baseLikes + baseComments) * 8,
              likes: baseLikes,
              comments: baseComments,
              shares: baseShares,
              saved: (seedNum * 4) % 10,
              views: post.mediaType === 'video' ? (seedNum * 15) % 350 + 50 : 0,
            };
          } else if (dest.platformPostId) {
            if (platform === 'facebook' || platform === 'instagram') {
              const { getMetaPostInsights } = await import('./meta.service.js');
              metrics = await getMetaPostInsights(dest.platformPostId, token, platform as any);
            } else if (platform === 'youtube') {
              const { getYouTubePostInsights } = await import('./youtube.service.js');
              metrics = await getYouTubePostInsights(dest.platformPostId, token);
            } else {
              // No live post-insight path for this platform yet — skip upsert so
              // we don't clobber existing rows with fabricated zeros.
              continue;
            }
          } else {
            continue;
          }

          // Preserve previously stored post metrics when a live fetch returns
          // blanks / partial zeros (common for video insights permission gaps).
          const existingPostInsight = await prisma.postInsight.findUnique({
            where: { postId_platform: { postId: post.id, platform: dest.platform } },
          });
          const hasSignal =
            metrics.likes > 0 || metrics.comments > 0 || metrics.shares > 0 ||
            metrics.saved > 0 || metrics.views > 0 || metrics.reach > 0 || metrics.impressions > 0;
          if (!isMock && !hasSignal && existingPostInsight) continue;

          const mergeMetric = (incoming: number, prev: number | null | undefined): number => {
            if (incoming > 0) return incoming;
            if ((prev ?? 0) > 0) return prev as number;
            return incoming;
          };

          const merged = {
            impressions: mergeMetric(metrics.impressions, existingPostInsight?.impressions),
            reach: mergeMetric(metrics.reach, existingPostInsight?.reach),
            likes: mergeMetric(metrics.likes, existingPostInsight?.likes),
            comments: mergeMetric(metrics.comments, existingPostInsight?.comments),
            shares: mergeMetric(metrics.shares, existingPostInsight?.shares),
            saved: mergeMetric(metrics.saved, existingPostInsight?.saved),
            views: mergeMetric(metrics.views, existingPostInsight?.views),
          };

          await prisma.postInsight.upsert({
            where: {
              postId_platform: {
                postId: post.id,
                platform: dest.platform,
              },
            },
            create: {
              postId: post.id,
              platform: dest.platform,
              ...merged,
            },
            update: {
              ...merged,
              fetchedAt: new Date(),
            },
          });
        } catch (err: unknown) {
          if (isSoftInsightSkip(err)) {
            console.warn(
              `[insights] Skipping destination ${dest.id}: ${extractSocialApiError(err)}`,
            );
          } else {
            result.postInsightErrors++;
            logSocialError(`Failed to collect post insights for destination ${dest.id}`, err);
          }
        }
      }
    }
  } catch (err: unknown) {
    logSocialError('Error in collectDailyInsights job', err);
  }
  return result;
}

export function startSocialScheduler(): void {
  // 1. Process due posts every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    processDuePosts().catch(err => console.error('social scheduler processDuePosts error:', err));
  });

  // 2. Refresh expiring tokens every 45 minutes (YouTube access tokens ~1h)
  cron.schedule('*/45 * * * *', () => {
    refreshExpiringTokens().catch(err => console.error('social scheduler refreshExpiringTokens error:', err));
  });

  // 3. Collect daily insights every day at 2 AM
  cron.schedule('0 2 * * *', () => {
    // Cron-triggered runs take the cross-instance lock; manual per-client runs don't need it.
    withJobLock('collectDailyInsights', async () => { await collectDailyInsights(); })
      .catch(err => console.error('social scheduler collectDailyInsights error:', err));
  });

  // 4. Fill in missing public post URLs every 15 minutes. Mainly TikTok: at
  //    publish time we only have a publish_id and the video is still processing,
  //    so the real video link only becomes available a few minutes later.
  cron.schedule('*/15 * * * *', () => {
    withJobLock('resolvePendingPermalinks', async () => { await resolvePendingPermalinks(); })
      .catch(err => console.error('social scheduler resolvePendingPermalinks error:', err));
  });

  console.log('✔ Social media scheduler jobs successfully initialized');
}
