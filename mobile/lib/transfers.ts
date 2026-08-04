import type { TransferSummary } from '@hirdan/shared';

/** Mirror of server caps in transfer.routes.ts. */
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
export const MAX_FILES = 300;

export const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.sh',
  '.bash',
  '.bat',
  '.cmd',
  '.ps1',
  '.php',
  '.php3',
  '.php4',
  '.php5',
  '.phtml',
  '.py',
  '.rb',
  '.pl',
  '.cgi',
  '.asp',
  '.aspx',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.jsx',
  '.tsx',
  '.msi',
  '.dll',
  '.so',
  '.dylib',
  '.jar',
  '.html',
  '.htm',
  '.xhtml',
  '.svg',
]);

export type TransferStatus = 'active' | 'expired' | 'revoked';
export type ExpiryUnit = 'minutes' | 'hours' | 'days';

export type PickedTransferFile = {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
};

export function getShortShareUrl(shareId: string): string {
  if (!shareId) return '';
  const custom = process.env.EXPO_PUBLIC_SHORT_LINK_DOMAIN;
  const base = (custom || 'https://hirdan.cc').replace(/\/$/, '');
  return `${base}/f/${shareId}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return `.${parts.pop()!.toLowerCase()}`;
}

export function isBlockedFile(fileName: string): boolean {
  return BLOCKED_EXTENSIONS.has(fileExtension(fileName));
}

export type PreviewKind = 'image' | 'video' | 'pdf';

/**
 * Types the server streams inline for `?preview=true`. Must stay in sync with
 * INLINE_PREVIEW_TYPES in server/src/routes/transfer.routes.ts — anything missing there
 * comes back as an attachment, which no viewer can render.
 */
const PREVIEWABLE: Record<string, { kind: PreviewKind; mimeType: string }> = {
  '.jpg': { kind: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { kind: 'image', mimeType: 'image/jpeg' },
  '.png': { kind: 'image', mimeType: 'image/png' },
  '.gif': { kind: 'image', mimeType: 'image/gif' },
  '.webp': { kind: 'image', mimeType: 'image/webp' },
  '.mp4': { kind: 'video', mimeType: 'video/mp4' },
  '.m4v': { kind: 'video', mimeType: 'video/x-m4v' },
  '.mov': { kind: 'video', mimeType: 'video/quicktime' },
  '.webm': { kind: 'video', mimeType: 'video/webm' },
  '.pdf': { kind: 'pdf', mimeType: 'application/pdf' },
};

export function previewKindOf(fileName: string): PreviewKind | null {
  return PREVIEWABLE[fileExtension(fileName)]?.kind ?? null;
}

export function mimeTypeOf(fileName: string): string {
  return PREVIEWABLE[fileExtension(fileName)]?.mimeType ?? 'application/octet-stream';
}

export function statusOf(t: Pick<TransferSummary, 'isDeleted' | 'isExpired'>): TransferStatus {
  if (t.isDeleted) return 'revoked';
  if (t.isExpired) return 'expired';
  return 'active';
}

export function statusTone(
  status: TransferStatus
): 'success' | 'warning' | 'destructive' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'expired') return 'warning';
  return 'destructive';
}

export function statusLabel(status: TransferStatus): string {
  if (status === 'active') return 'Active';
  if (status === 'expired') return 'Expired';
  return 'Revoked';
}

export function fileIconName(
  fileName: string
):
  | 'document-text-outline'
  | 'grid-outline'
  | 'archive-outline'
  | 'image-outline'
  | 'videocam-outline'
  | 'musical-notes-outline'
  | 'document-outline' {
  const ext = fileExtension(fileName);
  if (ext === '.pdf') return 'document-text-outline';
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return 'grid-outline';
  if (['.zip', '.rar', '.7z'].includes(ext)) return 'archive-outline';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return 'image-outline';
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) return 'videocam-outline';
  if (['.mp3', '.wav', '.ogg', '.aac'].includes(ext)) return 'musical-notes-outline';
  return 'document-outline';
}

export function normalizeTransfer(raw: Record<string, any>): TransferSummary {
  return {
    id: raw.id,
    shareId: raw.shareId,
    fileName: raw.fileName || raw.filename || 'Untitled',
    fileSize: Number(raw.fileSize ?? raw.size ?? 0),
    client: raw.client ?? null,
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt,
    downloadCount: Number(raw.downloadCount ?? 0),
    viewCount: Number(raw.viewCount ?? 0),
    isExpired: Boolean(raw.isExpired),
    isDeleted: Boolean(raw.isDeleted),
    emailSentTo: raw.emailSentTo ?? null,
    emailSentAt: raw.emailSentAt ?? null,
    message: raw.message ?? null,
  };
}
