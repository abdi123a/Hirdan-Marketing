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
        req.body = await schemas.body.strict().parseAsync(req.body);
      }
      if (schemas.params) {
        req.params = await schemas.params.strict().parseAsync(req.params) as typeof req.params;
      }
      if (schemas.query) {
        req.query = await schemas.query.strict().parseAsync(req.query) as typeof req.query;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(AppError.badRequest(`Validation failed: ${messages}`));
        return;
      }
      next(error);
    }
  };
}
