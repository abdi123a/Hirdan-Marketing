import type { Conversation, Email, EmailPriority, ParticipantRole } from '@prisma/client';
import { prisma } from '../prisma.js';
import { getResendConfig, isResendConfigured } from './resend-client.js';
import { generateEmailHtml } from '../email.js';
import { buildMessageId, normalizeSubject, toSnippet, htmlToText } from './util.js';
import { storeAttachments, type IncomingAttachment } from './attachments.js';
import { publishMailEvent } from './sse.js';
import { AppError } from '../errors.js';
import type { AuthUser } from './access.js';

export interface SendMailInput {
  user: AuthUser;
  mailboxId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  priority?: EmailPriority;
  scheduledAt?: Date | null;
  /** Provide to reply into an existing thread. */
  conversationId?: string | null;
  clientId?: string | null;
  inReplyToMessageId?: string | null;
  references?: string | null;
  attachments?: IncomingAttachment[];
}

export interface SendMailResult {
  email: Email;
  conversation: Conversation;
}

/** Error thrown after the outbound row has been persisted (lands in Outbox/Failed). */
export class SendPersistedError extends Error {
  email: Email;
  conversation: Conversation;
  constructor(message: string, email: Email, conversation: Conversation) {
    super(message);
    this.name = 'SendPersistedError';
    this.email = email;
    this.conversation = conversation;
  }
}

function priorityHeaders(priority?: EmailPriority): Record<string, string> {
  if (priority === 'HIGH') return { 'X-Priority': '1', Importance: 'high' };
  if (priority === 'LOW') return { 'X-Priority': '5', Importance: 'low' };
  return {};
}

type ParticipantSeed = { email: string; name?: string; role: ParticipantRole };

function dedupeParticipants(list: ParticipantSeed[]): ParticipantSeed[] {
  const seen = new Set<string>();
  const out: ParticipantSeed[] = [];
  for (const p of list) {
    if (!p.email || !p.email.includes('@')) continue;
    const key = `${p.email.toLowerCase()}|${p.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...p, email: p.email.toLowerCase() });
  }
  return out;
}

/**
 * The single outbound pipeline used by compose, reply and forward.
 * Persists the conversation + email + events, sends through Resend, records the
 * outcome, and publishes SSE events. Correlates webhooks via `resendId` and the
 * `email_id` tag.
 */
export async function sendMailboxEmail(input: SendMailInput): Promise<SendMailResult> {
  const mailbox = await prisma.mailbox.findUnique({ where: { id: input.mailboxId } });
  if (!mailbox) throw AppError.notFound('Mailbox not found');
  if (!mailbox.isActive) throw AppError.badRequest('This mailbox is inactive');

  const config = await getResendConfig();
  const subject = input.subject?.trim() || '(no subject)';
  const text = htmlToText(input.html);
  const snippet = toSnippet(text, input.html);
  const now = new Date();
  const isScheduled = !!input.scheduledAt && input.scheduledAt.getTime() > now.getTime() + 1000;

  let finalHtml = input.html;
  if (!finalHtml.includes('<!DOCTYPE html>') && !finalHtml.includes('class="wrapper"')) {
    finalHtml = await generateEmailHtml({
      title: subject,
      contentHtml: input.html,
      isAutomated: false,
    });
  }

  // 1. Resolve or create the conversation
  let conversation = input.conversationId
    ? await prisma.conversation.findUnique({ where: { id: input.conversationId } })
    : null;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        mailboxId: mailbox.id,
        subject,
        clientId: input.clientId ?? null,
        threadKey: normalizeSubject(subject),
        snippet,
        status: 'OPEN',
        participants: {
          create: dedupeParticipants([
            { email: mailbox.email, name: mailbox.displayName, role: 'FROM' },
            ...input.to.map((e) => ({ email: e, role: 'TO' as ParticipantRole })),
            ...(input.cc ?? []).map((e) => ({ email: e, role: 'CC' as ParticipantRole })),
            ...(input.bcc ?? []).map((e) => ({ email: e, role: 'BCC' as ParticipantRole })),
          ]),
        },
      },
    });
  }

  // 2. Create the Email row (id feeds the Message-ID + tags)
  const email = await prisma.email.create({
    data: {
      conversationId: conversation.id,
      mailboxId: mailbox.id,
      direction: 'OUTBOUND',
      status: isScheduled ? 'SCHEDULED' : 'QUEUED',
      priority: input.priority ?? 'NORMAL',
      fromEmail: mailbox.email,
      fromName: mailbox.displayName,
      toEmails: input.to,
      ccEmails: input.cc && input.cc.length ? input.cc : undefined,
      bccEmails: input.bcc && input.bcc.length ? input.bcc : undefined,
      subject,
      html: finalHtml,
      text,
      snippet,
      sentById: input.user.userId,
      scheduledAt: input.scheduledAt ?? null,
      inReplyTo: input.inReplyToMessageId ?? null,
      references: input.references ?? null,
    },
  });

  const messageId = buildMessageId(email.id, config.fromDomain);
  await prisma.email.update({ where: { id: email.id }, data: { messageId } });

  // 3. Persist attachments (to disk + rows) and prepare Resend payload
  let resendAttachments: Array<{ filename: string; content: string }> | undefined;
  if (input.attachments && input.attachments.length) {
    const stored = storeAttachments(email.id, input.attachments);
    if (stored.length) {
      await prisma.attachment.createMany({
        data: stored.map((s) => ({
          emailId: email.id,
          filename: s.filename,
          mimeType: s.mimeType,
          size: s.size,
          storageKey: s.storageKey,
          checksum: s.checksum,
        })),
      });
      resendAttachments = stored.map((s) => ({ filename: s.filename, content: s.buffer.toString('base64') }));
      await prisma.conversation.update({ where: { id: conversation.id }, data: { hasAttachment: true } });
    }
  }

  // 4. QUEUED / SCHEDULED event
  await prisma.emailEvent.create({
    data: { emailId: email.id, type: isScheduled ? 'SCHEDULED' : 'QUEUED', occurredAt: now },
  });

  // 5. Send through Resend
  const serverUrl = process.env.SERVER_URL || process.env.API_URL || 'https://app.hirdanmarketing.com';
  const pixelUrl = `${serverUrl.replace(/\/$/, '')}/api/email/track/open/${email.id}.png`;
  const pixelTag = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" />`;

  const htmlWithPixel = finalHtml
    ? (finalHtml.includes('</body>') ? finalHtml.replace('</body>', `${pixelTag}</body>`) : `${finalHtml}${pixelTag}`)
    : pixelTag;

  const headers: Record<string, string> = { 'Message-ID': messageId, ...priorityHeaders(input.priority) };
  if (input.inReplyToMessageId) {
    headers['In-Reply-To'] = input.inReplyToMessageId;
    headers['References'] = input.references || input.inReplyToMessageId;
  }

  let sendError: string | null = null;
  let resendId: string | null = null;

  if (!isResendConfigured(config)) {
    sendError = 'RESEND_API_KEY is not configured';
  } else {
    try {
      const result = await config.resend.emails.send({
        from: `${mailbox.displayName} <${mailbox.email}>`,
        to: input.to,
        ...(input.cc && input.cc.length ? { cc: input.cc } : {}),
        ...(input.bcc && input.bcc.length ? { bcc: input.bcc } : {}),
        subject,
        html: htmlWithPixel,
        text,
        ...(mailbox.replyTo ? { replyTo: mailbox.replyTo } : {}),
        headers,
        ...(resendAttachments ? { attachments: resendAttachments } : {}),
        ...(isScheduled ? { scheduledAt: input.scheduledAt!.toISOString() } : {}),
        tags: [
          { name: 'email_id', value: email.id },
          { name: 'mailbox_id', value: mailbox.id },
        ],
      });
      if (result.error) sendError = result.error.message;
      else resendId = result.data?.id ?? null;
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Unknown send error';
    }
  }

  // 6. Persist outcome + events
  const updatedEmail = await prisma.email.update({
    where: { id: email.id },
    data: sendError
      ? { status: 'FAILED', errorMessage: sendError }
      : { status: isScheduled ? 'SCHEDULED' : 'SENT', resendId, sentAt: isScheduled ? null : now },
  });

  await prisma.emailEvent.create({
    data: sendError
      ? { emailId: email.id, type: 'FAILED', payload: { error: sendError }, occurredAt: new Date() }
      : {
          emailId: email.id,
          type: isScheduled ? 'SCHEDULED' : 'SENT',
          payload: resendId ? { resendId } : undefined,
          occurredAt: new Date(),
        },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      snippet,
      messageCount: { increment: 1 },
      lastMessageAt: now,
      lastOutboundAt: now,
      ...(input.clientId ? { clientId: input.clientId } : {}),
    },
  });

  // 7. Notify listeners
  publishMailEvent({
    type: 'new-email',
    mailboxId: mailbox.id,
    conversationId: updatedConversation.id,
    emailId: updatedEmail.id,
    direction: 'OUTBOUND',
  });
  publishMailEvent({ type: 'conversation-update', mailboxId: mailbox.id, conversationId: updatedConversation.id });

  if (sendError) {
    throw new SendPersistedError(sendError, updatedEmail, updatedConversation);
  }

  return { email: updatedEmail, conversation: updatedConversation };
}
