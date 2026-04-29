import pool from '../db/client.js';
import Redis from 'redis';

const redis = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.connect().catch(err => console.error('Redis connection error:', err));

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
 * Optimized with single aggregated query instead of N+1 queries
 */
export async function calculateComplianceScore(caseId: number): Promise<ComplianceScoreResult> {
  // Check Redis cache first
  const cacheKey = `compliance:${caseId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Redis cache error:', err);
  }

  // Single optimized query to get all metrics at once
  const metricsResult = await pool.query(
    `SELECT
      c.id,
      c.user_discord_id,
      c.commission_frozen,
      c.account_purchase_date,
      c.violation_type,
      c.created_at as case_created_at,
      o.total_gmv,
      o.face_videos_posted,
      COUNT(CASE WHEN c2.status NOT IN ('won', 'closed') AND c2.created_at > NOW() - INTERVAL '90 days' THEN 1 END) as recent_violations,
      COUNT(CASE WHEN c2.outcome = 'denied' THEN 1 END) as denied_appeals,
      COUNT(CASE WHEN c2.outcome = 'won' THEN 1 END) as won_appeals,
      COUNT(CASE WHEN c2.created_at <= NOW() - INTERVAL '90 days' AND c2.status NOT IN ('won', 'closed') THEN 1 END) as old_violations,
      COUNT(CASE WHEN c2.violation_type = c.violation_type AND c2.id != c.id THEN 1 END) as prior_appeals,
      MAX(c2.created_at) as last_violation_date
    FROM cases c
    LEFT JOIN onboarding_data o ON c.id = o.case_id
    LEFT JOIN cases c2 ON c.user_discord_id = c2.user_discord_id
    WHERE c.id = $1
    GROUP BY c.id, c.user_discord_id, c.commission_frozen, c.account_purchase_date, c.violation_type, c.created_at, o.total_gmv, o.face_videos_posted`,
    [caseId]
  );

  if (metricsResult.rows.length === 0) {
    throw new Error(`Case ${caseId} not found`);
  }

  const metrics = metricsResult.rows[0] as any;
  let score = 100;
  const factors: ComplianceScoreFactor[] = [];

  // 1. Recent violations (-15 each)
  if (metrics.recent_violations > 0) {
    const deduction = metrics.recent_violations * 15;
    score -= deduction;
    factors.push({
      name: 'Recent violations',
      impact: -deduction,
      description: `${metrics.recent_violations} violation(s) in last 90 days`,
    });
  }

  // 2. Denied appeals (-10 each)
  if (metrics.denied_appeals > 0) {
    const deduction = metrics.denied_appeals * 10;
    score -= deduction;
    factors.push({
      name: 'Denied appeals',
      impact: -deduction,
      description: `${metrics.denied_appeals} denied appeal(s)`,
    });
  }

  // 3. Commission frozen (-20)
  if (metrics.commission_frozen) {
    score -= 20;
    factors.push({
      name: 'Commission frozen',
      impact: -20,
      description: 'Commission is currently frozen',
    });
  }

  // 4. Purchased account (-10)
  if (metrics.account_purchase_date) {
    score -= 10;
    factors.push({
      name: 'Purchased account',
      impact: -10,
      description: 'Account was purchased, not organic',
    });
  }

  // 5. Prior appeals on same violation (-8 each)
  if (metrics.prior_appeals > 0) {
    const deduction = metrics.prior_appeals * 8;
    score -= deduction;
    factors.push({
      name: 'Prior appeals on same violation',
      impact: -deduction,
      description: `${metrics.prior_appeals} prior appeal(s) on ${metrics.violation_type}`,
    });
  }

  // 6. Old violations (-5 each)
  if (metrics.old_violations > 0) {
    const deduction = metrics.old_violations * 5;
    score -= deduction;
    factors.push({
      name: 'Older violations',
      impact: -deduction,
      description: `${metrics.old_violations} violation(s) older than 90 days`,
    });
  }

  // 7. No face videos (-5)
  if (metrics.face_videos_posted === 0) {
    score -= 5;
    factors.push({
      name: 'No face videos',
      impact: -5,
      description: 'No face videos posted',
    });
  }

  // POSITIVE FACTORS

  // 8. Won appeals (+10 each)
  if (metrics.won_appeals > 0) {
    const addition = metrics.won_appeals * 10;
    score += addition;
    factors.push({
      name: 'Won appeals',
      impact: addition,
      description: `${metrics.won_appeals} successful appeal(s)`,
    });
  }

  // 9. 90+ days since last violation (+15)
  if (metrics.last_violation_date) {
    const daysSinceViolation = Math.floor(
      (Date.now() - new Date(metrics.last_violation_date).getTime()) / (1000 * 60 * 60 * 24)
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
  if (metrics.total_gmv && metrics.total_gmv >= 3000) {
    score += 5;
    factors.push({
      name: 'High GMV',
      impact: 5,
      description: `$${metrics.total_gmv}/month`,
    });
  }

  // 11. Multiple successful appeals (+8)
  if (metrics.won_appeals >= 2) {
    score += 8;
    factors.push({
      name: 'Multiple successful appeals',
      impact: 8,
      description: `${metrics.won_appeals} successful appeals`,
    });
  }

  // 12. Account age > 6 months (+5)
  const accountAge = Math.floor(
    (Date.now() - new Date(metrics.case_created_at).getTime()) / (1000 * 60 * 60 * 24)
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

  // Calculate trend
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
  if (metrics.face_videos_posted === 0) {
    recommendations.push('Post face videos to improve your compliance score');
  }
  if (metrics.commission_frozen) {
    recommendations.push('Work on unfreezing your commission');
  }
  if (metrics.recent_violations > 0) {
    recommendations.push('Focus on avoiding new violations');
  }
  if (metrics.total_gmv && metrics.total_gmv < 1000) {
    recommendations.push('Increase GMV to strengthen your account');
  }
  if (metrics.denied_appeals > 0) {
    recommendations.push('Review denied appeals to improve future appeals');
  }

  const result: ComplianceScoreResult = {
    score,
    grade,
    factors,
    trend,
    recommendations,
    lastCalculated: new Date(),
  };

  // Cache for 1 hour
  try {
    await redis.setEx(cacheKey, 3600, JSON.stringify(result));
  } catch (err) {
    console.error('Failed to cache compliance score:', err);
  }

  return result;
}

/**
 * Get compliance scores for all accounts of a user (optimized)
 */
export async function getUserComplianceScores(discordId: string): Promise<UserComplianceScore[]> {
  // Single query with aggregations instead of N+1
  const scoresResult = await pool.query(
    `SELECT
      c.id,
      c.account_username,
      COALESCE(cs.score, 0) as score,
      COALESCE(cs.grade, 'F') as grade,
      COALESCE(cs.trend, 'stable') as trend
    FROM cases c
    LEFT JOIN (
      SELECT case_id, score, grade, trend, ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY created_at DESC) as rn
      FROM compliance_scores
    ) cs ON c.id = cs.case_id AND cs.rn = 1
    WHERE c.user_discord_id = $1
    ORDER BY c.created_at DESC`,
    [discordId]
  );

  return scoresResult.rows.map(row => ({
    caseId: row.id as number,
    accountUsername: row.account_username as string,
    score: row.score as number,
    grade: row.grade as 'A' | 'B' | 'C' | 'D' | 'F',
    trend: row.trend as 'improving' | 'stable' | 'declining',
  }));
}

/**
 * Recalculate and cache compliance score
 */
export async function recalculateComplianceScore(caseId: number): Promise<ComplianceScoreResult> {
  const result = await calculateComplianceScore(caseId);

  // Cache the score in database
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

/**
 * Clear compliance score cache
 */
export async function clearComplianceCache(caseId: number): Promise<void> {
  try {
    await redis.del(`compliance:${caseId}`);
  } catch (err) {
    console.error('Failed to clear compliance cache:', err);
  }
}
