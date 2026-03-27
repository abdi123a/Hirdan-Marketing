import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
// ─── GET /api/invoices ────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        items: true,
      },
    });
    res.json({ invoices });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/invoices/:id ────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
      include: {
        client: true,
        items: true,
      },
    });

    if (!invoice) throw AppError.notFound('Invoice not found');

    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client || invoice.clientId !== client.id) throw AppError.forbidden('Access denied');
    }

    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/invoices ──────────────────────────────────────────

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

const invoiceDtoSchema = z.object({
  invoiceNumber: z.string().min(1),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  taxRate: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  deposit: z.number().int().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).optional(),
});

router.post('/', requireAdmin, validate({ body: invoiceDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const { items, ...invoiceData } = req.body;
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        items: items ? { create: items } : undefined,
      },
      include: { items: true },
    });
    res.status(201).json({ invoice });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/invoices/:id ────────────────────────────────────────

router.put('/:id', requireAdmin, validate({ body: invoiceDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const { items, ...invoiceData } = req.body;

    // If items are provided, delete existing and recreate
    if (items) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id as string } });
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id as string },
      data: {
        ...invoiceData,
        items: items ? { create: items } : undefined,
      },
      include: { items: true },
    });
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/invoices/:id ─────────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
