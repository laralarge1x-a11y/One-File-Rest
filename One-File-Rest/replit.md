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
