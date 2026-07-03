import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';

const router = Router();
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────

const DELIVERABLE_TYPES = [
  'POST', 'STORY', 'REEL', 'SHORT', 'VIDEO', 'REPORT', 'OTHER',
] as const;

const PLATFORMS = [
  'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN',
  'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER',
] as const;

const deliverableDto = z.object({
  name: z.string().min(1),
  type: z.enum(DELIVERABLE_TYPES),
  quantity: z.number().int().positive(),
  description: z.string().optional().nullable(),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
});

// ─── GET /api/packages/:packageId/deliverables ────────────────────

router.get('/:packageId/deliverables', async (req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 100 });
    const deliverables = await prisma.packageDeliverable.findMany({
      where: { packageId: req.params.packageId as string },
      include: {
        platforms: { select: { id: true, platform: true } },
      },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    });
    res.json({ deliverables });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/packages/:packageId/deliverables ───────────────────

router.post(
  '/:packageId/deliverables',
  requireAdmin,
  validate({ body: deliverableDto }),
  async (req: Request, res: Response, next) => {
    try {
      const packageId = req.params.packageId as string;

      // Verify package exists
      const pkg = await prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg) throw AppError.notFound('Package not found');

      const { platforms, ...deliverableData } = req.body;

      const deliverable = await prisma.packageDeliverable.create({
        data: {
          packageId,
          ...deliverableData,
          platforms: {
            create: platforms.map((p: string) => ({ platform: p as any })),
          },
        },
        include: {
          platforms: { select: { id: true, platform: true } },
        },
      });

      res.status(201).json({ deliverable });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/packages/:packageId/deliverables/:deliverableId ─────

router.put(
  '/:packageId/deliverables/:deliverableId',
  requireAdmin,
  validate({ body: deliverableDto.partial() }),
  async (req: Request, res: Response, next) => {
    try {
      const existing = await prisma.packageDeliverable.findFirst({
        where: {
          id: req.params.deliverableId as string,
          packageId: req.params.packageId as string,
        },
      });
      if (!existing) throw AppError.notFound('Deliverable not found');

      const { platforms, ...deliverableData } = req.body;

      const deliverable = await prisma.packageDeliverable.update({
        where: { id: existing.id },
        data: {
          ...deliverableData,
          ...(platforms && {
            platforms: {
              deleteMany: {},
              create: platforms.map((p: string) => ({ platform: p as any })),
            },
          }),
        },
        include: {
          platforms: { select: { id: true, platform: true } },
        },
      });

      res.json({ deliverable });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/packages/:packageId/deliverables/:deliverableId ──

router.delete(
  '/:packageId/deliverables/:deliverableId',
  requireAdmin,
  async (req: Request, res: Response, next) => {
    try {
      const existing = await prisma.packageDeliverable.findFirst({
        where: {
          id: req.params.deliverableId as string,
          packageId: req.params.packageId as string,
        },
      });
      if (!existing) throw AppError.notFound('Deliverable not found');

      await prisma.packageDeliverable.delete({ where: { id: existing.id } });
      res.json({ message: 'Deliverable deleted' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
