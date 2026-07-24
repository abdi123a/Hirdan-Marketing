import type { ParticipantRole } from '@prisma/client';
import { prisma } from '../prisma.js';
import { sanitizeEmailHtml } from './sanitize.js';
import { storeAttachments, type IncomingAttachment } from './attachments.js';
import { publishMailEvent } from './sse.js';
import {
  normalizeSubject,
  toSnippet,
  htmlToText,
  parseAddressList,
  firstMessageId,
  allMessageIds,
} from './util.js';

type Address = { email: string; name?: string };

function parseAddress(input: unknown): Address | null {
  if (!input) return null;
  if (typeof input === 'string') return parseAddressList(input)[0] ?? null;
  if (typeof input === 'object' && (input as any).email) {
    const email = String((input as any).email).toLowerCase();
    if (!email.includes('@')) return null;
    return { email, name: (input as any).name };
  }
  return null;
}

function parseAddresses(input: unknown): Address[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(parseAddress).filter((a): a is Address => !!a);
  if (typeof input === 'string') return parseAddressList(input);
  const one = parseAddress(input);
  return one ? [one] : [];
}

function getHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  if (Array.isArray(headers)) {
    const h = headers.find((x) => x && String((x as any).name).toLowerCase() === lower);
    return h ? String((h as any).value) : null;
  }
  if (typeof headers === 'object') {
    for (const k of Object.keys(headers as any)) {
      if (k.toLowerCase() === lower) return String((headers as any)[k]);
    }
  }
  return null;
}

function dedupeParticipants(
  list: Array<{ email: string; name?: string | null; role: ParticipantRole }>
) {
  const seen = new Set<string>();
  const out: Array<{ email: string; name?: string | null; role: ParticipantRole }> = [];
  for (const p of list) {
    if (!p.email || !p.email.includes('@')) continue;
    const key = `${p.email}|${p.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

const THREAD_WINDOW_MS = 60 * 24 * 3600 * 1000; // 60 days

/**
 * Process an inbound email (Resend `email.received`). Attaches the message to
 * the correct conversation using Message-ID / In-Reply-To / References, falling
 * back to subject + participant matching, and only creating a new thread when no
 * match exists — so replies never fork into duplicate conversations.
 *
 * Returns true when the message was accepted (addressed to a known mailbox).
 */
export async function processInboundEmail(data: any): Promise<boolean> {
  const from = parseAddress(data?.from);
  if (!from) return false;

  const tos = parseAddresses(data?.to);
  const ccs = parseAddresses(data?.cc);
  const headers = data?.headers;

  const messageId = firstMessageId(getHeader(headers, 'message-id') || data?.message_id);
  const inReplyTo = firstMessageId(getHeader(headers, 'in-reply-to') || data?.in_reply_to);
  const references = getHeader(headers, 'references') || data?.references || null;
  const subject: string = data?.subject || getHeader(headers, 'subject') || '(no subject)';
  const html = sanitizeEmailHtml(data?.html || null);
  const text: string = data?.text || htmlToText(data?.html) || '';

  // Which of our mailboxes was this addressed to?
  const candidates = [...tos, ...ccs].map((a) => a.email);
  const mailbox = candidates.length
    ? await prisma.mailbox.findFirst({ where: { email: { in: candidates } } })
    : null;
  if (!mailbox) return false; // not for us (still recorded in WebhookLog)

  // Idempotency: same inbound Message-ID already stored?
  if (messageId) {
    const dup = await prisma.email.findFirst({
      where: { messageId, direction: 'INBOUND' },
      select: { id: true },
    });
    if (dup) return true;
  }

  // ── Thread matching ──────────────────────────────────────────
  const refIds = [inReplyTo, ...allMessageIds(references)].filter((v): v is string => !!v);
  let conversation = null as Awaited<ReturnType<typeof prisma.conversation.findUnique>> | null;

  if (refIds.length) {
    const parent = await prisma.email.findFirst({
      where: { messageId: { in: refIds } },
      select: { conversationId: true },
    });
    if (parent) {
      conversation = await prisma.conversation.findUnique({ where: { id: parent.conversationId } });
    }
  }

  if (!conversation) {
    const threadKey = normalizeSubject(subject);
    if (threadKey) {
      conversation = await prisma.conversation.findFirst({
        where: {
          mailboxId: mailbox.id,
          threadKey,
          participants: { some: { email: from.email } },
          createdAt: { gte: new Date(Date.now() - THREAD_WINDOW_MS) },
        },
        orderBy: { lastMessageAt: 'desc' },
      });
    }
  }

  const client = await prisma.client.findFirst({
    where: { email: from.email },
    select: { id: true },
  });

  const now = new Date();
  const snippet = toSnippet(text, html);
  const isNew = !conversation;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        mailboxId: mailbox.id,
        subject,
        threadKey: normalizeSubject(subject),
        clientId: client?.id ?? null,
        status: 'OPEN',
        snippet,
        participants: {
          create: dedupeParticipants([
            { email: from.email, name: from.name, role: 'FROM' },
            ...tos.map((t) => ({ email: t.email, name: t.name, role: 'TO' as ParticipantRole })),
            ...ccs.map((c) => ({ email: c.email, name: c.name, role: 'CC' as ParticipantRole })),
          ]),
        },
      },
    });
  }

  // ── Persist the inbound email ────────────────────────────────
  const email = await prisma.email.create({
    data: {
      conversationId: conversation.id,
      mailboxId: mailbox.id,
      direction: 'INBOUND',
      status: 'RECEIVED',
      fromEmail: from.email,
      fromName: from.name ?? null,
      toEmails: tos.map((t) => t.email),
      ccEmails: ccs.length ? ccs.map((c) => c.email) : undefined,
      subject,
      html,
      text,
      snippet,
      messageId: messageId ?? null,
      inReplyTo: inReplyTo ?? null,
      references: references ?? null,
      isRead: false,
      sentAt: now,
    },
  });

  await prisma.emailEvent.create({ data: { emailId: email.id, type: 'RECEIVED', occurredAt: now } });

  // ── Attachments ──────────────────────────────────────────────
  let hasAttachment = false;
  const rawAttachments = Array.isArray(data?.attachments) ? data.attachments : [];
  if (rawAttachments.length) {
    const incoming: IncomingAttachment[] = rawAttachments
      .filter((a: any) => a?.content)
      .map((a: any) => ({
        filename: a.filename || a.name || 'attachment',
        content: a.content,
        contentType: a.content_type || a.contentType,
      }));
    if (incoming.length) {
      const stored = storeAttachments(email.id, incoming);
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
        hasAttachment = true;
      }
    }
  }

  // ── Mark replied-to outbound messages as REPLIED ─────────────
  if (!isNew && refIds.length) {
    const parents = await prisma.email.findMany({
      where: { conversationId: conversation.id, direction: 'OUTBOUND', messageId: { in: refIds } },
      select: { id: true },
    });
    for (const p of parents) {
      await prisma.emailEvent.create({ data: { emailId: p.id, type: 'REPLIED', occurredAt: now } });
    }
    // Ensure the sender is a known participant on the existing thread.
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_email_role: {
          conversationId: conversation.id,
          email: from.email,
          role: 'FROM',
        },
      },
      create: { conversationId: conversation.id, email: from.email, name: from.name ?? null, role: 'FROM' },
      update: {},
    });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: now,
      lastInboundAt: now,
      messageCount: { increment: 1 },
      unreadCount: { increment: 1 },
      snippet,
      status: 'OPEN',
      isArchived: false,
      ...(hasAttachment ? { hasAttachment: true } : {}),
      ...(client?.id && !conversation.clientId ? { clientId: client.id } : {}),
    },
  });

  publishMailEvent({
    type: 'new-email',
    mailboxId: mailbox.id,
    conversationId: conversation.id,
    emailId: email.id,
    direction: 'INBOUND',
  });
  publishMailEvent({ type: 'conversation-update', mailboxId: mailbox.id, conversationId: conversation.id });
  publishMailEvent({ type: 'unread-count', mailboxId: mailbox.id, unreadCount: updated.unreadCount });

  return true;
}
