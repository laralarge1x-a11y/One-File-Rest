import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { requireAdmin } from '../auth/middleware.js';

const router = Router();

/**
 * GET /api/admin/webhook-routing/:discordId
 * Returns the current webhook channel routing config for a user
 */
router.get('/admin/webhook-routing/:discordId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { discordId } = req.params;
    const result = await pool.query(
      'SELECT discord_id, discord_username, discord_webhook_url, webhook_channel_routing FROM users WHERE discord_id = $1',
      [discordId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = result.rows[0];
    let routing = {};
    try {
      routing = typeof user.webhook_channel_routing === 'string'
        ? JSON.parse(user.webhook_channel_routing || '{}')
        : (user.webhook_channel_routing || {});
    } catch { /* empty */ }

    res.json({
      discordId: user.discord_id,
      username: user.discord_username,
      webhookUrl: user.discord_webhook_url,
      routing,
    });
  } catch (err) {
    console.error('[webhook-admin] Error fetching routing:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/webhook-routing/:discordId
 * Updates the webhook channel routing config
 * Body: { eventType: string, webhookUrl: string } to set one route
 * or:   { routing: Record<string, string> } to replace all
 */
router.put('/admin/webhook-routing/:discordId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { discordId } = req.params;
    const { eventType, webhookUrl, routing } = req.body;

    // Get current routing
    const userResult = await pool.query(
      'SELECT webhook_channel_routing FROM users WHERE discord_id = $1',
      [discordId]
    );
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let currentRouting: Record<string, string> = {};
    try {
      currentRouting = typeof userResult.rows[0].webhook_channel_routing === 'string'
        ? JSON.parse(userResult.rows[0].webhook_channel_routing || '{}')
        : (userResult.rows[0].webhook_channel_routing || {});
    } catch { /* empty */ }

    // If eventType and webhookUrl provided, update single route
    if (eventType && webhookUrl) {
      currentRouting[eventType] = webhookUrl;
    } else if (routing) {
      // Replace all
      currentRouting = routing;
    }

    await pool.query(
      'UPDATE users SET webhook_channel_routing = $1, updated_at = NOW() WHERE discord_id = $2',
      [JSON.stringify(currentRouting), discordId]
    );

    res.json({ success: true, routing: currentRouting });
  } catch (err) {
    console.error('[webhook-admin] Error updating routing:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/webhook-routing/:discordId/:eventType
 * Removes a specific route
 */
router.delete('/admin/webhook-routing/:discordId/:eventType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { discordId, eventType } = req.params;
    const userResult = await pool.query(
      'SELECT webhook_channel_routing FROM users WHERE discord_id = $1',
      [discordId]
    );
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let currentRouting: Record<string, string> = {};
    try {
      currentRouting = typeof userResult.rows[0].webhook_channel_routing === 'string'
        ? JSON.parse(userResult.rows[0].webhook_channel_routing || '{}')
        : (userResult.rows[0].webhook_channel_routing || {});
    } catch { /* empty */ }

    delete currentRouting[eventType];

    await pool.query(
      'UPDATE users SET webhook_channel_routing = $1, updated_at = NOW() WHERE discord_id = $2',
      [JSON.stringify(currentRouting), discordId]
    );

    res.json({ success: true, routing: currentRouting });
  } catch (err) {
    console.error('[webhook-admin] Error deleting route:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
