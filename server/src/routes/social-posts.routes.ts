import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { publishPostToPlatform } from '../lib/social/platform-router.service.js';
import { uploadSocialMediaFile } from '../lib/social/storage.service.js';
import { callAI, resolveProviderKey } from '../lib/ai-provider.js';
import multer from 'multer';
import path from 'path';
import { PATHS } from '../lib/paths.js';

const router = Router();
const upload = multer({ dest: path.join(PATHS.UPLOADS_ROOT, 'social-temp') });

// 1. Create a Post (Draft or Scheduled)
router.post('/posts', authenticate, async (req, res, next) => {
  try {
    const { clientId, caption, platformContent, mediaUrls, mediaType, accountIds, scheduledFor, campaignId, status } = req.body;

    if (!clientId || !caption || !accountIds || !Array.isArray(accountIds)) {
      res.status(400).json({ error: 'Missing required fields: clientId, caption, accountIds' });
      return;
    }

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
        caption,
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
    const { caption, platformContent, mediaUrls, mediaType, scheduledFor, campaignId, status, accountIds } = req.body;

    const currentPost = await prisma.socialPost.findUnique({
      where: { id: id as string },
      include: { destinations: true },
    });

    if (!currentPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (accountIds && Array.isArray(accountIds)) {
      await prisma.socialPostDestination.deleteMany({
        where: { postId: id as string },
      });

      // FIX: previously did one prisma.socialAccount.findUnique() per account
      // inside a for-loop (N queries). Batched into a single findMany.
      const accounts = await prisma.socialAccount.findMany({
        where: { id: { in: accountIds } },
      });
      const accountMap = new Map(accounts.map(a => [a.id, a]));

      const destinationsData = accountIds.map((accountId: string) => ({
        socialAccountId: accountId,
        platform: accountMap.get(accountId)?.platform || 'UNKNOWN',
        status: 'QUEUED',
      }));

      await prisma.socialPost.update({
        where: { id: id as string },
        data: {
          caption,
          platformContent: platformContent || {},
          mediaUrls: mediaUrls || [],
          mediaType: mediaType || 'image',
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          campaignId: campaignId as string | null,
          status: status || currentPost.status,
          destinations: {
            create: destinationsData,
          },
        },
      });
    } else {
      await prisma.socialPost.update({
        where: { id: id as string },
        data: {
          caption,
          platformContent: platformContent || {},
          mediaUrls: mediaUrls || [],
          mediaType: mediaType || 'image',
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          campaignId: campaignId as string | null,
          status: status || currentPost.status,
        },
      });
    }

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

    // Set post status to PUBLISHING
    await prisma.socialPost.update({
      where: { id: id as string },
      data: { status: 'PUBLISHING' },
    });

    let hasErrors = false;
    const errorsList: string[] = [];

    for (const dest of post.destinations) {
      try {
        await prisma.socialPostDestination.update({
          where: { id: dest.id as string },
          data: { status: 'PUBLISHING', lockedAt: new Date(), lastAttemptAt: new Date() },
        });

        const platformPostId = await publishPostToPlatform(post, dest.socialAccount);

        await prisma.socialPostDestination.update({
          where: { id: dest.id as string },
          data: {
            status: 'PUBLISHED',
            platformPostId,
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        });
      } catch (err: any) {
        hasErrors = true;
        const msg = err.response?.data?.error?.message || err.message || 'Publishing failed';
        errorsList.push(msg);

        await prisma.socialPostDestination.update({
          where: { id: dest.id as string },
          data: {
            status: 'FAILED',
            attempts: dest.attempts + 1,
            lockedAt: null,
            lastError: msg,
          },
        });
      }
    }

    const finalPost = await prisma.socialPost.update({
      where: { id: id as string },
      data: {
        status: hasErrors ? 'FAILED' : 'PUBLISHED',
        publishedAt: hasErrors ? null : new Date(),
        errorMessage: hasErrors ? errorsList.join('; ') : null,
      },
      include: { destinations: true },
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

    let hasErrors = false;
    const errorsList: string[] = [];

    for (const dest of post.destinations) {
      try {
        await prisma.socialPostDestination.update({
          where: { id: dest.id as string },
          data: { status: 'PUBLISHING', lockedAt: new Date(), lastAttemptAt: new Date() },
        });

        const platformPostId = await publishPostToPlatform(post, dest.socialAccount);

        await prisma.socialPostDestination.update({
          where: { id: dest.id as string },
          data: {
            status: 'PUBLISHED',
            platformPostId,
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
          },
        });
      } catch (err: any) {
        hasErrors = true;
        const msg = err.response?.data?.error?.message || err.message || 'Retry failed';
        errorsList.push(msg);

        await prisma.socialPostDestination.update({
          where: { id: dest.id as string },
          data: {
            status: 'FAILED',
            attempts: dest.attempts + 1,
            lockedAt: null,
            lastError: msg,
          },
        });
      }
    }

    const finalPost = await prisma.socialPost.update({
      where: { id: id as string },
      data: {
        status: hasErrors ? 'FAILED' : 'PUBLISHED',
        publishedAt: hasErrors ? null : new Date(),
        errorMessage: hasErrors ? errorsList.join('; ') : null,
      },
      include: { destinations: true },
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

router.put('/campaigns/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    const campaign = await prisma.socialCampaign.update({
      where: { id: id as string },
      data: { name, status },
    });
    res.json(campaign);
    return;
  } catch (err) {
    next(err);
  }
});

router.delete('/campaigns/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.socialCampaign.delete({
      where: { id: id as string },
    });
    res.json({ success: true });
    return;
  } catch (err) {
    next(err);
  }
});

export default router;
