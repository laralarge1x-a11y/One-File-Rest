-- Elite Tok Club PostgreSQL Schema
-- Run this on every startup via migrate.ts (fully idempotent)
-- All tables use IF NOT EXISTS for safe re-runs

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  discord_username VARCHAR(100) NOT NULL,
  discord_avatar VARCHAR(200),
  email VARCHAR(200),
  portal_token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  cloudinary_public_id VARCHAR(300) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  file_type VARCHAR(50),
  file_name VARCHAR(200),
  description TEXT,
  ai_analysis TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appeal_templates (
  id SERIAL PRIMARY KEY,
  violation_type VARCHAR(100) NOT NULL,
  template_name VARCHAR(200) NOT NULL,
  template_body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  win_rate NUMERIC(5,2),
  use_count INTEGER DEFAULT 0,
  created_by VARCHAR(20) REFERENCES staff(discord_id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_alerts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,
  source_url VARCHAR(500),
  tiktok_category VARCHAR(100),
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  affects_niches TEXT[],
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(20),
  is_auto_generated BOOLEAN DEFAULT false
);

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
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Portal access records — one per client
CREATE TABLE IF NOT EXISTS portal_access (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  discord_username VARCHAR(100) NOT NULL,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('basic', 'fortnightly', 'proshield')),
  subscription_start DATE NOT NULL,
  portal_token UUID NOT NULL,
  portal_url VARCHAR(500) NOT NULL,
  update_channel_id VARCHAR(20) NOT NULL,
  webhook_id VARCHAR(20),
  webhook_url VARCHAR(500),
  webhook_token VARCHAR(200),
  access_active BOOLEAN DEFAULT true,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by VARCHAR(20),
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(20),
  revoke_reason VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track portal update notifications sent via webhook
CREATE TABLE IF NOT EXISTS portal_webhook_logs (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(20) NOT NULL,
  webhook_id VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Compliance scores cache — stores calculated scores for performance
CREATE TABLE IF NOT EXISTS compliance_scores (
  id SERIAL PRIMARY KEY,
  case_id INTEGER UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  grade VARCHAR(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  trend VARCHAR(20) CHECK (trend IN ('improving', 'stable', 'declining')),
  factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_deadline ON cases(appeal_deadline);
CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_discord_id, is_read);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_portal_access_discord ON portal_access(discord_id);
CREATE INDEX IF NOT EXISTS idx_portal_access_active ON portal_access(access_active);
CREATE INDEX IF NOT EXISTS idx_portal_webhook_logs_discord ON portal_webhook_logs(discord_id);
