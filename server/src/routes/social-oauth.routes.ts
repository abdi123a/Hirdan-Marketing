import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { verifyOAuthState, createOAuthState } from '../lib/social/oauth-state.service.js';
import { encryptToken } from '../lib/social/token-crypto.service.js';
import * as meta from '../lib/social/meta.service.js';
import * as tiktok from '../lib/social/tiktok.service.js';
import * as linkedin from '../lib/social/linkedin.service.js';
import * as youtube from '../lib/social/youtube.service.js';
import * as x from '../lib/social/x.service.js';
import * as pinterest from '../lib/social/pinterest.service.js';
import { randomBytes } from 'crypto';

const router = Router();

// ─── In-memory account picker session store (10 min TTL) ─────────────────────
type PendingPickerSession = {
  expires: number;
  platform: string;
  clientId: string;
  groupId: string;
  pages: Array<{
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    igAccountId?: string | null;
    igUsername?: string | null;
    followers?: number | null;
    avatarUrl?: string | null;
  }>;
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
    } else if (platform === 'tiktok') {
      authUrl = tiktok.getTikTokAuthorizationUrl(clientId, groupId);
    } else if (platform === 'linkedin') {
      authUrl = linkedin.getLinkedInAuthorizationUrl(clientId, groupId);
    } else if (platform === 'youtube') {
      authUrl = youtube.getYouTubeAuthorizationUrl(clientId, groupId);
    } else if (platform === 'x') {
      const codeVerifier = randomBytes(32).toString('hex');
      res.cookie('x_code_verifier', codeVerifier, { maxAge: 10 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      authUrl = x.getXAuthorizationUrl(clientId, groupId, codeVerifier);
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
    const { code, state } = req.query as { code: string; state: string };
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
        await saveMetaAccount(platform, clientId, groupId, page);
        res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?connected=true`);
        return;
      }

      // Multiple pages → store in picker session
      const sessionId = randomBytes(16).toString('hex');
      pendingOAuthStore.set(sessionId, {
        expires: Date.now() + 10 * 60 * 1000,
        platform,
        clientId,
        groupId,
        pages: relevantPages as any,
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
      tokenData = { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in, userId: d.open_id, username: d.username };
    } else if (platform === 'linkedin') {
      const d = await linkedin.exchangeLinkedInCodeForToken(code);
      tokenData = { accessToken: d.access_token, refreshToken: null, expiresIn: d.expires_in, userId: d.urn, username: d.name };
    } else if (platform === 'youtube') {
      const d = await youtube.exchangeYouTubeCodeForToken(code);
      tokenData = { accessToken: d.access_token, refreshToken: d.refresh_token, expiresIn: d.expires_in, userId: d.channelId, username: d.name };
    } else if (platform === 'x') {
      const codeVerifier = req.cookies.x_code_verifier || '';
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?error=${encodeURIComponent(err.message)}`);
  }
});

// ─── Helper: save a Meta account ─────────────────────────────────────────────
async function saveMetaAccount(platform: string, clientId: string, groupId: string, page: any) {
  let acc;
  if (platform === 'facebook') {
    acc = await prisma.socialAccount.upsert({
      where: { clientId_platform_platformUserId: { clientId, platform: 'facebook', platformUserId: page.pageId } },
      create: {
        clientId, platform: 'facebook', platformUserId: page.pageId,
        platformUsername: page.pageName, displayName: page.pageName, pageId: page.pageId,
        avatarUrl: page.pageAvatarUrl || null,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        groupName: groupId, groupColor: 'blue',
      },
      update: {
        platformUsername: page.pageName, displayName: page.pageName,
        avatarUrl: page.pageAvatarUrl || undefined,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
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
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        groupName: groupId, groupColor: 'purple',
      },
      update: {
        platformUsername: page.igUsername || page.pageName, displayName: page.igUsername || page.pageName,
        avatarUrl: page.igAvatarUrl || undefined,
        accessTokenEnc: encryptToken(page.pageAccessToken),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
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
}

// ─── 3. Get pending picker session ───────────────────────────────────────────
router.get('/oauth/pending/:sessionId', authenticate, async (req, res) => {
  const session = pendingOAuthStore.get(req.params.sessionId as string);
  if (!session || session.expires < Date.now()) {
    res.status(410).json({ error: 'Session expired or not found. Please start the connection again.' });
    return;
  }

  // Return sanitized account list (no tokens)
  // FIX: previously read p.followers / p.avatarUrl, which never existed on the
  // page objects returned by getPagesWithInstagram — every account here showed
  // 0 followers and no photo. Now reads the correct real fields per platform.
  const accounts = session.pages.map((p: any) => ({
    id: session.platform === 'facebook' ? p.pageId : (p.igAccountId || p.pageId),
    name: session.platform === 'facebook' ? p.pageName : (p.igUsername || p.pageName),
    username: p.igUsername || null,
    avatarUrl: session.platform === 'facebook' ? (p.pageAvatarUrl || null) : (p.igAvatarUrl || p.pageAvatarUrl || null),
    followers: session.platform === 'facebook' ? (p.pageFollowers || 0) : (p.igFollowers ?? p.pageFollowers ?? 0),
    platform: session.platform,
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
    const { sessionId, selectedIds } = req.body as { sessionId: string; selectedIds: string[] };

    if (!sessionId || !selectedIds?.length) {
      res.status(400).json({ error: 'Missing sessionId or selectedIds' });
      return;
    }

    const session = pendingOAuthStore.get(sessionId);
    if (!session || session.expires < Date.now()) {
      res.status(410).json({ error: 'Session expired. Please reconnect.' });
      return;
    }

    const { platform, clientId, groupId } = session;

    // Filter to user-selected pages only
    const toSave = session.pages.filter((p: any) => {
      const id = platform === 'facebook' ? p.pageId : (p.igAccountId || p.pageId);
      return selectedIds.includes(id);
    });

    let savedCount = 0;
    for (const page of toSave) {
      await saveMetaAccount(platform, clientId, groupId, page);
      savedCount++;
    }

    pendingOAuthStore.delete(sessionId);
    res.json({ success: true, savedCount });
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
    const [clients, allAccounts, latestSyncs, lastPublishes] = await Promise.all([
      prisma.client.findMany({ select: { id: true, name: true, company: true } }),
      prisma.socialAccount.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.accountInsightDaily.groupBy({
        by: ['socialAccountId'],
        _max: { date: true },
      }),
      prisma.socialPost.findMany({
        where: { status: 'PUBLISHED', publishedAt: { not: null } },
        select: { clientId: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 1000,
      }),
    ]);

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
      let healthStatus: 'healthy' | 'warning' | 'critical' | 'empty' = 'empty';
      if (accounts.length > 0) {
        const hasDisconnected = accounts.some(a => a.healthStatus !== 'healthy');
        const hasExpiringSoon = accounts.some(a => a.tokenExpiresAt && (new Date(a.tokenExpiresAt).getTime() - now.getTime()) < WEEK_MS);
        const hasSyncGap = !lastSync || (now.getTime() - new Date(lastSync).getTime()) > DAY_MS;

        if (hasDisconnected) {
          healthStatus = 'critical';
        } else if (hasExpiringSoon || hasSyncGap) {
          healthStatus = 'warning';
        } else {
          healthStatus = 'healthy';
        }
      }

      const totalFollowers = accounts.reduce((s, _a) => s, 0); // will be filled from insights if needed

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

// ─── 7. Virtual activity feed for an account ──────────────────────────────────
router.get('/accounts/:accountId/activity', authenticate, async (req, res, next) => {
  try {
    const accountId = req.params.accountId as string;

    const [account, posts, insights] = await Promise.all([
      prisma.socialAccount.findUnique({ where: { id: accountId } }),
      prisma.socialPost.findMany({
        where: {
          destinations: { some: { platform: { not: '' } } },
          clientId: undefined as any, // will filter below
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

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // Filter posts to this client + platform
    const accountPosts = posts.filter(p =>
      p.clientId === account.clientId &&
      p.destinations.some((d: any) => d.platform.toLowerCase() === account.platform.toLowerCase())
    );

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
router.delete('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.socialAccount.delete({ where: { id: req.params.id as string } });
    res.json({ success: true, message: 'Account successfully disconnected' });
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
