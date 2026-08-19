import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { publishDestination } from '../lib/social/publish-destination.service.js';
import { diffDestinations } from '../lib/social/destination-diff.js';
import { uploadSocialMediaFile } from '../lib/social/storage.service.js';
import { callAI, resolveProviderKey } from '../lib/ai-provider.js';
import multer from 'multer';
import path from 'path';
import { PATHS } from '../lib/paths.js';

/** Aggregate post status from per-destination outcomes. */
function aggregatePostStatus(published: number, failed: number, total: number): string {
  if (total > 0 && published === total) return 'PUBLISHED';
  if (published > 0 && failed > 0) return 'PARTIAL';
  if (failed > 0) return 'FAILED';
  return 'PUBLISHING';
}

const router = Router();
// 500MB covers any realistic social video/image upload while bounding worst-case
// disk/memory usage — multer's default fileSize limit is Infinity.
const upload = multer({
  dest: path.join(PATHS.UPLOADS_ROOT, 'social-temp'),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// 1. Create a Post (Draft or Scheduled)
router.post('/posts', authenticate, async (req, res, next) => {
  try {
    const { clientId, caption, platformContent, mediaUrls, mediaType, accountIds, scheduledFor, campaignId, status } = req.body;

    if (!clientId || !accountIds || !Array.isArray(accountIds)) {
      res.status(400).json({ error: 'Missing required fields: clientId, accountIds' });
      return;
    }

    const safeCaption = caption ?? '';

    // FIX: previously created destinations with platform: 'UNKNOWN' and then
    // patched each one individually in a follow-up loop (N extra queries, plus
    // a window where a post that failed partway through the loop was left with
    // some destinations still stuck on 'UNKNOWN'). Resolve accounts first, then
    // create the post with the correct platform on every destination in one write.
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: accountIds } },
    });
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    const missing = accountIds.filter(id => !accountMap.has(id));
    if (missing.length > 0) {
      res.status(400).json({ error: `Unknown account id(s): ${missing.join(', ')}` });
      return;
    }

    const post = await prisma.socialPost.create({
      data: {
        clientId: clientId as string,
        caption: safeCaption,
        platformContent: platformContent || {},
        mediaUrls: mediaUrls || [],
        mediaType: mediaType || 'image',
        status: status || 'DRAFT',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        campaignId: campaignId as string | null,
        destinations: {
          create: accountIds.map(accountId => ({
            socialAccountId: accountId,
            platform: accountMap.get(accountId)!.platform,
            status: 'QUEUED',
          })),
        },
      },
      include: {
        destinations: true,
      },
    });

    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 2. List posts (paginated with filters)
router.get('/posts', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    const { clientId, status, platform, campaignId } = req.query;

    const where: any = {};
    if (clientId) where.clientId = clientId as string;
    if (status) where.status = status as string;
    if (campaignId) where.campaignId = campaignId as string;
    if (platform) {
      where.destinations = {
        some: {
          platform: platform as string,
        },
      };
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          destinations: {
            include: {
              socialAccount: {
                select: { displayName: true, platformUsername: true, avatarUrl: true },
              },
            },
          },
        },
      }),
      prisma.socialPost.count({ where }),
    ]);

    res.json({ posts, total, page, limit });
    return;
  } catch (err) {
    next(err);
  }
});

// 3. Get single post detail
router.get('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: {
        destinations: {
          include: {
            socialAccount: true,
          },
        },
        insights: true,
      },
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 4. Update post (Draft or Scheduled)
router.put('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    // Express 5 leaves req.body undefined for a request with no body at all,
    // which would make this destructure throw before any validation runs.
    const { caption, platformContent, mediaUrls, mediaType, scheduledFor, campaignId, status, accountIds } =
      req.body ?? {};

    const currentPost = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: { destinations: true },
    });

    if (!currentPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (accountIds && Array.isArray(accountIds)) {
      // Reconcile destinations as a DIFF, never a wipe-and-rebuild.
      //
      // This used to deleteMany({ status: { not: 'PUBLISHED' } }) then recreate a
      // fresh QUEUED row for every selected account. Because most callers resend
      // the post's *existing* accountIds just to change one unrelated field (a
      // reschedule, a comment, a bulk status change), that rebuilt every
      // destination on every such edit and destroyed attempts / lastError /
      // lastAttemptAt / lockedAt / platformPostUrl. Two consequences were severe:
      // a FAILED destination came back QUEUED with attempts reset to 0, so the
      // scheduler re-published a post that had already exhausted its retry budget
      // (adding a comment could republish a post); and a destination the scheduler
      // was mid-publish on could be deleted underneath it.
      //
      // Diffing keeps untouched rows byte-identical, so resending the same
      // accountIds is now a genuine no-op.
      const { toRemove, toCreate: accountsToQueue } = diffDestinations(
        currentPost.destinations,
        accountIds as string[],
      );

      if (toRemove.length > 0) {
        await prisma.socialPostDestination.deleteMany({ where: { id: { in: toRemove } } });
      }

      if (accountsToQueue.length > 0) {
        const accounts = await prisma.socialAccount.findMany({
          where: { id: { in: accountsToQueue } },
        });
        const accountMap = new Map(accounts.map((a) => [a.id, a]));

        await prisma.socialPostDestination.createMany({
          data: accountsToQueue.map((accountId: string) => ({
            postId: id as string,
            socialAccountId: accountId,
            platform: accountMap.get(accountId)?.platform || 'UNKNOWN',
            status: 'QUEUED',
          })),
        });
      }
    }

    await prisma.socialPost.update({
      where: { id: id as string },
      data: {
        caption: caption !== undefined ? (caption ?? '') : undefined,
        platformContent: platformContent !== undefined ? (platformContent || {}) : undefined,
        mediaUrls: mediaUrls !== undefined ? (mediaUrls || []) : undefined,
        mediaType: mediaType !== undefined ? (mediaType || 'image') : undefined,
        scheduledFor: scheduledFor !== undefined ? (scheduledFor ? new Date(scheduledFor) : null) : undefined,
        campaignId: campaignId !== undefined ? (campaignId as string | null) : undefined,
        // Omitting status must mean "leave it alone". This used to fall back to
        // `currentPost.status`, re-writing the value read a few awaits earlier —
        // so a PUT that raced the scheduler could revert a just-PUBLISHED post to
        // SCHEDULED, where nothing would ever pick it up again.
        status: status || undefined,
      },
    });

    const updatedPost = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: { destinations: true },
    });

    res.json(updatedPost);
    return;
  } catch (err) {
    next(err);
  }
});

// 5. Delete post
router.delete('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.socialPost.delete({
      where: { id: id as string },
    });
    res.json({ success: true, message: 'Post successfully deleted' });
    return;
  } catch (err) {
    next(err);
  }
});

// 6. Submit post for approval
router.post('/posts/:id/submit', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.socialPost.update({
      where: { id: id as string },
      data: { status: 'AWAITING_APPROVAL' },
    });
    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 7. Approve post
router.post('/posts/:id/approve', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const current = await prisma.socialPost.findUnique({ where: { id: id as string } });
    if (!current) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    // The scheduler only ever claims posts with a scheduledFor in the past — an
    // approved post with none would sit in SCHEDULED forever with no error.
    if (!current.scheduledFor) {
      res.status(400).json({ error: 'Cannot approve a post with no scheduled time. Set a schedule first.' });
      return;
    }
    const post = await prisma.socialPost.update({
      where: { id: id as string },
      data: { status: 'SCHEDULED' },
    });
    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 8. Reject post (back to draft)
router.post('/posts/:id/reject', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.socialPost.update({
      where: { id: id as string },
      data: { status: 'DRAFT' },
    });
    res.json(post);
    return;
  } catch (err) {
    next(err);
  }
});

// 9. Publish immediately
router.post('/posts/:id/publish-now', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountIds: targetAccountIds } = req.body || {};
    const post = (await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: {
        destinations: {
          include: { socialAccount: true },
        },
      },
    })) as any;

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const targetSet =
      Array.isArray(targetAccountIds) && targetAccountIds.length > 0
        ? new Set(targetAccountIds as string[])
        : null;

    // Never re-publish destinations that already succeeded — edit/retry must only
    // hit QUEUED/FAILED (or explicitly targeted unpublished) accounts.
    const destinationsToPublish = post.destinations.filter((dest: any) => {
      if (dest.status === 'PUBLISHED' && dest.platformPostId) return false;
      if (targetSet && !targetSet.has(dest.socialAccountId)) return false;
      return true;
    });

    // Set post status to PUBLISHING
    await prisma.socialPost.update({
      where: { id: id as string },
      data: { status: 'PUBLISHING' },
    });

    const errorsList: string[] = [];

    for (const dest of destinationsToPublish) {
      // Claim atomically: if the scheduler has already claimed this destination
      // (status flipped to PUBLISHING between the fetch above and now), skip it
      // instead of publishing it a second time concurrently with the cron.
      const claim = await prisma.socialPostDestination.updateMany({
        where: { id: dest.id as string, status: { not: 'PUBLISHING' } },
        data: { status: 'PUBLISHING', lockedAt: new Date(), lastAttemptAt: new Date() },
      });
      if (claim.count === 0) continue;

      // One-shot: a failure here is terminal, because this route always writes a
      // non-SCHEDULED aggregate status below and the scheduler only ever claims
      // destinations whose post is SCHEDULED.
      const result = await publishDestination(dest, post, { maxAttempts: 1, skippedStatus: 'FAILED' });
      if (result.outcome !== 'published') {
        errorsList.push(`${dest.platform}: ${result.error}`);
      }
    }

    // Check resulting statuses of all destinations for this post
    const allDests = await prisma.socialPostDestination.findMany({
      where: { postId: id as string },
    });
    const totalDests = allDests.length;
    const publishedDests = allDests.filter((d) => d.status === 'PUBLISHED').length;
    const failedDests = allDests.filter((d) => d.status === 'FAILED').length;
    const isAllPublished = totalDests > 0 && publishedDests === totalDests;
    const aggregateStatus = aggregatePostStatus(publishedDests, failedDests, totalDests);

    const finalPost = await prisma.socialPost.update({
      where: { id: id as string },
      data: {
        status: aggregateStatus,
        // Keep the first successful publish time on partial failures instead of clearing it.
        publishedAt: isAllPublished
          ? new Date()
          : publishedDests > 0
            ? (post.publishedAt || new Date())
            : null,
        errorMessage: isAllPublished ? null : (errorsList.length > 0 ? errorsList.join('; ') : null),
      },
      include: {
        destinations: {
          include: { socialAccount: true },
        },
      },
    });

    res.json(finalPost);
    return;
  } catch (err) {
    next(err);
  }
});

// 10. Retry failed destinations
router.post('/posts/:id/retry', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = (await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: {
        destinations: {
          where: { status: 'FAILED' },
          include: { socialAccount: true },
        },
      },
    })) as any;

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    await prisma.socialPost.update({
      where: { id: id as string },
      data: { status: 'PUBLISHING' },
    });

    const errorsList: string[] = [];

    for (const dest of post.destinations) {
      // Claim conditionally, like publish-now. This used to be an unconditional
      // update(), so a manual retry that overlapped a scheduler tick already
      // holding the destination would publish it a second time.
      const claim = await prisma.socialPostDestination.updateMany({
        where: { id: dest.id as string, status: { not: 'PUBLISHING' } },
        data: { status: 'PUBLISHING', lockedAt: new Date(), lastAttemptAt: new Date() },
      });
      if (claim.count === 0) continue;

      const result = await publishDestination(dest, post, { maxAttempts: 1, skippedStatus: 'FAILED' });
      if (result.outcome !== 'published') {
        errorsList.push(`${dest.platform}: ${result.error}`);
      }
    }

    // Check resulting statuses of all destinations for this post
    const allDests = await prisma.socialPostDestination.findMany({
      where: { postId: id as string },
    });
    const totalDests = allDests.length;
    const publishedDests = allDests.filter((d) => d.status === 'PUBLISHED').length;
    const failedDests = allDests.filter((d) => d.status === 'FAILED').length;
    const isAllPublished = totalDests > 0 && publishedDests === totalDests;
    const aggregateStatus = aggregatePostStatus(publishedDests, failedDests, totalDests);

    const finalPost = await prisma.socialPost.update({
      where: { id: id as string },
      data: {
        status: aggregateStatus,
        publishedAt: isAllPublished
          ? new Date()
          : publishedDests > 0
            ? (post.publishedAt || new Date())
            : null,
        errorMessage: isAllPublished ? null : (errorsList.length > 0 ? errorsList.join('; ') : null),
      },
      include: {
        destinations: {
          include: { socialAccount: true },
        },
      },
    });

    res.json(finalPost);
    return;
  } catch (err) {
    next(err);
  }
});

// 11. Media Upload
router.post('/media/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const publicUrl = await uploadSocialMediaFile(file);
    res.json({ url: publicUrl });
    return;
  } catch (err) {
    next(err);
  }
});

// 12. AI generate caption (Gemini/configured model)
router.post('/ai/caption', authenticate, async (req, res, next) => {
  try {
    const { prompt, platform } = req.body;
    if (!prompt || !platform) {
      res.status(400).json({ error: 'Missing prompt or platform' });
      return;
    }

    const settings = await prisma.agencySettings.findFirst();
    if (!settings) {
      res.status(400).json({ error: 'Agency settings not configured' });
      return;
    }

    const { provider, apiKey } = resolveProviderKey(settings);
    if (!apiKey) {
      res.status(400).json({ error: `API key for provider ${provider} is not configured` });
      return;
    }

    const messages = [
      {
        role: 'system' as const,
        content: `You are an expert social media copywriter. Write a highly engaging caption for ${platform}. Optimize the tone, formatting, and hashtag usage specifically for ${platform}. Stay strictly within ${platform}'s character limit. Do not include quotes around the output.`,
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const aiRes = await callAI(provider, apiKey, messages);
    res.json({ caption: aiRes.content });
    return;
  } catch (err) {
    next(err);
  }
});

// 13. Campaigns CRUD
router.get('/campaigns', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    const where = clientId ? { clientId } : {};
    const campaigns = await prisma.socialCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
    return;
  } catch (err) {
    next(err);
  }
});

router.post('/campaigns', authenticate, async (req, res, next) => {
  try {
    const { clientId, name } = req.body;
    if (!clientId || !name) {
      res.status(400).json({ error: 'Missing clientId or name' });
      return;
    }
    const campaign = await prisma.socialCampaign.create({
      data: { clientId: clientId as string, name },
    });
    res.json(campaign);
    return;
  } catch (err) {
    next(err);
  }
});

export default router;
