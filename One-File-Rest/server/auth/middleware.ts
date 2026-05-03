import { Request, Response, NextFunction } from 'express';

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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }
  const staffRoles: string[] = ['support', 'case_manager', 'owner', 'admin'];
  if (!staffRoles.includes(req.user!.role)) {
    res.status(403).json({ error: 'Forbidden - staff access required' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }
  const adminRoles: string[] = ['owner', 'admin'];
  if (!adminRoles.includes(req.user!.role)) {
    res.status(403).json({ error: 'Forbidden - admin access required' });
    return;
  }
  next();
}

export function requireCaseManager(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }
  const managerRoles: string[] = ['case_manager', 'owner', 'admin'];
  if (!managerRoles.includes(req.user!.role)) {
    res.status(403).json({ error: 'Forbidden - case manager access required' });
    return;
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }
  if (!['owner', 'admin'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Forbidden - owner access required' });
    return;
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
export async function requireActiveStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }
  const id = req.user!.discord_id;
  if (_adminIds().includes(id)) { next(); return; }
  try {
    const r = await pool.query(
      `SELECT 1 FROM staff WHERE discord_id = $1 AND active = true LIMIT 1`,
      [id]
    );
    if (r.rowCount === 0) {
      res.status(403).json({ error: 'Forbidden - active staff required' });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'staff check failed' });
  }
}

// Verify bot bridge token
export function requireBotToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['authorization'];
  const expected = `Bearer ${process.env.BOT_BRIDGE_TOKEN}`;
  if (!process.env.BOT_BRIDGE_TOKEN || token !== expected) {
    res.status(401).json({ error: 'Unauthorized - invalid bot token' });
    return;
  }
  next();
}
