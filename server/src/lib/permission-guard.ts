import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';
import { AppError } from './errors.js';
import {
  type AccessLevel,
  type ModuleKey,
  type PermissionMap,
  hasPermission,
  resolvePermissions,
} from './permissions.js';

/**
 * Load resolved permissions for the authenticated user (ADMIN = full).
 * Cached on req for the lifetime of the request.
 */
export async function getRequestPermissions(req: Request): Promise<Record<ModuleKey, AccessLevel>> {
  const cached = (req as any).__resolvedPermissions as Record<ModuleKey, AccessLevel> | undefined;
  if (cached) return cached;

  if (!req.user) {
    throw AppError.unauthorized();
  }

  if (req.user.role === 'ADMIN') {
    const full = resolvePermissions('ADMIN');
    (req as any).__resolvedPermissions = full;
    return full;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true, permissions: true },
  });

  if (!user) {
    throw AppError.unauthorized();
  }

  const resolved = resolvePermissions(
    user.role,
    (user.permissions as PermissionMap | null) || null
  );
  (req as any).__resolvedPermissions = resolved;
  return resolved;
}

/**
 * Modules where client-portal users are intentionally allowed to reach staff
 * routes because the route handlers themselves self-scope to the caller's
 * own client record (e.g. `where: { userId: req.user.userId }`). Every other
 * module must go through the normal permission check, which resolves CLIENT
 * to NONE (see ROLE_DEFAULT_PERMISSIONS) and is rejected.
 */
const CLIENT_SELF_SERVICE_MODULES: ReadonlySet<ModuleKey> = new Set([
  'clients',
  'invoices',
  'proforma',
  'subscriptions',
  'projects',
] as ModuleKey[]);

/**
 * Express middleware: require at least `minimum` access on `module`.
 * ADMIN always passes.
 */
export function requirePermission(module: ModuleKey, minimum: AccessLevel = 'READ') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        next(AppError.unauthorized());
        return;
      }
      if (req.user.role === 'ADMIN') {
        next();
        return;
      }
      // Client portal uses its own access model for a known allowlist of
      // self-service modules; every other module is denied for CLIENT.
      if (req.user.role === 'CLIENT') {
        if (CLIENT_SELF_SERVICE_MODULES.has(module)) {
          next();
          return;
        }
        next(AppError.forbidden(`You do not have access to ${module}`));
        return;
      }

      const permissions = await getRequestPermissions(req);
      if (!hasPermission(permissions, module, minimum)) {
        next(AppError.forbidden(`You do not have ${minimum.toLowerCase()} access to ${module}`));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Method-aware module gate:
 *   GET/HEAD → READ
 *   POST/PUT/PATCH → WRITE
 *   DELETE → MANAGE
 */
export function requireModuleAccess(module: ModuleKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    const minimum: AccessLevel =
      method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
        ? 'READ'
        : method === 'DELETE'
          ? 'MANAGE'
          : 'WRITE';
    return requirePermission(module, minimum)(req, res, next);
  };
}
