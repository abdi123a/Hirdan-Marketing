import fs from 'fs';
import { Router, type Request, type Response } from 'express';
import type { Email } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { requireStaff, assertMailboxAccess } from '../lib/mail/access.js';
import { getResendConfig, isResendConfigured, type ResendConfig } from '../lib/mail/resend-client.js';
import { buildMessageId } from '../lib/mail/util.js';
import { attachmentAbsolutePath } from '../lib/mail/attachments.js';
import { publishMailEvent } from '../lib/mail/sse.js';

const router = Router();
router.use(authenticate, requireStaff);

async function loadEmail(userId: string, role: string, id: string): Promise<Email> {
  const email = await prisma.email.findUnique({ where: { id } });
  if (!email) throw AppError.notFound('Email not found');
  await assertMailboxAccess({ userId, role }, email.mailboxId, 'WRITE');
  return email;
}

function pixelTagFor(emailId: string): string {
  const serverUrl = process.env.SERVER_URL || process.env.API_URL || 'https://app.hirdanmarketing.com';
  const pixelUrl = `${serverUrl.replace(/\/$/, '')}/api/email/track/open/${emailId}.png`;
  return `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" />`;
}

/** Re-send an existing (already-wrapped) email row through Resend. */
async function resendEmailRow(email: Email, config: ResendConfig): Promise<{ resendId: string | null; error: string | null }> {
  const mailbox = await prisma.mailbox.findUnique({ where: { id: email.mailboxId } });
  if (!mailbox) return { resendId: null, error: 'Mailbox not found' };

  const baseHtml = email.html || '';
  const pixel = pixelTagFor(email.id);
  const html = baseHtml.includes('</body>') ? baseHtml.replace('</body>', `${pixel}</body>`) : `${baseHtml}${pixel}`;

  // Re-attach stored files (best effort).
  const attachmentRows = await prisma.attachment.findMany({ where: { emailId: email.id } });
  const attachments: Array<{ filename: string; content: string }> = [];
  for (const a of attachmentRows) {
    try {
      const buf = fs.readFileSync(attachmentAbsolutePath(a.storageKey));
      attachments.push({ filename: a.filename, content: buf.toString('base64') });
    } catch {
      /* file missing — skip */
    }
  }

  const headers: Record<string, string> = {
    'Message-ID': email.messageId || buildMessageId(email.id, config.fromDomain),
  };
  if (email.inReplyTo) {
    headers['In-Reply-To'] = email.inReplyTo;
    headers['References'] = email.references || email.inReplyTo;
  }

  try {
    const result = await config.resend.emails.send({
      from: `${mailbox.displayName} <${mailbox.email}>`,
      to: email.toEmails as string[],
      ...(email.ccEmails ? { cc: email.ccEmails as string[] } : {}),
      ...(email.bccEmails ? { bcc: email.bccEmails as string[] } : {}),
      subject: email.subject,
      html,
      ...(email.text ? { text: email.text } : {}),
      ...(mailbox.replyTo ? { replyTo: mailbox.replyTo } : {}),
      headers,
      ...(attachments.length ? { attachments } : {}),
      tags: [
        { name: 'email_id', value: email.id },
        { name: 'mailbox_id', value: mailbox.id },
      ],
    });
    if (result.error) return { resendId: null, error: result.error.message };
    return { resendId: result.data?.id ?? null, error: null };
  } catch (err) {
    return { resendId: null, error: err instanceof Error ? err.message : 'Unknown send error' };
  }
}

// ─── POST /api/email/emails/:id/cancel — cancel a scheduled send ──
router.post('/emails/:id/cancel', async (req: Request, res: Response, next) => {
  try {
    const email = await loadEmail(req.user!.userId, req.user!.role, req.params.id as string);
    if (email.status !== 'SCHEDULED') throw AppError.badRequest('Only scheduled emails can be canceled');

    const config = await getResendConfig();
    if (email.resendId && isResendConfigured(config)) {
      try {
        await config.resend.emails.cancel(email.resendId);
      } catch (err) {
        // Non-fatal: still mark canceled locally.
        console.warn('[outbox] Resend cancel failed:', err instanceof Error ? err.message : err);
      }
    }

    const updated = await prisma.email.update({ where: { id: email.id }, data: { status: 'CANCELED' } });
    await prisma.emailEvent.create({ data: { emailId: email.id, type: 'CANCELED', occurredAt: new Date() } });
    publishMailEvent({ type: 'event-update', mailboxId: email.mailboxId, conversationId: email.conversationId, emailId: email.id, status: 'CANCELED' });

    res.json({ email: updated });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/email/emails/:id/retry — retry a failed send ──────
router.post('/emails/:id/retry', async (req: Request, res: Response, next) => {
  try {
    const email = await loadEmail(req.user!.userId, req.user!.role, req.params.id as string);
    if (email.status !== 'FAILED') throw AppError.badRequest('Only failed emails can be retried');

    const config = await getResendConfig();
    if (!isResendConfigured(config)) throw AppError.badRequest('Resend is not configured');

    // Move to QUEUED while we attempt.
    await prisma.email.update({ where: { id: email.id }, data: { status: 'QUEUED', errorMessage: null } });
    await prisma.emailEvent.create({ data: { emailId: email.id, type: 'QUEUED', occurredAt: new Date() } });

    const { resendId, error } = await resendEmailRow(email, config);
    const now = new Date();

    const updated = await prisma.email.update({
      where: { id: email.id },
      data: error
        ? { status: 'FAILED', errorMessage: error }
        : { status: 'SENT', resendId, sentAt: now, errorMessage: null },
    });
    await prisma.emailEvent.create({
      data: error
        ? { emailId: email.id, type: 'FAILED', payload: { error }, occurredAt: now }
        : { emailId: email.id, type: 'SENT', payload: resendId ? { resendId } : undefined, occurredAt: now },
    });
    publishMailEvent({
      type: 'event-update',
      mailboxId: email.mailboxId,
      conversationId: email.conversationId,
      emailId: email.id,
      status: updated.status,
    });

    if (error) throw AppError.badRequest(`Retry failed: ${error}`);
    res.json({ email: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
