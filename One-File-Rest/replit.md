# Elite Tok Club — Full Portal

Production system for TikTok Shop violation recovery. Real-time sync between web portal and Discord bot.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js 20+
- **Database**: PostgreSQL (Replit Neon)
- **Real-time**: Socket.io
- **AI**: Groq API (vision + text)
- **Files**: Cloudinary
- **Auth**: Discord OAuth2
- **Hosting**: Replit (Procfile with 2 processes)

## Setup

1. Create `.env` in root:
```
DATABASE_URL=postgresql://...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
SESSION_SECRET=your-secret
GROQ_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OWNER_DISCORD_IDS=henry_id,assistant_id
```

2. Install & run:
```bash
npm install
npm run dev
```

## Key Features

- **7-Step Intake Wizard** (`pages/NewCase.tsx`): violations, purchase, prior appeals,
  verification, metrics (commission frozen captured as USD amount), plan selection
  (`basic_guard` / `fortnightly_defense` / `proshield_creator` / `choose_later`).
- **Redesigned Case Page** (`pages/CaseDetail.tsx`) with shared **`CaseTimeline`**
  reading from the `case_timeline` table.
- **Real-time Notifications** (`components/customer/NotificationBell.tsx` + toast):
  bell with unread count, populated via the `user:<discord_id>` socket room.
- **Admin Case Workspace** (`pages/admin/CaseWorkspace.tsx`): three-zone layout —
  filterable case list (status / priority / plan / unread / assigned-to-me),
  center detail (Overview / Intake / Evidence / Messages / Notes / AI / History),
  right rail with client identity + win-rate, AI insights, compliance score.
  Deep-linkable via `/admin/cases/:id`. Always-visible action bar
  (Reply / Mark Won / Resolved / Request Info / Reassign).
- **Needs-Attention Queue** (`/api/admin/needs-attention`).
- **Reusable `AISummaryPanel`** (`components/case/AISummaryPanel.tsx`).
- **AI**: Groq vision for evidence, outcome prediction.
- **Compliance Scoring**, **Policy Alerts**, **Deadline Tracking**,
  **Discord Sync** (bi-directional message mirroring).

## Power Features (Task 2)

### Staff Command Center (`/admin`)
Smart dispatcher tabs computed from a single SQL pass (`/api/admin/queue`):
- **Hot** — deadline ≤ 24h, critical priority, or unread client message.
- **Stalled** — no update for 24h+ (excluding hot).
- **In Flight** — actively progressing (`intake → response_received`).
- **My Queue** — `staff_assigned_id = me`.
- **Snoozed** — `cases.snoozed_until > NOW()` (auto-resurfaces).

Hover over any row → `/api/admin/cases/:id/preview` returns last message,
counts, and compliance score. Multi-select drives `/api/admin/cases/bulk`
(`assign | status | priority | snooze`). Snooze modal (`/api/admin/cases/:id/snooze`)
has presets (4h, tomorrow 9am, 2 days, 1 week) plus a reason.

**Keyboard shortcuts** (active in dispatcher): `j/k` navigate, `x` toggle select,
`a` assign-to-me, `s` snooze, `e`/`Enter` open case, `1-5` switch tabs, `?` help.

### Presence
`server/services/presence.ts` tracks active socket connections per discord_id and
broadcasts `presence:update {discordId, online}` to the `admin` room. Used in
`SpecialistCard` (green dot + "online") and the dispatcher's assigned column.

### Customer-facing additions
- **AccountSwitcher** (header) backed by `tiktok_accounts`. Active id stored in
  `localStorage['etc.activeAccount']`; `accounts:active-changed` event keeps
  components in sync. Hook: `client/src/lib/accounts.ts::useAccounts`.
- **ComplianceWidget** (Dashboard) reads `/api/compliance/user/:discordId`.
- **DocumentChecklist** (CaseDetail right rail). Per-stage required items
  auto-seeded by `server/routes/checklist.ts`; toggling marks `completed_at`.
  Stage gate is read-only (UI surfaces missing items; not enforced server-side).
- **Knowledge Base**: `/kb` list + search/category filter, `/kb/:slug` reader
  with thumbs-up/down feedback. Admin CRUD at `/admin/kb`. Backed by
  `kb_articles` + `kb_article_feedback`.
- **Specialists** page (`/specialists`) — cards with presence, win rate,
  resolved count, avg resolution. Favorite via `specialist_favorites`.
- **Subscription self-management** (`/subscription`) — usage meter against
  `PLAN_LIMITS` (1/3/5), pause/resume/cancel-at-period-end, plan change
  request, push toggle, account & specialist management. Backed by
  rewritten `server/routes/subscriptions.ts`.
- **PDF case export** — `/api/exports/case/:id.pdf` (pdfkit) with header,
  facts, timeline, evidence, and message log.

### PWA + Web Push
- `client/public/manifest.json` + `sw.js` (cache + push + notificationclick).
- `client/src/lib/push.ts::subscribePush()` registers, fetches VAPID public
  key from `/api/push/key`, POSTs subscription to `/api/push/subscribe`.
- `services/notifications.ts::createNotification` now also calls
  `services/push.ts::sendPushToUser` for every notification (best-effort,
  expired endpoints auto-pruned).
- VAPID env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

### New tables (`server/db/schema.sql`)
`tiktok_accounts`, `case_checklist_items`, `kb_articles`, `kb_article_feedback`,
`push_subscriptions`, `specialist_favorites`. New columns: `cases.snoozed_until`,
`cases.snooze_reason`, `cases.tiktok_account_id`; `staff.bio`, `staff.languages`,
`staff.specialties`, `staff.timezone`; `subscriptions.paused_at`,
`subscriptions.pause_reason`, `subscriptions.cancel_at_period_end`.

### New route mounts (`server/index.ts`)
`/api/admin` (queue+snooze+bulk+preview, mounted before generic admin),
`/api/push`, `/api/accounts`, `/api/kb`, `/api/checklist`, `/api/exports`,
`/api/staff-public`. All require `requireAuth`; `/api/admin/*` requires
`requireStaff`.

## Architecture

- Single Express server + Socket.io.
- Separate bot-bridge process (port 3001).
- PostgreSQL as single source of truth — schema in `server/db/schema.sql`.
  - `cases.priority` CHECK: `'normal' | 'high' | 'critical'`.
  - `case_timeline` is the **only** source for stage progression and is advanced
    by `server/services/timeline.ts::advanceCaseTimeline` from BOTH PATCH endpoints
    (`/api/cases/:id` and `/api/admin/cases/:id`) on any status change. Stages are
    monotonic: `Submitted → In Review → Appeal Drafted → Appeal Sent → Awaiting TikTok → Resolved`.
- Role-based access (client / support / case_manager / owner / admin).
- **Socket auth**: `express-session` is shared with Socket.io via
  `io.engine.use(sessionMiddleware)`. On connect, the server resolves the user
  from `socket.request.session.passport.user`, auto-joins `user:<discord_id>`
  (and `admin` if staff). `case:join` is gated by `canAccessCase`. The
  legacy client-supplied `join:user` event is **ignored** — clients cannot
  join arbitrary user rooms.

## Task #9 — Omniscient AI Assistant ("Ask Elite")

Read-only, staff-only AI assistant with full visibility into the entire portal
(cases, messages, evidence, KB, audit log, Discord transcripts, templates,
policy alerts, staff roster). Cannot mutate anything; refuses write requests
and offers deep links instead.

### Architecture
- `server/ai/types.ts` — `Source`, `ToolDef`, `ToolResult`, SSE `StreamEvent`.
- `server/ai/system-prompt.ts` — assistant persona + citation rules.
- `server/ai/tools.ts` — 15 read-only tools: `searchCases`, `getCase`,
  `searchPortalMessages`, `searchDiscord`, `getDiscordTranscript`,
  `searchClients`, `getClient`, `searchKB`, `getKBArticle`, `searchTemplates`,
  `searchAuditLog`, `getDeadlines`, `searchPolicyAlerts`, `listStaff`,
  `analyzeImage`. Every tool returns `{data, sources[]}` for citations.
- `server/ai/orchestrator.ts` — agent loop (max 6 steps), per-thread token
  cap (`AI_PER_THREAD_TOKEN_CAP`, default 120k) + per-staffer daily cap
  (`AI_PER_STAFFER_DAILY_CAP`, default 500k). Logs every query to
  `ai_query_log`.
- `server/services/groq.ts::groqTool()` — tool-calling chat completion using
  `llama-3.3-70b-versatile`.

### HTTP surface (all behind `requireStaff`)
- `POST /api/ai/ask` — SSE stream (events: thread, step, tool_result,
  sources, token, done, error).
- `GET/DELETE /api/ai/threads[/:id]` — thread CRUD.
- `GET /api/ai/dossier/:caseId` — one-shot AI brief on a case.
- `GET /api/ai/usage` — today's token spend + caps + tool count.

### Discord surface
- `/ask <question>` — slash command running the orchestrator.
- `/dossier case_id:N` — slash command for case briefs.
- `@bot <question>` — mention handler in any guild channel.
- All replies include a "Sources" embed with up to 8 deep-linked citations.
- Bot also live-indexes every guild message into `discord_messages` so the
  orchestrator can query transcripts (soft-deletes on MessageDelete).

### Tables added
- `discord_messages` — indexed mirror of guild messages (soft delete).
- `ai_threads`, `ai_messages` — chat history per staffer.
- `ai_query_log` — per-query telemetry for cost guardrails.

### Frontend
- `client/src/components/ai/AskElitePanel.tsx` — fixed-right slide-in panel,
  global Cmd/Ctrl+J hotkey, SSE consumer (fetch + ReadableStream), citation
  chips, slash-command hints (`/case`, `/client`, `/deadline`, `/policy`,
  `/dossier`), thread history.
- Mounted in every `AdminLayout` (App.tsx) so it's available on every admin
  route. Sidebar gets an "Ask Elite (⌘J)" trigger button.

### Cost guardrails
Cap defaults via env: `AI_PER_THREAD_TOKEN_CAP=120000`,
`AI_PER_STAFFER_DAILY_CAP=500000`. The orchestrator refuses with a clear
message when caps are reached.
