// ─────────────────────────────────────────────────────────────────────────────
// Public post URLs — the pure half.
//
// Everything here is string-in/string-out with no database, HTTP or filesystem
// access, so it can be unit-tested directly and imported from anywhere without
// dragging in Prisma, axios or the XLSX parser. The I/O half (API lookups,
// persistence, the retry sweep) lives in permalink.service.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal account shape the resolvers need — avoids demanding a full row. */
export interface PermalinkAccountCtx {
  platform: string;
  platformUsername?: string | null;
  pageId?: string | null;
  accessTokenEnc?: string | null;
}

/**
 * TikTok post id from a link.
 *
 * Studio exports carry more than the canonical /@user/video/<id> form: photo
 * (slideshow) posts use /photo/<id>, older share links use /v/<id>.html, and some
 * sheets hold the bare id with no URL around it. Short links (vt./vm.tiktok.com)
 * don't contain the id at all and still return null — callers must treat that as
 * "unknown id", never as "not a real post".
 */
export function videoIdFromLink(link: unknown): string | null {
  if (!link) return null;
  const s = String(link).trim();
  const m = s.match(/\/(?:video|photo|v)\/(\d+)/);
  if (m) return m[1];
  // A cell holding just the id. Length-guarded so stray numbers ("2024") don't
  // get mistaken for a snowflake id.
  return /^\d{15,25}$/.test(s) ? s : null;
}

/** A TikTok publish_id (e.g. "v_pub_url~v2...") is not a video id. */
export function isTikTokPublishId(id: string): boolean {
  return /^v_(pub|inbox)_/i.test(id) || id.includes('~');
}

function cleanHandle(username?: string | null): string | null {
  if (!username) return null;
  const h = String(username).trim().replace(/^@/, '');
  return h || null;
}

/**
 * Build the public URL from an id we already have, without any network call.
 * Returns null when this platform's public URL cannot be derived from the id
 * alone — the caller should then try resolvePermalinkViaApi().
 */
export function derivePermalink(
  platform: string,
  platformPostId: string | null | undefined,
  ctx: Pick<PermalinkAccountCtx, 'platformUsername' | 'pageId'> = {},
): string | null {
  if (!platformPostId) return null;
  const id = String(platformPostId).trim();
  if (!id) return null;

  const handle = cleanHandle(ctx.platformUsername);

  switch (platform.toLowerCase()) {
    case 'youtube':
      // Upload returns the video id verbatim.
      return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

    case 'x':
    case 'twitter':
      // Tweet URLs need the author handle; without it there's no valid path.
      return handle ? `https://x.com/${handle}/status/${encodeURIComponent(id)}` : null;

    case 'linkedin':
      // publishToLinkedIn returns a share/ugcPost URN.
      return id.startsWith('urn:li:')
        ? `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}/`
        : null;

    case 'pinterest':
      return `https://www.pinterest.com/pin/${encodeURIComponent(id)}/`;

    case 'facebook': {
      // Graph returns "{pageId}_{postId}" for feed posts. Video uploads via
      // /{page}/videos return a bare video id — /videos/ is the reliable path.
      const [left, right] = id.split('_');
      if (left && right) return `https://www.facebook.com/${left}/posts/${right}`;
      if (ctx.pageId) {
        return `https://www.facebook.com/${ctx.pageId}/videos/${id}`;
      }
      return `https://www.facebook.com/watch/?v=${encodeURIComponent(id)}`;
    }

    case 'tiktok':
      // Only derivable once we hold the numeric video id, not the publish_id.
      if (isTikTokPublishId(id) || !/^\d+$/.test(id)) return null;
      return handle ? `https://www.tiktok.com/@${handle}/video/${id}` : null;

    // Instagram/Threads media ids don't appear in public URLs (those use an
    // opaque shortcode), so they always need the API.
    default:
      return null;
  }
}

/**
 * The TikTok video id for a destination, from whichever field carries it.
 *
 * This is the join key between a post we published (social_post_destinations)
 * and the same video as it appears in a TikTok Studio export (imported_posts),
 * so the two can be shown as one item instead of counted twice.
 */
export function tiktokVideoIdOf(dest: {
  platform?: string | null;
  platformPostId?: string | null;
  platformPostUrl?: string | null;
}): string | null {
  if ((dest.platform || '').toLowerCase() !== 'tiktok') return null;
  const fromUrl = videoIdFromLink(dest.platformPostUrl);
  if (fromUrl) return fromUrl;
  const id = dest.platformPostId;
  if (id && /^\d+$/.test(String(id).trim())) return String(id).trim();
  return null;
}
