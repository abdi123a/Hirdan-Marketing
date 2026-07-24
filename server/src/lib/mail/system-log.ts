import type { ParticipantRole } from '@prisma/client';
import { prisma } from '../prisma.js';
import { buildMessageId, normalizeSubject, toSnippet, htmlToText, toEmailArray } from './util.js';
import { getResendConfig } from './resend-client.js';
import { publishMailEvent } from './sse.js';

/**
 * Mirrors automated/transactional emails (invoices, proformas, file transfers,
 * welcome notes, reminders, …) sent through lib/email.ts into the Email Center
 * so they appear in the sending mailbox's Sent. Attributed to `sentById` when a
 * user triggered it, otherwise recorded as Automated (sentById = null).
 */

const mailboxCache = new Map<string, string>(); // fromEmail(lower) → mailboxId

async function ensureSystemMailbox(fromEmail: string, fromName?: string | null): Promise<string> {
  const key = fromEmail.toLowerCase();
  const cached = mailboxCache.get(key);
  if (cached) return cached;

  let mailbox = await prisma.mailbox.findUnique({ where: { email: key } });
  if (!mailbox) {
    mailbox = await prisma.mailbox.create({
      data: {
        email: key,
        displayName: fromName || 'Notifications',
        department: 'System',
        color: '#64748b',
        isActive: true,
      },
    });
  }
  mailboxCache.set(key, mailbox.id);
  return mailbox.id;
}

function dedupeParticipants(list: Array<{ email: string; name?: string | null; role: ParticipantRole }>) {
  const seen = new Set<string>();
  const out: typeof list = [];
  for (const p of list) {
    const email = (p.email || '').toLowerCase();
    if (!email.includes('@')) continue;
    const k = `${email}|${p.role}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...p, email });
  }
  return out;
}

export interface SystemEmailLog {
  fromEmail: string;
  fromName?: string | null;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  resendId?: string | null;
  sentById?: string | null;
  clientId?: string | null;
}

export async function logSystemEmail(input: SystemEmailLog): Promise<void> {
  try {
    const toArr = toEmailArray(input.to);
    if (!toArr.length) return;
    const ccArr = input.cc ? toEmailArray(input.cc) : [];

    const mailboxId = await ensureSystemMailbox(input.fromEmail, input.fromName);
    const subject = input.subject?.trim() || '(no subject)';
    const text = input.text || htmlToText(input.html);
    const snippet = toSnippet(text, input.html);
    const now = new Date();

    let clientId = input.clientId ?? null;
    if (!clientId) {
      const c = await prisma.client.findFirst({ where: { email: { in: toArr } }, select: { id: true } });
      clientId = c?.id ?? null;
    }

    const conversation = await prisma.conversation.create({
      data: {
        mailboxId,
        subject,
        clientId,
        threadKey: normalizeSubject(subject),
        status: 'OPEN',
        snippet,
        lastMessageAt: now,
        lastOutboundAt: now,
        messageCount: 1,
        participants: {
          create: dedupeParticipants([
            { email: input.fromEmail, name: input.fromName ?? null, role: 'FROM' },
            ...toArr.map((e) => ({ email: e, role: 'TO' as ParticipantRole })),
            ...ccArr.map((e) => ({ email: e, role: 'CC' as ParticipantRole })),
          ]),
        },
      },
    });

    const config = await getResendConfig().catch(() => null);

    const email = await prisma.email.create({
      data: {
        conversationId: conversation.id,
        mailboxId,
        direction: 'OUTBOUND',
        status: 'SENT',
        priority: 'NORMAL',
        fromEmail: input.fromEmail.toLowerCase(),
        fromName: input.fromName ?? null,
        toEmails: toArr,
        ccEmails: ccArr.length ? ccArr : undefined,
        subject,
        html: input.html,
        text,
        snippet,
        resendId: input.resendId ?? null,
        sentById: input.sentById ?? null,
        sentAt: now,
        isRead: true,
      },
    });

    await prisma.email.update({
      where: { id: email.id },
      data: { messageId: buildMessageId(email.id, config?.fromDomain ?? null) },
    });
    await prisma.emailEvent.create({
      data: {
        emailId: email.id,
        type: 'SENT',
        payload: input.resendId ? { resendId: input.resendId } : undefined,
        occurredAt: now,
      },
    });

    publishMailEvent({ type: 'new-email', mailboxId, conversationId: conversation.id, emailId: email.id, direction: 'OUTBOUND' });
    publishMailEvent({ type: 'conversation-update', mailboxId, conversationId: conversation.id });
  } catch (err) {
    // Non-fatal: mirroring must never break the actual send.
    console.warn('[system-log] failed to mirror system email:', err instanceof Error ? err.message : err);
  }
}
