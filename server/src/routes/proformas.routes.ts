import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { createNotification } from '../lib/notifications.js';

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

router.put('/:id', validate({ body: proformaDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const isClient = req.user!.role === 'CLIENT';
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER' || req.user!.role === 'STAFF';
    
    if (!isAdmin && !isClient) {
      throw AppError.forbidden('Insufficient permissions');
    }

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

    if (isClient) {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client || targetProforma.clientId !== client.id) {
        throw AppError.forbidden('You do not have access to this proforma');
      }
      const sanitized: any = {};
      if (req.body.notes !== undefined) sanitized.notes = req.body.notes;
      if (req.body.status !== undefined) sanitized.status = req.body.status;
      req.body = sanitized;
    }

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
    const statusChangedToAccepted = targetProforma.status !== 'ACCEPTED' && proformaData.status === 'ACCEPTED';
    const proforma = await prisma.proforma.update({
      where: { id: targetProforma.id },
      data: {
        ...proformaData,
        items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
      },
      include: {
        client: { select: { name: true, company: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });

    if (statusChangedToAccepted) {
      const clientName = (proforma as any).client?.company || (proforma as any).client?.name || 'Unknown';
      createNotification({
        title: 'Proposal Accepted 🎉',
        message: `Proforma ${proforma.proformaNumber} has been accepted by ${clientName}.`,
        type: 'PROFORMA_ACCEPTED',
        category: 'SUCCESS',
        entityType: 'PROFORMA',
        entityId: proforma.proformaNumber || proforma.id,
        actionUrl: `/dashboard/proformas/${proforma.proformaNumber || proforma.id}`,
      });
    }

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

router.post('/:id/send-email', requireAdmin, async (req: Request, res: Response, next) => {
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
          filename: filename || `Proforma_${targetProforma.proformaNumber || targetProforma.id}.pdf`,
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
