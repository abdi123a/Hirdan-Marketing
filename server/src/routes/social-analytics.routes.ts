import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { collectDailyInsights } from '../lib/social/social-scheduler.js';
import { computeCapabilities, METRIC_AVAILABILITY, type MetricKey } from '../lib/social/metric-availability.js';
import { buildCapabilityGate, engagementRate, pctChange, sumField } from '../lib/social/analytics-core.js';
import { unifyPosts, destinationLink, type AccountMeta } from '../lib/social/post-merge.js';
import { linkedImportedRowsFor, mergeImportedRows } from '../lib/social/post-link.service.js';
import { derivePermalink, tiktokVideoIdOf } from '../lib/social/permalink.service.js';
import { enrichTikTokVideosBatch } from '../lib/social/tiktok-enrich.service.js';
import { logSocialError } from '../lib/social/safe-error.js';
import { callAI, resolveProviderKey } from '../lib/ai-provider.js';

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────
// Definitions shared with the monthly report live in analytics-core so the two
// can't drift apart on what a metric means.
const sum = sumField;
const pct = pctChange;

// FIX (analytics/platform mismatch): a cross-posted SocialPost has one PostInsight
// row per platform destination. Every aggregate below used to sum ALL of a post's
// insight rows regardless of which platform the user had selected in the filter
// dropdown, so picking e.g. "Instagram" still folded in that post's Facebook/X/etc.
// numbers. This scopes a post's insights down to just the selected platform (or
// returns everything when platformFilter is 'ALL').
const scopedInsights = (insights: any[] | undefined, platformFilter: string) => {
  if (!insights) return [];
  if (!platformFilter || platformFilter === 'ALL') return insights;
  return insights.filter(i => (i.platform || '').toUpperCase() === platformFilter);
};

// Same idea for posts themselves: when a platform filter is active, only include
// posts that actually went out to that platform — otherwise a Twitter-only post
// still shows up (with zero matching insights) while the user is looking at
// "Instagram", inflating post counts / content-type counts for the wrong platform.
/**
 * Most posts a single date window will rank before we report truncation.
 * Ranking spans two tables and a computed engagement score, so the window has to
 * be held in memory; this bounds that. It is a safety valve, not a page size —
 * exceeding it is surfaced to the client, never silently dropped.
 */
const WINDOW_ROW_CAP = 2000;

const matchesPlatform = (destinations: any[] | undefined, platformFilter: string) => {
  if (!platformFilter || platformFilter === 'ALL') return true;
  return (destinations || []).some((d: any) => (d.platform || '').toUpperCase() === platformFilter);
};

// ── 1. FULL analytics in one call ──────────────────────────────────────────
router.get('/analytics/:clientId/full', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const platformFilter = (req.query.platform as string || 'ALL').toUpperCase();
    const contentTypeFilter = req.query.contentType as string;
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;

    let since: Date;
    let until: Date;
    let prevSince: Date;
    let days: number;

    if (startDateParam && endDateParam) {
      since = new Date(startDateParam);
      until = new Date(endDateParam);
      // UTC, not server-local time — daily rows are stored in UTC, and the
      // default (non-custom) branch below already computes `until` in UTC.
      until.setUTCHours(23, 59, 59, 999);
      const diffMs = until.getTime() - since.getTime();
      days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      prevSince = new Date(since.getTime() - diffMs);
    } else {
      days = Math.min(parseInt(req.query.days as string) || 30, 365);
      const now = new Date();
      until = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
      since = new Date(until);
      since.setUTCDate(since.getUTCDate() - days);
      prevSince = new Date(since);
      prevSince.setUTCDate(prevSince.getUTCDate() - days);
    }

    // ── Accounts ──
    const accWhere: any = { clientId, isActive: true };
    if (platformFilter !== 'ALL') accWhere.platform = platformFilter.toLowerCase();
    const accounts = await prisma.socialAccount.findMany({ where: accWhere });
    const accountIds = accounts.map(a => a.id);

    if (accounts.length === 0) {
      res.json({ empty: true, accounts: [] });
      return;
    }

    // ── Daily metrics ──
    // Include an upper bound so custom end dates don't pull days after `until`.
    const [rawCurrentMetrics, rawPrevMetrics] = await Promise.all([
      prisma.accountInsightDaily.findMany({
        where: { socialAccountId: { in: accountIds }, date: { gte: since, lte: until } },
        include: { account: { select: { platform: true, displayName: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.accountInsightDaily.findMany({
        where: { socialAccountId: { in: accountIds }, date: { gte: prevSince, lt: since } },
        include: { account: { select: { platform: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    // No fake zeroing. Metric truthfulness is enforced by the capability registry
    // below: a metric no platform in view can report is returned as `null`, never 0.
    const currentMetrics = rawCurrentMetrics;
    const prevMetrics = rawPrevMetrics;

    // ── Capabilities: the single source of truth for what's real in this view ──
    const { caps, importedPlatforms, can, metricPlatformOk, sumMetric } =
      buildCapabilityGate(accounts, platformFilter);
    // Gate a value behind availability so unavailable metrics serialize as null.
    const gate = <T,>(key: MetricKey, value: T): T | null => (can(key) ? value : null);

    // ── Posts (bounded — avoid loading entire history into memory) ──
    // Upper-bounded at `until` too — otherwise a custom historical range (e.g.
    // "last month") kept counting posts published AFTER the range into the
    // KPIs below, while the daily-metrics query above is correctly bounded
    // both ways, so the two disagreed on the same response.
    const postWhere: any = {
      clientId,
      OR: [
        { publishedAt: { gte: prevSince, lte: until } },
        { publishedAt: null, createdAt: { gte: prevSince, lte: until } },
      ],
    };
    if (contentTypeFilter && contentTypeFilter !== 'ALL') postWhere.mediaType = contentTypeFilter;
    const allPosts = await prisma.socialPost.findMany({
      where: postWhere,
      include: {
        insights: true,
        // platformPostUrl + socialAccountId let us build "View on platform"
        // links and match TikTok posts to their imported export rows.
        destinations: {
          select: {
            platform: true, status: true, platformPostId: true,
            platformPostUrl: true, socialAccountId: true, importedPostId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    // FIX: scope posts to the selected platform, same as accounts already are above.
    // Without this, a post published only to a platform other than the one selected
    // in the dropdown still counted toward post totals / content-type breakdowns.
    const platformScopedPosts = allPosts.filter(p => matchesPlatform(p.destinations, platformFilter));

    const publishedPosts = platformScopedPosts.filter(p => p.status === 'PUBLISHED' && p.publishedAt);
    const recentPosts = publishedPosts.filter(p => {
      const d = new Date(p.publishedAt!);
      return d >= since && d <= until;
    });
    const prevPeriodPosts = publishedPosts.filter(p => {
      const d = new Date(p.publishedAt!);
      return d >= prevSince && d < since;
    });

    // Same since..until window as recentPosts, but for ALL statuses — used only
    // by the "Publishing" stats block below, which must reflect the selected
    // period, not the 2x-wide prevSince..until range platformScopedPosts covers
    // (that wider range exists so prevPeriodPosts/prevInsights have data).
    const currentWindowPosts = platformScopedPosts.filter(p => {
      const d = p.publishedAt || p.createdAt;
      return d && new Date(d) >= since && new Date(d) <= until;
    });

    // ── Per-account latest ──
    const accountsWithLatest = await Promise.all(
      accounts.map(async acc => {
        const [latest, before, latestFollowers, beforeFollowers] = await Promise.all([
          prisma.accountInsightDaily.findFirst({ where: { socialAccountId: acc.id }, orderBy: { date: 'desc' } }),
          prisma.accountInsightDaily.findFirst({ where: { socialAccountId: acc.id, date: { lt: since } }, orderBy: { date: 'desc' } }),
          // Followers can be null on rows sourced from files that don't carry them
          // (e.g. a Viewers-only day), so read the latest row that actually has a
          // follower count rather than whichever row happens to be newest.
          prisma.accountInsightDaily.findFirst({ where: { socialAccountId: acc.id, followers: { not: null } }, orderBy: { date: 'desc' } }),
          prisma.accountInsightDaily.findFirst({ where: { socialAccountId: acc.id, followers: { not: null }, date: { lt: since } }, orderBy: { date: 'desc' } }),
        ]);
        return { ...acc, latest, before, latestFollowers, beforeFollowers };
      })
    );

    // ── Imported (export-backed) data — already platform-scoped via accountIds ──
    const [demoRows, activityRows, importedVideos] = await Promise.all([
      prisma.accountDemographic.findMany({ where: { socialAccountId: { in: accountIds } } }),
      prisma.accountActivity.findMany({ where: { socialAccountId: { in: accountIds } } }),
      prisma.importedPost.findMany({
        where: { socialAccountId: { in: accountIds } },
        orderBy: { views: 'desc' },
        take: 500,
      }),
    ]);
    const platformOf = new Map(accounts.map(a => [a.id, a.platform.toLowerCase()]));
    // Account metadata needed to build public post URLs (handles, page ids).
    const accountMeta = new Map<string, AccountMeta>(
      accounts.map(a => [a.id, {
        platform: a.platform.toLowerCase(),
        platformUsername: a.platformUsername,
        pageId: a.pageId,
      }]),
    );

    // One row per real-world post: a TikTok video we published that also appears
    // in an imported export is merged instead of listed (and counted) twice.
    // Rows a post claims by hand are unioned in explicitly: the query above caps
    // at the 500 most-viewed, and a linked video falling outside that page would
    // silently split its group back into two items.
    const { posts: unifiedPosts, mergedCount } = unifyPosts({
      posts: recentPosts,
      imported: mergeImportedRows(importedVideos, await linkedImportedRowsFor(recentPosts)),
      platformFilter,
      accounts: accountMeta,
    });

    // ── KPIs ──
    const currFollowers = accountsWithLatest.reduce((s, a) => s + (a.latestFollowers?.followers || 0), 0);
    const prevFollowers = accountsWithLatest.reduce((s, a) => s + (a.beforeFollowers?.followers || 0), 0);
    const currReach = sumMetric(currentMetrics, 'reach', 'reach');
    const prevReach = sumMetric(prevMetrics, 'reach', 'reach');
    const currImpressions = sumMetric(currentMetrics, 'impressions', 'impressions');
    const prevImpressions = sumMetric(prevMetrics, 'impressions', 'impressions');
    const currVisits = sumMetric(currentMetrics, 'profileVisits', 'profileVisits');
    const prevVisits = sumMetric(prevMetrics, 'profileVisits', 'profileVisits');

    const recentInsights = recentPosts.flatMap(p => scopedInsights(p.insights, platformFilter));
    const prevInsights = prevPeriodPosts.flatMap(p => scopedInsights(p.insights, platformFilter));

    // Engagement combines per-post insights (Facebook/Instagram) with imported
    // daily account totals (TikTok Studio has no per-post API, so its daily
    // likes/comments/shares live on AccountInsightDaily rows). A platform
    // contributes to only one of the two, so there's no double counting.
    const currLikes = sum(recentInsights, 'likes') + sum(currentMetrics, 'likes');
    const currComments = sum(recentInsights, 'comments') + sum(currentMetrics, 'comments');
    const currShares = sum(recentInsights, 'shares') + sum(currentMetrics, 'shares');
    const currSaved = sum(recentInsights, 'saved');
    const currViews = sum(recentInsights, 'views') + sum(currentMetrics, 'videoViews');
    const currEngagement = currLikes + currComments + currShares + currSaved;
    const prevEngagement =
      sum(prevInsights, 'likes') + sum(prevInsights, 'comments') + sum(prevInsights, 'shares') + sum(prevInsights, 'saved') +
      sum(prevMetrics, 'likes') + sum(prevMetrics, 'comments') + sum(prevMetrics, 'shares');
    // One engagement-rate definition everywhere: engagement ÷ reach × 100.
    const currER = currReach > 0 ? parseFloat(((currEngagement / currReach) * 100).toFixed(2)) : 0;
    const prevER = prevReach > 0 ? parseFloat(((prevEngagement / prevReach) * 100).toFixed(2)) : 0;

    // ── Publishing stats (scoped to the selected since..until window, not the
    // wider prevSince..until range platformScopedPosts covers) ──
    const publishing = {
      published: currentWindowPosts.filter(p => p.status === 'PUBLISHED').length,
      scheduled: currentWindowPosts.filter(p => p.status === 'SCHEDULED').length,
      draft: currentWindowPosts.filter(p => p.status === 'DRAFT').length,
      failed: currentWindowPosts.filter(p => p.status === 'FAILED').length,
      pendingApproval: currentWindowPosts.filter(p => p.status === 'AWAITING_APPROVAL').length,
    };
    const totalAttempted = publishing.published + publishing.failed;
    const successRate = totalAttempted > 0 ? parseFloat(((publishing.published / totalAttempted) * 100).toFixed(1)) : 0;

    // Weekly activity.
    // Keyed by year+month+week-of-month, not just week-of-month: bucketing on
    // `W${ceil(day/7)}` alone collapsed "week 1 of July" and "week 1 of August"
    // into a single bar, so any range wider than one month silently summed
    // unrelated weeks together. The sort key keeps the bars chronological, and
    // the label carries the month so two W1s are distinguishable on the chart.
    const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weeklyMap = new Map<string, { week: string; posts: number }>();
    for (const p of publishedPosts) {
      if (!p.publishedAt) continue;
      const d = new Date(p.publishedAt);
      if (d < since || d > until) continue;
      const weekOfMonth = Math.ceil(d.getDate() / 7);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-${weekOfMonth}`;
      const label = `${MONTH_ABBR[d.getMonth()]} W${weekOfMonth}`;
      const bucket = weeklyMap.get(sortKey) || { week: label, posts: 0 };
      bucket.posts += 1;
      weeklyMap.set(sortKey, bucket);
    }
    const weeklyActivity = [...weeklyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    // ── Chart data (by date, aggregated) ──
    const dateMap: Record<string, any> = {};
    for (const m of currentMetrics as any[]) {
      const ds = m.date.toISOString().split('T')[0];
      if (!dateMap[ds]) dateMap[ds] = { date: ds, followers: 0, reach: 0, impressions: 0, profileVisits: 0, videoViews: 0, _eng: 0 };
      dateMap[ds].followers += m.followers || 0;
      dateMap[ds].reach += m.reach || 0;
      dateMap[ds].impressions += m.impressions || 0;
      dateMap[ds].profileVisits += m.profileVisits || 0;
      dateMap[ds].videoViews += m.videoViews || 0;
      dateMap[ds]._eng += (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
    }
    const chartData = Object.values(dateMap)
      .map((d: any) => {
        // Unified engagement-rate definition: engagement ÷ reach × 100.
        d.engagementRate = d.reach > 0 ? parseFloat(((d._eng / d.reach) * 100).toFixed(2)) : 0;
        delete d._eng;
        return d;
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // ── Engagement trend (Full timeline over selected date range) ──
    const engMap: Record<string, any> = {};
    const currDateTracker = new Date(since);
    while (currDateTracker <= until) {
      const ds = currDateTracker.toISOString().split('T')[0];
      engMap[ds] = { date: ds, likes: 0, comments: 0, shares: 0, saved: 0, views: 0, total: 0, score: 0 };
      currDateTracker.setUTCDate(currDateTracker.getUTCDate() + 1);
    }

    // 1. Accumulate per-post engagements for posts published on each date
    for (const p of publishedPosts) {
      if (!p.publishedAt) continue;
      const pDate = new Date(p.publishedAt);
      if (pDate < since || pDate > until) continue;
      const ds = pDate.toISOString().split('T')[0];
      if (!engMap[ds]) engMap[ds] = { date: ds, likes: 0, comments: 0, shares: 0, saved: 0, views: 0, total: 0, score: 0 };
      for (const ins of scopedInsights(p.insights, platformFilter)) {
        engMap[ds].likes += ins.likes || 0;
        engMap[ds].comments += ins.comments || 0;
        engMap[ds].shares += ins.shares || 0;
        engMap[ds].saved += ins.saved || 0;
        engMap[ds].views += ins.views || 0;
      }
    }

    // 2. Accumulate daily account metric engagements for platforms reporting daily totals
    for (const m of currentMetrics as any[]) {
      const ds = m.date.toISOString().split('T')[0];
      if (!engMap[ds]) engMap[ds] = { date: ds, likes: 0, comments: 0, shares: 0, saved: 0, views: 0, total: 0, score: 0 };
      if (metricPlatformOk((m.account?.platform || '').toLowerCase(), 'likes')) engMap[ds].likes += m.likes || 0;
      if (metricPlatformOk((m.account?.platform || '').toLowerCase(), 'comments')) engMap[ds].comments += m.comments || 0;
      if (metricPlatformOk((m.account?.platform || '').toLowerCase(), 'shares')) engMap[ds].shares += m.shares || 0;
      if (metricPlatformOk((m.account?.platform || '').toLowerCase(), 'videoViews')) engMap[ds].views += m.videoViews || 0;
    }

    // 3. Compute derived totals and scores per day
    for (const ds of Object.keys(engMap)) {
      const d = engMap[ds];
      d.total = d.likes + d.comments + d.shares + d.saved;
      d.score = d.likes * 1 + d.comments * 2 + d.shares * 3 + d.saved * 2;
    }

    const engagementTrend = Object.values(engMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // ── Content type performance ──
    // Built from the unified list, so a published-and-then-imported video counts
    // once — previously it was added by both loops, inflating the video bucket.
    const ctMap: Record<string, any> = {};
    for (const p of unifiedPosts) {
      const t = (p.mediaType || 'text').toLowerCase();
      if (!ctMap[t]) ctMap[t] = { type: t, count: 0, reach: 0, engagement: 0, views: 0, saved: 0, impressions: 0 };
      ctMap[t].count += 1;
      ctMap[t].reach += p.reach;
      ctMap[t].engagement += p.engagement;
      ctMap[t].views += p.views;
      ctMap[t].saved += p.saved;
      ctMap[t].impressions += p.impressions;
    }
    const contentTypePerformance = Object.values(ctMap).map((t: any) => ({
      type: t.type, count: t.count,
      avgReach: t.count > 0 ? Math.round(t.reach / t.count) : 0,
      avgEngagement: t.count > 0 ? Math.round(t.engagement / t.count) : 0,
      avgViews: t.count > 0 ? Math.round(t.views / t.count) : 0,
      avgSaved: t.count > 0 ? Math.round(t.saved / t.count) : 0,
      avgImpressions: t.count > 0 ? Math.round(t.impressions / t.count) : 0,
      totalEngagement: t.engagement,
    })).sort((a, b) => b.avgEngagement - a.avgEngagement);

    // ── Best posting times (0=Sun … 6=Sat) ──
    const timeMap: Record<string, any> = {};
    for (const p of publishedPosts) {
      if (!p.publishedAt) continue;
      const d = new Date(p.publishedAt);
      const key = `${d.getDay()}_${d.getHours()}`;
      if (!timeMap[key]) timeMap[key] = { day: d.getDay(), hour: d.getHours(), engagement: 0, posts: 0 };
      timeMap[key].posts += 1;
      for (const ins of scopedInsights(p.insights, platformFilter)) {
        timeMap[key].engagement += (ins.likes || 0) + (ins.comments || 0) + (ins.shares || 0);
      }
    }
    const bestTimes = Object.values(timeMap).sort((a: any, b: any) => b.engagement - a.engagement);

    // ── Platform comparison ──
    const platMap: Record<string, any> = {};
    for (const acc of accountsWithLatest) {
      const p = acc.platform.toLowerCase();
      if (!platMap[p]) platMap[p] = { platform: p, followers: 0, reach: 0, impressions: 0, engagement: 0, posts: 0, growth: 0 };
      platMap[p].followers += acc.latestFollowers?.followers || 0;
      platMap[p].reach += acc.latest?.reach || 0;
      platMap[p].impressions += acc.latest?.impressions || 0;
      const prev = acc.beforeFollowers?.followers || 0;
      const curr = acc.latestFollowers?.followers || 0;
      if (prev > 0) platMap[p].growth = parseFloat(((curr - prev) / prev * 100).toFixed(1));
    }
    for (const p of recentPosts) {
      for (const dest of p.destinations || []) {
        const plat = dest.platform.toLowerCase();
        if (!platMap[plat]) continue;
        platMap[plat].posts += 1;
        // FIX: previously summed ALL of the post's insights here, so a post
        // cross-posted to Facebook + Instagram double-counted BOTH platforms'
        // engagement into EACH platform's bucket. Now only counts the insight
        // row(s) that actually belong to this destination's platform.
        const destInsights = (p.insights || []).filter((i: any) => (i.platform || '').toUpperCase() === dest.platform.toUpperCase());
        for (const ins of destInsights) {
          platMap[plat].engagement += (ins.likes || 0) + (ins.comments || 0) + (ins.shares || 0) + (ins.saved || 0);
        }
      }
    }

    // ── Top posts (published + imported, already merged into one list) ──
    const topPosts = [...unifiedPosts].sort((a, b) => b.engagement - a.engagement).slice(0, 50);

    // ── AI Insights ──
    const DAYS_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ai: string[] = [];
    const followerGrowth = pct(currFollowers, prevFollowers);
    if (followerGrowth > 0) ai.push(`📈 Followers grew **${followerGrowth.toFixed(1)}%** over the last ${days} days.`);
    else if (followerGrowth < 0) ai.push(`⚠️ Followers dropped **${Math.abs(followerGrowth).toFixed(1)}%** — consider increasing posting frequency.`);
    if (currER > prevER && prevER > 0) ai.push(`🔥 Engagement rate improved from **${prevER}%** to **${currER}%** compared to the previous period.`);
    else if (currER < prevER && prevER > 0) ai.push(`💡 Engagement rate dropped from **${prevER}%** to **${currER}%** — experiment with different formats.`);
    const bestType = contentTypePerformance[0];
    if (bestType) ai.push(`🏆 **${bestType.type.charAt(0).toUpperCase() + bestType.type.slice(1)}** content has the highest avg engagement (${bestType.avgEngagement.toLocaleString()} per post).`);
    const bestPlat = Object.values(platMap).sort((a: any, b: any) => b.followers - a.followers)[0] as any;
    if (bestPlat) ai.push(`💼 **${bestPlat.platform.charAt(0).toUpperCase() + bestPlat.platform.slice(1)}** is your largest platform with ${bestPlat.followers.toLocaleString()} followers.`);
    if (bestTimes.length > 0) {
      const top = bestTimes[0] as any;
      const hr12 = top.hour === 0 ? 12 : top.hour > 12 ? top.hour - 12 : top.hour;
      const ampm = top.hour < 12 ? 'AM' : 'PM';
      ai.push(`⏰ Best posting time is **${DAYS_NAME[top.day]} at ${hr12} ${ampm}** based on historical engagement data.`);
    }
    if (publishing.failed > 0) ai.push(`⚠️ **${publishing.failed}** post${publishing.failed > 1 ? 's' : ''} failed to publish — check account connections and token status.`);
    if (currViews > 0) ai.push(`▶️ Your content received **${currViews.toLocaleString()} video views** during this period.`);
    if (successRate < 90 && totalAttempted > 5) ai.push(`📊 Publishing success rate is **${successRate}%** — aim to maintain above 95%.`);
    if (successRate >= 95) ai.push(`✅ Excellent publishing success rate of **${successRate}%** — your scheduler is performing well.`);

    // ── Monthly comparison ──
    const monthlyComparison = {
      current: { followers: currFollowers, reach: currReach, impressions: currImpressions, engagement: currEngagement, posts: recentPosts.length, views: currViews },
      // views mirrors currViews' formula (per-post insights + imported daily
      // video views) — it was missing the daily-row term, so previous-period
      // views (and therefore the growth %) were understated for any client
      // with TikTok import data.
      previous: { followers: prevFollowers, reach: prevReach, impressions: prevImpressions, engagement: prevEngagement, posts: prevPeriodPosts.length, views: sum(prevInsights, 'views') + sum(prevMetrics, 'videoViews') },
    };

    // ── Platform breakdown for pie ──
    const platformBreakdown = Object.values(platMap).map((p: any) => ({
      platform: p.platform, followers: p.followers, reach: p.reach, impressions: p.impressions,
    }));

    // ── Demographics (imported exports) ──
    const demoByKind = (kind: string) => demoRows
      .filter(d => d.kind === kind)
      .map(d => ({ label: d.label, fraction: d.fraction, platform: platformOf.get(d.socialAccountId) || null }))
      .sort((a, b) => b.fraction - a.fraction);
    const demographics = {
      gender: can('demoGender') ? demoByKind('gender') : [],
      country: can('demoCountry') ? demoByKind('country') : [],
      age: can('demoAge') ? demoByKind('age') : [],
    };

    // ── Real active-times heatmap (imported active-followers), preferred over
    // the post-derived bestTimes when present. ──
    const activityHeatmap = can('activity') && activityRows.length
      ? activityRows.map(a => ({ weekday: a.weekday, hour: a.hour, activeFollowers: a.activeFollowers }))
      : [];

    // ── Provenance (import freshness) ──
    const importedAccounts = accountsWithLatest.filter(a => a.lastImportedAt);
    const lastImportedAt = importedAccounts.length
      ? importedAccounts.map(a => a.lastImportedAt!).sort((x, y) => y.getTime() - x.getTime())[0]
      : null;

    // ── KPI builders: gate by capability, guard change/growth without a baseline ──
    const kpi = (key: MetricKey, curr: number, prev: number) => {
      if (!can(key)) return null;
      const hasBase = prev > 0;
      return {
        current: curr,
        previous: hasBase ? prev : null,
        change: hasBase ? curr - prev : null,
        growth: hasBase ? pct(curr, prev) : null,
        isNew: !hasBase,
      };
    };
    const currVideoViews = sumMetric(currentMetrics, 'videoViews', 'videoViews');
    const prevVideoViews = sumMetric(prevMetrics, 'videoViews', 'videoViews');

    // Per-account capability. Import metrics are gated on THIS account having
    // an import, not merely "some tiktok account on the client was imported".
    const metricStatusOf = (
      platform: string,
      key: MetricKey,
      hasImport: boolean,
    ): 'available' | 'locked' | 'unavailable' => {
      const decl = METRIC_AVAILABILITY[platform]?.[key];
      if (decl === 'live') return 'available';
      if (decl === 'import') return hasImport ? 'available' : 'unavailable';
      if (decl === 'scope') return 'locked';
      return 'unavailable';
    };

    // Period totals per account (sum of daily rows in the selected range).
    // Account cards used to show only the latest day's reach/impressions, which
    // made Meta look tiny and hid TikTok Studio import rows once a newer
    // followers-only API row landed on top.
    const periodByAccount = new Map<string, { reach: number; impressions: number; videoViews: number; likes: number; comments: number; shares: number }>();
    for (const row of currentMetrics as any[]) {
      const id = row.socialAccountId as string;
      const cur = periodByAccount.get(id) || { reach: 0, impressions: 0, videoViews: 0, likes: 0, comments: 0, shares: 0 };
      cur.reach += Number(row.reach) || 0;
      cur.impressions += Number(row.impressions) || 0;
      cur.videoViews += Number(row.videoViews) || 0;
      cur.likes += Number(row.likes) || 0;
      cur.comments += Number(row.comments) || 0;
      cur.shares += Number(row.shares) || 0;
      periodByAccount.set(id, cur);
    }

    // ── Response ──
    res.json({
      capabilities: caps,
      // mergedCount = posts we published that were also found in an imported
      // export, and are therefore shown (and counted) once rather than twice.
      provenance: { imported: Array.from(importedPlatforms), lastImportedAt, mergedCount },
      kpis: {
        followers: kpi('followers', currFollowers, prevFollowers),
        reach: kpi('reach', currReach, prevReach),
        impressions: kpi('impressions', currImpressions, prevImpressions),
        profileVisits: kpi('profileVisits', currVisits, prevVisits),
        videoViews: kpi('videoViews', currVideoViews, prevVideoViews),
        engagementRate: can('engagementRate')
          ? { current: currER, previous: prevER, change: parseFloat((currER - prevER).toFixed(2)) }
          : null,
        engagement: {
          likes: can('likes') ? currLikes : null,
          comments: can('comments') ? currComments : null,
          shares: can('shares') ? currShares : null,
          saved: can('saved') ? currSaved : null,
          views: (can('videoViews') || can('views')) ? currViews : null,
          total: currEngagement,
        },
        viewers: can('newReturning')
          ? { new: sum(currentMetrics, 'newViewers'), returning: sum(currentMetrics, 'returningViewers') }
          : null,
        publishing,
      },
      chartData,
      engagementTrend,
      contentTypePerformance,
      bestTimes,
      activityHeatmap,
      demographics,
      platformComparison: Object.values(platMap),
      platformBreakdown,
      topPosts,
      publishing: { ...publishing, successRate, weeklyActivity },
      accounts: accountsWithLatest.map(a => {
        const plat = a.platform.toLowerCase();
        const L: any = a.latest;
        const hasImport = !!a.lastImportedAt;
        const period = periodByAccount.get(a.id) || { reach: 0, impressions: 0, videoViews: 0, likes: 0, comments: 0, shares: 0 };
        const reachStatus = metricStatusOf(plat, 'reach', hasImport);
        const impressionsStatus = metricStatusOf(plat, 'impressions', hasImport);
        const videoViewsStatus = metricStatusOf(plat, 'videoViews', hasImport);
        const engagementStatus = metricStatusOf(plat, 'engagementRate', hasImport);
        const periodEngagement = period.likes + period.comments + period.shares;
        const periodER = period.reach > 0
          ? parseFloat(((periodEngagement / period.reach) * 100).toFixed(2))
          : null;
        return {
          id: a.id, platform: a.platform, displayName: a.displayName, platformUsername: a.platformUsername,
          avatarUrl: a.avatarUrl, healthStatus: a.healthStatus, healthMessage: a.healthMessage, updatedAt: a.updatedAt,
          lastImportedAt: a.lastImportedAt, source: a.lastImportedAt ? 'import' : 'api',
          metricStatus: {
            reach: reachStatus,
            impressions: impressionsStatus,
            videoViews: videoViewsStatus,
          },
          // followers = latest live count; reach/impressions = sum over selected period
          latestMetrics: {
            followers: a.latestFollowers?.followers ?? null,
            reach: reachStatus === 'available' ? period.reach : null,
            impressions: impressionsStatus === 'available' ? period.impressions : null,
            profileVisits: metricStatusOf(plat, 'profileVisits', hasImport) === 'available'
              ? (L?.profileVisits ?? null)
              : null,
            videoViews: videoViewsStatus === 'available' ? period.videoViews : null,
            engagementRate: engagementStatus === 'available' ? periodER : null,
            date: L?.date ?? null,
            periodDays: days,
          },
        };
      }),
      monthlyComparison,
      aiInsights: ai,
    });
  } catch (err) {
    next(err);
  }
});

// ── 2. Paginated top posts (for Content tab) ────────────────────────────────
router.get('/analytics/:clientId/posts', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params as { clientId: string };
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || 'engagement';
    const platform = req.query.platform as string;
    const contentType = req.query.contentType as string;
    const search = req.query.search as string;
    const startDateParam = req.query.startDate as string | undefined;
    const endDateParam = req.query.endDate as string | undefined;

    let since: Date;
    let until: Date;

    if (startDateParam && endDateParam) {
      since = new Date(startDateParam);
      until = new Date(endDateParam);
      // UTC, not server-local time — matches the /full endpoint and the UTC
      // storage of daily rows, so the same range returns the same posts.
      until.setUTCHours(23, 59, 59, 999);
    } else {
      const days = parseInt(req.query.days as string) || 30;
      const now = new Date();
      until = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
      since = new Date(until);
      since.setUTCDate(since.getUTCDate() - days);
    }

    const where: any = { clientId, status: 'PUBLISHED' };
    if (contentType && contentType !== 'ALL') where.mediaType = contentType;
    // `mode: 'insensitive'` is a PostgreSQL-only Prisma filter option — passing
    // it on this MySQL connection throws PrismaClientValidationError, so ANY
    // non-empty search term 500'd. MySQL's default collation is already
    // case-insensitive, so `contains` alone behaves the same way.
    if (search) where.caption = { contains: search };
    // The date window belongs in the query, not in a post-hoc JS filter. It used
    // to take the 500 most recent posts and only THEN drop the ones outside the
    // window — so a client with more than 500 published posts got an empty or
    // partial result for any older range, with no indication anything was
    // missing. With the window in SQL, the cap below only ever bites on a single
    // window that genuinely holds more posts than the cap.
    where.publishedAt = { gte: since, lte: until };

    const posts = await prisma.socialPost.findMany({
      where,
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
      // Ranking is by computed engagement across two tables (scheduled posts and
      // imported rows), so the window has to be materialised before it can be
      // sorted and sliced — it cannot be paged in SQL. Fetch one row past the cap
      // purely to detect truncation and report it instead of silently dropping.
      take: WINDOW_ROW_CAP + 1,
    });

    const truncated = posts.length > WINDOW_ROW_CAP;
    if (truncated) posts.length = WINDOW_ROW_CAP;

    const platformFilter = (platform || 'ALL').toUpperCase();
    const inWindow = posts.filter(p => matchesPlatform(p.destinations, platformFilter));

    // Imported native videos (TikTok Studio). A curated top set — included
    // regardless of the day window, but honoring platform / content-type / search.
    const accts = await prisma.socialAccount.findMany({
      where: { clientId, isActive: true },
      select: { id: true, platform: true, platformUsername: true, pageId: true },
    });
    const accountMeta = new Map<string, AccountMeta>(
      accts.map(a => [a.id, { platform: a.platform.toLowerCase(), platformUsername: a.platformUsername, pageId: a.pageId }]),
    );

    let importedRows: any[] = [];
    if (!contentType || contentType === 'ALL' || contentType === 'video') {
      const eligibleIds = accts
        .filter(a => platformFilter === 'ALL' || a.platform.toUpperCase() === platformFilter)
        .map(a => a.id);
      if (eligibleIds.length) {
        const vids = await prisma.importedPost.findMany({
          where: { socialAccountId: { in: eligibleIds } },
          orderBy: { views: 'desc' },
          take: 500,
        });
        importedRows = vids.filter(v => !search || (v.title || '').toLowerCase().includes(search.toLowerCase()));
      }
    }

    // Merge the two sources so a video that was published through the system and
    // then imported appears once, carrying both its identity and its real metrics.
    // Linked rows are unioned in regardless of the content-type and search
    // filters above: those filters decide which posts are listed, and once a post
    // is listed it must carry all of its platforms' numbers.
    const { posts: unified } = unifyPosts({
      posts: inWindow,
      imported: mergeImportedRows(importedRows, await linkedImportedRowsFor(inWindow)),
      platformFilter,
      accounts: accountMeta,
    });
    const withScores: any[] = unified.map(p => ({ ...p, clientId, status: 'PUBLISHED' }));

    if (sortBy === 'likes') withScores.sort((a, b) => b.likes - a.likes);
    else if (sortBy === 'views') withScores.sort((a, b) => b.views - a.views);
    else if (sortBy === 'oldest') withScores.sort((a, b) => new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime());
    else if (sortBy === 'newest') withScores.sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());
    else withScores.sort((a, b) => b.engagement - a.engagement);

    const total = withScores.length;
    const paged = withScores.slice(skip, skip + limit);
    // `truncated` tells the client the window held more posts than we ranked, so
    // the UI can say so rather than presenting a short list as if it were whole.
    res.json({ posts: paged, total, page, limit, truncated, rowCap: WINDOW_ROW_CAP });
  } catch (err) {
    next(err);
  }
});

// ── 3. One post's full detail (powers the post detail panel) ────────────────
//
// Accepts either a SocialPost id or the "imported:<id>" form the lists emit for
// export-only content, and answers with a per-platform metric breakdown plus the
// public link to open the real post.
router.get('/analytics/post/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };

    // ── Export-only content ──
    if (id.startsWith('imported:')) {
      const row = await prisma.importedPost.findUnique({
        where: { id: id.slice('imported:'.length) },
        include: { account: true },
      });
      if (!row) { res.status(404).json({ error: 'Post not found' }); return; }

      const platform = row.account.platform.toLowerCase();
      const likes = row.likes || 0, comments = row.comments || 0, shares = row.shares || 0, views = row.views || 0;
      const engagement = likes + comments + shares;
      const link = row.link
        || derivePermalink(platform, row.externalId, { platformUsername: row.account.platformUsername });

      res.json({
        id,
        caption: row.title || '',
        mediaUrls: null,
        mediaType: 'video',
        publishedAt: row.postedAt,
        source: 'imported',
        link,
        totals: {
          likes, comments, shares, saved: 0, views, reach: 0, impressions: 0,
          engagement,
          engagementRate: views > 0 ? parseFloat(((engagement / views) * 100).toFixed(2)) : 0,
        },
        breakdown: [{
          platform,
          accountName: row.account.displayName,
          accountHandle: row.account.platformUsername,
          status: 'PUBLISHED',
          link,
          source: 'import',
          updatedAt: row.importedAt,
          metrics: { likes, comments, shares, saved: null, views, reach: null, impressions: null },
        }],
        provenance: { source: 'import', lastImportedAt: row.account.lastImportedAt },
      });
      return;
    }

    // ── Content we published (possibly enriched by an import) ──
    const post = await prisma.socialPost.findUnique({
      where: { id },
      include: {
        insights: true,
        destinations: { include: { socialAccount: true } },
      },
    });
    if (!post) { res.status(404).json({ error: 'Post not found' }); return; }

    const accountMeta = new Map<string, AccountMeta>(
      post.destinations.map(d => [d.socialAccountId, {
        platform: d.socialAccount.platform.toLowerCase(),
        platformUsername: d.socialAccount.platformUsername,
        pageId: d.socialAccount.pageId,
      }]),
    );

    // Pull in any export rows for this post's TikTok destinations.
    const accountIds = post.destinations.map(d => d.socialAccountId);
    const importedRows = accountIds.length
      ? await prisma.importedPost.findMany({
          where: { socialAccountId: { in: accountIds } },
          orderBy: { importedAt: 'desc' },
          take: 2000,
        })
      : [];

    const allImported = mergeImportedRows(importedRows, await linkedImportedRowsFor([post]));

    const { posts: [unifiedPost] } = unifyPosts({
      posts: [post],
      imported: allImported,
      platformFilter: 'ALL',
      accounts: accountMeta,
    });

    // Per-destination breakdown: export numbers where they exist for that
    // platform, live insight numbers otherwise.
    const importedByExternalId = new Map(allImported.map(r => [String(r.externalId), r]));
    const importedById = new Map(allImported.map(r => [String(r.id), r]));
    const breakdown = post.destinations.map(d => {
      const platform = d.platform.toLowerCase();
      const videoId = tiktokVideoIdOf(d);
      // A destination the user linked by hand names its export row outright.
      const imp = d.importedPostId
        ? importedById.get(String(d.importedPostId))
        : (videoId ? importedByExternalId.get(videoId) : undefined);
      const ins = post.insights.find(i => (i.platform || '').toUpperCase() === d.platform.toUpperCase());

      return {
        platform,
        accountName: d.socialAccount.displayName,
        accountHandle: d.socialAccount.platformUsername,
        status: d.status,
        link: destinationLink(d, accountMeta),
        source: imp ? 'import' : 'api',
        updatedAt: imp ? imp.importedAt : (ins?.fetchedAt ?? d.publishedAt),
        error: d.lastError,
        // Present only on a destination the user attached to this group by hand.
        destinationId: d.id,
        linkedImportedPostId: d.importedPostId ?? null,
        metrics: imp
          ? { likes: imp.likes, comments: imp.comments, shares: imp.shares, saved: null, views: imp.views, reach: null, impressions: null }
          : {
              likes: ins?.likes ?? null, comments: ins?.comments ?? null, shares: ins?.shares ?? null,
              saved: ins?.saved ?? null, views: ins?.views ?? null, reach: ins?.reach ?? null,
              impressions: ins?.impressions ?? null,
            },
      };
    });

    res.json({
      id: post.id,
      caption: post.caption,
      mediaUrls: post.mediaUrls,
      mediaType: post.mediaType,
      publishedAt: post.publishedAt,
      scheduledFor: post.scheduledFor,
      status: post.status,
      source: unifiedPost?.source ?? 'scheduled',
      link: unifiedPost?.link ?? null,
      totals: {
        likes: unifiedPost?.likes ?? 0, comments: unifiedPost?.comments ?? 0,
        shares: unifiedPost?.shares ?? 0, saved: unifiedPost?.saved ?? 0,
        views: unifiedPost?.views ?? 0, reach: unifiedPost?.reach ?? 0,
        impressions: unifiedPost?.impressions ?? 0,
        engagement: unifiedPost?.engagement ?? 0,
        engagementRate: unifiedPost?.engagementRate ?? 0,
      },
      breakdown,
      provenance: { source: unifiedPost?.source ?? 'scheduled' },
    });
  } catch (err) {
    next(err);
  }
});

// ── 4. Force sync from platform APIs ─────────────────────────────────────
router.post('/analytics/:clientId/refresh', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params as { clientId: string };
    // Scope sync to this client — previously refreshed every account in the DB,
    // which was slow and made client-specific failures hard to see.
    const insightsResult = await collectDailyInsights(clientId);

    // Enrich thumbnails & verify TikTok imported posts for this client
    const tiktokAccounts = await prisma.socialAccount.findMany({
      where: { clientId, platform: 'tiktok' },
      select: { id: true },
    });

    for (const acc of tiktokAccounts) {
      await enrichTikTokVideosBatch(acc.id).catch((err) => {
        logSocialError(`TikTok video enrichment error for account ${acc.id}`, err);
      });
    }

    // Every account sync failed — this used to still answer "successfully
    // refreshed" even when nothing was actually fetched, so a totally stale
    // dashboard looked freshly synced.
    if (insightsResult.accountsTotal > 0 && insightsResult.accountErrors === insightsResult.accountsTotal) {
      res.status(502).json({
        success: false,
        message: `Sync failed for all ${insightsResult.accountsTotal} connected account(s) — check account connections and try again.`,
      });
      return;
    }

    if (insightsResult.accountErrors > 0 || insightsResult.postInsightErrors > 0) {
      res.json({
        success: true,
        partial: true,
        message: `Synced with some failures: ${insightsResult.accountErrors} of ${insightsResult.accountsTotal} account(s) and ${insightsResult.postInsightErrors} post(s) could not be refreshed.`,
      });
      return;
    }

    res.json({ success: true, message: 'Analytics and video thumbnails successfully refreshed' });
  } catch (err) {
    next(err);
  }
});

// ── AI insights ────────────────────────────────────────────────────────────
// The panel used to be called "AI Insights" while rendering hand-written
// template sentences. Those sentences are still computed in /full and returned
// as `aiInsights` — they are real, data-driven analysis and make a good
// fallback — but this endpoint is what actually puts a model behind the label.
//
// On-demand (only when the tab is opened) and cached, because running an LLM on
// every analytics page load would be slow and expensive for no added insight.
const insightsCache = new Map<string, { at: number; insights: string[] }>();
const INSIGHTS_TTL_MS = 24 * 60 * 60 * 1000;
const INSIGHTS_CACHE_MAX = 200;

router.post('/analytics/:clientId/insights', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { facts, days, platform } = req.body ?? {};
    if (!facts || typeof facts !== 'object') {
      res.status(400).json({ error: 'Missing analytics facts' });
      return;
    }

    const client = await prisma.client.findUnique({ where: { id: clientId as string }, select: { name: true, company: true } });
    if (!client) { res.status(404).json({ error: 'Client not found' }); return; }

    const cacheKey = `${clientId}:${days ?? ''}:${platform ?? ''}:${new Date().toISOString().slice(0, 10)}`;
    const hit = insightsCache.get(cacheKey);
    if (hit && Date.now() - hit.at < INSIGHTS_TTL_MS) {
      res.json({ insights: hit.insights, cached: true, source: 'ai' });
      return;
    }

    const settings = await prisma.agencySettings.findFirst();
    const { provider, apiKey } = settings
      ? resolveProviderKey(settings)
      : { provider: 'openai' as const, apiKey: '' };
    if (!apiKey) {
      // Not an error state for the user — the deterministic insights already on
      // screen stay, and we say plainly why nothing smarter appeared.
      res.json({ insights: [], source: 'unavailable', reason: 'No AI provider API key is configured in Agency Settings.' });
      return;
    }

    const aiRes = await callAI(provider, apiKey, [
      {
        role: 'system',
        content:
          'You are a social media analyst at a marketing agency. You will be given a JSON summary of one ' +
          'client\'s social performance. Write 4-6 short, specific observations and recommendations. ' +
          'Rules: cite the actual numbers you were given; never invent a metric that is not present; ' +
          'lead with what changed and what to do about it; no preamble, no headings, no markdown. ' +
          'Return one observation per line, each starting with "- ".',
      },
      {
        role: 'user',
        content: `Client: ${client.company || client.name}\nWindow: last ${days ?? 30} days\nPlatform filter: ${platform ?? 'ALL'}\n\nAnalytics summary:\n${JSON.stringify(facts).slice(0, 12000)}`,
      },
    ]);

    const insights = String(aiRes.content || '')
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 8);

    if (insights.length > 0) {
      // Bound the cache so a long-running server cannot grow it without limit.
      if (insightsCache.size >= INSIGHTS_CACHE_MAX) {
        const oldest = [...insightsCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (oldest) insightsCache.delete(oldest[0]);
      }
      insightsCache.set(cacheKey, { at: Date.now(), insights });
    }

    res.json({ insights, cached: false, source: 'ai' });
  } catch (err) {
    next(err);
  }
});

export default router;
