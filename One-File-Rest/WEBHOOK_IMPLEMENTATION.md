# Discord Bot Portal Integration — Implementation Summary

## What Was Built

A complete Discord bot ↔ Portal webhook system with three slash commands that allow Henry to manage client portal access directly from Discord.

---

## Files Created

### 1. Database Schema Updates
**File:** `server/db/schema.sql`

Added two new tables:
- `portal_access` — Stores client portal access records with webhook info
- `portal_webhook_logs` — Logs all webhook events for debugging

Both tables are idempotent (safe to run multiple times).

### 2. Shared Constants
**File:** `shared/plans.ts`

Plan configuration used by both bot and portal:
- Basic Guard Plan ($79/month)
- Fortnightly Defense Plan ($159/2 weeks)
- ProShield Creator Plan ($259/month)

Each plan has emoji, color, features list, and billing info.

### 3. Portal Internal API
**File:** `server/routes/internal.ts`

Three protected endpoints (require `x-internal-secret` header):
- `POST /internal/get-or-create-token` — Create/retrieve user portal token
- `POST /internal/revoke-access` — Invalidate user's portal token
- `POST /internal/check-access` — Check if user has active access

### 4. Webhook Service
**File:** `server/services/discord-webhook.ts`

`sendWebhookUpdate()` function that:
- Fetches webhook URL from database
- Builds rich embeds for different event types
- Sends webhook to Discord channel
- Logs success/failure to `portal_webhook_logs` table

Supports 7 event types:
- login, case_created, message_sent, evidence_uploaded, status_updated, deadline_set, policy_viewed

### 5. Discord Bot Commands

#### `/uniquelink` Command
**File:** `bot-bridge/commands/uniquelink.ts`

Generates unique portal links for clients. Full flow:
1. Validates channel has webhook permission
2. Validates user is in guild
3. Parses subscription start date (DD/MM/YYYY)
4. Creates/retrieves webhook in channel
5. Calls portal API to get/create token
6. Saves to `portal_access` table
7. Sends beautiful embed with portal link to channel
8. Sends confirmation to Henry (ephemeral)
9. Logs action to `staff_activity_log`

#### `/removewebaccess` Command
**File:** `bot-bridge/commands/removewebaccess.ts`

Revokes portal access with confirmation flow:
1. Validates user has active access record
2. Shows confirmation embed with Confirm/Cancel buttons
3. On confirm:
   - Sets `access_active = false` in database
   - Calls portal API to invalidate token
   - Deletes webhook from Discord
   - Sends DM to client notifying them
   - Logs action to `staff_activity_log`
4. Shows success embed with details

#### `/portalstatus` Command
**File:** `bot-bridge/commands/portalstatus.ts`

Admin overview of all portal access:
- Paginated list (10 clients per page)
- Shows username, plan, status, dates, channel
- Filter options: all, active, revoked
- Previous/Next buttons for pagination
- Close button to dismiss

### 6. Command Loader
**File:** `bot-bridge/commandLoader.ts`

Utilities for Discord bot:
- `loadCommands()` — Load all command files from `commands/` directory
- `registerCommands()` — Register commands with Discord API
- `setupCommandHandler()` — Listen for command interactions

### 7. Portal Frontend
**File:** `client/src/pages/AccessRevoked.tsx`

Access revoked page shown when:
- User's portal access is revoked
- They try to access portal with invalid token
- Shows explanation and link back to Discord

### 8. Server Integration
**File:** `server/index.ts` (updated)

Added:
- Import of `internalRoutes`
- Registration of `/internal` routes

---

## How It Works

### Flow 1: Generate Portal Link

```
Henry runs /uniquelink @client basic 15/01/2025
    ↓
Bot validates channel & user
    ↓
Bot creates webhook in channel
    ↓
Bot calls POST /internal/get-or-create-token
    ↓
Portal creates/retrieves user token
    ↓
Bot saves to portal_access table with webhook info
    ↓
Bot sends embed with portal link to channel
    ↓
Client clicks link → logs in with Discord OAuth
    ↓
Portal checks access_active = true
    ↓
Client sees dashboard
```

### Flow 2: Portal Event Triggers Webhook

```
Client submits new case in portal
    ↓
Portal backend calls sendWebhookUpdate()
    ↓
Service fetches webhook URL from portal_access table
    ↓
Service builds embed for event type
    ↓
Service POSTs to webhook URL
    ↓
Message appears in client's Discord channel
    ↓
Henry sees update without checking portal
```

### Flow 3: Revoke Access

```
Henry runs /removewebaccess @client
    ↓
Bot shows confirmation embed with buttons
    ↓
Henry clicks "Yes, Revoke Access"
    ↓
Bot sets access_active = false
    ↓
Bot calls POST /internal/revoke-access
    ↓
Portal regenerates user's token (old URL becomes invalid)
    ↓
Bot deletes webhook from Discord
    ↓
Bot sends DM to client
    ↓
Bot logs action
    ↓
If client tries to visit old link → "Access Revoked" page
```

---

## Database Schema

### portal_access Table

```sql
id                    SERIAL PRIMARY KEY
discord_id            VARCHAR(20) UNIQUE NOT NULL
discord_username      VARCHAR(100) NOT NULL
plan                  VARCHAR(20) NOT NULL (basic|fortnightly|proshield)
subscription_start    DATE NOT NULL
portal_token          UUID NOT NULL
portal_url            VARCHAR(500) NOT NULL
update_channel_id     VARCHAR(20) NOT NULL
webhook_id            VARCHAR(20)
webhook_url           VARCHAR(500)
webhook_token         VARCHAR(200)
access_active         BOOLEAN DEFAULT true
granted_at            TIMESTAMPTZ DEFAULT NOW()
granted_by            VARCHAR(20)
revoked_at            TIMESTAMPTZ
revoked_by            VARCHAR(20)
revoke_reason         VARCHAR(50)
updated_at            TIMESTAMPTZ DEFAULT NOW()
```

### portal_webhook_logs Table

```sql
id                SERIAL PRIMARY KEY
discord_id        VARCHAR(20) NOT NULL
webhook_id        VARCHAR(20) NOT NULL
event_type        VARCHAR(50) NOT NULL
content           TEXT NOT NULL
sent_at           TIMESTAMPTZ DEFAULT NOW()
success           BOOLEAN DEFAULT true
error_message     TEXT
```

---

## Environment Variables Required

```env
# Portal Configuration
PORTAL_URL=https://your-portal.replit.app
INTERNAL_API_SECRET=your-long-random-secret-string-here

# Discord Bot
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-guild-id

# Optional
STAFF_ROLE_IDS=roleId1,roleId2
```

---

## Security Features

1. **Internal API Protection**
   - All `/internal/*` endpoints require `x-internal-secret` header
   - Secret is a long random string (32+ chars)
   - Never exposed to clients

2. **Token Security**
   - Portal tokens are UUIDs
   - Regenerated on revocation (old URL becomes invalid)
   - Stored in database, never in URLs

3. **Webhook Security**
   - Webhook tokens stored separately from URLs
   - Webhooks deleted when access revoked
   - Webhook logs track all sends

4. **SQL Injection Prevention**
   - All queries use parameterized statements
   - No string interpolation

5. **Access Control**
   - Commands require Administrator permission
   - Portal access checked on every page load
   - Revoked users see "Access Revoked" page

---

## Testing Checklist

- [ ] `/uniquelink` creates webhook in channel
- [ ] `/uniquelink` generates valid portal URL
- [ ] `/uniquelink` saves to `portal_access` table
- [ ] Client can click link and log in
- [ ] Portal webhook fires when client does something
- [ ] Webhook message appears in Discord channel
- [ ] `/removewebaccess` shows confirmation
- [ ] `/removewebaccess` revokes access
- [ ] Client receives DM when access revoked
- [ ] Webhook deleted from channel
- [ ] Client sees "Access Revoked" page when trying to access
- [ ] `/portalstatus` shows all clients
- [ ] `/portalstatus` pagination works
- [ ] `/portalstatus` filters work (active/revoked)

---

## Integration Points

### With Existing Bot
- Commands are loaded via `commandLoader.ts`
- No changes to existing bot functionality
- Commands are optional (can be disabled)

### With Portal Backend
- Internal API endpoints added to `server/index.ts`
- Webhook service can be called from any route
- No changes to existing portal routes

### With Portal Frontend
- Access-revoked page added
- Access gate middleware in auth hook
- No changes to existing pages

---

## Deployment Steps

1. **Update database schema** (automatic on server startup)
2. **Add environment variables** to Replit Secrets
3. **Update Discord OAuth scope** to include `email`
4. **Register commands** with Discord API
5. **Deploy bot changes** to Replit
6. **Deploy portal changes** to Replit
7. **Test full flow** in Discord

---

## Monitoring & Debugging

### Check Portal Access Records
```sql
SELECT * FROM portal_access WHERE access_active = true;
```

### Check Webhook Logs
```sql
SELECT * FROM portal_webhook_logs WHERE success = false;
```

### Check Failed Revocations
```sql
SELECT * FROM staff_activity_log WHERE action = 'portal_access_revoked';
```

### Check Command Usage
```sql
SELECT * FROM staff_activity_log WHERE action LIKE 'portal%';
```

---

## Future Enhancements

1. **Webhook Retry Logic** — Retry failed webhook sends
2. **Webhook Signature Verification** — Verify webhook authenticity
3. **Portal Activity Dashboard** — Show real-time activity in Discord
4. **Bulk Portal Access** — Grant access to multiple clients at once
5. **Portal Access Expiration** — Auto-revoke after X days
6. **Webhook Custom Messages** — Let Henry customize webhook messages
7. **Portal Analytics** — Track client portal usage
8. **Email Notifications** — Send emails when access granted/revoked

---

## Support & Troubleshooting

See `WEBHOOK_SETUP_GUIDE.md` for:
- Step-by-step setup instructions
- Troubleshooting common issues
- API reference
- Command reference
- Production checklist

---

**Implementation Date:** 2025-01-15
**Version:** 1.0.0
**Status:** Ready for deployment
