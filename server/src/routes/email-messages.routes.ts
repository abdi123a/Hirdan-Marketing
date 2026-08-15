import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, requireMailboxAccess, assertMailboxAccess } from '../lib/mail/access.js';
import { sendMailboxEmail, SendPersistedError } from '../lib/mail/send.service.js';
import { htmlToText, allMessageIds } from '../lib/mail/util.js';

const router = Router();
router.use(authenticate, requireStaff);

const attachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  contentType: z.string().optional(),
});

const emailList = z.array(z.string().email());

const sendSchema = z.object({
  mailboxId: z.string().min(1),
  to: emailList.min(1, 'At least one recipient is required'),
  cc: emailList.optional(),
  bcc: emailList.optional(),
  subject: z.string().default(''),
  html: z.string().default(''),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  clientId: z.string().nullable().optional(),
  draftId: z.string().nullable().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

function zodErr(error: z.ZodError): AppError {
  return AppError.badRequest(error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
}

// ─── POST /api/email/messages — compose & send a new email ───────
router.post(
  '/messages',
  requireMailboxAccess('WRITE'),
  async (req: Request, res: Response, next) => {
    try {
      const input = sendSchema.parse(req.body);
      const result = await sendMailboxEmail({
        user: req.user!,
        mailboxId: input.mailboxId,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        html: input.html,
        priority: input.priority,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        clientId: input.clientId ?? null,
        attachments: input.attachments,
      });

      if (input.draftId) {
        await prisma.draft.deleteMany({ where: { id: input.draftId, userId: req.user!.userId } });
      }

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return next(zodErr(error));
      if (error instanceof SendPersistedError) {
        // Row persisted in Outbox as FAILED — report but include the record.
        return res.status(502).json({
          error: true,
          message: error.message,
          email: error.email,
          conversation: error.conversation,
        });
      }
      next(error);
    }
  }
);

// ─── POST /api/email/conversations/:conversationId/reply ─────────
const replySchema = z.object({
  html: z.string().min(1, 'Message body is required'),
  /** Optional From override — reply from another mailbox the user can send from. */
  mailboxId: z.string().optional(),
  to: emailList.optional(),
  cc: emailList.optional(),
  bcc: emailList.optional(),
  replyAll: z.boolean().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

router.post('/conversations/:conversationId/reply', async (req: Request, res: Response, next) => {
  try {
    const input = replySchema.parse(req.body);
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId as string },
      include: {
        mailbox: true,
        participants: true,
        emails: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!conversation) throw AppError.notFound('Conversation not found');
    const sendMailboxId = input.mailboxId || conversation.mailboxId;
    await assertMailboxAccess(req.user!, sendMailboxId, 'WRITE');
    if (sendMailboxId !== conversation.mailboxId) {
      await assertMailboxAccess(req.user!, conversation.mailboxId, 'READ');
    }

    const last = conversation.emails[0];
    const mailboxEmail = conversation.mailbox.email.toLowerCase();

    // Recipients: explicit > last inbound sender > TO participants (minus us)
    let to = input.to ?? [];
    if (!to.length) {
      if (last && last.direction === 'INBOUND') {
        to = [last.fromEmail];
      } else {
        to = conversation.participants
          .filter((p) => p.role === 'TO' && p.email.toLowerCase() !== mailboxEmail)
          .map((p) => p.email);
      }
    }
    if (!to.length) throw AppError.badRequest('No reply recipient could be determined; provide "to"');

    let cc = input.cc ?? [];
    if (input.replyAll && !input.cc) {
      cc = conversation.participants
        .filter((p) => p.role === 'CC' && p.email.toLowerCase() !== mailboxEmail)
        .map((p) => p.email);
    }

    const inReplyToMessageId = last?.messageId ?? null;
    const references = [...allMessageIds(last?.references), last?.messageId]
      .filter((v): v is string => !!v)
      .join(' ');

    const baseSubject = conversation.subject || '(no subject)';
    const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

    const result = await sendMailboxEmail({
      user: req.user!,
      mailboxId: sendMailboxId,
      conversationId: conversation.id,
      to,
      cc,
      bcc: input.bcc,
      subject,
      html: input.html,
      priority: input.priority,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      clientId: conversation.clientId,
      inReplyToMessageId,
      references: references || null,
      attachments: input.attachments,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    if (error instanceof SendPersistedError) {
      return res.status(502).json({
        error: true,
        message: error.message,
        email: error.email,
        conversation: error.conversation,
      });
    }
    next(error);
  }
});

// ─── POST /api/email/messages/:id/forward ────────────────────────
const forwardSchema = z.object({
  mailboxId: z.string().optional(),
  to: emailList.min(1, 'At least one recipient is required'),
  cc: emailList.optional(),
  bcc: emailList.optional(),
  note: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

router.post('/messages/:id/forward', async (req: Request, res: Response, next) => {
  try {
    const input = forwardSchema.parse(req.body);
    const original = await prisma.email.findUnique({
      where: { id: req.params.id as string },
      include: { attachments: true },
    });
    if (!original) throw AppError.notFound('Email not found');

    const mailboxId = input.mailboxId || original.mailboxId;
    await assertMailboxAccess(req.user!, mailboxId, 'WRITE');

    const baseSubject = original.subject || '(no subject)';
    const subject = /^fwd?:/i.test(baseSubject) ? baseSubject : `Fwd: ${baseSubject}`;

    const quoted = `
      ${input.note ? `<p>${input.note}</p>` : ''}
      <br/>
      <div style="border-left:3px solid #e2e8f0;padding-left:12px;color:#475569;">
        <p>---------- Forwarded message ----------<br/>
        From: ${original.fromName ? `${original.fromName} ` : ''}&lt;${original.fromEmail}&gt;<br/>
        Subject: ${baseSubject}<br/>
        To: ${(original.toEmails as string[] | null)?.join(', ') ?? ''}</p>
        ${original.html || `<pre>${htmlToText(original.text)}</pre>`}
      </div>`;

    const result = await sendMailboxEmail({
      user: req.user!,
      mailboxId,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject,
      html: quoted,
      clientId: original.mailboxId === mailboxId ? undefined : null,
      attachments: input.attachments,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    if (error instanceof SendPersistedError) {
      return res.status(502).json({ error: true, message: error.message, email: error.email, conversation: error.conversation });
    }
    next(error);
  }
});

// ─── Drafts (autosave) ───────────────────────────────────────────
const draftSchema = z.object({
  mailboxId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  to: emailList.optional(),
  cc: emailList.optional(),
  bcc: emailList.optional(),
  subject: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

router.get('/drafts', async (req: Request, res: Response, next) => {
  try {
    const drafts = await prisma.draft.findMany({
      where: { userId: req.user!.userId },
      orderBy: { updatedAt: 'desc' },
      include: { attachments: true },
    });
    res.json({ drafts });
  } catch (error) {
    next(error);
  }
});

router.post('/drafts', async (req: Request, res: Response, next) => {
  try {
    const input = draftSchema.parse(req.body);
    const draft = await prisma.draft.create({
      data: {
        userId: req.user!.userId,
        mailboxId: input.mailboxId ?? null,
        conversationId: input.conversationId ?? null,
        toEmails: input.to ?? undefined,
        ccEmails: input.cc ?? undefined,
        bccEmails: input.bcc ?? undefined,
        subject: input.subject ?? null,
        html: input.html ?? null,
        priority: input.priority ?? 'NORMAL',
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      },
    });
    res.status(201).json({ draft });
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    next(error);
  }
});

router.put('/drafts/:id', async (req: Request, res: Response, next) => {
  try {
    const input = draftSchema.parse(req.body);
    const existing = await prisma.draft.findFirst({
      where: { id: req.params.id as string, userId: req.user!.userId },
    });
    if (!existing) throw AppError.notFound('Draft not found');

    const draft = await prisma.draft.update({
      where: { id: existing.id },
      data: {
        mailboxId: input.mailboxId ?? existing.mailboxId,
        conversationId: input.conversationId ?? existing.conversationId,
        toEmails: input.to ?? undefined,
        ccEmails: input.cc ?? undefined,
        bccEmails: input.bcc ?? undefined,
        subject: input.subject ?? existing.subject,
        html: input.html ?? existing.html,
        priority: input.priority ?? existing.priority,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : existing.scheduledAt,
      },
    });
    res.json({ draft });
  } catch (error) {
    if (error instanceof z.ZodError) return next(zodErr(error));
    next(error);
  }
});

router.delete('/drafts/:id', async (req: Request, res: Response, next) => {
  try {
    await prisma.draft.deleteMany({ where: { id: req.params.id as string, userId: req.user!.userId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
