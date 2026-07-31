import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Paperclip, X, Loader2, Clock, Flag, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

export function ComposeModal({ open, onClose, mailboxes, initial, onSent }: Props) {
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
    // Seed editor body after mount.
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = initial?.html || '';
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  // ── Autosave draft every few seconds when there is content ─────
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && saveDraftAndClose()}>
      <DialogContent
        /* Full-screen on phones — a compose window squeezed into a centred card
           leaves almost no room for the body once the toolbars are stacked. */
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[88vh] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:rounded-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-4 py-2.5 pr-12">
          <h2 className="text-sm font-semibold">New message</h2>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          {/* From */}
          <div className="flex items-center gap-2 border-b px-4 py-1.5">
            <span className="w-12 text-xs text-muted-foreground">From</span>
            <Select value={mailboxId} onValueChange={setMailboxId}>
              <SelectTrigger className="h-8 flex-1 border-0 text-sm shadow-none focus:ring-0">
                <SelectValue placeholder="Select a mailbox" />
              </SelectTrigger>
              <SelectContent>
                {writable.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color || '#6366f1' }} />
                      {m.displayName} &lt;{m.email}&gt;
                    </span>
                  </SelectItem>
                ))}
                {writable.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No sendable mailboxes</div>}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div className="flex items-center gap-2 border-b px-4 py-1.5">
            <span className="w-12 text-xs text-muted-foreground">To</span>
            <div className="flex-1"><EmailChipsInput value={to} onChange={setTo} placeholder="Recipients" className="border-0 px-0" /></div>
            <div className="flex shrink-0 gap-2 text-xs text-muted-foreground">
              {!showCc && <button onClick={() => setShowCc(true)} className="hover:text-foreground">Cc</button>}
              {!showBcc && <button onClick={() => setShowBcc(true)} className="hover:text-foreground">Bcc</button>}
            </div>
          </div>

          {showCc && (
            <div className="flex items-center gap-2 border-b px-4 py-1.5">
              <span className="w-12 text-xs text-muted-foreground">Cc</span>
              <div className="flex-1"><EmailChipsInput value={cc} onChange={setCc} className="border-0 px-0" /></div>
            </div>
          )}
          {showBcc && (
            <div className="flex items-center gap-2 border-b px-4 py-1.5">
              <span className="w-12 text-xs text-muted-foreground">Bcc</span>
              <div className="flex-1"><EmailChipsInput value={bcc} onChange={setBcc} className="border-0 px-0" /></div>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2 border-b px-4 py-1.5">
            <span className="w-12 text-xs text-muted-foreground">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="h-8 flex-1 border-0 px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Body */}
          <div className={cn('min-h-0 flex-1 overflow-auto', dragOver && 'bg-primary/5 ring-2 ring-inset ring-primary/40')}>
            <RichTextEditor editorRef={editorRef} minHeight="220px" placeholder="Write your message…" />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t px-4 py-2">
              {attachments.map((a, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[160px] truncate">{a.filename}</span>
                  <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                  <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Schedule row */}
          {showSchedule && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Send at</span>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-8 w-auto min-w-0 flex-1 text-xs sm:flex-none"
              />
              {scheduledAt && (
                <button onClick={() => { setScheduledAt(''); setShowSchedule(false); }} className="text-xs text-muted-foreground hover:text-foreground">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — wraps on narrow screens instead of pushing controls off-screen */}
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
          <Button onClick={handleSend} disabled={send.isPending} className="gap-1.5">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {scheduledAt ? 'Schedule' : 'Send'}
          </Button>

          <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Attach" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <TemplatePicker compact onSelect={insertTemplate} />
          <Button
            variant="ghost" size="icon" className={cn('h-8 w-8', showSchedule && 'text-primary')}
            title="Schedule send" onClick={() => setShowSchedule((v) => !v)}
          >
            <Clock className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 sm:ml-1">
            <Flag className={cn('h-4 w-4 shrink-0', priority === 'HIGH' ? 'text-red-500' : 'text-muted-foreground')} />
            <Select value={priority} onValueChange={(v) => setPriority(v as EmailPriority)}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p[0] + p.slice(1).toLowerCase()} priority</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={saveDraftAndClose}>
              <Save className="h-4 w-4" />
              {/* The icon alone carries this once space is tight */}
              <span className="hidden sm:inline">Save draft</span>
              <span className="sr-only sm:hidden">Save draft</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
