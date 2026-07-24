import { cn } from '@/lib/utils';
import { eventStyle } from '@/lib/email/status';
import { fullTime } from '@/lib/email/format';
import type { EmailEvent, EmailEventType } from '@/lib/email/types';
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

/**
 * Vertical delivery timeline for a message:
 * Queued → Sent → Delivered → Opened → Clicked → Replied
 */
export function TrackingTimeline({ events }: { events: EmailEvent[] }) {
  if (!events?.length) {
    return <p className="text-xs text-muted-foreground">No tracking events yet.</p>;
  }

  // 1. Deduplicate single-instance events (keeping the first occurrence)
  const seenTypes = new Set<EmailEventType>();
  const filteredEvents: EmailEvent[] = [];

  for (const ev of events) {
    if (SINGLE_INSTANCE_TYPES.has(ev.type)) {
      if (seenTypes.has(ev.type)) continue;
      seenTypes.add(ev.type);
    }
    filteredEvents.push(ev);
  }

  // 2. Sort events chronologically + by logical lifecycle stage
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();

    // If timestamps differ by more than 2 seconds, sort by timestamp
    if (Math.abs(timeA - timeB) > 2000) {
      return timeA - timeB;
    }

    // Otherwise, order by logical lifecycle sequence
    const orderA = EVENT_ORDER[a.type] ?? 50;
    const orderB = EVENT_ORDER[b.type] ?? 50;
    return orderA - orderB;
  });

  return (
    <ol className="relative space-y-3.5 pl-0.5">
      {sortedEvents.map((ev, idx) => {
        const s = eventStyle(ev.type);
        const Icon = getEventIcon(ev.type);
        const isLast = idx === sortedEvents.length - 1;

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
            <div className="pb-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{s.label}</span>
                {ev.link && (
                  <a
                    href={ev.link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="max-w-[180px] truncate text-xs text-primary hover:underline"
                    title={ev.link}
                  >
                    {ev.link}
                  </a>
                )}
              </div>
              <time className="text-[11px] text-muted-foreground">{fullTime(ev.occurredAt)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
