import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Wraps an async route/middleware so any thrown error (or rejected promise)
 * is forwarded to Express's error pipeline. Also lets handlers omit explicit
 * returns — the wrapper has a void signature regardless of what the inner
 * handler returns, silencing `noImplicitReturns` across the route layer.
 */
export function ah(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    try {
      const out = handler(req, res, next);
      if (isPromiseLike(out)) {
        Promise.resolve(out).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}
