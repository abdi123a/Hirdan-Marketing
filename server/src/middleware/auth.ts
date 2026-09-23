import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { decideAccessSession, isSessionFamilyLive } from '../lib/auth-security.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';
  clientId?: string;
  company?: string;
  mustChangePassword?: boolean;
  /** Refresh-token family (login session) this access token belongs to. */
  sid?: string;
}

// Extend Express Request to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augmentation requires a namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Auth endpoints a user may still call while a password change is pending. */
const PASSWORD_CHANGE_ALLOWED_PATHS = [
  '/api/auth/change-password',
  '/api/auth/client-change-password',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/me',
];

/**
 * Verify JWT from Authorization header and attach user to request.
 *
 * The signature alone is not enough: the account may have been deactivated,
 * demoted, or (for clients) paused since the token was issued. One primary-key
 * lookup per request re-checks that state and uses the *current* role.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    // Purpose-specific tokens signed with the same secret (e.g. email-stream
    // tickets carry `typ`) are not access tokens.
    if (!decoded || typeof decoded.userId !== 'string' || (decoded as { typ?: unknown }).typ !== undefined) {
      throw AppError.unauthorized('Invalid token');
    }

    const sid: unknown = decoded.sid;
    const [account, familyIsLive] = await Promise.all([
      prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          client: { select: { id: true, company: true, status: true } },
        },
      }),
      // Indexed lookup on refresh_tokens.family_id; skipped for pre-`sid` tokens.
      typeof sid === 'string' && sid.length > 0 ? isSessionFamilyLive(decoded.userId, sid) : undefined,
    ]);

    if (!account || !account.isActive) {
      throw AppError.unauthorized('Account is disabled');
    }
    const session = decideAccessSession(sid, familyIsLive);
    if (session === 'invalid') {
      throw AppError.unauthorized('Invalid token');
    }
    if (session === 'revoked') {
      // Logged out, password changed, or session revoked by an admin.
      throw AppError.unauthorized('Session has ended. Please log in again.');
    }
    if (account.role === 'CLIENT') {
      if (!account.client || account.client.status === 'PAUSED' || account.client.status === 'CHURNED') {
        throw AppError.unauthorized('Your account is currently inactive. Please contact support.');
      }
    }

    req.user = {
      userId: decoded.userId,
      email: account.email,
      role: account.role,
      clientId: account.client?.id,
      company: account.client?.company,
      mustChangePassword: account.mustChangePassword,
      sid: typeof sid === 'string' ? sid : undefined,
    };

    const path = req.originalUrl.split('?')[0];
    const isAllowedPathWhileForced = PASSWORD_CHANGE_ALLOWED_PATHS.some((p) => path.startsWith(p));

    if (account.mustChangePassword && !isAllowedPathWhileForced) {
      throw AppError.forbidden('Password change required before continuing');
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized('Token expired'));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(AppError.unauthorized('Invalid token'));
      return;
    }
    next(error);
  }
}

/**
 * Require the authenticated user to be an admin.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  if (req.user.role !== 'ADMIN') {
    next(AppError.forbidden('Admin access required'));
    return;
  }
  next();
}

/**
 * Require the authenticated user to have one of the specified roles.
 */
export function requireRole(...roles: Array<'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}
