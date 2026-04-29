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
      role: 'client' | 'support' | 'case_manager' | 'owner';
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

  const staffRoles: string[] = ['support', 'case_manager', 'owner'];
  if (!staffRoles.includes(req.user!.role)) {
    res.status(403).json({ error: 'Forbidden - staff access required' });
    return;
  }

  next();
}

export function requireCaseManager(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Unauthorized - please log in' });
    return;
  }

  const managerRoles: string[] = ['case_manager', 'owner'];
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

  if (req.user!.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden - owner access required' });
    return;
  }

  next();
}
