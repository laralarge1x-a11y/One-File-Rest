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

- **Client Portal**: Case management, messaging, evidence upload
- **Admin Dashboard**: Analytics, client management, templates
- **Real-time**: Socket.io for messages and alerts
- **AI**: Groq vision for evidence, outcome prediction
- **Compliance Scoring**: Per-account metrics
- **Policy Alerts**: Real-time broadcast
- **Deadline Tracking**: Stateful monitoring
- **Discord Sync**: Bi-directional message mirroring

## Architecture

- Single Express server + Socket.io
- Separate bot-bridge process (port 3001)
- PostgreSQL as single source of truth
- Role-based access (client/staff/owner)
- WebSocket namespaces per user for isolation
