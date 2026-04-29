import { Router } from 'express';
import { calculateComplianceScore, getUserComplianceScores } from '../services/compliance-score.js';

const router = Router();

router.get('/score/:caseId', async (req, res) => {
  try {
    const score = await calculateComplianceScore(parseInt(req.params.caseId));
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

router.get('/user/:discordId', async (req, res) => {
  try {
    const scores = await getUserComplianceScores(req.params.discordId);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

export default router;
