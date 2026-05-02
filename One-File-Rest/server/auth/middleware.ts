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
