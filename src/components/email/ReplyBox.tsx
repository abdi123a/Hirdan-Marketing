import { useRef, useState } from 'react';
import { Send, Paperclip, X, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RichTextEditor from '@/components/RichTextEditor';
import { useReply } from '@/lib/email/hooks';
import { fileToAttachment, type PreparedAttachment } from '@/lib/email/attachments';
import { formatBytes } from '@/lib/email/format';

interface Props {
  conversationId: string;
  signature?: string | null;
  onSent?: () => void;
}

export function ReplyBox({ conversationId, signature, onSent }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [replyAll, setReplyAll] = useState(false);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const reply = useReply(conversationId);

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
      replyAll,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    if (editorRef.current) editorRef.current.innerHTML = '';
    setAttachments([]);
    onSent?.();
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
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
      </div>
    </div>
  );
}
