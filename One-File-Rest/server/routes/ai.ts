import { Router } from 'express';
import pool from '../db/client.js';
import { groqText } from '../services/groq.js';

const router = Router();

router.post('/generate-appeal', async (req, res) => {
  try {
    const { case_id } = req.body;

    // Fetch case details to personalize the appeal
    let caseContext = `case ${case_id}`;
    try {
      const caseResult = await pool.query(
        `SELECT c.account_username, c.violation_type, c.violation_description, o.total_gmv, o.face_videos_posted
         FROM cases c
         LEFT JOIN onboarding_data o ON c.id = o.case_id
         WHERE c.id = $1`,
        [case_id]
      );
      if (caseResult.rows.length > 0) {
        const c = caseResult.rows[0];
        caseContext = `TikTok account @${c.account_username}, violation: ${c.violation_type}. ` +
          `${c.violation_description ? 'Description: ' + c.violation_description + '. ' : ''}` +
          `${c.total_gmv ? 'GMV: $' + c.total_gmv + '. ' : ''}` +
          `${c.face_videos_posted ? 'Face videos posted: ' + c.face_videos_posted + '. ' : ''}`;
      }
    } catch (dbErr) {
      console.warn('Could not fetch case details for appeal generation:', dbErr);
    }

    const draft = await groqText({
      systemPrompt: 'You are an expert TikTok Shop appeal writer. Write professional, persuasive appeal letters that are specific to the violation type and account details. Focus on facts, account history, and community value.',
      userMessage: `Generate a professional TikTok appeal letter for: ${caseContext}. The appeal should be respectful, factual, and highlight the creator's positive contributions.`,
    });

    res.json({ draft });
  } catch (err: any) {
    const msg = err?.message || 'Failed to generate appeal';
    if (msg.includes('GROQ_API_KEY')) {
      res.status(503).json({ error: 'AI features are not configured. Please add a GROQ_API_KEY.' });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
