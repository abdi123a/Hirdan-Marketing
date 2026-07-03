import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const router = Router();

// Secure token generation using crypto API
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: true, message: 'Too many verification attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** First 3 Unicode chars of company or name + *** — full name never leaves the API. */
function maskClientDisplayName(company: string | null | undefined, name: string | null | undefined): string {
  const raw = (company?.trim() || name?.trim() || '');
  if (!raw) return '•••***';
  const prefix = Array.from(raw)
    .slice(0, 3)
    .join('');
  return `${prefix}***`;
}

router.post('/', authenticate, async (req: Request, res: Response, next) => {
  try {
    const { documentType, documentId } = req.body;
    const user = req.user as any;

    if (!['invoice', 'proforma', 'subscription', 'monthly_report'].includes(documentType)) {
      throw AppError.badRequest('Invalid document type');
    }

    if (!documentId) {
      throw AppError.badRequest('Document ID is required');
    }

    // Verify document exists before creating token
    let dbDoc;
    if (documentType === 'invoice') {
      dbDoc = await prisma.invoice.findFirst({
        where: {
          OR: [{ id: documentId }, { invoiceNumber: documentId }]
        }
      });
      if (!dbDoc) throw AppError.notFound('Invoice not found');
      
      // Ownership check for clients
      if (user.role === 'CLIENT') {
        let clientId = user.clientId;
        if (!clientId) {
          const client = await prisma.client.findUnique({ where: { userId: user.userId } });
          clientId = client?.id;
        }
        if (dbDoc.clientId !== clientId) {
          throw AppError.forbidden('You do not have permission to verify this invoice');
        }
      }
    } else if (documentType === 'subscription') {
      dbDoc = await prisma.subscription.findUnique({ where: { id: documentId } });
      if (!dbDoc) throw AppError.notFound('Subscription not found');

      if (user.role === 'CLIENT') {
        let clientId = user.clientId;
        if (!clientId) {
          const client = await prisma.client.findUnique({ where: { userId: user.userId } });
          clientId = client?.id;
        }
        if (dbDoc.clientId !== clientId) {
          throw AppError.forbidden('You do not have permission to verify this subscription');
        }
      }
    } else if (documentType === 'proforma') {
      dbDoc = await prisma.proforma.findFirst({
        where: {
          OR: [{ id: documentId }, { proformaNumber: documentId }]
        }
      });
      if (!dbDoc) throw AppError.notFound('Proforma not found');

      if (user.role === 'CLIENT') {
        let clientId = user.clientId;
        if (!clientId) {
          const client = await prisma.client.findUnique({ where: { userId: user.userId } });
          clientId = client?.id;
        }
        if (dbDoc.clientId !== clientId) {
          throw AppError.forbidden('You do not have permission to verify this proforma');
        }
      }
    } else {
      dbDoc = await prisma.monthlyReport.findUnique({ where: { id: documentId } });
      if (!dbDoc) throw AppError.notFound('Monthly report not found');

      if (user.role === 'CLIENT') {
        let clientId = user.clientId;
        if (!clientId) {
          const client = await prisma.client.findUnique({ where: { userId: user.userId } });
          clientId = client?.id;
        }
        if (dbDoc.clientId !== clientId) {
          throw AppError.forbidden('You do not have permission to verify this report');
        }
      }
    }

    // Always use the real UUID for the foreign key, not the invoiceNumber string
    const realDocumentId = dbDoc.id;

    // Check if token already exists with the real UUID
    const existing = await prisma.verificationToken.findFirst({
      where: {
        documentType,
        invoiceId: documentType === 'invoice' ? realDocumentId : undefined,
        proformaId: documentType === 'proforma' ? realDocumentId : undefined,
        subscriptionId: documentType === 'subscription' ? realDocumentId : undefined,
        monthlyReportId: documentType === 'monthly_report' ? realDocumentId : undefined,
      }
    });

    if (existing) {
      // If token is still valid (not revoked and not expired), return it
      if (!existing.revokedAt && existing.expiresAt > new Date()) {
        res.json({ token: existing.token });
        return;
      }
      // If it's expired or revoked, remove it so we can create a fresh one
      await prisma.verificationToken.delete({ where: { id: existing.id } });
    }

    // Create new token
    const token = generateSecureToken();
    const newToken = await prisma.verificationToken.create({
      data: {
        token,
        documentType,
        invoiceId: documentType === 'invoice' ? realDocumentId : undefined,
        proformaId: documentType === 'proforma' ? realDocumentId : undefined,
        subscriptionId: documentType === 'subscription' ? realDocumentId : undefined,
        monthlyReportId: documentType === 'monthly_report' ? realDocumentId : undefined,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      }
    });

    res.status(201).json({ token: newToken.token });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/verify/:token ─────────────────────────────────────
// Public endpoint — no auth required

router.get('/:token', verifyLimiter, async (req: Request, res: Response, next) => {
  try {
    const record = await prisma.verificationToken.findUnique({
      where: { token: req.params.token as string },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            date: true,
            status: true,
            amount: true,
            client: { select: { name: true, company: true } },
          },
        },
        proforma: {
          select: {
            proformaNumber: true,
            date: true,
            status: true,
            amount: true,
            client: { select: { name: true, company: true } },
          },
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            startDate: true,
            endDate: true,
            amount: true,
            client: { select: { name: true, company: true } },
          },
        },
        monthlyReport: {
          select: {
            title: true,
            month: true,
            year: true,
            status: true,
            client: { select: { name: true, company: true } },
          },
        },
      },
    });

    if (!record) {
      throw AppError.notFound('Verification token not found or invalid');
    }

    if ((record as any).revokedAt) {
      throw AppError.notFound('Verification token not found or invalid');
    }
    if ((record as any).expiresAt && (record as any).expiresAt < new Date()) {
      throw AppError.notFound('Verification token not found or invalid');
    }

    const raw = (record as any).invoice || (record as any).proforma || (record as any).subscription || (record as any).monthlyReport;
    const type = record.documentType;

    if (!raw) {
      throw AppError.notFound('Associated document not found');
    }

    const clientMask = maskClientDisplayName(raw.client?.company, raw.client?.name);

    // Public payload only — no full client name, line items, or pricing breakdown
    let documentDetails: any = {};
    if (type === 'invoice') {
      documentDetails = {
        number: raw.invoiceNumber,
        date: raw.date,
        status: raw.status,
        amount: raw.amount,
      };
    } else if (type === 'proforma') {
      documentDetails = {
        number: raw.proformaNumber,
        date: raw.date,
        status: raw.status,
        amount: raw.amount,
      };
    } else if (type === 'subscription') {
      documentDetails = {
        plan: raw.plan,
        status: raw.status,
        startDate: raw.startDate,
        endDate: raw.endDate,
        amount: raw.amount,
      };
    } else if (type === 'monthly_report') {
      documentDetails = {
        title: raw.title,
        month: raw.month,
        year: raw.year,
        status: raw.status,
      };
    }

    res.json({
      verified: true,
      type,
      document: {
        ...documentDetails,
        clientMask,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/verify/:token ───────────────────────────────────
// Revoke token (admin only)
router.delete('/:token', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const token = req.params.token as string;
    await prisma.verificationToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
    res.json({ message: 'Token revoked' });
  } catch (error) {
    next(error);
  }
});

export default router;

