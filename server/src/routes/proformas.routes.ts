import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { sendEmail, generateEmailHtml, generateProformaFollowUpEmailHtml } from '../lib/email.js';
import { createNotification } from '../lib/notifications.js';
import { auditLog } from '../lib/audit.js';

import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';
import { computeInvoiceTotalsCents, deriveBaseSubtotalCents } from '../lib/money.js';
import { nextDocumentNumber } from '../lib/document-number.js';
import { syncInvoiceDeposit } from '../lib/deposit-sync.js';
import { cleanRichText, escapeHtml, sanitizeRichHtml } from '../lib/rich-text.js';
import {
  FINANCIAL_FIELDS,
  changedFields,
  discountError,
  isAppendOnlyNotes,
  isClientProformaTransitionAllowed,
  normalizeItems,
  resolveInvoicePayment,
  resolveTotalCents,
} from '../lib/billing-rules.js';
import { renderProformaPdfById } from '../lib/pdf/document-pdf.js';
import fs from 'fs/promises';
import path from 'path';
import { PATHS } from '../lib/paths.js';

const proformaItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  position: z.number().int().optional(),
  discountable: z.boolean().optional(),
});

const proformaDtoSchema = z.object({
  // Assigned by the server on create; on update an explicit, unique number
  // may be set manually.
  proformaNumber: z.string().trim().min(1).optional(),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_PAID', 'EXPIRED']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(100).optional().nullable(),
  discount: z.number().min(0).optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  deposit: z.number().int().nonnegative().optional().nullable(),
  showSignature: z.boolean().optional(),
  showStamp: z.boolean().optional(),
  deliveryNoteEnabled: z.boolean().optional(),
  deliveryNoteTitle: z.string().optional().nullable(),
  deliveryNoteContent: z.string().optional().nullable(),
  items: z.array(proformaItemSchema).optional(),
});

const router = Router();
router.use(authenticate);
const staffOnly = requireRole('ADMIN', 'MANAGER', 'STAFF');
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

// ─── GET /api/proformas/:id/export-pdf ────────────────────────────
// Puppeteer PDF — same PremiumInvoice design, server-rendered.
router.get('/:id/export-pdf', async (req: Request, res: Response, next) => {
  try {
    const idOrNumber = req.params.id as string;
    const proforma = await prisma.proforma.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { proformaNumber: idOrNumber }],
      },
      select: { id: true, clientId: true },
    });
    if (!proforma) throw AppError.notFound('Proforma not found');

    if (req.user!.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.userId } });
      if (!client || proforma.clientId !== client.id) throw AppError.forbidden('Access denied');
    }

    const { buffer, filename } = await renderProformaPdfById(idOrNumber);

    // Cache on disk for later reuse
    try {
      const pdfPath = path.resolve(PATHS.DOCUMENTS, `Proforma_${proforma.id}.pdf`);
      await fs.writeFile(pdfPath, buffer);
    } catch (fsErr) {
      console.error('[Proforma PDF] Failed to cache PDF:', fsErr);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/proformas ─────────────────────────────────────────

/** document-number.ts types its client against the base (un-extended) Prisma client. */
const counterClient = (tx: unknown) => tx as Parameters<typeof nextDocumentNumber>[1];
type Tx = Pick<typeof prisma, 'proforma' | 'invoice' | 'deposit' | 'account' | 'agencySettings'>;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

function isRecordNotFound(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2025';
}

const CONVERTED_MESSAGE =
  'This proforma has already been accepted and converted to an invoice. Edit the invoice instead.';

/** Validate totals-related inputs shared by create and update. */
function assertProformaMoney(amount: number, deposit: number | null | undefined, discount: number | null | undefined, discountType: string | null | undefined) {
  const discountMsg = discountError(discount, discountType);
  if (discountMsg) throw AppError.badRequest(discountMsg);
  if ((deposit ?? 0) > amount) throw AppError.badRequest('The deposit cannot exceed the proforma total.');
}

/**
 * Convert an accepted proforma into an invoice, atomically and at most once.
 * Must run inside the caller's transaction: the invoice number, the invoice,
 * its ledger deposit and the proforma's `convertedInvoiceId` claim all commit
 * or roll back together. The claim is a conditional update, so a concurrent
 * or repeated conversion finds `convertedInvoiceId` already set and fails.
 */
async function convertProformaToInvoice(tx: Tx, proformaId: string) {
  const proforma = await tx.proforma.findUniqueOrThrow({
    where: { id: proformaId },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  if (proforma.convertedInvoiceId) throw AppError.conflict(CONVERTED_MESSAGE);

  const invoiceNumber = await nextDocumentNumber('INV', counterClient(tx));

  // Map proforma items to invoice items
  const invoiceItems = proforma.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    position: item.position,
    discountable: item.discountable,
  }));

  const finalItems = invoiceItems.length > 0
    ? invoiceItems
    : [{ description: 'Services rendered', quantity: 1, unitPrice: deriveBaseSubtotalCents(proforma.amount, proforma.taxRate, proforma.discount, proforma.discountType), position: 0, discountable: true }];

  // Compute total invoice amount with the shared formula (matches UI + PDF)
  const computedAmount = computeInvoiceTotalsCents({
    items: finalItems,
    taxRate: proforma.taxRate,
    discount: proforma.discount,
    discountType: proforma.discountType,
  }).totalCents;

  // A deposit already paid against the proforma carries over as a partial
  // (or full) payment on the invoice, so status and ledger stay consistent.
  const payment = resolveInvoicePayment({
    amount: computedAmount,
    deposit: proforma.deposit != null ? Math.min(proforma.deposit, computedAmount) : null,
    status: 'PENDING',
    financialChange: true,
  });
  if (!payment.ok) throw AppError.badRequest(payment.error);

  // Set due date to 14 days from now if not specified
  const dueDate = proforma.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber,
      clientId: proforma.clientId,
      amount: computedAmount,
      status: payment.status,
      date: new Date(),
      dueDate,
      notes: proforma.notes,
      taxRate: proforma.taxRate,
      discount: proforma.discount,
      discountType: proforma.discountType,
      deposit: payment.deposit,
      showSignature: proforma.showSignature,
      showStamp: proforma.showStamp,
      deliveryNoteEnabled: proforma.deliveryNoteEnabled,
      deliveryNoteTitle: proforma.deliveryNoteTitle,
      deliveryNoteContent: cleanRichText(proforma.deliveryNoteContent),
      items: {
        create: finalItems.map((item) => ({ ...item, description: cleanRichText(item.description) })),
      },
    },
    include: {
      client: { select: { name: true, company: true, userId: true } },
    },
  });

  const claimed = await tx.proforma.updateMany({
    where: { id: proforma.id, convertedInvoiceId: null },
    data: { convertedInvoiceId: invoice.id, status: 'ACCEPTED' },
  });
  if (claimed.count !== 1) throw AppError.conflict(CONVERTED_MESSAGE);

  await syncInvoiceDeposit(invoice.id, tx);
  return invoice;
}

/** Notifications + audit for a proforma → invoice conversion (after commit). */
function announceConversion(
  req: Request,
  proforma: { id: string; proformaNumber: string | null; client?: { name: string; company: string | null } | null },
  createdInvoice: { id: string; invoiceNumber: string; clientId: string; client?: { userId: string | null } | null }
) {
  const clientName = proforma.client?.company || proforma.client?.name || 'Unknown';
  const invoiceNumber = createdInvoice.invoiceNumber;
  createNotification({
    title: 'Proposal Accepted 🎉',
    message: `Proforma ${proforma.proformaNumber} has been accepted by ${clientName}.`,
    type: 'PROFORMA_ACCEPTED',
    category: 'SUCCESS',
    entityType: 'PROFORMA',
    entityId: proforma.proformaNumber || proforma.id,
    actionUrl: `/dashboard/proforma/view/${proforma.proformaNumber || proforma.id}`,
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
  const clientUser = createdInvoice.client;
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

router.post('/', staffOnly, validate({ body: proformaDtoSchema }), async (req: Request, res: Response, next) => {
  try {
    // Any client-sent proformaNumber is ignored: numbers are allocated below.
    const { items, proformaNumber: _ignoredNumber, status, ...proformaData } = req.body;
    if (proformaData.deliveryNoteContent !== undefined) {
      proformaData.deliveryNoteContent = cleanRichText(proformaData.deliveryNoteContent);
    }
    const itemsWithPosition = normalizeItems(items);
    // Server-authoritative total when line items exist (see invoices.routes.ts).
    const amount = itemsWithPosition?.length
      ? computeInvoiceTotalsCents({
          items: itemsWithPosition,
          taxRate: proformaData.taxRate ?? null,
          discount: proformaData.discount ?? null,
          discountType: proformaData.discountType ?? null,
        }).totalCents
      : proformaData.amount;
    assertProformaMoney(amount, proformaData.deposit, proformaData.discount, proformaData.discountType);
    const acceptOnCreate = status === 'ACCEPTED';

    const { proforma, createdInvoice } = await prisma.$transaction(async (tx) => {
      const proformaNumber = await nextDocumentNumber('PRO', counterClient(tx));
      const created = await tx.proforma.create({
        data: {
          ...proformaData,
          proformaNumber,
          amount,
          // Acceptance goes through the conversion below (which sets ACCEPTED).
          status: acceptOnCreate ? 'SENT' : status,
          items: itemsWithPosition ? { create: itemsWithPosition } : undefined,
        },
      });
      const invoice = acceptOnCreate ? await convertProformaToInvoice(tx, created.id) : null;
      const full = await tx.proforma.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          client: { select: { name: true, company: true } },
          items: { orderBy: { position: 'asc' } },
        },
      });
      return { proforma: full, createdInvoice: invoice };
    });

    if (createdInvoice) announceConversion(req, proforma, createdInvoice);

    res.status(201).json({
      proforma,
      invoiceId: createdInvoice?.id,
      invoiceNumber: createdInvoice?.invoiceNumber,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      next(AppError.conflict('Could not allocate a unique document number, please retry.'));
      return;
    }
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
      // Clients may append a comment and accept / request a revision of a
      // proforma awaiting their decision — nothing else.
      const sanitized: any = {};
      if (req.body.notes !== undefined) {
        if (!isAppendOnlyNotes(targetProforma.notes, req.body.notes)) {
          throw AppError.badRequest('You can only add a comment to the proforma notes.');
        }
        sanitized.notes = req.body.notes;
      }
      if (req.body.status !== undefined) {
        if (!isClientProformaTransitionAllowed(targetProforma.status, req.body.status)) {
          throw AppError.forbidden('You cannot change the status of this proforma.');
        }
        sanitized.status = req.body.status;
      }
      req.body = sanitized;
    }

    const { items, proformaNumber, amount: sentAmount, ...proformaData } = req.body;
    if (proformaData.deliveryNoteContent !== undefined) {
      proformaData.deliveryNoteContent = cleanRichText(proformaData.deliveryNoteContent);
    }
    const itemsWithPosition = normalizeItems(items);
    const currentItems = await prisma.proformaItem.findMany({
      where: { proformaId: targetProforma.id },
      orderBy: { position: 'asc' },
    });
    const changed = changedFields(
      { ...req.body, items: itemsWithPosition, deliveryNoteContent: proformaData.deliveryNoteContent },
      targetProforma as unknown as Record<string, unknown>,
      currentItems
    );

    // Accepted proformas have been turned into an invoice (legacy ones may
    // predate `convertedInvoiceId`): only the notes may still change, so the
    // same proforma can never be converted twice.
    const isConverted = !!targetProforma.convertedInvoiceId || targetProforma.status === 'ACCEPTED';
    if (isConverted && changed.some((key) => key !== 'notes')) {
      throw AppError.conflict(CONVERTED_MESSAGE);
    }

    const nextTaxRate = proformaData.taxRate !== undefined ? proformaData.taxRate : targetProforma.taxRate;
    const nextDiscount = proformaData.discount !== undefined ? proformaData.discount : targetProforma.discount;
    const nextDiscountType =
      proformaData.discountType !== undefined ? proformaData.discountType : targetProforma.discountType;
    const affectsTotal = changed.some((key) => (FINANCIAL_FIELDS as readonly string[]).includes(key));

    // Server-authoritative total (see invoices.routes.ts PUT for rationale);
    // item-less proformas keep their base instead of collapsing to $0.
    const amount = resolveTotalCents({
      items: itemsWithPosition ?? currentItems,
      explicitAmount: sentAmount,
      affectsTotal,
      current: targetProforma,
      next: { taxRate: nextTaxRate, discount: nextDiscount, discountType: nextDiscountType },
    });
    const nextDeposit = proformaData.deposit !== undefined ? proformaData.deposit : targetProforma.deposit;
    if (affectsTotal) assertProformaMoney(amount, nextDeposit, nextDiscount, nextDiscountType);

    const renumber =
      proformaNumber !== undefined && proformaNumber !== targetProforma.proformaNumber ? proformaNumber : undefined;
    const statusChangedToAccepted = targetProforma.status !== 'ACCEPTED' && proformaData.status === 'ACCEPTED';

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // The guard makes a concurrent conversion win over this write.
        const guard: Prisma.ProformaWhereUniqueInput = isConverted
          ? { id: targetProforma.id }
          : { id: targetProforma.id, status: { not: 'ACCEPTED' }, AND: [{ convertedInvoiceId: null }] };
        await tx.proforma.update({
          where: guard,
          data: {
            ...proformaData,
            ...(renumber !== undefined ? { proformaNumber: renumber } : {}),
            // Acceptance is applied by the conversion itself.
            ...(statusChangedToAccepted ? { status: targetProforma.status } : {}),
            amount,
            items:
              itemsWithPosition && changed.includes('items')
                ? { deleteMany: {}, create: itemsWithPosition }
                : undefined,
          },
        });
        const invoice = statusChangedToAccepted
          ? await convertProformaToInvoice(tx, targetProforma.id)
          : null;
        const proforma = await tx.proforma.findUniqueOrThrow({
          where: { id: targetProforma.id },
          include: {
            client: { select: { name: true, company: true } },
            items: { orderBy: { position: 'asc' } },
          },
        });
        return { proforma, createdInvoice: invoice };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw AppError.conflict('That proforma number is already in use.');
      if (isRecordNotFound(error)) throw AppError.conflict(CONVERTED_MESSAGE);
      throw error;
    }

    const { proforma, createdInvoice } = result;
    if (createdInvoice) announceConversion(req, proforma, createdInvoice);

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

router.delete('/:id', staffOnly, async (req: Request, res: Response, next) => {
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

router.post('/:id/send-email', staffOnly, async (req: Request, res: Response, next) => {
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

    const { to, cc, subject, body, filename, isFollowUp, followUpType, customNote, verificationUrl } = req.body;
    if (!to || !subject || !body) {
      throw AppError.badRequest('Missing required fields: to, subject, and body are required.');
    }

    // Server-render PDF (Puppeteer) — never trust client-uploaded PDF bytes
    const { buffer, filename: renderedFilename } = await renderProformaPdfById(targetProforma.id);

    try {
      const pdfPath = path.resolve(PATHS.DOCUMENTS, `Proforma_${targetProforma.id}.pdf`);
      await fs.writeFile(pdfPath, buffer);
    } catch (fsErr) {
      console.error('[Email] Failed to save proforma PDF to system:', fsErr);
    }

    // Sanitize user-authored inputs: rich text goes through the allowlist,
    // plain text is escaped (newlines are kept by white-space: pre-line).
    const isHtml = typeof body === 'string' && /<\/?[a-z][\s\S]*>/i.test(body);
    const cleanBody = isHtml ? sanitizeRichHtml(String(body)) : escapeHtml(String(body));
    const cleanCustomNote = customNote ? sanitizeRichHtml(String(customNote)) : cleanBody;
    const safeVerificationUrl =
      typeof verificationUrl === 'string' && /^https?:\/\//i.test(verificationUrl) ? escapeHtml(verificationUrl) : undefined;

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
        customNote: cleanCustomNote,
        verificationUrl: safeVerificationUrl,
        followUpType: followUpType || 'GENTLE_REMINDER',
        items: targetProforma.items,
        deposit: targetProforma.deposit ?? undefined,
      });
    } else {
      emailHtml = await generateEmailHtml({
        title: subject,
        preheader: subject,
        contentHtml: isHtml
          ? `<div style="margin: 0 0 16px; color: #475569; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${cleanBody}</div>`
          : `<p style="margin: 0 0 16px; color: #475569; line-height: 1.6; white-space: pre-line; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${cleanBody}</p>`,
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
          filename: filename || renderedFilename || `Proforma_${targetProforma.proformaNumber || targetProforma.id}.pdf`,
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
