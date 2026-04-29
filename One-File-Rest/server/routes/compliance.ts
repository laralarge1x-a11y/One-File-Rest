import { Router, Request, Response } from 'express';
import { calculateComplianceScore, getUserComplianceScores } from '../services/compliance-score.js';
import { complianceScoreSchema, validateRequest } from '../utils/validation.js';
import { z } from 'zod';

const router = Router();

const caseIdParamSchema = z.object({
  caseId: z.string().regex(/^\d+$/, 'Invalid case ID')
});

const discordIdParamSchema = z.object({
  discordId: z.string().regex(/^\d{17,20}$/, 'Invalid Discord ID')
});

/**
 * GET /api/compliance/score/:caseId - Get compliance score for a case
 */
router.get('/score/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    // Validate caseId
    const validation = caseIdParamSchema.safeParse({ caseId });
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid case ID' });
    }

    const score = await calculateComplianceScore(parseInt(caseId));
    res.json(score);
  } catch (err) {
    console.error('Error calculating compliance score:', err);
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

/**
 * GET /api/compliance/user/:discordId - Get compliance scores for all user's cases
 */
router.get('/user/:discordId', async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;

    // Validate discordId
    const validation = discordIdParamSchema.safeParse({ discordId });
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid Discord ID' });
    }

    const scores = await getUserComplianceScores(discordId);
    res.json(scores);
  } catch (err) {
    console.error('Error fetching user compliance scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

/**
 * GET /api/compliance/summary - Get compliance summary for authenticated user
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;

    const scores = await getUserComplianceScores(discordId);

    // Calculate summary stats
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : 0;

    const gradeDistribution = scores.reduce((acc, s) => {
      acc[s.grade] = (acc[s.grade] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    res.json({
      totalCases: scores.length,
      averageScore: avgScore,
      gradeDistribution,
      scores
    });
  } catch (err) {
    console.error('Error fetching compliance summary:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
