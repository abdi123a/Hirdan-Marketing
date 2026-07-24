import { getFullUrl } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Attachment downloads are authenticated (Bearer), so an <img>/<iframe> src
 * can't load them directly. Fetch the bytes with the token and return an object
 * URL the caller can render or download. Remember to revoke it when done.
 */
export async function fetchAttachmentBlobUrl(id: string, inline = false): Promise<string> {
  const token = useAuthStore.getState().token;
  const res = await fetch(getFullUrl(`/email/attachments/${id}${inline ? '?inline=1' : ''}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load attachment');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadAttachment(id: string, filename: string): Promise<void> {
  const url = await fetchAttachmentBlobUrl(id, false);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function isPreviewable(mime: string | undefined | null): boolean {
  return !!mime && (/^image\//.test(mime) || mime === 'application/pdf');
}
