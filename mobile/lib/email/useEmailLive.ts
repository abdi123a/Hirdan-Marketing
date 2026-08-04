import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { emailKeys } from './hooks';

const INTERVAL_MS = 15_000;

/**
 * Keeps the Email Center caches fresh. The web client uses an SSE channel, which
 * React Native has no EventSource for, so this polls on an interval instead and
 * pauses whenever the app is backgrounded (resuming with an immediate refresh).
 */
export function useEmailLive(options?: { conversationId?: string | null; enabled?: boolean }) {
  const qc = useQueryClient();
  const conversationId = options?.conversationId ?? null;
  const enabled = options?.enabled !== false;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['email', 'conversations'] });
      qc.invalidateQueries({ queryKey: emailKeys.mailboxes });
      if (conversationId) {
        qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
      }
    };

    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(refresh, INTERVAL_MS);
    };

    const stop = () => {
      if (!timer.current) return;
      clearInterval(timer.current);
      timer.current = null;
    };

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        refresh();
        start();
      } else {
        stop();
      }
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      sub.remove();
      stop();
    };
  }, [qc, conversationId, enabled]);
}
