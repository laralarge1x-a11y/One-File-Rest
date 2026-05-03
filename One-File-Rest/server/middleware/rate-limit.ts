import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';

/** Canonical 429 response so rate-limit hits use the unified envelope. */
function envelopeHandler(message: string) {
  return (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message,
        requestId: req.id ?? 'unknown',
      },
    });
  };
}

/**
 * Independent per-IP and per-Discord-user buckets composed together. This
 * way a single abusive Discord account can't hide behind multiple IPs and
 * a shared NAT can't penalise innocent neighbours. The memory store is
 * fine for a single-process server; promote to Redis horizontally.
 */
import type { RequestHandler } from 'express';

function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? '0.0.0.0');
}

function userKey(req: Request): string | false {
  const uid = req.user?.discord_id;
  return uid ? `u:${uid}` : false;
}

const baseDefaults: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
};

interface DualLimits {
  windowMs: number;
  ipLimit: number;
  userLimit: number;
  message: string;
}

/**
 * Compose two limiters: one keyed on IP (always on), one keyed on the
 * authenticated Discord id (skipped for anonymous traffic). A request
 * must clear BOTH to be served.
 */
function dualLimiter({ windowMs, ipLimit, userLimit, message }: DualLimits): RequestHandler {
  const perIp = rateLimit({
    ...baseDefaults,
    windowMs,
    limit: ipLimit,
    keyGenerator: ipKey as Options['keyGenerator'],
    handler: envelopeHandler(message),
  });
  const perUser = rateLimit({
    ...baseDefaults,
    windowMs,
    limit: userLimit,
    keyGenerator: ((req: Request) => userKey(req) || ipKey(req)) as Options['keyGenerator'],
    skip: (req) => req.path === '/health' || !req.user?.discord_id,
    handler: envelopeHandler(message),
  });
  return (req, res, next) => {
    perIp(req, res, (err?: any) => {
      if (err || res.headersSent) return next(err);
      perUser(req, res, next);
    });
  };
}

export const generalLimiter = dualLimiter({
  windowMs: 60_000,
  ipLimit: 600,
  userLimit: 600,
  message: 'Too many requests',
});

export const authLimiter = dualLimiter({
  windowMs: 5 * 60_000,
  ipLimit: 30,
  userLimit: 30,
  message: 'Too many auth attempts',
});

export const aiLimiter = dualLimiter({
  windowMs: 60_000,
  ipLimit: 40,
  userLimit: 20,
  message: 'AI rate limit reached',
});

export const adminLimiter = dualLimiter({
  windowMs: 60_000,
  ipLimit: 400,
  userLimit: 200,
  message: 'Too many admin requests',
});

// Bot bridge is service-to-service (token-auth, no Discord user) — IP only.
export const botBridgeLimiter = rateLimit({
  ...baseDefaults,
  windowMs: 60_000,
  limit: 600,
  keyGenerator: ipKey as Options['keyGenerator'],
  handler: envelopeHandler('Bot bridge rate limit reached'),
});
