import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import pool from '../db/client.js';

const router = Router();

// Admin Discord IDs from env
function getAdminIds(): string[] {
  return (process.env.ADMIN_DISCORD_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

// ─── Discord OAuth initiation ─────────────────────────────────────────────
router.get('/discord', (req: Request, res: Response, next: NextFunction) => {
  console.log('[Auth] /auth/discord — initiating Discord OAuth redirect');
  if (!process.env.DISCORD_CLIENT_ID) {
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
  });

  if (error) {
    console.error('[Auth] Discord returned an error:', error, error_description);
    return res.redirect(`/?error=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code) {
    console.error('[Auth] No code received in callback');
    return res.redirect('/?error=no_code');
  }

  passport.authenticate('discord', async (err: any, user: any, info: any) => {
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
    });

    req.login(user, async (loginErr) => {
      if (loginErr) {
        console.error('[Auth] req.login failed:', loginErr?.message || loginErr);
        return next(loginErr);
      }

      try {
        // Admin detection — check ADMIN_DISCORD_IDS
        const adminIds = getAdminIds();
        const isAdmin = adminIds.includes(user.discord_id);
        const isStaff = ['support', 'case_manager', 'owner'].includes(user.role);

        let finalRole = user.role || 'client';
        if (isAdmin) {
          finalRole = 'admin';
          await pool.query(
            `UPDATE users SET role = 'admin', updated_at = NOW() WHERE discord_id = $1`,
            [user.discord_id]
          );
          console.log('[Auth] User promoted to admin:', user.discord_id);
        } else if (!isStaff && user.role !== 'client') {
          finalRole = 'client';
          await pool.query(
            `UPDATE users SET role = 'client', updated_at = NOW() WHERE discord_id = $1`,
            [user.discord_id]
          );
        }

        // Portal token — ensure it exists
        if (!user.portal_token) {
          const tokenResult = await pool.query(
            `UPDATE users SET portal_token = gen_random_uuid(), updated_at = NOW()
             WHERE discord_id = $1 AND portal_token IS NULL RETURNING portal_token`,
            [user.discord_id]
          );
          if (tokenResult.rows[0]) {
            user.portal_token = tokenResult.rows[0].portal_token;
          }
        }

        // Update session with final role
        (req.user as any).role = finalRole;
      } catch (postLoginErr) {
        console.error('[Auth] Post-login role update failed:', postLoginErr);
        // Non-fatal — proceed with login
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Auth] Session save failed:', saveErr?.message || saveErr);
          return next(saveErr);
        }

        // Role-based redirect
        const role = (req.user as any)?.role || 'client';
        const discordId = (req.user as any)?.discord_id;
        const isStaff = ['admin', 'owner', 'case_manager', 'support'].includes(role);
        const redirectTo = isStaff ? '/admin' : '/dashboard';

        // Audit log
        import('../services/webhook.js')
          .then(({ logAudit }) =>
            logAudit({
              actorDiscordId: discordId,
              action: isStaff ? 'admin_login' : 'client_login',
              targetType: 'user',
              details: { role, username: (req.user as any)?.discord_username },
            })
          )
          .catch(console.error);

        console.log('[Auth] Login successful — role:', role, '— redirecting to', redirectTo);
        return res.redirect(redirectTo);
      });
    });
  })(req, res, next);
});

// ─── Magic link token access ──────────────────────────────────────────────
router.get('/access/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    console.log('[Auth] Magic link access attempt:', token?.substring(0, 8) + '...');

    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, u.role, 'client') as resolved_role
       FROM users u
       LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.portal_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      console.warn('[Auth] Invalid portal token');
      return res.redirect('/?error=invalid_token');
    }

    const user = { ...result.rows[0], role: result.rows[0].resolved_role };
    console.log('[Auth] Magic link login for user:', user.discord_username);

    req.login(user, (err) => {
      if (err) return next(err);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect('/dashboard');
      });
    });
  } catch (err) {
    console.error('[Auth] Magic link error:', err);
    next(err);
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────
router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  console.log('[Auth] Logout request from:', (req.user as any)?.discord_id || 'unauthenticated');
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((destroyErr) => {
      if (destroyErr) console.error('[Auth] Session destroy error:', destroyErr);
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
    plan: user.plan,
    plan_start: user.plan_start,
    plan_expiry: user.plan_expiry,
    created_at: user.created_at,
  });
});

// ─── Auth status (debug) ─────────────────────────────────────────────────
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
