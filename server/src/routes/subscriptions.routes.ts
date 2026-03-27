import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const subscriptionDtoSchema = z.object({
  clientId: z.string().uuid(),
  packageId: z.string().uuid().optional().nullable(),
  plan: z.string().min(1),
  amount: z.number().int().nonnegative(),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).optional(),
  started: z.string().or(z.date()),
  renewal: z.string().or(z.date()).optional().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'TRIAL']).optional(),
  features: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const router = Router();
router.use(authenticate);
// ─── GET /api/subscriptions ──────────────────────────────────────

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true } },
        package: { select: { id: true, name: true } },
      },
    });
    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/subscriptions/:id ──────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id as string },
      include: { client: true, package: true },
    });

    if (!subscription) throw AppError.notFound('Subscription not found');

    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client || subscription.clientId !== client.id) throw AppError.forbidden('Access denied');
    }

    res.json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/subscriptions ────────────────────────────────────

router.post('/', requireAdmin, validate({ body: subscriptionDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const subscription = await prisma.subscription.create({ data: req.body });
    res.status(201).json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/subscriptions/:id ─────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: subscriptionDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const subscription = await prisma.subscription.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/subscriptions/:id ──────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.subscription.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Subscription deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
