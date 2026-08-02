import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { collectDailyInsights } from '../lib/social/social-scheduler.js';
import { computeCapabilities, METRIC_AVAILABILITY, type MetricKey } from '../lib/social/metric-availability.js';
import { unifyPosts, destinationLink, type AccountMeta } from '../lib/social/post-merge.js';
import { derivePermalink, tiktokVideoIdOf } from '../lib/social/permalink.service.js';
import { enrichTikTokVideosBatch } from '../lib/social/tiktok-enrich.service.js';

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────
const sum = (arr: any[], field: string) =>
  arr.reduce((s: number, i: any) => s + (Number(i[field]) || 0), 0);

const pct = (curr: number, prev: number) =>
  prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(2)) : 0;

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
      until.setHours(23, 59, 59, 999);
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
    const activePlatforms = platformFilter !== 'ALL'
      ? [platformFilter.toLowerCase()]
      : Array.from(new Set(accounts.map(a => a.platform.toLowerCase())));
    const importedPlatforms = new Set(
      accounts.filter(a => a.lastImportedAt).map(a => a.platform.toLowerCase()),
    );
    const caps = computeCapabilities(activePlatforms, importedPlatforms);
    const can = (key: MetricKey) => caps.metrics[key]?.status === 'available';
    // Gate a value behind availability so unavailable metrics serialize as null.
    const gate = <T,>(key: MetricKey, value: T): T | null => (can(key) ? value : null);

    // A metric only counts toward an aggregate for platforms that can genuinely
    // report it (live now, or import with data present). Without this, seed/demo
    // or unsupported-platform values (e.g. LinkedIn/YouTube reach, which those
    // APIs don't provide) inflate the totals and make the report disagree with
    // the truthful per-account cards.
    const metricPlatformOk = (platform: string, key: MetricKey): boolean => {
      const decl = METRIC_AVAILABILITY[platform]?.[key];
      if (decl === 'live') return true;
      if (decl === 'import') return importedPlatforms.has(platform);
      return false;
    };
    const sumMetric = (rows: any[], field: string, key: MetricKey) =>
      rows.reduce((s, r) => s + (metricPlatformOk((r.account?.platform || '').toLowerCase(), key) ? (Number(r[field]) || 0) : 0), 0);

    // ── Posts ──
    const postWhere: any = { clientId };
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
            platformPostUrl: true, socialAccountId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // FIX: scope posts to the selected platform, same as accounts already are above.
    // Without this, a post published only to a platform other than the one selected
    // in the dropdown still counted toward post totals / content-type breakdowns.
    const platformScopedPosts = allPosts.filter(p => matchesPlatform(p.destinations, platformFilter));

    const publishedPosts = platformScopedPosts.filter(p => p.status === 'PUBLISHED' && p.publishedAt);
    const recentPosts = publishedPosts.filter(p => new Date(p.publishedAt!) >= since);
    const prevPeriodPosts = publishedPosts.filter(p => {
      const d = new Date(p.publishedAt!);
      return d >= prevSince && d < since;
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
      prisma.importedPost.findMany({ where: { socialAccountId: { in: accountIds } }, orderBy: { views: 'desc' } }),
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
    const { posts: unifiedPosts, mergedCount } = unifyPosts({
      posts: recentPosts,
      imported: importedVideos,
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

    // ── Publishing stats ──
    const publishing = {
      published: platformScopedPosts.filter(p => p.status === 'PUBLISHED').length,
      scheduled: platformScopedPosts.filter(p => p.status === 'SCHEDULED').length,
      draft: platformScopedPosts.filter(p => p.status === 'DRAFT').length,
      failed: platformScopedPosts.filter(p => p.status === 'FAILED').length,
      pendingApproval: platformScopedPosts.filter(p => p.status === 'AWAITING_APPROVAL').length,
    };
    const totalAttempted = publishing.published + publishing.failed;
    const successRate = totalAttempted > 0 ? parseFloat(((publishing.published / totalAttempted) * 100).toFixed(1)) : 0;

    // Weekly activity
    const weeklyMap: Record<string, number> = {};
    for (const p of publishedPosts) {
      if (!p.publishedAt || new Date(p.publishedAt) < since) continue;
      const d = new Date(p.publishedAt);
      const wk = `W${Math.ceil(d.getDate() / 7)}`;
      weeklyMap[wk] = (weeklyMap[wk] || 0) + 1;
    }
    const weeklyActivity = Object.entries(weeklyMap).map(([week, posts]) => ({ week, posts }));

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
      previous: { followers: prevFollowers, reach: prevReach, impressions: prevImpressions, engagement: prevEngagement, posts: prevPeriodPosts.length, views: sum(prevInsights, 'views') },
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
      until.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(req.query.days as string) || 30;
      const now = new Date();
      until = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
      since = new Date(until);
      since.setUTCDate(since.getUTCDate() - days);
    }

    const where: any = { clientId, status: 'PUBLISHED' };
    if (contentType && contentType !== 'ALL') where.mediaType = contentType;
    if (search) where.caption = { contains: search, mode: 'insensitive' };

    const posts = await prisma.socialPost.findMany({
      where,
      include: {
        insights: true,
        destinations: {
          select: {
            platform: true, status: true, platformPostId: true,
            platformPostUrl: true, socialAccountId: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500, // fetch all then sort
    });

    const platformFilter = (platform || 'ALL').toUpperCase();
    const inWindow = posts
      .filter(p => p.publishedAt && new Date(p.publishedAt) >= since && new Date(p.publishedAt) <= until)
      .filter(p => matchesPlatform(p.destinations, platformFilter));

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
        const vids = await prisma.importedPost.findMany({ where: { socialAccountId: { in: eligibleIds } } });
        importedRows = vids.filter(v => !search || (v.title || '').toLowerCase().includes(search.toLowerCase()));
      }
    }

    // Merge the two sources so a video that was published through the system and
    // then imported appears once, carrying both its identity and its real metrics.
    const { posts: unified } = unifyPosts({
      posts: inWindow,
      imported: importedRows,
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
    res.json({ posts: paged, total, page, limit });
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
      ? await prisma.importedPost.findMany({ where: { socialAccountId: { in: accountIds } } })
      : [];

    const { posts: [unifiedPost] } = unifyPosts({
      posts: [post],
      imported: importedRows,
      platformFilter: 'ALL',
      accounts: accountMeta,
    });

    // Per-destination breakdown: export numbers where they exist for that
    // platform, live insight numbers otherwise.
    const importedByExternalId = new Map(importedRows.map(r => [String(r.externalId), r]));
    const breakdown = post.destinations.map(d => {
      const platform = d.platform.toLowerCase();
      const videoId = tiktokVideoIdOf(d);
      const imp = videoId ? importedByExternalId.get(videoId) : undefined;
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
    await collectDailyInsights(clientId);

    // Enrich thumbnails & verify TikTok imported posts for this client
    const tiktokAccounts = await prisma.socialAccount.findMany({
      where: { clientId, platform: 'tiktok' },
      select: { id: true },
    });

    for (const acc of tiktokAccounts) {
      await enrichTikTokVideosBatch(acc.id).catch((err) => {
        console.warn(`TikTok video enrichment error for account ${acc.id}:`, err);
      });
    }

    res.json({ success: true, message: 'Analytics and video thumbnails successfully refreshed' });
  } catch (err) {
    next(err);
  }
});

export default router;
