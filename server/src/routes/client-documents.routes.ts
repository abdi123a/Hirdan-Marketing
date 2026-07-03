import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { uploadDocument, enforceMagicBytes } from '../lib/upload.js';
import { auditLog } from '../lib/audit.js';

const router = Router();
router.use(authenticate);

// ─── Validation ───────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  'CONTRACT', 'REPORT', 'ONBOARDING', 'BRAND_GUIDE', 'CONTENT_CALENDAR', 'OTHER',
] as const;

const documentDto = z.object({
  title: z.string().min(1),
  type: z.enum(DOCUMENT_TYPES).optional(),
  internalNotes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  expiryDate: z.string().or(z.date()).optional().nullable(),
  isSigned: z.boolean().optional(),
  clientVisible: z.boolean().optional(),
});

// ─── GET /api/clients/:clientId/documents ─────────────────────────

router.get('/:clientId/documents', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const documents = await prisma.clientDocument.findMany({
      where: { clientId: req.params.clientId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/clients/:clientId/documents ────────────────────────
// Handles multipart/form-data with a 'file' field

router.post(
  '/:clientId/documents',
  requireAdmin,
  uploadDocument.single('file'),
  enforceMagicBytes({ kind: 'document' }),
  async (req: Request, res: Response, next) => {
    try {
      const clientId = req.params.clientId as string;
      const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;

      // Verify client exists
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw AppError.notFound('Client not found');

      if (!req.file) throw AppError.badRequest('No file uploaded');

      // Parse the body fields (sent as form-data alongside the file)
      const parsed = documentDto.parse({
        title: req.body.title,
        type: req.body.type || undefined,
        internalNotes: req.body.internalNotes || undefined,
        clientNotes: req.body.clientNotes || undefined,
        expiryDate: req.body.expiryDate || undefined,
        isSigned: req.body.isSigned === 'true' ? true : req.body.isSigned === 'false' ? false : undefined,
        clientVisible: req.body.clientVisible === 'false' ? false : true,
      });

      const fileUrl = `/uploads/documents/${req.file.filename}`;

      const document = await prisma.clientDocument.create({
        data: {
          clientId,
          fileUrl,
          ...parsed,
          expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate as string) : null,
        },
      });

      auditLog({ action: 'document.upload', success: true, userId: req.user!.userId, clientId, documentId: document.id, ip });
      res.status(201).json({ document });
    } catch (error) {
      auditLog({ action: 'document.upload', success: false, userId: req.user!.userId, clientId: req.params.clientId as string, ip: req.ip });
      next(error);
    }
  }
);

// ─── PUT /api/clients/:clientId/documents/:docId ──────────────────
// Updates metadata (not the file itself — upload a new doc and delete old if needed)

router.put(
  '/:clientId/documents/:docId',
  requireAdmin,
  validate({ body: documentDto.partial() }),
  async (req: Request, res: Response, next) => {
    try {
      const doc = await prisma.clientDocument.findFirst({
        where: {
          id: req.params.docId as string,
          clientId: req.params.clientId as string,
        },
      });
      if (!doc) throw AppError.notFound('Document not found');

      const { expiryDate, ...rest } = req.body;

      const updated = await prisma.clientDocument.update({
        where: { id: doc.id },
        data: {
          ...rest,
          ...(expiryDate !== undefined && {
            expiryDate: expiryDate ? new Date(expiryDate as string) : null,
          }),
        },
      });
      res.json({ document: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/clients/:clientId/documents/:docId ───────────────

router.delete(
  '/:clientId/documents/:docId',
  requireAdmin,
  async (req: Request, res: Response, next) => {
    try {
      const doc = await prisma.clientDocument.findFirst({
        where: {
          id: req.params.docId as string,
          clientId: req.params.clientId as string,
        },
      });
      if (!doc) throw AppError.notFound('Document not found');

      await prisma.clientDocument.delete({ where: { id: doc.id } });
      res.json({ message: 'Document deleted' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
