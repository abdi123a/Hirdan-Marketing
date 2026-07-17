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

// 1. Connect route — redirects to platform OAuth page
router.get('/oauth/connect', authenticate, async (req, res, next) => {
  try {
    const { platform, clientId, groupId } = req.query as { platform: string; clientId: string; groupId: string };
    
    if (!platform || !clientId || !groupId) {
      res.status(400).json({ error: 'Missing platform, clientId, or groupId' });
      return;
    }

    const settings = await prisma.agencySettings.findFirst();
    
    // Check if platform is enabled in Settings
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
      // X requires PKCE. Generate a random code verifier
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

// 2. Unified OAuth callback
router.get('/oauth/callback/:platform', async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query as { code: string; state: string };

    if (!code || !state) {
      throw new Error('Callback missing code or state parameters');
    }

    // Verify OAuth signed state (CSRF Protection)
    const verified = verifyOAuthState(state);
    if (verified.platform !== platform) {
      throw new Error('OAuth state platform mismatch');
    }

    const { clientId, groupId } = verified;
    let tokenData: any = {};

    if (platform === 'facebook' || platform === 'instagram') {
      const userToken = await meta.exchangeMetaCodeForToken(platform as any, code);
      const longLivedUserToken = await meta.getMetaLongLivedToken(userToken);
      const pages = await meta.getPagesWithInstagram(longLivedUserToken);

      for (const page of pages) {
        if (platform === 'facebook') {
          await prisma.socialAccount.upsert({
            where: {
              clientId_platform_platformUserId: {
                clientId: clientId as string,
                platform: 'facebook',
                platformUserId: page.pageId,
              },
            },
            create: {
              clientId: clientId as string,
              platform: 'facebook',
              platformUserId: page.pageId,
              platformUsername: page.pageName,
              displayName: page.pageName,
              pageId: page.pageId,
              accessTokenEnc: encryptToken(page.pageAccessToken),
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // ~60 days
              groupName: groupId,
              groupColor: 'blue',
            },
            update: {
              platformUsername: page.pageName,
              displayName: page.pageName,
              accessTokenEnc: encryptToken(page.pageAccessToken),
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            },
          });
        } else if (platform === 'instagram' && page.igAccountId) {
          await prisma.socialAccount.upsert({
            where: {
              clientId_platform_platformUserId: {
                clientId: clientId as string,
                platform: 'instagram',
                platformUserId: page.igAccountId,
              },
            },
            create: {
              clientId: clientId as string,
              platform: 'instagram',
              platformUserId: page.igAccountId,
              platformUsername: page.igUsername || page.pageName,
              displayName: page.igUsername || page.pageName,
              pageId: page.pageId,
              igAccountId: page.igAccountId,
              accessTokenEnc: encryptToken(page.pageAccessToken),
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
              groupName: groupId,
              groupColor: 'purple',
            },
            update: {
              platformUsername: page.igUsername || page.pageName,
              displayName: page.igUsername || page.pageName,
              accessTokenEnc: encryptToken(page.pageAccessToken),
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }
    } else {
      if (platform === 'threads') {
        const token = await meta.exchangeMetaCodeForToken('threads', code);
        tokenData = {
          accessToken: token,
          refreshToken: null,
          expiresIn: 3600 * 24, // ~24h
          userId: 'threads_user',
          username: 'Threads User',
        };
      } else if (platform === 'tiktok') {
        const resData = await tiktok.exchangeTikTokCodeForToken(code);
        tokenData = {
          accessToken: resData.access_token,
          refreshToken: resData.refresh_token,
          expiresIn: resData.expires_in,
          userId: resData.open_id,
          username: resData.username,
        };
      } else if (platform === 'linkedin') {
        const resData = await linkedin.exchangeLinkedInCodeForToken(code);
        tokenData = {
          accessToken: resData.access_token,
          refreshToken: null,
          expiresIn: resData.expires_in,
          userId: resData.urn,
          username: resData.name,
        };
      } else if (platform === 'youtube') {
        const resData = await youtube.exchangeYouTubeCodeForToken(code);
        tokenData = {
          accessToken: resData.access_token,
          refreshToken: resData.refresh_token,
          expiresIn: resData.expires_in,
          userId: resData.channelId,
          username: resData.name,
        };
      } else if (platform === 'x') {
        const codeVerifier = req.cookies.x_code_verifier || '';
        const resData = await x.exchangeXCodeForToken(code, codeVerifier);
        tokenData = {
          accessToken: resData.access_token,
          refreshToken: resData.refresh_token,
          expiresIn: resData.expires_in,
          userId: resData.platformUserId,
          username: resData.username,
        };
      } else if (platform === 'pinterest') {
        const resData = await pinterest.exchangePinterestCodeForToken(code);
        tokenData = {
          accessToken: resData.access_token,
          refreshToken: resData.refresh_token,
          expiresIn: resData.expires_in,
          userId: resData.username,
          username: resData.username,
        };
      }

      await prisma.socialAccount.upsert({
        where: {
          clientId_platform_platformUserId: {
            clientId: clientId as string,
            platform,
            platformUserId: tokenData.userId as string,
          },
        },
        create: {
          clientId: clientId as string,
          platform,
          platformUserId: tokenData.userId as string,
          platformUsername: tokenData.username as string,
          displayName: tokenData.username as string,
          accessTokenEnc: encryptToken(tokenData.accessToken as string),
          refreshTokenEnc: tokenData.refreshToken ? encryptToken(tokenData.refreshToken as string) : null,
          tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + (tokenData.expiresIn as number) * 1000) : null,
          groupName: groupId,
        },
        update: {
          platformUsername: tokenData.username as string,
          displayName: tokenData.username as string,
          accessTokenEnc: encryptToken(tokenData.accessToken as string),
          refreshTokenEnc: tokenData.refreshToken ? encryptToken(tokenData.refreshToken as string) : null,
          tokenExpiresAt: tokenData.expiresIn ? new Date(Date.now() + (tokenData.expiresIn as number) * 1000) : null,
        },
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?connected=true`);
    return;
  } catch (err: any) {
    console.error('OAuth Callback Error:', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl.replace(/\/$/, '')}/dashboard/social-media/accounts?error=${encodeURIComponent(err.message)}`);
    return;
  }
});

// 3. List connected social accounts
router.get('/accounts', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [accounts, total] = await Promise.all([
      prisma.socialAccount.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true, company: true } } },
      }),
      prisma.socialAccount.count(),
    ]);

    res.json({ accounts, total, page, limit });
    return;
  } catch (err) {
    next(err);
    return;
  }
});

// 4. Accounts by client ID
router.get('/accounts/by-client/:clientId', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const accounts = await prisma.socialAccount.findMany({
      where: { clientId: clientId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json(accounts);
    return;
  } catch (err) {
    next(err);
    return;
  }
});

// 5. Update social account
router.put('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupName, groupColor, isActive } = req.body;

    const account = await prisma.socialAccount.update({
      where: { id: id as string },
      data: {
        groupName,
        groupColor,
        isActive,
      },
    });

    res.json(account);
    return;
  } catch (err) {
    next(err);
    return;
  }
});

// 6. Disconnect/Delete social account
router.delete('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.socialAccount.delete({
      where: { id: id as string },
    });
    res.json({ success: true, message: 'Account successfully disconnected' });
    return;
  } catch (err) {
    next(err);
    return;
  }
});

// 7. Distinct group names
router.get('/accounts/groups', authenticate, async (req, res, next) => {
  try {
    const groups = await prisma.socialAccount.findMany({
      select: { groupName: true, groupColor: true },
      distinct: ['groupName'],
      where: { groupName: { not: null } },
    });
    res.json(groups);
    return;
  } catch (err) {
    next(err);
    return;
  }
});

// 8. Platform config status (check if env keys are present)
router.get('/platform-status', authenticate, async (req, res, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();
    
    res.json({
      facebook: { configured: !!process.env.META_APP_ID, enabled: settings?.metaEnabled || false },
      instagram: { configured: !!process.env.META_APP_ID, enabled: settings?.metaEnabled || false },
      threads: { configured: !!process.env.META_APP_ID, enabled: settings?.metaEnabled || false },
      tiktok: { configured: !!process.env.TIKTOK_CLIENT_KEY, enabled: settings?.tiktokEnabled || false },
      linkedin: { configured: !!process.env.LINKEDIN_CLIENT_ID, enabled: settings?.linkedinEnabled || false },
      youtube: { configured: !!process.env.GOOGLE_CLIENT_ID, enabled: settings?.googleEnabled || false },
      x: { configured: !!process.env.X_CLIENT_ID, enabled: settings?.xEnabled || false },
      pinterest: { configured: !!process.env.PINTEREST_APP_ID, enabled: settings?.pinterestEnabled || false },
    });
    return;
  } catch (err) {
    next(err);
    return;
  }
});

export default router;
