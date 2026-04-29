import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { createSubscriptionSchema, updateSubscriptionSchema, validateRequest } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/subscriptions - Get user's subscription
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;

    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE user_discord_id = $1 ORDER BY created_at DESC`,
      [discordId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * GET /api/subscriptions/:id - Get specific subscription
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

    const result = await pool.query(
      `SELECT * FROM subscriptions WHERE id = $1 AND user_discord_id = $2`,
      [id, discordId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscriptions - Create new subscription
 */
router.post('/', validateRequest(createSubscriptionSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { plan, autoRenew } = validatedData;
    const discordId = req.user?.discord_id;

    const result = await pool.query(
      `INSERT INTO subscriptions (user_discord_id, plan, status, auto_renew, start_date)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [discordId, plan, 'active', autoRenew !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating subscription:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * PATCH /api/subscriptions/:id - Update subscription
 */
router.patch('/:id', validateRequest(updateSubscriptionSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;
    const validatedData = (req as any).validatedBody;

    // Verify ownership
    const subResult = await pool.query(
      `SELECT user_discord_id FROM subscriptions WHERE id = $1`,
      [id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (validatedData.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(validatedData.status);
    }
    if (validatedData.autoRenew !== undefined) {
      updates.push(`auto_renew = $${paramCount++}`);
      values.push(validatedData.autoRenew);
    }
    if (validatedData.endDate !== undefined) {
      updates.push(`end_date = $${paramCount++}`);
      values.push(validatedData.endDate);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(updateQuery, values);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * DELETE /api/subscriptions/:id - Cancel subscription
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

    // Verify ownership
    const subResult = await pool.query(
      `SELECT user_discord_id FROM subscriptions WHERE id = $1`,
      [id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error cancelling subscription:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
