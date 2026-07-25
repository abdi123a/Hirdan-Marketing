// ─────────────────────────────────────────────────────────────────────────────
// One-time backfill: encrypt the plaintext credentials already stored in
// agency_settings.
//
// The application encrypts these columns transparently from now on (see
// src/lib/settings-secrets.ts + the Prisma extension in src/lib/prisma.ts), and
// reads tolerate plaintext, so the app keeps working before this runs. This
// script converts the rows that predate the change.
//
// Deliberately plain CommonJS with no build step and no devDependencies, so it
// can be run straight from a production checkout where only `npm install
// --production` has happened:
//
//     node scripts/encrypt-settings-secrets.cjs           # apply
//     node scripts/encrypt-settings-secrets.cjs --dry-run # report only
//
// Safe to re-run: values already carrying the `enc:v1:` prefix are skipped, so
// nothing is ever double-encrypted.
//
// NOTE: the ciphertext format here must stay identical to
// src/lib/social/token-crypto.service.ts (`iv:tag:ciphertext`, all hex) and the
// prefix must match PREFIX in src/lib/settings-secrets.ts.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

// Must match SECRET_FIELDS in src/lib/settings-secrets.ts
const SECRET_FIELDS = [
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
];

const dryRun = process.argv.includes('--dry-run');

// ── resolve TOKEN_ENCRYPTION_KEY (env wins, else .env) ───────────────────────
function loadKey() {
  let keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        if (line.startsWith('TOKEN_ENCRYPTION_KEY=')) {
          keyHex = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
          break;
        }
      }
    }
  }
  if (!keyHex) {
    console.error('❌ TOKEN_ENCRYPTION_KEY is not set (checked env and server/.env).');
    process.exit(1);
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    console.error('❌ TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
    process.exit(1);
  }
  return key;
}

const KEY = loadKey();

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(stored) {
  const [ivHex, tagHex, encHex] = stored.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

async function main() {
  console.log(dryRun ? '🔍 Dry run — no changes will be written.\n' : '🔐 Encrypting agency_settings credentials...\n');

  // Raw client on purpose: the app's extended client would decrypt on read and
  // re-encrypt on write, hiding exactly what this script needs to see.
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.agencySettings.findMany();
    if (rows.length === 0) {
      console.log('No agency_settings rows found — nothing to do.');
      return;
    }

    let encrypted = 0;
    let alreadyDone = 0;
    let empty = 0;

    for (const row of rows) {
      const patch = {};

      for (const field of SECRET_FIELDS) {
        const value = row[field];
        if (typeof value !== 'string' || value === '') { empty++; continue; }
        if (value.startsWith(PREFIX)) { alreadyDone++; continue; }

        const ciphertext = encrypt(value);
        // Verify the round trip before trusting it to the database.
        if (decrypt(ciphertext) !== value) {
          throw new Error(`Round-trip check failed for ${field} — aborting without writing.`);
        }
        patch[field] = ciphertext;
        encrypted++;
        console.log(`  • ${field}: will encrypt (${value.length} chars)`);
      }

      if (Object.keys(patch).length > 0 && !dryRun) {
        await prisma.agencySettings.update({ where: { id: row.id }, data: patch });
      }
    }

    console.log(
      `\n${dryRun ? 'Would encrypt' : 'Encrypted'}: ${encrypted}   ` +
      `already encrypted: ${alreadyDone}   empty/unset: ${empty}`
    );
    if (dryRun && encrypted > 0) console.log('Re-run without --dry-run to apply.');
    else if (!dryRun && encrypted > 0) console.log('✅ Done.');
    else if (encrypted === 0) console.log('✅ Nothing to do — all credentials are already encrypted.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err.message);
  process.exit(1);
});
