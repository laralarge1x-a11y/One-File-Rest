/**
 * Shared zod schemas — server validates against these in
 * `validate(...)` middleware; the client may use them for form-side
 * checks. Stage / status / role enums live next to the canonical
 * stage taxonomy in `stages.ts`.
 */
import { z } from 'zod';
import { STAGE_IDS } from './stages.js';

// ─── Enums ────────────────────────────────────────────────────────────────
export const StageEnum = z.enum(STAGE_IDS as unknown as [string, ...string[]]);

export const CaseStatusEnum = z.enum([
  'pending',
  'intake',
  'profile_built',
  'appeal_drafted',
  'appeal_submitted',
  'awaiting_tiktok',
  'response_received',
  'escalated',
  'won',
  'denied',
  'closed',
]);

export const CasePriorityEnum = z.enum(['low', 'normal', 'high', 'critical']);

export const CaseOutcomeEnum = z.enum(['won', 'denied', 'pending']);

export const StaffRoleEnum = z.enum(['support', 'case_manager', 'owner', 'admin']);
export const UserRoleEnum = z.enum(['client', 'support', 'case_manager', 'owner', 'admin']);
export const PolicyAlertSeverityEnum = z.enum(['info', 'warning', 'critical']);

// camelCase aliases for ergonomic imports
export const stageEnum = StageEnum;
export const caseStatusEnum = CaseStatusEnum;
export const casePriorityEnum = CasePriorityEnum;
export const caseOutcomeEnum = CaseOutcomeEnum;
export const staffRoleEnum = StaffRoleEnum;
export const userRoleEnum = UserRoleEnum;
export const policyAlertSeverityEnum = PolicyAlertSeverityEnum;

// ─── Helpers ──────────────────────────────────────────────────────────────
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}).strict();

export const isoDateString = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid ISO date');

export const discordIdSchema = z.string().regex(/^\d{17,20}$/, 'Invalid Discord id');

// Strict "no input" schemas for endpoints that accept neither a body nor
// query string. Used by the validate() middleware to reject extraneous
// fields rather than silently accepting them.
export const emptyBodySchema = z.object({}).strict();
export const emptyQuerySchema = z.object({}).strict();
export const emptyParamsSchema = z.object({}).strict();

export const caseIdParamSchema = z.object({ caseId: z.coerce.number().int().positive() }).strict();
export const slugParamSchema = z.object({ slug: z.string().min(1).max(200) }).strict();

// SSRF guard for any persisted Discord webhook URL. Anywhere we *store*
// (or later fetch) a webhook URL, we require https + the canonical
// Discord webhook host + the /api/webhooks/* path. This blocks attempts
// to point a stored webhook at internal/loopback hosts which the server
// would later POST to from inside the network.
const ALLOWED_WEBHOOK_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'canary.discord.com',
  'ptb.discord.com',
]);
export const discordWebhookUrlSchema = z
  .string()
  .url()
  .max(500)
  .refine((raw) => {
    let u: URL;
    try { u = new URL(raw); } catch { return false; }
    if (u.protocol !== 'https:') return false;
    if (!ALLOWED_WEBHOOK_HOSTS.has(u.hostname.toLowerCase())) return false;
    if (!u.pathname.startsWith('/api/webhooks/')) return false;
    return true;
  }, 'webhook URL must be an https://discord.com/api/webhooks/... URL');

