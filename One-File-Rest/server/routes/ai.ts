import { Router } from 'express';
import { groqText } from '../services/groq.js';

const router = Router();

router.post('/generate-appeal', async (req, res) => {
  try {
    const { case_id } = req.body;
    const draft = await groqText(
      'You are an expert TikTok Shop appeal writer. Write a professional appeal letter.',
      `Generate an appeal for case ${case_id}`
    );
    res.json({ draft });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate appeal' });
  }
});

export default router;
