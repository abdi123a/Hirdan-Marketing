// ─────────────────────────────────────────────────────────────────────────────
// Encryption at rest for the third-party credentials held in AgencySettings.
//
// These columns (AI provider keys, the Resend key and webhook secret, the
// reCAPTCHA secret, the Google Drive OAuth material, the OneSignal key) used to
// sit in the database as plaintext, which meant any database dump — including
// the .sql files scripts/backup.cjs writes to disk and uploads to Google Drive —
// was a complete, ready-to-use credential set.
//
// They are now stored with the same AES-256-GCM primitive already used for
// social OAuth tokens (see social/token-crypto.service.ts). Encryption and
// decryption are applied transparently by the Prisma extension in lib/prisma.ts,
// so ordinary `prisma.agencySettings.findFirst()` / `.update()` calls keep
// working unchanged and no call site needs to know about any of this.
//
// Ciphertext is tagged with a version prefix so that:
//   - decryptField() can pass through values that are still plaintext, letting
//     the app run correctly before/while the backfill script is applied, and
//   - encryptField() is idempotent, so re-running the backfill (or saving a
//     settings form that echoed an already-encrypted value back) cannot
//     double-encrypt a secret.
// ─────────────────────────────────────────────────────────────────────────────

import { encryptToken, decryptToken } from './social/token-crypto.service.js';

/** Marker identifying a value produced by encryptField(). */
const PREFIX = 'enc:v1:';

/**
 * Columns on AgencySettings that hold third-party credentials.
 *
 * Keep this list in sync with the schema. A field added here starts being
 * encrypted on the next write; existing rows stay readable via the plaintext
 * passthrough in decryptField() until the backfill script runs.
 */
export const SECRET_FIELDS = [
  'openAiApiKey',
  'claudeApiKey',
  'geminiApiKey',
  'resendApiKey',
  'resendWebhookSecret',
  'recaptchaSecretKey',
  'googleDriveServiceAccountJson',
  'googleDriveClientSecret',
  'googleDriveRefreshToken',
  'oneSignalApiKey',
] as const;

export type SecretField = (typeof SECRET_FIELDS)[number];

const SECRET_FIELD_SET: ReadonlySet<string> = new Set(SECRET_FIELDS);

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypt a single secret value. Already-encrypted and empty values pass through. */
export function encryptField(value: unknown): unknown {
  if (typeof value !== 'string' || value === '') return value;
  if (isEncrypted(value)) return value; // idempotent
  return PREFIX + encryptToken(value);
}

/**
 * Decrypt a single secret value.
 *
 * Values without the prefix are assumed to be pre-migration plaintext and are
 * returned as-is. A value that carries the prefix but fails to decrypt is a real
 * problem — usually TOKEN_ENCRYPTION_KEY was rotated or the row was copied from
 * another environment — so it is logged and surfaced as null rather than
 * throwing, which would take down every settings read (including the ones the
 * login page depends on).
 */
export function decryptField(value: unknown): unknown {
  if (typeof value !== 'string' || value === '') return value;
  if (!isEncrypted(value)) return value; // legacy plaintext
  try {
    return decryptToken(value.slice(PREFIX.length));
  } catch (err) {
    console.error(
      '[settings-secrets] Failed to decrypt a stored credential. This usually means ' +
        'TOKEN_ENCRYPTION_KEY changed or the row came from another environment. ' +
        'Re-enter the affected key in Settings.',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** Encrypt every secret field present on a Prisma `data` payload (mutates a copy). */
export function encryptSecrets<T extends Record<string, unknown>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  let out: T | null = null;
  for (const key of Object.keys(data)) {
    if (!SECRET_FIELD_SET.has(key)) continue;
    const encrypted = encryptField(data[key]);
    if (encrypted !== data[key]) {
      out = out ?? { ...data };
      (out as Record<string, unknown>)[key] = encrypted;
    }
  }
  return out ?? data;
}

/** Decrypt every secret field present on a row returned by Prisma (mutates a copy). */
export function decryptSecrets<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const record = row as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  for (const key of Object.keys(record)) {
    if (!SECRET_FIELD_SET.has(key)) continue;
    const decrypted = decryptField(record[key]);
    if (decrypted !== record[key]) {
      out = out ?? { ...record };
      out[key] = decrypted;
    }
  }
  return (out ?? record) as T;
}

// ─── API projection helpers ──────────────────────────────────────────────────
// Decrypted secrets must never be sent back to the browser. Admins receive a
// masked placeholder (enough to recognise which key is configured); everyone
// else receives nothing. The PUT handler recognises the placeholder and keeps
// the stored value, so round-tripping a settings form can't clobber a key.

/** Bullet sequence that marks a masked placeholder. */
const MASK = '••••••••';

/** Well-known key prefixes that the UI uses to validate a key's shape. */
const KNOWN_PREFIXES = ['whsec_', 're_', 'sk-ant-', 'sk-'];

export function maskSecret(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const prefix = KNOWN_PREFIXES.find((p) => value.startsWith(p)) ?? '';
  const tail = value.length >= 12 ? value.slice(-4) : '';
  return prefix + MASK + tail;
}

/** True when a submitted value is (or contains) a masked placeholder. */
export function isMaskedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.includes(MASK);
}

/**
 * Project a settings row for an API response.
 *  - 'admin': secrets replaced by maskSecret(), plus has<Field> booleans.
 *  - 'staff': secret fields removed entirely.
 */
export function redactSettingsSecrets<T extends Record<string, unknown>>(
  row: T,
  mode: 'admin' | 'staff'
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const configured: Record<string, boolean> = {};
  for (const key of SECRET_FIELDS) {
    const has = typeof row[key] === 'string' && row[key] !== '';
    if (mode === 'admin') {
      out[key] = has ? maskSecret(row[key]) : null;
      configured[key] = has;
      out[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`] = has;
    } else {
      delete out[key];
    }
  }
  if (mode === 'admin') out.secretsConfigured = configured;
  return out;
}
