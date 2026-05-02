import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { groqText, groqVision } from '../services/groq.js';

const router = Router();

function groqError(err: any, res: Response) {
  const msg = err?.message || 'AI request failed';
  if (msg.includes('GROQ_API_KEY')) {
    return res.status(503).json({ error: 'AI features unavailable — add GROQ_API_KEY to Secrets.' });
  }
  res.status(500).json({ error: msg });
}

// ─── Generate Appeal Letter ───────────────────────────────────────────────
router.post('/generate-appeal', async (req: Request, res: Response) => {
  try {
    const { case_id, violation_type, platform, account_age, previous_violations, business_type, additional_context } = req.body;

    let caseContext = '';
    if (case_id) {
      try {
        const r = await pool.query(
          `SELECT c.account_username, c.violation_type, c.violation_description,
                  o.total_gmv, o.face_videos_posted, u.plan
           FROM cases c
           LEFT JOIN onboarding_data o ON c.id = o.case_id
           LEFT JOIN users u ON c.user_discord_id = u.discord_id
           WHERE c.id = $1`, [case_id]
        );
        if (r.rows.length > 0) {
          const c = r.rows[0];
          caseContext = `TikTok account @${c.account_username || 'unknown'}, violation: ${c.violation_type}.` +
            (c.violation_description ? ` Description: ${c.violation_description}.` : '') +
            (c.total_gmv ? ` GMV: $${c.total_gmv}.` : '') +
            (c.face_videos_posted ? ` Face videos: ${c.face_videos_posted}.` : '');
        }
      } catch (dbErr) { console.warn('Could not fetch case for appeal:', dbErr); }
    }

    const context = caseContext || [
      violation_type && `Violation type: ${violation_type}`,
      platform && `Platform: ${platform}`,
      account_age && `Account age: ${account_age}`,
      previous_violations !== undefined && `Previous violations: ${previous_violations ? 'Yes' : 'No'}`,
      business_type && `Business type: ${business_type}`,
      additional_context && `Context: ${additional_context}`,
    ].filter(Boolean).join('. ');

    const draft = await groqText({
      systemPrompt: `You are an expert TikTok Shop appeal writer with a 90% win rate. Write professional, compelling appeal letters that are specific to the violation and account details. 
Structure: 1) Opening (respectful acknowledgment), 2) Account value/history, 3) Specific explanation/context, 4) Action taken/commitment, 5) Closing request.
Use formal business language. Be specific and factual. Do NOT use generic templates. Make it 300-400 words.`,
      userMessage: `Write a TikTok Shop violation appeal letter for: ${context}`,
      maxTokens: 1500,
    });
    res.json({ draft });
  } catch (err) { groqError(err, res); }
});

// ─── Case Summary ─────────────────────────────────────────────────────────
router.post('/case-summary', async (req: Request, res: Response) => {
  try {
    const { case_id, caseData } = req.body;
    let data = caseData;

    if (case_id && !data) {
      const r = await pool.query(
        `SELECT c.*, u.discord_username, u.plan,
                COUNT(m.id) as message_count,
                COUNT(e.id) as evidence_count
         FROM cases c
         JOIN users u ON c.user_discord_id = u.discord_id
         LEFT JOIN messages m ON c.id = m.case_id
         LEFT JOIN evidence e ON c.id = e.case_id
         WHERE c.id = $1 GROUP BY c.id, u.discord_username, u.plan`, [case_id]
      );
      data = r.rows[0];
    }
    if (!data) return res.status(400).json({ error: 'No case data provided' });

    const summary = await groqText({
      systemPrompt: 'You are a TikTok Shop case analyst. Provide concise, actionable case summaries for staff review. Include: current situation, key facts, recommended next action, risk level.',
      userMessage: `Summarize this TikTok violation case: ${JSON.stringify(data, null, 2)}`,
      maxTokens: 800,
    });
    res.json({ summary });
  } catch (err) { groqError(err, res); }
});

// ─── Analyze Violation ────────────────────────────────────────────────────
router.post('/analyze-violation', async (req: Request, res: Response) => {
  try {
    const { violation_type, violation_description, platform, account_history } = req.body;

    const result = await groqText({
      systemPrompt: `You are a TikTok policy expert. Analyze violations and return a JSON object with these exact keys:
{
  "severity": "Low|Medium|High|Critical",
  "severity_score": 1-10,
  "policy_section": "specific policy section name",
  "likely_outcome": "description of likely TikTok response",
  "appeal_success_rate": "percentage estimate",
  "recommended_strategy": "specific appeal strategy",
  "key_arguments": ["argument 1", "argument 2", "argument 3"],
  "evidence_needed": ["evidence type 1", "evidence type 2"],
  "timeline": "estimated resolution timeframe",
  "risk_factors": ["risk 1", "risk 2"]
}
Return ONLY valid JSON, no explanation.`,
      userMessage: `Analyze: Type: ${violation_type}. Description: ${violation_description || 'N/A'}. Platform: ${platform || 'TikTok Shop'}. ${account_history ? 'History: ' + account_history : ''}`,
      temperature: 0.3,
      maxTokens: 1000,
    });

    let analysis;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result };
    } catch { analysis = { raw: result }; }

    res.json({ analysis });
  } catch (err) { groqError(err, res); }
});

// ─── Analyze Image ────────────────────────────────────────────────────────
router.post('/analyze-image', async (req: Request, res: Response) => {
  try {
    const { base64, mimeType, image_base64, image_url, case_id } = req.body;
    const b64 = base64 || image_base64;
    const mt = mimeType || 'image/jpeg';

    if (!b64 && !image_url) {
      return res.status(400).json({ error: 'base64 (with mimeType) or image_url required' });
    }

    const imageSource = image_url || `data:${mt};base64,${b64}`;

    const result = await groqVision({
      imageUrl: imageSource,
      question: `You are a TikTok Shop policy expert analyzing a violation notice, ban screen, or account screenshot.

Analyze this image and respond with ONLY a JSON object using these exact keys:
{
  "detected": "concise description of what you see in the image",
  "severity": "Low|Medium|High|Critical",
  "policy_section": "specific TikTok policy section name (e.g. Community Guidelines §4.2, Shop Misconduct, IP Infringement)",
  "recommendation": "specific next step the creator should take",
  "appeal_likelihood": "percentage estimate (e.g. 75%) of appeal success"
}
Return ONLY valid JSON, no commentary.`,
      maxTokens: 1000,
    });

    let parsed: any = {};
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch { /* fall through */ }

    // Always return the five contract keys, defaulting to null when missing.
    const analysis = {
      detected: parsed.detected ?? parsed.detected_content ?? null,
      severity: parsed.severity ?? null,
      policy_section: parsed.policy_section ?? parsed.policy_violated ?? null,
      recommendation: parsed.recommendation ?? parsed.recommended_action ?? null,
      appeal_likelihood: parsed.appeal_likelihood ?? parsed.appeal_angle ?? null,
    };

    if (case_id && (analysis.detected || analysis.severity)) {
      try {
        await pool.query(
          `UPDATE evidence SET ai_analysis = $1
           WHERE id = (
             SELECT id FROM evidence
             WHERE case_id = $2 AND ai_analysis IS NULL
             ORDER BY uploaded_at DESC
             LIMIT 1
           )`,
          [JSON.stringify(analysis), case_id]
        );
      } catch (dbErr) { console.warn('Could not save analysis to evidence:', dbErr); }
    }

    res.json({ analysis });
  } catch (err) { groqError(err, res); }
});

// ─── Bulk Case Analyzer ───────────────────────────────────────────────────
router.post('/bulk-analyze', async (req: Request, res: Response) => {
  try {
    const casesResult = await pool.query(
      `SELECT c.id, c.account_username, c.violation_type, c.status, c.priority,
              c.created_at, c.appeal_deadline, u.plan
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       WHERE c.status IN ('pending','intake','profile_built')
       ORDER BY c.created_at ASC LIMIT 20`
    );

    if (casesResult.rows.length === 0) {
      return res.json({ rankings: [], message: 'No pending cases to analyze' });
    }

    const caseList = casesResult.rows.map((c) =>
      `Case #${c.id}: @${c.account_username || 'N/A'}, ${c.violation_type || 'unknown violation'}, status: ${c.status}, plan: ${c.plan || 'none'}, deadline: ${c.appeal_deadline ? new Date(c.appeal_deadline).toLocaleDateString() : 'none'}`
    ).join('\n');

    const result = await groqText({
      systemPrompt: 'You are a TikTok case priority analyst. Analyze pending cases and return JSON rankings.',
      userMessage: `Rank these TikTok violation cases by urgency and provide recommendations. Return a JSON array:
[{"case_id": N, "priority_rank": 1, "urgency": "Critical|High|Medium|Low", "recommended_action": "...", "estimated_hours": N, "reason": "..."}]

Cases:
${caseList}

Return ONLY a valid JSON array.`,
      temperature: 0.3,
      maxTokens: 2000,
    });

    let rankings;
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      rankings = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch { rankings = []; }

    res.json({ rankings, total_analyzed: casesResult.rows.length });
  } catch (err) { groqError(err, res); }
});

// ─── Policy Explainer ─────────────────────────────────────────────────────
router.post('/policy-explainer', async (req: Request, res: Response) => {
  try {
    const { policy_text, violation_type } = req.body;
    if (!policy_text && !violation_type) return res.status(400).json({ error: 'policy_text or violation_type required' });

    const [explanation, affectedCases] = await Promise.all([
      groqText({
        systemPrompt: 'You are a TikTok policy expert who explains complex policies in simple, clear language for content creators. Be specific and practical.',
        userMessage: policy_text
          ? `Explain this TikTok policy in simple language for a creator: "${policy_text}"\n\nProvide: 1) Plain English summary, 2) What actions trigger this policy, 3) How to avoid violations, 4) Appeal options if violated.`
          : `Explain the TikTok "${violation_type}" violation policy in simple language. Include what triggers it, consequences, and appeal options.`,
        maxTokens: 1200,
      }),
      violation_type
        ? pool.query(`SELECT COUNT(*) FROM cases WHERE violation_type ILIKE $1`, [`%${violation_type}%`])
        : Promise.resolve({ rows: [{ count: 0 }] }),
    ]);

    res.json({
      explanation,
      affected_cases: parseInt(String(affectedCases.rows[0]?.count || 0)),
    });
  } catch (err) { groqError(err, res); }
});

// ─── AI Enhance Template ──────────────────────────────────────────────────
router.post('/enhance-template', async (req: Request, res: Response) => {
  try {
    const { template_body, category } = req.body;
    if (!template_body) return res.status(400).json({ error: 'template_body required' });

    const enhanced = await groqText({
      systemPrompt: 'You are a professional TikTok appeal writing expert. Enhance templates to be more persuasive, professional, and effective while maintaining their structure and variables.',
      userMessage: `Enhance this ${category || 'appeal'} template to be more professional and persuasive. Keep all {variables} exactly as-is. Preserve the overall structure but improve the language, tone, and persuasiveness:\n\n${template_body}`,
      maxTokens: 1500,
    });
    res.json({ enhanced });
  } catch (err) { groqError(err, res); }
});

export default router;
