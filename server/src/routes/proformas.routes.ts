import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
// ─── GET /api/proformas ───────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const proformas = await prisma.proforma.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        items: true,
      },
    });
    res.json({ proformas });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/proformas/:id ───────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const proforma = await prisma.proforma.findUnique({
      where: { id: req.params.id as string },
      include: { client: true, items: true },
    });

    if (!proforma) throw AppError.notFound('Proforma not found');
    res.json({ proforma });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/proformas ─────────────────────────────────────────

router.post('/', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { items, ...proformaData } = req.body;
    const proforma = await prisma.proforma.create({
      data: {
        ...proformaData,
        items: items ? { create: items } : undefined,
      },
      include: { items: true },
    });
    res.status(201).json({ proforma });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/proformas/:id ──────────────────────────────────────

router.put('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { items, ...proformaData } = req.body;
    if (items) {
      await prisma.proformaItem.deleteMany({ where: { proformaId: req.params.id as string } });
    }
    const proforma = await prisma.proforma.update({
      where: { id: req.params.id as string },
      data: {
        ...proformaData,
        items: items ? { create: items } : undefined,
      },
      include: { items: true },
    });
    res.json({ proforma });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/proformas/:id ───────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.proforma.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Proforma deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
