import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { runBillingCycle } from '../lib/subscription-billing.js';
import { createNotification } from '../lib/notifications.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';

const subscriptionDtoSchema = z.object({
  clientId: z.string().uuid(),
  packageId: z.string().uuid().optional().nullable(),
  plan: z.string().min(1),
  amount: z.number().int().nonnegative(),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional().nullable(),
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

    const { take, skip } = parsePagination(req.query, { maxTake: 100, defaultTake: 50 });
    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        client: { select: { id: true, name: true, company: true } },
        package: {
          select: {
            id: true,
            name: true,
            deliverables: {
              include: { platforms: { select: { platform: true } } },
            },
          },
        },
        _count: { select: { cycles: true, deliverableTasks: true } },
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
    const where: any = { id: req.params.id as string };
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const subscription = await prisma.subscription.findFirst({
      where,
      include: {
        client: true,
        package: {
          include: {
            deliverables: {
              include: { platforms: { select: { platform: true } } },
            },
          },
        },
        cycles: {
          orderBy: { cycleStart: 'desc' },
          include: {
            _count: { select: { deliverableTasks: true } },
          },
        },
      },
    });

    if (!subscription) throw AppError.notFound('Subscription not found');

    res.json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/subscriptions ────────────────────────────────────

router.post('/', requireAdmin, validate({ body: subscriptionDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const subscription = await prisma.subscription.create({
      data: req.body,
      include: { client: { select: { name: true, company: true } } },
    });
    const clientName = (subscription as any).client?.company || (subscription as any).client?.name || 'Unknown';
    createNotification({
      title: 'Subscription Activated 🎉',
      message: `Subscription "${subscription.plan}" for ${clientName} has been activated.`,
      type: 'SUBSCRIPTION_ACTIVATED',
      category: 'SUCCESS',
      entityType: 'SUBSCRIPTION',
      entityId: subscription.id,
      actionUrl: `/dashboard/subscriptions/${subscription.id}`,
    });
    res.status(201).json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/subscriptions/:id ─────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: subscriptionDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const prev = await prisma.subscription.findUnique({ where: { id: req.params.id as string } });
    const subscription = await prisma.subscription.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    if (prev && req.body.status && prev.status !== req.body.status) {
      if (req.body.status === 'CANCELLED') {
        createNotification({
          title: 'Subscription Cancelled',
          message: `Subscription "${subscription.plan}" has been cancelled.`,
          type: 'SUBSCRIPTION_CANCELLED',
          category: 'ACTION_REQUIRED',
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          actionUrl: `/dashboard/subscriptions/${subscription.id}`,
        });
      }
    }
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

// ─── POST /api/subscriptions/run-billing-cycle ──────────────────
router.post('/run-billing-cycle', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await runBillingCycle();
    res.json({ success: true, message: 'Subscription billing cycle executed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
