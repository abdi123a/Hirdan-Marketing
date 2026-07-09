import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';
import { auditLog } from '../lib/audit.js';

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

    const { take, skip } = parsePagination(req.query, { maxTake: 100, defaultTake: 50 });
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      take,
      skip,
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
        items: { orderBy: { position: 'asc' } },
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
    const where: any = {
      OR: [
        { id: req.params.id as string },
        { invoiceNumber: req.params.id as string }
      ]
    };
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const invoice = await prisma.invoice.findFirst({
      where,
      include: {
        client: true,
        items: { orderBy: { position: 'asc' } },
      },
    });

    if (!invoice) throw AppError.notFound('Invoice not found');

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
  position: z.number().int().optional(),
});

const invoiceDtoSchema = z.object({
  invoiceNumber: z.string().min(1),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative().optional(),
  status: z.enum(['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  taxRate: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  deposit: z.number().int().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  showSignature: z.boolean().optional(),
  showStamp: z.boolean().optional(),
  deliveryNoteEnabled: z.boolean().optional(),
  deliveryNoteTitle: z.string().optional().nullable(),
  deliveryNoteContent: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).optional(),
});

function computeInvoiceTotal(input: {
  items?: Array<{ quantity: number; unitPrice: number }>;
  taxRate?: number | null;
  discount?: number | null;
  discountType?: 'PERCENTAGE' | 'FIXED' | null;
}): number {
  const items = input.items ?? [];
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

  let total = subtotal;
  if (input.discount != null && input.discountType) {
    if (input.discountType === 'FIXED') {
      total -= input.discount;
    } else {
      total -= Math.round(total * (input.discount / 100));
    }
  }
  if (input.taxRate != null) {
    total += Math.round(total * (input.taxRate / 100));
  }
  if (total < 0) total = 0;
  return total;
}

router.post('/', requireAdmin, validate({ body: invoiceDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    const { items, ...invoiceData } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
    const itemsWithPosition = items?.map((item: any, index: number) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      position: item.position !== undefined ? item.position : index,
    }));
    const computedAmount = computeInvoiceTotal({
      items,
      taxRate: invoiceData.taxRate ?? null,
      discount: invoiceData.discount ?? null,
      discountType: invoiceData.discountType ?? null,
    });
    if (invoiceData.amount !== undefined && invoiceData.amount !== computedAmount) {
      throw AppError.badRequest('Invoice amount mismatch');
    }
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        amount: computedAmount,
        items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    auditLog({ action: 'invoice.create', success: true, userId: req.user!.userId, invoiceId: invoice.id, clientId: invoice.clientId, ip });
    res.status(201).json({ invoice });
  } catch (error) {
    auditLog({ action: 'invoice.create', success: false, userId: req.user!.userId, ip: req.ip });
    next(error);
  }
});

router.put('/:id', requireAdmin, validate({ body: invoiceDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    // Find the invoice first to get the real UUID if an invoiceNumber was provided
    const targetInvoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: req.params.id as string },
          { invoiceNumber: req.params.id as string }
        ]
      }
    });

    if (!targetInvoice) throw AppError.notFound('Invoice not found');

    const { items, ...invoiceData } = req.body;
    const itemsWithPosition = items?.map((item: any, index: number) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      position: item.position !== undefined ? item.position : index,
    }));

    // If items are provided, delete existing and recreate
    if (items) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: targetInvoice.id } });
    }

    const computedAmount =
      items || invoiceData.taxRate !== undefined || invoiceData.discount !== undefined || invoiceData.discountType !== undefined
        ? computeInvoiceTotal({
            items: items ?? (await prisma.invoiceItem.findMany({ where: { invoiceId: targetInvoice.id } })),
            taxRate: invoiceData.taxRate ?? targetInvoice.taxRate ?? null,
            discount: invoiceData.discount ?? targetInvoice.discount ?? null,
            discountType: invoiceData.discountType ?? (targetInvoice.discountType as any) ?? null,
          })
        : undefined;

    if (computedAmount !== undefined && invoiceData.amount !== undefined && invoiceData.amount !== computedAmount) {
      throw AppError.badRequest('Invoice amount mismatch');
    }

    const invoice = await prisma.invoice.update({
      where: { id: targetInvoice.id },
      data: {
        ...invoiceData,
        ...(computedAmount !== undefined ? { amount: computedAmount } : {}),
        items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/invoices/:id ─────────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const targetInvoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: req.params.id as string },
          { invoiceNumber: req.params.id as string }
        ]
      }
    });
    if (!targetInvoice) throw AppError.notFound('Invoice not found');

    await prisma.invoice.delete({ where: { id: targetInvoice.id } });
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/send-email', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const targetInvoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id: req.params.id as string },
          { invoiceNumber: req.params.id as string }
        ]
      }
    });
    if (!targetInvoice) throw AppError.notFound('Invoice not found');

    const { to, cc, subject, body, pdfBase64, filename } = req.body;
    if (!to || !subject || !body || !pdfBase64) {
      throw AppError.badRequest('Missing required fields: to, subject, body, and pdfBase64 are required.');
    }

    // Process PDF attachment
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate styled branding HTML
    const emailHtml = await generateEmailHtml({
      title: subject,
      preheader: subject,
      contentHtml: `
        <p style="margin: 0 0 16px; color: #475569; line-height: 1.6; white-space: pre-line;">${body}</p>
      `,
    });

    // cc can be comma separated, let's split it into an array
    const ccList = typeof cc === 'string'
      ? cc.split(',').map((email: string) => email.trim()).filter(Boolean)
      : cc;

    const result = await sendEmail({
      to,
      cc: ccList && ccList.length > 0 ? ccList : undefined,
      subject,
      html: emailHtml,
      attachments: [
        {
          content: buffer,
          filename: filename || `Invoice_${targetInvoice.invoiceNumber || targetInvoice.id}.pdf`,
          contentType: 'application/pdf',
        }
      ]
    });

    if (!result.success) {
      throw AppError.badRequest(result.error ?? 'Failed to send email.');
    }

    res.json({ success: true, message: 'Email sent successfully', emailId: result.id });
  } catch (error) {
    next(error);
  }
});

export default router;
