import { describe, it, expect } from 'vitest';
import {
  detectMediaType,
  isAllowedUploadDeclaration,
  publicUploadFilename,
  ownMediaBases,
  isOwnMediaUrl,
  isPrivateAddress,
} from './media-safety.js';

const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp' + brand, 'ascii')]);

describe('detectMediaType', () => {
  it('recognises allowed images and videos by their bytes', () => {
    expect(detectMediaType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(detectMediaType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    expect(detectMediaType(Buffer.from('GIF89a....', 'ascii'))?.ext).toBe('gif');
    expect(detectMediaType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii'))?.ext).toBe('webp');
    expect(detectMediaType(ftyp('isom'))).toMatchObject({ ext: 'mp4', kind: 'video' });
    expect(detectMediaType(ftyp('qt  '))).toMatchObject({ ext: 'mov', mime: 'video/quicktime' });
  });

  it('rejects script-capable and unknown content', () => {
    expect(detectMediaType(Buffer.from('<html><script>alert(1)</script>', 'ascii'))).toBeNull();
    expect(detectMediaType(Buffer.from('<?xml version="1.0"?><svg', 'ascii'))).toBeNull();
    expect(detectMediaType(Buffer.from('%PDF-1.7', 'ascii'))).toBeNull();
    expect(detectMediaType(ftyp('heic'))).toBeNull();
    expect(detectMediaType(Buffer.alloc(0))).toBeNull();
  });
});

describe('isAllowedUploadDeclaration', () => {
  it('allows image/video names and MIME types', () => {
    expect(isAllowedUploadDeclaration('clip.MOV', 'video/quicktime')).toBe(true);
    expect(isAllowedUploadDeclaration('a.jpeg', 'image/jpeg')).toBe(true);
  });
  it('refuses html, svg and extensionless files', () => {
    expect(isAllowedUploadDeclaration('x.html', 'text/html')).toBe(false);
    expect(isAllowedUploadDeclaration('x.svg', 'image/svg+xml')).toBe(false);
    expect(isAllowedUploadDeclaration('x.png', 'image/svg+xml')).toBe(false);
    expect(isAllowedUploadDeclaration('x', 'image/png')).toBe(false);
    expect(isAllowedUploadDeclaration('x.png', 'text/html')).toBe(false);
  });
});

describe('publicUploadFilename', () => {
  const name = 'social-123e4567-e89b-12d3-a456-426614174000.jpg';
  it('extracts our upload filename from any host', () => {
    expect(publicUploadFilename(`https://api.example.com/public-uploads/${name}`)).toBe(name);
    expect(publicUploadFilename(`/public-uploads/${name}`)).toBe(name);
  });
  it('never yields a path outside the social uploads dir', () => {
    expect(publicUploadFilename('https://x/public-uploads/../employee-docs/secret.pdf')).toBeNull();
    expect(publicUploadFilename('https://x/public-uploads/..%2Femployee-docs%2Fsecret.pdf')).toBeNull();
    expect(publicUploadFilename('https://x/uploads/employee-docs/secret.pdf')).toBeNull();
    expect(publicUploadFilename('https://x/public-uploads/sub/' + name)).toBeNull();
  });
});

describe('isOwnMediaUrl', () => {
  const name = 'social-123e4567-e89b-12d3-a456-426614174000.mp4';
  const bases = ownMediaBases({ STORAGE_PUBLIC_URL: 'https://api.example.com/' });
  it('accepts URLs our uploader produces', () => {
    expect(isOwnMediaUrl(`https://api.example.com/public-uploads/${name}`, bases)).toBe(true);
  });
  it('rejects foreign hosts, internal addresses and odd shapes', () => {
    expect(isOwnMediaUrl('http://169.254.169.254/latest/meta-data/', bases)).toBe(false);
    expect(isOwnMediaUrl(`https://evil.example/public-uploads/${name}`, bases)).toBe(false);
    expect(isOwnMediaUrl(`https://api.example.com/public-uploads/${name}?x=1`, bases)).toBe(false);
    expect(isOwnMediaUrl('https://api.example.com/uploads/employee-docs/a.pdf', bases)).toBe(false);
    expect(isOwnMediaUrl('file:///etc/passwd', bases)).toBe(false);
  });
  it('accepts S3 URLs when S3 storage is configured', () => {
    const s3 = ownMediaBases({ STORAGE_ENDPOINT: 'https://s3.example.com', STORAGE_BUCKET: 'media' });
    expect(isOwnMediaUrl(`https://s3.example.com/media/${name}`, s3)).toBe(true);
    expect(isOwnMediaUrl(`https://s3.example.com/other/${name}`, s3)).toBe(false);
  });
});

describe('isPrivateAddress', () => {
  it('blocks loopback, private, link-local and mapped addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', 'not-an-ip']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '157.240.1.35', '2a03:2880:f10c:83:face:b00c:0:25de']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
