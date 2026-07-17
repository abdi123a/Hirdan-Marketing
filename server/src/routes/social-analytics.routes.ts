import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { collectDailyInsights } from '../lib/social/social-scheduler.js';

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
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const platformFilter = (req.query.platform as string || 'ALL').toUpperCase();
    const contentTypeFilter = req.query.contentType as string;

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const since = new Date(todayUTC);
    since.setUTCDate(since.getUTCDate() - days);
    const prevSince = new Date(since);
    prevSince.setUTCDate(prevSince.getUTCDate() - days);

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
    const [rawCurrentMetrics, rawPrevMetrics] = await Promise.all([
      prisma.accountInsightDaily.findMany({
        where: { socialAccountId: { in: accountIds }, date: { gte: since } },
        include: { account: { select: { platform: true, displayName: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.accountInsightDaily.findMany({
        where: { socialAccountId: { in: accountIds }, date: { gte: prevSince, lt: since } },
        include: { account: { select: { platform: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const cleanMetric = (m: any) => {
      const plat = (m.account?.platform || '').toLowerCase();
      if (['facebook', 'instagram', 'youtube'].includes(plat)) {
        return { ...m, profileVisits: 0 };
      }
      return m;
    };

    const currentMetrics = rawCurrentMetrics.map(cleanMetric);
    const prevMetrics = rawPrevMetrics.map(cleanMetric);

    // ── Posts ──
    const postWhere: any = { clientId };
    if (contentTypeFilter && contentTypeFilter !== 'ALL') postWhere.mediaType = contentTypeFilter;
    const allPosts = await prisma.socialPost.findMany({
      where: postWhere,
      include: {
        insights: true,
        destinations: { select: { platform: true, status: true, platformPostId: true } },
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
        const [latest, before] = await Promise.all([
          prisma.accountInsightDaily.findFirst({ where: { socialAccountId: acc.id }, orderBy: { date: 'desc' } }),
          prisma.accountInsightDaily.findFirst({ where: { socialAccountId: acc.id, date: { lt: since } }, orderBy: { date: 'desc' } }),
        ]);
        return { ...acc, latest, before };
      })
    );

    // ── KPIs ──
    const currFollowers = accountsWithLatest.reduce((s, a) => s + (a.latest?.followers || 0), 0);
    const prevFollowers = accountsWithLatest.reduce((s, a) => s + (a.before?.followers || 0), 0);
    const currReach = sum(currentMetrics, 'reach');
    const prevReach = sum(prevMetrics, 'reach');
    const currImpressions = sum(currentMetrics, 'impressions');
    const prevImpressions = sum(prevMetrics, 'impressions');
    const currVisits = sum(currentMetrics, 'profileVisits');
    const prevVisits = sum(prevMetrics, 'profileVisits');

    const recentInsights = recentPosts.flatMap(p => scopedInsights(p.insights, platformFilter));
    const prevInsights = prevPeriodPosts.flatMap(p => scopedInsights(p.insights, platformFilter));

    const currLikes = sum(recentInsights, 'likes');
    const currComments = sum(recentInsights, 'comments');
    const currShares = sum(recentInsights, 'shares');
    const currSaved = sum(recentInsights, 'saved');
    const currViews = sum(recentInsights, 'views');
    const currEngagement = currLikes + currComments + currShares + currSaved;
    const prevEngagement = sum(prevInsights, 'likes') + sum(prevInsights, 'comments') + sum(prevInsights, 'shares') + sum(prevInsights, 'saved');
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
    for (const m of currentMetrics) {
      const ds = m.date.toISOString().split('T')[0];
      if (!dateMap[ds]) dateMap[ds] = { date: ds, followers: 0, reach: 0, impressions: 0, profileVisits: 0, engagementRate: 0, _n: 0 };
      dateMap[ds].followers += m.followers || 0;
      dateMap[ds].reach += m.reach || 0;
      dateMap[ds].impressions += m.impressions || 0;
      dateMap[ds].profileVisits += m.profileVisits || 0;
      dateMap[ds].engagementRate += Number(m.engagementRate) || 0;
      dateMap[ds]._n += 1;
    }
    const chartData = Object.values(dateMap)
      .map((d: any) => {
        d.engagementRate = d.followers > 0
          ? parseFloat(((d.reach / d.followers) * 100).toFixed(2))
          : d._n > 0 ? parseFloat((d.engagementRate / d._n).toFixed(2)) : 0;
        delete d._n;
        return d;
      })
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // ── Engagement trend ──
    const engMap: Record<string, any> = {};
    for (const p of recentPosts) {
      const ds = new Date(p.publishedAt!).toISOString().split('T')[0];
      if (!engMap[ds]) engMap[ds] = { date: ds, likes: 0, comments: 0, shares: 0, saved: 0, views: 0, total: 0 };
      for (const ins of scopedInsights(p.insights, platformFilter)) {
        engMap[ds].likes += ins.likes || 0;
        engMap[ds].comments += ins.comments || 0;
        engMap[ds].shares += ins.shares || 0;
        engMap[ds].saved += ins.saved || 0;
        engMap[ds].views += ins.views || 0;
      }
      const d = engMap[ds];
      d.total = d.likes + d.comments + d.shares + d.saved;
    }
    const engagementTrend = Object.values(engMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // ── Content type performance ──
    const ctMap: Record<string, any> = {};
    for (const p of recentPosts) {
      const t = (p.mediaType || 'text').toLowerCase();
      if (!ctMap[t]) ctMap[t] = { type: t, count: 0, reach: 0, engagement: 0, views: 0, saved: 0, impressions: 0 };
      ctMap[t].count += 1;
      for (const ins of scopedInsights(p.insights, platformFilter)) {
        ctMap[t].reach += ins.reach || 0;
        ctMap[t].engagement += (ins.likes || 0) + (ins.comments || 0) + (ins.shares || 0) + (ins.saved || 0);
        ctMap[t].views += ins.views || 0;
        ctMap[t].saved += ins.saved || 0;
        ctMap[t].impressions += ins.impressions || 0;
      }
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
      platMap[p].followers += acc.latest?.followers || 0;
      platMap[p].reach += acc.latest?.reach || 0;
      platMap[p].impressions += acc.latest?.impressions || 0;
      const prev = acc.before?.followers || 0;
      const curr = acc.latest?.followers || 0;
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

    // ── Top posts ──
    const topPosts = recentPosts.map(p => {
      const ins = scopedInsights(p.insights, platformFilter);
      const likes = sum(ins, 'likes'), comments = sum(ins, 'comments'), shares = sum(ins, 'shares'),
        saved = sum(ins, 'saved'), views = sum(ins, 'views'), reach = sum(ins, 'reach'), impressions = sum(ins, 'impressions');
      const engagement = likes + comments + shares + saved;
      const er = reach > 0 ? parseFloat(((engagement / reach) * 100).toFixed(2)) : 0;
      return {
        id: p.id, caption: p.caption, mediaUrls: p.mediaUrls, mediaType: p.mediaType,
        publishedAt: p.publishedAt, destinations: p.destinations,
        likes, comments, shares, saved, views, reach, impressions, engagement, engagementRate: er,
      };
    }).sort((a, b) => b.engagement - a.engagement).slice(0, 50);

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

    // ── Response ──
    res.json({
      kpis: {
        followers: { current: currFollowers, previous: prevFollowers, change: currFollowers - prevFollowers, growth: pct(currFollowers, prevFollowers) },
        reach: { current: currReach, previous: prevReach, change: currReach - prevReach, growth: pct(currReach, prevReach) },
        impressions: { current: currImpressions, previous: prevImpressions, change: currImpressions - prevImpressions, growth: pct(currImpressions, prevImpressions) },
        profileVisits: { current: currVisits, previous: prevVisits, change: currVisits - prevVisits, growth: pct(currVisits, prevVisits) },
        engagementRate: { current: currER, previous: prevER, change: parseFloat((currER - prevER).toFixed(2)) },
        engagement: { likes: currLikes, comments: currComments, shares: currShares, saved: currSaved, views: currViews, total: currEngagement },
        publishing,
      },
      chartData,
      engagementTrend,
      contentTypePerformance,
      bestTimes,
      platformComparison: Object.values(platMap),
      platformBreakdown,
      topPosts,
      publishing: { ...publishing, successRate, weeklyActivity },
      accounts: accountsWithLatest.map(a => {
        const isExcluded = ['facebook', 'instagram', 'youtube'].includes(a.platform.toLowerCase());
        return {
          id: a.id, platform: a.platform, displayName: a.displayName, platformUsername: a.platformUsername,
          avatarUrl: a.avatarUrl, healthStatus: a.healthStatus, healthMessage: a.healthMessage, updatedAt: a.updatedAt,
          latestMetrics: a.latest ? {
            followers: a.latest.followers || 0, reach: a.latest.reach || 0,
            impressions: a.latest.impressions || 0,
            profileVisits: isExcluded ? 0 : (a.latest.profileVisits || 0),
            engagementRate: Number(a.latest.engagementRate) || 0, date: a.latest.date,
          } : null,
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
    const { clientId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const sortBy = (req.query.sortBy as string) || 'engagement';
    const platform = req.query.platform as string;
    const contentType = req.query.contentType as string;
    const search = req.query.search as string;
    const days = parseInt(req.query.days as string) || 30;
    const skip = (page - 1) * limit;

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const since = new Date(todayUTC);
    since.setUTCDate(since.getUTCDate() - days);

    const where: any = { clientId, status: 'PUBLISHED' };
    if (contentType && contentType !== 'ALL') where.mediaType = contentType;
    if (search) where.caption = { contains: search, mode: 'insensitive' };

    const posts = await prisma.socialPost.findMany({
      where,
      include: {
        insights: true,
        destinations: { select: { platform: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500, // fetch all then sort
    });

    const withScores = posts
      .filter(p => p.publishedAt && new Date(p.publishedAt) >= since)
      .filter(p => matchesPlatform(p.destinations, (platform || 'ALL').toUpperCase()))
      .map(p => {
        const ins = scopedInsights(p.insights, (platform || 'ALL').toUpperCase());
        const likes = sum(ins, 'likes'), comments = sum(ins, 'comments'),
          shares = sum(ins, 'shares'), saved = sum(ins, 'saved'),
          views = sum(ins, 'views'), reach = sum(ins, 'reach'), impressions = sum(ins, 'impressions');
        const engagement = likes + comments + shares + saved;
        return { ...p, engagement, likes, comments, shares, saved, views, reach, impressions, engagementRate: reach > 0 ? parseFloat(((engagement / reach) * 100).toFixed(2)) : 0 };
      });

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

// ── 3. Force sync from platform APIs ─────────────────────────────────────
router.post('/analytics/:clientId/refresh', authenticate, async (req, res, next) => {
  try {
    await collectDailyInsights();
    res.json({ success: true, message: 'Analytics successfully refreshed' });
  } catch (err) {
    next(err);
  }
});

export default router;
