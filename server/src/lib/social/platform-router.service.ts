import { SocialAccount, SocialPost } from '@prisma/client';
import { decryptToken } from './token-crypto.service.js';
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

export async function publishPostToPlatform(post: SocialPost, account: SocialAccount): Promise<string> {
  const platform = account.platform.toLowerCase();
  
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

    case 'tiktok':
      if (mediaUrls.length === 0) {
        throw new Error('TikTok requires at least one media URL to publish');
      }
      return await tiktok.publishToTikTok({
        accessToken,
        mediaUrls,
        mediaType,
        caption,
      });

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
      return await youtube.publishToYouTube({
        accessToken,
        videoUrl: mediaUrls[0],
        caption,
        privacy,
      });
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
    case 'instagram':
    case 'threads': {
      // Meta Graph tokens last 60 days, refresh by swapping user token again.
      // getMetaLongLivedToken returns a plaintext token from Meta's API — it must be
      // ENCRYPTED before storage, not decrypted (that was the bug: decryptToken() on
      // a plaintext string threw "Invalid stored encrypted token format" every time,
      // silently failing every Facebook/Instagram/Threads token refresh).
      const longToken = await meta.getMetaLongLivedToken(decryptedRefreshToken);
      const { encryptToken } = await import('./token-crypto.service.js');
      return {
        accessTokenEnc: encryptToken(longToken),
        refreshTokenEnc: account.refreshTokenEnc,
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

export async function fetchPlatformInsights(account: SocialAccount): Promise<{ followers: number; reach: number | null; impressions: number | null; profileVisits: number | null }> {
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
    default:
      return { followers: 0, reach: 0, impressions: 0, profileVisits: 0 };
  }
}
