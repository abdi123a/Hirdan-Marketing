import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

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
    res.json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/subscriptions ────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const subscription = await prisma.subscription.create({ data: req.body });
    res.status(201).json({ subscription });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/subscriptions/:id ─────────────────────────────────

router.put('/:id', requireAdmin, async (req: Request, res: Response, next) => {
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
