import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Assigns/propagates an X-Request-Id on every request so user-reported
 * failures can be traced to a specific log line. Honours an inbound header
 * (useful behind a reverse proxy) but only when it looks like a UUID.
 */
const UUID_RE = /^[0-9a-fA-F-]{8,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
