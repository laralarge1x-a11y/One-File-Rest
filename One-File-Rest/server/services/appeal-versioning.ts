import { Pool } from 'pg';

export class AppealVersioningService {
  constructor(private pool: Pool) {}

  // Create new appeal version
  async createAppealVersion(
    caseId: number,
    appealContent: string,
    arguments: string[],
    evidenceIds: number[],
    createdByDiscordId: string,
    changeSummary?: string
  ) {
    // Get next version number
    const versionResult = await this.pool.query(
      `SELECT MAX(version_number) as max_version FROM appeal_versions WHERE case_id = $1`,
      [caseId]
    );

    const nextVersion = (versionResult.rows[0]?.max_version || 0) + 1;

    // Create new version
    const result = await this.pool.query(
      `INSERT INTO appeal_versions
       (case_id, version_number, appeal_content, arguments, evidence_ids, created_by_discord_id, change_summary, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [caseId, nextVersion, appealContent, arguments, evidenceIds, createdByDiscordId, changeSummary || '', 'draft']
    );

    // Log the change
    await this.logAppealChange(caseId, 'version_created', null, appealContent, createdByDiscordId, `Version ${nextVersion} created`);

    return result.rows[0];
  }

  // Get all appeal versions for a case
  async getAppealVersions(caseId: number) {
    const result = await this.pool.query(
      `SELECT id, version_number, appeal_content, arguments, evidence_ids, created_by_discord_id, change_summary, status, created_at
       FROM appeal_versions
       WHERE case_id = $1
       ORDER BY version_number DESC`,
      [caseId]
    );

    return result.rows;
  }

  // Get specific appeal version
  async getAppealVersion(caseId: number, versionId: number) {
    const result = await this.pool.query(
      `SELECT * FROM appeal_versions WHERE case_id = $1 AND id = $2`,
      [caseId, versionId]
    );

    if (result.rows.length === 0) {
      throw new Error('Appeal version not found');
    }

    return result.rows[0];
  }

  // Compare two appeal versions
  async compareAppealVersions(caseId: number, version1Id: number, version2Id: number) {
    const v1Result = await this.pool.query(
      `SELECT * FROM appeal_versions WHERE case_id = $1 AND id = $2`,
      [caseId, version1Id]
    );

    const v2Result = await this.pool.query(
      `SELECT * FROM appeal_versions WHERE case_id = $1 AND id = $2`,
      [caseId, version2Id]
    );

    if (v1Result.rows.length === 0 || v2Result.rows.length === 0) {
      throw new Error('One or both versions not found');
    }

    const v1 = v1Result.rows[0];
    const v2 = v2Result.rows[0];

    const differences = {
      contentChanged: v1.appeal_content !== v2.appeal_content,
      argumentsChanged: JSON.stringify(v1.arguments) !== JSON.stringify(v2.arguments),
      evidenceChanged: JSON.stringify(v1.evidence_ids) !== JSON.stringify(v2.evidence_ids),
      details: {
        v1: {
          version: v1.version_number,
          contentLength: v1.appeal_content.length,
          argumentCount: v1.arguments?.length || 0,
          evidenceCount: v1.evidence_ids?.length || 0,
          createdAt: v1.created_at,
        },
        v2: {
          version: v2.version_number,
          contentLength: v2.appeal_content.length,
          argumentCount: v2.arguments?.length || 0,
          evidenceCount: v2.evidence_ids?.length || 0,
          createdAt: v2.created_at,
        },
      },
    };

    // Calculate similarity score
    const similarity = this.calculateSimilarity(v1.appeal_content, v2.appeal_content);

    // Save comparison
    await this.pool.query(
      `INSERT INTO appeal_comparisons (case_id, version_1_id, version_2_id, differences, similarity_score)
       VALUES ($1, $2, $3, $4, $5)`,
      [caseId, version1Id, version2Id, JSON.stringify(differences), similarity]
    );

    return {
      ...differences,
      similarityScore: similarity,
    };
  }

  // Get appeal history/changelog
  async getAppealHistory(caseId: number, limit: number = 50) {
    const result = await this.pool.query(
      `SELECT id, action, old_value, new_value, changed_by_discord_id, change_reason, field_name, created_at
       FROM appeal_history
       WHERE case_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [caseId, limit]
    );

    return result.rows;
  }

  // Log appeal change
  async logAppealChange(
    caseId: number,
    action: string,
    oldValue: string | null,
    newValue: string | null,
    changedByDiscordId: string,
    changeReason: string,
    fieldName?: string
  ) {
    const result = await this.pool.query(
      `INSERT INTO appeal_history (case_id, action, old_value, new_value, changed_by_discord_id, change_reason, field_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [caseId, action, oldValue, newValue, changedByDiscordId, changeReason, fieldName || null]
    );

    return result.rows[0];
  }

  // Save appeal learnings
  async saveAppealLearnings(
    caseId: number,
    whatWorked: string,
    whatDidntWork: string,
    keyInsights: string,
    recommendationsForFuture: string,
    createdByDiscordId: string
  ) {
    const result = await this.pool.query(
      `INSERT INTO appeal_learnings
       (case_id, what_worked, what_didnt_work, key_insights, recommendations_for_future, created_by_discord_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [caseId, whatWorked, whatDidntWork, keyInsights, recommendationsForFuture, createdByDiscordId]
    );

    return result.rows[0];
  }

  // Get appeal learnings
  async getAppealLearnings(caseId: number) {
    const result = await this.pool.query(
      `SELECT * FROM appeal_learnings WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId]
    );

    return result.rows;
  }

  // Find similar appeals
  async findSimilarAppeals(caseId: number, limit: number = 5) {
    const caseResult = await this.pool.query(
      `SELECT violation_type FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new Error('Case not found');
    }

    const violationType = caseResult.rows[0].violation_type;

    // Find similar cases
    const result = await this.pool.query(
      `SELECT c.id, c.account_username, c.violation_type, c.status, c.outcome,
              av.version_number, av.appeal_content, av.created_at
       FROM cases c
       LEFT JOIN appeal_versions av ON c.id = av.case_id
       WHERE c.violation_type = $1
       AND c.id != $2
       AND c.status IN ('won', 'denied')
       ORDER BY av.created_at DESC
       LIMIT $3`,
      [violationType, caseId, limit]
    );

    return result.rows;
  }

  // Submit appeal version
  async submitAppealVersion(caseId: number, versionId: number, submittedByDiscordId: string) {
    // Update version status
    const versionResult = await this.pool.query(
      `UPDATE appeal_versions
       SET status = 'submitted', submission_date = NOW()
       WHERE case_id = $1 AND id = $2
       RETURNING *`,
      [caseId, versionId]
    );

    if (versionResult.rows.length === 0) {
      throw new Error('Appeal version not found');
    }

    // Update case status
    await this.pool.query(
      `UPDATE cases SET status = 'appeal_submitted', appeal_submitted_at = NOW() WHERE id = $1`,
      [caseId]
    );

    // Log the submission
    await this.logAppealChange(caseId, 'appeal_submitted', null, `Version ${versionResult.rows[0].version_number}`, submittedByDiscordId, 'Appeal submitted to TikTok');

    return versionResult.rows[0];
  }

  // Archive appeal version
  async archiveAppealVersion(caseId: number, versionId: number) {
    const result = await this.pool.query(
      `UPDATE appeal_versions
       SET status = 'archived'
       WHERE case_id = $1 AND id = $2
       RETURNING *`,
      [caseId, versionId]
    );

    if (result.rows.length === 0) {
      throw new Error('Appeal version not found');
    }

    return result.rows[0];
  }

  // Get active appeal version
  async getActiveAppealVersion(caseId: number) {
    const result = await this.pool.query(
      `SELECT * FROM appeal_versions
       WHERE case_id = $1 AND status IN ('draft', 'submitted')
       ORDER BY version_number DESC
       LIMIT 1`,
      [caseId]
    );

    return result.rows[0] || null;
  }

  // Helper: Calculate text similarity
  private calculateSimilarity(text1: string, text2: string): number {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  // Helper: Levenshtein distance algorithm
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }

  // Get version timeline
  async getVersionTimeline(caseId: number) {
    const result = await this.pool.query(
      `SELECT version_number, status, change_summary, created_by_discord_id, created_at
       FROM appeal_versions
       WHERE case_id = $1
       ORDER BY version_number ASC`,
      [caseId]
    );

    return result.rows.map((row: any) => ({
      version: row.version_number,
      status: row.status,
      summary: row.change_summary,
      createdBy: row.created_by_discord_id,
      createdAt: row.created_at,
    }));
  }

  // Rollback to previous version
  async rollbackToVersion(caseId: number, targetVersionId: number, rolledBackByDiscordId: string) {
    const targetVersion = await this.pool.query(
      `SELECT * FROM appeal_versions WHERE case_id = $1 AND id = $2`,
      [caseId, targetVersionId]
    );

    if (targetVersion.rows.length === 0) {
      throw new Error('Target version not found');
    }

    const target = targetVersion.rows[0];

    // Create new version with rolled back content
    const newVersion = await this.createAppealVersion(
      caseId,
      target.appeal_content,
      target.arguments,
      target.evidence_ids,
      rolledBackByDiscordId,
      `Rolled back to version ${target.version_number}`
    );

    return newVersion;
  }
}
