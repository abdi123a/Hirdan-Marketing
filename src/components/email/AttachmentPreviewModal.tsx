import { useEffect, useState } from 'react';
import { Download, Loader2, FileWarning, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchAttachmentBlobUrl, downloadAttachment } from '@/lib/email/attachmentFetch';
import { formatBytes } from '@/lib/email/format';
import type { Attachment } from '@/lib/email/types';

export function AttachmentPreviewModal({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const isImage = attachment && /^image\//.test(attachment.mimeType);
  const isPdf = attachment && attachment.mimeType === 'application/pdf';

  useEffect(() => {
    if (!attachment) return;
    let revoked: string | null = null;
    setLoading(true);
    setError(false);
    setUrl(null);
    fetchAttachmentBlobUrl(attachment.id, true)
      .then((u) => { revoked = u; setUrl(u); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [attachment]);

  return (
    <Dialog open={!!attachment} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachment?.filename}</p>
            <p className="text-xs text-muted-foreground">{attachment ? formatBytes(attachment.size) : ''}</p>
          </div>
          {attachment && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadAttachment(attachment.id, attachment.filename)}>
              <Download className="h-4 w-4" /> Download
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex min-h-[300px] items-center justify-center bg-muted/30 p-2" style={{ maxHeight: '75vh' }}>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileWarning className="h-8 w-8" />
              <p className="text-sm">Couldn't load a preview. Try downloading instead.</p>
            </div>
          ) : url && isImage ? (
            <img src={url} alt={attachment?.filename} className="max-h-[72vh] max-w-full object-contain" />
          ) : url && isPdf ? (
            <iframe src={url} title={attachment?.filename} className="h-[72vh] w-full rounded border-0" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileWarning className="h-8 w-8" />
              <p className="text-sm">No inline preview for this file type.</p>
              {attachment && (
                <Button size="sm" className="gap-1.5" onClick={() => downloadAttachment(attachment.id, attachment.filename)}>
                  <Download className="h-4 w-4" /> Download
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
