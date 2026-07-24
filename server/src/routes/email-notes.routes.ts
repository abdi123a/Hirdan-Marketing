import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess } from '../lib/mail/access.js';
import { createNotification } from '../lib/notifications.js';

const router = Router();
router.use(authenticate, requireStaff);

// ─── GET /api/email/mentionable-users — teammates for @mentions ───
// Staff-safe (the /users endpoint is admin-only). Returns internal users only.
router.get('/mentionable-users', async (_req: Request, res: Response, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: 'CLIENT' } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

async function loadConversation(userId: string, role: string, id: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, mailboxId: true, subject: true },
  });
  if (!convo) throw AppError.notFound('Conversation not found');
  await assertMailboxAccess({ userId, role }, convo.mailboxId, 'WRITE');
  return convo;
}

// ─── GET /api/email/conversations/:id/notes ──────────────────────
router.get('/conversations/:id/notes', async (req: Request, res: Response, next) => {
  try {
    const convo = await loadConversation(req.user!.userId, req.user!.role, req.params.id as string);
    const notes = await prisma.conversationNote.findMany({
      where: { conversationId: convo.id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ notes });
  } catch (error) {
    next(error);
  }
});

const noteSchema = z.object({
  body: z.string().min(1, 'Note cannot be empty'),
  mentions: z.array(z.string()).optional(),
});

// ─── POST /api/email/conversations/:id/notes ─────────────────────
router.post('/conversations/:id/notes', async (req: Request, res: Response, next) => {
  try {
    const convo = await loadConversation(req.user!.userId, req.user!.role, req.params.id as string);
    const { body, mentions = [] } = noteSchema.parse(req.body);

    const note = await prisma.conversationNote.create({
      data: {
        conversationId: convo.id,
        authorId: req.user!.userId,
        body,
        mentions: mentions.length ? mentions : undefined,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    // Notify mentioned teammates (never the author, never customers).
    const author = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });
    const uniqueMentions = [...new Set(mentions)].filter((uid) => uid && uid !== req.user!.userId);
    await Promise.all(
      uniqueMentions.map((userId) =>
        createNotification({
          userId,
          title: `${author?.name ?? 'A teammate'} mentioned you`,
          message: `In "${convo.subject || 'a conversation'}": ${body.slice(0, 120)}`,
          type: 'EMAIL_MENTION',
          category: 'ACTION_REQUIRED',
          entityType: 'email_conversation',
          entityId: convo.id,
          actionUrl: `/dashboard/email?conversation=${convo.id}`,
        })
      )
    );

    res.status(201).json({ note });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(AppError.badRequest(error.issues.map((i) => i.message).join(', ')));
    }
    next(error);
  }
});

// ─── DELETE /api/email/conversations/:id/notes/:noteId ───────────
router.delete('/conversations/:id/notes/:noteId', async (req: Request, res: Response, next) => {
  try {
    await loadConversation(req.user!.userId, req.user!.role, req.params.id as string);
    const note = await prisma.conversationNote.findUnique({ where: { id: req.params.noteId as string } });
    if (!note) throw AppError.notFound('Note not found');
    // Only the author or an admin may delete a note.
    if (note.authorId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw AppError.forbidden('You can only delete your own notes');
    }
    await prisma.conversationNote.delete({ where: { id: note.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
