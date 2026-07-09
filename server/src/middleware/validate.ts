import type { Request, Response, NextFunction } from 'express';
import { z, ZodError, type AnyZodObject } from 'zod';
import { AppError } from '../lib/errors.js';

interface ValidationSchemas {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

/**
 * Generic Zod validation middleware.
 * Validates request body, params, and/or query against provided schemas.
 */
export function validate(schemas: ValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.strip().parseAsync(req.body);
      }
      if (schemas.params) {
        const parsedParams = await schemas.params.strict().parseAsync(req.params);
        Object.defineProperty(req, 'params', {
          value: parsedParams,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.strict().parseAsync(req.query);
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true
        });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        // Log validation failures so they appear in PM2 error log for debugging
        console.error(`[Validate] 400 Validation failed on ${req.method} ${req.path}:`, messages);
        next(AppError.badRequest(`Validation failed: ${messages}`));
        return;
      }
      next(error);
    }
  };
}
