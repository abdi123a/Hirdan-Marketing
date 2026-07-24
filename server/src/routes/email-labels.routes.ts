import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess } from '../lib/mail/access.js';
import { publishMailEvent } from '../lib/mail/sse.js';

const router = Router();
router.use(authenticate, requireStaff);

const labelSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Color must be a hex value').default('#6366f1'),
});

function zodErr(e: z.ZodError): AppError {
  return AppError.badRequest(e.issues.map((i) => i.message).join(', '));
}

// ─── GET /api/email/labels ───────────────────────────────────────
router.get('/labels', async (_req: Request, res: Response, next) => {
  try {
    const labels = await prisma.emailLabel.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { conversations: true } } },
    });
    res.json({
      labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color, count: l._count.conversations })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/email/labels ──────────────────────────────────────
router.post('/labels', async (req: Request, res: Response, next) => {
  try {
    const data = labelSchema.parse(req.body);
    const label = await prisma.emailLabel.create({ data });
    res.status(201).json({ label });
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    if ((error as { code?: string }).code === 'P2002') {
      return next(AppError.conflict('A label with that name already exists'));
    }
    next(error);
  }
});

// ─── PUT /api/email/labels/:id ───────────────────────────────────
router.put('/labels/:id', async (req: Request, res: Response, next) => {
  try {
    const data = labelSchema.partial().parse(req.body);
    const label = await prisma.emailLabel.update({ where: { id: req.params.id as string }, data });
    res.json({ label });
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    next(error);
  }
});

// ─── DELETE /api/email/labels/:id ────────────────────────────────
router.delete('/labels/:id', async (req: Request, res: Response, next) => {
  try {
    await prisma.emailLabel.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── Assign / remove labels on a conversation ────────────────────
async function loadConversation(userId: string, role: string, id: string) {
  const convo = await prisma.conversation.findUnique({ where: { id }, select: { id: true, mailboxId: true } });
  if (!convo) throw AppError.notFound('Conversation not found');
  await assertMailboxAccess({ userId, role }, convo.mailboxId, 'WRITE');
  return convo;
}

router.post('/conversations/:id/labels', async (req: Request, res: Response, next) => {
  try {
    const convo = await loadConversation(req.user!.userId, req.user!.role, req.params.id as string);
    const labelId = z.string().min(1).parse(req.body?.labelId);
    await prisma.conversationLabel.upsert({
      where: { conversationId_labelId: { conversationId: convo.id, labelId } },
      create: { conversationId: convo.id, labelId },
      update: {},
    });
    publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return next(AppError.badRequest('labelId is required'));
    next(error);
  }
});

router.delete('/conversations/:id/labels/:labelId', async (req: Request, res: Response, next) => {
  try {
    const convo = await loadConversation(req.user!.userId, req.user!.role, req.params.id as string);
    await prisma.conversationLabel.deleteMany({
      where: { conversationId: convo.id, labelId: req.params.labelId as string },
    });
    publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
