import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import fsSync from 'fs';
import { Readable } from 'stream';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { PATHS } from '../paths.js';
import { detectMediaType, isPrivateAddress, publicUploadFilename, type DetectedMedia } from './media-safety.js';

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.STORAGE_ENDPOINT,
      credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY || '', secretAccessKey: process.env.STORAGE_SECRET_KEY || '' },
    });
  }
  return _s3Client;
}

let _warnedAboutLocalStorageUrl = false;
function warnIfLocalStorageUrlInProd(publicUrl: string) {
  if (_warnedAboutLocalStorageUrl) return;
  if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(publicUrl)) {
    console.warn('[storage.service] WARNING: STORAGE_PUBLIC_URL is not set (or points at localhost) while NODE_ENV=production...');
    _warnedAboutLocalStorageUrl = true;
  }
}

/**
 * Type an uploaded temp file by its magic bytes. Null (and the temp file
 * removed) when it is not an allowed image/video — the caller answers 400.
 */
export async function sniffUploadedMedia(file: Express.Multer.File): Promise<DetectedMedia | null> {
  let detected: DetectedMedia | null = null;
  try {
    const handle = await fs.open(file.path, 'r');
    try {
      const buf = Buffer.alloc(32);
      const { bytesRead } = await handle.read(buf, 0, 32, 0);
      detected = detectMediaType(buf.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    detected = null;
  }
  if (!detected) {
    await fs.unlink(file.path).catch(() => {});
  }
  return detected;
}

/**
 * Store an upload that sniffUploadedMedia() has already typed. The extension and
 * Content-Type come from the detected type, never from the client's filename or
 * declared MIME — an upload named x.html can no longer be served as HTML.
 */
export async function uploadSocialMediaFile(file: Express.Multer.File, detected: DetectedMedia): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  const filename = `social-${crypto.randomUUID()}.${detected.ext}`;

  if (provider === 'local') {
    const destinationPath = path.join(PATHS.UPLOADS_ROOT, 'social', filename);
    await fs.rename(file.path, destinationPath); // NOW ASYNC
    const publicUrl = process.env.STORAGE_PUBLIC_URL || 'http://localhost:3001';
    warnIfLocalStorageUrlInProd(publicUrl);
    return `${publicUrl.replace(/\/$/, '')}/public-uploads/${filename}`;
  } else {
    const client = getS3Client();
    const bucket = process.env.STORAGE_BUCKET || '';

    try {
      // Stream the temp file rather than fs.readFile-ing it into a Buffer: this
      // runs on the request path, so a few concurrent large videos would
      // otherwise each hold their full size in memory at once. ContentLength is
      // required because S3 cannot infer a length from a stream.
      const { size } = await fs.stat(file.path);
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: fsSync.createReadStream(file.path),
        ContentLength: size,
        ContentType: detected.mime,
      }));
    } finally {
      // Always clean up the multer temp file, even if the S3 upload itself
      // failed — otherwise a failed upload orphans it in uploads/social-temp forever.
      try {
        await fs.unlink(file.path);
      } catch (err: any) {
        console.warn('Failed to delete temp file:', err.message);
      }
    }

    const publicUrl = process.env.STORAGE_PUBLIC_URL || '';
    if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/${filename}`;
    return `${process.env.STORAGE_ENDPOINT}/${bucket}/${filename}`;
  }
}

/**
 * Joins `relativePath` onto `baseDir` and verifies the resolved path is still
 * inside `baseDir`. Rejects `../` traversal (and absolute-path overrides)
 * hidden in a URL segment before it ever reaches fs.readFile.
 */
function resolveWithinBase(baseDir: string, relativePath: string): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, relativePath.replace(/^\/+/, ''));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

/**
 * The on-disk path this media URL refers to, or null when it is not one of ours.
 * Returns null (rather than throwing) so callers can fall back to fetching.
 *
 * Only the social uploads directory is ever read. This used to also map any
 * `/uploads/<path>` URL onto UPLOADS_ROOT, so a post whose mediaUrls pointed at
 * /uploads/employee-docs/… pushed that private file to a social platform.
 */
function localPathForMediaUrl(mediaUrl: string): string | null {
  if ((process.env.STORAGE_PROVIDER || 'local') !== 'local') return null;
  const filename = publicUploadFilename(mediaUrl);
  if (!filename) return null;
  return resolveWithinBase(path.join(PATHS.UPLOADS_ROOT, 'social'), filename);
}

/**
 * DNS lookup that refuses private/loopback/link-local answers. Installed on the
 * fetch agents so the check applies to the address actually connected to —
 * including after redirects and against DNS rebinding.
 */
function guardedLookup(hostname: string, options: any, callback: any): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as unknown as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(new Error(`Refusing to fetch media from a private address (${hostname})`));
    }
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

const guardedHttpsAgent = new https.Agent({ lookup: guardedLookup as any });
const guardedHttpAgent = new http.Agent({ lookup: guardedLookup as any });

function assertFetchableMediaUrl(mediaUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(mediaUrl);
  } catch {
    throw new Error('Invalid media URL');
  }
  // Plain http is tolerated only for our own local-dev public URL; anything
  // else remote must be https.
  const ownBase = (process.env.STORAGE_PUBLIC_URL || '').replace(/\/+$/, '');
  const isOwnHttp = parsed.protocol === 'http:' && ownBase.startsWith('http:') && mediaUrl.startsWith(ownBase + '/');
  if (parsed.protocol !== 'https:' && !isOwnHttp) {
    throw new Error('Media URL must use https');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  // IP literals skip DNS (and so the guarded lookup) — check them directly.
  if (net.isIP(host) && isPrivateAddress(host) && !isOwnHttp) {
    throw new Error('Refusing to fetch media from a private address');
  }
  return parsed;
}

export async function getMediaBuffer(mediaUrl: string): Promise<Buffer> {
  const localPath = localPathForMediaUrl(mediaUrl);
  if (localPath) {
    try {
      return await fs.readFile(localPath);
    } catch (err: any) {
      console.warn(`[getMediaBuffer] Failed to read local file for ${mediaUrl}:`, err.message);
    }
  }
  const parsed = assertFetchableMediaUrl(mediaUrl);
  const ownLocalDev = parsed.protocol === 'http:';
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    maxContentLength: 600 * 1024 * 1024,
    maxRedirects: 3,
    // Our own local-dev URL is localhost by definition; everything else goes
    // through the private-address guard.
    httpAgent: ownLocalDev ? undefined : guardedHttpAgent,
    httpsAgent: guardedHttpsAgent,
    beforeRedirect: (options: any) => {
      if (options.protocol !== 'https:') throw new Error('Refusing non-https media redirect');
    },
  } as any);
  return Buffer.from(response.data);
}

/**
 * Where a piece of media lives, without necessarily loading it.
 *
 * A local file is reported as a path plus size so callers that need arbitrary
 * byte ranges (X's chunked upload) or a plain stream (YouTube's resumable PUT)
 * can avoid holding the whole video in memory. Anything else has to be fetched,
 * so it comes back as a Buffer — there is nothing to save in that case.
 */
export type MediaSource =
  | { kind: 'file'; path: string; size: number }
  | { kind: 'buffer'; buffer: Buffer; size: number };

export async function getMediaSource(mediaUrl: string): Promise<MediaSource> {
  const localPath = localPathForMediaUrl(mediaUrl);
  if (localPath) {
    try {
      const stat = await fsSync.promises.stat(localPath);
      if (stat.isFile()) return { kind: 'file', path: localPath, size: stat.size };
    } catch (err: any) {
      console.warn(`[getMediaSource] Failed to stat local file for ${mediaUrl}:`, err.message);
    }
  }
  const buffer = await getMediaBuffer(mediaUrl);
  return { kind: 'buffer', buffer, size: buffer.length };
}

/**
 * A readable body plus its exact byte length.
 *
 * Open this as late as possible and never reuse the result: a Buffer can be
 * re-sent after a failure, a consumed stream cannot. Callers that retry (the
 * platform router re-invokes publish functions after refreshing a token) must
 * call this inside the retried function, not outside it.
 */
export async function openMediaStream(mediaUrl: string): Promise<{ stream: Readable; size: number }> {
  const source = await getMediaSource(mediaUrl);
  if (source.kind === 'file') {
    return { stream: fsSync.createReadStream(source.path), size: source.size };
  }
  return { stream: Readable.from(source.buffer), size: source.size };
}

/** Read one byte range out of a MediaSource, for chunked platform uploads. */
export async function readMediaRange(source: MediaSource, start: number, end: number): Promise<Buffer> {
  if (source.kind === 'buffer') return source.buffer.subarray(start, end);
  const handle = await fsSync.promises.open(source.path, 'r');
  try {
    const length = end - start;
    const buf = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(buf, 0, length, start);
    return bytesRead === length ? buf : buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
