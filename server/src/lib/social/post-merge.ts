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

export interface UnifyOptions {
  posts: any[];
  imported: ImportedRow[];
  /** 'ALL' or an uppercase platform name. */
  platformFilter: string;
  /** socialAccountId → account metadata, for deriving links and platforms. */
  accounts: Map<string, AccountMeta>;
}

const n = (v: unknown): number => Number(v) || 0;

/** Engagement rate against whichever denominator we actually have. */
function rate(engagement: number, reach: number, views: number): number {
  const base = reach > 0 ? reach : views;
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

export function unifyPosts(opts: UnifyOptions): { posts: UnifiedPost[]; mergedCount: number } {
  const { posts, imported, platformFilter, accounts } = opts;

  // Index the export rows by TikTok video id so a post can find its twin.
  const importedByVideoId = new Map<string, ImportedRow>();
  for (const row of imported) importedByVideoId.set(String(row.externalId), row);

  const consumed = new Set<string>();
  let mergedCount = 0;
  const unified: UnifiedPost[] = [];

  for (const post of posts) {
    const destinations: any[] = post.destinations || [];

    // Which destinations have an export twin, and on which platforms.
    const matches: { dest: any; row: ImportedRow }[] = [];
    for (const dest of destinations) {
      const videoId = tiktokVideoIdOf(dest);
      if (!videoId) continue;
      const row = importedByVideoId.get(videoId);
      // A video id is unique per account, so never let two posts claim one row.
      if (!row || consumed.has(row.id)) continue;
      matches.push({ dest, row });
      consumed.add(row.id);
    }

    const mergedPlatforms = new Set(matches.map(m => (m.dest.platform || '').toUpperCase()));

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

    for (const { row } of matches) {
      likes += n(row.likes); comments += n(row.comments);
      shares += n(row.shares); views += n(row.views);
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
      engagementRate: rate(engagement, reach, views),
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

  return { posts: unified, mergedCount };
}
