import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { PATHS } from '../lib/paths.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const employeeDocsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PATHS.EMPLOYEE_DOCS);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `emp-${crypto.randomUUID()}${ext}`);
  },
});

const uploadEmployeeDoc = multer({
  storage: employeeDocsStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
});

const router = Router();
router.use(authenticate);

// ─── GET /api/team/:employeeId/files ──────────────────────────────
router.get('/:employeeId/files', async (req: Request, res: Response, next) => {
  try {
    const employeeId = req.params.employeeId as string;
    const user = req.user as any;

    // Permissions check
    if (user.role === 'CLIENT') {
      throw AppError.forbidden('Access denied');
    }
    if (user.role === 'STAFF') {
      const employee = await prisma.teamMember.findUnique({
        where: { id: employeeId },
      });
      if (!employee || employee.userId !== user.userId) {
        throw AppError.forbidden('Access denied');
      }
    }

    const files = await prisma.employeeFile.findMany({
      where: { employeeId },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/team/:employeeId/files ─────────────────────────────
router.post(
  '/:employeeId/files',
  requireAdmin,
  uploadEmployeeDoc.single('file'),
  async (req: Request, res: Response, next) => {
    try {
      const employeeId = req.params.employeeId as string;
      const { category, label } = req.body;
      const userEmail = (req.user as any)?.email || 'Admin';

      if (!req.file) {
        throw AppError.badRequest('No file uploaded');
      }

      // Check if employee exists
      const employee = await prisma.teamMember.findUnique({
        where: { id: employeeId },
      });
      if (!employee) {
        throw AppError.notFound('Employee not found');
      }

      const fileUrl = `/uploads/employee-docs/${req.file.filename}`;

      const employeeFile = await prisma.employeeFile.create({
        data: {
          employeeId,
          category: category || 'OTHER',
          label: label || req.file.originalname,
          fileUrl,
          uploadedBy: userEmail,
        },
      });

      // Log activity
      await prisma.employeeActivity.create({
        data: {
          employeeId,
          actionType: 'FILE_UPLOADED',
          performedBy: userEmail,
          notes: `Uploaded file: ${label || req.file.originalname} (Category: ${category})`,
        },
      });

      res.status(201).json({ file: employeeFile });
    } catch (error) {
      // Clean up uploaded file if DB insert fails
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      next(error);
    }
  }
);

// ─── DELETE /api/team/:employeeId/files/:fileId ───────────────────
router.delete('/:employeeId/files/:fileId', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const { employeeId, fileId } = req.params;
    const userEmail = (req.user as any)?.email || 'Admin';

    const fileRecord = await prisma.employeeFile.findFirst({
      where: { id: fileId as string, employeeId: employeeId as string },
    });

    if (!fileRecord) {
      throw AppError.notFound('File not found');
    }

    // Delete database record
    await prisma.employeeFile.delete({
      where: { id: fileId as string },
    });

    // Delete physical file
    const filename = path.basename(fileRecord.fileUrl);
    const filePath = path.resolve(PATHS.EMPLOYEE_DOCS, filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }

    // Log activity
    await prisma.employeeActivity.create({
      data: {
        employeeId: employeeId as string,
        actionType: 'FILE_DELETED',
        performedBy: userEmail,
        notes: `Deleted file: ${fileRecord.label || filename}`,
      },
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
