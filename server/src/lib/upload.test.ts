import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { enforceMagicBytes, isAllowedMediaHeader } from './upload.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const atom = (type: string, rest = '') =>
  Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from(type + rest, 'ascii'), Buffer.alloc(16)]);

function runMedia(bytes: Buffer): Promise<{ err: any; exists: boolean }> {
  const file = path.join(tmpDir, `f-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(file, bytes);
  return new Promise((resolve) => {
    enforceMagicBytes({ kind: 'media' })({ file: { path: file } }, {}, (err?: any) =>
      resolve({ err, exists: fs.existsSync(file) }),
    );
  });
}

describe('isAllowedMediaHeader', () => {
  it('accepts GIF87a and GIF89a', () => {
    expect(isAllowedMediaHeader(Buffer.from('GIF87a\x01\x00\x01\x00', 'binary'))).toBe(true);
    expect(isAllowedMediaHeader(Buffer.from('GIF89a\x01\x00\x01\x00', 'binary'))).toBe(true);
  });

  it('accepts QuickTime/MOV — ftyp "qt  " and legacy atom-first files', () => {
    expect(isAllowedMediaHeader(atom('ftyp', 'qt  '))).toBe(true);
    expect(isAllowedMediaHeader(atom('moov'))).toBe(true);
    expect(isAllowedMediaHeader(atom('mdat'))).toBe(true);
    expect(isAllowedMediaHeader(atom('wide'))).toBe(true);
  });

  it('still accepts the existing types', () => {
    expect(isAllowedMediaHeader(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isAllowedMediaHeader(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(isAllowedMediaHeader(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary'))).toBe(true);
    expect(isAllowedMediaHeader(atom('ftyp', 'isom'))).toBe(true);
  });

  it('rejects non-media content', () => {
    expect(isAllowedMediaHeader(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe(false);
    expect(isAllowedMediaHeader(Buffer.from('%PDF-1.7\n'))).toBe(false);
    expect(isAllowedMediaHeader(Buffer.from('GIF90a......'))).toBe(false);
    expect(isAllowedMediaHeader(Buffer.from([0, 0, 0, 0x14]))).toBe(false);
  });
});

describe("enforceMagicBytes({ kind: 'media' })", () => {
  it('lets a GIF and a MOV through', async () => {
    expect((await runMedia(Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00', 'binary'))).err).toBeUndefined();
    expect((await runMedia(atom('ftyp', 'qt  '))).err).toBeUndefined();
    expect((await runMedia(atom('moov'))).err).toBeUndefined();
  });

  it('rejects and deletes a disguised file', async () => {
    const r = await runMedia(Buffer.from('<html><script>alert(1)</script>'));
    expect(r.err?.statusCode).toBe(400);
    expect(r.exists).toBe(false);
  });
});
