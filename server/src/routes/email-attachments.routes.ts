import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Attachment } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess } from '../lib/mail/access.js';
import { storeAttachments } from '../lib/mail/attachments.js';

const router = Router();
router.use(authenticate, requireStaff);

async function loadAttachment(userId: string, role: string, id: string) {
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { email: { select: { id: true, mailboxId: true } } },
  });
  if (!att || !att.email) throw AppError.notFound('Attachment not found');
  await assertMailboxAccess({ userId, role }, att.email.mailboxId, 'WRITE');
  return att;
}

/** Walk the version chain (both directions) and return all versions, oldest first. */
async function collectVersions(att: Attachment): Promise<Attachment[]> {
  const all: Attachment[] = [att];

  // Forward (newer): follow supersededById.
  let cur = att;
  while (cur.supersededById) {
    const next = await prisma.attachment.findUnique({ where: { id: cur.supersededById } });
    if (!next) break;
    all.push(next);
    cur = next;
  }

  // Backward (older): find the row that points to `att` via supersededById.
  let prev = await prisma.attachment.findFirst({ where: { supersededById: att.id } });
  while (prev) {
    all.unshift(prev);
    const older: Attachment | null = await prisma.attachment.findFirst({ where: { supersededById: prev.id } });
    prev = older;
  }

  return all.sort((a, b) => a.version - b.version);
}

// ─── GET /api/email/attachments/:id/versions ─────────────────────
router.get('/attachments/:id/versions', async (req: Request, res: Response, next) => {
  try {
    const att = await loadAttachment(req.user!.userId, req.user!.role, req.params.id as string);
    const versions = await collectVersions(att);
    res.json({
      versions: versions.map((v) => ({
        id: v.id, filename: v.filename, mimeType: v.mimeType, size: v.size,
        version: v.version, isLatest: !v.supersededById, createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const replaceSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1), // base64
  contentType: z.string().optional(),
});

// ─── POST /api/email/attachments/:id/replace ─────────────────────
router.post('/attachments/:id/replace', async (req: Request, res: Response, next) => {
  try {
    const old = await loadAttachment(req.user!.userId, req.user!.role, req.params.id as string);
    if (old.supersededById) throw AppError.badRequest('This attachment already has a newer version');
    const input = replaceSchema.parse(req.body);

    const stored = await storeAttachments(old.email!.id, [
      { filename: input.filename, content: input.content, contentType: input.contentType },
    ]);
    if (!stored.length) throw AppError.badRequest('Empty file');
    const s = stored[0];

    const created = await prisma.attachment.create({
      data: {
        emailId: old.emailId,
        draftId: old.draftId,
        filename: s.filename,
        mimeType: s.mimeType,
        size: s.size,
        storageKey: s.storageKey,
        checksum: s.checksum,
        version: old.version + 1,
      },
    });
    await prisma.attachment.update({ where: { id: old.id }, data: { supersededById: created.id } });

    res.status(201).json({ attachment: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
    }
    next(error);
  }
});

export default router;
