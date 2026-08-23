import { describe, it, expect } from 'vitest';
import { unifyPosts, destinationLink, type AccountMeta } from './post-merge.js';

const TIKTOK_ACCOUNT = 'acct-tiktok';
const FB_ACCOUNT = 'acct-fb';
const VIDEO_ID = '7301234567890123456';
const VIDEO_URL = `https://www.tiktok.com/@hirdan/video/${VIDEO_ID}`;

const accounts = new Map<string, AccountMeta>([
  [TIKTOK_ACCOUNT, { platform: 'tiktok', platformUsername: 'hirdan' }],
  [FB_ACCOUNT, { platform: 'facebook', platformUsername: 'hirdanpage', pageId: '5550001' }],
]);

/** A post published through the scheduler to TikTok. */
const tiktokPost = (overrides: any = {}) => ({
  id: 'post-1',
  caption: 'Our new promo',
  mediaUrls: ['/uploads/promo.mp4'],
  mediaType: 'video',
  publishedAt: new Date('2026-06-01'),
  // What the live sync writes for TikTok: a row of zeros, because TikTok's API
  // exposes no per-post metrics to us.
  insights: [{ platform: 'TIKTOK', likes: 0, comments: 0, shares: 0, saved: 0, views: 0, reach: 0, impressions: 0 }],
  destinations: [{
    platform: 'tiktok',
    status: 'PUBLISHED',
    platformPostId: 'v_pub_url~v2.abc',
    platformPostUrl: VIDEO_URL,
    socialAccountId: TIKTOK_ACCOUNT,
  }],
  ...overrides,
});

/** The same video as it appears in a TikTok Studio export. */
const importedRow = (overrides: any = {}) => ({
  id: 'imp-1',
  socialAccountId: TIKTOK_ACCOUNT,
  externalId: VIDEO_ID,
  title: 'Our new promo',
  link: VIDEO_URL,
  postedAt: new Date('2026-06-01'),
  likes: 400,
  comments: 50,
  shares: 25,
  views: 10000,
  ...overrides,
});

describe('unifyPosts — merging published posts with imported export rows', () => {
  it('shows a published-then-imported video once, not twice', () => {
    const { posts, mergedCount } = unifyPosts({
      posts: [tiktokPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts,
    });

    expect(posts).toHaveLength(1);
    expect(mergedCount).toBe(1);
    expect(posts[0].source).toBe('both');
    expect(posts[0].id).toBe('post-1');
  });

  it('takes the metrics from the export, not the zero-filled API row', () => {
    const { posts } = unifyPosts({
      posts: [tiktokPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts,
    });

    expect(posts[0].views).toBe(10000);
    expect(posts[0].likes).toBe(400);
    expect(posts[0].comments).toBe(50);
    expect(posts[0].shares).toBe(25);
    expect(posts[0].engagement).toBe(475);
  });

  it('keeps our caption and media, since that is what the user recognises', () => {
    const { posts } = unifyPosts({
      posts: [tiktokPost()],
      imported: [importedRow({ title: 'video_20260601_final.mp4' })],
      platformFilter: 'ALL',
      accounts,
    });

    expect(posts[0].caption).toBe('Our new promo');
    expect(posts[0].mediaUrls).toEqual(['/uploads/promo.mp4']);
  });

  it('carries the real video link through', () => {
    const { posts } = unifyPosts({
      posts: [tiktokPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts,
    });

    expect(posts[0].link).toBe(VIDEO_URL);
  });

  it('keeps live metrics for other platforms on a cross-posted item', () => {
    // Published to Facebook AND TikTok: Facebook's real insight numbers must
    // survive, while TikTok's placeholder row is replaced by the export.
    const post = tiktokPost({
      insights: [
        { platform: 'TIKTOK', likes: 0, comments: 0, shares: 0, saved: 0, views: 0, reach: 0, impressions: 0 },
        { platform: 'FACEBOOK', likes: 30, comments: 4, shares: 2, saved: 1, views: 0, reach: 900, impressions: 1200 },
      ],
      destinations: [
        {
          platform: 'tiktok', status: 'PUBLISHED', platformPostId: 'v_pub_url~v2.abc',
          platformPostUrl: VIDEO_URL, socialAccountId: TIKTOK_ACCOUNT,
        },
        {
          platform: 'facebook', status: 'PUBLISHED', platformPostId: '5550001_9998887',
          platformPostUrl: null, socialAccountId: FB_ACCOUNT,
        },
      ],
    });

    const { posts } = unifyPosts({ posts: [post], imported: [importedRow()], platformFilter: 'ALL', accounts });

    expect(posts).toHaveLength(1);
    expect(posts[0].likes).toBe(430);      // 30 Facebook + 400 imported TikTok
    expect(posts[0].reach).toBe(900);      // Facebook only
    expect(posts[0].impressions).toBe(1200);
    expect(posts[0].saved).toBe(1);
    expect(posts[0].views).toBe(10000);
  });

  it('derives a link for a destination that has no stored URL', () => {
    const post = tiktokPost({
      destinations: [{
        platform: 'facebook', status: 'PUBLISHED', platformPostId: '5550001_9998887',
        platformPostUrl: null, socialAccountId: FB_ACCOUNT,
      }],
      insights: [],
    });

    const { posts } = unifyPosts({ posts: [post], imported: [], platformFilter: 'ALL', accounts });
    expect(posts[0].link).toBe('https://www.facebook.com/5550001/posts/9998887');
  });

  it('lists an export row with no post behind it as imported', () => {
    const { posts, mergedCount } = unifyPosts({
      posts: [],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts,
    });

    expect(posts).toHaveLength(1);
    expect(mergedCount).toBe(0);
    expect(posts[0].source).toBe('imported');
    expect(posts[0].id).toBe('imported:imp-1');
    expect(posts[0].views).toBe(10000);
  });

  it('never lets two posts claim the same export row', () => {
    const a = tiktokPost({ id: 'post-a' });
    const b = tiktokPost({ id: 'post-b' });

    const { posts, mergedCount } = unifyPosts({
      posts: [a, b],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts,
    });

    expect(posts).toHaveLength(2);
    expect(mergedCount).toBe(1);
    expect(posts.filter(p => p.source === 'both')).toHaveLength(1);
    // The row's 10,000 views are counted once across the whole list.
    expect(posts.reduce((s, p) => s + p.views, 0)).toBe(10000);
  });

  it('leaves a post alone when no export row matches', () => {
    const { posts, mergedCount } = unifyPosts({
      posts: [tiktokPost()],
      imported: [importedRow({ externalId: '9999999999999999999', id: 'imp-other' })],
      platformFilter: 'ALL',
      accounts,
    });

    expect(mergedCount).toBe(0);
    expect(posts).toHaveLength(2);
    expect(posts.find(p => p.id === 'post-1')?.source).toBe('scheduled');
    expect(posts.find(p => p.id === 'imported:imp-other')?.source).toBe('imported');
  });

  it('drops unmatched export rows that belong to another platform', () => {
    const { posts } = unifyPosts({
      posts: [],
      imported: [importedRow()],
      platformFilter: 'FACEBOOK',
      accounts,
    });

    expect(posts).toHaveLength(0);
  });

  it('scopes scheduled metrics to the selected platform', () => {
    const post = tiktokPost({
      insights: [
        { platform: 'FACEBOOK', likes: 30, comments: 4, shares: 2, saved: 1, views: 0, reach: 900, impressions: 1200 },
        { platform: 'INSTAGRAM', likes: 70, comments: 9, shares: 3, saved: 5, views: 0, reach: 1500, impressions: 2000 },
      ],
      destinations: [{
        platform: 'facebook', status: 'PUBLISHED', platformPostId: '5550001_9998887',
        platformPostUrl: null, socialAccountId: FB_ACCOUNT,
      }],
    });

    const { posts } = unifyPosts({ posts: [post], imported: [], platformFilter: 'FACEBOOK', accounts });
    expect(posts[0].likes).toBe(30);
    expect(posts[0].reach).toBe(900);
  });

  it('computes engagement rate against views when reach is unknown', () => {
    // TikTok exports carry no reach, so rate falls back to views.
    const { posts } = unifyPosts({ posts: [], imported: [importedRow()], platformFilter: 'ALL', accounts });
    expect(posts[0].engagementRate).toBe(4.75); // 475 / 10000
  });

  it('reports a zero rate rather than dividing by zero', () => {
    const { posts } = unifyPosts({
      posts: [],
      imported: [importedRow({ views: 0, likes: 0, comments: 0, shares: 0 })],
      platformFilter: 'ALL',
      accounts,
    });
    expect(posts[0].engagementRate).toBe(0);
  });
});

describe('destinationLink', () => {
  it('prefers the stored URL over derivation', () => {
    const link = destinationLink({
      platform: 'tiktok', platformPostId: '111', platformPostUrl: VIDEO_URL,
      socialAccountId: TIKTOK_ACCOUNT,
    }, accounts);
    expect(link).toBe(VIDEO_URL);
  });

  it('returns null when nothing can be resolved', () => {
    const link = destinationLink({
      platform: 'instagram', platformPostId: '17895695668004550',
      platformPostUrl: null, socialAccountId: 'acct-ig',
    }, accounts);
    expect(link).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The case the video-id heuristic structurally cannot reach: a post the composer
// sent to Instagram and Facebook, whose TikTok cut was uploaded by hand in the
// TikTok app. There is no TikTok destination to recover an id from, so the user
// links the export row to the group and the destination records which row it is.
// ─────────────────────────────────────────────────────────────────────────────
describe('unifyPosts — export rows linked to a group by hand', () => {
  const IG_ACCOUNT = 'acct-ig';
  const linkAccounts = new Map<string, AccountMeta>([
    ...accounts,
    [IG_ACCOUNT, { platform: 'instagram', platformUsername: 'hirdan' }],
  ]);

  /** IG + FB through the composer, plus the TikTok destination the user linked. */
  const crossPost = (overrides: any = {}) => ({
    id: 'post-x',
    caption: 'Ramadan campaign',
    mediaUrls: ['/uploads/ramadan.mp4'],
    mediaType: 'video',
    publishedAt: new Date('2026-06-10'),
    insights: [
      { platform: 'INSTAGRAM', likes: 120, comments: 8, shares: 3, saved: 10, views: 900, reach: 1500, impressions: 1800 },
      { platform: 'FACEBOOK', likes: 60, comments: 4, shares: 2, saved: 0, views: 400, reach: 700, impressions: 800 },
    ],
    destinations: [
      { platform: 'instagram', status: 'PUBLISHED', platformPostId: 'ig_1', platformPostUrl: null, socialAccountId: IG_ACCOUNT },
      { platform: 'facebook', status: 'PUBLISHED', platformPostId: '5550001_99', platformPostUrl: null, socialAccountId: FB_ACCOUNT },
      // Created by the link action: no publish of ours behind it, so the export
      // row id — not a recovered video id — is what ties the two together.
      {
        platform: 'tiktok', status: 'PUBLISHED', platformPostId: VIDEO_ID,
        platformPostUrl: VIDEO_URL, socialAccountId: TIKTOK_ACCOUNT, importedPostId: 'imp-1',
      },
    ],
    ...overrides,
  });

  it('folds a hand-linked video into the group instead of listing it separately', () => {
    const { posts, mergedCount } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    expect(posts).toHaveLength(1);
    expect(mergedCount).toBe(1);
    expect(posts[0].source).toBe('both');
    expect(posts[0].destinations.map(d => d.platform)).toEqual(['instagram', 'facebook', 'tiktok']);
  });

  it('adds the export numbers to the live ones rather than replacing them', () => {
    const { posts } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    // Instagram + Facebook keep their real API numbers; TikTok's come from the
    // export, because no TikTok insight row exists for a post we never published.
    expect(posts[0].likes).toBe(120 + 60 + 400);
    expect(posts[0].comments).toBe(8 + 4 + 50);
    expect(posts[0].shares).toBe(3 + 2 + 25);
    expect(posts[0].views).toBe(900 + 400 + 10000);
    expect(posts[0].reach).toBe(1500 + 700);
  });

  it('keeps the identity of the post the user recognises, not the export title', () => {
    const { posts } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow({ title: 'ramadan_final_v3.mp4' })],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    expect(posts[0].caption).toBe('Ramadan campaign');
    expect(posts[0].mediaUrls).toEqual(['/uploads/ramadan.mp4']);
  });

  it('surfaces the linked row id on the destination so the UI can offer unlink', () => {
    const { posts } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    const dests = posts[0].destinations;
    expect(dests.find(d => d.platform === 'tiktok')?.importedPostId).toBe('imp-1');
    expect(dests.find(d => d.platform === 'instagram')?.importedPostId).toBeNull();
  });

  it('lets the group answer a TikTok platform filter it could not answer before', () => {
    const { posts } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow()],
      platformFilter: 'TIKTOK',
      accounts: linkAccounts,
    });

    // Only the export's numbers survive the filter — IG and FB insights are
    // scoped out, so the row reports TikTok's performance alone.
    expect(posts).toHaveLength(1);
    expect(posts[0].likes).toBe(400);
    expect(posts[0].views).toBe(10000);
    expect(posts[0].link).toBe(VIDEO_URL);
  });

  it('trusts the explicit link over a video id pointing at a different row', () => {
    // A stale platformPostId must not win: the user's choice is the source of
    // truth, so the row named by importedPostId is the one that merges.
    const post = crossPost({
      destinations: [{
        platform: 'tiktok', status: 'PUBLISHED', platformPostId: '7309999999999999999',
        platformPostUrl: null, socialAccountId: TIKTOK_ACCOUNT, importedPostId: 'imp-1',
      }],
      insights: [],
    });

    const { posts } = unifyPosts({
      posts: [post],
      imported: [importedRow(), importedRow({ id: 'imp-2', externalId: '7309999999999999999', likes: 7 })],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    // imp-1 merged into the group; imp-2 was claimed by nobody and stands alone.
    expect(posts).toHaveLength(2);
    expect(posts[0].likes).toBe(400);
    expect(posts[1].id).toBe('imported:imp-2');
  });

  it('never lets two groups claim the same export row', () => {
    const { posts, mergedCount } = unifyPosts({
      posts: [crossPost(), crossPost({ id: 'post-y' })],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    expect(mergedCount).toBe(1);
    expect(posts.filter(p => p.source === 'both')).toHaveLength(1);
    expect(posts.filter(p => p.source === 'scheduled')).toHaveLength(1);
  });

  it('widens the engagement-rate denominator to cover the linked audience', () => {
    // The export brings 10k views and 475 engagements but no reach at all. Divide
    // by Instagram+Facebook's 2,200 reach alone and the post reports >1000%; the
    // denominator has to grow with the audience the numerator now covers.
    const { posts } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    // engagement 682 ÷ (reach 2,200 + export views 10,000) × 100
    expect(posts[0].engagement).toBe(682);
    expect(posts[0].engagementRate).toBe(5.59);
  });

  // Callers that also tally the raw export rows (the client report counts posts
  // per platform, and builds a top-four list) need to know which rows a group has
  // already absorbed, or the same video is counted on both sides.
  it('names the export rows it absorbed so callers do not re-count them', () => {
    const { mergedImportedIds } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow(), importedRow({ id: 'imp-2', externalId: '7300000000000000001' })],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    expect([...mergedImportedIds]).toEqual(['imp-1']);
  });

  it('names which platform of which post the export spoke for', () => {
    const { mergedPlatformsByPost } = unifyPosts({
      posts: [crossPost()],
      imported: [importedRow()],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    // Instagram and Facebook keep their own insights; only TikTok was replaced.
    expect([...(mergedPlatformsByPost.get('post-x') ?? [])]).toEqual(['tiktok']);
  });

  it('reports nothing merged for a post no export row touched', () => {
    const { mergedImportedIds, mergedPlatformsByPost } = unifyPosts({
      posts: [crossPost()],
      imported: [],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    expect(mergedImportedIds.size).toBe(0);
    expect(mergedPlatformsByPost.has('post-x')).toBe(false);
  });

  it('leaves the group intact when the linked row is missing from this page', () => {
    // The read sites union linked rows back in precisely so this does not
    // happen, but a group must still render — minus those numbers — if it does.
    const { posts, mergedCount } = unifyPosts({
      posts: [crossPost()],
      imported: [],
      platformFilter: 'ALL',
      accounts: linkAccounts,
    });

    expect(posts).toHaveLength(1);
    expect(mergedCount).toBe(0);
    expect(posts[0].likes).toBe(180);
    expect(posts[0].destinations).toHaveLength(3);
  });
});
