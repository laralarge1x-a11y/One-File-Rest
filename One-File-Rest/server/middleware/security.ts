import helmet from 'helmet';
import cors from 'cors';
import type { RequestHandler } from 'express';

/**
 * CORS allow-list. Driven by env so prod can lock to the published
 * domain, while dev permits the Vite origin and the Replit dev URL.
 */
export function buildAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    'http://localhost:5173',
    'http://localhost:5000',
    'http://localhost:3000',
  ];
  const replitDomains = (process.env.REPLIT_DOMAINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((d) => `https://${d}`);
  const replitDev = process.env.REPLIT_DEV_DOMAIN
    ? [`https://${process.env.REPLIT_DEV_DOMAIN}`]
    : [];
  return Array.from(new Set([...defaults, ...replitDomains, ...replitDev, ...fromEnv]));
}

export const corsMiddleware: RequestHandler = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / mobile webview
    const allowed = buildAllowedOrigins();
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
});

/**
 * Helmet with a CSP that lets the existing client load. We intentionally
 * keep `unsafe-inline`/`unsafe-eval` for scripts because the current
 * Vite dev bundle relies on inline runtime. Tighten once the client has
 * a proper nonce strategy.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
      mediaSrc: ["'self'", 'blob:', 'data:'],
      workerSrc: ["'self'", 'blob:'],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://discord.com'],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer-when-downgrade' },
  hsts:
    process.env.NODE_ENV === 'production'
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
  frameguard: { action: 'sameorigin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', ')
  );
  next();
};

export const accessLog: RequestHandler = (req, res, next) => {
  if (req.path === '/health') return next();
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      `[req ${req.id}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${ms}ms`
    );
  });
  next();
};
