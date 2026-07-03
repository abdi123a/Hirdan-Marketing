import multer from 'multer';
import path from 'path';
import { PATHS } from './paths.js';
import crypto from 'crypto';
import fs from 'fs';
import { AppError } from './errors.js';

// ─── Document Uploads (PDF, images, office docs) ───────────────────

const documentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PATHS.DOCUMENTS);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc-${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOC_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, images, Word, Excel.'));
    }
  },
});

// ─── Media / Proof Uploads (images & video) ────────────────────────

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PATHS.MEDIA);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `media-${crypto.randomUUID()}${ext}`);
  },
});

export const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed.'));
    }
  },
});

function readHeader(filePath: string, bytes: number): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

function isPdf(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF';
}
function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}
function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function isWebp(buf: Buffer): boolean {
  return buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
}
function isZip(buf: Buffer): boolean {
  // DOCX/XLSX are ZIP containers; this is the best we can do without deeper parsing.
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}
function isMp4(buf: Buffer): boolean {
  // Common MP4 starts with box size + 'ftyp'
  return buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp';
}

export function enforceMagicBytes(options: {
  kind: 'document' | 'media';
}) {
  return (req: any, _res: any, next: any) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file?.path) return next();

    try {
      const header = readHeader(file.path, 32);

      let ok = false;
      if (options.kind === 'document') {
        ok = isPdf(header) || isPng(header) || isJpeg(header) || isWebp(header) || isZip(header);
      } else {
        ok = isPng(header) || isJpeg(header) || isWebp(header) || isMp4(header);
      }

      if (!ok) {
        try { fs.unlinkSync(file.path); } catch {}
        return next(AppError.badRequest('File content does not match allowed type'));
      }

      return next();
    } catch (err) {
      try { if (file?.path) fs.unlinkSync(file.path); } catch {}
      return next(err);
    }
  };
}
