-- Elite Tok Club PostgreSQL Schema
-- Session table required by connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- All tables use IF NOT EXISTS for safe re-runs

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  discord_username VARCHAR(100) NOT NULL,
  discord_avatar VARCHAR(200),
  email VARCHAR(200),
  portal_token UUID UNIQUE DEFAULT gen_random_uuid(),
  role TEXT DEFAULT 'client',
  plan TEXT,
  plan_start DATE,
  plan_expiry DATE,
  discord_channel_id TEXT,
  discord_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column additions for existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_start DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expiry DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_channel_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'case_manager', 'support')),
  permissions JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id),
  plan VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  start_msg_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id),
  staff_assigned_id VARCHAR(20) REFERENCES staff(discord_id),
  discord_ticket_channel_id VARCHAR(20),
  discord_premium_channel_id VARCHAR(20),
  account_username VARCHAR(200),
  account_url VARCHAR(500),
  account_number INTEGER DEFAULT 1 CHECK (account_number BETWEEN 1 AND 4),
  violation_type VARCHAR(100),
  violation_description TEXT,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'intake', 'profile_built', 'appeal_drafted',
    'appeal_submitted', 'awaiting_tiktok', 'response_received',
    'won', 'denied', 'escalated', 'closed'
  )),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
  commission_frozen BOOLEAN DEFAULT false,
  appeal_deadline TIMESTAMPTZ,
  appeal_submitted_at TIMESTAMPTZ,
  tiktok_response_at TIMESTAMPTZ,
  outcome VARCHAR(20) CHECK (outcome IN ('won', 'denied', 'partial', 'pending', NULL)),
  outcome_notes TEXT,
  win_arguments TEXT[],
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_timeline (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL,
  stage_status VARCHAR(20) DEFAULT 'pending' CHECK (stage_status IN ('pending', 'active', 'complete', 'skipped')),
  notes TEXT,
  created_by_discord_id VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE case_timeline ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS onboarding_data (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id),
  account_purchase_date VARCHAR(100),
  shop_verification_date VARCHAR(100),
  face_videos_posted INTEGER,
  total_gmv NUMERIC(12,2),
  commission_frozen BOOLEAN DEFAULT false,
  prior_appeals JSONB DEFAULT '[]',
  violation_specific_answers JSONB DEFAULT '{}',
  raw_onboarding JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Backfill columns for upgraded deployments (table must exist first).
ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS raw_onboarding JSONB DEFAULT '{}';
ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS violation_specific_answers JSONB DEFAULT '[]';
ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS prior_appeals JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  sender_discord_id VARCHAR(20) NOT NULL,
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('client', 'staff', 'ai', 'system')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT false,
  mirrored_to_discord BOOLEAN DEFAULT false,
  discord_message_id VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by_discord_id VARCHAR(20) NOT NULL,
  cloudinary_public_id VARCHAR(300),
  file_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  file_type VARCHAR(50),
  file_name VARCHAR(200),
  description TEXT,
  ai_analysis TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE evidence ALTER COLUMN cloudinary_public_id DROP NOT NULL;
ALTER TABLE evidence ALTER COLUMN file_url TYPE TEXT;
ALTER TABLE evidence ALTER COLUMN thumbnail_url TYPE TEXT;

CREATE TABLE IF NOT EXISTS appeal_templates (
  id SERIAL PRIMARY KEY,
  violation_type VARCHAR(100),
  template_name VARCHAR(200) NOT NULL,
  template_body TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'appeal',
  tags TEXT[],
  variables JSONB DEFAULT '[]',
  win_rate NUMERIC(5,2),
  use_count INTEGER DEFAULT 0,
  created_by VARCHAR(20) REFERENCES staff(discord_id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE appeal_templates ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'appeal';
ALTER TABLE appeal_templates ADD COLUMN IF NOT EXISTS tags TEXT[];

CREATE TABLE IF NOT EXISTS policy_alerts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,
  source_url VARCHAR(500),
  tiktok_category VARCHAR(100),
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  affects_niches TEXT[],
  active BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(20),
  is_auto_generated BOOLEAN DEFAULT false
);
ALTER TABLE policy_alerts ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS policy_alert_reads (
  user_discord_id VARCHAR(20) REFERENCES users(discord_id),
  alert_id INTEGER REFERENCES policy_alerts(id),
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_discord_id, alert_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  case_id INTEGER REFERENCES cases(id),
  action_url VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Backfill action_url on existing deployments where the notifications table
-- predates this column (without it, every createNotification() insert would
-- fail with `column "action_url" does not exist` and silently drop the
-- in-app notification + socket emit).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES cases(id);

CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_discord_id VARCHAR(20) REFERENCES users(discord_id),
  referred_discord_id VARCHAR(20) REFERENCES users(discord_id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'credited')),
  credit_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_logs (
  id SERIAL PRIMARY KEY,
  sent_by VARCHAR(20) REFERENCES staff(discord_id),
  target_segment VARCHAR(100),
  subject VARCHAR(300),
  content TEXT NOT NULL,
  recipient_count INTEGER,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE broadcast_logs ADD COLUMN IF NOT EXISTS delivered_count INTEGER DEFAULT 0;
ALTER TABLE broadcast_logs ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS staff_activity_log (
  id SERIAL PRIMARY KEY,
  staff_discord_id VARCHAR(20) REFERENCES staff(discord_id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deadline_alerts_sent (
  case_id INTEGER,
  alert_type VARCHAR(20),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (case_id, alert_type)
);

CREATE TABLE IF NOT EXISTS compliance_scores (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  grade VARCHAR(1) NOT NULL,
  trend VARCHAR(20) DEFAULT 'stable',
  factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- New tables from master prompt
CREATE TABLE IF NOT EXISTS webhook_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload JSONB,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_grants (
  id SERIAL PRIMARY KEY,
  granted_by_discord_id TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_assignments (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id),
  staff_user_id INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS internal_notes (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id),
  staff_user_id INTEGER REFERENCES users(id),
  staff_discord_id VARCHAR(20),
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor_discord_id VARCHAR(20),
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_compliance_scores_case ON compliance_scores(case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_deadline ON cases(appeal_deadline);
CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_discord_id, is_read);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_discord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_recent ON audit_log(actor_discord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user ON webhook_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan) WHERE plan IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_plan_expiry ON users(plan_expiry) WHERE plan_expiry IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Task #2: Portal Power Features & Staff Command Center
-- ═══════════════════════════════════════════════════════════════════════════

-- TikTok account multi-account switcher
CREATE TABLE IF NOT EXISTS tiktok_accounts (
  id SERIAL PRIMARY KEY,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id) ON DELETE CASCADE,
  username VARCHAR(200) NOT NULL,
  account_url VARCHAR(500),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tiktok_accounts_user ON tiktok_accounts(user_discord_id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tiktok_account_id INTEGER REFERENCES tiktok_accounts(id);

-- Per-stage document checklist
CREATE TABLE IF NOT EXISTS case_checklist_items (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  label VARCHAR(300) NOT NULL,
  required BOOLEAN DEFAULT true,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(20),
  evidence_id INTEGER REFERENCES evidence(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklist_case ON case_checklist_items(case_id);

-- Snooze (column on cases)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS snooze_reason TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Task #8: Stage Board + Saved Views
-- Idempotent. We do NOT drop the existing cases.status CHECK constraint —
-- the canonical 7-stage taxonomy lives in shared/stages.ts and is mapped
-- onto the legacy status values at runtime.
-- ═══════════════════════════════════════════════════════════════════════════

-- Canonical 7-stage taxonomy projected as a generated column on cases,
-- derived from BOTH status and outcome (matches shared/stages.ts).
-- If a previous migration created `stage` without outcome handling, the
-- DO block re-creates it so the expression matches the canonical mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'cases' AND column_name = 'stage'
  ) AND NOT EXISTS (
    SELECT 1
      FROM pg_attribute a
      JOIN pg_class c     ON c.oid = a.attrelid
      JOIN pg_attrdef d   ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE c.relname = 'cases'
       AND a.attname = 'stage'
       AND pg_get_expr(d.adbin, d.adrelid) ILIKE '%outcome%'
  ) THEN
    EXECUTE 'ALTER TABLE cases DROP COLUMN stage';
  END IF;
END $$;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS stage VARCHAR(40)
  GENERATED ALWAYS AS (
    CASE
      WHEN LOWER(status) = 'won'                                       THEN 'resolved_won'
      WHEN LOWER(status) = 'closed' AND LOWER(outcome) = 'won'         THEN 'resolved_won'
      WHEN LOWER(status) = 'closed'                                    THEN 'resolved_lost'
      WHEN LOWER(status) = 'denied' AND LOWER(outcome) = 'denied'      THEN 'resolved_lost'
      WHEN LOWER(status) = 'denied'                                    THEN 'needs_retry'
      WHEN LOWER(status) = 'escalated'                                 THEN 'needs_retry'
      WHEN LOWER(status) = 'response_received'                         THEN 'tiktok_replied'
      WHEN LOWER(status) IN ('appeal_submitted','awaiting_tiktok')     THEN 'appeal_sent'
      WHEN LOWER(status) IN ('profile_built','appeal_drafted')         THEN 'appeal_drafting'
      WHEN LOWER(status) IN ('pending','intake')                       THEN 'intake'
      ELSE 'intake'
    END
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(stage);

-- Per-case stage history. Powers the audit log on the kanban board and
-- the "moved by" attribution on stage chips. One row per drag-drop or
-- programmatic stage change.
CREATE TABLE IF NOT EXISTS case_stage_history (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  from_stage VARCHAR(40),
  to_stage VARCHAR(40) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  actor_discord_id VARCHAR(20),
  source VARCHAR(20) DEFAULT 'manual',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_stage_history_case ON case_stage_history(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_stage_history_stage ON case_stage_history(to_stage, created_at DESC);

-- Saved sidebar views (filter presets). Scoped per-staffer. `query` holds
-- the JSON filter payload exactly as `/api/admin/cases` accepts it.
CREATE TABLE IF NOT EXISTS saved_views (
  id SERIAL PRIMARY KEY,
  owner_discord_id VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  scope VARCHAR(20) DEFAULT 'cases',
  query JSONB DEFAULT '{}',
  pinned BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_views_owner ON saved_views(owner_discord_id, sort_order);

-- Knowledge Base
CREATE TABLE IF NOT EXISTS kb_articles (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(200) UNIQUE NOT NULL,
  title VARCHAR(300) NOT NULL,
  category VARCHAR(100),
  body_md TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_by VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_published ON kb_articles(published);
CREATE INDEX IF NOT EXISTS idx_kb_category ON kb_articles(category);

CREATE TABLE IF NOT EXISTS kb_article_feedback (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_discord_id VARCHAR(20),
  helpful BOOLEAN NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_discord_id);

-- Specialist favorites + presence
CREATE TABLE IF NOT EXISTS specialist_favorites (
  user_discord_id VARCHAR(20) REFERENCES users(discord_id) ON DELETE CASCADE,
  staff_discord_id VARCHAR(20) REFERENCES staff(discord_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_discord_id, staff_discord_id)
);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS timezone VARCHAR(60);

-- Subscription helpers
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Task #3: Admin Android APK — FCM device tokens
-- ═══════════════════════════════════════════════════════════════════════════
-- One row per (staff user, physical device). Used by the FCM sender to push
-- to native admin apps (in addition to existing web push subscriptions).
CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_discord_id VARCHAR(20) REFERENCES users(discord_id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
  device_label TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_discord_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- Task #9: Omniscient AI Assistant ("Ask Elite")
-- ═══════════════════════════════════════════════════════════════════════════

-- Indexed mirror of Discord channel messages for retrieval & dossier building.
-- Live-maintained by the bot via messageCreate/Update/Delete; backfilled on
-- demand. Read-only from the orchestrator's perspective.
CREATE TABLE IF NOT EXISTS discord_messages (
  id BIGINT PRIMARY KEY,                    -- Discord snowflake
  channel_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20),
  author_discord_id VARCHAR(20) NOT NULL,
  author_username VARCHAR(100),
  is_bot BOOLEAN DEFAULT false,
  content TEXT,
  attachments JSONB DEFAULT '[]',
  embeds JSONB DEFAULT '[]',
  referenced_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_discord_messages_channel ON discord_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discord_messages_author ON discord_messages(author_discord_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discord_messages_content_trgm ON discord_messages USING gin (to_tsvector('english', coalesce(content, '')));

-- Conversation threads ("Ask Elite" sessions)
CREATE TABLE IF NOT EXISTS ai_threads (
  id SERIAL PRIMARY KEY,
  owner_discord_id VARCHAR(20) NOT NULL,
  title VARCHAR(200),
  surface VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (surface IN ('web', 'discord')),
  total_tokens INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT false,
  shared_with TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE ai_threads ADD COLUMN IF NOT EXISTS shared_with TEXT[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_ai_threads_owner ON ai_threads(owner_discord_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES ai_threads(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  tool_calls JSONB DEFAULT '[]',
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_thread ON ai_messages(thread_id, created_at);

-- Per-query telemetry for cost guardrails + audit
CREATE TABLE IF NOT EXISTS ai_query_log (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES ai_threads(id) ON DELETE SET NULL,
  staff_discord_id VARCHAR(20) NOT NULL,
  surface VARCHAR(20) NOT NULL,
  question TEXT NOT NULL,
  tools_called TEXT[],
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_staff ON ai_query_log(staff_discord_id, created_at DESC);
