import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// ─── POST /api/leads ──────────────────────────────────────────────
// Public route to collect emails
router.post('/', async (req: Request, res: Response, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw AppError.badRequest('Email is required');
    }

    const lead = await prisma.lead.upsert({
      where: { email },
      update: { status: 'PENDING' }, // Re-activate if they submit again
      create: { email },
    });

    res.status(201).json({ lead, message: 'Thank you for your interest!' });
  } catch (error) {
    next(error);
  }
});

// Admin routes require authentication and admin role
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
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
