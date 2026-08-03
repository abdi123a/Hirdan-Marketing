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
      // Admins bypass; client portal uses its own access model
      if (req.user.role === 'ADMIN' || req.user.role === 'CLIENT') {
        next();
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
