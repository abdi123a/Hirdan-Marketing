import fs from 'fs/promises';
import path from 'path';
import type { Attachment } from '@prisma/client';
import { prisma } from '../prisma.js';
import { PATHS } from '../paths.js';
import { attachmentAbsolutePath } from './attachments.js';
import { getResendConfig } from './resend-client.js';

/**
 * Inbound attachments are stored as a sentinel storageKey until first accessed
 * (Resend keeps the bytes behind a signed URL). The sentinel encodes the
 * received email id + Resend attachment id: `resend-inbound:<emailId>:<attId>`.
 */
export const INBOUND_PREFIX = 'resend-inbound:';

export function makeInboundKey(receivedEmailId: string, resendAttachmentId: string): string {
  return `${INBOUND_PREFIX}${receivedEmailId}:${resendAttachmentId}`;
}

/**
 * Ensure an attachment's bytes are on disk and return the absolute path.
 * Disk-backed attachments (outbound) are returned directly. Inbound sentinel
 * attachments are lazily downloaded from Resend, cached to disk, and the row's
 * storageKey is rewritten so later downloads skip the fetch.
 */
export async function ensureAttachmentFile(att: Attachment): Promise<string> {
  if (!att.storageKey.startsWith(INBOUND_PREFIX)) {
    return attachmentAbsolutePath(att.storageKey);
  }

  const rest = att.storageKey.slice(INBOUND_PREFIX.length);
  const sep = rest.indexOf(':');
  const receivedEmailId = rest.slice(0, sep);
  const resendAttId = rest.slice(sep + 1);

  const { resend } = await getResendConfig();
  const meta = await resend.emails.receiving.attachments.get({ emailId: receivedEmailId, id: resendAttId });
  if (meta.error || !meta.data?.download_url) {
    throw new Error(meta.error?.message || 'Attachment is no longer available');
  }

  const resp = await fetch(meta.data.download_url);
  if (!resp.ok) throw new Error('Failed to download attachment from Resend');
  const buf = Buffer.from(await resp.arrayBuffer());

  const safeName = (att.filename || 'attachment').replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'attachment';
  const relKey = path.join('email', att.emailId ?? 'inbound', `${att.id}-${safeName}`);
  const abs = path.join(PATHS.UPLOADS_ROOT, relKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);

  await prisma.attachment.update({ where: { id: att.id }, data: { storageKey: relKey, size: buf.length } });
  return abs;
}

/** MIME types safe to render inline in the browser (image/pdf). */
export function isInlinePreviewable(mime: string): boolean {
  return /^image\//.test(mime) || mime === 'application/pdf';
}
