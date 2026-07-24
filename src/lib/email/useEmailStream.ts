import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { emailApi } from './api';
import { emailKeys } from './hooks';
import { getFullUrl } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

type StreamEvent =
  | { type: 'new-email'; mailboxId: string; conversationId: string; emailId: string; direction: string }
  | { type: 'event-update'; mailboxId: string; conversationId: string; emailId: string; status: string }
  | { type: 'conversation-update'; mailboxId: string; conversationId: string }
  | { type: 'unread-count'; mailboxId: string; unreadCount: number };

/**
 * Opens the Email Center SSE channel and keeps TanStack Query caches fresh:
 * new inbound mail, delivery/tracking updates, and unread counts arrive live.
 * Fires a desktop notification on new inbound mail. Auto-reconnects with backoff.
 */
export function useEmailStream(options?: { onNewInbound?: (e: { conversationId: string }) => void }) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);
  const onNewInbound = options?.onNewInbound;

  useEffect(() => {
    if (!token) return;
    closedRef.current = false;

    // Ask for desktop notification permission once.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    let cancelled = false;

    const connect = async () => {
      if (cancelled || closedRef.current) return;
      try {
        const { ticket } = await emailApi.streamTicket();
        if (cancelled) return;
        const url = getFullUrl(`/email/stream?ticket=${encodeURIComponent(ticket)}`);
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;

        es.addEventListener('ready', () => { retryRef.current = 0; });

        const invalidateLists = () => {
          qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
          qc.invalidateQueries({ queryKey: emailKeys.mailboxes });
        };

        es.addEventListener('new-email', (ev) => {
          const data = JSON.parse((ev as MessageEvent).data) as StreamEvent & { type: 'new-email' };
          invalidateLists();
          qc.invalidateQueries({ queryKey: emailKeys.conversation(data.conversationId) });
          if (data.direction === 'INBOUND') {
            onNewInbound?.({ conversationId: data.conversationId });
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('New email', { body: 'You have a new message in your inbox.' });
              } catch { /* ignore */ }
            }
          }
        });

        es.addEventListener('event-update', (ev) => {
          const data = JSON.parse((ev as MessageEvent).data) as StreamEvent & { type: 'event-update' };
          qc.invalidateQueries({ queryKey: emailKeys.conversation(data.conversationId) });
          qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
        });

        es.addEventListener('conversation-update', () => invalidateLists());
        es.addEventListener('unread-count', () => qc.invalidateQueries({ queryKey: emailKeys.mailboxes }));

        es.onerror = () => {
          es.close();
          esRef.current = null;
          if (cancelled || closedRef.current) return;
          retryRef.current = Math.min(retryRef.current + 1, 6);
          const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
          setTimeout(connect, delay);
        };
      } catch {
        if (cancelled || closedRef.current) return;
        retryRef.current = Math.min(retryRef.current + 1, 6);
        setTimeout(connect, Math.min(1000 * 2 ** retryRef.current, 30000));
      }
    };

    connect();

    return () => {
      cancelled = true;
      closedRef.current = true;
      esRef.current?.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}
