import pool from '../db/client.js';
import { statusToStage, getStageMeta, type StageId } from '../../shared/stages.js';

/**
 * Legacy six-stage timeline (used by the customer-facing CaseTimeline
 * component). Kept in lock-step with the canonical 7-stage taxonomy in
 * shared/stages.ts so a single status update advances both views.
 */
const STATUS_TO_LEGACY_STAGE: Record<string, string> = {
  pending:           'Submitted',
  intake:            'In Review',
  profile_built:     'In Review',
  appeal_drafted:    'Appeal Drafted',
  appeal_submitted:  'Appeal Sent',
  awaiting_tiktok:   'Awaiting TikTok',
  response_received: 'Awaiting TikTok',
  escalated:         'Awaiting TikTok',
  won:               'Resolved',
  denied:            'Resolved',
  closed:            'Resolved',
};

const ORDERED_STAGES = ['Submitted', 'In Review', 'Appeal Drafted', 'Appeal Sent', 'Awaiting TikTok', 'Resolved'];

/**
 * Move the case_timeline forward to match a new status, AND record an
 * entry in case_stage_history (used by the Stage Board audit log).
 */
export async function advanceCaseTimeline(
  caseId: number,
  newStatus: string,
  actorDiscordId?: string | null,
  opts?: {
    source?: 'manual' | 'kanban' | 'system' | 'bot';
    note?: string;
    oldStatus?: string;
    /** Skip the case_stage_history insert when the caller has already
     *  written it (e.g. inside a transaction in the kanban move route). */
    skipStageHistory?: boolean;
  }
): Promise<void> {
  const targetStage = STATUS_TO_LEGACY_STAGE[newStatus];
  if (!targetStage) return;
  const targetIdx = ORDERED_STAGES.indexOf(targetStage);
  if (targetIdx === -1) return;

  try {
    const existing = await pool.query(
      `SELECT id, stage_name, stage_status FROM case_timeline WHERE case_id = $1 ORDER BY id ASC`,
      [caseId]
    );
    const byName = new Map<string, { id: number; stage_status: string }>();
    for (const row of existing.rows) byName.set(row.stage_name, { id: row.id, stage_status: row.stage_status });

    for (let i = 0; i < ORDERED_STAGES.length; i++) {
      const stageName = ORDERED_STAGES[i];
      const desired = i < targetIdx ? 'complete' : i === targetIdx ? 'active' : 'pending';
      const row = byName.get(stageName);
      if (!row) {
        await pool.query(
          `INSERT INTO case_timeline (case_id, stage_name, stage_status, created_by_discord_id, completed_at)
           VALUES ($1, $2, $3, $4, ${desired === 'complete' ? 'NOW()' : 'NULL'})`,
          [caseId, stageName, desired, actorDiscordId ?? null]
        );
      } else if (row.stage_status !== desired) {
        await pool.query(
          `UPDATE case_timeline
              SET stage_status = $1,
                  completed_at = CASE WHEN $1 = 'complete' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
                  created_by_discord_id = COALESCE(created_by_discord_id, $3)
            WHERE id = $2`,
          [desired, row.id, actorDiscordId ?? null]
        );
      }
    }

    // Stage Board history — only insert when the canonical stage actually
    // changed. Two status bumps inside the same canonical stage (e.g.
    // intake → profile_built, both → "Drafting") would otherwise create a
    // noisy duplicate row, so we compare canonical stages, not raw status.
    const newStage = statusToStage(newStatus);
    const oldStage = opts?.oldStatus ? statusToStage(opts.oldStatus) : null;
    if (!opts?.skipStageHistory && newStage !== oldStage) {
      await pool.query(
        `INSERT INTO case_stage_history
           (case_id, from_stage, to_stage, from_status, to_status, actor_discord_id, source, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          caseId,
          oldStage,
          newStage,
          opts?.oldStatus || null,
          newStatus,
          actorDiscordId ?? null,
          opts?.source || 'manual',
          opts?.note || null,
        ]
      );
    }
  } catch (err) {
    console.error('[timeline] advanceCaseTimeline failed:', err);
  }
}

export { statusToStage, getStageMeta, type StageId };
