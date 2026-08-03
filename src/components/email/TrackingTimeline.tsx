import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { eventStyle } from '@/lib/email/status';
import { fullTime } from '@/lib/email/format';
import type { EmailEvent, EmailEventType, EmailStatus } from '@/lib/email/types';
import {
  Clock,
  Send,
  CheckCircle2,
  Eye,
  MousePointer,
  Reply,
  AlertCircle,
  XCircle,
  Inbox,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

const EVENT_ORDER: Record<EmailEventType, number> = {
  QUEUED: 1,
  SCHEDULED: 1,
  SENT: 2,
  DELIVERY_DELAYED: 3,
  DELIVERED: 4,
  OPENED: 5,
  CLICKED: 6,
  RECEIVED: 7,
  REPLIED: 8,
  BOUNCED: 99,
  COMPLAINED: 99,
  FAILED: 99,
  CANCELED: 99,
};

const SINGLE_INSTANCE_TYPES = new Set<EmailEventType>([
  'QUEUED',
  'SCHEDULED',
  'SENT',
  'DELIVERY_DELAYED',
  'DELIVERED',
  'RECEIVED',
  'REPLIED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED',
  'CANCELED',
]);

type PipelineStep = {
  key: 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'REPLIED';
  label: string;
  done: boolean;
  at?: string;
  count?: number;
};

function getEventIcon(type: EmailEventType) {
  switch (type) {
    case 'QUEUED':
    case 'SCHEDULED':
      return Clock;
    case 'SENT':
      return Send;
    case 'DELIVERED':
      return CheckCircle2;
    case 'OPENED':
      return Eye;
    case 'CLICKED':
      return MousePointer;
    case 'REPLIED':
      return Reply;
    case 'RECEIVED':
      return Inbox;
    case 'BOUNCED':
    case 'COMPLAINED':
      return AlertTriangle;
    case 'FAILED':
    case 'CANCELED':
      return XCircle;
    default:
      return AlertCircle;
  }
}

function payloadMeta(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const open = (p.open ?? p.click) as Record<string, unknown> | undefined;
  const parts: string[] = [];
  const ua = (open?.userAgent ?? p.userAgent ?? p.user_agent) as string | undefined;
  const ip = (open?.ipAddress ?? open?.ip_address ?? p.ipAddress ?? p.ip) as string | undefined;
  if (ip) parts.push(ip);
  if (ua) {
    const short = ua.length > 72 ? `${ua.slice(0, 72)}…` : ua;
    parts.push(short);
  }
  if (typeof p.error === 'string') parts.push(p.error);
  return parts.length ? parts.join(' · ') : null;
}

function sortEvents(events: EmailEvent[]): EmailEvent[] {
  const seenTypes = new Set<EmailEventType>();
  const filtered: EmailEvent[] = [];

  for (const ev of events) {
    if (SINGLE_INSTANCE_TYPES.has(ev.type)) {
      if (seenTypes.has(ev.type)) continue;
      seenTypes.add(ev.type);
    }
    filtered.push(ev);
  }

  return [...filtered].sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    if (Math.abs(timeA - timeB) > 2000) return timeA - timeB;
    return (EVENT_ORDER[a.type] ?? 50) - (EVENT_ORDER[b.type] ?? 50);
  });
}

function buildPipeline(events: EmailEvent[], status: EmailStatus, sentAt?: string | null): PipelineStep[] {
  const byType = (t: EmailEventType) => events.filter((e) => e.type === t);
  const first = (t: EmailEventType) => byType(t)[0];
  const rank: Record<string, number> = {
    DRAFT: 0, QUEUED: 1, SCHEDULED: 1, SENT: 2, DELIVERY_DELAYED: 2,
    DELIVERED: 3, OPENED: 4, CLICKED: 5, RECEIVED: 5,
    BOUNCED: 100, COMPLAINED: 100, FAILED: 100, CANCELED: 100,
  };
  const statusRank = rank[status] ?? 0;
  const failed = statusRank >= 100;

  const sentEv = first('SENT') || first('SCHEDULED') || first('QUEUED');
  const deliveredEv = first('DELIVERED');
  const opened = byType('OPENED');
  const clicked = byType('CLICKED');
  const repliedEv = first('REPLIED');

  const sentDone = !!sentEv || statusRank >= 2 || !!sentAt;
  const deliveredDone = !failed && (!!deliveredEv || statusRank >= 3);
  const openedDone = !failed && (!!opened.length || statusRank >= 4);
  const clickedDone = !failed && (!!clicked.length || statusRank >= 5);

  return [
    {
      key: 'SENT',
      label: 'Sent',
      done: sentDone,
      at: sentEv?.occurredAt || sentAt || undefined,
    },
    {
      key: 'DELIVERED',
      label: 'Delivered',
      done: deliveredDone,
      at: deliveredEv?.occurredAt,
    },
    {
      key: 'OPENED',
      label: opened.length > 1 ? `Opened ×${opened.length}` : 'Opened',
      done: openedDone,
      at: opened[0]?.occurredAt,
      count: opened.length || undefined,
    },
    {
      key: 'CLICKED',
      label: clicked.length > 1 ? `Clicked ×${clicked.length}` : 'Clicked',
      done: clickedDone,
      at: clicked[0]?.occurredAt,
      count: clicked.length || undefined,
    },
    {
      key: 'REPLIED',
      label: 'Replied',
      done: !!repliedEv,
      at: repliedEv?.occurredAt,
    },
  ];
}

interface Props {
  events: EmailEvent[];
  status?: EmailStatus;
  sentAt?: string | null;
  loading?: boolean;
  compact?: boolean;
}

/**
 * Real delivery timeline driven by EmailEvent rows (Resend webhooks + open pixel).
 * Shows a pipeline of Sent → Delivered → Opened → Clicked → Replied plus the
 * chronological event log with timestamps and metadata.
 */
export function TrackingTimeline({ events, status = 'SENT', sentAt, loading, compact }: Props) {
  const sorted = useMemo(() => sortEvents(events ?? []), [events]);
  const pipeline = useMemo(() => buildPipeline(events ?? [], status, sentAt), [events, status, sentAt]);
  const terminal = sorted.find((e) =>
    e.type === 'BOUNCED' || e.type === 'FAILED' || e.type === 'COMPLAINED' || e.type === 'CANCELED'
  );

  if (loading && !events?.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading tracking…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pipeline strip */}
      <div className="flex items-start gap-0 overflow-x-auto pb-0.5">
        {pipeline.map((step, i) => {
          const Icon =
            step.key === 'SENT' ? Send
              : step.key === 'DELIVERED' ? CheckCircle2
                : step.key === 'OPENED' ? Eye
                  : step.key === 'CLICKED' ? MousePointer
                    : Reply;
          const style = eventStyle(step.key);
          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 text-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-background',
                    step.done ? cn(style.dot, 'text-white') : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn('text-[11px] font-medium leading-tight', step.done ? 'text-foreground' : 'text-muted-foreground')}>
                  {step.label}
                </span>
                {step.at ? (
                  <span className="max-w-full truncate text-[10px] text-muted-foreground" title={fullTime(step.at)}>
                    {fullTime(step.at)}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">{step.done ? '' : 'Waiting'}</span>
                )}
              </div>
              {i < pipeline.length - 1 && (
                <div
                  className={cn(
                    'mt-3.5 h-0.5 w-2 shrink-0 self-start sm:w-4',
                    step.done && pipeline[i + 1].done ? 'bg-primary/50' : 'bg-border'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {terminal && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-semibold">{eventStyle(terminal.type).label}</p>
            <p className="text-[11px] opacity-80">{fullTime(terminal.occurredAt)}</p>
            {payloadMeta(terminal.payload) && (
              <p className="mt-0.5 break-all text-[11px] opacity-80">{payloadMeta(terminal.payload)}</p>
            )}
          </div>
        </div>
      )}

      {/* Chronological event log */}
      {!compact && (
        <ol className="relative space-y-3 border-t pt-3 pl-0.5">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No delivery events yet — tracking updates when Resend confirms delivery, opens, and clicks.
            </p>
          ) : (
            sorted.map((ev, idx) => {
              const s = eventStyle(ev.type);
              const Icon = getEventIcon(ev.type);
              const isLast = idx === sorted.length - 1;
              const meta = payloadMeta(ev.payload);

              return (
                <li key={ev.id} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ring-2 ring-background',
                        s.dot
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="min-w-0 pb-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-xs font-semibold text-foreground">{s.label}</span>
                      {ev.link && (
                        <a
                          href={ev.link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="max-w-[220px] truncate text-xs text-primary hover:underline"
                          title={ev.link}
                        >
                          {ev.link}
                        </a>
                      )}
                    </div>
                    <time className="text-[11px] text-muted-foreground">{fullTime(ev.occurredAt)}</time>
                    {meta && <p className="mt-0.5 break-all text-[11px] text-muted-foreground/80">{meta}</p>}
                  </div>
                </li>
              );
            })
          )}
        </ol>
      )}
    </div>
  );
}
