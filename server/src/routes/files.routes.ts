import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

const router = Router();

// ─── Public Branding Files ────────────────────────────────────────
router.get('/branding/:filename', (req: Request, res: Response, next) => {
  (async () => {
    const filename = req.params.filename as string;
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(UPLOADS_ROOT, 'branding', safeFilename);

    if (!fs.existsSync(filePath)) {
      throw AppError.notFound(`Logo not found: ${safeFilename}`);
    }

    res.sendFile(filePath);
  })().catch(next);
});

// ─── Authenticated File Download ──────────────────────────────────
// Protected by JWT authentication
router.get('/:folder/:filename', authenticate, (req: Request, res: Response, next) => {
  (async () => {
    const folder = req.params.folder as string;
    const filename = req.params.filename as string;

    // Only sensitive folders here
    const secureFolders = ['documents', 'media'];
    if (!secureFolders.includes(folder)) {
      throw AppError.forbidden('Access restricted');
    }

    const safeFilename = path.basename(filename);
    const filePath = path.resolve(UPLOADS_ROOT, folder, safeFilename);

    const user = req.user as any;
    if (user?.role === 'CLIENT') {
      const clientId =
        user.clientId ||
        (await prisma.client.findUnique({ where: { userId: user.userId } }))?.id;
      if (!clientId) {
        throw AppError.forbidden('Client profile not found');
      }

      if (folder === 'documents') {
        const record = await prisma.clientDocument.findFirst({
          where: {
            clientId,
            fileUrl: { endsWith: `/uploads/documents/${safeFilename}` },
          },
          select: { id: true },
        });
        if (!record) throw AppError.forbidden('Access denied');
      }

      if (folder === 'media') {
        const record = await prisma.deliverableTask.findFirst({
          where: {
            clientId,
            proofUrl: { endsWith: `/uploads/media/${safeFilename}` },
          },
          select: { id: true },
        });
        if (!record) throw AppError.forbidden('Access denied');
      }

      // Branding assets (logo, favicon, etc.) are intentionally public-facing.
      // Clients can view them — they appear in the portal and invoice previews.
    }

    // Debugging: can be removed in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`📂 [FileAccess] Serving ${folder}/${safeFilename} from ${filePath}`);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`❌ [FileAccess] File not found: ${filePath}`);
      throw AppError.notFound(`File not found: ${folder}/${safeFilename}`);
    }

    // Stream the file
    res.sendFile(filePath);
  })().catch((error) => {
    console.error('💥 [FileAccess] Error serving file:', error);
    next(error);
  });
});

export default router;
