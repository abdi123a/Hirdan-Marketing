import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
// Authentication is required for all routes, admin for modifications

// ─── GET /api/packages ───────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const packages = await prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        packageServices: { include: { service: true } },
        _count: { select: { subscriptions: true } },
      },
    });
    res.json({ packages });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/packages/:id ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id as string },
      include: {
        packageServices: { include: { service: true } },
        subscriptions: true,
      },
    });

    if (!pkg) throw AppError.notFound('Package not found');
    res.json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/packages ─────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const pkg = await prisma.package.create({ data: req.body });
    res.status(201).json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/packages/:id ──────────────────────────────────────

router.put('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const pkg = await prisma.package.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ package: pkg });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/packages/:id ───────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.package.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Package deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
