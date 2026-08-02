import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';
import { redactSecrets } from '../lib/social/safe-error.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default error values
  let statusCode = 500;
  let message = err.message || 'Internal server error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log unexpected errors (never dump Axios configs — they often contain tokens)
  if (!isOperational) {
    console.error('💥 Unexpected error:', redactSecrets(err.message), redactSecrets(err.stack || ''));
  }

  // SECURITY: only `AppError` messages are written deliberately for end users.
  // Everything else is an unexpected throw whose message routinely names internal
  // tables, columns, constraints or file paths (Prisma errors in particular), so
  // outside development it is replaced with a generic string. The real error and
  // stack are logged above and stay server-side.
  const isDev = env.NODE_ENV === 'development';
  const body: Record<string, unknown> = {
    error: true,
    message: isOperational || isDev ? message : 'Internal server error',
  };
  if (isDev) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
