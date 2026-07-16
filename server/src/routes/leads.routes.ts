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

const leadsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/leads ──────────────────────────────────────────────
// Public route to collect emails
router.post(
  '/',
  leadsLimiter,
  validate({ body: z.object({ email: z.string().email() }) }),
  async (req: Request, res: Response, next) => {
  try {
    const { email } = req.body;

    const lead = await prisma.lead.upsert({
      where: { email },
      update: { status: 'PENDING' }, // Re-activate if they submit again
      create: { email },
    });

    // Fire notification only on first capture (not re-submissions)
    if (lead.createdAt.getTime() === lead.updatedAt.getTime() || Math.abs(lead.createdAt.getTime() - new Date().getTime()) < 5000) {
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

    res.status(201).json({ lead, message: 'Thank you for your interest!' });
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
