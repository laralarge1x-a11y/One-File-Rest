# Elite Tok Club Portal

A full-stack platform for managing TikTok account violation appeals, enabling creators and shop owners to track cases, communicate with support, manage evidence, and use AI for drafting appeals.

## Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite (port 5000)
- **Backend**: Node.js + Express + TypeScript (port 3000)
- **Database**: PostgreSQL (Replit built-in)
- **Real-time**: Socket.io
- **Auth**: Discord OAuth 2.0 via Passport.js
- **AI**: Groq SDK (optional — requires GROQ_API_KEY)
- **Bot Bridge**: Discord.js (optional — separate service)

## Project Structure

```
One-File-Rest/
├── bot-bridge/        # Discord bot bridge (port 3001)
├── client/            # React frontend (port 5000)
│   └── src/
│       ├── components/layout/  # Sidebar, Header, AdminSidebar
│       ├── hooks/              # useAuth, useSocket, useNotifications
│       ├── pages/              # Login, Dashboard, CaseDetail, etc.
│       └── App.tsx
├── server/            # Express backend (port 3000)
│   ├── auth/          # Discord OAuth strategy + middleware
│   ├── db/            # PostgreSQL client + schema.sql
│   ├── routes/        # REST API endpoints
│   ├── services/      # Groq AI, deadline monitoring
│   └── index.ts
└── package.json
```

## Running the App

The workflow runs both services concurrently:
```
cd One-File-Rest && npx concurrently "tsx server/index.ts" "cd client && npx vite --host 0.0.0.0 --port 5000"
```

## Required Environment Variables

To enable full functionality, set these secrets:
- `DISCORD_CLIENT_ID` — Discord app client ID
- `DISCORD_CLIENT_SECRET` — Discord app client secret
- `DISCORD_REDIRECT_URI` — OAuth callback URL (e.g. `https://your-domain/auth/callback`)
- `GROQ_API_KEY` — Groq API key for AI features
- `CLOUDINARY_URL` — Cloudinary for evidence file uploads (optional)
- `BOT_TOKEN` — Discord bot token for the bot bridge (optional)
- `OWNER_DISCORD_IDS` — Comma-separated Discord IDs to seed as owners

## Key Features

1. Discord OAuth authentication with role-based access (client, support, case_manager, owner)
2. Case management for TikTok violations with deadline tracking
3. Real-time messaging between clients and staff (mirrored to Discord)
4. AI-powered appeal draft generation via Groq (7 endpoints: generate-appeal, analyze-violation, analyze-image, bulk-analyze, case-summary, enhance-template, policy-explainer)
5. Evidence upload and analysis via Cloudinary
6. Admin dashboard with analytics and staff management
7. Policy alerts and compliance scoring

## Verification Status (last full audit)

Server boots clean with formatted ✅/⚠️ env checklist for every required & optional var, prints all 84 registered routes on startup, and gates protected endpoints (401 without auth, 302 on OAuth, 200 on /health and public /api/policies).

- **22 admin endpoints** mounted under `/api/admin/*`: stats, activity, alerts, cases (+/:id), clients (+/:id, /portal-link, /regenerate-token, /revoke, /message), notes, assign, staff (GET/POST + /:id DELETE), webhook-logs, test-webhook, export/cases, system-stats, env-status, weekly-report, policy-alerts (GET/POST/PATCH/DELETE).
- **7 AI endpoints** under `/api/ai/*`. analyze-image accepts `{ base64, mimeType }` and returns `{ analysis: { detected, severity, policy_section, recommendation, appeal_likelihood } }` — frontend Image Analyzer tab matches this exact contract.
- **10 admin pages** all use shared `AdminSidebar` via `AdminLayout` and call real APIs (no mock data).
- **Bot bridge** under `/bot/*`: users/sync, users/:id, users/by-channel/:channelId (reverse lookup), users/:id/revoke, cases (+/:id), cases/create, messages/receive, channels, health.
- **Audit log writes** in: auth (admin_login, client_login), webhook service, botbridge (plan_granted, plan_revoked, user_synced), cases (case_created, case_updated), messages (message_sent), evidence (evidence_uploaded), broadcast (broadcast_sent), admin (case_assigned, note_added, staff_added, staff_removed, access_revoked).
