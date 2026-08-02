import cron from 'node-cron';
import { prisma } from '../prisma.js';
import {
  publishPostToPlatform,
  refreshAccountToken,
  fetchPlatformInsights,
  ensureFreshAccessToken,
} from './platform-router.service.js';
import { isRateLimitError } from './meta.service.js';
import { decryptToken } from './token-crypto.service.js';
import { captureDestinationPermalink, resolvePendingPermalinks } from './permalink.service.js';
import { extractSocialApiError, logSocialError } from './safe-error.js';

export async function processDuePosts(): Promise<void> {
  try {
    // 1. Atomically claim destinations that are QUEUED and whose post is scheduled for <= now.
    // FIX (rate-limit retry race): previously this claimed a destination even if its
    // account was currently rate_limited, then immediately threw it back with an
    // attempts+1 penalty and no backoff — 3 claims (15 min at a 5-min cron) could
    // exhaust the retry budget and permanently FAIL a post before the rate-limit
    // cooldown even finished. Now the claim query itself excludes accounts that are
    // still within their rateLimitedUntil window.
    await prisma.$executeRawUnsafe(`
      UPDATE social_post_destinations spd
      JOIN social_posts sp ON sp.id = spd.post_id
      JOIN social_accounts sa ON sa.id = spd.social_account_id
      SET spd.status = 'PUBLISHING', spd.locked_at = NOW(), spd.last_attempt_at = NOW()
      WHERE spd.status = 'QUEUED'
        AND spd.locked_at IS NULL
        AND sp.status = 'SCHEDULED'
        AND sp.scheduled_for <= NOW()
        AND (sa.rate_limited_until IS NULL OR sa.rate_limited_until <= NOW())
    `);

    // 2. Fetch destinations claimed for scheduled publishing only.
    // Exclude publish-now in-flight work (post status PUBLISHING) so the cron
    // cannot double-publish the same destination.
    const destinations = await prisma.socialPostDestination.findMany({
      where: {
        status: 'PUBLISHING',
        lockedAt: { not: null },
        post: {
          status: 'SCHEDULED',
        },
      },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    if (destinations.length === 0) return;

    // 3. Process each destination
    for (const dest of destinations) {
      try {
        // Race-condition safety net: the claim query already excludes rate-limited
        // accounts, but an account could become rate-limited in the brief window
        // between claiming and processing. If so, release it WITHOUT counting
        // this as a failed attempt — it never actually tried to publish.
        if (dest.socialAccount.rateLimitedUntil && dest.socialAccount.rateLimitedUntil > new Date()) {
          await prisma.socialPostDestination.update({
            where: { id: dest.id },
            data: {
              status: 'QUEUED',
              lockedAt: null,
              lastError: `Skipped: rate limited until ${dest.socialAccount.rateLimitedUntil.toISOString()}`,
            },
          });
          continue;
        }

        const platformPostId = await publishPostToPlatform(dest.post, dest.socialAccount);

        await prisma.socialPostDestination.update({
          where: { id: dest.id },
          data: {
            status: 'PUBLISHED',
            platformPostId,
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        });

        // Capture the public URL so the dashboard can link straight to the live
        // post. Best-effort and non-fatal: platforms that need processing time
        // (TikTok) get picked up later by resolvePendingPermalinks().
        await captureDestinationPermalink(dest.id, dest.socialAccount, platformPostId);
      } catch (err: unknown) {
        const errorMsg = extractSocialApiError(err);
        logSocialError(`Error publishing post destination ${dest.id}`, err);

        const nextAttempts = dest.attempts + 1;
        const failedPermanently = nextAttempts >= 3;

        // Check if rate limited
        if (isRateLimitError(err)) {
          const rateLimitedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min cooldown
          await prisma.socialAccount.update({
            where: { id: dest.socialAccountId },
            data: {
              healthStatus: 'rate_limited',
              healthMessage: `Rate limit hit: ${errorMsg}`,
              rateLimitedUntil,
            },
          });
        }

        await prisma.socialPostDestination.update({
          where: { id: dest.id },
          data: {
            status: failedPermanently ? 'FAILED' : 'QUEUED',
            attempts: nextAttempts,
            lockedAt: null,
            lastError: errorMsg,
          },
        });
      }
    }

    // 4. Update the main SocialPost status based on destinations results
    const uniquePostIds = Array.from(new Set(destinations.map(d => d.postId)));
    for (const postId of uniquePostIds) {
      const allDests = await prisma.socialPostDestination.findMany({
        where: { postId },
      });

      const total = allDests.length;
      const published = allDests.filter(d => d.status === 'PUBLISHED').length;
      const failed = allDests.filter(d => d.status === 'FAILED').length;

      if (published === total) {
        await prisma.socialPost.update({
          where: { id: postId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            errorMessage: null,
          },
        });
        for (const dest of allDests) {
          if (dest.status === 'PUBLISHED') {
            await prisma.postInsight.upsert({
              where: { postId_platform: { postId, platform: dest.platform } },
              create: { postId, platform: dest.platform, likes: 0, comments: 0, shares: 0, saved: 0, views: 0, impressions: 0, reach: 0 },
              update: {},
            }).catch(() => {});
          }
        }
      } else if (published + failed === total && failed > 0) {
        // Partial success (some live, some failed) vs total failure
        const failedErrors = allDests
          .filter((d) => d.status === 'FAILED' && d.lastError)
          .map((d) => `${d.platform}: ${d.lastError}`)
          .join('; ');
        await prisma.socialPost.update({
          where: { id: postId },
          data: {
            status: published > 0 ? 'PARTIAL' : 'FAILED',
            publishedAt: published > 0 ? new Date() : undefined,
            errorMessage: failedErrors || `Failed to publish to ${failed} out of ${total} platforms.`,
          },
        });
      }
      // If there are still QUEUED ones, we keep the post status as SCHEDULED so it retries
    }
  } catch (err: unknown) {
    logSocialError('Error in processDuePosts scheduler', err);
  }
}

export async function refreshExpiringTokens(): Promise<void> {
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
        console.warn('Failed to fetch TikTok user info during sync:', err);
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
        console.warn('Failed to fetch TikTok creator info during sync:', err);
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

export async function collectDailyInsights(clientId?: string): Promise<void> {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
        healthStatus: { not: 'expired' },
        ...(clientId ? { clientId } : {}),
      },
    });

    for (const account of accounts) {
      try {
        await syncAccount(account.id);
      } catch (err: unknown) {
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
          const isMock = !token || token === 'mock_access_token_data' || token.startsWith('mock_');

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
          logSocialError(`Failed to collect post insights for destination ${dest.id}`, err);
        }
      }
    }
  } catch (err: unknown) {
    logSocialError('Error in collectDailyInsights job', err);
  }
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
    collectDailyInsights().catch(err => console.error('social scheduler collectDailyInsights error:', err));
  });

  // 4. Fill in missing public post URLs every 15 minutes. Mainly TikTok: at
  //    publish time we only have a publish_id and the video is still processing,
  //    so the real video link only becomes available a few minutes later.
  cron.schedule('*/15 * * * *', () => {
    resolvePendingPermalinks().catch(err => console.error('social scheduler resolvePendingPermalinks error:', err));
  });

  console.log('✔ Social media scheduler jobs successfully initialized');
}
