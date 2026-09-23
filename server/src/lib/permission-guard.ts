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
 * The only mutating requests a CLIENT may make through the staff API. Each
 * handler re-scopes to the caller's own client record and strips every field
 * a client may not change. Everything else a client can do is read-only.
 * Matched against `req.baseUrl + req.path` (case-insensitive and
 * trailing-slash tolerant, like Express routing itself).
 */
const CLIENT_WRITE_ALLOWLIST: ReadonlyArray<{ method: string; path: RegExp }> = [
  { method: 'PUT', path: /^(?:\/api)?\/invoices\/[^/]+\/?$/i },
  { method: 'PUT', path: /^(?:\/api)?\/proformas\/[^/]+\/?$/i },
  { method: 'PUT', path: /^(?:\/api)?\/clients\/me\/?$/i },
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Whether a CLIENT may issue `method` against `fullPath` (baseUrl + path). */
export function isClientRequestAllowed(method: string, fullPath: string): boolean {
  const m = method.toUpperCase();
  if (SAFE_METHODS.has(m)) return true;
  // Collapse duplicate slashes so `//invoices//x` cannot dodge the patterns.
  const normalized = fullPath.replace(/\/{2,}/g, '/');
  return CLIENT_WRITE_ALLOWLIST.some((rule) => rule.method === m && rule.path.test(normalized));
}

/**
 * Client-portal section (see `Client.portalAccess`, toggled per client by an
 * admin and mirrored in ClientPortalPage) that gates each self-service module.
 * `clients` is not gated: it serves the client's own profile (/clients/me).
 */
const PORTAL_SECTION_BY_MODULE: Partial<Record<ModuleKey, string>> = {
  invoices: 'financials',
  proforma: 'financials',
  subscriptions: 'subscriptions',
  projects: 'projects',
};

/**
 * Whether the admin left the portal section behind `module` enabled.
 * Missing / null / malformed settings mean "everything enabled" (the portal's
 * default); a section is off only when explicitly set to `false`.
 */
export function isPortalSectionEnabled(portalAccess: unknown, module: ModuleKey): boolean {
  const section = PORTAL_SECTION_BY_MODULE[module];
  if (!section) return true;
  let access = portalAccess;
  if (typeof access === 'string') {
    try {
      access = JSON.parse(access);
    } catch {
      return true;
    }
  }
  if (!access || typeof access !== 'object' || Array.isArray(access)) return true;
  return (access as Record<string, unknown>)[section] !== false;
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
      if (req.user.role === 'ADMIN') {
        next();
        return;
      }
      // Client portal uses its own access model for a known allowlist of
      // self-service modules; every other module is denied for CLIENT.
      if (req.user.role === 'CLIENT') {
        if (!CLIENT_SELF_SERVICE_MODULES.has(module)) {
          next(AppError.forbidden(`You do not have access to ${module}`));
          return;
        }
        if (!isClientRequestAllowed(req.method, `${req.baseUrl}${req.path}`)) {
          next(AppError.forbidden(`You do not have write access to ${module}`));
          return;
        }
        if (PORTAL_SECTION_BY_MODULE[module]) {
          const client = await prisma.client.findUnique({
            where: { userId: req.user.userId },
            select: { portalAccess: true },
          });
          if (client && !isPortalSectionEnabled(client.portalAccess, module)) {
            next(AppError.forbidden(`Access to ${module} is disabled for your portal`));
            return;
          }
        }
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
