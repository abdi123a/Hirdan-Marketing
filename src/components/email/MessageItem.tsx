import { useState } from 'react';
import { ChevronDown, Paperclip, Activity, Download, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { initials, avatarColor, fullTime, listTime, displayName, formatBytes } from '@/lib/email/format';
import { emailApi } from '@/lib/email/api';
import { getFullUrl } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { StatusBadge } from './StatusBadge';
import { TrackingTimeline } from './TrackingTimeline';
import type { EmailMessage } from '@/lib/email/types';

async function downloadAttachment(id: string, filename: string) {
  const token = useAuthStore.getState().token;
  const res = await fetch(getFullUrl(`/email/attachments/${id}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function MessageItem({ email, defaultOpen }: { email: EmailMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const outbound = email.direction === 'OUTBOUND';
  const fromLabel = displayName(email.fromName, email.fromEmail);

  return (
    <div className={cn('rounded-xl border bg-card', !open && 'hover:bg-accent/30')}>
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
            <p className="truncate text-xs text-muted-foreground">{email.snippet || ' '}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              To: {(email.toEmails ?? []).join(', ')}
              {email.ccEmails?.length ? ` · Cc: ${email.ccEmails.join(', ')}` : ''}
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
        <div className="px-4 pb-4">
          {/* Body */}
          {email.html ? (
            <div
              className="email-html prose prose-sm max-w-none dark:prose-invert"
              // Inbound HTML is sanitized server-side; outbound is authored in-app.
              dangerouslySetInnerHTML={{ __html: email.html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">{email.text}</pre>
          )}

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {email.attachments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => downloadAttachment(a.id, a.filename)}
                  className="group flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="max-w-[160px] truncate text-xs font-medium">{a.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</p>
                  </div>
                  <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
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
    </div>
  );
}
