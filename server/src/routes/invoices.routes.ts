import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';
import { auditLog } from '../lib/audit.js';
import { createNotification } from '../lib/notifications.js';
import { syncInvoiceDeposit, invoiceDepositMarker } from '../lib/deposit-sync.js';
import { nextDocumentNumber } from '../lib/document-number.js';
import { cleanRichText, escapeHtml, sanitizeRichHtml } from '../lib/rich-text.js';
import {
  FINANCIAL_FIELDS,
  changedFields,
  discountError,
  isAppendOnlyNotes,
  normalizeItems,
  resolveInvoicePayment,
  resolveTotalCents,
} from '../lib/billing-rules.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { PATHS } from '../lib/paths.js';
import { renderInvoicePdfById } from '../lib/pdf/document-pdf.js';
import { formatCents, computeInvoiceTotalsCents } from '../lib/money.js';

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

// ─── GET /api/invoices/:id/export-pdf ─────────────────────────────
// Puppeteer PDF — same PremiumInvoice design, server-rendered.
router.get('/:id/export-pdf', async (req: Request, res: Response, next) => {
  try {
    const idOrNumber = req.params.id as string;
    const where: any = {
      OR: [{ id: idOrNumber }, { invoiceNumber: idOrNumber }],
    };
    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client) throw AppError.forbidden('Client profile not found');
      where.clientId = client.id;
    }

    const allowed = await prisma.invoice.findFirst({ where, select: { id: true } });
    if (!allowed) throw AppError.notFound('Invoice not found');

    const { buffer, filename } = await renderInvoicePdfById(idOrNumber);

    // Cache on disk for later reuse
    try {
      const pdfPath = path.resolve(PATHS.DOCUMENTS, `Invoice_${allowed.id}.pdf`);
      await fs.writeFile(pdfPath, buffer);
    } catch (fsErr) {
      console.error('[Invoice PDF] Failed to cache PDF:', fsErr);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/invoices ──────────────────────────────────────────

const staffOnly = requireRole('ADMIN', 'MANAGER', 'STAFF');

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  position: z.number().int().optional(),
  discountable: z.boolean().optional(),
});

const invoiceDtoSchema = z.object({
  // Assigned by the server on create (sequential per year); on update an
  // explicit, unique number may be set manually.
  invoiceNumber: z.string().trim().min(1).optional(),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative().optional(),
  status: z.enum(['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional().nullable(),
  discount: z.number().min(0).optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  deposit: z.number().int().nonnegative().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  showSignature: z.boolean().optional(),
  showStamp: z.boolean().optional(),
  deliveryNoteEnabled: z.boolean().optional(),
  deliveryNoteTitle: z.string().optional().nullable(),
  deliveryNoteContent: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).optional(),
});

/** document-number.ts types its client against the base (un-extended) Prisma client. */
const counterClient = (tx: unknown) => tx as Parameters<typeof nextDocumentNumber>[1];

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

function isRecordNotFound(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2025';
}

router.post('/', staffOnly, validate({ body: invoiceDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    // Any client-sent invoiceNumber is ignored: numbers are allocated below.
    const { items, invoiceNumber: _ignoredNumber, amount: sentAmount, status, deposit, ...invoiceData } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
    const discountMsg = discountError(invoiceData.discount, invoiceData.discountType);
    if (discountMsg) throw AppError.badRequest(discountMsg);
    if (invoiceData.deliveryNoteContent !== undefined) {
      invoiceData.deliveryNoteContent = cleanRichText(invoiceData.deliveryNoteContent);
    }
    const itemsWithPosition = normalizeItems(items);
    // The server is authoritative for the total whenever line items exist —
    // client-side rounding differences must never reject a save.
    const amount = itemsWithPosition?.length
      ? computeInvoiceTotalsCents({
          items: itemsWithPosition,
          taxRate: invoiceData.taxRate ?? null,
          discount: invoiceData.discount ?? null,
          discountType: invoiceData.discountType ?? null,
        }).totalCents
      : sentAmount ?? 0;
    const payment = resolveInvoicePayment({
      amount,
      deposit,
      status: status ?? 'PENDING',
      financialChange: true,
    });
    if (!payment.ok) throw AppError.badRequest(payment.error);

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber('INV', counterClient(tx));
      const created = await tx.invoice.create({
        data: {
          ...invoiceData,
          invoiceNumber,
          amount,
          status: payment.status,
          deposit: payment.deposit,
          items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
        },
        include: {
          client: { select: { name: true, company: true, userId: true } },
          items: { orderBy: { position: 'asc' } },
        },
      });
      await syncInvoiceDeposit(created.id, tx);
      return created;
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

    res.status(201).json({ invoice });
  } catch (error) {
    auditLog({ action: 'invoice.create', success: false, userId: req.user!.userId, ip: req.ip });
    if (isUniqueViolation(error)) {
      next(AppError.conflict('Could not allocate a unique invoice number, please retry.'));
      return;
    }
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
      // Clients may only append a comment to the notes.
      const sanitized: any = {};
      if (req.body.notes !== undefined) {
        if (!isAppendOnlyNotes(targetInvoice.notes, req.body.notes)) {
          throw AppError.badRequest('You can only add a comment to the invoice notes.');
        }
        sanitized.notes = req.body.notes;
      }
      req.body = sanitized;
    }

    const { items, invoiceNumber, amount: sentAmount, status: sentStatus, deposit: sentDeposit, ...invoiceData } = req.body;
    if (invoiceData.deliveryNoteContent !== undefined) {
      invoiceData.deliveryNoteContent = cleanRichText(invoiceData.deliveryNoteContent);
    }
    const itemsWithPosition = normalizeItems(items);
    const currentItems = await prisma.invoiceItem.findMany({
      where: { invoiceId: targetInvoice.id },
      orderBy: { position: 'asc' },
    });

    const changed = changedFields(
      { ...req.body, items: itemsWithPosition, deliveryNoteContent: invoiceData.deliveryNoteContent },
      targetInvoice as unknown as Record<string, unknown>,
      currentItems
    );
    const nextTaxRate = invoiceData.taxRate !== undefined ? invoiceData.taxRate : targetInvoice.taxRate;
    const nextDiscount = invoiceData.discount !== undefined ? invoiceData.discount : targetInvoice.discount;
    const nextDiscountType =
      invoiceData.discountType !== undefined ? invoiceData.discountType : targetInvoice.discountType;
    const discountMsg = discountError(nextDiscount, nextDiscountType);
    if (discountMsg) throw AppError.badRequest(discountMsg);

    // A discount type without a discount changes nothing financially.
    const financialChange = changed.some(
      (key) =>
        (FINANCIAL_FIELDS as readonly string[]).includes(key) &&
        !(key === 'discountType' && !nextDiscount && !targetInvoice.discount)
    );

    // Paid invoices are locked: what was invoiced and paid can only change
    // after the status is moved away from PAID (status changes stay allowed).
    if (targetInvoice.status === 'PAID' && financialChange) {
      throw AppError.conflict('This invoice is marked as paid. Change the invoice status first.');
    }

    // Server-authoritative total — a client-sent `amount` is only used for
    // invoices without line items. Nothing is recomputed when nothing that
    // affects the total changed.
    const amount = resolveTotalCents({
      items: itemsWithPosition ?? currentItems,
      explicitAmount: sentAmount,
      affectsTotal: financialChange,
      current: targetInvoice,
      next: { taxRate: nextTaxRate, discount: nextDiscount, discountType: nextDiscountType },
    });

    const payment = resolveInvoicePayment({
      amount,
      deposit: sentDeposit !== undefined ? sentDeposit : targetInvoice.deposit,
      status: sentStatus ?? targetInvoice.status,
      previousStatus: targetInvoice.status,
      financialChange,
    });
    if (!payment.ok) throw AppError.badRequest(payment.error);

    // Manual renumbering (staff only — clients never reach here with it).
    const renumber =
      invoiceNumber !== undefined && invoiceNumber !== targetInvoice.invoiceNumber ? invoiceNumber : undefined;

    const statusChangedToPaid = targetInvoice.status !== 'PAID' && payment.status === 'PAID';

    // The invoice write and its ledger deposit commit together. The status
    // guard makes a concurrent "mark as paid" win over a stale edit.
    let invoice;
    try {
      invoice = await prisma.$transaction(async (tx) => {
        const updated = await tx.invoice.update({
          where: { id: targetInvoice.id, status: targetInvoice.status },
          data: {
            ...invoiceData,
            ...(renumber !== undefined ? { invoiceNumber: renumber } : {}),
            amount,
            status: payment.status,
            deposit: payment.deposit,
            items:
              itemsWithPosition && changed.includes('items')
                ? { deleteMany: {}, create: itemsWithPosition }
                : undefined,
          },
          include: { items: { orderBy: { position: 'asc' } } },
        });
        await syncInvoiceDeposit(updated.id, tx);
        return updated;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw AppError.conflict('That invoice number is already in use.');
      if (isRecordNotFound(error)) throw AppError.conflict('The invoice was changed by someone else. Reload and try again.');
      throw error;
    }

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

    const newStatus = payment.status;
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

    res.json({ invoice });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/invoices/:id ─────────────────────────────────────

router.delete('/:id', staffOnly, async (req: Request, res: Response, next) => {
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
    if (targetInvoice.status === 'PAID') {
      throw AppError.conflict('This invoice is marked as paid. Change the invoice status first.');
    }

    await prisma.$transaction(async (tx) => {
      // Linked ledger deposits cascade with the invoice; also remove legacy
      // rows written before deposits carried an invoice_id.
      await tx.deposit.deleteMany({
        where: { invoiceId: null, description: { contains: invoiceDepositMarker(targetInvoice.id) } },
      });
      await tx.invoice.delete({ where: { id: targetInvoice.id, status: targetInvoice.status } });
    });
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    if (isRecordNotFound(error)) {
      next(AppError.conflict('The invoice was changed by someone else. Reload and try again.'));
      return;
    }
    next(error);
  }
});

router.post('/:id/send-email', staffOnly, async (req: Request, res: Response, next) => {
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

    const { to, cc, subject, body, filename } = req.body;
    if (!to || !subject || !body || typeof body !== 'string') {
      throw AppError.badRequest('Missing required fields: to, subject, and body are required.');
    }

    // Server-render PDF (Puppeteer) — never trust client-uploaded PDF bytes
    const { buffer, filename: renderedFilename } = await renderInvoicePdfById(targetInvoice.id);

    const pdfPath = path.resolve(PATHS.DOCUMENTS, `Invoice_${targetInvoice.id}.pdf`);
    try {
      await fs.writeFile(pdfPath, buffer);
    } catch (fsErr) {
      console.error('[Email] Failed to save invoice PDF to system:', fsErr);
    }

    // The body is user-authored: rich text goes through the allowlist,
    // plain text is escaped (newlines are kept by white-space: pre-line).
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
    const safeBody = isHtml ? sanitizeRichHtml(body) : escapeHtml(body);

    // Generate styled branding HTML
    const emailHtml = await generateEmailHtml({
      title: subject,
      preheader: subject,
      contentHtml: isHtml
        ? `<div style="margin: 0 0 16px; color: #475569; line-height: 1.6;">${safeBody}</div>`
        : `<p style="margin: 0 0 16px; color: #475569; line-height: 1.6; white-space: pre-line;">${safeBody}</p>`,
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
          filename: filename || renderedFilename || `Invoice_${targetInvoice.invoiceNumber || targetInvoice.id}.pdf`,
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
    const amountFormatted = formatCents(inv.amount, currencySymbol);

    const subject = `Payment Confirmed: Invoice ${inv.invoiceNumber}`;

    const paymentDate = new Date();
    const monthPaid = paymentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Prefer cached PDF; otherwise render via Puppeteer
    const pdfPath = path.resolve(PATHS.DOCUMENTS, `Invoice_${inv.id}.pdf`);
    let pdfBuffer: Buffer | null = null;
    if (fsSync.existsSync(pdfPath)) {
      try {
        pdfBuffer = await fs.readFile(pdfPath);
      } catch (err) {
        console.error(`[Email] Failed to read invoice PDF from system at ${pdfPath}:`, err);
      }
    }
    if (!pdfBuffer) {
      try {
        const rendered = await renderInvoicePdfById(inv.id);
        pdfBuffer = rendered.buffer;
        try {
          await fs.writeFile(pdfPath, pdfBuffer);
        } catch (fsErr) {
          console.error('[Email] Failed to cache payment-confirmation PDF:', fsErr);
        }
      } catch (err) {
        console.error(`[Email] Failed to render invoice PDF for payment confirmation:`, err);
      }
    }

    const attachmentText = pdfBuffer
      ? `<p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        A copy of your official PDF invoice has been attached to this email and is available for download at any time by logging in to your Client Portal.
      </p>`
      : `<p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        A copy of your official PDF invoice is available for download at any time by logging in to your Client Portal.
      </p>`;

    let itemsRows = '';
    const items = inv.items || [];
    for (const item of items) {
      const itemTotal = (item.quantity * item.unitPrice / 100).toFixed(2);
      itemsRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${sanitizeRichHtml(item.description || '')}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: right;">${currencySymbol} ${(item.unitPrice / 100).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: right;">${currencySymbol} ${itemTotal}</td>
        </tr>
      `;
    }

    const contentHtml = `
      <h2 style="color: #10b981; font-size: 20px; margin-bottom: 16px;">Thank you for your payment!</h2>
      <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        We have successfully received and processed your payment for invoice <strong>${escapeHtml(inv.invoiceNumber)}</strong>.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px; overflow: hidden;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
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
            <td style="color: #334155; font-size: 14px; text-align: right;">${escapeHtml(inv.paymentMethod || 'Credit Card / Bank Transfer')}</td>
          </tr>
        </table>
      </div>
      <h3 style="color: #334155; font-size: 16px; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Invoice Summary</h3>
      <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; margin-bottom: 24px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 12px; text-align: left; color: #475569; font-size: 13px;">Description</th>
              <th style="padding: 12px; text-align: center; color: #475569; font-size: 13px; width: 60px;">Qty</th>
              <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; width: 100px;">Price</th>
              <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; width: 100px;">Total</th>
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
      </div>
      ${attachmentText}
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

    const result = await sendEmail({
      to: inv.client.email,
      subject,
      html: emailHtml,
      attachments: pdfBuffer ? [
        {
          content: pdfBuffer,
          filename: `Invoice_${inv.invoiceNumber || inv.id}.pdf`,
          contentType: 'application/pdf',
        }
      ] : undefined
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
