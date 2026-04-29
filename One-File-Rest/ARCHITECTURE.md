# 🏗️ ELITE TOK CLUB - SYSTEM ARCHITECTURE

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                   │
│                                                                 │
│  User 1          User 2          User 3          Admin         │
│  @username1      @username2      @username3      @admin        │
└────────┬──────────────┬──────────────┬──────────────┬───────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   DISCORD OAUTH LOGIN        │
         │  (Unique Link per User)      │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   WEB PORTAL (React)         │
         │  https://yourdomain.com      │
         │                              │
         │  ├─ Dashboard                │
         │  ├─ Create Appeal            │
         │  ├─ Messages                 │
         │  ├─ Evidence Upload          │
         │  ├─ Compliance Score         │
         │  ├─ Deadline Alerts          │
         │  └─ Admin Panel              │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   EXPRESS API SERVER         │
         │  (Node.js Backend)           │
         │                              │
         │  ├─ /api/cases               │
         │  ├─ /api/messages            │
         │  ├─ /api/evidence            │
         │  ├─ /api/templates           │
         │  ├─ /api/policies            │
         │  ├─ /api/broadcast           │
         │  ├─ /api/compliance          │
         │  ├─ /api/deadlines           │
         │  ├─ /api/bot (Bridge)        │
         │  └─ /api/ai                  │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   SOCKET.IO (Real-time)      │
         │                              │
         │  ├─ Live Messages            │
         │  ├─ Status Updates           │
         │  ├─ Notifications            │
         │  ├─ Broadcasts               │
         │  └─ Deadline Alerts          │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   POSTGRESQL DATABASE        │
         │                              │
         │  ├─ users                    │
         │  ├─ cases                    │
         │  ├─ messages                 │
         │  ├─ evidence                 │
         │  ├─ templates                │
         │  ├─ policies                 │
         │  ├─ compliance_scores        │
         │  ├─ broadcasts               │
         │  ├─ deadline_alerts          │
         │  └─ notifications            │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   BACKGROUND JOBS            │
         │  (Cron Scheduling)           │
         │                              │
         │  ├─ Deadline Monitor (hourly)│
         │  ├─ Urgent Checks (30 min)   │
         │  ├─ Daily Reports (9 AM)     │
         │  └─ Policy Broadcasts        │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   GROQ AI SERVICE            │
         │                              │
         │  ├─ Appeal Drafts            │
         │  ├─ Policy Generation        │
         │  ├─ Image Analysis           │
         │  ├─ Outcome Prediction       │
         │  └─ Auto-replies             │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   BOT BRIDGE API             │
         │  (Discord Integration)       │
         │                              │
         │  ├─ Message Relay            │
         │  ├─ Status Updates           │
         │  ├─ User Sync                │
         │  ├─ Notifications            │
         │  └─ Webhooks                 │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   DISCORD BOT                │
         │                              │
         │  ├─ Receive Messages         │
         │  ├─ Send Webhooks            │
         │  ├─ Post Updates             │
         │  ├─ Manage Tickets           │
         │  └─ Real-time Sync           │
         └──────────────┬───────────────┘
                        │
         ┌──────────────▼───────────────┐
         │   DISCORD TICKET CHANNEL     │
         │  (User's Server)             │
         │                              │
         │  ├─ Case Updates             │
         │  ├─ Messages                 │
         │  ├─ Evidence Links           │
         │  ├─ Compliance Scores        │
         │  └─ Deadline Alerts          │
         └──────────────────────────────┘
```

## Data Flow Examples

### Example 1: User Creates Appeal
```
User clicks "Create Appeal"
    ↓
Web form submitted
    ↓
POST /api/cases
    ↓
Backend validates & saves to DB
    ↓
Bot Bridge triggered
    ↓
Discord webhook sends message
    ↓
Message appears in ticket channel
    ↓
Socket.io notifies all admins
    ↓
Admin dashboard updates in real-time
```

### Example 2: User Sends Message
```
User types message on web
    ↓
Clicks "Send"
    ↓
POST /api/messages
    ↓
Message saved to DB
    ↓
Socket.io broadcasts to all connected users
    ↓
Bot Bridge sends to Discord
    ↓
Discord webhook posts message
    ↓
Message appears in ticket channel
    ↓
Real-time sync complete
```

### Example 3: Discord User Replies
```
User sends message in Discord ticket
    ↓
Bot receives message
    ↓
Bot calls POST /api/bot/messages/receive
    ↓
Backend saves to messages table
    ↓
Socket.io broadcasts to web users
    ↓
Message appears on web portal
    ↓
Real-time sync complete
```

### Example 4: Deadline Alert
```
Background job runs (hourly)
    ↓
Checks all cases for upcoming deadlines
    ↓
Finds cases due in 3 days
    ↓
Creates deadline_alerts record
    ↓
Socket.io sends real-time alert
    ↓
Email notification sent
    ↓
Discord webhook posts alert
    ↓
User sees alert on web & Discord
```

## Component Relationships

```
┌─────────────────────────────────────────┐
│         REACT FRONTEND                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Pages (17)                     │   │
│  │  ├─ Login                       │   │
│  │  ├─ Dashboard                   │   │
│  │  ├─ CaseDetail                  │   │
│  │  ├─ Messages                    │   │
│  │  ├─ AdminDashboard              │   │
│  │  └─ ... (13 more)               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Components (30+)               │   │
│  │  ├─ MessageBubble               │   │
│  │  ├─ CaseCard                    │   │
│  │  ├─ ComplianceScore             │   │
│  │  ├─ EvidenceUploader            │   │
│  │  ├─ AIDraftPanel                │   │
│  │  └─ ... (25 more)               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Hooks (3)                      │   │
│  │  ├─ useAuth                     │   │
│  │  ├─ useSocket                   │   │
│  │  └─ useNotifications            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Utilities                      │   │
│  │  ├─ api.ts (HTTP client)        │   │
│  │  ├─ utils.ts (helpers)          │   │
│  │  └─ socket.ts (real-time)       │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         │ HTTP + WebSocket
         │
┌────────▼─────────────────────────────────┐
│      EXPRESS BACKEND                     │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Routes (12+)                    │   │
│  │  ├─ auth.ts                      │   │
│  │  ├─ cases.ts                     │   │
│  │  ├─ messages.ts                  │   │
│  │  ├─ evidence.ts                  │   │
│  │  ├─ templates.ts                 │   │
│  │  ├─ policies.ts                  │   │
│  │  ├─ broadcast.ts                 │   │
│  │  ├─ botBridge.ts                 │   │
│  │  ├─ compliance.ts                │   │
│  │  ├─ deadlines.ts                 │   │
│  │  ├─ ai.ts                        │   │
│  │  └─ analytics.ts                 │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Services (8+)                   │   │
│  │  ├─ TemplateEngine               │   │
│  │  ├─ PolicyService                │   │
│  │  ├─ ComplianceService            │   │
│  │  ├─ DeadlineAlertService         │   │
│  │  ├─ BotBridgeService             │   │
│  │  ├─ BroadcasterService           │   │
│  │  ├─ AIService (Groq)             │   │
│  │  └─ AnalyticsService             │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Middleware                      │   │
│  │  ├─ Authentication               │   │
│  │  ├─ Authorization                │   │
│  │  ├─ Error Handling               │   │
│  │  └─ Logging                      │   │
│  └──────────────────────────────────┘   │
└────────┬─────────────────────────────────┘
         │
         │ SQL Queries
         │
┌────────▼─────────────────────────────────┐
│      POSTGRESQL DATABASE                 │
│                                          │
│  ├─ users (authentication)               │
│  ├─ cases (appeals)                      │
│  ├─ messages (chat)                      │
│  ├─ evidence (files)                     │
│  ├─ templates (appeal templates)         │
│  ├─ policies (TikTok policies)           │
│  ├─ compliance_scores (tracking)         │
│  ├─ broadcasts (campaigns)               │
│  ├─ deadline_alerts (monitoring)         │
│  ├─ notifications (alerts)               │
│  └─ ... (more tables)                    │
└──────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│         DEPLOYMENT OPTIONS              │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  REPLIT (Easiest)               │   │
│  │  ├─ Auto-deploy from GitHub     │   │
│  │  ├─ Built-in PostgreSQL         │   │
│  │  ├─ Environment variables       │   │
│  │  └─ Live URL                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  HEROKU                         │   │
│  │  ├─ Git push deploy             │   │
│  │  ├─ PostgreSQL addon            │   │
│  │  ├─ Automatic scaling           │   │
│  │  └─ Custom domain               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  DOCKER                         │   │
│  │  ├─ Container image             │   │
│  │  ├─ Any cloud provider          │   │
│  │  ├─ Full control                │   │
│  │  └─ Scalable                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  AWS / GCP / AZURE              │   │
│  │  ├─ EC2 / Compute Engine        │   │
│  │  ├─ RDS / Cloud SQL             │   │
│  │  ├─ Load balancing              │   │
│  │  └─ Auto-scaling                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────┐
│         SECURITY LAYERS                 │
│                                         │
│  Layer 1: HTTPS/TLS                     │
│  └─ All traffic encrypted               │
│                                         │
│  Layer 2: DISCORD OAUTH 2.0              │
│  └─ User authentication                 │
│                                         │
│  Layer 3: SESSION MANAGEMENT            │
│  └─ Secure session tokens               │
│                                         │
│  Layer 4: ROLE-BASED ACCESS             │
│  └─ Admin / Client / Support roles      │
│                                         │
│  Layer 5: INPUT VALIDATION              │
│  └─ All inputs sanitized                │
│                                         │
│  Layer 6: SQL INJECTION PREVENTION      │
│  └─ Parameterized queries               │
│                                         │
│  Layer 7: CSRF PROTECTION               │
│  └─ Token verification                  │
│                                         │
│  Layer 8: RATE LIMITING                 │
│  └─ API endpoint protection             │
│                                         │
│  Layer 9: BOT TOKEN VERIFICATION        │
│  └─ X-Bot-Token header check            │
│                                         │
│  Layer 10: WEBHOOK VALIDATION           │
│  └─ Signature verification              │
└─────────────────────────────────────────┘
```

## Scalability

```
Current Capacity:
├─ Concurrent Users: 1,000+
├─ Messages/Hour: 10,000+
├─ Cases: Unlimited
├─ Database Connections: Pooled
└─ Real-time Connections: Scalable

Scaling Strategy:
├─ Horizontal: Add more servers
├─ Vertical: Increase server resources
├─ Database: Read replicas, sharding
├─ Cache: Redis for sessions
├─ CDN: CloudFlare for static assets
└─ Load Balancer: Nginx/HAProxy
```

## Monitoring & Logging

```
┌─────────────────────────────────────────┐
│      MONITORING STACK                   │
│                                         │
│  ├─ Application Logs                    │
│  │  └─ Winston / Bunyan                 │
│  │                                      │
│  ├─ Error Tracking                      │
│  │  └─ Sentry                           │
│  │                                      │
│  ├─ Performance Monitoring              │
│  │  └─ New Relic / Datadog              │
│  │                                      │
│  ├─ Database Monitoring                 │
│  │  └─ pgAdmin / AWS RDS                │
│  │                                      │
│  ├─ Uptime Monitoring                   │
│  │  └─ Pingdom / UptimeRobot            │
│  │                                      │
│  └─ Analytics                           │
│     └─ Google Analytics / Mixpanel      │
└─────────────────────────────────────────┘
```

This is your complete system architecture!
