import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const serverEnvPath = path.resolve(currentDir, '../../.env');

// Force project-local .env values to win over any globally exported shell vars.
// This avoids accidental runtime failures when a user has DATABASE_URL set in their profile.
dotenv.config({ path: serverEnvPath, override: true });

function isStrongSecret(value: string): boolean {
  // Minimum bar: 32+ chars, not a common placeholder.
  if (value.length < 32) return false;
  const lowered = value.toLowerCase();
  if (lowered.includes('changeme') || lowered.includes('change-me') || lowered.includes('default')) return false;
  // Reject secrets that look like short/simple patterns (very rough).
  const uniqueChars = new Set(value).size;
  return uniqueChars >= 12;
}

function isNonRootMysqlUrl(databaseUrl: string, envMode?: string): boolean {
  if (envMode === 'development') return true;
  try {
    const url = new URL(databaseUrl);
    if (!['mysql:', 'mysql2:'].includes(url.protocol)) return true; // only enforce for mysql URLs
    return url.username !== 'root';
  } catch {
    // If parsing fails, keep existing behavior (schema requires non-empty).
    return true;
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().refine(isStrongSecret, 'JWT_SECRET must be at least 32 characters and not a weak/default value'),
  JWT_REFRESH_SECRET: z.string().refine(isStrongSecret, 'JWT_REFRESH_SECRET must be at least 32 characters and not a weak/default value'),
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().optional(),
  LANDING_URL: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  SHORT_LINK_DOMAIN: z.string().optional(),
  // ─── Email (Resend) — optional; can be set via admin settings panel ───
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_INBOUND_DOMAIN: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  APP_URL: z.string().url().optional(),

  // ─── Social Media Security & Storage ───
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  OAUTH_STATE_SECRET: z.string().optional(),
  STORAGE_PROVIDER: z.string().default('local'),
  STORAGE_PUBLIC_URL: z.string().default('http://localhost:3001'),

  // Meta
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v20.0'),
  META_REDIRECT_URI_FACEBOOK: z.string().optional(),
  META_REDIRECT_URI_INSTAGRAM: z.string().optional(),
  META_REDIRECT_URI_THREADS: z.string().optional(),

  // TikTok
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().optional(),

  // LinkedIn
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().optional(),

  // Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // X
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_REDIRECT_URI: z.string().optional(),

  // Pinterest
  PINTEREST_APP_ID: z.string().optional(),
  PINTEREST_APP_SECRET: z.string().optional(),
  PINTEREST_REDIRECT_URI: z.string().optional(),
}).refine((v) => isNonRootMysqlUrl(v.DATABASE_URL, v.NODE_ENV), {
  message: 'DATABASE_URL must not use the root MySQL user',
  path: ['DATABASE_URL'],
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
