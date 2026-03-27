import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log unexpected errors
  if (!isOperational) {
    console.error('💥 Unexpected error:', err);
  }

  res.status(statusCode).json({
    error: true,
    message,
    ...(env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}
