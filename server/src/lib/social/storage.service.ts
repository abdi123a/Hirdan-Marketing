import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import fsSync from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { PATHS } from '../paths.js';

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

export async function uploadSocialMediaFile(file: Express.Multer.File): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  const ext = path.extname(file.originalname);
  const filename = `social-${crypto.randomUUID()}${ext}`;

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
        ContentType: file.mimetype,
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

// ─── Direct browser uploads ───
// Some users' routes to the VPS lose packets badly (2026-10-16: 15-40% loss
// from Djibouti, ~12 KB/s uploads). Cloudflare R2 has an edge next to them, so
// the browser PUTs the file there, then the server copies it onto local disk
// over its own fast link. The file still ends up under /public-uploads, so
// TikTok's verified-domain PULL_FROM_URL and local-file publishing stay as is.

export const MAX_SOCIAL_UPLOAD_BYTES = 500 * 1024 * 1024;
const DIRECT_UPLOAD_KEY = /^incoming\/([0-9a-f-]{36})(\.[a-z0-9]{1,8})?$/;

/** On when DIRECT_UPLOAD_BUCKET and the STORAGE_* R2 credentials are set (local storage only). */
export function directUploadEnabled(): boolean {
  return (process.env.STORAGE_PROVIDER || 'local') === 'local'
    && Boolean(process.env.DIRECT_UPLOAD_BUCKET && process.env.STORAGE_ENDPOINT
      && process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY);
}

export async function createDirectUpload(filename: string, size: number): Promise<{ uploadUrl: string; key: string }> {
  const ext = path.extname(filename).toLowerCase();
  const key = `incoming/${crypto.randomUUID()}${/^\.[a-z0-9]{1,8}$/.test(ext) ? ext : ''}`;
  // ContentLength is signed, so R2 rejects a body of any other size.
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: process.env.DIRECT_UPLOAD_BUCKET, Key: key, ContentLength: size }),
    { expiresIn: 6 * 60 * 60 },
  );
  return { uploadUrl, key };
}

/** Copies an uploaded object to local social storage and returns its public URL; null for a bad key. */
export async function finishDirectUpload(key: string): Promise<string | null> {
  const match = DIRECT_UPLOAD_KEY.exec(key);
  if (!match) return null;
  const client = getS3Client();
  const bucket = process.env.DIRECT_UPLOAD_BUCKET;
  const filename = `social-${match[1]}${match[2] ?? ''}`;
  // Download into social-temp first: the hourly purge there cleans up after a
  // crash, and /public-uploads never serves a half-written file.
  const tempPath = path.join(PATHS.UPLOADS_ROOT, 'social-temp', filename);
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if ((obj.ContentLength ?? 0) > MAX_SOCIAL_UPLOAD_BYTES) throw new Error('File too large');
    await pipeline(obj.Body as Readable, fsSync.createWriteStream(tempPath));
    await fs.rename(tempPath, path.join(PATHS.UPLOADS_ROOT, 'social', filename));
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  } finally {
    // The bucket is only a drop box; a lifecycle rule catches anything missed here.
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .catch((err: any) => console.warn('[finishDirectUpload] Failed to delete', key, err.message));
  }
  const publicUrl = process.env.STORAGE_PUBLIC_URL || 'http://localhost:3001';
  warnIfLocalStorageUrlInProd(publicUrl);
  return `${publicUrl.replace(/\/$/, '')}/public-uploads/${filename}`;
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
 */
function localPathForMediaUrl(mediaUrl: string): string | null {
  if ((process.env.STORAGE_PROVIDER || 'local') !== 'local') return null;
  if (mediaUrl.includes('/public-uploads/')) {
    const filename = mediaUrl.split('/public-uploads/').pop() as string;
    return resolveWithinBase(path.join(PATHS.UPLOADS_ROOT, 'social'), filename);
  }
  if (mediaUrl.includes('/uploads/')) {
    const subPath = mediaUrl.split('/uploads/').pop() as string;
    return resolveWithinBase(PATHS.UPLOADS_ROOT, subPath);
  }
  return null;
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
  const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
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
