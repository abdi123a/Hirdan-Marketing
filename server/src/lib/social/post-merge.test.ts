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
