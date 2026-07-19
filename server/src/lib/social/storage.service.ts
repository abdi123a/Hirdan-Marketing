import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
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
    const fileStream = await fs.readFile(file.path);
    const bucket = process.env.STORAGE_BUCKET || '';

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: fileStream,
      ContentType: file.mimetype,
    }));

    try {
      await fs.unlink(file.path); // NOW ASYNC
    } catch (err: any) {
      console.warn('Failed to delete temp file:', err.message);
    }

    const publicUrl = process.env.STORAGE_PUBLIC_URL || '';
    if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/${filename}`;
    return `${process.env.STORAGE_ENDPOINT}/${bucket}/${filename}`;
  }
}

export async function getMediaBuffer(mediaUrl: string): Promise<Buffer> {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  if (provider === 'local') {
    try {
      if (mediaUrl.includes('/public-uploads/')) {
        const parts = mediaUrl.split('/public-uploads/');
        const filename = parts[parts.length - 1];
        const localPath = path.join(PATHS.UPLOADS_ROOT, 'social', filename);
        return await fs.readFile(localPath);
      }
      if (mediaUrl.includes('/uploads/')) {
        const parts = mediaUrl.split('/uploads/');
        const subPath = parts[parts.length - 1];
        const localPath = path.join(PATHS.UPLOADS_ROOT, subPath);
        return await fs.readFile(localPath);
      }
    } catch (err: any) {
      console.warn(`[getMediaBuffer] Failed to read local file for ${mediaUrl}:`, err.message);
    }
  }
  const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}
