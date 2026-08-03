import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PATHS } from '../paths.js';

export interface IncomingAttachment {
  filename: string;
  /** base64 payload (a `data:` URL prefix is tolerated and stripped). */
  content: string;
  contentType?: string;
}

export interface StoredAttachment {
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string; // path relative to uploads root, e.g. "email/<id>/file.pdf"
  checksum: string;
  buffer: Buffer;
}

/** Per-file cap. Resend allows ~40MB total per message. */
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function decodeBase64(content: string): Buffer {
  const cleaned =
    content.startsWith('data:') && content.includes(',')
      ? content.slice(content.indexOf(',') + 1)
      : content;
  return Buffer.from(cleaned, 'base64');
}

/** Persist base64 attachments to disk and return metadata + buffers. */
export async function storeAttachments(emailId: string, items: IncomingAttachment[]): Promise<StoredAttachment[]> {
  const dir = path.join(PATHS.EMAIL, emailId);
  await fs.mkdir(dir, { recursive: true });

  const stored: StoredAttachment[] = [];
  const usedNames = new Set<string>();

  for (const item of items) {
    const buffer = decodeBase64(item.content);
    if (buffer.length === 0) continue;
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Attachment "${item.filename}" exceeds the 25MB limit`);
    }

    let safeName = (item.filename || 'attachment').replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'attachment';
    // Avoid overwriting same-named files within one email.
    let candidate = safeName;
    let n = 1;
    while (usedNames.has(candidate)) {
      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      candidate = `${base}-${n++}${ext}`;
    }
    safeName = candidate;
    usedNames.add(safeName);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const storageKey = path.join('email', emailId, safeName);
    await fs.writeFile(path.join(PATHS.UPLOADS_ROOT, storageKey), buffer);

    stored.push({
      filename: safeName,
      mimeType: item.contentType || 'application/octet-stream',
      size: buffer.length,
      storageKey,
      checksum,
      buffer,
    });
  }

  return stored;
}

/**
 * Virus-scan hook. Wire a real scanner (e.g. ClamAV / VirusTotal) here; return
 * `false` to reject. Best-effort — currently a permissive stub so the pipeline
 * has a single, obvious integration point.
 */
export async function scanAttachment(_buffer: Buffer, _filename: string): Promise<{ clean: boolean; reason?: string }> {
  // TODO: integrate a real scanner. Kept permissive by default.
  return { clean: true };
}

export function attachmentAbsolutePath(storageKey: string): string {
  // storageKey is relative to the uploads root; guard against traversal.
  const resolved = path.resolve(PATHS.UPLOADS_ROOT, storageKey);
  if (!resolved.startsWith(path.resolve(PATHS.UPLOADS_ROOT))) {
    throw new Error('Invalid attachment path');
  }
  return resolved;
}
