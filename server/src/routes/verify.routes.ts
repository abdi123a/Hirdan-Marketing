import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// Secure token generation using crypto API
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/', authenticate, async (req: Request, res: Response, next) => {
  try {
    const { documentType, documentId } = req.body;
    const user = req.user as any;

    if (!['invoice', 'proforma'].includes(documentType)) {
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
    } else {
      dbDoc = await prisma.proforma.findFirst({
        where: {
          OR: [{ id: documentId }, { proformaNumber: documentId }]
        }
      });
      if (!dbDoc) throw AppError.notFound('Proforma not found');

      // Ownership check for clients
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
    }

    // Always use the real UUID for the foreign key, not the invoiceNumber string
    const realDocumentId = dbDoc.id;

    // Check if token already exists with the real UUID
    const existing = await prisma.verificationToken.findFirst({
      where: {
        documentType,
        invoiceId: documentType === 'invoice' ? realDocumentId : undefined,
        proformaId: documentType === 'proforma' ? realDocumentId : undefined
      }
    });

    if (existing) {
      res.json({ token: existing.token });
      return;
    }

    // Create new token
    const token = generateSecureToken();
    const newToken = await prisma.verificationToken.create({
      data: {
        token,
        documentType,
        invoiceId: documentType === 'invoice' ? realDocumentId : undefined,
        proformaId: documentType === 'proforma' ? realDocumentId : undefined
      }
    });

    res.status(201).json({ token: newToken.token });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/verify/:token ─────────────────────────────────────
// Public endpoint — no auth required

router.get('/:token', async (req: Request, res: Response, next) => {
  try {
    const record = await prisma.verificationToken.findUnique({
      where: { token: req.params.token as string },
      include: {
        invoice: {
          include: {
            client: { select: { name: true, company: true, email: true } },
            items: true,
          },
        },
        proforma: {
          include: {
            client: { select: { name: true, company: true, email: true } },
            items: true,
          },
        },
      },
    });

    if (!record) {
      throw AppError.notFound('Verification token not found or invalid');
    }

    const document = (record as any).invoice || (record as any).proforma;
    const type = (record as any).invoice ? 'invoice' : 'proforma';

    if (!document) {
      throw AppError.notFound('Associated document not found');
    }

    res.json({
      verified: true,
      type,
      document,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

