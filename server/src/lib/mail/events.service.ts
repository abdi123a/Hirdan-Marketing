import type { EmailEventType, EmailStatus } from '@prisma/client';
import { prisma } from '../prisma.js';
import { publishMailEvent } from './sse.js';

/** Resend event.type → our event + resulting status. */
const EVENT_MAP: Record<string, { event: EmailEventType; status: EmailStatus }> = {
  'email.sent': { event: 'SENT', status: 'SENT' },
  'email.delivered': { event: 'DELIVERED', status: 'DELIVERED' },
  'email.delivery_delayed': { event: 'DELIVERY_DELAYED', status: 'DELIVERY_DELAYED' },
  'email.opened': { event: 'OPENED', status: 'OPENED' },
  'email.clicked': { event: 'CLICKED', status: 'CLICKED' },
  'email.bounced': { event: 'BOUNCED', status: 'BOUNCED' },
  'email.complained': { event: 'COMPLAINED', status: 'COMPLAINED' },
  'email.failed': { event: 'FAILED', status: 'FAILED' },
  'email.scheduled': { event: 'SCHEDULED', status: 'SCHEDULED' },
  'email.canceled': { event: 'CANCELED', status: 'CANCELED' },
};

/** Progress ranking so out-of-order webhooks never move status backwards. */
const STATUS_RANK: Record<EmailStatus, number> = {
  DRAFT: 0,
  QUEUED: 1,
  SCHEDULED: 1,
  SENT: 2,
  DELIVERY_DELAYED: 2,
  DELIVERED: 3,
  OPENED: 4,
  CLICKED: 5,
  RECEIVED: 5,
  // Terminal negative outcomes always win.
  BOUNCED: 100,
  COMPLAINED: 100,
  FAILED: 100,
  CANCELED: 100,
};

const TERMINAL_NEGATIVE = new Set<EmailStatus>(['BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELED']);

function nextStatus(current: EmailStatus, incoming: EmailStatus): EmailStatus {
  if (TERMINAL_NEGATIVE.has(incoming)) return incoming;
  if (TERMINAL_NEGATIVE.has(current)) return current;
  return STATUS_RANK[incoming] > STATUS_RANK[current] ? incoming : current;
}

/** Pull a named tag value from Resend's tags (array or object form). */
function extractTag(tags: unknown, name: string): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) {
    const found = tags.find((t) => t && typeof t === 'object' && (t as any).name === name);
    return found ? String((found as any).value ?? '') || null : null;
  }
  if (typeof tags === 'object' && name in (tags as any)) {
    return String((tags as any)[name] ?? '') || null;
  }
  return null;
}

function parseOccurredAt(type: string, data: any, createdAt?: string): Date {
  const specific =
    data?.[type.replace('email.', '')]?.timestamp ||
    data?.created_at ||
    createdAt;
  const d = specific ? new Date(specific) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Apply a Resend delivery/tracking event to the matching Email row: append the
 * event to its immutable timeline and advance its status. Returns true if a
 * matching email was found.
 */
export async function processEmailEvent(
  type: string,
  data: any,
  createdAt?: string
): Promise<boolean> {
  const mapped = EVENT_MAP[type];
  if (!mapped) return false;

  const resendId: string | null = data?.email_id || data?.id || null;
  const taggedId = extractTag(data?.tags, 'email_id');

  const orConds: any[] = [];
  if (resendId) orConds.push({ resendId });
  if (taggedId) orConds.push({ id: taggedId });
  if (!orConds.length) return false;

  const email = await prisma.email.findFirst({
    where: { OR: orConds },
    select: { id: true, status: true, mailboxId: true, conversationId: true },
  });
  if (!email) return false;

  // Single-instance event types should not be duplicated
  const singleInstanceTypes = new Set<EmailEventType>([
    'QUEUED',
    'SCHEDULED',
    'SENT',
    'DELIVERED',
    'BOUNCED',
    'COMPLAINED',
    'FAILED',
    'CANCELED',
    'RECEIVED',
    'REPLIED',
  ]);

  if (singleInstanceTypes.has(mapped.event)) {
    const existing = await prisma.emailEvent.findFirst({
      where: { emailId: email.id, type: mapped.event },
    });
    if (existing) {
      // Event already recorded, advance status if needed
      const advanced = nextStatus(email.status, mapped.status);
      if (advanced !== email.status) {
        await prisma.email.update({
          where: { id: email.id },
          data: { status: advanced, ...(resendId ? { resendId } : {}) },
        });
        publishMailEvent({
          type: 'event-update',
          mailboxId: email.mailboxId,
          conversationId: email.conversationId,
          emailId: email.id,
          status: advanced,
        });
      }
      return true;
    }
  }

  const link: string | null = data?.click?.link || data?.link || null;

  await prisma.emailEvent.create({
    data: {
      emailId: email.id,
      type: mapped.event,
      payload: data ?? undefined,
      link,
      occurredAt: parseOccurredAt(type, data, createdAt),
    },
  });

  // Backfill resendId if we matched purely by tag.
  const advanced = nextStatus(email.status, mapped.status);
  await prisma.email.update({
    where: { id: email.id },
    data: {
      ...(advanced !== email.status ? { status: advanced } : {}),
      ...(resendId ? { resendId } : {}),
    },
  });

  publishMailEvent({
    type: 'event-update',
    mailboxId: email.mailboxId,
    conversationId: email.conversationId,
    emailId: email.id,
    status: advanced,
  });

  return true;
}
