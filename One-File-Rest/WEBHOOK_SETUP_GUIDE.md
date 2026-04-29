# Discord Bot Portal Integration — Complete Setup Guide

## Overview

This guide walks you through setting up the complete Discord bot ↔ Portal webhook system. The system allows Henry to:
- Generate unique portal links for clients via `/uniquelink` command
- Revoke access via `/removewebaccess` command
- View all portal access records via `/portalstatus` command
- Automatically sync portal updates to Discord via webhooks

---

## Prerequisites

- Discord bot already created and running (discord.js v14)
- Portal running on Replit or similar
- PostgreSQL database with schema migrated
- Node.js 20+

---

## Step 1: Environment Variables

Add these to your Replit Secrets or `.env` file:

```env
# Portal Configuration
PORTAL_URL=https://your-portal.replit.app
INTERNAL_API_SECRET=your-long-random-secret-string-here-min-32-chars

# Discord Bot (already exists, confirm these)
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-guild-id

# Optional: Staff role IDs for command permissions
STAFF_ROLE_IDS=roleId1,roleId2,roleId3
```

### Generating INTERNAL_API_SECRET

Run this in Node.js:
```javascript
require('crypto').randomBytes(32).toString('hex')
```

Copy the output and paste it as `INTERNAL_API_SECRET`.

---

## Step 2: Database Migration

The schema has been updated with two new tables:

```sql
-- portal_access: stores client portal access records
-- portal_webhook_logs: logs all webhook events
```

These tables are created automatically when the server starts (idempotent schema).

To verify:
```sql
SELECT * FROM portal_access;
SELECT * FROM portal_webhook_logs;
```

---

## Step 3: Register Discord Commands

Update your bot's command registration. In your bot startup code:

```typescript
import { loadCommands, registerCommands, setupCommandHandler } from './commandLoader.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });
client.commands = new Collection();

client.once('ready', async () => {
  console.log(`✓ Bot logged in as ${client.user.tag}`);
  
  // Register commands
  await registerCommands(client);
  
  // Setup command handler
  setupCommandHandler(client);
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

---

## Step 4: Portal OAuth Configuration

Ensure the Discord OAuth scope includes `email`:

**File: `server/auth/discord.ts`**

```typescript
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ['identify', 'email']  // ← Must include 'email'
}, ...));
```

---

## Step 5: Portal Frontend Routes

Add the access-revoked page to your React router:

**File: `client/src/App.tsx`**

```typescript
import AccessRevoked from './pages/AccessRevoked';

// Add this route:
<Route path="/access-revoked" element={<AccessRevoked />} />
```

---

## Step 6: Portal Access Gate Middleware

Add this middleware to protect portal pages:

**File: `client/src/hooks/useAuth.ts`** (update existing hook)

```typescript
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        const userData = await response.json();

        // Check portal access
        const accessResponse = await fetch('/internal/check-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.REACT_APP_INTERNAL_SECRET || ''
          },
          body: JSON.stringify({ discord_id: userData.discord_id })
        });

        const accessData = await accessResponse.json();

        if (!accessData.active) {
          navigate('/access-revoked');
          setIsLoading(false);
          return;
        }

        setUser(userData);
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [navigate]);

  return { user, isLoading };
}
```

---

## Step 7: Test the System

### Test 1: Generate a Portal Link

1. Go to a client's private ticket channel in Discord
2. Run: `/uniquelink @client basic 15/01/2025`
3. Bot should:
   - Create a webhook in the channel
   - Generate a unique portal URL
   - Send a beautiful embed with the link
   - Save everything to the database

### Test 2: Client Logs In

1. Client clicks the portal link
2. They're redirected to Discord OAuth login
3. After login, they see their dashboard
4. Portal logs the login event

### Test 3: Webhook Fires

1. Client submits a new case in the portal
2. A webhook message should appear in their Discord channel
3. Check `portal_webhook_logs` table to verify

### Test 4: Revoke Access

1. Run: `/removewebaccess @client`
2. Bot shows confirmation embed with buttons
3. Click "Yes, Revoke Access"
4. Bot should:
   - Revoke access in database
   - Invalidate their portal token
   - Delete the webhook
   - Send them a DM
   - Log the action

### Test 5: Access Denied

1. Client tries to visit their old portal link
2. They see the "Access Revoked" page
3. Or if they try to access any portal page, they're redirected to `/access-revoked`

---

## Step 8: Webhook Events

The system automatically sends webhook messages for these portal events:

| Event | Trigger | Message |
|---|---|---|
| **Login** | Client logs into portal | ✅ [Username] just logged in |
| **Case Created** | Client submits new case | 📋 New case: [account] — [violation] |
| **Message Sent** | Client sends message | 💬 New message on Case #[id] |
| **Evidence Uploaded** | Client uploads file | 📎 Evidence uploaded: [filename] |
| **Status Updated** | Staff updates case status | 🔄 Case #[id] status: [new_status] |
| **Deadline Set** | Appeal deadline created | ⏰ Deadline: [date] |
| **Policy Viewed** | Client reads policy alert | 👀 Policy read: [title] |

To trigger webhook events from the portal, call:

```typescript
import { sendWebhookUpdate } from '../services/discord-webhook.js';

// When client logs in
await sendWebhookUpdate({
  type: 'login',
  discordId: user.discord_id,
  data: { username: user.discord_username }
});

// When case is created
await sendWebhookUpdate({
  type: 'case_created',
  discordId: user.discord_id,
  data: {
    username: user.discord_username,
    accountUsername: case.account_username,
    violationType: case.violation_type,
    caseId: case.id
  }
});
```

---

## Step 9: Troubleshooting

### Commands not showing up in Discord

- Ensure bot has `applications.commands` scope
- Run `registerCommands()` after bot is ready
- Check that `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` are correct
- Restart the bot

### Webhook creation fails

- Bot needs `MANAGE_WEBHOOKS` permission in the channel
- Check bot role permissions in Discord server settings
- Ensure channel is a text channel (not thread or voice)

### Portal link doesn't work

- Verify `PORTAL_URL` is correct and accessible
- Check `INTERNAL_API_SECRET` matches on both bot and portal
- Ensure portal is running and `/internal/get-or-create-token` endpoint is working

### Webhook messages not appearing

- Check `portal_webhook_logs` table for errors
- Verify webhook URL is still valid (not deleted)
- Ensure client's `access_active` is `true` in database
- Check portal is calling `sendWebhookUpdate()` correctly

### Client can't log in after revocation

- This is expected! Their token was regenerated
- They should see the "Access Revoked" page
- If they need access again, run `/uniquelink` again

---

## Step 10: Monitoring

### Check Portal Access Records

```sql
SELECT discord_username, plan, access_active, granted_at, revoked_at
FROM portal_access
ORDER BY granted_at DESC;
```

### Check Webhook Logs

```sql
SELECT discord_id, event_type, success, sent_at
FROM portal_webhook_logs
WHERE sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

### Check Failed Webhooks

```sql
SELECT discord_id, event_type, error_message, sent_at
FROM portal_webhook_logs
WHERE success = false
ORDER BY sent_at DESC;
```

---

## Step 11: Production Checklist

- [ ] `INTERNAL_API_SECRET` is a long random string (32+ chars)
- [ ] `PORTAL_URL` points to production domain
- [ ] Discord bot has all required permissions
- [ ] Database tables created and indexed
- [ ] OAuth scope includes `email`
- [ ] Commands registered in Discord
- [ ] Webhook service integrated into portal
- [ ] Access gate middleware on all portal pages
- [ ] `/access-revoked` page deployed
- [ ] Error logging configured
- [ ] Tested full flow: link → login → webhook → revoke

---

## API Reference

### Internal Endpoints (Protected by `x-internal-secret`)

#### POST /internal/get-or-create-token
Creates or retrieves a user's portal token.

**Request:**
```json
{
  "discord_id": "123456789",
  "discord_username": "username#1234",
  "discord_avatar": "https://..."
}
```

**Response:**
```json
{
  "portal_token": "550e8400-e29b-41d4-a716-446655440000",
  "portal_url": "https://portal.replit.app/access/550e8400-e29b-41d4-a716-446655440000"
}
```

#### POST /internal/revoke-access
Revokes a user's portal access by regenerating their token.

**Request:**
```json
{
  "discord_id": "123456789"
}
```

**Response:**
```json
{
  "success": true
}
```

#### POST /internal/check-access
Checks if a user has active portal access.

**Request:**
```json
{
  "discord_id": "123456789"
}
```

**Response:**
```json
{
  "active": true,
  "plan": "proshield"
}
```

---

## Discord Commands Reference

### /uniquelink
Generate and send a unique portal link to a client.

**Options:**
- `user` (required): The client to send the link to
- `plan` (required): basic | fortnightly | proshield
- `start_date` (required): DD/MM/YYYY format

**Example:**
```
/uniquelink @john.doe plan:proshield start_date:15/01/2025
```

### /removewebaccess
Revoke a client's portal access.

**Options:**
- `user` (required): The client to revoke access for
- `reason` (optional): client_cancelled | expired | payment_failed | admin_removed | tos_violation

**Example:**
```
/removewebaccess @john.doe reason:expired
```

### /portalstatus
View all clients with portal access.

**Options:**
- `filter` (optional): all | active | revoked

**Example:**
```
/portalstatus filter:active
```

---

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the database logs
3. Check Discord bot permissions
4. Verify environment variables
5. Check portal server logs

---

**Last Updated:** 2025-01-15
**Version:** 1.0.0
