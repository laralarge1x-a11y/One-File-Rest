import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { calculateComplianceScore } from '../services/compliance-score.js';
import { fireWebhook, buildNewCaseEmbed, buildStatusChangedEmbed, logAudit } from '../services/webhook.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');

    let query: string;
    let values: any[];

    if (isStaff) {
      query = `SELECT c.*, u.discord_username, s.name as staff_name, u.plan
               FROM cases c
               JOIN users u ON c.user_discord_id = u.discord_id
               LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
               ORDER BY c.created_at DESC`;
      values = [];
    } else {
      query = `SELECT c.*, u.discord_username, s.name as staff_name
               FROM cases c
               JOIN users u ON c.user_discord_id = u.discord_id
               LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
               WHERE c.user_discord_id = $1
               ORDER BY c.created_at DESC`;
      values = [discordId];
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');

    const whereClause = isStaff ? 'WHERE c.id = $1' : 'WHERE c.id = $1 AND c.user_discord_id = $2';
    const values = isStaff ? [id] : [id, discordId];

    const result = await pool.query(
      `SELECT c.*, u.discord_username, u.email, u.plan
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       ${whereClause}`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const caseData = result.rows[0];

    let complianceScore = null;
    try { complianceScore = await calculateComplianceScore(parseInt(id)); } catch {}

    const [messagesResult, evidenceResult, onboardingResult] = await Promise.all([
      pool.query(`SELECT * FROM messages WHERE case_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC`, [id]),
      pool.query(`SELECT * FROM onboarding_data WHERE case_id = $1 LIMIT 1`, [id]),
    ]);

    res.json({
      ...caseData,
      complianceScore,
      messages: messagesResult.rows,
      evidence: evidenceResult.rows,
      onboarding: onboardingResult.rows[0] || null,
    });
  } catch (err) {
    console.error('Error fetching case:', err);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;
    const {
      accountUsername, violationType, violationDescription,
      appealDeadline, totalGMV, faceVideosPosted, commissionFrozen, accountPurchaseDate,
    } = req.body;

    if (!accountUsername || !violationType) return res.status(400).json({ error: 'Missing required fields' });

    const result = await pool.query(
      `INSERT INTO cases (
        user_discord_id, account_username, violation_type, violation_description,
        appeal_deadline, commission_frozen, status, priority, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'normal', NOW(), NOW()) RETURNING *`,
      [discordId, accountUsername, violationType, violationDescription, appealDeadline || null, commissionFrozen || false]
    );
    const newCase = result.rows[0];

    if (totalGMV !== undefined || faceVideosPosted !== undefined || accountPurchaseDate) {
      pool.query(
        `INSERT INTO onboarding_data (case_id, user_discord_id, total_gmv, face_videos_posted, account_purchase_date, commission_frozen)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newCase.id, discordId, totalGMV || 0, faceVideosPosted || 0, accountPurchaseDate || null, commissionFrozen || false]
      ).catch(console.error);
    }

    let complianceScore = null;
    try { complianceScore = await calculateComplianceScore(newCase.id); } catch {}

    // Get user's plan for the webhook embed
    const userRes = await pool.query('SELECT plan FROM users WHERE discord_id = $1', [discordId]);
    const plan = userRes.rows[0]?.plan;

    // Audit log + webhook (non-blocking)
    logAudit({ actorDiscordId: discordId, action: 'case_created', targetType: 'case', targetId: newCase.id, details: { violation_type: violationType } }).catch(console.error);
    fireWebhook(discordId!, 'case_created', buildNewCaseEmbed({ ...newCase, plan }));

    res.status(201).json({ ...newCase, complianceScore });
  } catch (err) {
    console.error('Error creating case:', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');
    const { status, priority, appealDeadline, outcome, outcome_notes } = req.body;

    const caseResult = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    if (caseResult.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const oldCase = caseResult.rows[0];

    if (!isStaff && oldCase.user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (status !== undefined) { updates.push(`status = $${p++}`); values.push(status); }
    if (priority !== undefined) { updates.push(`priority = $${p++}`); values.push(priority); }
    if (appealDeadline !== undefined) { updates.push(`appeal_deadline = $${p++}`); values.push(appealDeadline); }
    if (outcome !== undefined) { updates.push(`outcome = $${p++}`); values.push(outcome); }
    if (outcome_notes !== undefined) { updates.push(`outcome_notes = $${p++}`); values.push(outcome_notes); }
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE cases SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    );

    // Webhooks (non-blocking)
    if (status && status !== oldCase.status) {
      fireWebhook(oldCase.user_discord_id, 'status_changed', buildStatusChangedEmbed({
        caseId: parseInt(id), oldStatus: oldCase.status, newStatus: status,
        updatedBy: req.user!.discord_username,
      }));
    }
    if (outcome && ['won', 'denied'].includes(outcome)) {
      const diffHours = Math.round((Date.now() - new Date(oldCase.created_at).getTime()) / 3600000);
      fireWebhook(oldCase.user_discord_id, 'case_resolved', {
        color: outcome === 'won' ? 0x57F287 : 0xED4245,
        title: outcome === 'won' ? '✅ Case Resolved — Won!' : '❌ Case Resolved — Denied',
        fields: [
          { name: 'Case ID', value: `#${id}`, inline: true },
          { name: 'Outcome', value: outcome.toUpperCase(), inline: true },
          { name: 'Time Taken', value: `${diffHours} hours`, inline: true },
          { name: 'Notes', value: (outcome_notes || 'No notes').substring(0, 200), inline: false },
        ],
        footer: { text: 'TikTok Recovery Portal' },
      });
    }
    logAudit({ actorDiscordId: discordId, action: 'case_updated', targetType: 'case', targetId: parseInt(id), details: { status, outcome } }).catch(console.error);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');

    const caseResult = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [id]);
    if (caseResult.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    if (!isStaff && caseResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query(`UPDATE cases SET status = 'closed', updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error closing case:', err);
    res.status(500).json({ error: 'Failed to close case' });
  }
});

router.get('/:id/compliance-score', async (req: Request, res: Response) => {
  try {
    const score = await calculateComplianceScore(parseInt(req.params.id));
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch compliance score' });
  }
});

export default router;
