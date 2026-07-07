import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';

import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';

const proformaItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  position: z.number().int().optional(),
});

const proformaDtoSchema = z.object({
  proformaNumber: z.string().min(1),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_PAID', 'EXPIRED']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  taxRate: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  deposit: z.number().int().optional().nullable(),
  showSignature: z.boolean().optional(),
  showStamp: z.boolean().optional(),
  deliveryNoteEnabled: z.boolean().optional(),
  deliveryNoteTitle: z.string().optional().nullable(),
  deliveryNoteContent: z.string().optional().nullable(),
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

    const { take, skip } = parsePagination(req.query, { maxTake: 100, defaultTake: 50 });
    const proformas = await prisma.proforma.findMany({
      where,
      orderBy: { date: 'desc' },
      take,
      skip,
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        items: { orderBy: { position: 'asc' } },
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
    const proforma = await prisma.proforma.findFirst({
      where: {
        OR: [
          { id: req.params.id as string },
          { proformaNumber: req.params.id as string }
        ]
      },
      include: { client: true, items: { orderBy: { position: 'asc' } } },
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
    const itemsWithPosition = items?.map((item: any, index: number) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      position: item.position !== undefined ? item.position : index,
    }));
    const proforma = await prisma.proforma.create({
      data: {
        ...proformaData,
        items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    res.status(201).json({ proforma });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/proformas/:id ──────────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: proformaDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    // Find the proforma first to get the real UUID if a proformaNumber was provided
    const targetProforma = await prisma.proforma.findFirst({
      where: {
        OR: [
          { id: req.params.id as string },
          { proformaNumber: req.params.id as string }
        ]
      }
    });

    if (!targetProforma) throw AppError.notFound('Proforma not found');

    const { items, ...proformaData } = req.body;
    const itemsWithPosition = items?.map((item: any, index: number) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      position: item.position !== undefined ? item.position : index,
    }));
    if (items) {
      await prisma.proformaItem.deleteMany({ where: { proformaId: targetProforma.id } });
    }
    const proforma = await prisma.proforma.update({
      where: { id: targetProforma.id },
      data: {
        ...proformaData,
        items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    res.json({ proforma });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/proformas/:id ───────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const targetProforma = await prisma.proforma.findFirst({
      where: {
        OR: [
          { id: req.params.id as string },
          { proformaNumber: req.params.id as string }
        ]
      }
    });
    if (!targetProforma) throw AppError.notFound('Proforma not found');

    await prisma.proforma.delete({ where: { id: targetProforma.id } });
    res.json({ message: 'Proforma deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
