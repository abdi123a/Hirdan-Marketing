import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { collectDailyInsights } from '../lib/social/social-scheduler.js';

const router = Router();

// 1. Get client social media analytics (last 30 days aggregate + daily details)
router.get('/analytics/:clientId', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const accounts = await prisma.socialAccount.findMany({
      where: { clientId: clientId as string, isActive: true },
    });

    if (accounts.length === 0) {
      res.json({
        accounts: [],
        chartData: [],
        totals: { followers: 0, reach: 0, impressions: 0, profileVisits: 0 },
      });
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyMetrics = await prisma.accountInsightDaily.findMany({
      where: {
        socialAccountId: { in: accounts.map(a => a.id) },
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
    });

    // Compute latest metrics per account
    const accountsWithLatest = await Promise.all(
      accounts.map(async (acc) => {
        const latest = await prisma.accountInsightDaily.findFirst({
          where: { socialAccountId: acc.id },
          orderBy: { date: 'desc' },
        });
        return {
          ...acc,
          latestMetrics: latest || { followers: 0, reach: 0, impressions: 0, profileVisits: 0, engagementRate: 0 },
        };
      })
    );

    // Compute aggregate totals (sum of latest metrics)
    const totals = accountsWithLatest.reduce(
      (acc, curr) => {
        acc.followers += curr.latestMetrics.followers || 0;
        acc.reach += curr.latestMetrics.reach || 0;
        acc.impressions += curr.latestMetrics.impressions || 0;
        acc.profileVisits += curr.latestMetrics.profileVisits || 0;
        return acc;
      },
      { followers: 0, reach: 0, impressions: 0, profileVisits: 0 }
    );

    // Group daily metrics by date for chart rendering
    const dateGroups: Record<string, any> = {};
    for (const metric of dailyMetrics) {
      const dateStr = metric.date.toISOString().split('T')[0];
      if (!dateGroups[dateStr]) {
        dateGroups[dateStr] = { date: dateStr, followers: 0, reach: 0, impressions: 0, profileVisits: 0 };
      }
      dateGroups[dateStr].followers += metric.followers || 0;
      dateGroups[dateStr].reach += metric.reach || 0;
      dateGroups[dateStr].impressions += metric.impressions || 0;
      dateGroups[dateStr].profileVisits += metric.profileVisits || 0;
    }

    const chartData = Object.values(dateGroups).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      accounts: accountsWithLatest,
      chartData,
      totals,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Get client top posts by engagement
router.get('/analytics/:clientId/posts', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await prisma.socialPost.findMany({
      where: { clientId: clientId as string, status: 'PUBLISHED' },
      include: {
        insights: true,
        destinations: {
          include: {
            socialAccount: {
              select: { displayName: true, platformUsername: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.socialPost.count({
      where: { clientId: clientId as string, status: 'PUBLISHED' },
    });

    // Map and calculate an engagement score: sum(likes + comments + shares + saved)
    const postsWithScore = posts.map((post: any) => {
      const totalLikes = (post.insights || []).reduce((sum: number, item: any) => sum + (item.likes || 0), 0);
      const totalComments = (post.insights || []).reduce((sum: number, item: any) => sum + (item.comments || 0), 0);
      const totalShares = (post.insights || []).reduce((sum: number, item: any) => sum + (item.shares || 0), 0);
      const totalSaved = (post.insights || []).reduce((sum: number, item: any) => sum + (item.saved || 0), 0);
      const engagement = totalLikes + totalComments + totalShares + totalSaved;

      return {
        ...post,
        engagement,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        saved: totalSaved,
      };
    });

    // Sort by engagement score descending
    postsWithScore.sort((a, b) => b.engagement - a.engagement);

    res.json({ posts: postsWithScore, total, page, limit });
    return;
  } catch (err) {
    next(err);
  }
});

// 3. Force refresh analytics metrics from platform APIs
router.post('/analytics/:clientId/refresh', authenticate, async (req, res, next) => {
  try {
    await collectDailyInsights();
    res.json({ success: true, message: 'Analytics successfully refreshed' });
  } catch (err) {
    next(err);
  }
});

export default router;
