import { downloadAndShareFile, getApiBase, getFullUrl } from '../api-client';
import { getAccessToken } from '../secure-storage';

/**
 * Attachment downloads are authenticated (Bearer), so a WebView/Image source
 * cannot load them directly. Fetch to the cache directory with the token and
 * return a local file URI the caller can render.
 */
export async function fetchAttachmentToCache(
  id: string,
  filename: string,
  inline = true
): Promise<string> {
  const FileSystem = await import('expo-file-system/legacy');
  const token = await getAccessToken();
  const url = getFullUrl(`/email/attachments/${id}${inline ? '?inline=1' : ''}`);
  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 180) || 'attachment';
  const dest = `${FileSystem.cacheDirectory}email-${id}-${safeName}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Client-Platform': 'mobile',
    },
  });
  if (result.status >= 400) throw new Error('Failed to load attachment');
  return result.uri;
}

/** Download the attachment and hand it to the OS share sheet ("save to Files"). */
export async function downloadAttachment(
  id: string,
  filename: string,
  mimeType?: string
): Promise<string> {
  return downloadAndShareFile(
    `/email/attachments/${id}`,
    filename,
    mimeType || 'application/octet-stream'
  );
}

export function isPreviewable(mime: string | undefined | null): boolean {
  return !!mime && (/^image\//.test(mime) || mime === 'application/pdf');
}

export function isImage(mime: string | undefined | null): boolean {
  return !!mime && /^image\//.test(mime);
}

/** Absolute URL for a stored upload path such as a mailbox avatar. */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return getFullUrl(path) || getApiBase();
}
