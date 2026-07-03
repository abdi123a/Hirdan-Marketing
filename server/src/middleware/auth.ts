import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';
  clientId?: string;
  company?: string;
  mustChangePassword?: boolean;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verify JWT from Authorization header and attach user to request.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;

    const isClientForcedToChangePassword =
      decoded.role === 'CLIENT' &&
      decoded.mustChangePassword === true;
    const isAllowedPathWhileForced =
      req.originalUrl.startsWith('/api/auth/client-change-password') ||
      req.originalUrl.startsWith('/api/auth/logout') ||
      req.originalUrl.startsWith('/api/auth/refresh') ||
      req.originalUrl.startsWith('/api/auth/me');

    if (isClientForcedToChangePassword && !isAllowedPathWhileForced) {
      throw AppError.forbidden('Password change required before accessing the portal');
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
