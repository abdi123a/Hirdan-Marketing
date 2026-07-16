import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { z } from 'zod';
import { generateInvoicePdf } from '../lib/pdf.js';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';
import { auditLog } from '../lib/audit.js';
import { createNotification } from '../lib/notifications.js';
import { syncInvoiceDeposit } from '../lib/deposit-sync.js';

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
      include: {
        client: { select: { name: true, company: true, userId: true } },
        items: { orderBy: { position: 'asc' } },
      },
    });
    const clientName = (invoice as any).client?.company || (invoice as any).client?.name || 'Unknown';
    auditLog({ action: 'invoice.create', success: true, userId: req.user!.userId, invoiceId: invoice.id, clientId: invoice.clientId, ip });
    
    // 1. Notify Admin/Staff (Global)
    createNotification({
      title: 'New Invoice Created',
      message: `Invoice ${invoice.invoiceNumber} for ${clientName} has been created.`,
      type: 'INVOICE_CREATED',
      category: 'INFORMATION',
      entityType: 'INVOICE',
      entityId: invoice.invoiceNumber || invoice.id,
      actionUrl: `/dashboard/invoices/view/${invoice.invoiceNumber || invoice.id}`,
    });

    // 2. Notify Client
    const clientUser = (invoice as any).client;
    if (clientUser?.userId) {
      createNotification({
        title: 'New Invoice Issued 🧾',
        message: `Invoice ${invoice.invoiceNumber} has been issued for your account.`,
        type: 'INVOICE_CREATED',
        category: 'ACTION_REQUIRED',
        entityType: 'INVOICE',
        entityId: invoice.invoiceNumber || invoice.id,
        actionUrl: `/client/portal?tab=financials`,
        userId: clientUser.userId,
      });
    }
    
    await syncInvoiceDeposit(invoice.id);

    res.status(201).json({ invoice });
  } catch (error) {
    auditLog({ action: 'invoice.create', success: false, userId: req.user!.userId, ip: req.ip });
    next(error);
  }
});

router.put('/:id', validate({ body: invoiceDtoSchema.partial() }), async (req: Request, res: Response, next) => {
  try {
    const isClient = req.user!.role === 'CLIENT';
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER' || req.user!.role === 'STAFF';
    
    if (!isAdmin && !isClient) {
      throw AppError.forbidden('Insufficient permissions');
    }

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

    if (isClient) {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client || targetInvoice.clientId !== client.id) {
        throw AppError.forbidden('You do not have access to this invoice');
      }
      const sanitized: any = {};
      if (req.body.notes !== undefined) sanitized.notes = req.body.notes;
      req.body = sanitized;
    }

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

    const statusChangedToPaid = targetInvoice.status !== 'PAID' && invoiceData.status === 'PAID';

    const invoice = await prisma.invoice.update({
      where: { id: targetInvoice.id },
      data: {
        ...invoiceData,
        ...(computedAmount !== undefined ? { amount: computedAmount } : {}),
        items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });

    if (statusChangedToPaid) {
      sendPaymentConfirmationEmail(invoice.id).catch(err => {
        console.error('Error sending automatic payment confirmation email:', err);
      });
      createNotification({
        title: 'Invoice Paid ✅',
        message: `Invoice ${invoice.invoiceNumber} has been marked as paid.`,
        type: 'INVOICE_PAID',
        category: 'SUCCESS',
        entityType: 'INVOICE',
        entityId: invoice.invoiceNumber || invoice.id,
        actionUrl: `/dashboard/invoices/view/${invoice.invoiceNumber || invoice.id}`,
      });
    }

    const newStatus = (req.body as any).status;
    if (newStatus && targetInvoice.status !== newStatus) {
      if (newStatus === 'PARTIALLY_PAID') {
        createNotification({
          title: 'Invoice Partially Paid',
          message: `Invoice ${invoice.invoiceNumber} has received a partial payment.`,
          type: 'INVOICE_PARTIALLY_PAID',
          category: 'ACTION_REQUIRED',
          entityType: 'INVOICE',
          entityId: invoice.invoiceNumber || invoice.id,
          actionUrl: `/dashboard/invoices/view/${invoice.invoiceNumber || invoice.id}`,
        });
      } else if (newStatus === 'OVERDUE') {
        createNotification({
          title: 'Invoice Overdue ⚠️',
          message: `Invoice ${invoice.invoiceNumber} is now overdue.`,
          type: 'INVOICE_OVERDUE',
          category: 'ACTION_REQUIRED',
          entityType: 'INVOICE',
          entityId: invoice.invoiceNumber || invoice.id,
          actionUrl: `/dashboard/invoices/view/${invoice.invoiceNumber || invoice.id}`,
        });
      }
    }
    
    await syncInvoiceDeposit(invoice.id);

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

    // Delete corresponding deposit(s) if any
    await prisma.deposit.deleteMany({
      where: {
        description: {
          contains: `(ID: ${targetInvoice.id})`,
        },
      },
    });

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

async function sendPaymentConfirmationEmail(invoiceId: string) {
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        items: { orderBy: { position: 'asc' } }
      }
    });

    if (!inv || !inv.client?.email || inv.paymentConfirmationSentAt) {
      return;
    }

    const settings = await prisma.agencySettings.findFirst();
    const currencySymbol = settings?.currency ?? 'USD';
    const amountFormatted = `${currencySymbol} ${(inv.amount / 100).toFixed(2)}`;

    const subject = `Payment Confirmed: Invoice ${inv.invoiceNumber}`;

    const paymentDate = new Date();
    const monthPaid = paymentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    let itemsRows = '';
    const items = inv.items || [];
    for (const item of items) {
      const itemTotal = (item.quantity * item.unitPrice / 100).toFixed(2);
      itemsRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: right;">${currencySymbol} ${(item.unitPrice / 100).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: right;">${currencySymbol} ${itemTotal}</td>
        </tr>
      `;
    }

    const contentHtml = `
      <h2 style="color: #10b981; font-size: 20px; margin-bottom: 16px;">Thank you for your payment!</h2>
      <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        We have successfully received and processed your payment for invoice <strong>${inv.invoiceNumber}</strong>.
      </p>
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="color: #64748b; font-size: 14px; padding-bottom: 8px;"><strong>Invoice Date:</strong></td>
            <td style="color: #334155; font-size: 14px; padding-bottom: 8px; text-align: right;">${inv.date.toISOString().split('T')[0]}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-size: 14px; padding-bottom: 8px;"><strong>Month Paid:</strong></td>
            <td style="color: #334155; font-size: 14px; padding-bottom: 8px; text-align: right;">${monthPaid}</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-size: 14px;"><strong>Payment Method:</strong></td>
            <td style="color: #334155; font-size: 14px; text-align: right;">${inv.paymentMethod || 'Credit Card / Bank Transfer'}</td>
          </tr>
        </table>
      </div>
      <h3 style="color: #334155; font-size: 16px; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Invoice Summary</h3>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="padding: 8px 12px; text-align: left; color: #475569; font-size: 13px;">Description</th>
            <th style="padding: 8px 12px; text-align: center; color: #475569; font-size: 13px; width: 60px;">Qty</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-size: 13px; width: 100px;">Price</th>
            <th style="padding: 8px 12px; text-align: right; color: #475569; font-size: 13px; width: 100px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
          <tr>
            <td colspan="2"></td>
            <td style="padding: 12px 8px; font-weight: bold; color: #334155; text-align: right;">Total Paid:</td>
            <td style="padding: 12px 8px; font-weight: bold; color: #10b981; text-align: right; font-size: 16px;">${amountFormatted}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        A copy of your official PDF invoice has been attached to this email and is available for download at any time by logging in to your Client Portal.
      </p>
    `;

    const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const emailHtml = await generateEmailHtml({
      title: subject,
      preheader: `Payment confirmation for invoice ${inv.invoiceNumber}.`,
      contentHtml,
      actionButton: {
        label: 'View in Portal',
        url: `${appUrl}/dashboard/invoices`,
      }
    });

    // Generate PDF invoice attachment
    const pdfBuffer = await generateInvoicePdf(inv, inv.client, settings, monthPaid);

    const result = await sendEmail({
      to: inv.client.email,
      subject,
      html: emailHtml,
      attachments: [
        {
          content: pdfBuffer,
          filename: `Invoice_${inv.invoiceNumber || inv.id}.pdf`,
          contentType: 'application/pdf',
        }
      ]
    });

    if (result.success) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { paymentConfirmationSentAt: new Date() }
      });
      console.log(`[Email] Automatic payment confirmation email sent to ${inv.client.email} for invoice ${inv.invoiceNumber}`);
    } else {
      console.error(`[Email] Failed to send payment confirmation email: ${result.error}`);
    }
  } catch (err) {
    console.error('[Email] Unexpected error in sendPaymentConfirmationEmail:', err);
  }
}

export default router;
