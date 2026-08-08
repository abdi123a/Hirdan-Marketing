// Shared analytics primitives.
//
// The dashboard route and the monthly report both roll daily rows up into
// period totals. These helpers hold the rules they must agree on — which
// platforms may contribute to which metric, and how engagement rate is defined —
// so the report can never quote a different number than the dashboard for the
// same period.

import { prisma } from '../prisma.js';
import { computeCapabilities, METRIC_AVAILABILITY, type MetricKey, type Capabilities } from './metric-availability.js';

export const sumField = (rows: any[], field: string): number =>
  rows.reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);

export const pctChange = (curr: number, prev: number): number =>
  prev > 0 ? parseFloat((((curr - prev) / prev) * 100).toFixed(2)) : 0;

/** The one engagement-rate definition: engagement ÷ reach × 100. */
export const engagementRate = (engagement: number, reach: number): number =>
  reach > 0 ? parseFloat(((engagement / reach) * 100).toFixed(2)) : 0;

export interface CapabilityGate {
  caps: Capabilities;
  importedPlatforms: Set<string>;
  /** Is this metric available anywhere in the current view? */
  can: (key: MetricKey) => boolean;
  /** May this specific platform contribute to this metric's total? */
  metricPlatformOk: (platform: string, key: MetricKey) => boolean;
  /** Sum a field across daily rows, counting only platforms that can report it. */
  sumMetric: (rows: any[], field: string, key: MetricKey) => number;
}

/**
 * Build the capability gate for a set of accounts.
 *
 * A metric only counts toward an aggregate for platforms that can genuinely
 * report it (live now, or import with data present). Without this, values from
 * platforms whose APIs don't provide the metric inflate the totals and make the
 * report disagree with the truthful per-account figures.
 */
export function buildCapabilityGate(
  accounts: { platform: string; lastImportedAt: Date | null }[],
  platformFilter = 'ALL',
): CapabilityGate {
  const activePlatforms = platformFilter !== 'ALL'
    ? [platformFilter.toLowerCase()]
    : Array.from(new Set(accounts.map(a => a.platform.toLowerCase())));

  const importedPlatforms = new Set(
    accounts.filter(a => a.lastImportedAt).map(a => a.platform.toLowerCase()),
  );

  const caps = computeCapabilities(activePlatforms, importedPlatforms);
  const can = (key: MetricKey) => caps.metrics[key]?.status === 'available';

  const metricPlatformOk = (platform: string, key: MetricKey): boolean => {
    const decl = METRIC_AVAILABILITY[platform]?.[key];
    if (decl === 'live') return true;
    if (decl === 'import') return importedPlatforms.has(platform);
    return false;
  };

  const sumMetric = (rows: any[], field: string, key: MetricKey) =>
    rows.reduce(
      (s, r) => s + (metricPlatformOk((r.account?.platform || '').toLowerCase(), key) ? (Number(r[field]) || 0) : 0),
      0,
    );

  return { caps, importedPlatforms, can, metricPlatformOk, sumMetric };
}

/** Inclusive UTC bounds for a calendar month (month is 1-12). */
export function monthBounds(month: number, year: number): { since: Date; until: Date } {
  const since = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const until = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { since, until };
}

export interface PeriodTotals {
  reach: number;
  impressions: number;
  videoViews: number;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  engagement: number;
  engagementRate: number;
  newFollows: number;
  unfollows: number;
}

/**
 * Roll a window's daily rows and per-post insight rows into period totals.
 *
 * Engagement deliberately combines two disjoint sources: per-post insights
 * (platforms with a per-post API, e.g. Meta) and daily account totals (platforms
 * without one, e.g. TikTok, whose numbers only arrive via import). A platform
 * feeds exactly one of the two, so nothing is counted twice.
 */
export function periodTotals(
  dailyRows: any[],
  postInsights: any[],
  gate: CapabilityGate,
): PeriodTotals {
  const reach = gate.sumMetric(dailyRows, 'reach', 'reach');
  const impressions = gate.sumMetric(dailyRows, 'impressions', 'impressions');
  const videoViews = gate.sumMetric(dailyRows, 'videoViews', 'videoViews');

  const likes = sumField(postInsights, 'likes') + sumField(dailyRows, 'likes');
  const comments = sumField(postInsights, 'comments') + sumField(dailyRows, 'comments');
  const shares = sumField(postInsights, 'shares') + sumField(dailyRows, 'shares');
  const saved = sumField(postInsights, 'saved');

  const engagement = likes + comments + shares + saved;

  return {
    reach,
    impressions,
    videoViews,
    likes,
    comments,
    shares,
    saved,
    engagement,
    engagementRate: engagementRate(engagement, reach),
    newFollows: sumField(dailyRows, 'newFollows'),
    unfollows: sumField(dailyRows, 'unfollows'),
  };
}

/** Daily insight rows for a set of accounts within a window, with platform attached. */
export function fetchDailyRows(accountIds: string[], since: Date, until: Date) {
  return prisma.accountInsightDaily.findMany({
    where: { socialAccountId: { in: accountIds }, date: { gte: since, lte: until } },
    include: { account: { select: { platform: true, displayName: true } } },
    orderBy: { date: 'asc' },
  });
}

/**
 * Total followers across accounts as of a moment.
 *
 * Reads the latest row that actually carries a follower count rather than
 * whichever row is newest — imports of files without a follower column (a
 * viewers-only day) would otherwise shadow the real number with a null.
 */
export async function followersAsOf(accountIds: string[], asOf: Date): Promise<number> {
  const rows = await Promise.all(
    accountIds.map(id =>
      prisma.accountInsightDaily.findFirst({
        where: { socialAccountId: id, followers: { not: null }, date: { lte: asOf } },
        orderBy: { date: 'desc' },
        select: { followers: true },
      }),
    ),
  );
  return rows.reduce((s, r) => s + (r?.followers || 0), 0);
}
