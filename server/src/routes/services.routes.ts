import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
// Authentication is required for all routes, admin for modifications

// ─── GET /api/services ───────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ services });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/services/:id ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id as string },
      include: {
        packageServices: { include: { package: true } },
      },
    });

    if (!service) throw AppError.notFound('Service not found');
    res.json({ service });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/services ─────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const service = await prisma.service.create({ data: req.body });
    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/services/:id ──────────────────────────────────────

router.put('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const service = await prisma.service.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json({ service });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/services/:id ───────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Service deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
