import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Determine if we are in setup mode (missing required env vars)
export const isSetupComplete = !!(process.env.DATABASE_URL && process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);

// If not setup, provide dummy values so the app can start and serve the /api/install routes
const safeEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://dummy:dummy@localhost:3306/dummy',
  JWT_SECRET: process.env.JWT_SECRET || 'dummy_secret_for_setup_mode_only_12345',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dummy_refresh_secret_for_setup_mode_only_12345',
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(safeEnv);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
