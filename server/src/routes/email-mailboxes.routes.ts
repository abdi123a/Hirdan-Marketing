import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import {
  requireStaff,
  requireMailboxAccess,
  accessibleMailboxIds,
  mailboxAccessLevel,
} from '../lib/mail/access.js';

const router = Router();
router.use(authenticate, requireStaff);

const mailboxSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional().nullable(),
  signature: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  replyTo: z.string().email().optional().nullable(),
  color: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// ─── GET /api/email/mailboxes ────────────────────────────────────
// Lists only the mailboxes the current user is allowed to see.
router.get('/mailboxes', async (req: Request, res: Response, next) => {
  try {
    const ids = await accessibleMailboxIds(req.user!);
    const where = ids === 'ALL' ? {} : { id: { in: ids } };

    const mailboxes = await prisma.mailbox.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }],
    });

    // Attach unread counts (inbox scope: not spam, not trashed).
    const grouped = await prisma.conversation.groupBy({
      by: ['mailboxId'],
      where: {
        mailboxId: ids === 'ALL' ? undefined : { in: ids },
        isSpam: false,
        deletedAt: null,
        unreadCount: { gt: 0 },
      },
      _sum: { unreadCount: true },
    });
    const unreadByMailbox = new Map(grouped.map((g) => [g.mailboxId, g._sum.unreadCount ?? 0]));

    const result = await Promise.all(
      mailboxes.map(async (m) => ({
        ...m,
        unreadCount: unreadByMailbox.get(m.id) ?? 0,
        accessLevel: await mailboxAccessLevel(req.user!, m.id),
      }))
    );

    res.json({ mailboxes: result });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/mailboxes/:mailboxId ─────────────────────────
router.get(
  '/mailboxes/:mailboxId',
  requireMailboxAccess('READ'),
  async (req: Request, res: Response, next) => {
    try {
      const mailbox = await prisma.mailbox.findUnique({
        where: { id: req.params.mailboxId as string },
      });
      if (!mailbox) throw AppError.notFound('Mailbox not found');
      res.json({ mailbox });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/email/mailboxes (ADMIN) ───────────────────────────
router.post('/mailboxes', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const data = mailboxSchema.parse(req.body);

    if (data.isDefault) {
      await prisma.mailbox.updateMany({ data: { isDefault: false } });
    }

    const mailbox = await prisma.mailbox.create({ data });
    res.status(201).json({ mailbox });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
    }
    // Duplicate email → unique constraint
    if ((error as { code?: string }).code === 'P2002') {
      return next(AppError.conflict('A mailbox with that email already exists'));
    }
    next(error);
  }
});

// ─── PUT /api/email/mailboxes/:mailboxId (MANAGE) ────────────────
router.put(
  '/mailboxes/:mailboxId',
  requireMailboxAccess('MANAGE'),
  async (req: Request, res: Response, next) => {
    try {
      const data = mailboxSchema.partial().parse(req.body);
      const id = req.params.mailboxId as string;

      if (data.isDefault) {
        await prisma.mailbox.updateMany({ data: { isDefault: false } });
      }

      const mailbox = await prisma.mailbox.update({ where: { id }, data });
      res.json({ mailbox });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
      }
      next(error);
    }
  }
);

// ─── DELETE /api/email/mailboxes/:mailboxId (ADMIN) ──────────────
router.delete(
  '/mailboxes/:mailboxId',
  requireAdmin,
  async (req: Request, res: Response, next) => {
    try {
      await prisma.mailbox.delete({ where: { id: req.params.mailboxId as string } });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Permissions management (ADMIN) ──────────────────────────────

// GET permissions for a mailbox
router.get(
  '/mailboxes/:mailboxId/permissions',
  requireMailboxAccess('MANAGE'),
  async (req: Request, res: Response, next) => {
    try {
      const permissions = await prisma.mailboxPermission.findMany({
        where: { mailboxId: req.params.mailboxId as string },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ permissions });
    } catch (error) {
      next(error);
    }
  }
);

const grantSchema = z.object({
  userId: z.string().min(1),
  accessLevel: z.enum(['READ', 'WRITE', 'MANAGE']).default('WRITE'),
});

// Grant / update a user's access to a mailbox
router.post(
  '/mailboxes/:mailboxId/permissions',
  requireAdmin,
  async (req: Request, res: Response, next) => {
    try {
      const { userId, accessLevel } = grantSchema.parse(req.body);
      const mailboxId = req.params.mailboxId as string;

      const permission = await prisma.mailboxPermission.upsert({
        where: { mailboxId_userId: { mailboxId, userId } },
        create: { mailboxId, userId, accessLevel },
        update: { accessLevel },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });
      res.status(201).json({ permission });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
      }
      next(error);
    }
  }
);

// Revoke a user's access
router.delete(
  '/mailboxes/:mailboxId/permissions/:userId',
  requireAdmin,
  async (req: Request, res: Response, next) => {
    try {
      await prisma.mailboxPermission.deleteMany({
        where: {
          mailboxId: req.params.mailboxId as string,
          userId: req.params.userId as string,
        },
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
