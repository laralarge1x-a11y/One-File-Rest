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
4. AI-powered appeal draft generation via Groq
5. Evidence upload and analysis via Cloudinary
6. Admin dashboard with analytics and staff management
7. Policy alerts and compliance scoring
