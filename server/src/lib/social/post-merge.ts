// ─────────────────────────────────────────────────────────────────────────────
// One list of posts, from two sources.
//
// A TikTok video can reach the dashboard twice: once as a SocialPost we
// published through the scheduler, and again as an ImportedPost row parsed out
// of a TikTok Studio export. They are the same video, so listing both showed it
// twice in "Top Performing Posts" and counted it twice in the video
// content-type bucket.
//
// unifyPosts() joins them on the TikTok video id — recovered from the
// destination's stored public URL (or its platformPostId, once resolved) — and
// emits a single row per real-world post:
//
//   • identity  (caption, thumbnail, our media) comes from the SocialPost,
//     because that's what the user recognises;
//   • metrics   come from the export, because TikTok's API gives us nothing
//     per-post — the PostInsight row for a live TikTok destination is all zeros;
//   • the link  is the real video URL either side happens to carry.
//
// Cross-posted content is handled precisely: only the merged platform's insight
// rows are dropped from the scheduled side, so a post that went to Facebook AND
// TikTok keeps its real Facebook numbers and gains the imported TikTok ones.
//
// The id heuristic only fires when the post carries a TikTok destination, which
// requires us to have published it. Content posted by hand in the TikTok app has
// no such destination, so a video cross-posted as "system → Instagram+Facebook,
// by hand → TikTok" could never be recognised as one post. For that case the
// user attaches the export row to the group themselves, and the destination
// records which imported_posts row it stands for: destination.importedPostId is
// then the join key, taking priority over the heuristic below.
// ─────────────────────────────────────────────────────────────────────────────

// Import the pure permalink helpers directly, not via permalink.service, so
// this module stays free of Prisma/axios and can be unit-tested on its own.
import { derivePermalink, tiktokVideoIdOf } from './permalink.js';

export type PostSource = 'scheduled' | 'imported' | 'both';

export interface UnifiedDestination {
  platform: string;
  status: string;
  platformPostId: string | null;
  link: string | null;
  /** Set when the user attached this platform by hand; null for real publishes. */
  importedPostId?: string | null;
}

export interface UnifiedPost {
  id: string;
  caption: string;
  mediaUrls: any;
  mediaType: string | null;
  thumbnailUrl?: string | null;
  isVerified?: boolean;
  verificationSource?: string | null;
  publishedAt: Date | null;
  destinations: UnifiedDestination[];
  /** Best public URL for this post, or null when none could be resolved. */
  link: string | null;
  source: PostSource;
  /** Retained for the existing UI flag; true whenever export data contributed. */
  imported: boolean;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  views: number;
  reach: number;
  impressions: number;
  engagement: number;
  engagementRate: number;
}

interface ImportedRow {
  id: string;
  socialAccountId: string;
  externalId: string;
  title: string | null;
  link: string | null;
  postedAt: Date | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  thumbnailUrl?: string | null;
  isVerified?: boolean;
  verificationSource?: string | null;
}

export interface AccountMeta {
  platform: string;
  platformUsername?: string | null;
  pageId?: string | null;
}

export interface UnifyResult {
  posts: UnifiedPost[];
  /** How many post groups gained numbers from an export row. */
  mergedCount: number;
  /**
   * Ids of the export rows folded into a group.
   *
   * A caller that also counts or lists `imported` rows on its own must skip
   * these, or the same video lands in the tally twice — once inside the group
   * that now speaks for it, once again on its own.
   */
  mergedImportedIds: Set<string>;
  /**
   * postId → the platforms whose numbers came from an export row.
   *
   * For those platforms the post's own PostInsight row is not the truth: it is
   * either absent (nothing of ours published there) or the zero-filled placeholder
   * TikTok's API leaves behind. Callers reading insights per platform should skip
   * the pairs named here and take the export's figures instead.
   */
  mergedPlatformsByPost: Map<string, Set<string>>;
}

export interface UnifyOptions {
  posts: any[];
  imported: ImportedRow[];
  /** 'ALL' or an uppercase platform name. */
  platformFilter: string;
  /** socialAccountId → account metadata, for deriving links and platforms. */
  accounts: Map<string, AccountMeta>;
}

const n = (v: unknown): number => Number(v) || 0;

/**
 * Engagement rate against whichever denominator we actually have.
 *
 * `reachlessViews` is the view count contributed by sources that report no reach
 * at all — every export row, since TikTok Studio exports carry views but no
 * reach. Without adding those back, a merged post divides the engagement of ALL
 * its platforms by the reach of only the platforms that report it: a video with
 * 500k TikTok views folded into a post with 2k Instagram reach came out at over
 * 1000%. The numerator and the denominator have to cover the same audience.
 */
function rate(engagement: number, reach: number, views: number, reachlessViews = 0): number {
  const base = reach > 0 ? reach + reachlessViews : views;
  return base > 0 ? parseFloat(((engagement / base) * 100).toFixed(2)) : 0;
}

/** The public URL for one destination: stored first, derived as a fallback. */
export function destinationLink(dest: any, accounts: Map<string, AccountMeta>): string | null {
  if (dest?.platformPostUrl) return dest.platformPostUrl;
  const acct = dest?.socialAccountId ? accounts.get(dest.socialAccountId) : undefined;
  return derivePermalink(dest?.platform || acct?.platform || '', dest?.platformPostId, {
    platformUsername: acct?.platformUsername,
    pageId: acct?.pageId,
  });
}

export function unifyPosts(opts: UnifyOptions): UnifyResult {
  const { posts, imported, platformFilter, accounts } = opts;

  // Index the export rows both ways: by their own id, for destinations the user
  // attached by hand, and by TikTok video id, for posts we published ourselves.
  const importedById = new Map<string, ImportedRow>();
  const importedByVideoId = new Map<string, ImportedRow>();
  for (const row of imported) {
    importedById.set(String(row.id), row);
    importedByVideoId.set(String(row.externalId), row);
  }

  /**
   * The export row this destination stands for, if any.
   *
   * A manual link is the user telling us outright that these are one post, so it
   * wins over the video-id heuristic and applies on any platform — the heuristic
   * only ever answers for TikTok.
   */
  const rowFor = (dest: any): ImportedRow | undefined => {
    if (dest?.importedPostId) return importedById.get(String(dest.importedPostId));
    const videoId = tiktokVideoIdOf(dest);
    return videoId ? importedByVideoId.get(videoId) : undefined;
  };

  const consumed = new Set<string>();
  const mergedPlatformsByPost = new Map<string, Set<string>>();
  let mergedCount = 0;
  const unified: UnifiedPost[] = [];

  for (const post of posts) {
    const destinations: any[] = post.destinations || [];

    // Which destinations have an export twin, and on which platforms.
    const matches: { dest: any; row: ImportedRow }[] = [];
    for (const dest of destinations) {
      const row = rowFor(dest);
      // A video belongs to one real-world post, so never let two posts claim one
      // row — whether it was found by id or by the heuristic.
      if (!row || consumed.has(row.id)) continue;
      matches.push({ dest, row });
      consumed.add(row.id);
    }

    const mergedPlatforms = new Set(matches.map(m => (m.dest.platform || '').toUpperCase()));
    if (matches.length) {
      mergedPlatformsByPost.set(
        post.id,
        new Set(matches.map(m => (m.dest.platform || '').toLowerCase())),
      );
    }

    // Score the scheduled side, skipping platforms the export now speaks for.
    // Without this the zero-filled (or mock) TikTok PostInsight row would drag
    // the merged totals down.
    const insights = (post.insights || []).filter((i: any) => {
      const p = (i.platform || '').toUpperCase();
      if (mergedPlatforms.has(p)) return false;
      if (platformFilter && platformFilter !== 'ALL') return p === platformFilter;
      return true;
    });

    let likes = 0, comments = 0, shares = 0, saved = 0, views = 0, reach = 0, impressions = 0;
    for (const i of insights) {
      likes += n(i.likes); comments += n(i.comments); shares += n(i.shares);
      saved += n(i.saved); views += n(i.views); reach += n(i.reach); impressions += n(i.impressions);
    }

    // Fold in the export numbers for every merged destination.
    let importedLink: string | null = null;
    let importedThumb: string | null = null;
    let importedIsVerified = false;
    let importedVerSource: string | null = null;

    // Views from the export side, tracked apart from the rest so the engagement
    // rate can widen its denominator to match — these rows bring no reach.
    let reachlessViews = 0;

    for (const { row } of matches) {
      likes += n(row.likes); comments += n(row.comments);
      shares += n(row.shares); views += n(row.views);
      reachlessViews += n(row.views);
      if (!importedLink && row.link) importedLink = row.link;
      if (!importedThumb && row.thumbnailUrl) importedThumb = row.thumbnailUrl;
      if (row.isVerified) {
        importedIsVerified = true;
        importedVerSource = row.verificationSource || 'api';
      }
    }

    const unifiedDests: UnifiedDestination[] = destinations.map(d => ({
      platform: d.platform,
      status: d.status ?? 'PUBLISHED',
      platformPostId: d.platformPostId ?? null,
      link: destinationLink(d, accounts),
      importedPostId: d.importedPostId ?? null,
    }));

    // Prefer a link on the platform the user is filtered to, then any link at
    // all, then whatever the export gave us.
    const preferred = platformFilter !== 'ALL'
      ? unifiedDests.find(d => d.platform.toUpperCase() === platformFilter && d.link)?.link
      : null;
    const link = preferred || unifiedDests.find(d => d.link)?.link || importedLink || null;

    const engagement = likes + comments + shares + saved;
    if (matches.length) mergedCount++;

    unified.push({
      id: post.id,
      caption: post.caption || '',
      mediaUrls: post.mediaUrls ?? (importedThumb ? [importedThumb] : null),
      mediaType: post.mediaType ?? null,
      thumbnailUrl: importedThumb || (Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null),
      isVerified: importedIsVerified,
      verificationSource: importedVerSource,
      publishedAt: post.publishedAt ?? null,
      destinations: unifiedDests,
      link,
      source: matches.length ? 'both' : 'scheduled',
      imported: matches.length > 0,
      likes, comments, shares, saved, views, reach, impressions,
      engagement,
      engagementRate: rate(engagement, reach, views, reachlessViews),
    });
  }

  // Export rows with no post of ours behind them — content posted natively.
  for (const row of imported) {
    if (consumed.has(row.id)) continue;
    const acct = accounts.get(row.socialAccountId);
    const platform = acct?.platform || 'tiktok';
    if (platformFilter !== 'ALL' && platform.toUpperCase() !== platformFilter) continue;

    const likes = n(row.likes), comments = n(row.comments), shares = n(row.shares), views = n(row.views);
    const engagement = likes + comments + shares;
    const link = row.link
      || derivePermalink(platform, row.externalId, { platformUsername: acct?.platformUsername });

    unified.push({
      id: `imported:${row.id}`,
      caption: row.title || '',
      mediaUrls: row.thumbnailUrl ? [row.thumbnailUrl] : null,
      mediaType: 'video',
      thumbnailUrl: row.thumbnailUrl || null,
      isVerified: Boolean(row.isVerified),
      verificationSource: row.verificationSource || null,
      publishedAt: row.postedAt ?? null,
      destinations: [{ platform, status: 'PUBLISHED', platformPostId: row.externalId, link }],
      link,
      source: 'imported',
      imported: true,
      likes, comments, shares, saved: 0, views, reach: 0, impressions: 0,
      engagement,
      engagementRate: rate(engagement, 0, views),
    });
  }

  return { posts: unified, mergedCount, mergedImportedIds: consumed, mergedPlatformsByPost };
}
