# 🚀 FINAL REPLIT DEPLOYMENT GUIDE

## STEP 1: PREPARE GITHUB REPO

```bash
# Initialize git
git init
git add .
git commit -m "Elite Tok Club - Production Ready"
git branch -M main
git remote add origin https://github.com/yourusername/elite-tok-club.git
git push -u origin main
```

## STEP 2: CREATE REPLIT PROJECT

1. Go to https://replit.com
2. Click "Create" → "Import from GitHub"
3. Paste: `https://github.com/yourusername/elite-tok-club`
4. Click "Import"
5. Wait for completion

## STEP 3: ADD SECRETS (ENVIRONMENT VARIABLES)

Click "Secrets" (lock icon) and add:

```
DISCORD_CLIENT_ID=your_id
DISCORD_CLIENT_SECRET=your_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_REDIRECT_URI=https://your-replit-url.replit.dev/auth/callback
DATABASE_URL=postgresql://user:password@localhost:5432/elite_tok
GROQ_API_KEY=your_groq_key
SESSION_SECRET=random_secret_key_here
BOT_BRIDGE_TOKEN=random_bridge_token_here
NODE_ENV=production
PORT=5000
```

## STEP 4: INSTALL DEPENDENCIES

```bash
npm install
cd client && npm install && cd ..
```

## STEP 5: BUILD FRONTEND

```bash
cd client && npm run build && cd ..
```

## STEP 6: RUN MIGRATIONS

```bash
npm run migrate
```

## STEP 7: START APPLICATION

```bash
npm start
```

Your app is now live at: `https://your-replit-url.replit.dev`

---

## DISCORD BOT SETUP

### Create Application
1. https://discord.com/developers/applications
2. "New Application" → Name: "Elite Tok Club"
3. OAuth2 → General → Copy Client ID & Secret
4. Add Redirect: `https://your-replit-url.replit.dev/auth/callback`

### Create Bot
1. Bot section → "Add Bot"
2. Copy Bot Token
3. Enable: Message Content Intent, Server Members Intent
4. Permissions: 8 (Administrator)

### Create Webhook
1. Discord server → Right-click ticket channel
2. Edit → Integrations → Webhooks → New
3. Copy webhook URL
4. Add to secrets: `DISCORD_WEBHOOK_URL=...`

### Invite Bot
1. OAuth2 → URL Generator
2. Scopes: `bot`
3. Permissions: `8`
4. Copy URL → Open → Select server → Authorize

---

## TESTING

### Test 1: Login
- Go to `https://your-replit-url.replit.dev`
- Click "Login with Discord"
- Should redirect to dashboard

### Test 2: Create Case
- Click "Create New Case"
- Fill form → Submit
- Check Discord webhook message

### Test 3: Real-time Sync
- Update case status
- Check Discord - update appears
- Send message on web
- Check Discord - message appears

---

## TROUBLESHOOTING

### Database Error
```bash
service postgresql start
psql $DATABASE_URL -c "SELECT 1"
npm run migrate
```

### Discord Login Error
- Check DISCORD_CLIENT_ID
- Check DISCORD_CLIENT_SECRET
- Check redirect URI matches exactly
- Check Discord app is public

### Bot Not Working
- Check BOT_BRIDGE_TOKEN
- Check webhook URL
- Check bot has permissions
- Check bot is in server

---

## MONITORING

### View Logs
```bash
npm run dev
# Logs appear in console
```

### Check Database
```bash
psql $DATABASE_URL
SELECT * FROM users;
SELECT * FROM cases;
```

### Check Bot
- Bot should show "Online" in Discord
- Messages should appear in ticket channel

---

## LAUNCH CHECKLIST

- [ ] GitHub repo created
- [ ] Replit project imported
- [ ] Secrets added
- [ ] Dependencies installed
- [ ] Frontend built
- [ ] Migrations run
- [ ] Discord app created
- [ ] Discord bot created
- [ ] Webhook created
- [ ] Bot invited to server
- [ ] Application running
- [ ] Login tested
- [ ] Case creation tested
- [ ] Discord sync tested
- [ ] Ready to launch!

---

## SHARE WITH USERS

```
Login Link: https://your-replit-url.replit.dev/login

Users can:
✅ Login with Discord
✅ Create appeals
✅ Manage cases
✅ Send messages
✅ Upload evidence
✅ Track compliance
✅ Get AI assistance
✅ Receive alerts
```

---

**Your Elite Tok Club is live! 🚀**
