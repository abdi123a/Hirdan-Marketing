import axios from 'axios';
import { prisma } from '../prisma.js';
import { decryptToken } from './token-crypto.service.js';
import { logSocialError } from './safe-error.js';

export interface VideoEnrichmentResult {
  thumbnailUrl: string | null;
  isVerified: boolean;
  verificationSource: 'api' | 'oembed' | 'failed';
  liveStats?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
}

/**
 * Enriches a TikTok video by fetching thumbnail image and verifying video existence.
 *
 * Dual Strategy:
 * 1. Option A: TikTok Official API (/v2/video/query/) if OAuth access token is available.
 * 2. Option B (Fallback): TikTok Public oEmbed API (https://www.tiktok.com/oembed) if Option A is not available or fails.
 */
export async function enrichTikTokVideo(
  videoLink: string | null,
  externalId: string,
  accessToken?: string | null
): Promise<VideoEnrichmentResult> {
  // ── Option A: TikTok Official API ──
  if (accessToken && externalId) {
    try {
      const endpoint = 'https://open.tiktokapis.com/v2/video/query/?fields=cover_image_url,animated_cover_url,id,title,like_count,comment_count,share_count,view_count';
      const { data } = await axios.post(
        endpoint,
        {
          filters: {
            video_ids: [externalId],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );

      const videoList = data?.data?.videos;
      if (Array.isArray(videoList) && videoList.length > 0) {
        const v = videoList[0];
        const coverUrl = v.cover_image_url || v.animated_cover_url || null;
        return {
          thumbnailUrl: coverUrl,
          isVerified: true,
          verificationSource: 'api',
          liveStats: {
            likes: v.like_count != null ? Number(v.like_count) : undefined,
            comments: v.comment_count != null ? Number(v.comment_count) : undefined,
            shares: v.share_count != null ? Number(v.share_count) : undefined,
            views: v.view_count != null ? Number(v.view_count) : undefined,
          },
        };
      }
    } catch (err: any) {
      // Option A failed (e.g. rate limit, scope missing, token invalid) -> Log & continue to Option B fallback
      console.warn(`TikTok Option A API query failed for video ${externalId}: ${err.message}. Falling back to Option B (oEmbed).`);
    }
  }

  // ── Option B: TikTok Public oEmbed API Fallback ──
  const targetUrl = videoLink || `https://www.tiktok.com/video/${externalId}`;
  try {
    const oembedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`;
    const { data } = await axios.get(oembedEndpoint, { timeout: 6000 });

    if (data && data.thumbnail_url) {
      return {
        thumbnailUrl: data.thumbnail_url,
        isVerified: true,
        verificationSource: 'oembed',
      };
    }
  } catch (err: any) {
    console.warn(`TikTok Option B oEmbed query failed for video ${externalId} (${targetUrl}): ${err.message}`);
  }

  // Both methods failed or video is unreachable/private/deleted
  return {
    thumbnailUrl: null,
    isVerified: false,
    verificationSource: 'failed',
  };
}

/**
 * Batch enriches imported TikTok posts for a given account.
 * Updates database records with thumbnail URLs, verification status, and timestamp.
 */
export async function enrichTikTokVideosBatch(
  accountId: string,
  postIds?: string[],
  opts: { force?: boolean } = {}
): Promise<{ enrichedCount: number; verifiedCount: number }> {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { accessTokenEnc: true, platform: true },
    });

    let accessToken: string | null = null;
    if (account?.accessTokenEnc) {
      try {
        accessToken = decryptToken(account.accessTokenEnc);
      } catch {
        accessToken = null;
      }
    }

    // Find target imported posts
    const whereCondition: any = {
      socialAccountId: accountId,
      platform: 'tiktok',
    };
    if (postIds && postIds.length > 0) {
      whereCondition.id = { in: postIds };
    } else if (!opts.force) {
      // The sweep after an import only touches rows that still need something.
      // Re-checking every video on every import means hundreds of oEmbed calls,
      // and the rate-limited tail of that comes back "failed" — flipping healthy,
      // already-verified videos to unverified. The explicit re-enrich endpoints
      // pass force when a genuine full re-check is wanted.
      whereCondition.OR = [{ thumbnailUrl: null }, { verifiedAt: null }];
    }

    const posts = await prisma.importedPost.findMany({
      where: whereCondition,
      select: { id: true, externalId: true, link: true, likes: true, comments: true, shares: true, views: true },
    });

    if (posts.length === 0) {
      return { enrichedCount: 0, verifiedCount: 0 };
    }

    let enrichedCount = 0;
    let verifiedCount = 0;
    const now = new Date();

    // Process in chunks of 5 to avoid overloading network/rate-limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      const chunk = posts.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (p) => {
          const res = await enrichTikTokVideo(p.link, p.externalId, accessToken);
          enrichedCount++;
          if (res.isVerified) verifiedCount++;

          const updateData: any = {
            isVerified: res.isVerified,
            verificationSource: res.verificationSource,
            verifiedAt: now,
          };

          // Never wipe a thumbnail we already hold. A failed lookup is usually a
          // rate limit or a network blip, not proof the cover image is gone, and
          // overwriting it with null would blank out a video that renders fine.
          if (res.thumbnailUrl) updateData.thumbnailUrl = res.thumbnailUrl;

          // If Option A provided live stats, update missing or newer stats
          if (res.liveStats) {
            if (res.liveStats.likes != null) updateData.likes = res.liveStats.likes;
            if (res.liveStats.comments != null) updateData.comments = res.liveStats.comments;
            if (res.liveStats.shares != null) updateData.shares = res.liveStats.shares;
            if (res.liveStats.views != null) updateData.views = res.liveStats.views;
          }

          await prisma.importedPost.update({
            where: { id: p.id },
            data: updateData,
          });
        })
      );
    }

    return { enrichedCount, verifiedCount };
  } catch (err: any) {
    logSocialError(`Error during TikTok video batch enrichment for account ${accountId}`, err);
    return { enrichedCount: 0, verifiedCount: 0 };
  }
}
