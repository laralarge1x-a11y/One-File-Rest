import type { Request, Response, NextFunction, RequestHandler, ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from './errors.js';

export interface ValidateSchemas {
  body?: ZodSchema<unknown>;
  query?: ZodSchema<unknown>;
  params?: ZodSchema<unknown>;
}

/**
 * Single zod-based validation middleware: pass any combination of
 * `body`, `query`, `params` schemas and the parsed/coerced result is
 * written back onto the request object. On failure we throw an AppError
 * with a structured `fields` map so the client gets per-field messages.
 *
 * Usage:
 *   router.post('/x', validate({ body: SomeSchema }), ah(async (req,res) => ...));
 */
export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query ?? {}) as ParsedQs;
        // Express 5 makes req.query a getter — copy props rather than reassign.
        const q = req.query as Record<string, unknown>;
        for (const k of Object.keys(q)) delete q[k];
        Object.assign(q, parsed);
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params ?? {}) as ParamsDictionary;
        Object.assign(req.params as Record<string, string>, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const path = issue.path.length === 0 ? '_' : issue.path.map(String).join('.');
          (fields[path] ||= []).push(issue.message);
        }
        return next(new AppError(400, 'validation_failed', 'Invalid request', { fields }));
      }
      next(err);
    }
  };
}
