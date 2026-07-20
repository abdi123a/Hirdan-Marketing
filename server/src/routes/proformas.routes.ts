import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { sendEmail, generateEmailHtml, generateProformaFollowUpEmailHtml } from '../lib/email.js';
import { createNotification } from '../lib/notifications.js';
import { auditLog } from '../lib/audit.js';

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

    let createdInvoice: any = null;
    if (statusChangedToAccepted) {
      const clientName = (proforma as any).client?.company || (proforma as any).client?.name || 'Unknown';
      createNotification({
        title: 'Proposal Accepted 🎉',
        message: `Proforma ${proforma.proformaNumber} has been accepted by ${clientName}.`,
        type: 'PROFORMA_ACCEPTED',
        category: 'SUCCESS',
        entityType: 'PROFORMA',
        entityId: proforma.proformaNumber || proforma.id,
        actionUrl: `/dashboard/proforma/view/${proforma.proformaNumber || proforma.id}`,
      });

      // Automatically generate a unique short invoice number
      let invoiceNumber = '';
      while (true) {
        const num = Math.floor(Math.random() * 9000 + 1000);
        invoiceNumber = `INV-${num}`;
        const existing = await prisma.invoice.findUnique({
          where: { invoiceNumber }
        });
        if (!existing) {
          break;
        }
      }

      // Map proforma items to invoice items
      const invoiceItems = proforma.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        position: item.position,
      }));

      const finalItems = invoiceItems.length > 0
        ? invoiceItems
        : [{ description: "Services rendered", quantity: 1, unitPrice: proforma.amount, position: 0 }];

      // Compute total invoice amount
      const subtotal = finalItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      let computedAmount = subtotal;
      if (proforma.discount != null && proforma.discountType) {
        if (proforma.discountType === 'FIXED') {
          computedAmount -= Math.round(proforma.discount);
        } else {
          computedAmount -= Math.round(computedAmount * (proforma.discount / 100));
        }
      }
      if (proforma.taxRate != null) {
        computedAmount += Math.round(computedAmount * (proforma.taxRate / 100));
      }
      if (computedAmount < 0) computedAmount = 0;

      // Set due date to 14 days from now if not specified
      const dueDate = proforma.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Create the invoice
      createdInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: proforma.clientId,
          amount: computedAmount,
          status: 'PENDING',
          date: new Date(),
          dueDate,
          notes: proforma.notes,
          taxRate: proforma.taxRate,
          discount: proforma.discount,
          discountType: proforma.discountType,
          deposit: proforma.deposit,
          showSignature: proforma.showSignature,
          showStamp: proforma.showStamp,
          deliveryNoteEnabled: proforma.deliveryNoteEnabled,
          deliveryNoteTitle: proforma.deliveryNoteTitle,
          deliveryNoteContent: proforma.deliveryNoteContent,
          items: {
            create: finalItems
          }
        },
        include: {
          client: { select: { name: true, company: true, userId: true } }
        }
      });

      // Audit Log the invoice creation
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
      auditLog({
        action: 'invoice.create',
        success: true,
        userId: req.user!.userId,
        invoiceId: createdInvoice.id,
        clientId: createdInvoice.clientId,
        ip
      });

      // Notify Admin/Staff of the new invoice
      createNotification({
        title: 'New Invoice Created',
        message: `Invoice ${invoiceNumber} for ${clientName} has been created from Proforma ${proforma.proformaNumber}.`,
        type: 'INVOICE_CREATED',
        category: 'INFORMATION',
        entityType: 'INVOICE',
        entityId: invoiceNumber,
        actionUrl: `/dashboard/invoices/view/${createdInvoice.id}`,
      });

      // Notify Client of the new invoice
      const clientUser = (createdInvoice as any).client;
      if (clientUser?.userId) {
        createNotification({
          title: 'New Invoice Issued 🧾',
          message: `Invoice ${invoiceNumber} has been issued for your account.`,
          type: 'INVOICE_CREATED',
          category: 'ACTION_REQUIRED',
          entityType: 'INVOICE',
          entityId: invoiceNumber,
          userId: clientUser.userId,
          actionUrl: `/portal?tab=financials`,
        });
      }
    }

    res.json({
      proforma,
      invoiceId: createdInvoice?.id,
      invoiceNumber: createdInvoice?.invoiceNumber
    });
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
      },
      include: {
        client: true,
        items: { orderBy: { position: 'asc' } },
      },
    });
    if (!targetProforma) throw AppError.notFound('Proforma not found');

    const { to, cc, subject, body, pdfBase64, filename, isFollowUp, followUpType, customNote, verificationUrl } = req.body;
    if (!to || !subject || !body || !pdfBase64) {
      throw AppError.badRequest('Missing required fields: to, subject, body, and pdfBase64 are required.');
    }

    // Process PDF attachment
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate styled branding HTML
    let emailHtml = '';
    if (isFollowUp) {
      emailHtml = await generateProformaFollowUpEmailHtml({
        clientName: targetProforma.client?.name || targetProforma.client?.company || 'Valued Client',
        clientEmail: to,
        proformaNumber: targetProforma.proformaNumber || targetProforma.id,
        amount: targetProforma.amount,
        date: targetProforma.date ? new Date(targetProforma.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
        dueDate: targetProforma.dueDate ? new Date(targetProforma.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
        customNote: customNote || body,
        verificationUrl,
        followUpType: followUpType || 'GENTLE_REMINDER',
        items: targetProforma.items,
        deposit: targetProforma.deposit ?? undefined,
      });
    } else {
      emailHtml = await generateEmailHtml({
        title: subject,
        preheader: subject,
        contentHtml: `
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6; white-space: pre-line;">${body}</p>
        `,
      });
    }

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

    if (targetProforma.status === 'DRAFT') {
      await prisma.proforma.update({
        where: { id: targetProforma.id },
        data: { status: 'SENT' },
      });
    }

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
    auditLog({
      action: isFollowUp ? 'proforma.send_followup' : 'proforma.send_email',
      success: true,
      userId: req.user!.userId,
      clientId: targetProforma.clientId,
      ip
    });

    res.json({ success: true, message: isFollowUp ? 'Follow-up email sent successfully' : 'Email sent successfully', emailId: result.id });
  } catch (error) {
    next(error);
  }
});

export default router;
