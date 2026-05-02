import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import pool from '../db/client.js';

const router = Router();

// ─── Discord OAuth initiation ─────────────────────────────────────────────
router.get('/discord', (req: Request, res: Response, next: NextFunction) => {
  console.log('[Auth] /auth/discord — initiating Discord OAuth redirect');
  if (!process.env.DISCORD_CLIENT_ID) {
    console.error('[Auth] DISCORD_CLIENT_ID is not set — cannot initiate OAuth');
    return res.status(503).send('Discord OAuth is not configured. Please set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI in Secrets.');
  }
  passport.authenticate('discord')(req, res, next);
});

// ─── Discord OAuth callback ───────────────────────────────────────────────
router.get('/callback', (req: Request, res: Response, next: NextFunction) => {
  const { code, error, error_description } = req.query;

  console.log('[Auth] /auth/callback received', {
    hasCode: !!code,
    error: error || null,
    error_description: error_description || null,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
  });

  // Discord sent back an OAuth error (user denied, etc.)
  if (error) {
    console.error('[Auth] Discord returned an error:', error, error_description);
    return res.redirect(`/?error=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code) {
    console.error('[Auth] No code received in callback');
    return res.redirect('/?error=no_code');
  }

  passport.authenticate('discord', (err: any, user: any, info: any) => {
    if (err) {
      console.error('[Auth] Passport authentication error:', err?.message || err);
      return next(err);
    }

    if (!user) {
      console.warn('[Auth] No user returned from passport — info:', info);
      return res.redirect('/?error=auth_failed');
    }

    console.log('[Auth] Passport authenticated user:', {
      discord_id: user.discord_id,
      username: user.discord_username,
      role: user.role,
    });

    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('[Auth] req.login failed:', loginErr?.message || loginErr);
        return next(loginErr);
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Auth] Session save failed:', saveErr?.message || saveErr);
          return next(saveErr);
        }

        console.log('[Auth] Login successful — redirecting to /dashboard');
        return res.redirect('/dashboard');
      });
    });
  })(req, res, next);
});

// ─── Logout ──────────────────────────────────────────────────────────────
router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  const discordId = (req.user as any)?.discord_id;
  console.log('[Auth] Logout request from:', discordId || 'unauthenticated');

  req.logout((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err);
      return next(err);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('[Auth] Session destroy error:', destroyErr);
      }
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  });
});

// ─── Current user ────────────────────────────────────────────────────────
router.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = req.user as any;
  res.json({
    id: user.id,
    discord_id: user.discord_id,
    discord_username: user.discord_username,
    discord_avatar: user.discord_avatar,
    email: user.email,
    role: user.role || 'client',
    portal_token: user.portal_token,
    created_at: user.created_at,
  });
});

// ─── Portal token access (alternative login) ─────────────────────────────
router.get('/access/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    console.log('[Auth] Portal token access attempt:', token?.substring(0, 8) + '...');

    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, 'client') as role
       FROM users u
       LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.portal_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      console.warn('[Auth] Invalid portal token');
      return res.status(404).json({ error: 'Invalid access token' });
    }

    const user = result.rows[0];
    console.log('[Auth] Token login for user:', user.discord_username);

    req.login(user, (err) => {
      if (err) return next(err);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect('/dashboard');
      });
    });
  } catch (err) {
    console.error('[Auth] Portal token access error:', err);
    next(err);
  }
});

// ─── Auth status (debug helper) ──────────────────────────────────────────
router.get('/status', (req: Request, res: Response) => {
  res.json({
    authenticated: req.isAuthenticated(),
    discord_oauth_configured: !!(
      process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_REDIRECT_URI
    ),
    redirect_uri: process.env.DISCORD_REDIRECT_URI || 'NOT SET',
    node_env: process.env.NODE_ENV,
    session_id: req.sessionID,
  });
});

export default router;
