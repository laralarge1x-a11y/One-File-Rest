/**
 * Canonical case-stage taxonomy — Task #8.
 *
 * Single source of truth shared by the Express server, the React client,
 * and the Discord bot. All UI labels, kanban columns, sidebar groupings,
 * Discord embeds, and notifications must read from here so the seven
 * stages render identically everywhere.
 *
 * NOTE: do NOT introduce a parallel mapping in any other file. If you
 * need to add a stage, add it here first.
 */

export type StageId =
  | 'intake'
  | 'appeal_drafting'
  | 'appeal_sent'
  | 'tiktok_replied'
  | 'needs_retry'
  | 'resolved_won'
  | 'resolved_lost';

export interface StageMeta {
  id: StageId;
  label: string;
  short: string;
  /** Tailwind-free hex used by chips, kanban headers, and Discord embeds. */
  color: string;
  /** Glow used by GlassCard-style chips. */
  glow: string;
  description: string;
  /** Terminal stages do not advance further. */
  terminal: boolean;
}

export const STAGES: readonly StageMeta[] = [
  { id: 'intake',          label: 'Intake',           short: 'Intake',     color: '#5865F2', glow: 'rgba(88,101,242,0.30)', description: 'New case — gathering details and assigning a strategist.',         terminal: false },
  { id: 'appeal_drafting', label: 'Appeal Drafting',  short: 'Drafting',   color: '#9B6BFF', glow: 'rgba(155,107,255,0.30)', description: 'Strategist is writing the appeal.',                                terminal: false },
  { id: 'appeal_sent',     label: 'Appeal Sent',      short: 'Sent',       color: '#3BA9FF', glow: 'rgba(59,169,255,0.30)',  description: 'Appeal submitted to TikTok — awaiting response.',                  terminal: false },
  { id: 'tiktok_replied',  label: 'TikTok Replied',   short: 'Replied',    color: '#FEE75C', glow: 'rgba(254,231,92,0.30)',  description: 'TikTok responded — reviewing reply and planning next move.',       terminal: false },
  { id: 'needs_retry',     label: 'Needs Retry',      short: 'Retry',      color: '#FFA94D', glow: 'rgba(255,169,77,0.30)',  description: 'Initial attempt failed — preparing a follow-up appeal.',           terminal: false },
  { id: 'resolved_won',    label: 'Resolved — Won',   short: 'Won',        color: '#57F287', glow: 'rgba(87,242,135,0.30)',  description: 'Account or commission successfully restored.',                     terminal: true  },
  { id: 'resolved_lost',   label: 'Resolved — Lost',  short: 'Lost',       color: '#ED4245', glow: 'rgba(237,66,69,0.30)',   description: 'Appeal exhausted — no further recovery available.',                terminal: true  },
] as const;

export const STAGE_IDS: readonly StageId[] = STAGES.map((s) => s.id);

export const STAGE_BY_ID: Record<StageId, StageMeta> =
  Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, StageMeta>;

/**
 * Default mapping from legacy `cases.status` to canonical stage WITHOUT
 * the outcome signal. `denied` defaults to needs_retry (TikTok denied the
 * appeal — alternate strategy required); a terminal loss requires an
 * explicit outcome and is resolved via `statusToStage(status, outcome)`.
 */
export const STATUS_TO_STAGE: Record<string, StageId> = {
  pending:           'intake',
  intake:            'intake',
  profile_built:     'appeal_drafting',
  appeal_drafted:    'appeal_drafting',
  appeal_submitted:  'appeal_sent',
  awaiting_tiktok:   'appeal_sent',
  response_received: 'tiktok_replied',
  escalated:         'needs_retry',
  won:               'resolved_won',
  denied:            'needs_retry',
  closed:            'resolved_lost',
};

/**
 * Reverse: when a kanban card is dropped onto a stage column, which legacy
 * `cases.status` value should we persist? We pick the *entry point* status
 * for each stage so the existing CHECK constraint accepts it.
 */
export const STAGE_TO_STATUS: Record<StageId, string> = {
  intake:           'intake',
  appeal_drafting:  'appeal_drafted',
  appeal_sent:      'appeal_submitted',
  tiktok_replied:   'response_received',
  needs_retry:      'escalated',
  resolved_won:     'won',
  resolved_lost:    'denied',
};

/**
 * Canonical stage from (status, outcome). Outcome disambiguates terminal
 * losses (`denied`+outcome='denied' → resolved_lost) from a fresh denial
 * that still has retry headroom (`denied` alone → needs_retry).
 */
export function statusToStage(status?: string | null, outcome?: string | null): StageId {
  if (!status) return 'intake';
  const s = status.toLowerCase();
  const o = outcome ? outcome.toLowerCase() : null;
  if (s === 'denied' && o === 'denied') return 'resolved_lost';
  if (s === 'closed' && o === 'won')    return 'resolved_won';
  if (s === 'closed')                   return 'resolved_lost';
  return STATUS_TO_STAGE[s] || 'intake';
}

export function stageToStatus(stage: StageId): string {
  return STAGE_TO_STATUS[stage] || 'intake';
}

export function getStageMeta(stage: StageId | string | null | undefined): StageMeta {
  const id = (stage && (stage as StageId)) as StageId;
  return STAGE_BY_ID[id] || STAGE_BY_ID.intake;
}

/**
 * Reverse of STATUS_TO_STAGE: every legacy `cases.status` value that maps
 * to a given canonical stage. Used by `?stage=` filters on /api/cases and
 * by the kanban /stage-board endpoint to bucket rows. Computed once at
 * module load so callers never have to re-derive it.
 */
export const STAGE_TO_STATUSES: Record<StageId, string[]> = STAGES.reduce(
  (acc, s) => {
    acc[s.id] = Object.entries(STATUS_TO_STAGE)
      .filter(([, sid]) => sid === s.id)
      .map(([st]) => st);
    return acc;
  },
  {} as Record<StageId, string[]>
);

export function getStatusesForStage(stage: StageId): string[] {
  return STAGE_TO_STATUSES[stage] || [];
}

/** Discord-safe emoji per stage — used by webhook embeds and the bot. */
export const STAGE_EMOJI: Record<StageId, string> = {
  intake:          '📥',
  appeal_drafting: '✍️',
  appeal_sent:     '📤',
  tiktok_replied:  '📩',
  needs_retry:     '🔁',
  resolved_won:    '✅',
  resolved_lost:   '❌',
};

/** Human label for a legacy `cases.status` via canonical stage. */
export function formatStatusLabel(status: string): string {
  return getStageMeta(statusToStage(status)).label;
}

export function emojiForStatus(status: string): string {
  return STAGE_EMOJI[statusToStage(status)];
}

/** Buckets used by the customer dashboard reorg. */
export type CustomerBucket = 'active' | 'action_required' | 'resolved';

export function customerBucketFor(stage: StageId): CustomerBucket {
  if (stage === 'resolved_won' || stage === 'resolved_lost') return 'resolved';
  if (stage === 'tiktok_replied' || stage === 'needs_retry') return 'action_required';
  return 'active';
}
