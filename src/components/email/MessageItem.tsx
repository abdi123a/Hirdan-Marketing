import { useState } from 'react';
import { ChevronDown, Paperclip, Activity, AlertTriangle, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials, avatarColor, fullTime, listTime, displayName } from '@/lib/email/format';
import { useEmailEvents } from '@/lib/email/hooks';
import { StatusBadge } from './StatusBadge';
import { TrackingTimeline } from './TrackingTimeline';
import { EmailBody } from './EmailBody';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentChip } from './AttachmentChip';
import type { Attachment, EmailMessage } from '@/lib/email/types';

export function MessageItem({ email, defaultOpen }: { email: EmailMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const outbound = email.direction === 'OUTBOUND';
  const fromLabel = displayName(email.fromName, email.fromEmail);

  const { data: liveTracking, isFetching: trackingLoading } = useEmailEvents(
    outbound && open && trackingOpen ? email.id : null,
    trackingOpen
  );

  const events = liveTracking?.events ?? email.events ?? [];
  const trackingStatus = liveTracking?.status ?? email.status;

  return (
    <div className={cn('min-w-0 overflow-hidden rounded-xl border bg-card', !open && 'hover:bg-accent/30')}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', avatarColor(email.fromEmail))}>
          {initials(email.fromName, email.fromEmail)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{fromLabel}</span>
            {outbound && <StatusBadge status={trackingStatus} />}
            {email.status === 'FAILED' && email.errorMessage && (
              <span className="inline-flex items-center gap-1 text-xs text-red-500" title={email.errorMessage}>
                <AlertTriangle className="h-3 w-3" />
              </span>
            )}
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {open ? fullTime(email.sentAt || email.createdAt) : listTime(email.sentAt || email.createdAt)}
            </span>
          </div>
          {!open ? (
            <p className="truncate text-xs text-muted-foreground">
              {outbound && (
                <span className="mr-1 inline-flex items-center gap-0.5">
                  {email.sentBy ? `${email.sentBy.name} ·` : (<><Bot className="inline h-3 w-3" /> Automated ·</>)}
                </span>
              )}
              {email.snippet || ' '}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              To: {(email.toEmails ?? []).join(', ')}
              {email.ccEmails?.length ? ` · Cc: ${email.ccEmails.join(', ')}` : ''}
              {outbound && (email.sentBy ? ` · Sent by ${email.sentBy.name}` : ' · Sent automatically')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 pt-0.5">
          {email.attachments && email.attachments.length > 0 && (
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="min-w-0 px-4 pb-4">
          <EmailBody html={email.html} text={email.text} />

          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {email.attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} conversationId={email.conversationId} onPreview={setPreview} />
              ))}
            </div>
          )}

          {/* Real delivery tracking — collapsed until clicked */}
          {outbound && (
            <div className="mt-3 border-t pt-3">
              <button
                type="button"
                onClick={() => setTrackingOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Activity className="h-3.5 w-3.5" />
                Delivery tracking
                <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform', trackingOpen && 'rotate-180')} />
              </button>

              {trackingOpen && (
                <div className="mt-3">
                  <TrackingTimeline
                    events={events}
                    status={trackingStatus}
                    sentAt={email.sentAt}
                    loading={trackingLoading && !events.length}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AttachmentPreviewModal attachment={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
