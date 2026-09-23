import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';
import { createNotification } from '../lib/notifications.js';

const router = Router();

/**
 * Public lead capture (landing-page email sign-up). Mounted in routes/index.ts
 * WITHOUT authentication, before the authenticated leads router. It only
 * answers `POST /`; everything else about leads stays behind auth.
 */
export const publicLeadsRouter = Router();

const leadsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/leads ──────────────────────────────────────────────
// Public route to collect emails
publicLeadsRouter.post(
  '/',
  leadsLimiter,
  validate({
    body: z.object({
      email: z.string().trim().toLowerCase().max(254).email(),
      // Honeypot: real forms leave this hidden field empty; bots fill it.
      website: z.string().max(0).optional(),
    }),
  }),
  async (req: Request, res: Response, next) => {
  try {
    const { email } = req.body;

    const existing = await prisma.lead.findUnique({ where: { email }, select: { id: true } });
    const lead = await prisma.lead.upsert({
      where: { email },
      update: { status: 'PENDING' }, // Re-activate if they submit again
      create: { email },
    });

    // Fire notification only on first capture (not re-submissions)
    if (!existing) {
      createNotification({
        title: 'New Lead Captured 🎯',
        message: `A new lead signed up: ${email}`,
        type: 'LEAD_CAPTURED',
        category: 'INFORMATION',
        entityType: 'LEAD',
        entityId: lead.id,
        actionUrl: '/dashboard/leads',
      });
    }

    // Same response for new and returning addresses — don't echo the lead row.
    res.status(201).json({ message: 'Thank you for your interest!' });
  } catch (error) {
    next(error);
  }
});

// Admin routes require authentication and admin role
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    res.json({ leads });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const lead = await prisma.lead.update({
      where: { id },
      data: { status },
    });
    res.json({ lead });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    await prisma.lead.delete({ where: { id } });
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
