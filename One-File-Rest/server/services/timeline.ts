import pool from '../db/client.js';

const STATUS_TO_STAGE: Record<string, string> = {
  pending: 'Submitted',
  intake: 'In Review',
  profile_built: 'In Review',
  appeal_drafted: 'Appeal Drafted',
  appeal_submitted: 'Appeal Sent',
  awaiting_tiktok: 'Awaiting TikTok',
  response_received: 'Awaiting TikTok',
  escalated: 'Awaiting TikTok',
  won: 'Resolved',
  denied: 'Resolved',
  closed: 'Resolved',
};

const ORDERED_STAGES = ['Submitted', 'In Review', 'Appeal Drafted', 'Appeal Sent', 'Awaiting TikTok', 'Resolved'];

/**
 * Move the case_timeline forward to match a new status.
 * Marks any prior `active` stage as `complete` and sets the matching
 * stage to `active` (creating it if missing). Earlier pending stages
 * are bumped to `complete` so the timeline is monotonic.
 */
export async function advanceCaseTimeline(caseId: number, newStatus: string, actorDiscordId?: string | null): Promise<void> {
  const targetStage = STATUS_TO_STAGE[newStatus];
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
  } catch (err) {
    console.error('[timeline] advanceCaseTimeline failed:', err);
  }
}
