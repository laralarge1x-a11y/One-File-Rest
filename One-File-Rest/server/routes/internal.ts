import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';
import { timingSafeEqual } from 'crypto';
import crypto from 'crypto';
import { getOrCreateTokenSchema, revokeAccessSchema, checkAccessSchema, validateRequest } from '../utils/validation.js';

const router = Router();

// Middleware to verify internal API secret (timing-safe comparison)
const verifyInternalSecret = (req: Request, res: Response, next: Function) => {
  const secret = req.headers['x-internal-secret'] as string;
  const expectedSecret = process.env.INTERNAL_API_SECRET || '';

  if (!secret || !expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

router.use(verifyInternalSecret);

/**
 * POST /internal/get-or-create-token
 * Called by Discord bot during /uniquelink
 * Creates user in users table if not exists, returns their portal_token and full URL
 */
router.post('/get-or-create-token', validateRequest(getOrCreateTokenSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { discord_id, discord_username, discord_avatar } = validatedData;

    const result = await pool.query(
      `INSERT INTO users (discord_id, discord_username, discord_avatar)
       VALUES ($1, $2, $3)
       ON CONFLICT (discord_id) DO UPDATE SET
         discord_username = EXCLUDED.discord_username,
         discord_avatar = EXCLUDED.discord_avatar,
         last_active = NOW()
       RETURNING portal_token`,
      [discord_id, discord_username, discord_avatar]
    );

    const portal_token = result.rows[0].portal_token;
    const portal_url = `${process.env.PORTAL_URL}/access/${portal_token}`;

    res.json({ portal_token, portal_url });
  } catch (err) {
    console.error('Error in get-or-create-token:', err);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

/**
 * POST /internal/revoke-access
 * Called by Discord bot during /removewebaccess confirmation
 * Sets portal_access.access_active = false, regenerates token
 */
router.post('/revoke-access', validateRequest(revokeAccessSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { discord_id } = validatedData;

    // Regenerate token to invalidate old URL
    const newToken = uuidv4();

    await pool.query(
      `UPDATE users SET portal_token = $1 WHERE discord_id = $2`,
      [newToken, discord_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error in revoke-access:', err);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

/**
 * POST /internal/check-access
 * Called by portal middleware on every page load
 * Checks portal_access.access_active for the user
 */
router.post('/check-access', validateRequest(checkAccessSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { discord_id } = validatedData;

    const result = await pool.query(
      `SELECT access_active, plan FROM portal_access WHERE discord_id = $1`,
      [discord_id]
    );

    if (result.rows.length === 0) {
      return res.json({ active: false, plan: null });
    }

    const { access_active, plan } = result.rows[0];
    res.json({ active: access_active, plan });
  } catch (err) {
    console.error('Error in check-access:', err);
    res.status(500).json({ error: 'Failed to check access' });
  }
});

export default router;
