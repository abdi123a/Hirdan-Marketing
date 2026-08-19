import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Send, Paperclip, X, Loader2, Clock, Flag, Trash2,
  Minus, Maximize2, Minimize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import RichTextEditor from '@/components/RichTextEditor';
import { EmailChipsInput } from './EmailChipsInput';
import { TemplatePicker } from './TemplatePicker';
import { emailApi } from '@/lib/email/api';
import { useSendEmail } from '@/lib/email/hooks';
import { fileToAttachment, type PreparedAttachment } from '@/lib/email/attachments';
import { applyTemplateVars } from '@/lib/email/templateVars';
import { formatBytes } from '@/lib/email/format';
import { useIsMobile } from '@/hooks/use-mobile';
import type { EmailPriority, EmailTemplate, Mailbox } from '@/lib/email/types';

export interface ComposeInitial {
  mailboxId?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  html?: string;
  draftId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mailboxes: Mailbox[];
  initial?: ComposeInitial;
  onSent?: () => void;
}

const PRIORITIES: EmailPriority[] = ['LOW', 'NORMAL', 'HIGH'];

type ComposeSize = 'normal' | 'minimized' | 'expanded';

export function ComposeModal({ open, onClose, mailboxes, initial, onSent }: Props) {
  const isMobile = useIsMobile();
  const writable = useMemo(
    () => mailboxes.filter((m) => m.isActive && (m.accessLevel === 'ADMIN' || m.accessLevel === 'WRITE' || m.accessLevel === 'MANAGE')),
    [mailboxes]
  );

  const editorRef = useRef<HTMLDivElement>(null);
  const [mailboxId, setMailboxId] = useState('');
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<EmailPriority>('NORMAL');
  const [scheduledAt, setScheduledAt] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [size, setSize] = useState<ComposeSize>('normal');
  const [toFocused, setToFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = useSendEmail();
  const selectedMailbox = writable.find((m) => m.id === mailboxId);

  // Initialize when opened.
  useEffect(() => {
    if (!open) return;
    setMailboxId(initial?.mailboxId || writable.find((m) => m.isDefault)?.id || writable[0]?.id || '');
    setTo(initial?.to || []);
    setCc(initial?.cc || []);
    setBcc([]);
    setShowCc(!!initial?.cc?.length);
    setShowBcc(false);
    setSubject(initial?.subject || '');
    setPriority('NORMAL');
    setScheduledAt('');
    setShowSchedule(false);
    setAttachments([]);
    setDraftId(initial?.draftId);
    setSize(isMobile ? 'expanded' : 'normal');
    setToFocused(false);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = initial?.html || '';
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape minimizes (Gmail-like) unless already minimized → then closes via discard prompt path.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (size === 'minimized') void saveDraftAndClose();
      else setSize('minimized');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, size, mailboxId, to, cc, bcc, subject, priority, draftId]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const prepared = await Promise.all([...files].map(fileToAttachment));
    setAttachments((prev) => [...prev, ...prepared]);
  };

  const insertTemplate = (t: EmailTemplate) => {
    if (!subject.trim() && t.subject) setSubject(applyTemplateVars(t.subject));
    const rendered = applyTemplateVars(t.body);
    if (editorRef.current) {
      const existing = editorRef.current.innerHTML.trim();
      editorRef.current.innerHTML = existing && existing !== '<br>' ? `${existing}<br/>${rendered}` : rendered;
    }
  };

  // Autosave draft every few seconds when there is content
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      const html = editorRef.current?.innerHTML || '';
      const hasContent = to.length || cc.length || subject.trim() || (html && html !== '<br>');
      if (!hasContent) return;
      try {
        const payload = {
          mailboxId: mailboxId || null,
          to, cc, bcc,
          subject: subject || null,
          html,
          priority,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        };
        if (draftId) {
          await emailApi.updateDraft(draftId, payload);
        } else {
          const res = await emailApi.createDraft(payload);
          setDraftId(res.draft.id);
        }
      } catch {
        /* autosave is best-effort */
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, to, cc, bcc, subject, priority, scheduledAt, mailboxId, draftId]);

  const handleSend = async () => {
    if (!mailboxId) return toast.error('Choose a mailbox to send from');
    if (!to.length) return toast.error('Add at least one recipient');
    const body = editorRef.current?.innerHTML || '';
    const html = selectedMailbox?.signature ? `${body}<br/><br/>${selectedMailbox.signature}` : body;

    try {
      await send.mutateAsync({
        mailboxId,
        to, cc, bcc,
        subject,
        html,
        priority,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        draftId,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      onSent?.();
      onClose();
    } catch {
      /* toast handled in hook */
    }
  };

  const saveDraftAndClose = async () => {
    const html = editorRef.current?.innerHTML || '';
    const payload = { mailboxId: mailboxId || null, to, cc, bcc, subject: subject || null, html, priority };
    try {
      if (draftId) await emailApi.updateDraft(draftId, payload);
      else if (to.length || subject.trim() || html) await emailApi.createDraft(payload);
      toast.success('Draft saved');
    } catch { /* ignore */ }
    onClose();
  };

  const discard = async () => {
    try {
      if (draftId) await emailApi.deleteDraft(draftId);
    } catch { /* ignore */ }
    onClose();
  };

  if (!open || typeof document === 'undefined') return null;

  const titleLabel = subject.trim() || (initial?.subject ? initial.subject : 'New Message');
  const showRecipientDetails = toFocused || to.length > 0 || showCc || showBcc;

  const shell = (
    <div
      role="dialog"
      aria-label="Compose email"
      className={cn(
        'fixed z-[80] flex flex-col overflow-hidden bg-background shadow-2xl transition-[width,height,border-radius] duration-200',
        // Mobile: always fullscreen
        isMobile && 'inset-0 rounded-none',
        // Desktop sizes
        !isMobile && size === 'minimized' && 'bottom-0 right-6 h-10 w-[300px] rounded-t-lg',
        !isMobile && size === 'normal' && 'bottom-0 right-6 h-[min(560px,calc(100dvh-5rem))] w-[min(560px,calc(100vw-2rem))] rounded-t-lg',
        !isMobile && size === 'expanded' && 'inset-4 bottom-4 right-4 top-4 h-auto w-auto rounded-xl',
      )}
      style={
        !isMobile && size !== 'minimized'
          ? { boxShadow: '0 8px 28px rgba(0,0,0,.28)' }
          : !isMobile
            ? { boxShadow: '0 1px 6px rgba(0,0,0,.2)' }
            : undefined
      }
    >
      {/* Title bar — brand primary chrome */}
      <div
        className={cn(
          'flex h-10 shrink-0 cursor-default items-center gap-1 bg-primary px-3 text-primary-foreground select-none',
          size === 'minimized' && 'cursor-pointer'
        )}
        onClick={() => {
          if (size === 'minimized') setSize('normal');
        }}
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-wide">
          {titleLabel}
        </span>
        {!isMobile && (
          <>
            <button
              type="button"
              title={size === 'minimized' ? 'Restore' : 'Minimize'}
              className="rounded p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setSize((s) => (s === 'minimized' ? 'normal' : 'minimized'));
              }}
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              title={size === 'expanded' ? 'Exit full screen' : 'Full screen'}
              className="rounded p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setSize((s) => (s === 'expanded' ? 'normal' : 'expanded'));
              }}
            >
              {size === 'expanded'
                ? <Minimize2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                : <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </button>
          </>
        )}
        <button
          type="button"
          title="Save & close"
          className="rounded p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
          onClick={(e) => {
            e.stopPropagation();
            void saveDraftAndClose();
          }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {size !== 'minimized' && (
        <>
          <div
            className="flex min-h-0 flex-1 flex-col"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
          >
            {/* From */}
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5">
              <span className="w-10 shrink-0 text-[13px] text-muted-foreground">From</span>
              <Select value={mailboxId} onValueChange={setMailboxId}>
                <SelectTrigger className="h-8 flex-1 border-0 px-1 text-[13px] shadow-none focus:ring-0">
                  <SelectValue placeholder="Select a mailbox" />
                </SelectTrigger>
                <SelectContent className="z-[90]">
                  {writable.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color || '#6366f1' }} />
                        {m.displayName} &lt;{m.email}&gt;
                      </span>
                    </SelectItem>
                  ))}
                  {writable.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No sendable mailboxes</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Recipients — Gmail-style: To + Cc/Bcc on the same row */}
            <div
              className="flex items-start gap-2 border-b border-border/70 px-3 py-1.5"
              onFocus={() => setToFocused(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setToFocused(false);
              }}
            >
              {(showRecipientDetails || toFocused) && (
                <span className="mt-1.5 w-10 shrink-0 text-[13px] text-muted-foreground">To</span>
              )}
              <div className="min-w-0 flex-1">
                <EmailChipsInput
                  value={to}
                  onChange={setTo}
                  placeholder="Recipients"
                  className="border-0 bg-transparent px-0 py-0.5 shadow-none"
                />
              </div>
              <div className="mt-1.5 flex shrink-0 gap-2.5 text-[13px] text-muted-foreground">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)} className="hover:text-foreground">
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button type="button" onClick={() => setShowBcc(true)} className="hover:text-foreground">
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {showCc && (
              <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5">
                <span className="w-10 shrink-0 text-[13px] text-muted-foreground">Cc</span>
                <div className="min-w-0 flex-1">
                  <EmailChipsInput value={cc} onChange={setCc} className="border-0 bg-transparent px-0 py-0.5 shadow-none" />
                </div>
              </div>
            )}
            {showBcc && (
              <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5">
                <span className="w-10 shrink-0 text-[13px] text-muted-foreground">Bcc</span>
                <div className="min-w-0 flex-1">
                  <EmailChipsInput value={bcc} onChange={setBcc} className="border-0 bg-transparent px-0 py-0.5 shadow-none" />
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center border-b border-border/70 px-3 py-1">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="h-9 flex-1 border-0 px-0 text-[13px] shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>

            {/* Body */}
            <div
              className={cn(
                'min-h-0 flex-1 overflow-auto',
                dragOver && 'bg-primary/5 ring-2 ring-inset ring-primary/40'
              )}
            >
              <RichTextEditor
                editorRef={editorRef}
                minHeight={size === 'expanded' || isMobile ? '280px' : '160px'}
                maxHeight={size === 'expanded' || isMobile ? undefined : '280px'}
                placeholder="Compose email"
                className="!rounded-none !border-0"
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t px-3 py-2">
                {attachments.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[160px] truncate">{a.filename}</span>
                    <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                    <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showSchedule && (
              <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-sm">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Send at</span>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="h-8 w-auto min-w-0 flex-1 text-xs sm:flex-none"
                />
                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => { setScheduledAt(''); setShowSchedule(false); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer — Gmail: Send left, tools, trash far right */}
          <div className="flex flex-wrap items-center gap-1 border-t px-2 py-2">
            <Button
              onClick={() => void handleSend()}
              disabled={send.isPending}
              className="h-9 gap-1.5 rounded-full px-5 font-medium shadow-sm"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {scheduledAt ? 'Schedule' : 'Send'}
            </Button>

            <input ref={fileRef} type="file" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Attach files" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <TemplatePicker compact onSelect={insertTemplate} />
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8 text-muted-foreground', showSchedule && 'text-primary')}
              title="Schedule send"
              onClick={() => setShowSchedule((v) => !v)}
            >
              <Clock className="h-4 w-4" />
            </Button>

            <div className="hidden items-center gap-0.5 sm:flex">
              <Flag className={cn('h-3.5 w-3.5 shrink-0', priority === 'HIGH' ? 'text-red-500' : 'text-muted-foreground')} />
              <Select value={priority} onValueChange={(v) => setPriority(v as EmailPriority)}>
                <SelectTrigger className="h-8 w-[100px] border-0 text-xs shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[90]">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">{p[0] + p.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                title="Discard draft"
                onClick={() => void discard()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return createPortal(shell, document.body);
}
