import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { groqText } from '../services/groq.js';
import { generateAppealSchema, analyzeEvidenceSchema, validateRequest } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/ai/generate-appeal - Generate appeal using AI
 */
router.post('/generate-appeal', validateRequest(generateAppealSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { caseId, templateId, customPrompt } = validatedData;
    const discordId = req.user?.discord_id;

    // Verify case ownership
    const caseResult = await pool.query(
      `SELECT c.*, u.discord_username FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       WHERE c.id = $1 AND c.user_discord_id = $2`,
      [caseId, discordId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = caseResult.rows[0];

    // Get template if provided
    let templateContent = '';
    if (templateId) {
      const templateResult = await pool.query(
        `SELECT template_body FROM appeal_templates WHERE id = $1`,
        [templateId]
      );
      if (templateResult.rows.length > 0) {
        templateContent = templateResult.rows[0].template_body;
      }
    }

    // Build prompt
    const systemPrompt = `You are an expert TikTok Shop appeal writer. Your task is to write a professional, persuasive appeal letter for account violations.
    ${templateContent ? `Use this template as a guide: ${templateContent}` : ''}
    Be specific, factual, and address the violation directly.`;

    const userPrompt = customPrompt || `Generate an appeal for the following case:
    Account: ${caseData.account_username}
    Violation Type: ${caseData.violation_type}
    Violation Description: ${caseData.violation_description}
    ${caseData.internal_notes ? `Internal Notes: ${caseData.internal_notes}` : ''}`;

    const draft = await groqText(systemPrompt, userPrompt);

    // Save draft to messages
    await pool.query(
      `INSERT INTO messages (case_id, sender_discord_id, sender_type, content)
       VALUES ($1, $2, $3, $4)`,
      [caseId, discordId, 'ai', draft]
    );

    res.json({
      success: true,
      draft,
      caseId
    });
  } catch (err) {
    console.error('Error generating appeal:', err);
    res.status(500).json({ error: 'Failed to generate appeal' });
  }
});

/**
 * POST /api/ai/analyze-evidence - Analyze evidence using AI
 */
router.post('/analyze-evidence', validateRequest(analyzeEvidenceSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { evidenceId, analysisType } = validatedData;
    const discordId = req.user?.discord_id;

    // Get evidence
    const evidenceResult = await pool.query(
      `SELECT e.*, c.user_discord_id FROM evidence e
       JOIN cases c ON e.case_id = c.id
       WHERE e.id = $1`,
      [evidenceId]
    );

    if (evidenceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidenceResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const evidence = evidenceResult.rows[0];

    // Build analysis prompt
    const analysisPrompts: { [key: string]: string } = {
      content: `Analyze this evidence file and describe its content in detail. File: ${evidence.file_name}, Type: ${evidence.file_type}`,
      context: `Explain how this evidence relates to TikTok Shop violations and appeals. File: ${evidence.file_name}`,
      relevance: `Rate the relevance of this evidence (1-10) and explain why it's important for an appeal. File: ${evidence.file_name}`
    };

    const prompt = analysisPrompts[analysisType || 'content'] || analysisPrompts.content;

    const analysis = await groqText(
      'You are an expert at analyzing evidence for TikTok Shop appeals. Provide detailed, actionable analysis.',
      prompt
    );

    // Save analysis
    await pool.query(
      `UPDATE evidence SET ai_analysis = $1 WHERE id = $2`,
      [analysis, evidenceId]
    );

    res.json({
      success: true,
      analysis,
      evidenceId
    });
  } catch (err) {
    console.error('Error analyzing evidence:', err);
    res.status(500).json({ error: 'Failed to analyze evidence' });
  }
});

/**
 * POST /api/ai/improve-appeal - Improve existing appeal
 */
router.post('/improve-appeal', async (req: Request, res: Response) => {
  try {
    const { caseId, currentAppeal } = req.body;
    const discordId = req.user?.discord_id;

    if (!caseId || !currentAppeal) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify case ownership
    const caseResult = await pool.query(
      `SELECT * FROM cases WHERE id = $1 AND user_discord_id = $2`,
      [caseId, discordId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const improved = await groqText(
      'You are an expert at improving TikTok Shop appeals. Make the appeal more persuasive, professional, and compelling.',
      `Improve this appeal:\n\n${currentAppeal}`
    );

    res.json({
      success: true,
      improved,
      caseId
    });
  } catch (err) {
    console.error('Error improving appeal:', err);
    res.status(500).json({ error: 'Failed to improve appeal' });
  }
});

export default router;
