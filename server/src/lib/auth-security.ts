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

// ─── Session-bound access tokens ────────────────────────────────

/**
 * Access tokens carry the refresh-token family they were issued for as `sid`.
 * A session is revoked by deleting its refresh-token rows (logout, reuse
 * detection, password change/reset, deactivation), so "no unexpired row left
 * in the family" means the session is over and its access tokens must die too.
 *
 * Tokens issued before `sid` existed have no claim; they are accepted until
 * their own (short) expiry so a deploy doesn't sign everyone out.
 */
export type AccessSessionDecision = 'allow' | 'legacy' | 'revoked' | 'invalid';

export function decideAccessSession(sid: unknown, familyIsLive: boolean | undefined): AccessSessionDecision {
  if (sid === undefined) return 'legacy';
  if (typeof sid !== 'string' || sid.length === 0) return 'invalid';
  return familyIsLive ? 'allow' : 'revoked';
}

/** True while at least one unexpired refresh token of the family still exists. */
export async function isSessionFamilyLive(userId: string, familyId: string): Promise<boolean> {
  const row = await prisma.refreshToken.findFirst({
    where: { familyId, userId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return !!row;
}

// ─── Refresh rotation / reuse ───────────────────────────────────

/**
 * A rotated refresh token presented again within this window is treated as a
 * benign race (two tabs refreshing at once) rather than token theft.
 */
export const REFRESH_REUSE_GRACE_MS = 60 * 1000;

export type RefreshReuseDecision = 'rotate' | 'grace' | 'reuse-detected';

/**
 * `claimed` is whether this request atomically marked the token used.
 * Otherwise it was already rotated at `usedAt`: within the grace window the
 * caller re-issues tokens for the *same* family; past it, the family is revoked.
 */
export function decideRefreshReuse(
  claimed: boolean,
  usedAt: Date | null,
  now: Date,
  graceMs = REFRESH_REUSE_GRACE_MS
): RefreshReuseDecision {
  if (claimed) return 'rotate';
  const rotatedAt = usedAt ?? now;
  return now.getTime() - rotatedAt.getTime() > graceMs ? 'reuse-detected' : 'grace';
}

/** Family a refresh continues. Legacy rows without a family use their own id. */
export function refreshFamilyOf(stored: { id: string; familyId: string | null }): string {
  return stored.familyId ?? stored.id;
}
