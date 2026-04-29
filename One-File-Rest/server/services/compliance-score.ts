import pool from '../db/client.js';

export interface ComplianceScoreFactor {
  name: string;
  impact: number;
  description: string;
}

export interface ComplianceScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: ComplianceScoreFactor[];
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  lastCalculated: Date;
}

export interface UserComplianceScore {
  caseId: number;
  accountUsername: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
}

/**
 * Calculate compliance score for a specific case (TikTok account)
 * Score ranges from 0-100 with letter grades A-F
 * Factors include violations, appeals, account age, GMV, and more
 */
export async function calculateComplianceScore(caseId: number): Promise<ComplianceScoreResult> {
  const caseResult = await pool.query(
    `SELECT c.*, o.* FROM cases c
     LEFT JOIN onboarding_data o ON c.id = o.case_id
     WHERE c.id = $1`,
    [caseId]
  );

  if (caseResult.rows.length === 0) {
    throw new Error(`Case ${caseId} not found`);
  }

  const caseData = caseResult.rows[0] as any;
  let score = 100;
  const factors: ComplianceScoreFactor[] = [];

  // 1. Recent violations in last 90 days (-15 each)
  const recentViolationsResult = await pool.query(
    `SELECT COUNT(*) as count FROM cases
     WHERE user_discord_id = $1 AND created_at > NOW() - INTERVAL '90 days'
     AND status NOT IN ('won', 'closed')`,
    [caseData.user_discord_id]
  );
  const recentViolationCount = parseInt(recentViolationsResult.rows[0].count as string);
  if (recentViolationCount > 0) {
    const deduction = recentViolationCount * 15;
    score -= deduction;
    factors.push({
      name: 'Recent violations',
      impact: -deduction,
      description: `${recentViolationCount} violation(s) in last 90 days`,
    });
  }

  // 2. Denied appeals (-10 each)
  const deniedAppealsResult = await pool.query(
    `SELECT COUNT(*) as count FROM cases
     WHERE user_discord_id = $1 AND outcome = 'denied'`,
    [caseData.user_discord_id]
  );
  const deniedCount = parseInt(deniedAppealsResult.rows[0].count as string);
  if (deniedCount > 0) {
    const deduction = deniedCount * 10;
    score -= deduction;
    factors.push({
      name: 'Denied appeals',
      impact: -deduction,
      description: `${deniedCount} denied appeal(s)`,
    });
  }

  // 3. Commission frozen (-20)
  if (caseData.commission_frozen) {
    score -= 20;
    factors.push({
      name: 'Commission frozen',
      impact: -20,
      description: 'Commission is currently frozen',
    });
  }

  // 4. Purchased account (-10)
  if (caseData.account_purchase_date) {
    score -= 10;
    factors.push({
      name: 'Purchased account',
      impact: -10,
      description: 'Account was purchased, not organic',
    });
  }

  // 5. Prior appeal on same violation type (-8)
  const priorAppealsResult = await pool.query(
    `SELECT COUNT(*) as count FROM cases
     WHERE user_discord_id = $1 AND violation_type = $2 AND id != $3`,
    [caseData.user_discord_id, caseData.violation_type, caseId]
  );
  const priorAppealCount = parseInt(priorAppealsResult.rows[0].count as string);
  if (priorAppealCount > 0) {
    const deduction = priorAppealCount * 8;
    score -= deduction;
    factors.push({
      name: 'Prior appeals on same violation',
      impact: -deduction,
      description: `${priorAppealCount} prior appeal(s) on ${caseData.violation_type}`,
    });
  }

  // 6. Violations older than 90 days (-5 each)
  const oldViolationsResult = await pool.query(
    `SELECT COUNT(*) as count FROM cases
     WHERE user_discord_id = $1 AND created_at <= NOW() - INTERVAL '90 days'
     AND status NOT IN ('won', 'closed')`,
    [caseData.user_discord_id]
  );
  const oldViolationCount = parseInt(oldViolationsResult.rows[0].count as string);
  if (oldViolationCount > 0) {
    const deduction = oldViolationCount * 5;
    score -= deduction;
    factors.push({
      name: 'Older violations',
      impact: -deduction,
      description: `${oldViolationCount} violation(s) older than 90 days`,
    });
  }

  // 7. No face videos posted (-5)
  if (caseData.face_videos_posted === 0) {
    score -= 5;
    factors.push({
      name: 'No face videos',
      impact: -5,
      description: 'No face videos posted',
    });
  }

  // POSITIVE FACTORS

  // 8. Won appeals (+10 each)
  const wonAppealsResult = await pool.query(
    `SELECT COUNT(*) as count FROM cases
     WHERE user_discord_id = $1 AND outcome = 'won'`,
    [caseData.user_discord_id]
  );
  const wonCount = parseInt(wonAppealsResult.rows[0].count as string);
  if (wonCount > 0) {
    const addition = wonCount * 10;
    score += addition;
    factors.push({
      name: 'Won appeals',
      impact: addition,
      description: `${wonCount} successful appeal(s)`,
    });
  }

  // 9. 90+ days since last violation (+15)
  const lastViolationResult = await pool.query(
    `SELECT MAX(created_at) as last_violation FROM cases
     WHERE user_discord_id = $1`,
    [caseData.user_discord_id]
  );
  const lastViolation = lastViolationResult.rows[0].last_violation;
  if (lastViolation) {
    const daysSinceViolation = Math.floor(
      (Date.now() - new Date(lastViolation).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceViolation >= 90) {
      score += 15;
      factors.push({
        name: '90+ days clean',
        impact: 15,
        description: `${daysSinceViolation} days since last violation`,
      });
    }
  }

  // 10. High GMV (+5)
  if (caseData.total_gmv && caseData.total_gmv >= 3000) {
    score += 5;
    factors.push({
      name: 'High GMV',
      impact: 5,
      description: `$${caseData.total_gmv}/month`,
    });
  }

  // 11. Multiple successful appeals (+8)
  if (wonCount >= 2) {
    score += 8;
    factors.push({
      name: 'Multiple successful appeals',
      impact: 8,
      description: `${wonCount} successful appeals`,
    });
  }

  // 12. Account age > 6 months (+5)
  const accountAge = Math.floor(
    (Date.now() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (accountAge > 180) {
    score += 5;
    factors.push({
      name: 'Established account',
      impact: 5,
      description: `Account age: ${Math.floor(accountAge / 30)} months`,
    });
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 30) grade = 'D';
  else grade = 'F';

  // Calculate trend (compare to 30 days ago)
  const previousScoreResult = await pool.query(
    `SELECT score FROM compliance_scores
     WHERE case_id = $1 AND created_at > NOW() - INTERVAL '31 days'
     ORDER BY created_at ASC LIMIT 1`,
    [caseId]
  );

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (previousScoreResult.rows.length > 0) {
    const previousScore = previousScoreResult.rows[0].score as number;
    if (score > previousScore + 5) trend = 'improving';
    else if (score < previousScore - 5) trend = 'declining';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (caseData.face_videos_posted === 0) {
    recommendations.push('Post face videos to improve your compliance score');
  }
  if (caseData.commission_frozen) {
    recommendations.push('Work on unfreezing your commission');
  }
  if (recentViolationCount > 0) {
    recommendations.push('Focus on avoiding new violations');
  }
  if (caseData.total_gmv && caseData.total_gmv < 1000) {
    recommendations.push('Increase GMV to strengthen your account');
  }
  if (deniedCount > 0) {
    recommendations.push('Review denied appeals to improve future appeals');
  }

  return {
    score,
    grade,
    factors,
    trend,
    recommendations,
    lastCalculated: new Date(),
  };
}

/**
 * Get compliance scores for all accounts of a user
 */
export async function getUserComplianceScores(discordId: string): Promise<UserComplianceScore[]> {
  const casesResult = await pool.query(
    `SELECT id, account_username FROM cases WHERE user_discord_id = $1 ORDER BY created_at DESC`,
    [discordId]
  );

  const scores: UserComplianceScore[] = [];

  for (const row of casesResult.rows) {
    try {
      const scoreResult = await calculateComplianceScore(row.id as number);
      scores.push({
        caseId: row.id as number,
        accountUsername: row.account_username as string,
        score: scoreResult.score,
        grade: scoreResult.grade,
        trend: scoreResult.trend,
      });
    } catch (err) {
      console.error(`Failed to calculate score for case ${row.id}:`, err);
    }
  }

  return scores;
}

/**
 * Recalculate and cache compliance score
 */
export async function recalculateComplianceScore(caseId: number): Promise<ComplianceScoreResult> {
  const result = await calculateComplianceScore(caseId);

  // Cache the score
  try {
    await pool.query(
      `INSERT INTO compliance_scores (case_id, score, grade, trend, factors, recommendations, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        caseId,
        result.score,
        result.grade,
        result.trend,
        JSON.stringify(result.factors),
        JSON.stringify(result.recommendations),
      ]
    );
  } catch (err) {
    console.error('Failed to cache compliance score:', err);
  }

  return result;
}
