// Pure helpers that decide which social media files and URLs the publishing
// engine will accept. Kept free of fs/network/Prisma so they can be unit-tested,
// same split as permalink.ts (pure) vs permalink.service.ts.
//
// Two problems these close:
//  - Uploads kept the client's original extension and were served from the API
//    origin, so an uploaded .html/.svg/.js became stored XSS there. Uploads are
//    now typed by their magic bytes and saved with an extension derived from
//    that, never from the client's filename.
//  - Posts carried arbitrary mediaUrls that the server fetched (SSRF: cloud
//    metadata, internal services) or read from disk (any file under /uploads,
//    e.g. employee documents) and then pushed to a social platform. Only media
//    this app produced is accepted now, and any remaining remote fetch refuses
//    private/loopback/link-local destinations.

import net from 'node:net';

export interface DetectedMedia {
  ext: string;
  mime: string;
  kind: 'image' | 'video';
}

/**
 * ISO-BMFF brands that are still images (HEIF/AVIF), not video. They share the
 * `ftyp` box with MP4/MOV, and no social platform we publish to accepts them.
 */
const IMAGE_FTYP_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'avif', 'avis']);

/** Identify an allowed image/video type from the first bytes of a file. */
export function detectMediaType(header: Buffer): DetectedMedia | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg', kind: 'image' };
  }
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png', kind: 'image' };
  }
  if (header.length >= 6) {
    const sig = header.subarray(0, 6).toString('ascii');
    if (sig === 'GIF87a' || sig === 'GIF89a') return { ext: 'gif', mime: 'image/gif', kind: 'image' };
  }
  if (header.length >= 12 && header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp', kind: 'image' };
  }
  if (header.length >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = header.subarray(8, 12).toString('ascii');
    if (IMAGE_FTYP_BRANDS.has(brand.trim().toLowerCase())) return null;
    if (brand === 'qt  ') return { ext: 'mov', mime: 'video/quicktime', kind: 'video' };
    return { ext: 'mp4', mime: 'video/mp4', kind: 'video' };
  }
  return null;
}

/** Extensions the upload filter lets through before the magic-byte check. */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.m4v', '.mov']);

/** Cheap pre-check on the client-declared name/MIME; bytes are checked after. */
export function isAllowedUploadDeclaration(originalName: string, mimetype: string): boolean {
  const dot = originalName.lastIndexOf('.');
  const ext = dot >= 0 ? originalName.slice(dot).toLowerCase() : '';
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return false;
  const mime = (mimetype || '').toLowerCase();
  // SVG is image/* but is a script-capable document — never accept it.
  if (mime === 'image/svg+xml') return false;
  return mime.startsWith('image/') || mime.startsWith('video/') || mime === 'application/octet-stream';
}

/**
 * Filenames uploadSocialMediaFile() has ever produced: `social-<uuid>.<ext>`.
 * Older uploads kept the client's extension, so any short alphanumeric one is
 * recognised here — what matters is that it can't contain a path.
 */
const SOCIAL_UPLOAD_FILENAME = /^social-[A-Za-z0-9-]{8,64}\.[A-Za-z0-9]{1,5}$/;

export function isSocialUploadFilename(name: string): boolean {
  return SOCIAL_UPLOAD_FILENAME.test(name);
}

/**
 * The upload filename a `/public-uploads/<file>` URL points at, whatever host
 * it names (STORAGE_PUBLIC_URL may have changed since it was stored). Null for
 * anything else — only the social uploads directory is ever read from disk.
 */
export function publicUploadFilename(mediaUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(mediaUrl, 'http://placeholder.invalid').pathname;
  } catch {
    return null;
  }
  const m = /^\/public-uploads\/([^/]+)$/.exec(pathname);
  if (!m) return null;
  let name: string;
  try {
    name = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return isSocialUploadFilename(name) ? name : null;
}

/**
 * URL prefixes under which this app publishes its own social uploads, derived
 * from the same env vars uploadSocialMediaFile() uses.
 */
export function ownMediaBases(env: Record<string, string | undefined>): string[] {
  const bases: string[] = [];
  const publicUrl = (env.STORAGE_PUBLIC_URL || '').replace(/\/+$/, '');
  bases.push(`${publicUrl || 'http://localhost:3001'}/public-uploads/`);
  if (publicUrl) bases.push(`${publicUrl}/`);
  if (env.STORAGE_ENDPOINT && env.STORAGE_BUCKET) {
    bases.push(`${env.STORAGE_ENDPOINT.replace(/\/+$/, '')}/${env.STORAGE_BUCKET}/`);
  }
  return bases;
}

/** True when `mediaUrl` is exactly `<one of our bases><social upload filename>`. */
export function isOwnMediaUrl(mediaUrl: string, bases: string[]): boolean {
  if (typeof mediaUrl !== 'string' || mediaUrl.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
  const normalized = parsed.toString();
  return bases.some((rawBase) => {
    let base: string;
    try {
      base = new URL(rawBase).toString();
    } catch {
      return false;
    }
    if (!normalized.startsWith(base)) return false;
    const rest = normalized.slice(base.length);
    return isSocialUploadFilename(rest);
  });
}

// ─── Destination address checks (SSRF) ──────────────────────────────────────

const blockList = new net.BlockList();
// IPv4: "this network", RFC1918, CGNAT, loopback, link-local (cloud metadata),
// IETF protocol assignments, TEST-NETs, benchmarking, multicast, reserved.
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blockList.addSubnet(addr, prefix, 'ipv4');
}
// IPv6: unspecified, loopback, NAT64, discard, ULA, link-local, multicast, doc.
// (IPv4-mapped addresses are unwrapped in isPrivateAddress: a ::ffff:0:0/96
// entry here would make BlockList match every plain IPv4 address too.)
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['fc00::', 7],
  ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32],
] as const) {
  blockList.addSubnet(addr, prefix, 'ipv6');
}

/** True for any address a server-side fetch must never reach. */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true; // not an IP at all — refuse rather than guess
  if (family === 4) return blockList.check(address, 'ipv4');
  const lower = address.toLowerCase();
  // IPv4-mapped / -compatible IPv6 (::ffff:169.254.169.254) — judge the IPv4.
  const mapped = /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (mapped) return isPrivateAddress(mapped[1]);
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return blockList.check(lower, 'ipv6');
}
