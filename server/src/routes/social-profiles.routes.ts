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

const PLATFORMS = [
  'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN',
  'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER',
] as const;

const socialProfileDto = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().optional().nullable(),
  profileUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ─── GET /api/clients/:clientId/social-profiles ───────────────────

router.get('/:clientId/social-profiles', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const profiles = await prisma.clientSocialProfile.findMany({
      where: { clientId: req.params.clientId as string },
      orderBy: { platform: 'asc' },
      take,
      skip,
    });
    res.json({ profiles });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:clientId/social-profiles ──────────────────

router.post(
  '/:clientId/social-profiles',
  requireAdmin,
  validate({ body: socialProfileDto }),
  async (req: Request, res: Response, next) => {
    try {
      const clientId = req.params.clientId as string;

      // Verify client exists
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw AppError.notFound('Client not found');

      const profile = await prisma.clientSocialProfile.create({
        data: { clientId, ...req.body },
      });
      res.status(201).json({ profile });
    } catch (error: any) {
      // Handle unique constraint (client + platform)
      if (error?.code === 'P2002') {
        next(AppError.conflict('This platform is already connected for this client'));
        return;
      }
      next(error);
    }
  }
);

// ─── PUT /api/clients/:clientId/social-profiles/:profileId ────────

router.put(
  '/:clientId/social-profiles/:profileId',
  requireAdmin,
  validate({ body: socialProfileDto.partial() }),
  async (req: Request, res: Response, next) => {
    try {
      const profile = await prisma.clientSocialProfile.findFirst({
        where: {
          id: req.params.profileId as string,
          clientId: req.params.clientId as string,
        },
      });
      if (!profile) throw AppError.notFound('Social profile not found');

      const updated = await prisma.clientSocialProfile.update({
        where: { id: profile.id },
        data: req.body,
      });
      res.json({ profile: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/clients/:clientId/social-profiles/:profileId ─────

router.delete(
  '/:clientId/social-profiles/:profileId',
  requireAdmin,
  async (req: Request, res: Response, next) => {
    try {
      const profile = await prisma.clientSocialProfile.findFirst({
        where: {
          id: req.params.profileId as string,
          clientId: req.params.clientId as string,
        },
      });
      if (!profile) throw AppError.notFound('Social profile not found');

      await prisma.clientSocialProfile.delete({ where: { id: profile.id } });
      res.json({ message: 'Social profile deleted' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
