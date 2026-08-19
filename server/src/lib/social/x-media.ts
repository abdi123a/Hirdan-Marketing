// Pure helpers for X's chunked media upload.
//
// Kept free of axios and Prisma so the parts that are easy to get wrong — the
// segment boundaries, the media_category, the id shape — can be unit-tested
// without touching the network. Same split as permalink.ts vs permalink.service.ts.

/** X rejects an APPEND segment over 5MB; stay clear of the boundary. */
export const X_CHUNK_SIZE = 4 * 1024 * 1024;

export type XMediaCategory = 'tweet_video' | 'tweet_gif' | 'tweet_image';

/**
 * `mediaType` in the database is only ever 'image' or 'video', so GIF has to be
 * recovered from the stored filename. uploadSocialMediaFile preserves the
 * original extension, so it is reliably present in the URL.
 */
export function xMediaMime(mediaUrl: string, mediaType: string): string {
  const ext = (mediaUrl.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (mediaType === 'video') return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function xMediaCategory(mime: string): XMediaCategory {
  if (mime.startsWith('video/')) return 'tweet_video';
  if (mime === 'image/gif') return 'tweet_gif';
  return 'tweet_image';
}

/** v2 returns { data: { id } }; tolerate the older media_id_string shape too. */
export function xMediaId(payload: any): string {
  const id = payload?.data?.id ?? payload?.data?.media_id_string ?? payload?.media_id_string;
  if (!id) throw new Error('X media upload did not return a media id');
  return String(id);
}

export interface XChunk {
  index: number;
  start: number;
  end: number;
}

/**
 * Split a payload into APPEND segments. The bug this replaces sent the whole
 * file as a single segment_index 0, which X rejects above 5MB.
 */
export function planXChunks(totalBytes: number, chunkSize: number = X_CHUNK_SIZE): XChunk[] {
  const chunks: XChunk[] = [];
  for (let start = 0, index = 0; start < totalBytes; start += chunkSize, index++) {
    chunks.push({ index, start, end: Math.min(start + chunkSize, totalBytes) });
  }
  return chunks;
}
