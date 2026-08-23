// Assembles everything the monthly performance report renders, for one client
// and one calendar month.
//
// The guiding rule: every number here is computed from stored data or left
// null. Nothing is estimated, back-filled or invented — a section with no data
// renders an honest empty state rather than a plausible-looking figure, because
// these reports go to clients.

import { prisma } from '../../prisma.js';
import {
  buildCapabilityGate,
  engagementRate,
  fetchDailyRows,
  followersAsOf,
  monthBounds,
  pctChange,
  periodTotals,
  sumField,
  type PeriodTotals,
} from '../analytics-core.js';
import { unifyPosts, type AccountMeta } from '../post-merge.js';
import { linkedImportedRowsFor, mergeImportedRows } from '../post-link.service.js';
import { centsToMajor } from '../../money.js';

export const REPORT_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'facebook'] as const;
export type ReportPlatform = (typeof REPORT_PLATFORMS)[number];

export interface KpiFact {
  current: number;
  previous: number | null;
  changePct: number | null;
}

export interface TrendPoint {
  month: number;
  year: number;
  label: string;
  reach: number;
  engagement: number;
  engagementRate: number;
}

export interface FollowerPoint {
  month: number;
  year: number;
  label: string;
  total: number;
  gained: number | null;
}

export interface PlatformRow {
  platform: string;
  posts: number;
  reach: number | null;
  engagements: number | null;
  engagementRate: number | null;
  follows: number | null;
}

export interface TopPost {
  rank: number;
  postedAt: string | null;
  primaryMetric: number;
  secondaryMetric: number | null;
  engagementRate: number | null;
  link: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
}

export interface FormatRow {
  format: string;
  avgReach: number;
  engagementRate: number | null;
  count: number;
}

export interface ShareRow {
  label: string;
  fraction: number;
}

export interface PaidFacts {
  hasData: boolean;
  currency: string;
  spend: number;
  paidReach: number | null;
  organicReach: number | null;
  paidSharePct: number | null;
  organicSharePct: number | null;
  costPerThousand: number | null;
  linkClicks: number | null;
  costPerClick: number | null;
  paidEngagement: number | null;
  paidEngagementRate: number | null;
  messagesStarted: number | null;
}

export interface ReportFacts {
  client: { id: string; name: string };
  period: { month: number; year: number; label: string; start: string; end: string };
  hasAccounts: boolean;
  totals: PeriodTotals & { followers: number; postCount: number };
  kpis: {
    reach: KpiFact;
    engagements: KpiFact;
    newFollowers: KpiFact;
    engagementRate: KpiFact;
  };
  trend: TrendPoint[];
  followerGrowth: {
    points: FollowerPoint[];
    newFollows: number | null;
    unfollows: number | null;
    netGrowth: number | null;
    total: number;
  };
  platforms: PlatformRow[];
  platformMix: { reach: ShareRow[]; engagement: ShareRow[] };
  paid: PaidFacts;
  topPosts: Record<string, TopPost[]>;
  formats: FormatRow[];
  bestTimes: { weekday: number; hour: number; value: number }[];
  bestTimesSource: 'audience' | 'posts' | null;
  audience: {
    gender: ShareRow[];
    age: ShareRow[];
    country: ShareRow[];
    city: ShareRow[];
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Bucket a post's media type into the report's format rows. */
function formatOf(mediaType: string | null | undefined, platform: string | null): string {
  const t = (mediaType || '').toLowerCase();
  if (t === 'reel' || t === 'short' || t === 'video' && platform === 'tiktok') return 'Short video';
  if (t === 'video') return 'Long-form video';
  if (t === 'carousel') return 'Photo carousel';
  if (t === 'image' || t === 'photo') return 'Single photo';
  if (t === 'story') return 'Story';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Other';
}

function kpi(current: number, previous: number | null): KpiFact {
  const hasBase = previous != null && previous > 0;
  return {
    current,
    previous: hasBase ? previous : null,
    changePct: hasBase ? pctChange(current, previous!) : null,
  };
}

function toShares(rows: { label: string; fraction: number }[]): ShareRow[] {
  return rows
    .map(r => ({ label: r.label, fraction: r.fraction }))
    .sort((a, b) => b.fraction - a.fraction);
}

export async function buildReportFacts(
  clientId: string,
  month: number,
  year: number,
): Promise<ReportFacts> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error('Client not found');

  const { since, until } = monthBounds(month, year);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { since: prevSince, until: prevUntil } = monthBounds(prevMonth, prevYear);

  const accounts = await prisma.socialAccount.findMany({
    where: { clientId, isActive: true },
  });
  const accountIds = accounts.map(a => a.id);

  const period = {
    month,
    year,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    start: since.toISOString(),
    end: until.toISOString(),
  };

  if (accountIds.length === 0) {
    return emptyFacts(client, period);
  }

  const gate = buildCapabilityGate(accounts, 'ALL');
  const platformOf = new Map(accounts.map(a => [a.id, a.platform.toLowerCase()]));

  const [currentDaily, prevDaily] = await Promise.all([
    fetchDailyRows(accountIds, since, until),
    fetchDailyRows(accountIds, prevSince, prevUntil),
  ]);

  // Posts published inside the current/previous window OR the 6-month trend
  // window below, with their per-post insights. Fetching only prevSince..until
  // (2 months) meant the trend loop's `posts.filter(...)` for months 3-6 back
  // always got an empty array — those months lost all Facebook/Instagram
  // per-post engagement and looked like a fabricated collapse.
  let trendStartMonth = month - 5;
  let trendStartYear = year;
  while (trendStartMonth <= 0) { trendStartMonth += 12; trendStartYear -= 1; }
  const trendSince = monthBounds(trendStartMonth, trendStartYear).since;

  const posts = await prisma.socialPost.findMany({
    where: {
      clientId,
      status: 'PUBLISHED',
      publishedAt: { gte: trendSince, lte: until },
    },
    include: {
      insights: true,
      destinations: {
        select: {
          platform: true, status: true, platformPostId: true,
          platformPostUrl: true, socialAccountId: true, importedPostId: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 2000,
  });

  const inWindow = (d: Date | null) => !!d && d >= since && d <= until;
  const currentPosts = posts.filter(p => inWindow(p.publishedAt));
  const prevPosts = posts.filter(p => p.publishedAt && p.publishedAt >= prevSince && p.publishedAt <= prevUntil);

  const currentInsights = currentPosts.flatMap(p => p.insights || []);
  const prevInsights = prevPosts.flatMap(p => p.insights || []);

  const totals = periodTotals(currentDaily, currentInsights, gate);
  const prevTotals = periodTotals(prevDaily, prevInsights, gate);

  // Imported native posts (e.g. TikTok videos published outside the composer)
  // that fall inside the month, merged with composer posts so a video that
  // exists in both places is one row, not two.
  const importedPosts = await prisma.importedPost.findMany({
    where: { socialAccountId: { in: accountIds }, postedAt: { gte: since, lte: until } },
    orderBy: { views: 'desc' },
    take: 500,
  });

  const accountMeta = new Map<string, AccountMeta>(
    accounts.map(a => [a.id, {
      platform: a.platform.toLowerCase(),
      platformUsername: a.platformUsername,
      pageId: a.pageId,
    }]),
  );

  // Only the merge input gets the union — the per-platform aggregates below
  // still read `importedPosts`, which is deliberately scoped to the report month.
  // A row linked to a post inside the month may itself sit outside it, and it
  // belongs to that post's totals either way.
  const { posts: unified, mergedImportedIds, mergedPlatformsByPost } = unifyPosts({
    posts: currentPosts,
    imported: mergeImportedRows(importedPosts, await linkedImportedRowsFor(currentPosts)),
    platformFilter: 'ALL',
    accounts: accountMeta,
  });

  const followersNow = await followersAsOf(accountIds, until);
  const followersPrev = await followersAsOf(accountIds, prevUntil);

  // ── Six-month trend ──
  const trend: TrendPoint[] = [];
  for (let back = 5; back >= 0; back--) {
    let m = month - back;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    const b = monthBounds(m, y);
    const rows = await fetchDailyRows(accountIds, b.since, b.until);
    const monthPosts = posts.filter(p => p.publishedAt && p.publishedAt >= b.since && p.publishedAt <= b.until);
    const t = periodTotals(rows, monthPosts.flatMap(p => p.insights || []), gate);
    trend.push({
      month: m,
      year: y,
      label: MONTH_NAMES[m - 1].slice(0, 3),
      reach: t.reach,
      engagement: t.engagement,
      engagementRate: t.engagementRate,
    });
  }

  // ── Follower growth, seven months ──
  const followerPoints: FollowerPoint[] = [];
  for (let back = 6; back >= 0; back--) {
    let m = month - back;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    const b = monthBounds(m, y);
    const total = await followersAsOf(accountIds, b.until);
    const rows = await fetchDailyRows(accountIds, b.since, b.until);
    const gained = sumField(rows, 'newFollows');
    followerPoints.push({
      month: m,
      year: y,
      label: MONTH_NAMES[m - 1].slice(0, 3),
      total,
      gained: gained > 0 ? gained : null,
    });
  }

  // Prefer real per-day follow counts; fall back to the snapshot delta, which is
  // net-only and can't distinguish follows from unfollows.
  const newFollows = totals.newFollows > 0 ? totals.newFollows : null;
  const unfollows = totals.unfollows > 0 ? totals.unfollows : null;
  const netGrowth = newFollows != null
    ? newFollows - (unfollows ?? 0)
    : (followersPrev > 0 ? followersNow - followersPrev : null);

  // ── Per-platform scorecard ──
  const platformRows: PlatformRow[] = [];
  for (const platform of REPORT_PLATFORMS) {
    const platAccounts = accounts.filter(a => a.platform.toLowerCase() === platform);
    if (platAccounts.length === 0) continue;
    const platIds = new Set(platAccounts.map(a => a.id));

    const platDaily = currentDaily.filter(r => platIds.has(r.socialAccountId));
    const platPosts = currentPosts.filter(p =>
      (p.destinations || []).some(d => d.platform.toLowerCase() === platform));
    const platInsights = platPosts.flatMap(p =>
      (p.insights || []).filter(i => (i.platform || '').toLowerCase() === platform));
    // FIX: a video merged into a post group was counted twice here — once via
    // platPosts, because the group carries a destination on this platform, and
    // again via its export row. Linking a hand-published TikTok video to the post
    // it went out with hits this every time, inflating the platform's post count
    // by one per link. The group already speaks for these rows.
    const platImported = importedPosts.filter(ip =>
      platformOf.get(ip.socialAccountId) === platform && !mergedImportedIds.has(ip.id));

    const t = periodTotals(platDaily, platInsights, gate);
    const canReach = gate.metricPlatformOk(platform, 'reach');

    platformRows.push({
      platform,
      posts: platPosts.length + platImported.length,
      reach: canReach ? t.reach : null,
      engagements: t.engagement > 0 ? t.engagement : null,
      engagementRate: canReach && t.reach > 0 ? t.engagementRate : null,
      follows: sumField(platDaily, 'newFollows') || null,
    });
  }

  const reachTotal = platformRows.reduce((s, p) => s + (p.reach || 0), 0);
  const engTotal = platformRows.reduce((s, p) => s + (p.engagements || 0), 0);
  // A platform whose reach we can't measure is excluded from the mix rather
  // than shown at 0% — the chart is a share of what was measured, and a 0%
  // slice would claim we know it reached nobody.
  const platformMix = {
    reach: reachTotal > 0
      ? platformRows
          .filter(p => p.reach != null && p.reach > 0)
          .map(p => ({ label: p.platform, fraction: (p.reach || 0) / reachTotal }))
          .sort((a, b) => b.fraction - a.fraction)
      : [],
    engagement: engTotal > 0
      ? platformRows
          .filter(p => p.engagements != null && p.engagements > 0)
          .map(p => ({ label: p.platform, fraction: (p.engagements || 0) / engTotal }))
          .sort((a, b) => b.fraction - a.fraction)
      : [],
  };

  // ── Paid vs organic (hand-entered) ──
  const spendRows = await prisma.socialAdSpend.findMany({ where: { clientId, month, year } });
  const paid = buildPaidFacts(spendRows, totals.reach);

  // ── Top posts per platform ──
  //
  // Scoped to each platform's OWN insight row, never the unified totals. A post
  // cross-posted to five networks has five separate PostInsight rows, and the
  // unified figure is their sum — putting that sum on the YouTube slide would
  // report Facebook's and Instagram's engagement as YouTube's, and every
  // platform's slide would show the same number.
  const topPosts: Record<string, TopPost[]> = {};
  for (const platform of REPORT_PLATFORMS) {
    const platAccountIds = new Set(
      accounts.filter(a => a.platform.toLowerCase() === platform).map(a => a.id),
    );

    type Candidate = {
      postedAt: Date | null; views: number; reach: number; engagement: number;
      shares: number; link: string | null; thumbnailUrl: string | null; caption: string | null;
    };
    const candidates: Candidate[] = [];

    for (const p of currentPosts) {
      const dest = (p.destinations || []).find(d => d.platform.toLowerCase() === platform);
      if (!dest) continue;
      // FIX: this platform's real numbers are on an export row, which the loop
      // below adds. The insight row here is the zero-filled placeholder TikTok's
      // API leaves behind, so taking it too entered one video as two candidates —
      // a real one and an all-zero twin competing for the same top-four slots.
      if (mergedPlatformsByPost.get(p.id)?.has(platform)) continue;
      const ins = (p.insights || []).find(i => (i.platform || '').toLowerCase() === platform);
      if (!ins) continue;

      const likes = ins.likes || 0;
      const comments = ins.comments || 0;
      const shares = ins.shares || 0;
      const saved = ins.saved || 0;

      // Thumbnail is the post's first media URL. `mediaUrls` is a JSON column,
      // so it can be null or a non-array — guard before indexing.
      const thumbnailUrl = Array.isArray(p.mediaUrls) ? (p.mediaUrls[0] as string) ?? null : null;

      candidates.push({
        postedAt: p.publishedAt,
        views: ins.views || 0,
        reach: ins.reach || ins.impressions || 0,
        engagement: likes + comments + shares + saved,
        shares,
        link: dest.platformPostUrl || null,
        thumbnailUrl,
        caption: p.caption || null,
      });
    }

    // Natively-published content that only exists in an export (e.g. TikTok
    // videos posted outside the composer) already carries per-platform numbers.
    for (const ip of importedPosts) {
      if (!platAccountIds.has(ip.socialAccountId)) continue;
      const likes = ip.likes || 0;
      const comments = ip.comments || 0;
      const shares = ip.shares || 0;
      candidates.push({
        postedAt: ip.postedAt,
        views: ip.views || 0,
        reach: 0, // exports don't carry reach; ER falls back to views below
        engagement: likes + comments + shares,
        shares,
        link: ip.link || null,
        thumbnailUrl: ip.thumbnailUrl || null,
        caption: ip.title || null,
      });
    }

    topPosts[platform] = candidates
      .sort((a, b) => (b.views || b.reach) - (a.views || a.reach))
      .slice(0, 4)
      .map((c, i) => {
        const base = c.reach || c.views;
        return {
          rank: i + 1,
          postedAt: c.postedAt ? new Date(c.postedAt).toISOString() : null,
          primaryMetric: c.views || c.reach,
          // TikTok leads on shares; the others on total engagement.
          secondaryMetric: platform === 'tiktok' ? c.shares : c.engagement,
          engagementRate: base > 0 ? engagementRate(c.engagement, base) : null,
          link: c.link,
          thumbnailUrl: c.thumbnailUrl,
          caption: c.caption,
        };
      });
  }

  // ── Format performance ──
  const fmtMap = new Map<string, { reach: number; engagement: number; count: number }>();
  for (const p of unified) {
    const platform = (p.destinations || [])[0]?.platform?.toLowerCase() || null;
    const key = formatOf(p.mediaType, platform);
    const cur = fmtMap.get(key) || { reach: 0, engagement: 0, count: 0 };
    cur.reach += p.reach || p.views || 0;
    cur.engagement += p.engagement || 0;
    cur.count += 1;
    fmtMap.set(key, cur);
  }
  const formats: FormatRow[] = Array.from(fmtMap.entries())
    .map(([format, v]) => ({
      format,
      avgReach: v.count > 0 ? Math.round(v.reach / v.count) : 0,
      engagementRate: v.reach > 0 ? engagementRate(v.engagement, v.reach) : null,
      count: v.count,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);

  // ── Best times ──
  // The real audience-activity heatmap when an export provided one; otherwise
  // fall back to engagement on posts we actually published, which is a weaker
  // proxy (it only knows hours we've already tried).
  const activityRows = await prisma.accountActivity.findMany({
    where: { socialAccountId: { in: accountIds } },
  });

  let bestTimes: { weekday: number; hour: number; value: number }[] = [];
  let bestTimesSource: 'audience' | 'posts' | null = null;

  if (activityRows.length > 0) {
    const agg = new Map<string, number>();
    for (const a of activityRows) {
      const k = `${a.weekday}_${a.hour}`;
      agg.set(k, (agg.get(k) || 0) + a.activeFollowers);
    }
    bestTimes = Array.from(agg.entries()).map(([k, value]) => {
      const [weekday, hour] = k.split('_').map(Number);
      return { weekday, hour, value };
    });
    bestTimesSource = 'audience';
  } else if (currentPosts.length > 0) {
    const agg = new Map<string, number>();
    for (const p of currentPosts) {
      if (!p.publishedAt) continue;
      const d = new Date(p.publishedAt);
      // Matches the dashboard's best-times bucketing (social-analytics.routes.ts) —
      // both used to read the day/hour, just one in UTC and one server-local,
      // so the two features could recommend different times from the same data.
      const k = `${d.getDay()}_${d.getHours()}`;
      const eng = (p.insights || []).reduce(
        (s, i) => s + (i.likes || 0) + (i.comments || 0) + (i.shares || 0), 0);
      agg.set(k, (agg.get(k) || 0) + eng);
    }
    bestTimes = Array.from(agg.entries()).map(([k, value]) => {
      const [weekday, hour] = k.split('_').map(Number);
      return { weekday, hour, value };
    });
    bestTimesSource = bestTimes.length > 0 ? 'posts' : null;
  }

  // ── Audience ──
  const demoRows = await prisma.accountDemographic.findMany({
    where: { socialAccountId: { in: accountIds } },
  });
  const byKind = (kind: string) => toShares(demoRows.filter(d => d.kind === kind));

  return {
    client: { id: client.id, name: client.company || client.name },
    period,
    hasAccounts: true,
    totals: { ...totals, followers: followersNow, postCount: unified.length },
    kpis: {
      reach: kpi(totals.reach, prevTotals.reach),
      engagements: kpi(totals.engagement, prevTotals.engagement),
      // No clamping to zero. When per-day follow counts are unavailable the
      // best we have is the net snapshot delta, and a month where the audience
      // shrank must not be reported as "0 new followers" — that reads as a
      // measured flat month rather than the loss it actually was.
      newFollowers: kpi(newFollows ?? (followersNow - followersPrev), prevTotals.newFollows || null),
      engagementRate: kpi(totals.engagementRate, prevTotals.engagementRate),
    },
    trend,
    followerGrowth: {
      points: followerPoints,
      newFollows,
      unfollows,
      netGrowth,
      total: followersNow,
    },
    platforms: platformRows,
    platformMix,
    paid,
    topPosts,
    formats,
    bestTimes,
    bestTimesSource,
    audience: {
      gender: byKind('gender'),
      age: byKind('age'),
      country: byKind('country'),
      city: byKind('city'),
    },
  };
}

function buildPaidFacts(rows: any[], totalReach: number): PaidFacts {
  if (rows.length === 0) {
    return {
      hasData: false, currency: 'USD', spend: 0, paidReach: null, organicReach: null,
      paidSharePct: null, organicSharePct: null, costPerThousand: null, linkClicks: null,
      costPerClick: null, paidEngagement: null, paidEngagementRate: null, messagesStarted: null,
    };
  }

  // Ad-spend currency is a free-text field entered per row, so a client can
  // end up with e.g. Facebook spend logged in USD and TikTok spend in DJF for
  // the same month. Summing across currencies and labeling the total with
  // whichever row happened to be first would produce a number that isn't
  // real in any currency, so only the rows matching the reporting currency
  // (the first row's) are totaled.
  const reportingCurrency = rows[0].currency || 'USD';
  const rowsInReportingCurrency = rows.filter(r => (r.currency || 'USD') === reportingCurrency);

  const spendCents = rowsInReportingCurrency.reduce((s, r) => s + (r.spendCents || 0), 0);
  const spend = centsToMajor(spendCents);
  const sumOrNull = (field: string): number | null => {
    const vals = rowsInReportingCurrency.map(r => r[field]).filter((v): v is number => typeof v === 'number');
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null;
  };

  const paidReach = sumOrNull('paidReach');
  const linkClicks = sumOrNull('linkClicks');
  const paidEngagement = sumOrNull('paidEngagement');

  // Organic reach is only meaningful when total reach actually covers the paid
  // portion; otherwise the two numbers come from different universes and
  // subtracting them would invent a negative.
  const organicReach = paidReach != null && totalReach >= paidReach ? totalReach - paidReach : null;

  return {
    hasData: true,
    currency: reportingCurrency,
    spend,
    paidReach,
    organicReach,
    paidSharePct: paidReach != null && totalReach > 0
      ? parseFloat(((paidReach / totalReach) * 100).toFixed(1)) : null,
    organicSharePct: organicReach != null && totalReach > 0
      ? parseFloat(((organicReach / totalReach) * 100).toFixed(1)) : null,
    costPerThousand: paidReach && paidReach > 0
      ? parseFloat((spend / (paidReach / 1000)).toFixed(2)) : null,
    linkClicks,
    costPerClick: linkClicks && linkClicks > 0
      ? parseFloat((spend / linkClicks).toFixed(2)) : null,
    paidEngagement,
    paidEngagementRate: paidEngagement != null && paidReach && paidReach > 0
      ? engagementRate(paidEngagement, paidReach) : null,
    messagesStarted: sumOrNull('messagesStarted'),
  };
}

function emptyFacts(client: { id: string; name: string; company: string }, period: ReportFacts['period']): ReportFacts {
  const zeroTotals: PeriodTotals = {
    reach: 0, impressions: 0, videoViews: 0, likes: 0, comments: 0, shares: 0,
    saved: 0, engagement: 0, engagementRate: 0, newFollows: 0, unfollows: 0,
  };
  const zeroKpi: KpiFact = { current: 0, previous: null, changePct: null };
  return {
    client: { id: client.id, name: client.company || client.name },
    period,
    hasAccounts: false,
    totals: { ...zeroTotals, followers: 0, postCount: 0 },
    kpis: { reach: zeroKpi, engagements: zeroKpi, newFollowers: zeroKpi, engagementRate: zeroKpi },
    trend: [],
    followerGrowth: { points: [], newFollows: null, unfollows: null, netGrowth: null, total: 0 },
    platforms: [],
    platformMix: { reach: [], engagement: [] },
    paid: buildPaidFacts([], 0),
    topPosts: {},
    formats: [],
    bestTimes: [],
    bestTimesSource: null,
    audience: { gender: [], age: [], country: [], city: [] },
  };
}
