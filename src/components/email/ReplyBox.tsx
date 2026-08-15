import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Paperclip, X, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import RichTextEditor from '@/components/RichTextEditor';
import { TemplatePicker } from './TemplatePicker';
import { useReply } from '@/lib/email/hooks';
import { fileToAttachment, type PreparedAttachment } from '@/lib/email/attachments';
import { applyTemplateVars } from '@/lib/email/templateVars';
import { formatBytes } from '@/lib/email/format';
import type { Mailbox } from '@/lib/email/types';

interface Props {
  conversationId: string;
  mailboxes?: Mailbox[];
  /** The conversation's own mailbox — preselected, but any writable mailbox can override it. */
  defaultMailboxId?: string;
  onSent?: () => void;
}

export function ReplyBox({ conversationId, mailboxes = [], defaultMailboxId, onSent }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [replyAll, setReplyAll] = useState(false);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const reply = useReply(conversationId);

  const writable = useMemo(
    () => mailboxes.filter((m) => m.isActive && (m.accessLevel === 'ADMIN' || m.accessLevel === 'WRITE' || m.accessLevel === 'MANAGE')),
    [mailboxes]
  );
  const [mailboxId, setMailboxId] = useState(defaultMailboxId || '');
  useEffect(() => {
    setMailboxId(defaultMailboxId || '');
  }, [conversationId, defaultMailboxId]);
  const selectedMailbox = writable.find((m) => m.id === mailboxId);
  const signature = selectedMailbox?.signature;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const prepared = await Promise.all([...files].map(fileToAttachment));
    setAttachments((prev) => [...prev, ...prepared]);
  };

  const send = async () => {
    const html = editorRef.current?.innerHTML?.trim();
    if (!html || html === '<br>') return;
    const body = signature ? `${html}<br/><br/>${signature}` : html;
    await reply.mutateAsync({
      html: body,
      mailboxId: mailboxId || undefined,
      replyAll,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    if (editorRef.current) editorRef.current.innerHTML = '';
    setAttachments([]);
    onSent?.();
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {writable.length > 1 && (
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <span className="w-10 shrink-0 text-[13px] text-muted-foreground">From</span>
          <Select value={mailboxId} onValueChange={setMailboxId}>
            <SelectTrigger className="h-8 flex-1 border-0 px-1 text-[13px] shadow-none focus:ring-0">
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
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="border-b px-3 py-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={replyAll} onChange={(e) => setReplyAll(e.target.checked)} className="accent-primary" />
          <Users className="h-3.5 w-3.5" />
          Reply all
        </label>
      </div>

      <RichTextEditor editorRef={editorRef} minHeight="90px" maxHeight="240px" placeholder="Write a reply…" />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {attachments.map((a, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{a.filename}</span>
              <span className="text-muted-foreground">{formatBytes(a.size)}</span>
              <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t px-3 py-2">
        <Button size="sm" className="gap-1.5" onClick={send} disabled={reply.isPending}>
          {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => fileRef.current?.click()} title="Attach">
          <Paperclip className="h-4 w-4" />
        </Button>
        <TemplatePicker
          compact
          onSelect={(t) => {
            if (editorRef.current) {
              const existing = editorRef.current.innerHTML.trim();
              const rendered = applyTemplateVars(t.body);
              editorRef.current.innerHTML = existing && existing !== '<br>' ? `${existing}<br/>${rendered}` : rendered;
            }
          }}
        />
      </div>
    </div>
  );
}
