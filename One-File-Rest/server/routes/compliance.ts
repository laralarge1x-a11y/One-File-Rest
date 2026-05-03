import { Router } from 'express';
import { z } from 'zod';
import { calculateComplianceScore, getUserComplianceScores } from '../services/compliance-score.js';
import { validate } from '../middleware/index.js';
import { discordIdSchema, emptyQuerySchema } from '../../shared/schemas.js';

const router = Router();

const CaseIdParam = z.object({ caseId: z.coerce.number().int().positive() }).strict();
const DiscordIdParam = z.object({ discordId: discordIdSchema }).strict();

router.get('/score/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema }), async (req, res) => {
  try {
    const score = await calculateComplianceScore(parseInt(req.params.caseId));
    return res.json(score);
  } catch (err) {
    console.error('[compliance/score]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to calculate score', requestId: req.id } });
  }
});

router.get('/user/:discordId', validate({ params: DiscordIdParam, query: emptyQuerySchema }), async (req, res) => {
  try {
    const scores = await getUserComplianceScores(req.params.discordId);
    return res.json(scores);
  } catch (err) {
    console.error('[compliance/user]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch scores', requestId: req.id } });
  }
});

export default router;
