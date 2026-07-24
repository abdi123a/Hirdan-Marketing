import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import {
  requireStaff,
  accessibleMailboxIds,
  assertMailboxAccess,
} from '../lib/mail/access.js';
import { publishMailEvent } from '../lib/mail/sse.js';

const router = Router();
router.use(authenticate, requireStaff);

/** where-fragment scoping conversations to the user's accessible mailboxes. */
async function scopeWhere(user: { userId: string; role: string }): Promise<Prisma.ConversationWhereInput> {
  const ids = await accessibleMailboxIds(user);
  return ids === 'ALL' ? {} : { mailboxId: { in: ids } };
}

function folderWhere(folder: string | undefined): Prisma.ConversationWhereInput {
  switch (folder) {
    case 'starred':
      return { isStarred: true, deletedAt: null };
    case 'spam':
      return { isSpam: true, deletedAt: null };
    case 'trash':
      return { deletedAt: { not: null } };
    case 'archived':
      return { isArchived: true, deletedAt: null };
    case 'sent':
      return { deletedAt: null, isSpam: false, lastOutboundAt: { not: null } };
    case 'inbox':
    default:
      return { deletedAt: null, isSpam: false, isArchived: false };
  }
}

/** Load a conversation the user may access (throws 403/404 otherwise). */
async function getAccessibleConversation(
  user: { userId: string; role: string },
  id: string
) {
  const convo = await prisma.conversation.findUnique({ where: { id }, select: { id: true, mailboxId: true } });
  if (!convo) throw AppError.notFound('Conversation not found');
  await assertMailboxAccess(user, convo.mailboxId, 'READ');
  return convo;
}

// ─── GET /api/email/conversations ────────────────────────────────
router.get('/conversations', async (req: Request, res: Response, next) => {
  try {
    const folder = (req.query.folder as string) || 'inbox';
    const mailboxId = req.query.mailboxId as string | undefined;
    const q = (req.query.q as string || '').trim();
    const labelId = req.query.labelId as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Number(req.query.offset) || 0;

    let scope: Prisma.ConversationWhereInput;
    if (mailboxId) {
      await assertMailboxAccess(req.user!, mailboxId, 'READ');
      scope = { mailboxId };
    } else {
      scope = await scopeWhere(req.user!);
    }

    const where: Prisma.ConversationWhereInput = {
      ...scope,
      ...folderWhere(folder),
      ...(status ? { status: status as any } : {}),
      ...(labelId ? { labels: { some: { labelId } } } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q } },
              { snippet: { contains: q } },
              { participants: { some: { email: { contains: q } } } },
              { participants: { some: { name: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
        include: {
          mailbox: { select: { id: true, email: true, displayName: true, color: true } },
          assignee: { select: { id: true, name: true, email: true } },
          labels: { include: { label: true } },
          participants: true,
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({
      conversations,
      total,
      hasMore: offset + conversations.length < total,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/email/conversations/:id — full thread ──────────────
router.get('/conversations/:id', async (req: Request, res: Response, next) => {
  try {
    await getAccessibleConversation(req.user!, req.params.id as string);
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id as string },
      include: {
        mailbox: { select: { id: true, email: true, displayName: true, color: true, signature: true, replyTo: true } },
        client: { select: { id: true, name: true, email: true, company: true } },
        assignee: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
        participants: true,
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        emails: {
          orderBy: { createdAt: 'asc' },
          include: {
            events: { orderBy: { occurredAt: 'asc' } },
            attachments: true,
          },
        },
      },
    });
    res.json({ conversation });
  } catch (error) {
    next(error);
  }
});

// ─── Read / unread ───────────────────────────────────────────────
router.post('/conversations/:id/read', async (req: Request, res: Response, next) => {
  try {
    const convo = await getAccessibleConversation(req.user!, req.params.id as string);
    await prisma.email.updateMany({
      where: { conversationId: convo.id, isRead: false },
      data: { isRead: true },
    });
    await prisma.conversation.update({ where: { id: convo.id }, data: { unreadCount: 0 } });
    publishMailEvent({ type: 'unread-count', mailboxId: convo.mailboxId, unreadCount: 0 });
    publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/conversations/:id/unread', async (req: Request, res: Response, next) => {
  try {
    const convo = await getAccessibleConversation(req.user!, req.params.id as string);
    await prisma.conversation.update({ where: { id: convo.id }, data: { unreadCount: 1 } });
    publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH flags / status / assignment ───────────────────────────
const patchSchema = z.object({
  isStarred: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  isFlagged: z.boolean().optional(),
  status: z.enum(['OPEN', 'PENDING', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
  assigneeId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
});

router.patch('/conversations/:id', async (req: Request, res: Response, next) => {
  try {
    const convo = await getAccessibleConversation(req.user!, req.params.id as string);
    const data = patchSchema.parse(req.body);
    const conversation = await prisma.conversation.update({
      where: { id: convo.id },
      data,
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
    res.json({ conversation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
    }
    next(error);
  }
});

// ─── Spam / trash / archive toggles ──────────────────────────────
function toggleRoute(path: string, data: Prisma.ConversationUpdateInput) {
  router.post(`/conversations/:id/${path}`, async (req: Request, res: Response, next) => {
    try {
      const convo = await getAccessibleConversation(req.user!, req.params.id as string);
      await prisma.conversation.update({ where: { id: convo.id }, data });
      publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
}

toggleRoute('spam', { isSpam: true });
toggleRoute('not-spam', { isSpam: false });
toggleRoute('trash', { deletedAt: new Date() });
toggleRoute('restore', { deletedAt: null, isSpam: false, isArchived: false });
toggleRoute('archive', { isArchived: true });
toggleRoute('unarchive', { isArchived: false });

// ─── Bulk actions ────────────────────────────────────────────────
const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum([
    'read', 'unread', 'star', 'unstar', 'spam', 'not-spam',
    'trash', 'restore', 'archive', 'unarchive',
  ]),
});

const BULK_DATA: Record<string, Prisma.ConversationUpdateManyMutationInput> = {
  read: { unreadCount: 0 },
  unread: { unreadCount: 1 },
  star: { isStarred: true },
  unstar: { isStarred: false },
  spam: { isSpam: true },
  'not-spam': { isSpam: false },
  trash: { deletedAt: new Date() },
  restore: { deletedAt: null, isSpam: false, isArchived: false },
  archive: { isArchived: true },
  unarchive: { isArchived: false },
};

router.post('/conversations/bulk', async (req: Request, res: Response, next) => {
  try {
    const { ids, action } = bulkSchema.parse(req.body);
    const scope = await scopeWhere(req.user!);
    // Only touch conversations the user can access.
    const result = await prisma.conversation.updateMany({
      where: { id: { in: ids }, ...scope },
      data: BULK_DATA[action],
    });
    if (action === 'read') {
      await prisma.email.updateMany({ where: { conversationId: { in: ids } }, data: { isRead: true } });
    }
    res.json({ success: true, count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
    }
    next(error);
  }
});

// ─── Scheduled & Outbox (email-level folders) ────────────────────
router.get('/scheduled', async (req: Request, res: Response, next) => {
  try {
    const ids = await accessibleMailboxIds(req.user!);
    const emails = await prisma.email.findMany({
      where: {
        status: 'SCHEDULED',
        ...(ids === 'ALL' ? {} : { mailboxId: { in: ids } }),
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        mailbox: { select: { id: true, email: true, displayName: true } },
        conversation: { select: { id: true, subject: true } },
      },
    });
    res.json({ emails });
  } catch (error) {
    next(error);
  }
});

router.get('/outbox', async (req: Request, res: Response, next) => {
  try {
    const ids = await accessibleMailboxIds(req.user!);
    const emails = await prisma.email.findMany({
      where: {
        status: { in: ['QUEUED', 'FAILED'] },
        ...(ids === 'ALL' ? {} : { mailboxId: { in: ids } }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        mailbox: { select: { id: true, email: true, displayName: true } },
        conversation: { select: { id: true, subject: true } },
      },
    });
    res.json({ emails });
  } catch (error) {
    next(error);
  }
});

export default router;
