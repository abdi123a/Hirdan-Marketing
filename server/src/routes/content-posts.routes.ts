import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';

const router = Router();
router.use(authenticate);

const TASK_STATUS_BY_POST_STATUS: Record<string, 'PENDING' | 'PLANNED' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED'> = {
  DRAFT: 'PENDING',
  SCHEDULED: 'PLANNED',
  FILMED: 'WAITING_APPROVAL',
  PUBLISHED: 'COMPLETED',
  DELAYED: 'IN_PROGRESS',
};

const mapTaskStatusFromPostStatus = (status?: unknown) => {
  if (typeof status !== 'string') return undefined;
  return TASK_STATUS_BY_POST_STATUS[status.toUpperCase()];
};

const isMissingContentPostIdArgError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Unknown argument `contentPostId`');
};

// ─── Validation ───────────────────────────────────────────────────

const PLATFORMS = [
  'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN',
  'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER',
] as const;

const POST_STATUSES = ['DRAFT', 'SCHEDULED', 'FILMED', 'PUBLISHED', 'DELAYED'] as const;

const createPostDto = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  title: z.string().min(1).max(200),
  platform: z.enum(PLATFORMS),
  status: z.enum(POST_STATUSES).optional(),
  shootingDate: z.string().optional().nullable(),
  publishDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
});

const updatePostDto = createPostDto.partial();

const duplicateDto = z.object({
  fromMonth: z.number().int().min(1).max(12),
  fromYear: z.number().int().min(2020).max(2100),
  toMonth: z.number().int().min(1).max(12),
  toYear: z.number().int().min(2020).max(2100),
});

// ─── GET /api/clients/:id/content-posts ──────────────────────────
// ?month=&year= are required query params

router.get('/:id/content-posts', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const where: any = { clientId: id };
    if (month) where.month = month;
    if (year) where.year = year;

    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 100 });
    const posts = await prisma.contentPost.findMany({
      where,
      orderBy: [{ publishDate: 'asc' }, { createdAt: 'asc' }],
      take,
      skip,
    });

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:id/content-posts ─────────────────────────

router.post(
  '/:id/content-posts',
  requireAdmin,
  validate({ body: createPostDto }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as { id: string };

      // Verify client exists
      const client = await prisma.client.findUnique({ where: { id } });
      if (!client) throw AppError.notFound('Client not found');

      const { shootingDate, publishDate, ...data } = req.body;

      const post = await prisma.contentPost.create({
        data: {
          ...data,
          clientId: id,
          shootingDate: shootingDate ? new Date(shootingDate as string) : null,
          publishDate: publishDate ? new Date(publishDate as string) : null,
        },
      });

      // Attempt to auto-link to an existing unlinked task in the same month/cycle.
      const monthStart = new Date(data.year, data.month - 1, 1);
      const monthEnd = new Date(data.year, data.month, 0, 23, 59, 59, 999);
      let matchingTask: { id: string; status: 'PENDING' | 'PLANNED' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED' } | null = null;
      try {
        matchingTask = await prisma.deliverableTask.findFirst({
          where: {
            clientId: id,
            contentPostId: null,
            title: data.title,
            cycle: {
              cycleStart: { lte: monthEnd },
              cycleEnd: { gte: monthStart },
            },
            platforms: {
              some: { platform: data.platform },
            },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, status: true },
        });
      } catch (error) {
        // Keep post creation working on environments where Prisma client/schema
        // still doesn't expose contentPostId on DeliverableTask.
        if (!isMissingContentPostIdArgError(error)) throw error;
      }

      if (matchingTask) {
        const mappedTaskStatus = mapTaskStatusFromPostStatus(post.status);
        await prisma.deliverableTask.update({
          where: { id: matchingTask.id },
          data: {
            contentPostId: post.id,
            ...(mappedTaskStatus ? { status: mappedTaskStatus } : {}),
          },
        });
      }

      res.status(201).json({ post });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/clients/:id/content-posts/:postId ───────────────────

router.put(
  '/:id/content-posts/:postId',
  requireAdmin,
  validate({ body: updatePostDto }),
  async (req: Request, res: Response, next) => {
    try {
      const { id, postId } = req.params as { id: string; postId: string };

      const existing = await prisma.contentPost.findFirst({
        where: { id: postId, clientId: id },
      });
      if (!existing) throw AppError.notFound('Content post not found');

      const { shootingDate, publishDate, ...data } = req.body;

      const post = await prisma.contentPost.update({
        where: { id: postId },
        data: {
          ...data,
          ...(shootingDate !== undefined && {
            shootingDate: shootingDate ? new Date(shootingDate as string) : null,
          }),
          ...(publishDate !== undefined && {
            publishDate: publishDate ? new Date(publishDate as string) : null,
          }),
        },
      });

      if (data.status) {
        const mappedTaskStatus = mapTaskStatusFromPostStatus(data.status);
        if (mappedTaskStatus) {
          try {
            await prisma.deliverableTask.updateMany({
              where: { contentPostId: post.id },
              data: { status: mappedTaskStatus },
            });
          } catch (error) {
            // Don't fail post updates if linked-task field isn't available yet.
            if (!isMissingContentPostIdArgError(error)) throw error;
          }
        }
      }

      res.json({ post });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/clients/:id/content-posts/:postId ───────────────

router.delete('/:id/content-posts/:postId', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { id, postId } = req.params as { id: string; postId: string };

    const existing = await prisma.contentPost.findFirst({
      where: { id: postId, clientId: id },
    });
    if (!existing) throw AppError.notFound('Content post not found');

    await prisma.contentPost.delete({ where: { id: postId } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:id/content-posts/duplicate ───────────────
// Copy all posts from one month to another, resetting status to DRAFT
// and shifting publish/shooting dates by matching day-of-month in new month

router.post(
  '/:id/content-posts/duplicate',
  requireAdmin,
  validate({ body: duplicateDto }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params as { id: string };
      const { fromMonth, fromYear, toMonth, toYear } = req.body;

      // Check target month is empty (or warn)
      const existingCount = await prisma.contentPost.count({
        where: { clientId: id, month: toMonth, year: toYear },
      });

      // Get source posts
      const sourcePosts = await prisma.contentPost.findMany({
        where: { clientId: id, month: fromMonth, year: fromYear },
      });

      if (sourcePosts.length === 0) {
        throw AppError.badRequest(`No posts found for ${fromMonth}/${fromYear} to duplicate`);
      }

      // Create new posts for target month
      const created = await prisma.$transaction(
        sourcePosts.map((post) => {
          // Shift publish/shooting dates to same day-of-month in new month
          const shiftDate = (d: Date | null) => {
            if (!d) return null;
            const day = d.getDate();
            const targetDate = new Date(toYear, toMonth - 1, day);
            // Clamp to last day of month if needed
            const lastDay = new Date(toYear, toMonth, 0).getDate();
            targetDate.setDate(Math.min(day, lastDay));
            return targetDate;
          };

          return prisma.contentPost.create({
            data: {
              clientId: id,
              month: toMonth,
              year: toYear,
              title: post.title,
              platform: post.platform,
              status: 'DRAFT', // Always reset to draft
              shootingDate: shiftDate(post.shootingDate),
              publishDate: shiftDate(post.publishDate),
              notes: post.notes,
            },
          });
        })
      );

      res.status(201).json({
        created: created.length,
        overwritten: existingCount,
        posts: created,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
