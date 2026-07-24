import type { Response } from 'express';

/**
 * In-memory Server-Sent-Events hub for the Email Center.
 *
 * Each connected browser tab registers one client with the set of mailboxes
 * the user is allowed to see. Events are only delivered to clients that have
 * access to the event's mailbox, so a user never receives activity for a
 * mailbox they cannot open.
 *
 * This is process-local. For multi-instance deployments, swap the internal
 * fan-out for a Redis pub/sub bridge (the publish/subscribe surface stays the
 * same).
 */

export interface SseClient {
  id: string;
  userId: string;
  mailboxIds: 'ALL' | string[];
  res: Response;
}

export type MailEvent =
  | { type: 'new-email'; mailboxId: string; conversationId: string; emailId: string; direction: string }
  | { type: 'event-update'; mailboxId: string; conversationId: string; emailId: string; status: string }
  | { type: 'conversation-update'; mailboxId: string; conversationId: string }
  | { type: 'unread-count'; mailboxId: string; unreadCount: number };

const clients = new Map<string, SseClient>();

export function addClient(client: SseClient): void {
  clients.set(client.id, client);
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function clientCount(): number {
  return clients.size;
}

function canSee(client: SseClient, mailboxId: string): boolean {
  return client.mailboxIds === 'ALL' || client.mailboxIds.includes(mailboxId);
}

/** Fan an event out to every connected client permitted to see the mailbox. */
export function publishMailEvent(event: MailEvent): void {
  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of clients.values()) {
    if (!canSee(client, event.mailboxId)) continue;
    try {
      client.res.write(frame);
    } catch {
      // Broken pipe — drop the client; its close handler will also clean up.
      clients.delete(client.id);
    }
  }
}

/** Heartbeat comment to keep proxies from closing idle SSE connections. */
export function pingAll(): void {
  for (const client of clients.values()) {
    try {
      client.res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clients.delete(client.id);
    }
  }
}
