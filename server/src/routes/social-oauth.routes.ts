import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { verifyOAuthState, createOAuthState } from '../lib/social/oauth-state.service.js';
import { encryptToken, decryptToken } from '../lib/social/token-crypto.service.js';
import * as meta from '../lib/social/meta.service.js';
import * as tiktok from '../lib/social/tiktok.service.js';
import * as linkedin from '../lib/social/linkedin.service.js';
import * as youtube from '../lib/social/youtube.service.js';
import * as x from '../lib/social/x.service.js';
import * as pinterest from '../lib/social/pinterest.service.js';
import { randomBytes } from 'crypto';

const router = Router();

// ─── In-memory account picker session store (10 min TTL) ─────────────────────
type PendingMetaPage = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  pageFollowers?: number | null;
  pageAvatarUrl?: string | null;
  igAccountId?: string | null;
  igUsername?: string | null;
  igFollowers?: number | null;
  igAvatarUrl?: string | null;
};

type PendingPickerSession = {
  expires: number;
  platform: string;
  clientId: string;
  groupId: string;
  /** Long-lived Meta user token — stored as refreshTokenEnc so page tokens can be renewed. */
  userAccessToken?: string;
  /** Pages shown in the picker (platform-filtered). */
  pages: PendingMetaPage[];
  /**
   * Full /me/accounts grant from this login. Used to re-mint sibling client
   * tokens even when the user only selects one Page in our picker.
   */
  allPages?: PendingMetaPage[];
};

const pendingOAuthStore = new Map<string, PendingPickerSession>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingOAuthStore) {
    if (v.expires < now) pendingOAuthStore.delete(k);
  }
}, 60_000);

// ─── Platform capability map ──────────────────────────────────────────────────
const PLATFORM_CAPABILITIES: Record<string, Record<string, boolean>> = {
  facebook:  { publishing: true,  analytics: true,  comments: true,  messages: true,  reels: true,  stories: true  },
  instagram: { publishing: true,  analytics: true,  comments: true,  messages: false, reels: true,  stories: true  },
  linkedin:  { publishing: true,  analytics: true,  comments: false, messages: false, reels: false, stories: false },
  tiktok:    { publishing: true,  analytics: true,  comments: false, messages: false, reels: true,  stories: false },
  youtube:   { publishing: true,  analytics: true,  comments: false, messages: false, reels: true,  stories: false },
  x:         { publishing: true,  analytics: true,  comments: true,  messages: false, reels: false, stories: false },
  pinterest: { publishing: true,  analytics: false, comments: false, messages: false, reels: false, stories: false },
  threads:   { publishing: true,  analytics: false, comments: false, messages: false, reels: false, stories: false },
};

const ALL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x', 'threads', 'pinterest'];

// ─── 1. OAuth connect — redirects to platform ────────────────────────────────
router.get('/oauth/connect', authenticate, async (req, res, next) => {
  try {
    const { platform, clientId, groupId } = req.query as { platform: string; clientId: string; groupId: string };

    if (!platform || !clientId || !groupId) {
      res.status(400).json({ error: 'Missing platform, clientId, or groupId' });
      return;
    }

    const settings = await prisma.agencySettings.findFirst();
    const isEnabled =
      platform === 'facebook' || platform === 'instagram' || platform === 'threads' ? settings?.metaEnabled :
      platform === 'tiktok' ? settings?.tiktokEnabled :
      platform === 'linkedin' ? settings?.linkedinEnabled :
      platform === 'youtube' ? settings?.googleEnabled :
      platform === 'x' ? settings?.xEnabled :
      platform === 'pinterest' ? settings?.pinterestEnabled : false;

    if (!isEnabled) {
      res.status(400).json({ error: `Platform ${platform} is not enabled in settings` });
      return;
    }

    let authUrl = '';
    if (platform === 'facebook' || platform === 'instagram' || platform === 'threads') {
      authUrl = meta.getMetaAuthorizationUrl(platform as any, clientId, groupId);
      try {
        const parsed = new URL(authUrl);
        console.log(
          `[OAuth Connect] platform=${platform} hasConfigId=${parsed.searchParams.has('config_id')} ` +
            `hasScope=${parsed.searchParams.has('scope')} responseType=${parsed.searchParams.get('response_type')}`,
        );
      } catch {
        /* ignore URL parse errors */
      }
    } else if (platform === 'tiktok') {
      authUrl = tiktok.getTikTokAuthorizationUrl(clientId, groupId);
    } else if (platform === 'linkedin') {
      authUrl = linkedin.getLinkedInAuthorizationUrl(clientId, groupId);
    } else if (platform === 'youtube') {
      authUrl = youtube.getYouTubeAuthorizationUrl(clientId, groupId);
    } else if (platform === 'x') {
      authUrl = x.getXAuthorizationUrl(clientId, groupId);
    } else if (platform === 'pinterest') {
      authUrl = pinterest.getPinterestAuthorizationUrl(clientId, groupId);
    } else {
      res.status(400).json({ error: 'Unsupported platform' });
      return;
    }

    res.json({ url: authUrl });
    return;
  } catch (err) {
    next(err);
    return;
  }
});

// ─── 2. OAuth callback ────────────────────────────────────────────────────────
router.get('/oauth/callback/:platform', async (req, res, next) => {
  const { platform } = req.params;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const { code, state, error, error_description, error_reason } = req.query as {
      code: string;
      state: string;
      error?: string;
      error_description?: string;
      error_reason?: string;
    };
    if (error) {
      console.error(
        `[OAuth Callback Error] Platform: ${platform}: Meta returned error=` +
          `${error} reason=${error_reason || ''} desc=${error_description || ''}`,
      );
      throw new Error(error_description || error_reason || error);
    }
    if (!code || !state) throw new Error('Callback missing code or state parameters');

    const verified = verifyOAuthState(state);
    if (verified.platform !== platform) throw new Error('OAuth state platform mismatch');

    const { clientId, groupId } = verified as { clientId: string; groupId: string };
    let tokenData: any = {};

    // ── Meta (Facebook / Instagram) ──
    if (platform === 'facebook' || platform === 'instagram') {
      const userToken = await meta.exchangeMetaCodeForToken(platform as any, code);
      const longLivedToken = await meta.getMetaLongLivedToken(userToken);
      const pages = await meta.getPagesWithInstagram(longLivedToken);

      if (pages.length === 0) {
        const msg = platform === 'instagram'
          ? 'No Instagram Business accounts linked to your Facebook Pages were found. Ensure your IG account is a Professional account linked to a Facebook Page.'
          : 'No Facebook Pages found. Verify you have Admin access to at least one Page.';
        throw new Error(msg);
      }

      // Filter relevant pages per platform
      const relevantPages = platform === 'instagram'
        ? pages.filter((p: any) => p.igAccountId)
        : pages;

      if (relevantPages.length === 0) {
        throw new Error('No matching accounts found for this platform. Please link your Instagram to a Facebook Page.');
      }

      // If only 1 page → save immediately, skip picker
      if (relevantPages.length === 1) {
        const page = relevantPages[0];
        const owner = await findPageOwner(platform, clientId, page);
        if (owner) {
          // Still reconcile — this grant may have refreshed (or revoked) siblings.
          await reconcileSiblingMetaAccounts(longLivedToken, pages);
          const ownerName = owner.client?.company || owner.client?.name || 'another client';
          const label = platform === 'instagram'
            ? (page.igUsername || page.pageName)
            : page.pageName;
          throw new Error(
            `"${label}" is already connected to ${ownerName}. ` +
              `Open that client to reconnect, or keep all client Pages checked in Facebook and pick a different account.`,
          );
        }
        const saved = await saveMetaAccount(platform, clientId, groupId, page, longLivedToken);
        const reconcile = await reconcileSiblingMetaAccounts(longLivedToken, pages, saved?.id);
        const dropHint = reconcile.dropped.length
          ? `&warning=${encodeURIComponent(
              `Meta’s Facebook grant now only includes the Page(s) you checked. ` +
                `${reconcile.dropped.length} other account(s) lost access (${reconcile.dropped.map((d) => d.accountName).join(', ')}). ` +
                `Reconnect those clients and keep ALL client Pages checked in Facebook.`,
            )}`
          : '';
        res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?connected=true${dropHint}`);
        return;
      }

      // Multiple pages → store in picker session
      const sessionId = randomBytes(16).toString('hex');
      pendingOAuthStore.set(sessionId, {
        expires: Date.now() + 10 * 60 * 1000,
        platform,
        clientId,
        groupId,
        userAccessToken: longLivedToken,
        pages: relevantPages as PendingMetaPage[],
        allPages: pages as PendingMetaPage[],
      });

      res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/select-account?session=${sessionId}&platform=${platform}`);
      return;
    }

    // ── Other platforms ──
    if (platform === 'threads') {
      const token = await meta.exchangeMetaCodeForToken('threads', code);
      const profile = await meta.getThreadsProfile(token);
      tokenData = {
        accessToken: token,
        refreshToken: null,
        expiresIn: 3600 * 24,
        userId: profile.userId,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        followers: profile.followers,
      };
    } else if (platform === 'tiktok') {
      const d = await tiktok.exchangeTikTokCodeForToken(code);
      tokenData = { 
        accessToken: d.access_token, 
        refreshToken: d.refresh_token, 
        expiresIn: d.expires_in, 
        userId: d.open_id, 
        username: d.username,
        avatarUrl: d.avatarUrl || null
      };
    } else if (platform === 'linkedin') {
      const d = await linkedin.exchangeLinkedInCodeForToken(code);
      tokenData = { accessToken: d.access_token, refreshToken: null, expiresIn: d.expires_in, userId: d.urn, username: d.name };
    } else if (platform === 'youtube') {
      const d = await youtube.exchangeYouTubeCodeForToken(code);
      tokenData = { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in, userId: d.channelId, username: d.name };
    } else if (platform === 'x') {
      const codeVerifier = (verified as any).codeVerifier || req.cookies?.x_code_verifier || '';
      const d = await x.exchangeXCodeForToken(code, codeVerifier);
      tokenData = { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in, userId: d.platformUserId, username: d.username };
    } else if (platform === 'pinterest') {
      const d = await pinterest.exchangePinterestCodeForToken(code);
      tokenData = { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in, userId: d.username, username: d.username };
    }

    const acc = await prisma.socialAccount.upsert({
      where: { clientId_platform_platformUserId: { clientId, platform, platformUserId: tokenData.userId } },
      create: {
        clientId, platform,
        platformUserId: tokenData.userId,
        platformUsername: tokenData.username,
        displayName: tokenData.username,
        avatarUrl: tokenData.avatarUrl || null,
        accessTokenEnc: encryptToken(tokenData.accessToken),
        refreshTokenEnc: tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : null,
        tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
        groupName: groupId,
      },
      update: {
        platformUsername: tokenData.username,
        displayName: tokenData.username,
        avatarUrl: tokenData.avatarUrl || undefined,
        accessTokenEnc: encryptToken(tokenData.accessToken),
        refreshTokenEnc: tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : null,
        tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null,
      },
    });

    try {
      const { syncAccount } = await import('../lib/social/social-scheduler.js');
      await syncAccount(acc.id);
    } catch (err) {
      console.error('Failed to run initial sync for oauth account:', err);
    }

    res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?connected=true`);
  } catch (err: any) {
    const { extractSocialApiError, redactSecrets } = await import('../lib/social/safe-error.js');
    const safeMsg = extractSocialApiError(err);
    console.error(`[OAuth Callback Error] Platform: ${req.params.platform}:`, redactSecrets(safeMsg));
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?error=${encodeURIComponent(safeMsg)}`);
  }
});

/**
 * A Facebook Page / IG Business account belongs to exactly one client.
 *
 * The unique key on SocialAccount is [clientId, platform, platformUserId], so
 * saving a Page that another client already owns does NOT collide — it creates
 * a second row and the same Page ends up living under two clients. That is the
 * "all three clients became one CRM account" failure. Look up the real owner
 * first so we can skip instead of duplicating.
 */
async function findPageOwner(platform: string, clientId: string | null, page: any) {
  const ownerMatches: any[] = [];
  if (platform === 'facebook' && page.pageId) {
    ownerMatches.push({ platformUserId: page.pageId }, { pageId: page.pageId });
  } else if (platform === 'instagram' && page.igAccountId) {
    ownerMatches.push({ platformUserId: page.igAccountId }, { igAccountId: page.igAccountId });
  }
  if (!ownerMatches.length) return null;

  return prisma.socialAccount.findFirst({
    // clientId === null asks "who owns this Page anywhere?" — used by the picker
    // to pin a Page to its existing client. Passing a clientId asks "does someone
    // OTHER than this client own it?" — the guard that blocks cross-client saves.
    where: {
      platform,
      ...(clientId ? { clientId: { not: clientId } } : {}),
      OR: ownerMatches,
    },
    select: {
      id: true,
      clientId: true,
      displayName: true,
      client: { select: { name: true, company: true } },
    },
  });
}

type SiblingReconcileResult = {
  refreshed: number;
  /** Siblings Meta revoked because they were missing from this Facebook grant. */
  dropped: Array<{ accountName: string; clientName: string; platform: string }>;
};

/**
 * Multi-client Meta reconcile:
 *
 * - Pages IN this grant → refresh their page tokens (including other clients).
 * - Pages NOT in this grant → do NOT overwrite their stored tokens with this
 *   login's user token. Probe the stored page token; if Meta already revoked
 *   it (Login-for-Business "current Pages only" replaces the whole grant),
 *   mark the account expired with a clear recovery message.
 *
 * Our app still connects one CRM client at a time. Meta, however, keeps one
 * Page grant per Facebook user+app — unchecking Pages in Facebook revokes them.
 */
async function reconcileSiblingMetaAccounts(
  userAccessToken: string,
  pages: Array<{
    pageId: string;
    pageAccessToken?: string;
    igAccountId?: string | null;
  }>,
  exceptAccountIds?: string | string[],
): Promise<SiblingReconcileResult> {
  const result: SiblingReconcileResult = { refreshed: 0, dropped: [] };

  const usable = pages.filter((p) => p.pageAccessToken);
  const byPageId = new Map(usable.map((p) => [p.pageId, p]));
  const byIgId = new Map(
    usable.filter((p) => p.igAccountId).map((p) => [p.igAccountId as string, p]),
  );

  const exclude = exceptAccountIds
    ? Array.isArray(exceptAccountIds) ? exceptAccountIds : [exceptAccountIds]
    : [];

  const siblings = await prisma.socialAccount.findMany({
    where: {
      isActive: true,
      platform: { in: ['facebook', 'instagram'] },
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
    },
    select: {
      id: true,
      clientId: true,
      platform: true,
      pageId: true,
      platformUserId: true,
      igAccountId: true,
      displayName: true,
      healthStatus: true,
      accessTokenEnc: true,
      client: { select: { name: true, company: true } },
    },
  });

  const refreshTokenEnc = encryptToken(userAccessToken);
  const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const grantedNames = usable
    .map((p) => p.pageId)
    .filter(Boolean)
    .slice(0, 6);

  for (const acc of siblings) {
    const page =
      acc.platform === 'facebook'
        ? byPageId.get(acc.pageId || acc.platformUserId)
        : byIgId.get(acc.igAccountId || acc.platformUserId) ||
          byPageId.get(acc.pageId || '');

    if (page?.pageAccessToken) {
      await prisma.socialAccount.update({
        where: { id: acc.id },
        data: {
          accessTokenEnc: encryptToken(page.pageAccessToken),
          refreshTokenEnc,
          tokenExpiresAt,
          healthStatus: 'healthy',
          healthMessage: null,
        },
      });
      result.refreshed++;
      try {
        const { syncAccount } = await import('../lib/social/social-scheduler.js');
        await syncAccount(acc.id);
      } catch (err) {
        console.warn(`[OAuth] Sibling sync failed for ${acc.id}:`, err);
      }
      continue;
    }

    // Missing from this Facebook grant. Meta often revokes those Page tokens
    // immediately — probe and surface that instead of waiting for Sync.
    const probeId = acc.pageId || acc.platformUserId;
    if (!probeId) continue;
    let stillValid = true;
    try {
      stillValid = await meta.isPageTokenStillValid(probeId, decryptToken(acc.accessTokenEnc));
    } catch {
      continue;
    }
    if (stillValid) continue;

    const clientName = acc.client?.company || acc.client?.name || 'another client';
    const message =
      `Meta revoked access after a Facebook login that only included other Pages` +
      (grantedNames.length ? ` (granted page ids: ${grantedNames.join(', ')})` : '') +
      `. Reconnect ${acc.platform} for ${clientName}, and in Facebook’s dialog keep EVERY client Page checked ` +
      `(Tokka, Papparoti, Te'Amo) — or set the Login for Business config to “all current and future Pages”. ` +
      `In our app, still select only this client’s account.`;

    const wasAlreadyExpired = acc.healthStatus === 'expired';
    await prisma.socialAccount.update({
      where: { id: acc.id },
      data: { healthStatus: 'expired', healthMessage: message },
    });
    result.dropped.push({
      accountName: acc.displayName,
      clientName,
      platform: acc.platform,
    });
    if (!wasAlreadyExpired) {
      try {
        await prisma.notification.create({
          data: {
            title: 'Social Account Disconnected',
            message: `${acc.displayName} (${acc.platform}) lost Meta access. ${message}`,
            type: 'SOCIAL_ACCOUNT_EXPIRED',
            category: 'WARNING',
            entityType: 'CLIENT',
            entityId: acc.clientId,
          },
        });
      } catch (err) {
        console.warn(`[OAuth] Could not create drop notification for ${acc.id}:`, err);
      }
    }
  }

  if (result.refreshed > 0) {
    console.log(`[OAuth] Refreshed ${result.refreshed} sibling Meta account(s) from shared Facebook login`);
  }
  if (result.dropped.length > 0) {
    console.warn(
      `[OAuth] ${result.dropped.length} Meta account(s) revoked by narrowed Facebook grant: ` +
        result.dropped.map((d) => `${d.accountName} (${d.clientName})`).join(', '),
    );
  }
  return result;
}

// ─── Helper: save a Meta account ─────────────────────────────────────────────
async function saveMetaAccount(
  platform: string,
  clientId: string,
  groupId: string,
  page: any,
  userAccessToken?: string,
): Promise<{ id: string } | null> {
  // Never attach another client's Page under a different CRM client.
  const owner = await findPageOwner(platform, clientId, page);
  if (owner) {
    const ownerName = owner.client?.company || owner.client?.name || 'another client';
    throw new Error(
      `This ${platform} account is already connected to ${ownerName}. ` +
        'Reconnect under that client instead of attaching it here.',
    );
  }

  // Store the long-lived USER token as refreshTokenEnc so the cron can renew
  // page tokens before the ~60-day Meta expiry. Page tokens alone are not refreshable.
  const refreshTokenEnc = userAccessToken ? encryptToken(userAccessToken) : undefined;
  let acc;
  if (platform === 'facebook') {
    acc = await prisma.socialAccount.upsert({
      where: { clientId_platform_platformUserId: { clientId, platform: 'facebook', platformUserId: page.pageId } },
      create: {
        clientId, platform: 'facebook', platformUserId: page.pageId,
        platformUsername: page.pageName, displayName: page.pageName, pageId: page.pageId,
        avatarUrl: page.pageAvatarUrl || null,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        refreshTokenEnc: refreshTokenEnc || null,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        groupName: groupId, groupColor: 'blue',
      },
      update: {
        platformUsername: page.pageName, displayName: page.pageName,
        avatarUrl: page.pageAvatarUrl || undefined,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        // Reconnecting revives an account that was soft-disconnected.
        isActive: true,
        healthStatus: 'healthy',
        healthMessage: null,
      },
    });
  } else if (platform === 'instagram' && page.igAccountId) {
    acc = await prisma.socialAccount.upsert({
      where: { clientId_platform_platformUserId: { clientId, platform: 'instagram', platformUserId: page.igAccountId } },
      create: {
        clientId, platform: 'instagram', platformUserId: page.igAccountId,
        platformUsername: page.igUsername || page.pageName, displayName: page.igUsername || page.pageName,
        pageId: page.pageId, igAccountId: page.igAccountId,
        avatarUrl: page.igAvatarUrl || null,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        refreshTokenEnc: refreshTokenEnc || null,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        groupName: groupId, groupColor: 'purple',
      },
      update: {
        platformUsername: page.igUsername || page.pageName, displayName: page.igUsername || page.pageName,
        avatarUrl: page.igAvatarUrl || undefined,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        // Reconnecting revives an account that was soft-disconnected.
        isActive: true,
        healthStatus: 'healthy',
        healthMessage: null,
      },
    });
  }

  if (acc) {
    try {
      const { syncAccount } = await import('../lib/social/social-scheduler.js');
      await syncAccount(acc.id);
    } catch (err) {
      console.error('Failed to run initial sync for meta account:', err);
    }
  }
  return acc ? { id: acc.id } : null;
}

// ─── 3. Get pending picker session ───────────────────────────────────────────
router.get('/oauth/pending/:sessionId', authenticate, async (req, res) => {
  const session = pendingOAuthStore.get(req.params.sessionId as string);
  if (!session || session.expires < Date.now()) {
    res.status(410).json({ error: 'Session expired or not found. Please start the connection again.' });
    return;
  }

  // Ownership across ALL clients, so the picker can pin a Page to the client that
  // already holds it rather than just greying it out.
  const ownership = await Promise.all(
    session.pages.map(async (p) => {
      const owner = await findPageOwner(session.platform, null, p);
      return owner
        ? {
            clientId: owner.clientId,
            clientName: owner.client?.company || owner.client?.name || 'another client',
            accountName: owner.displayName,
          }
        : null;
    }),
  );

  // Return sanitized account list (no tokens)
  const accounts = session.pages.map((p: any, i: number) => ({
    id: session.platform === 'facebook' ? p.pageId : (p.igAccountId || p.pageId),
    name: session.platform === 'facebook' ? p.pageName : (p.igUsername || p.pageName),
    username: p.igUsername || null,
    avatarUrl: session.platform === 'facebook' ? (p.pageAvatarUrl || null) : (p.igAvatarUrl || p.pageAvatarUrl || null),
    followers: session.platform === 'facebook' ? (p.pageFollowers || 0) : (p.igFollowers ?? p.pageFollowers ?? 0),
    platform: session.platform,
    ownedBy: ownership[i]
      ? {
          clientId: ownership[i]!.clientId,
          clientName: ownership[i]!.clientName,
          accountName: ownership[i]!.accountName,
        }
      : null,
  }));

  res.json({
    platform: session.platform,
    clientId: session.clientId,
    accounts,
    expiresIn: Math.round((session.expires - Date.now()) / 1000),
  });
});

// ─── 4. Confirm account picker selection ─────────────────────────────────────
router.post('/oauth/select-account', authenticate, async (req, res, next) => {
  try {
    // `assignments` routes each Page to its own client, so one Facebook grant can
    // populate several clients in a single pass — the whole point of opting in to
    // all Pages. `selectedIds` is the older shape and still works: every selected
    // Page goes to the client the connect flow started from.
    const { sessionId, selectedIds, assignments } = req.body as {
      sessionId: string;
      selectedIds?: string[];
      assignments?: Array<{ id: string; clientId: string }>;
    };

    if (!sessionId || (!selectedIds?.length && !assignments?.length)) {
      res.status(400).json({ error: 'Missing sessionId or account selection' });
      return;
    }

    const session = pendingOAuthStore.get(sessionId);
    if (!session || session.expires < Date.now()) {
      res.status(410).json({ error: 'Session expired. Please reconnect.' });
      return;
    }

    const { platform, groupId } = session;

    const targetClientByPage = new Map<string, string>();
    if (assignments?.length) {
      for (const a of assignments) {
        if (a?.id && a?.clientId) targetClientByPage.set(a.id, a.clientId);
      }
    } else {
      for (const id of selectedIds!) targetClientByPage.set(id, session.clientId);
    }

    // Reject unknown clients up front rather than failing mid-loop on a FK error.
    const targetClientIds = [...new Set(targetClientByPage.values())];
    const knownClients = await prisma.client.findMany({
      where: { id: { in: targetClientIds } },
      select: { id: true },
    });
    if (knownClients.length !== targetClientIds.length) {
      res.status(400).json({ error: 'One or more selected clients no longer exist.' });
      return;
    }

    const toSave = session.pages.filter((p: any) => {
      const id = platform === 'facebook' ? p.pageId : (p.igAccountId || p.pageId);
      return targetClientByPage.has(id);
    });

    let savedCount = 0;
    const savedIds: string[] = [];
    const skippedOwned: string[] = [];

    for (const page of toSave) {
      const pageKey = platform === 'facebook' ? page.pageId : (page.igAccountId || page.pageId);
      const targetClientId = targetClientByPage.get(pageKey)!;
      const label = platform === 'instagram'
        ? (page.igUsername || page.pageName)
        : page.pageName;

      const owner = await findPageOwner(platform, targetClientId, page);
      if (owner) {
        const ownerName = owner.client?.company || owner.client?.name || 'another client';
        skippedOwned.push(`${label} (owned by ${ownerName})`);
        continue;
      }
      const saved = await saveMetaAccount(platform, targetClientId, groupId, page, session.userAccessToken);
      if (saved?.id) savedIds.push(saved.id);
      savedCount++;
    }

    if (savedCount === 0 && skippedOwned.length > 0) {
      res.status(409).json({
        error:
          `Selected account(s) already belong to another client: ${skippedOwned.join(', ')}. ` +
          `Assign each Page to the client that owns it.`,
      });
      return;
    }

    // Re-mint tokens for every Page in the Facebook grant (not just selected ones)
    let siblingsRefreshed = 0;
    let siblingsDropped: SiblingReconcileResult['dropped'] = [];
    if (session.userAccessToken) {
      const grantPages = session.allPages?.length ? session.allPages : session.pages;
      const reconcile = await reconcileSiblingMetaAccounts(
        session.userAccessToken,
        grantPages,
        savedIds,
      );
      siblingsRefreshed = reconcile.refreshed;
      siblingsDropped = reconcile.dropped;
    }

    pendingOAuthStore.delete(sessionId);
    res.json({
      success: true,
      savedCount,
      siblingsRefreshed,
      siblingsDropped,
      skippedOwned,
    });
  } catch (err) {
    next(err);
  }
});

// ─── 5. List all connected accounts ─────────────────────────────────────────
router.get('/accounts', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const [accounts, total] = await Promise.all([
      prisma.socialAccount.findMany({
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true, company: true } } },
      }),
      prisma.socialAccount.count(),
    ]);

    res.json({ accounts, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── 6. Workspace summary (all clients with accounts + health) ────────────────
router.get('/accounts/workspace-summary', authenticate, async (req, res, next) => {
  try {
    const [clients, allAccounts, latestSyncs, latestInsights, lastPublishes] = await Promise.all([
      prisma.client.findMany({ select: { id: true, name: true, company: true } }),
      prisma.socialAccount.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
      prisma.accountInsightDaily.groupBy({
        by: ['socialAccountId'],
        _max: { date: true },
      }),
      // FIX (totalFollowers always 0): previously totalFollowers was computed as
      // `accounts.reduce((s, _a) => s, 0)` — a reducer that ignores its own
      // element entirely, always returning 0 for every workspace regardless of
      // real account size. Fetches each account's most recent daily follower
      // count so the workspace summary can report a real total.
      prisma.accountInsightDaily.findMany({
        orderBy: { date: 'desc' },
        distinct: ['socialAccountId'],
        select: { socialAccountId: true, followers: true },
      }),
      prisma.socialPost.findMany({
        where: { status: 'PUBLISHED', publishedAt: { not: null } },
        select: { clientId: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 1000,
      }),
    ]);

    // Map: accountId → most recent follower count
    const followersMap = new Map(latestInsights.map((i: any) => [i.socialAccountId, i.followers || 0]));

    // Map: accountId → lastSyncDate
    const syncMap = new Map(latestSyncs.map((s: any) => [s.socialAccountId, s._max.date]));

    // Map: clientId → lastPublishDate
    const publishMap = new Map<string, Date>();
    for (const p of lastPublishes) {
      if (!publishMap.has(p.clientId) && p.publishedAt) {
        publishMap.set(p.clientId, p.publishedAt);
      }
    }

    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const WEEK_MS = 7 * DAY_MS;

    const workspaces = clients.map(client => {
      const accounts = allAccounts.filter(a => a.clientId === client.id).map(acc => ({
        ...acc,
        lastSync: syncMap.get(acc.id) || null,
        capabilities: PLATFORM_CAPABILITIES[acc.platform.toLowerCase()] || {},
      }));

      const connectedPlatforms = accounts.map(a => a.platform.toLowerCase());
      const missingPlatforms = ALL_PLATFORMS.filter(p => !connectedPlatforms.includes(p));

      const lastSync = accounts.reduce<Date | null>((latest, acc) => {
        const d = acc.lastSync as Date | null;
        if (!d) return latest;
        return !latest || d > latest ? d : latest;
      }, null);

      const lastPublish = publishMap.get(client.id) || null;

      // Health scoring
      // FIX: previously ANY non-'healthy' status (including a merely rate-limited
      // or transient-warning account, which is often self-resolving in minutes)
      // escalated the ENTIRE workspace to 'critical' — the same severity as an
      // actually broken/expired account needing re-auth. Now only 'expired'
      // (or another account explicitly needing reconnection) is critical;
      // rate-limited/warning accounts correctly surface as 'warning' instead.
      let healthStatus: 'healthy' | 'warning' | 'critical' | 'empty' = 'empty';
      if (accounts.length > 0) {
        const hasBroken = accounts.some(a => a.healthStatus === 'expired' || a.healthStatus === 'disconnected');
        const hasWarning = accounts.some(a => a.healthStatus === 'warning' || a.healthStatus === 'rate_limited');
        const hasExpiringSoon = accounts.some(a => a.tokenExpiresAt && (new Date(a.tokenExpiresAt).getTime() - now.getTime()) < WEEK_MS);
        const hasSyncGap = !lastSync || (now.getTime() - new Date(lastSync).getTime()) > DAY_MS;

        if (hasBroken) {
          healthStatus = 'critical';
        } else if (hasWarning || hasExpiringSoon || hasSyncGap) {
          healthStatus = 'warning';
        } else {
          healthStatus = 'healthy';
        }
      }

      const totalFollowers = accounts.reduce((s, a) => s + (followersMap.get(a.id) || 0), 0);

      return {
        clientId: client.id,
        clientName: client.name,
        clientCompany: client.company,
        healthStatus,
        accounts,
        connectedPlatforms,
        missingPlatforms,
        lastPublish,
        lastSync,
        totalFollowers,
        accountCount: accounts.length,
      };
    }).filter(w => w.accountCount > 0);

    // Summary KPIs
    const summary = {
      totalWorkspaces: workspaces.length,
      totalAccounts: allAccounts.length,
      activePlatforms: new Set(allAccounts.map(a => a.platform)).size,
      needsAttention: workspaces.filter(w => w.healthStatus === 'critical' || w.healthStatus === 'warning').length,
    };

    res.json({ summary, workspaces });
  } catch (err) {
    next(err);
  }
});

// ─── 7a. Profile picture proxy (mobile / CDN-safe) ───────────────────────────
// Facebook/Instagram CDN URLs often fail in React Native Image while working in
// browsers. This streams the exact profile photo through our API (and refreshes
// Meta picture URLs when the stored CDN link has expired).
router.get('/accounts/:accountId/avatar', authenticate, async (req, res, next) => {
  try {
    const accountId = req.params.accountId as string;
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    let imageUrl = account.avatarUrl || null;
    const platform = account.platform.toLowerCase();
    const axios = (await import('axios')).default;

    const tryFetchBuffer = async (url: string) => {
      const upstream = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return upstream;
    };

    let upstream: Awaited<ReturnType<typeof tryFetchBuffer>> | null = null;
    if (imageUrl) {
      try {
        upstream = await tryFetchBuffer(imageUrl);
      } catch {
        upstream = null;
      }
    }

    // Refresh Meta avatars when stored CDN URL is missing or dead.
    if (!upstream && (platform === 'facebook' || platform === 'instagram' || platform === 'threads')) {
      try {
        const token = decryptToken(account.accessTokenEnc);
        if (token && !token.startsWith('mock_')) {
          const fresh = await meta.fetchMetaAvatarUrl({
            platform,
            accessToken: token,
            pageId: account.pageId,
            igAccountId: account.igAccountId,
            platformUserId: account.platformUserId,
          });
          if (fresh) {
            imageUrl = fresh;
            if (fresh !== account.avatarUrl) {
              await prisma.socialAccount.update({
                where: { id: account.id },
                data: { avatarUrl: fresh },
              });
            }
            upstream = await tryFetchBuffer(fresh);
          }
        }
      } catch (err) {
        console.warn('Avatar refresh failed:', (err as Error)?.message || err);
      }
    }

    if (!upstream || !imageUrl) {
      res.status(404).json({ error: 'Avatar not available' });
      return;
    }

    const contentType =
      (upstream.headers['content-type'] as string | undefined)?.split(';')[0] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(Buffer.from(upstream.data));
  } catch (err) {
    next(err);
  }
});

// ─── 7. Virtual activity feed for an account ──────────────────────────────────
router.get('/accounts/:accountId/activity', authenticate, async (req, res, next) => {
  try {
    const accountId = req.params.accountId as string;

    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // FIX: this previously passed `clientId: undefined as any` to Prisma, which
    // Prisma silently treats as "no filter at all" — so it pulled the 50 most
    // recently-published posts across the ENTIRE agency, then filtered down to
    // this client/account in JS afterward. For any agency with more than a
    // handful of active clients, this account's real activity could easily be
    // pushed out of that top-50 window by other clients' posts, leaving the
    // activity feed empty even though the account has plenty of real history.
    // Now scopes directly to this client AND this specific account in the query.
    const [posts, insights] = await Promise.all([
      prisma.socialPost.findMany({
        where: {
          clientId: account.clientId,
          destinations: { some: { socialAccountId: accountId } },
        },
        select: { status: true, publishedAt: true, caption: true, mediaType: true, clientId: true, destinations: { select: { platform: true } } },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      }),
      prisma.accountInsightDaily.findMany({
        where: { socialAccountId: accountId },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    const accountPosts = posts;

    type ActivityEvent = { type: string; label: string; detail?: string; date: Date };
    const events: ActivityEvent[] = [];

    // Account connected
    events.push({ type: 'connected', label: 'Account connected', date: new Date(account.createdAt) });

    // Token refreshed (if tokenExpiresAt was set recently — within 90 days forward from creation)
    if (account.tokenExpiresAt && account.updatedAt > account.createdAt) {
      events.push({ type: 'token_refreshed', label: 'OAuth token refreshed', date: new Date(account.updatedAt) });
    }

    // Published / failed posts
    for (const post of accountPosts.slice(0, 15)) {
      if (!post.publishedAt) continue;
      const mediaLabel = post.mediaType ? ` ${post.mediaType.charAt(0).toUpperCase() + post.mediaType.slice(1)}` : '';
      if (post.status === 'PUBLISHED') {
        events.push({
          type: 'published',
          label: `Published${mediaLabel} successfully`,
          detail: post.caption ? post.caption.slice(0, 60) + (post.caption.length > 60 ? '…' : '') : undefined,
          date: new Date(post.publishedAt),
        });
      } else if (post.status === 'FAILED') {
        events.push({
          type: 'failed',
          label: `Post failed to publish`,
          detail: post.caption ? post.caption.slice(0, 60) + '…' : undefined,
          date: new Date(post.publishedAt),
        });
      }
    }

    // Analytics synced
    for (const insight of insights.slice(0, 5)) {
      events.push({ type: 'synced', label: 'Analytics synchronized', date: new Date(insight.date) });
    }

    // Sort by date desc and take top 12
    events.sort((a, b) => b.date.getTime() - a.date.getTime());

    res.json({ events: events.slice(0, 12) });
  } catch (err) {
    next(err);
  }
});

// ─── 8. Trigger sync for a single account ────────────────────────────────────
router.post('/accounts/:accountId/sync', authenticate, async (req, res, next) => {
  try {
    const accountId = req.params.accountId as string;
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) { res.status(404).json({ error: 'Account not found' }); return; }

    const { syncAccount } = await import('../lib/social/social-scheduler.js');
    await syncAccount(accountId);

    // Update sync time
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, message: `Sync completed for ${account.displayName}` });
  } catch (err) {
    next(err);
  }
});

// ─── 9. Accounts by client ───────────────────────────────────────────────────
router.get('/accounts/by-client/:clientId', authenticate, async (req, res, next) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { clientId: req.params.clientId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json(accounts);
  } catch (err) { next(err); }
});

// ─── 10. Update account ──────────────────────────────────────────────────────
router.put('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    const { groupName, groupColor, isActive } = req.body;
    const account = await prisma.socialAccount.update({
      where: { id: req.params.id as string },
      data: { groupName, groupColor, isActive },
    });
    res.json(account);
  } catch (err) { next(err); }
});

// ─── 11. Delete/disconnect account ──────────────────────────────────────────
/**
 * Disconnect is a SOFT delete.
 *
 * SocialPostDestination, AccountInsightDaily, ImportedPost, AccountDemographic
 * and AccountActivity all cascade from SocialAccount. A hard delete therefore
 * wipes the client's entire publishing and analytics history — and reconnecting
 * does not bring it back, because the destination rows that tie posts to the
 * account are gone. That is how published posts ended up with orphaned insight
 * rows and an empty "By platform" list.
 *
 * Deactivating instead keeps the history and stops all sync/publish activity,
 * since every scheduler query filters on isActive. Pass ?purge=true to really
 * delete, for the rare case of removing a wrongly-created account.
 */
router.delete('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const purge = String(req.query.purge || '') === 'true';

    if (purge) {
      await prisma.socialAccount.delete({ where: { id } });
      res.json({ success: true, purged: true, message: 'Account and all its history permanently deleted' });
      return;
    }

    const account = await prisma.socialAccount.update({
      where: { id },
      data: {
        isActive: false,
        healthStatus: 'disconnected',
        healthMessage: 'Disconnected from this workspace. Post history and analytics are preserved — reconnect to resume syncing.',
      },
      select: { displayName: true },
    });

    res.json({
      success: true,
      purged: false,
      message: `${account.displayName} disconnected. Its post history and analytics are preserved.`,
    });
  } catch (err) { next(err); }
});

// ─── 12. Distinct group names ────────────────────────────────────────────────
router.get('/accounts/groups', authenticate, async (req, res, next) => {
  try {
    const groups = await prisma.socialAccount.findMany({
      select: { groupName: true, groupColor: true },
      distinct: ['groupName'],
      where: { groupName: { not: null } },
    });
    res.json(groups);
  } catch (err) { next(err); }
});

// ─── 13. Platform status ─────────────────────────────────────────────────────
router.get('/platform-status', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();
    res.json({
      facebook:  { configured: !!process.env.META_APP_ID,       enabled: settings?.metaEnabled     || false },
      instagram: { configured: !!process.env.META_APP_ID,       enabled: settings?.metaEnabled     || false },
      threads:   { configured: !!process.env.META_APP_ID,       enabled: settings?.metaEnabled     || false },
      tiktok:    { configured: !!process.env.TIKTOK_CLIENT_KEY, enabled: settings?.tiktokEnabled   || false },
      linkedin:  { configured: !!process.env.LINKEDIN_CLIENT_ID,enabled: settings?.linkedinEnabled || false },
      youtube:   { configured: !!process.env.GOOGLE_CLIENT_ID,  enabled: settings?.googleEnabled   || false },
      x:         { configured: !!process.env.X_CLIENT_ID,       enabled: settings?.xEnabled        || false },
      pinterest: { configured: !!process.env.PINTEREST_APP_ID,  enabled: settings?.pinterestEnabled|| false },
    });
  } catch (err) { next(err); }
});

export default router;
