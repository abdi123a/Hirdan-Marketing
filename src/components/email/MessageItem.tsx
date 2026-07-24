import { useState } from 'react';
import { ChevronDown, Paperclip, Activity, AlertTriangle, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { initials, avatarColor, fullTime, listTime, displayName } from '@/lib/email/format';
import { StatusBadge } from './StatusBadge';
import { TrackingTimeline } from './TrackingTimeline';
import { EmailBody } from './EmailBody';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { AttachmentChip } from './AttachmentChip';
import type { Attachment, EmailMessage } from '@/lib/email/types';

export function MessageItem({ email, defaultOpen }: { email: EmailMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const outbound = email.direction === 'OUTBOUND';
  const fromLabel = displayName(email.fromName, email.fromEmail);

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
            {outbound && <StatusBadge status={email.status} />}
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
          {/* Body */}
          <EmailBody html={email.html} text={email.text} />

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {email.attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} conversationId={email.conversationId} onPreview={setPreview} />
              ))}
            </div>
          )}

          {/* Tracking */}
          {outbound && email.events && email.events.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    Tracking timeline
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72">
                  <p className="mb-3 text-sm font-semibold">Delivery timeline</p>
                  <TrackingTimeline events={email.events} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}

      <AttachmentPreviewModal attachment={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
