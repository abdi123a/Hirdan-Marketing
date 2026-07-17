import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PATHS } from '../paths.js';

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
        secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
      },
    });
  }
  return _s3Client;
}

export async function uploadSocialMediaFile(file: Express.Multer.File): Promise<string> {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  const ext = path.extname(file.originalname);
  const filename = `social-${crypto.randomUUID()}${ext}`;

  if (provider === 'local') {
    const destinationPath = path.join(PATHS.UPLOADS_ROOT, 'social', filename);
    
    // Move file from temp upload location to final social directory
    fs.renameSync(file.path, destinationPath);
    
    const publicUrl = process.env.STORAGE_PUBLIC_URL || 'http://localhost:3001';
    return `${publicUrl.replace(/\/$/, '')}/public-uploads/${filename}`;
  } else {
    const client = getS3Client();
    const fileStream = fs.createReadStream(file.path);
    const bucket = process.env.STORAGE_BUCKET || '';

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: fileStream,
      ContentType: file.mimetype,
    }));

    // Cleanup local temp file
    try {
      fs.unlinkSync(file.path);
    } catch (err: any) {
      console.warn('Failed to delete temp file:', err.message);
    }

    const publicUrl = process.env.STORAGE_PUBLIC_URL || '';
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${filename}`;
    }
    
    return `${process.env.STORAGE_ENDPOINT}/${bucket}/${filename}`;
  }
}
