import { cn } from '@/lib/utils';
import { eventStyle } from '@/lib/email/status';
import { fullTime } from '@/lib/email/format';
import type { EmailEvent } from '@/lib/email/types';

/**
 * Vertical delivery timeline for a sent message:
 * Queued → Delivered → Opened → Clicked → Replied, each with a colored dot.
 */
export function TrackingTimeline({ events }: { events: EmailEvent[] }) {
  if (!events?.length) {
    return <p className="text-xs text-muted-foreground">No tracking events yet.</p>;
  }

  return (
    <ol className="relative space-y-3 pl-1">
      {events.map((ev, idx) => {
        const s = eventStyle(ev.type);
        const isLast = idx === events.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background', s.dot)} />
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{s.label}</span>
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
              <time className="text-xs text-muted-foreground">{fullTime(ev.occurredAt)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
