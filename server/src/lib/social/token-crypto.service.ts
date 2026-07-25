import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Resolve the key on each call rather than at module load.
 *
 * config/env.ts populates process.env via dotenv at *its* import time, so
 * reading the key while this module is being evaluated made correctness depend
 * on module ordering — and this module is now reachable from lib/prisma.ts,
 * which sits very early in the import graph.
 */
function getKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not defined in environment variables');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(stored: string): string {
  const key = getKey();
  const [ivHex, tagHex, encHex] = stored.split(':');
  if (!ivHex || !tagHex || !encHex) {
    throw new Error('Invalid stored encrypted token format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
