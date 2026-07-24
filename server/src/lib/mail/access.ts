import type { Request, Response, NextFunction } from 'express';
import type { MailboxAccessLevel } from '@prisma/client';
import { prisma } from '../prisma.js';
import { AppError } from '../errors.js';

/**
 * Mailbox-level access control for the Email Center.
 *
 * The app keeps the existing UserRole enum (ADMIN | MANAGER | STAFF | CLIENT).
 * ADMIN acts as the "Super Admin" with access to every mailbox. All other
 * staff members only see mailboxes explicitly granted to them through
 * MailboxPermission rows — so they cannot even list mailboxes they lack
 * access to. CLIENT users have no Email Center access at all.
 */

export type AuthUser = { userId: string; role: string };

const LEVEL_RANK: Record<MailboxAccessLevel, number> = {
  READ: 1,
  WRITE: 2,
  MANAGE: 3,
};

export function isSuperAdmin(role?: string): boolean {
  return role === 'ADMIN';
}

/** Returns 'ALL' for super admins, otherwise the mailbox IDs the user can access. */
export async function accessibleMailboxIds(user: AuthUser): Promise<'ALL' | string[]> {
  if (isSuperAdmin(user.role)) return 'ALL';
  const perms = await prisma.mailboxPermission.findMany({
    where: { userId: user.userId },
    select: { mailboxId: true },
  });
  return perms.map((p) => p.mailboxId);
}

/**
 * Build a Prisma `where` fragment scoping a query to the mailboxes a user may
 * access. Returns `{}` for super admins (no restriction).
 */
export async function mailboxScopeWhere(
  user: AuthUser,
  field: string = 'mailboxId'
): Promise<Record<string, unknown>> {
  const ids = await accessibleMailboxIds(user);
  if (ids === 'ALL') return {};
  // An empty `in` list must match nothing.
  return { [field]: { in: ids } };
}

/** Throws 403 unless the user has at least `level` access to the mailbox. */
export async function assertMailboxAccess(
  user: AuthUser,
  mailboxId: string,
  level: MailboxAccessLevel = 'READ'
): Promise<void> {
  if (isSuperAdmin(user.role)) return;
  const perm = await prisma.mailboxPermission.findUnique({
    where: { mailboxId_userId: { mailboxId, userId: user.userId } },
    select: { accessLevel: true },
  });
  if (!perm || LEVEL_RANK[perm.accessLevel] < LEVEL_RANK[level]) {
    throw AppError.forbidden('You do not have access to this mailbox');
  }
}

/** Resolve the current user's access level for a mailbox (null = no access). */
export async function mailboxAccessLevel(
  user: AuthUser,
  mailboxId: string
): Promise<MailboxAccessLevel | 'ADMIN' | null> {
  if (isSuperAdmin(user.role)) return 'ADMIN';
  const perm = await prisma.mailboxPermission.findUnique({
    where: { mailboxId_userId: { mailboxId, userId: user.userId } },
    select: { accessLevel: true },
  });
  return perm?.accessLevel ?? null;
}

/**
 * Express middleware factory. Reads the mailbox id from params/body/query
 * (or a custom getter) and enforces the required access level.
 */
export function requireMailboxAccess(
  level: MailboxAccessLevel = 'READ',
  getMailboxId?: (req: Request) => string | undefined
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const mailboxId =
        (getMailboxId ? getMailboxId(req) : undefined) ??
        (req.params.mailboxId as string | undefined) ??
        (req.body?.mailboxId as string | undefined) ??
        (req.query?.mailboxId as string | undefined);
      if (!mailboxId) throw AppError.badRequest('mailboxId is required');
      await assertMailboxAccess(req.user!, mailboxId, level);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Guard the whole Email Center to internal staff (never CLIENT). */
export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  if (req.user.role === 'CLIENT') {
    next(AppError.forbidden('Staff access required'));
    return;
  }
  next();
}
