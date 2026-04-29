import { z } from 'zod';

// Common schemas
export const discordIdSchema = z.string().regex(/^\d{17,20}$/, 'Invalid Discord ID');
export const uuidSchema = z.string().uuid('Invalid UUID');
export const emailSchema = z.string().email('Invalid email address');
export const urlSchema = z.string().url('Invalid URL');

// Cases validation
export const createCaseSchema = z.object({
  accountUsername: z.string().min(1).max(200),
  violationType: z.enum([
    'content_violation',
    'copyright',
    'fraud',
    'harassment',
    'misinformation',
    'spam',
    'other'
  ]),
  violationDescription: z.string().min(10).max(5000),
  appealDeadline: z.string().datetime().optional(),
  totalGMV: z.number().min(0).optional(),
  faceVideosPosted: z.number().min(0).max(10000).optional(),
  commissionFrozen: z.boolean().optional(),
  accountPurchaseDate: z.string().optional(),
  accountNumber: z.number().min(1).max(4).optional()
});

export const updateCaseSchema = z.object({
  violationType: z.enum([
    'content_violation',
    'copyright',
    'fraud',
    'harassment',
    'misinformation',
    'spam',
    'other'
  ]).optional(),
  violationDescription: z.string().min(10).max(5000).optional(),
  status: z.enum([
    'pending',
    'intake',
    'profile_built',
    'appeal_drafted',
    'appeal_submitted',
    'awaiting_tiktok',
    'response_received',
    'won',
    'denied',
    'escalated',
    'closed'
  ]).optional(),
  priority: z.enum(['normal', 'high', 'critical']).optional(),
  appealDeadline: z.string().datetime().optional(),
  outcome: z.enum(['won', 'denied', 'partial', 'pending']).optional(),
  outcomeNotes: z.string().max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
  staffAssignedId: discordIdSchema.optional()
});

// Messages validation
export const createMessageSchema = z.object({
  caseId: z.number().int().positive(),
  content: z.string().min(1).max(5000),
  attachments: z.array(z.object({
    url: urlSchema,
    name: z.string().max(200),
    size: z.number().positive()
  })).optional()
});

// Evidence validation
export const createEvidenceSchema = z.object({
  caseId: z.number().int().positive(),
  cloudinaryPublicId: z.string().min(1).max(300),
  fileUrl: urlSchema,
  thumbnailUrl: urlSchema.optional(),
  fileType: z.string().max(50).optional(),
  fileName: z.string().max(200),
  description: z.string().max(1000).optional()
});

// Templates validation
export const createTemplateSchema = z.object({
  violationType: z.string().min(1).max(100),
  templateName: z.string().min(1).max(200),
  templateBody: z.string().min(10).max(10000),
  variables: z.array(z.string()).optional(),
  winRate: z.number().min(0).max(100).optional()
});

export const updateTemplateSchema = z.object({
  templateName: z.string().min(1).max(200).optional(),
  templateBody: z.string().min(10).max(10000).optional(),
  variables: z.array(z.string()).optional(),
  winRate: z.number().min(0).max(100).optional(),
  active: z.boolean().optional()
});

// Policies validation
export const createPolicySchema = z.object({
  title: z.string().min(1).max(300),
  summary: z.string().min(10).max(1000),
  fullContent: z.string().min(10).max(50000).optional(),
  sourceUrl: urlSchema.optional(),
  tiktokCategory: z.string().max(100).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  affectsNiches: z.array(z.string()).optional()
});

export const updatePolicySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  summary: z.string().min(10).max(1000).optional(),
  fullContent: z.string().min(10).max(50000).optional(),
  sourceUrl: urlSchema.optional(),
  tiktokCategory: z.string().max(100).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  affectsNiches: z.array(z.string()).optional()
});

// Broadcast validation
export const broadcastSchema = z.object({
  targetSegment: z.enum(['all', 'active', 'inactive', 'premium', 'basic']),
  subject: z.string().min(1).max(300),
  content: z.string().min(10).max(5000)
});

// Subscriptions validation
export const createSubscriptionSchema = z.object({
  plan: z.enum(['basic', 'fortnightly', 'proshield']),
  autoRenew: z.boolean().optional()
});

export const updateSubscriptionSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled', 'expired']).optional(),
  autoRenew: z.boolean().optional(),
  endDate: z.string().datetime().optional()
});

// AI validation
export const generateAppealSchema = z.object({
  caseId: z.number().int().positive(),
  templateId: z.number().int().positive().optional(),
  customPrompt: z.string().max(2000).optional()
});

export const analyzeEvidenceSchema = z.object({
  evidenceId: z.number().int().positive(),
  analysisType: z.enum(['content', 'context', 'relevance']).optional()
});

// Internal API validation
export const getOrCreateTokenSchema = z.object({
  discord_id: discordIdSchema,
  discord_username: z.string().min(1).max(100),
  discord_avatar: urlSchema.optional()
});

export const revokeAccessSchema = z.object({
  discord_id: discordIdSchema
});

export const checkAccessSchema = z.object({
  discord_id: discordIdSchema
});

// Compliance validation
export const complianceScoreSchema = z.object({
  caseId: z.number().int().positive()
});

// Analytics validation
export const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metric: z.enum(['cases_created', 'cases_won', 'avg_resolution_time', 'compliance_score']).optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional()
});

// Validation middleware
export function validateRequest(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.validatedBody = validated;
      next();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      res.status(400).json({ error: 'Invalid request' });
    }
  };
}

// Validation helper for params
export function validateParams(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated;
      next();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid parameters',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      res.status(400).json({ error: 'Invalid parameters' });
    }
  };
}

// Validation helper for query
export function validateQuery(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      next();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      res.status(400).json({ error: 'Invalid query parameters' });
    }
  };
}
