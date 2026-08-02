import { SocialAccount, SocialPost } from '@prisma/client';
import { decryptToken } from './token-crypto.service.js';
import { extractSocialApiError, isAuthError } from './safe-error.js';
import * as meta from './meta.service.js';
import * as tiktok from './tiktok.service.js';
import * as linkedin from './linkedin.service.js';
import * as youtube from './youtube.service.js';
import * as x from './x.service.js';
import * as pinterest from './pinterest.service.js';

export const PLATFORM_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  threads: 500,
  tiktok: 2200,
  linkedin: 3000,
  youtube: 5000,
  x: 280,
  pinterest: 500,
};

export function validateCaption(platform: string, caption: string): void {
  const limit = PLATFORM_LIMITS[platform.toLowerCase()];
  if (limit !== undefined && caption.length > limit) {
    throw new Error(`Caption exceeds ${platform} limit of ${limit} characters (got ${caption.length})`);
  }
}

async function persistRefreshedToken(
  account: SocialAccount,
  refreshed: { accessTokenEnc: string; refreshTokenEnc: string | null; tokenExpiresAt: Date | null },
): Promise<SocialAccount> {
  const { prisma } = await import('../prisma.js');
  return prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: refreshed.accessTokenEnc,
      refreshTokenEnc: refreshed.refreshTokenEnc,
      tokenExpiresAt: refreshed.tokenExpiresAt,
      healthStatus: 'healthy',
      healthMessage: null,
    },
  });
}

async function markAccountAuthFailure(account: SocialAccount, message: string): Promise<void> {
  try {
    const { prisma } = await import('../prisma.js');
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        healthStatus: 'expired',
        healthMessage: message.slice(0, 500),
      },
    });
  } catch {
    // non-fatal
  }
}

/** Refresh when expired / near expiry, or when force=true (e.g. after a 401). */
export async function ensureFreshAccessToken(account: SocialAccount, force = false): Promise<SocialAccount> {
  if (!account.refreshTokenEnc) return account;

  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : null;
  // YouTube access tokens last ~1h — refresh a bit earlier than Meta's 60-day tokens.
  const skewMs = account.platform.toLowerCase() === 'youtube' ? 15 * 60 * 1000 : 5 * 60 * 1000;
  const needsRefresh =
    force ||
    expiresAt === null || // unknown expiry — refresh before calling APIs
    expiresAt < Date.now() + skewMs;
  if (!needsRefresh) return account;

  try {
    const refreshed = await refreshAccountToken(account);
    return await persistRefreshedToken(account, refreshed);
  } catch (err: unknown) {
    console.warn(
      `[token] Refresh failed for ${account.platform} ${account.id}:`,
      extractSocialApiError(err),
    );
    // Keep returning the account so callers can still try / surface a clear error,
    // but mark expired when the stored access token is already past expiry.
    if (expiresAt !== null && expiresAt < Date.now()) {
      await markAccountAuthFailure(
        account,
        `Token refresh failed — reconnect this ${account.platform} account. (${extractSocialApiError(err)})`,
      );
    }
    return account;
  }
}

export async function publishPostToPlatform(post: SocialPost, account: SocialAccount): Promise<string> {
  const platform = account.platform.toLowerCase();
  account = await ensureFreshAccessToken(account);
  
  // Resolve per-platform caption override if present
  let caption = post.caption;
  if (post.platformContent && typeof post.platformContent === 'object') {
    const overrides = post.platformContent as Record<string, any>;
    if (overrides[platform]) {
      if (typeof overrides[platform] === 'string') {
        caption = overrides[platform];
      } else if (overrides[platform] && typeof overrides[platform] === 'object' && typeof overrides[platform].caption === 'string') {
        caption = overrides[platform].caption;
      }
    }
  }

  // Enforce caption character limit
  validateCaption(platform, caption);

  // Decrypt access token
  const accessToken = decryptToken(account.accessTokenEnc);

  // Decode media URLs
  let mediaUrls: string[] = [];
  if (post.mediaUrls) {
    if (Array.isArray(post.mediaUrls)) {
      mediaUrls = post.mediaUrls as string[];
    } else if (typeof post.mediaUrls === 'string') {
      try {
        mediaUrls = JSON.parse(post.mediaUrls);
      } catch {
        mediaUrls = [post.mediaUrls];
      }
    }
  }

  const mediaType = post.mediaType || 'image';

  switch (platform) {
    case 'facebook': {
      if (!account.pageId) {
        throw new Error('Facebook account does not have a linked page ID');
      }
      const fbContent = (post.platformContent as any)?.facebook || {};
      const fbType: string = fbContent.type || 'post';
      console.log('[DEBUG] Facebook postType:', fbType, 'mediaType:', mediaType);
      return await meta.publishToFacebookPage({
        pageId: account.pageId,
        pageAccessToken: accessToken,
        caption,
        mediaUrls,
        mediaType,
        postType: fbType as 'post' | 'reel' | 'story',
      });
    }

    case 'instagram': {
      if (!account.igAccountId) {
        throw new Error('Instagram account does not have a linked Business ID');
      }
      const igContent = (post.platformContent as any)?.instagram || {};
      const igType: string = igContent.type || 'post';
      return await meta.publishToInstagram({
        igAccountId: account.igAccountId,
        pageAccessToken: accessToken,
        caption,
        mediaUrls,
        mediaType,
        postType: igType as 'post' | 'reel' | 'story',
      });
    }

    case 'threads':
      if (!account.pageId) {
        throw new Error('Threads account does not have a linked user ID');
      }
      return await meta.publishToThreads({
        userId: account.pageId,
        token: accessToken,
        caption,
        mediaUrl: mediaUrls[0],
        mediaType,
      });

    case 'tiktok': {
      if (mediaUrls.length === 0) {
        throw new Error('TikTok requires at least one media URL to publish');
      }
      const tiktokContent = (post.platformContent as any)?.tiktok || {};
      return await tiktok.publishToTikTok({
        accessToken,
        mediaUrls,
        mediaType,
        caption,
        postMode: tiktokContent.postMode || 'direct',
      });
    }

    case 'linkedin':
      // ✅ Pass mediaType to support video & multi-image
      return await linkedin.publishToLinkedIn({
        accessToken,
        authorUrn: account.platformUserId,
        caption,
        mediaUrls,
        mediaType,
      });

    case 'youtube': {
      if (mediaUrls.length === 0) {
        throw new Error('YouTube requires a video URL to upload');
      }
      // ✅ Retrieve dynamic privacy from the post's platformContent
      const youtubeContent = (post.platformContent as any)?.youtube || {};
      const privacy = youtubeContent.privacy || 'public';
      try {
        return await youtube.publishToYouTube({
          accessToken,
          videoUrl: mediaUrls[0],
          caption,
          privacy,
        });
      } catch (err: unknown) {
        // Hostinger logs: YouTube often fails with 401 even when cron "refreshed"
        // — force one refresh+retry before surfacing the error.
        if (!isAuthError(err) || !account.refreshTokenEnc) {
          if (isAuthError(err)) {
            await markAccountAuthFailure(
              account,
              'YouTube authentication failed — reconnect this account.',
            );
          }
          throw err;
        }
        const refreshedAccount = await ensureFreshAccessToken(account, true);
        const freshToken = decryptToken(refreshedAccount.accessTokenEnc);
        try {
          return await youtube.publishToYouTube({
            accessToken: freshToken,
            videoUrl: mediaUrls[0],
            caption,
            privacy,
          });
        } catch (retryErr: unknown) {
          if (isAuthError(retryErr)) {
            await markAccountAuthFailure(
              refreshedAccount,
              'YouTube authentication failed — reconnect this account.',
            );
          }
          throw retryErr;
        }
      }
    }

    case 'x':
      // ✅ Pass mediaType to support native image/video attachments
      return await x.publishToX({
        accessToken,
        caption,
        mediaUrls,
        mediaType,
      });

    case 'pinterest':
      // ✅ Pass mediaType to support video pins
      return await pinterest.publishToPinterest({
        accessToken,
        caption,
        mediaUrls,
        mediaType,
      });

    default:
      throw new Error(`Unsupported platform: ${account.platform}`);
  }
}

export async function refreshAccountToken(account: SocialAccount): Promise<{ accessTokenEnc: string; refreshTokenEnc: string | null; tokenExpiresAt: Date | null }> {
  const platform = account.platform.toLowerCase();
  
  if (!account.refreshTokenEnc) {
    throw new Error(`No refresh token available for ${account.platform} account`);
  }
  
  const decryptedRefreshToken = decryptToken(account.refreshTokenEnc);
  let access_token = '';
  let refresh_token: string | null = null;
  let expires_in = 0;

  switch (platform) {
    case 'facebook':
    case 'instagram': {
      // refreshTokenEnc holds the long-lived USER token. Exchange it, then re-fetch
      // the page access token for this account (page tokens themselves aren't refreshable).
      const longToken = await meta.getMetaLongLivedToken(decryptedRefreshToken);
      const pages = await meta.getPagesWithInstagram(longToken);
      const page = pages.find((p) =>
        platform === 'facebook'
          ? p.pageId === account.pageId || p.pageId === account.platformUserId
          : p.igAccountId === account.igAccountId || p.igAccountId === account.platformUserId,
      );
      if (!page?.pageAccessToken) {
        const available = pages
          .map((p) => p.pageName || p.igUsername || p.pageId)
          .filter(Boolean)
          .slice(0, 8)
          .join(', ');
        throw new Error(
          `This Facebook login no longer has access to “${account.displayName}”. ` +
            `Reconnect ${account.platform} and select that Page/IG account in the Facebook dialog` +
            (available ? ` (currently available: ${available})` : '') +
            '.',
        );
      }
      const { encryptToken } = await import('./token-crypto.service.js');
      return {
        accessTokenEnc: encryptToken(page.pageAccessToken),
        refreshTokenEnc: encryptToken(longToken),
        tokenExpiresAt: new Date(Date.now() + 5184000 * 1000),
      };
    }

    case 'threads': {
      // Threads uses the user token directly (stored as access token).
      const longToken = await meta.getMetaLongLivedToken(decryptedRefreshToken);
      const { encryptToken } = await import('./token-crypto.service.js');
      return {
        accessTokenEnc: encryptToken(longToken),
        refreshTokenEnc: encryptToken(longToken),
        tokenExpiresAt: new Date(Date.now() + 5184000 * 1000),
      };
    }

    case 'tiktok':
      const tkRes = await tiktok.refreshTikTokToken(decryptedRefreshToken);
      access_token = tkRes.access_token;
      refresh_token = tkRes.refresh_token;
      expires_in = tkRes.expires_in;
      break;

    case 'linkedin':
      // LinkedIn tokens are long-lived and refreshed via standard client credentials exchange
      throw new Error('LinkedIn token refresh must be triggered via re-authentication');

    case 'youtube':
      const ytRes = await youtube.refreshYouTubeToken(decryptedRefreshToken);
      access_token = ytRes.access_token;
      expires_in = ytRes.expires_in;
      break;

    case 'x':
      const xRes = await x.refreshXToken(decryptedRefreshToken);
      access_token = xRes.access_token;
      refresh_token = xRes.refresh_token; // X uses rotating refresh tokens
      expires_in = xRes.expires_in;
      break;

    case 'pinterest':
      const pinRes = await pinterest.refreshPinterestToken(decryptedRefreshToken);
      access_token = pinRes.access_token;
      refresh_token = pinRes.refresh_token;
      expires_in = pinRes.expires_in;
      break;

    default:
      throw new Error(`Refresh token not supported for platform: ${account.platform}`);
  }

  // Encrypt tokens
  const { encryptToken } = await import('./token-crypto.service.js');
  return {
    accessTokenEnc: encryptToken(access_token),
    refreshTokenEnc: refresh_token ? encryptToken(refresh_token) : account.refreshTokenEnc,
    tokenExpiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
  };
}

async function fetchInsightsOnce(
  account: SocialAccount,
): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  const platform = account.platform.toLowerCase();
  const accessToken = decryptToken(account.accessTokenEnc);

  switch (platform) {
    case 'facebook':
      return await meta.getMetaInsights(account.platformUserId, accessToken, 'facebook');
    case 'instagram':
      if (!account.igAccountId) throw new Error('No Instagram Business ID linked');
      return await meta.getMetaInsights(account.igAccountId, accessToken, 'instagram');
    case 'tiktok':
      return await tiktok.getTikTokInsights(accessToken);
    case 'linkedin':
      return await linkedin.getLinkedInInsights(accessToken);
    case 'youtube':
      return await youtube.getYouTubeInsights(accessToken);
    case 'x':
      return await x.getXInsights(accessToken);
    case 'pinterest':
      return await pinterest.getPinterestInsights(accessToken);
    case 'threads': {
      const profile = await meta.getThreadsProfile(accessToken);
      return { followers: profile.followers, reach: null, impressions: null, profileVisits: null };
    }
    default:
      return { followers: 0, reach: null, impressions: null, profileVisits: null };
  }
}

export async function fetchPlatformInsights(account: SocialAccount): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
  // Meta PAGE tokens are often marked invalid by Graph even while our stored
  // expiry is still in the future (FLB reconnect / permission churn). Always
  // re-mint the page token from the USER refresh token before insights.
  // YouTube access tokens die in ~1h — refresh-near-expiry covers that.
  const platform = account.platform.toLowerCase();
  const forceMetaPageRefresh =
    (platform === 'facebook' || platform === 'instagram') && !!account.refreshTokenEnc;

  let fresh = await ensureFreshAccessToken(account, forceMetaPageRefresh);
  try {
    const metrics = await fetchInsightsOnce(fresh);
    // Successful sync clears a stale Issue badge from a previous failed run.
    if (fresh.healthStatus !== 'healthy') {
      const { prisma } = await import('../prisma.js');
      await prisma.socialAccount.update({
        where: { id: fresh.id },
        data: { healthStatus: 'healthy', healthMessage: null },
      });
    }
    return metrics;
  } catch (err: unknown) {
    if (!isAuthError(err) || !fresh.refreshTokenEnc) throw err;
    fresh = await ensureFreshAccessToken(fresh, true);
    try {
      const metrics = await fetchInsightsOnce(fresh);
      const { prisma } = await import('../prisma.js');
      await prisma.socialAccount.update({
        where: { id: fresh.id },
        data: { healthStatus: 'healthy', healthMessage: null },
      });
      return metrics;
    } catch (retryErr: unknown) {
      if (isAuthError(retryErr)) {
        await markAccountAuthFailure(
          fresh,
          `${fresh.platform} authentication failed — reconnect this account. (${extractSocialApiError(retryErr)})`,
        );
      }
      throw retryErr;
    }
  }
}
