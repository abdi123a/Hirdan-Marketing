import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Eye, Download, History, Upload, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { emailApi } from '@/lib/email/api';
import { emailKeys } from '@/lib/email/hooks';
import { downloadAttachment, isPreviewable } from '@/lib/email/attachmentFetch';
import { fileToAttachment } from '@/lib/email/attachments';
import { formatBytes, listTime } from '@/lib/email/format';
import { toast } from 'sonner';
import type { Attachment } from '@/lib/email/types';

interface Props {
  attachment: Attachment;
  conversationId: string;
  onPreview: (a: Attachment) => void;
}

export function AttachmentChip({ attachment: a, conversationId, onPreview }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canPreview = isPreviewable(a.mimeType);
  const version = a.version ?? 1;

  const versions = useQuery({
    queryKey: ['email', 'attachment-versions', a.id],
    queryFn: () => emailApi.attachmentVersions(a.id).then((r) => r.versions),
    enabled: historyOpen,
  });

  const replace = async (file: File | undefined) => {
    if (!file) return;
    setReplacing(true);
    try {
      const prepared = await fileToAttachment(file);
      await emailApi.replaceAttachment(a.id, prepared);
      qc.invalidateQueries({ queryKey: emailKeys.conversation(conversationId) });
      toast.success('Attachment replaced (new version saved)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to replace');
    } finally {
      setReplacing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="group flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 transition-colors hover:bg-accent">
      <button
        onClick={() => (canPreview ? onPreview(a) : downloadAttachment(a.id, a.filename))}
        className="flex min-w-0 items-center gap-2 text-left"
        title={canPreview ? 'Preview' : 'Download'}
      >
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <span className="max-w-[150px] truncate text-xs font-medium">{a.filename}</span>
            {version > 1 && <span className="rounded bg-primary/10 px-1 text-[9px] font-semibold text-primary">v{version}</span>}
          </p>
          <p className="text-[10px] text-muted-foreground">{formatBytes(a.size)}</p>
        </div>
      </button>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {canPreview && (
          <button onClick={() => onPreview(a)} title="Preview" className="p-1 text-muted-foreground hover:text-foreground">
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => downloadAttachment(a.id, a.filename)} title="Download" className="p-1 text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
        </button>

        <input ref={fileRef} type="file" hidden onChange={(e) => replace(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} title="Replace (keeps history)" className="p-1 text-muted-foreground hover:text-foreground" disabled={replacing}>
          {replacing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        </button>

        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <button title="Version history" className="p-1 text-muted-foreground hover:text-foreground">
              <History className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">Version history</p>
            {versions.isLoading ? (
              <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1">
                {(versions.data ?? []).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => downloadAttachment(v.id, v.filename)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span className="rounded bg-muted px-1 text-[9px] font-semibold">v{v.version}</span>
                    <span className="flex-1 truncate">{v.filename}</span>
                    {v.isLatest && <span className="text-[9px] text-primary">latest</span>}
                    <span className="text-[10px] text-muted-foreground">{listTime(v.createdAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
