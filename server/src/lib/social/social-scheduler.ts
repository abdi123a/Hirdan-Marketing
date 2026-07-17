import cron from 'node-cron';
import { prisma } from '../prisma.js';
import { publishPostToPlatform, refreshAccountToken, fetchPlatformInsights } from './platform-router.service.js';
import { isRateLimitError } from './meta.service.js';

export async function processDuePosts(): Promise<void> {
  try {
    // 1. Atomically claim destinations that are QUEUED and whose post is scheduled for <= now
    // We set status to 'PUBLISHING', lock it, and set attempt timestamp
    await prisma.$executeRawUnsafe(`
      UPDATE social_post_destinations spd
      JOIN social_posts sp ON sp.id = spd.post_id
      SET spd.status = 'PUBLISHING', spd.locked_at = NOW(), spd.last_attempt_at = NOW()
      WHERE spd.status = 'QUEUED'
        AND spd.locked_at IS NULL
        AND sp.status = 'SCHEDULED'
        AND sp.scheduled_for <= NOW()
    `);

    // 2. Fetch all destinations currently locked by this process
    const destinations = await prisma.socialPostDestination.findMany({
      where: {
        status: 'PUBLISHING',
        lockedAt: { not: null },
      },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    if (destinations.length === 0) return;

    // 3. Process each destination
    for (const dest of destinations) {
      try {
        // Check rate limit cooldown
        if (dest.socialAccount.rateLimitedUntil && dest.socialAccount.rateLimitedUntil > new Date()) {
          throw new Error(`Platform account is rate limited until ${dest.socialAccount.rateLimitedUntil.toISOString()}`);
        }

        const platformPostId = await publishPostToPlatform(dest.post, dest.socialAccount);

        await prisma.socialPostDestination.update({
          where: { id: dest.id },
          data: {
            status: 'PUBLISHED',
            platformPostId,
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        });
      } catch (err: any) {
        const errorMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
        console.error(`Error publishing post destination ${dest.id}:`, errorMsg);

        const nextAttempts = dest.attempts + 1;
        const failedPermanently = nextAttempts >= 3;

        // Check if rate limited
        let rateLimitedUntil: Date | null = null;
        if (isRateLimitError(err)) {
          rateLimitedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min cooldown
          await prisma.socialAccount.update({
            where: { id: dest.socialAccountId },
            data: {
              healthStatus: 'rate_limited',
              healthMessage: `Rate limit hit: ${errorMsg}`,
              rateLimitedUntil,
            },
          });
        }

        await prisma.socialPostDestination.update({
          where: { id: dest.id },
          data: {
            status: failedPermanently ? 'FAILED' : 'QUEUED',
            attempts: nextAttempts,
            lockedAt: null,
            lastError: errorMsg,
          },
        });
      }
    }

    // 4. Update the main SocialPost status based on destinations results
    const uniquePostIds = Array.from(new Set(destinations.map(d => d.postId)));
    for (const postId of uniquePostIds) {
      const allDests = await prisma.socialPostDestination.findMany({
        where: { postId },
      });

      const total = allDests.length;
      const published = allDests.filter(d => d.status === 'PUBLISHED').length;
      const failed = allDests.filter(d => d.status === 'FAILED').length;
      const queued = allDests.filter(d => d.status === 'QUEUED').length;

      if (published === total) {
        await prisma.socialPost.update({
          where: { id: postId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            errorMessage: null,
          },
        });
      } else if (published + failed === total && failed > 0) {
        // If all finished, but some or all failed
        await prisma.socialPost.update({
          where: { id: postId },
          data: {
            status: 'FAILED',
            errorMessage: `Failed to publish to ${failed} out of ${total} platforms.`,
          },
        });
      }
      // If there are still QUEUED ones, we keep the post status as SCHEDULED so it retries
    }
  } catch (err: any) {
    console.error('Error in processDuePosts scheduler:', err);
  }
}

export async function refreshExpiringTokens(): Promise<void> {
  try {
    // Refresh tokens expiring in the next 7 days
    const expiryThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const accounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          lte: expiryThreshold,
        },
      },
    });

    for (const account of accounts) {
      try {
        const refreshData = await refreshAccountToken(account);
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessTokenEnc: refreshData.accessTokenEnc,
            refreshTokenEnc: refreshData.refreshTokenEnc,
            tokenExpiresAt: refreshData.tokenExpiresAt,
            healthStatus: 'healthy',
            healthMessage: null,
          },
        });
        console.log(`Successfully refreshed token for social account: ${account.displayName} (${account.platform})`);
      } catch (err: any) {
        console.error(`Failed to refresh token for account ${account.id}:`, err.message);
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            healthStatus: 'expired',
            healthMessage: `Token refresh failed: ${err.message}`,
          },
        });
        // Create an system notification for admins
        await prisma.notification.create({
          data: {
            title: 'Social Account Disconnected',
            message: `The access token for ${account.displayName} (${account.platform}) has expired and could not be refreshed. Please reconnect the account.`,
            type: 'SOCIAL_ACCOUNT_EXPIRED',
            category: 'WARNING',
            entityType: 'CLIENT',
            entityId: account.clientId,
          },
        });
      }
    }
  } catch (err: any) {
    console.error('Error in refreshExpiringTokens job:', err);
  }
}

export async function collectDailyInsights(): Promise<void> {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true, healthStatus: { not: 'expired' } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const account of accounts) {
      try {
        const metrics = await fetchPlatformInsights(account);
        await prisma.accountInsightDaily.upsert({
          where: {
            socialAccountId_date: {
              socialAccountId: account.id,
              date: today,
            },
          },
          create: {
            socialAccountId: account.id,
            date: today,
            followers: metrics.followers,
            reach: metrics.reach,
            impressions: metrics.impressions,
            profileVisits: metrics.profileVisits,
            engagementRate: metrics.followers > 0 ? (metrics.reach / metrics.followers) * 100 : 0,
          },
          update: {
            followers: metrics.followers,
            reach: metrics.reach,
            impressions: metrics.impressions,
            profileVisits: metrics.profileVisits,
            engagementRate: metrics.followers > 0 ? (metrics.reach / metrics.followers) * 100 : 0,
          },
        });
      } catch (err: any) {
        console.error(`Failed to collect daily insights for account ${account.id}:`, err.message);
      }
    }

    // Collect post insights for posts published in the last 7 days
    const recentPosts = await prisma.socialPost.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        destinations: {
          include: {
            socialAccount: true,
          },
        },
      },
    });

    for (const post of recentPosts) {
      for (const dest of post.destinations) {
        if (dest.status !== 'PUBLISHED' || !dest.platformPostId) continue;
        try {
          const platform = dest.platform.toLowerCase();
          let metrics = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saved: 0 };
          
          if (platform === 'facebook' || platform === 'instagram') {
            const { getMetaPostInsights } = await import('./meta.service.js');
            const decryptToken = (await import('./token-crypto.service.js')).decryptToken;
            const token = decryptToken(dest.socialAccount.accessTokenEnc);
            metrics = await getMetaPostInsights(dest.platformPostId, token, platform as any);
          }

          await prisma.postInsight.create({
            data: {
              postId: post.id,
              platform: dest.platform,
              impressions: metrics.impressions,
              reach: metrics.reach,
              likes: metrics.likes,
              comments: metrics.comments,
              shares: metrics.shares,
              saved: metrics.saved,
            },
          });
        } catch (err: any) {
          console.error(`Failed to collect post insights for destination ${dest.id}:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('Error in collectDailyInsights job:', err);
  }
}

export function startSocialScheduler(): void {
  // 1. Process due posts every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    processDuePosts().catch(err => console.error('social scheduler processDuePosts error:', err));
  });

  // 2. Refresh expiring tokens every 2 hours
  cron.schedule('0 */2 * * *', () => {
    refreshExpiringTokens().catch(err => console.error('social scheduler refreshExpiringTokens error:', err));
  });

  // 3. Collect daily insights every day at 2 AM
  cron.schedule('0 2 * * *', () => {
    collectDailyInsights().catch(err => console.error('social scheduler collectDailyInsights error:', err));
  });

  console.log('✔ Social media scheduler jobs successfully initialized');
}
