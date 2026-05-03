import { Request, Response, NextFunction } from 'express';
import { Errors } from '../middleware/errors.js';

declare global {
  namespace Express {
    interface User {
      id: number;
      discord_id: string;
      discord_username: string;
      discord_avatar: string | null;
      email: string | null;
      portal_token: string;
      role: 'client' | 'support' | 'case_manager' | 'owner' | 'admin';
      plan?: string | null;
      plan_start?: string | null;
      plan_expiry?: string | null;
      discord_channel_id?: string | null;
      discord_webhook_url?: string | null;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) return next(Errors.unauthorized('Please log in'));
  next();
}

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) return next(Errors.unauthorized('Please log in'));
  const staffRoles: string[] = ['support', 'case_manager', 'owner', 'admin'];
  if (!staffRoles.includes(req.user!.role)) {
    return next(Errors.forbidden('Staff access required'));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) return next(Errors.unauthorized('Please log in'));
  if (!['owner', 'admin'].includes(req.user!.role)) {
    return next(Errors.forbidden('Admin access required'));
  }
  next();
}

export function requireCaseManager(req: Request, _res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) return next(Errors.unauthorized('Please log in'));
  const managerRoles: string[] = ['case_manager', 'owner', 'admin'];
  if (!managerRoles.includes(req.user!.role)) {
    return next(Errors.forbidden('Case manager access required'));
  }
  next();
}

export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) return next(Errors.unauthorized('Please log in'));
  if (!['owner', 'admin'].includes(req.user!.role)) {
    return next(Errors.forbidden('Owner access required'));
  }
  next();
}

// Hard staff gate for confidentiality-sensitive surfaces (Ask Elite).
// Unlike requireStaff (which trusts the role on req.user, including the
// users.role fallback in deserializeUser), this re-verifies on every request
// that the caller currently has an active row in the staff table OR is in
// ADMIN_DISCORD_IDS. Deactivated staff and stale elevated user.role values
// are rejected.
import pool from '../db/client.js';
const _adminIds = () => (process.env.ADMIN_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
export async function requireActiveStaff(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.isAuthenticated()) return next(Errors.unauthorized('Please log in'));
  const id = req.user!.discord_id;
  if (_adminIds().includes(id)) { next(); return; }
  try {
    const r = await pool.query(
      `SELECT 1 FROM staff WHERE discord_id = $1 AND active = true LIMIT 1`,
      [id]
    );
    if (r.rowCount === 0) return next(Errors.forbidden('Active staff required'));
    next();
  } catch (err) {
    next(err);
  }
}

// Verify bot bridge token
export function requireBotToken(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers['authorization'];
  const expected = `Bearer ${process.env.BOT_BRIDGE_TOKEN}`;
  if (!process.env.BOT_BRIDGE_TOKEN || token !== expected) {
    return next(Errors.unauthorized('Invalid bot token'));
  }
  next();
}
