import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from './prisma.js';

/**
 * Single password policy shared by every place a password is set
 * (user admin, reset link, self-service change, staff/client provisioning).
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[\W_]/, 'Password must contain at least one special character');

/** Cryptographically random temporary password that satisfies `passwordSchema`. */
export function generateTempPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%*-_';
  const all = upper + lower + digits + special;
  const pick = (set: string) => set[crypto.randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates shuffle so the required classes aren't in fixed positions
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Revoke every refresh token (all sessions) of a user. */
export async function revokeUserSessions(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

/**
 * Disable a login: the account can no longer sign in, refresh, or use an
 * outstanding access token (authenticate middleware checks `isActive`).
 */
export async function deactivateUser(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await revokeUserSessions(userId);
  // Stop push notifications to the disabled account's devices.
  await prisma.deviceToken.deleteMany({ where: { userId } });
}
