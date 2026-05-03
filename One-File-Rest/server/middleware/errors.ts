import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Canonical error envelope:
 *   { error: { code, message, requestId, fields? } }
 *
 * All error responses across the server flow through this handler so the
 * client sees a single shape. Throw an `AppError` from anywhere in a
 * route/middleware to surface a clean HTTP error; unknown errors become
 * a 500 with the request id logged.
 */
export class AppError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]>;
  expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    opts?: { fields?: Record<string, string[]>; cause?: unknown; expose?: boolean }
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = opts?.fields;
    this.expose = opts?.expose ?? true;
    if (opts?.cause !== undefined) (this as Error & { cause?: unknown }).cause = opts.cause;
  }
}

export const Errors = {
  badRequest: (message = 'Bad request', fields?: Record<string, string[]>) =>
    new AppError(400, 'bad_request', message, { fields }),
  unauthorized: (message = 'Unauthorized') => new AppError(401, 'unauthorized', message),
  forbidden: (message = 'Forbidden') => new AppError(403, 'forbidden', message),
  notFound: (message = 'Not found') => new AppError(404, 'not_found', message),
  conflict: (message = 'Conflict') => new AppError(409, 'conflict', message),
  tooMany: (message = 'Too many requests') => new AppError(429, 'rate_limited', message),
  internal: (message = 'Internal server error') =>
    new AppError(500, 'internal', message, { expose: false }),
};

function zodToFields(err: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const path = issue.path.length === 0 ? '_' : issue.path.map(String).join('.');
    if (!fields[path]) fields[path] = [];
    fields[path].push(issue.message);
  }
  return fields;
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(Errors.notFound('Route not found'));
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  // Zod validation surfaced from controller bodies (validate middleware
  // catches its own throws, but route handlers may parse manually).
  if (err instanceof ZodError) {
    const fields = zodToFields(err);
    res.status(400).json({
      error: { code: 'validation_failed', message: 'Invalid request', requestId, fields },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      console.error(`[error ${requestId}] ${req.method} ${req.url}`, err);
    }
    const body: any = {
      code: err.code,
      message: err.expose ? err.message : 'Something went wrong',
      requestId,
    };
    if (err.fields) body.fields = err.fields;
    res.status(err.status).json({ error: body });
    return;
  }

  // express-rate-limit throws plain objects with a status; translate.
  if (err && err.status === 429) {
    res.status(429).json({
      error: { code: 'rate_limited', message: 'Too many requests', requestId },
    });
    return;
  }

  // Body-parser size/JSON errors carry a status.
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 500) {
    console.error(`[error ${requestId}] ${req.method} ${req.url}`, err);
  }
  const isProd = process.env.NODE_ENV === 'production';
  const message =
    status < 500
      ? err?.message || 'Bad request'
      : isProd
        ? 'Something went wrong'
        : err?.message || 'Internal server error';
  res.status(status).json({
    error: {
      code: status >= 500 ? 'internal' : 'bad_request',
      message,
      requestId,
    },
  });
}
