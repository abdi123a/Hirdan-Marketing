import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess } from '../lib/mail/access.js';
import { publishMailEvent } from '../lib/mail/sse.js';

const router = Router();
router.use(authenticate, requireStaff);

async function loadConversation(userId: string, role: string, id: string, level: 'READ' | 'WRITE' = 'READ') {
  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, mailboxId: true, clientId: true, participants: { select: { email: true } } },
  });
  if (!convo) throw AppError.notFound('Conversation not found');
  await assertMailboxAccess({ userId, role }, convo.mailboxId, level);
  return convo;
}

// ─── GET /api/email/conversations/:id/customer ───────────────────
router.get('/conversations/:id/customer', async (req: Request, res: Response, next) => {
  try {
    const convo = await loadConversation(req.user!.userId, req.user!.role, req.params.id as string);

    // Suggest a client by participant email when none is linked.
    let clientId = convo.clientId;
    let suggested = false;
    if (!clientId) {
      const emails = convo.participants.map((p) => p.email);
      const match = emails.length
        ? await prisma.client.findFirst({ where: { email: { in: emails } }, select: { id: true } })
        : null;
      if (match) { clientId = match.id; suggested = true; }
    }

    if (!clientId) return res.json({ customer: null, suggested: false });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, name: true, email: true, phone: true, company: true, city: true, country: true, status: true,
        _count: { select: { invoices: true, proformas: true, projects: true, subscriptions: true, emailConversations: true } },
        invoices: {
          select: { id: true, invoiceNumber: true, amount: true, status: true, date: true },
          orderBy: { date: 'desc' },
          take: 5,
        },
        emailConversations: {
          where: { id: { not: convo.id }, deletedAt: null },
          select: { id: true, subject: true, lastMessageAt: true, unreadCount: true },
          orderBy: { lastMessageAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!client) return res.json({ customer: null, suggested: false });

    return res.json({ customer: client, suggested });
  } catch (error) {
    return next(error);
  }
});

// ─── POST /api/email/conversations/:id/link-client ───────────────
const linkSchema = z.object({ clientId: z.string().nullable() });

router.post('/conversations/:id/link-client', async (req: Request, res: Response, next) => {
  try {
    const convo = await loadConversation(req.user!.userId, req.user!.role, req.params.id as string, 'WRITE');
    const { clientId } = linkSchema.parse(req.body);

    if (clientId) {
      const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!exists) throw AppError.badRequest('Client not found');
    }

    await prisma.conversation.update({ where: { id: convo.id }, data: { clientId } });
    publishMailEvent({ type: 'conversation-update', mailboxId: convo.mailboxId, conversationId: convo.id });
    res.json({ success: true, clientId });
  } catch (error) {
    if (error instanceof z.ZodError) return next(AppError.badRequest('clientId is required (or null)'));
    next(error);
  }
});

// ─── GET /api/email/clients/search?q= ────────────────────────────
router.get('/clients/search', async (req: Request, res: Response, next) => {
  try {
    const q = (req.query.q as string || '').trim();
    const clients = await prisma.client.findMany({
      where: q
        ? { OR: [{ name: { contains: q } }, { company: { contains: q } }, { email: { contains: q } }] }
        : {},
      select: { id: true, name: true, company: true, email: true },
      orderBy: { name: 'asc' },
      take: 10,
    });
    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

export default router;
