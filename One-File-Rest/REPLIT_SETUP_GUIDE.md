# 🚀 ELITE TOK CLUB - REPLIT SETUP GUIDE (BEST WAY)

## ✅ STEP-BY-STEP REPLIT DEPLOYMENT

### Phase 1: Prepare Your Code (5 minutes)

#### 1.1 Create GitHub Repository
```bash
# On your computer
git init
git add .
git commit -m "Initial commit: Elite Tok Club"
git branch -M main
git remote add origin https://github.com/yourusername/elite-tok-club.git
git push -u origin main
```

#### 1.2 Verify Project Structure
```
elite-tok-club/
├── server/
│   ├── index.ts (main server)
│   ├── routes/ (all API routes)
│   ├── services/ (business logic)
│   ├── auth/ (Discord OAuth)
│   ├── db/ (database)
│   └── socket/ (real-time)
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
├── package.json (root)
├── tsconfig.json
├── .env.example
└── .replit
```

---

### Phase 2: Replit Setup (10 minutes)

#### 2.1 Create Replit Project
1. Go to https://replit.com
2. Click "Create" → "Import from GitHub"
3. Paste: `https://github.com/yourusername/elite-tok-club`
4. Click "Import"
5. Wait for import to complete

#### 2.2 Configure .replit File
```toml
run = "npm run dev"
entrypoint = "server/index.ts"

[env]
NODE_ENV = "production"

[nix]
channel = "unstable"

[[ports]]
localPort = 5000
externalPort = 443
```

#### 2.3 Add Secrets (Environment Variables)
Click "Secrets" (lock icon) and add:

```
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_REDIRECT_URI=https://your-replit-url.replit.dev/auth/callback
DATABASE_URL=postgresql://user:password@localhost:5432/elite_tok
GROQ_API_KEY=your_groq_api_key
SESSION_SECRET=generate_random_secret_here
BOT_BRIDGE_TOKEN=generate_random_token_here
NODE_ENV=production
PORT=5000
```

#### 2.4 Get Replit URL
- Your app URL: `https://your-replit-name.replit.dev`
- Update `DISCORD_REDIRECT_URI` with this URL

---

### Phase 3: Database Setup (5 minutes)

#### 3.1 Create PostgreSQL Database
In Replit shell:
```bash
# Install PostgreSQL
apt-get update
apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL
service postgresql start

# Create database
sudo -u postgres createdb elite_tok

# Create user
sudo -u postgres createuser elite_user
sudo -u postgres psql -c "ALTER USER elite_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE elite_tok TO elite_user;"
```

#### 3.2 Update DATABASE_URL
```
postgresql://elite_user:your_password@localhost:5432/elite_tok
```

#### 3.3 Run Migrations
```bash
npm run migrate
```

---

### Phase 4: Discord Bot Setup (10 minutes)

#### 4.1 Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name: "Elite Tok Club"
4. Go to "OAuth2" → "General"
5. Copy Client ID and Client Secret
6. Add Redirect URI: `https://your-replit-url.replit.dev/auth/callback`

#### 4.2 Create Discord Bot
1. Go to "Bot" section
2. Click "Add Bot"
3. Copy Bot Token
4. Enable these intents:
   - Message Content Intent
   - Server Members Intent
   - Guilds Intent
5. Add permissions: 8 (Administrator)

#### 4.3 Create Webhook
1. Go to your Discord server
2. Right-click ticket channel
3. "Edit Channel" → "Integrations" → "Webhooks"
4. "New Webhook"
5. Copy webhook URL
6. Add to environment: `DISCORD_WEBHOOK_URL=...`

#### 4.4 Invite Bot to Server
1. Go to OAuth2 → URL Generator
2. Select scopes: `bot`
3. Select permissions: `8` (Administrator)
4. Copy generated URL
5. Open in browser
6. Select your server
7. Authorize

---

### Phase 5: Install Dependencies (5 minutes)

#### 5.1 Root Dependencies
```bash
npm install
```

#### 5.2 Client Dependencies
```bash
cd client
npm install
cd ..
```

#### 5.3 Build Frontend
```bash
cd client
npm run build
cd ..
```

---

### Phase 6: Start Application (2 minutes)

#### 6.1 Run Development Server
```bash
npm run dev
```

#### 6.2 Verify It's Running
- Backend: http://localhost:5000
- Frontend: http://localhost:3000
- Check console for errors

#### 6.3 Test Login
1. Go to `https://your-replit-url.replit.dev`
2. Click "Login with Discord"
3. Authorize
4. Should redirect to dashboard

---

### Phase 7: Deploy to Production (2 minutes)

#### 7.1 Click "Run"
- Replit automatically deploys
- Your app is now live!

#### 7.2 Get Public URL
- Your app: `https://your-replit-name.replit.dev`
- Share this with users

#### 7.3 Monitor Logs
- Check console for errors
- Monitor database
- Check Discord bot status

---

## 🔧 ADVANCED REPLIT CONFIGURATION

### .replit File (Complete)
```toml
run = "npm run dev"
entrypoint = "server/index.ts"

[env]
NODE_ENV = "production"
PORT = "5000"

[nix]
channel = "unstable"

[[ports]]
localPort = 5000
externalPort = 443

[packager]
language = "nodejs"
ignoredPaths = ["node_modules"]

[languages.typescript]
pattern = "**/*.ts"

[unitTest]
language = "nodejs"
```

### package.json Scripts
```json
{
  "scripts": {
    "dev": "concurrently \"npm run server:dev\" \"npm run client:dev\"",
    "server:dev": "ts-node server/index.ts",
    "client:dev": "cd client && npm start",
    "build": "cd client && npm run build",
    "start": "node dist/server/index.js",
    "migrate": "ts-node server/db/migrate.ts",
    "test": "jest",
    "lint": "eslint ."
  }
}
```

### Environment Variables (Complete List)
```env
# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://your-replit-url.replit.dev/auth/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_WEBHOOK_URL=your_webhook_url
BOT_BRIDGE_TOKEN=random_secret_token

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elite_tok
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=30000

# AI
GROQ_API_KEY=your_groq_api_key

# Session
SESSION_SECRET=random_secret_key
SESSION_TIMEOUT=86400000

# Server
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# Features
ENABLE_AI=true
ENABLE_DISCORD_SYNC=true
ENABLE_BACKGROUND_JOBS=true
```

---

## 🐛 TROUBLESHOOTING

### Issue: Database Connection Error
```bash
# Check PostgreSQL is running
service postgresql status

# Start if not running
service postgresql start

# Check connection
psql $DATABASE_URL
```

### Issue: Discord Login Not Working
```
1. Check DISCORD_CLIENT_ID is correct
2. Check DISCORD_CLIENT_SECRET is correct
3. Check DISCORD_REDIRECT_URI matches exactly
4. Check Discord app is public
5. Check browser console for errors
```

### Issue: Bot Not Sending Messages
```
1. Check DISCORD_BOT_TOKEN is correct
2. Check bot is in server
3. Check bot has permissions
4. Check webhook URL is valid
5. Check error logs
```

### Issue: Real-time Not Working
```
1. Check Socket.io is connected
2. Check CORS is configured
3. Check firewall allows WebSocket
4. Check browser console
5. Restart application
```

### Issue: AI Features Not Working
```
1. Check GROQ_API_KEY is correct
2. Check API rate limits
3. Check error logs
4. Test with curl:
   curl -X POST https://api.groq.com/openai/v1/chat/completions \
     -H "Authorization: Bearer $GROQ_API_KEY"
```

---

## 📊 MONITORING IN REPLIT

### View Logs
```bash
# In Replit console
npm run dev
# Logs appear in real-time
```

### Monitor Database
```bash
# Connect to database
psql $DATABASE_URL

# Check tables
\dt

# Check users
SELECT * FROM users;

# Check cases
SELECT * FROM cases;
```

### Monitor Bot
```bash
# Check bot is online
# In Discord, bot should show "Online" status

# Check webhook is working
# Messages should appear in ticket channel

# Check API is responding
curl https://your-replit-url.replit.dev/api/health
```

---

## 🚀 LAUNCH CHECKLIST

- [ ] GitHub repo created
- [ ] Replit project imported
- [ ] Secrets added
- [ ] Database created
- [ ] Migrations run
- [ ] Discord app created
- [ ] Discord bot created
- [ ] Webhook created
- [ ] Bot invited to server
- [ ] Dependencies installed
- [ ] Frontend built
- [ ] Application running
- [ ] Login tested
- [ ] Case creation tested
- [ ] Discord sync tested
- [ ] Real-time tested
- [ ] AI features tested
- [ ] Admin dashboard tested
- [ ] Monitoring set up
- [ ] Ready to launch!

---

## 🎉 LAUNCH

1. Click "Run" in Replit
2. Get your public URL
3. Share with users: `https://your-replit-url.replit.dev/login`
4. Users can now:
   - Login with Discord
   - Create appeals
   - Manage cases
   - Send messages
   - Upload evidence
   - Track compliance
   - Get AI assistance
   - Receive alerts

---

## 📞 SUPPORT

### Common Commands
```bash
# View logs
npm run dev

# Run migrations
npm run migrate

# Check database
psql $DATABASE_URL

# Restart application
# Click "Stop" then "Run" in Replit
```

### Important URLs
- **App**: https://your-replit-url.replit.dev
- **Login**: https://your-replit-url.replit.dev/login
- **Admin**: https://your-replit-url.replit.dev/admin
- **API**: https://your-replit-url.replit.dev/api

---

**Your Elite Tok Club is ready to launch on Replit! 🚀**
