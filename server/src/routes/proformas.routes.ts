import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const proformaItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

const proformaDtoSchema = z.object({
  proformaNumber: z.string().min(1),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  items: z.array(proformaItemSchema).optional(),
});

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

    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client || proforma.clientId !== client.id) throw AppError.forbidden('Access denied');
    }

    res.json({ proforma });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/proformas ─────────────────────────────────────────

router.post('/', requireAdmin, validate({ body: proformaDtoSchema }), async (req: Request, res: Response, next) => {
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

router.put('/:id', requireAdmin, validate({ body: proformaDtoSchema.partial() }), async (req: Request, res: Response, next) => {
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
