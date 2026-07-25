// ─────────────────────────────────────────────────────────────────────────────
// Public permalinks for published content — the I/O half.
//
// Every published destination should end up with a `platformPostUrl` — the real
// public URL of the post — so the dashboard can offer a "View on <platform>"
// button, and so TikTok posts we published can be matched back to the rows in a
// TikTok Studio export (which carry the video link, not our ids).
//
// Two ways to get there:
//
//   1. derivePermalink() — pure string construction, in ./permalink.ts. Works
//      for platforms whose publish call already returns the id that appears in
//      the public URL (YouTube, X, LinkedIn, Pinterest, Facebook).
//
//   2. resolvePermalinkViaApi() — one API call. Needed for platforms where the
//      publish response id is NOT the public id: Instagram/Threads (media id →
//      `permalink` field) and TikTok (publish_id → video id, and only once the
//      upload finishes processing).
//
// resolvePermalink() tries (1) first and falls back to (2), so most posts cost
// zero extra API calls. TikTok is the one that genuinely needs a retry later —
// the video is still processing at publish time — which is what
// resolvePendingPermalinks() handles on the scheduler tick.
// ─────────────────────────────────────────────────────────────────────────────

import type { SocialAccount } from '@prisma/client';
import { prisma } from '../prisma.js';
import { decryptToken } from './token-crypto.service.js';
import { getMetaPermalink } from './meta.service.js';
import { fetchTikTokPublishStatus } from './tiktok.service.js';
import { derivePermalink, type PermalinkAccountCtx } from './permalink.js';

// Re-exported so callers have one import site for permalink concerns.
export {
  derivePermalink,
  tiktokVideoIdOf,
  videoIdFromLink,
  isTikTokPublishId,
  type PermalinkAccountCtx,
} from './permalink.js';

function cleanHandle(username?: string | null): string | null {
  if (!username) return null;
  const h = String(username).trim().replace(/^@/, '');
  return h || null;
}

/**
 * Ask the platform for the canonical URL. One HTTP call; returns null rather
 * than throwing so a failed lookup never breaks a publish.
 */
export async function resolvePermalinkViaApi(
  ctx: PermalinkAccountCtx,
  platformPostId: string | null | undefined,
): Promise<string | null> {
  if (!platformPostId || !ctx.accessTokenEnc) return null;
  const platform = ctx.platform.toLowerCase();

  let token: string;
  try {
    token = decryptToken(ctx.accessTokenEnc);
  } catch {
    return null;
  }

  try {
    if (platform === 'instagram' || platform === 'facebook' || platform === 'threads') {
      return await getMetaPermalink(platformPostId, token, platform);
    }

    if (platform === 'tiktok') {
      const status = await fetchTikTokPublishStatus(token, platformPostId);
      if (!status?.videoId) return null;
      const handle = cleanHandle(ctx.platformUsername);
      return handle
        ? `https://www.tiktok.com/@${handle}/video/${status.videoId}`
        : `https://www.tiktok.com/video/${status.videoId}`;
    }
  } catch (err: any) {
    console.warn(`[permalink] ${platform} lookup failed for ${platformPostId}: ${err?.message}`);
  }

  return null;
}

/** Stored URL → pure derivation → API lookup. First hit wins. */
export async function resolvePermalink(
  ctx: PermalinkAccountCtx,
  platformPostId: string | null | undefined,
  storedUrl?: string | null,
): Promise<string | null> {
  if (storedUrl) return storedUrl;
  const derived = derivePermalink(ctx.platform, platformPostId, ctx);
  if (derived) return derived;
  return resolvePermalinkViaApi(ctx, platformPostId);
}

/**
 * Best-effort: resolve and persist the permalink for one destination.
 * Never throws — publishing must not fail because a link lookup did.
 */
export async function captureDestinationPermalink(
  destinationId: string,
  account: SocialAccount,
  platformPostId: string | null | undefined,
): Promise<string | null> {
  try {
    const url = await resolvePermalink(account, platformPostId);
    if (!url) return null;
    await prisma.socialPostDestination.update({
      where: { id: destinationId },
      data: { platformPostUrl: url },
    });
    return url;
  } catch (err: any) {
    console.warn(`[permalink] could not store URL for destination ${destinationId}: ${err?.message}`);
    return null;
  }
}

/**
 * Sweep destinations that published but still have no public URL.
 *
 * This exists for TikTok above all: at publish time we only hold a publish_id
 * and the video is still processing, so the status endpoint has no video id yet.
 * Runs on the scheduler tick and retries within a bounded window — past that,
 * the upload either failed or the export importer will supply the link instead.
 */
export async function resolvePendingPermalinks(maxAgeDays = 7, limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000);

  const pending = await prisma.socialPostDestination.findMany({
    where: {
      status: 'PUBLISHED',
      platformPostUrl: null,
      platformPostId: { not: null },
      publishedAt: { gte: cutoff },
    },
    include: { socialAccount: true },
    take: limit,
  });

  let resolved = 0;
  for (const dest of pending) {
    const url = await captureDestinationPermalink(dest.id, dest.socialAccount, dest.platformPostId);
    if (url) resolved++;
  }

  if (resolved > 0) console.log(`[permalink] resolved ${resolved}/${pending.length} pending post URLs`);
  return resolved;
}
