// ─────────────────────────────────────────────────────────────────────────────
// Attaching natively-published content to the post group it belongs to.
//
// A post cross-published through the composer is one SocialPost with a
// destination per platform, and the dashboard shows it as a single item. TikTok
// can never be one of those destinations for an account without publish
// approval: the video is posted by hand in the TikTok app, and only reaches us
// later as an ImportedPost row parsed out of a Studio export.
//
// unifyPosts() can already fuse the two, but only by recovering a TikTok video
// id from a destination we published — which by definition doesn't exist here.
// So the same video shows up twice: once as the Instagram+Facebook group, once
// as a lone imported row. Nothing in the data can tell them apart from two
// genuinely different posts, so the user makes the call, and this module records
// it as a real TikTok destination pointing at that exact export row.
//
// Recording it as a destination (rather than as a side-table of "these two are
// the same") is what makes the rest of the app agree without special-casing:
// platform filters, per-platform badges, the post detail breakdown and the
// client report all read destinations, and now all of them see TikTok.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../prisma.js';
import { tiktokVideoIdOf } from './permalink.js';

/** Thrown for conditions the caller should surface as a 4xx, not a 500. */
export class PostLinkError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PostLinkError';
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Words worth comparing between a caption and an export title. */
function keywords(text: string | null | undefined): Set<string> {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[#@]/g, ' ')
      .split(/[^a-z0-9À-ɏ]+/)
      .filter(w => w.length > 3),
  );
}

/** Jaccard overlap of two word sets, 0..1. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Export rows the given post could plausibly be, best first.
 *
 * Ranked so the intended row is usually on top: same-day content first, then
 * caption overlap. Rows already claimed by any group are excluded — both those
 * linked by hand and those unifyPosts() already merges on the video id — so the
 * list only ever offers content that is genuinely still floating on its own.
 */
export async function findLinkCandidates(postId: string, limit = 40) {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: { destinations: true },
  });
  if (!post) throw new PostLinkError('Post not found', 404);

  const accounts = await prisma.socialAccount.findMany({
    where: { clientId: post.clientId },
    select: { id: true, platform: true, platformUsername: true, displayName: true },
  });
  if (!accounts.length) return { post: postSummary(post), candidates: [] };

  const accountById = new Map(accounts.map(a => [a.id, a]));
  const taken = new Set(
    post.destinations.map(d => d.platform.toLowerCase()),
  );

  // Video ids this client already publishes to — a row matching one of these is
  // spoken for by the id heuristic and must not be offered again here.
  const claimedVideoIds = new Set(
    (await prisma.socialPostDestination.findMany({
      where: { platform: 'tiktok', post: { clientId: post.clientId } },
      select: { platform: true, platformPostId: true, platformPostUrl: true },
    }))
      .map(tiktokVideoIdOf)
      .filter((v): v is string => Boolean(v)),
  );

  const rows = await prisma.importedPost.findMany({
    where: {
      socialAccountId: { in: accounts.map(a => a.id) },
      // Prisma expresses "no row on the other side of the relation" as `is: null`.
      linkedDestination: { is: null },
    },
    orderBy: { postedAt: 'desc' },
    take: 500,
  });

  const captionWords = keywords(post.caption);
  const anchor = (post.publishedAt || post.scheduledFor || post.createdAt).getTime();

  const candidates = rows
    .filter(r => !claimedVideoIds.has(String(r.externalId)))
    .map(r => {
      const account = accountById.get(r.socialAccountId);
      const platform = (account?.platform || r.platform || '').toLowerCase();
      const daysApart = r.postedAt
        ? Math.abs(r.postedAt.getTime() - anchor) / DAY_MS
        : null;
      const titleMatch = similarity(captionWords, keywords(r.title));
      // Closeness in time is the stronger signal — the same video goes out
      // everywhere within a day or so, while captions get rewritten per platform.
      const proximity = daysApart === null ? 0 : Math.max(0, 1 - daysApart / 7);
      return {
        id: r.id,
        platform,
        externalId: r.externalId,
        title: r.title,
        link: r.link,
        postedAt: r.postedAt,
        views: r.views,
        likes: r.likes,
        comments: r.comments,
        shares: r.shares,
        thumbnailUrl: r.thumbnailUrl,
        accountId: r.socialAccountId,
        accountName: account?.displayName ?? null,
        accountHandle: account?.platformUsername ?? null,
        // The group already covers this platform, so linking would double it up.
        platformAlreadyInGroup: taken.has(platform),
        daysApart: daysApart === null ? null : parseFloat(daysApart.toFixed(1)),
        titleMatch: parseFloat(titleMatch.toFixed(2)),
        score: parseFloat((proximity * 0.7 + titleMatch * 0.3).toFixed(3)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { post: postSummary(post), candidates };
}

function postSummary(post: any) {
  return {
    id: post.id,
    caption: post.caption,
    publishedAt: post.publishedAt,
    platforms: (post.destinations || []).map((d: any) => d.platform.toLowerCase()),
  };
}

/**
 * Attach an export row to a post group as a real destination.
 *
 * The imported row's own account decides the platform and handle, so the link
 * cannot invent a destination on an account the client doesn't own. Both unique
 * constraints in play are checked first so the user gets a sentence back rather
 * than a raw constraint violation.
 */
export async function linkImportedPostToGroup(postId: string, importedPostId: string) {
  const [post, row] = await Promise.all([
    prisma.socialPost.findUnique({ where: { id: postId }, include: { destinations: true } }),
    prisma.importedPost.findUnique({
      where: { id: importedPostId },
      include: { account: true, linkedDestination: true },
    }),
  ]);

  if (!post) throw new PostLinkError('Post not found', 404);
  if (!row) throw new PostLinkError('Imported video not found', 404);
  if (row.account.clientId !== post.clientId) {
    throw new PostLinkError('That video belongs to a different client', 403);
  }
  if (row.linkedDestination) {
    throw new PostLinkError(
      row.linkedDestination.postId === postId
        ? 'That video is already part of this post'
        : 'That video is already linked to another post',
      409,
    );
  }

  const platform = row.account.platform.toLowerCase();
  if (post.destinations.some(d => d.platform.toLowerCase() === platform)) {
    throw new PostLinkError(
      `This post already has a ${platform} destination — unlink that one first`,
      409,
    );
  }

  const destination = await prisma.socialPostDestination.create({
    data: {
      postId: post.id,
      socialAccountId: row.socialAccountId,
      platform,
      // It is genuinely live — just published by hand rather than by us.
      status: 'PUBLISHED',
      platformPostId: row.externalId,
      platformPostUrl: row.link,
      publishedAt: row.postedAt ?? post.publishedAt,
      importedPostId: row.id,
    },
  });

  return { destination, platform, importedPost: row };
}

/**
 * Detach a hand-linked destination, leaving the export row to stand alone again.
 *
 * Deliberately refuses destinations we published: those rows are the record of a
 * real API publish, and this is an "undo the grouping" action, not a delete.
 */
export async function unlinkImportedPost(postId: string, destinationId: string) {
  const destination = await prisma.socialPostDestination.findUnique({
    where: { id: destinationId },
  });
  if (!destination || destination.postId !== postId) {
    throw new PostLinkError('Destination not found on this post', 404);
  }
  if (!destination.importedPostId) {
    throw new PostLinkError('That platform was published through the system, not linked by hand', 400);
  }

  await prisma.socialPostDestination.delete({ where: { id: destinationId } });
  return { unlinkedImportedPostId: destination.importedPostId, platform: destination.platform };
}

/**
 * Export rows a set of post groups explicitly claim.
 *
 * Callers fetch imported rows with a `take` cap ordered by views, so a linked
 * row can fall outside that page and silently un-merge the group it belongs to.
 * Unioning these back in keeps the grouping stable no matter how the caller
 * paged, and returns [] without a query when nothing is linked.
 */
export async function linkedImportedRowsFor(posts: any[]): Promise<any[]> {
  const ids = [
    ...new Set(
      posts.flatMap(p => (p.destinations || [])
        .map((d: any) => d.importedPostId)
        .filter(Boolean) as string[]),
    ),
  ];
  if (!ids.length) return [];
  return prisma.importedPost.findMany({ where: { id: { in: ids } } });
}

/** Union of two export-row sets, keeping one entry per row id. */
export function mergeImportedRows(...sets: any[][]): any[] {
  const byId = new Map<string, any>();
  for (const set of sets) for (const row of set) byId.set(row.id, row);
  return [...byId.values()];
}
