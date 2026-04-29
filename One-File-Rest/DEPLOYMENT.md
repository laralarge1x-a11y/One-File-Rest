# 🚀 Elite Tok Club - Deployment Guide

## Quick Start (5 minutes)

### 1. Clone & Setup
```bash
git clone <repo-url>
cd elite-tok-club
npm install
cd client && npm install && cd ..
```

### 2. Environment Variables
Create `.env` file:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elite_tok

# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Groq AI
GROQ_API_KEY=your_groq_api_key

# Session
SESSION_SECRET=your_random_secret_key

# Server
PORT=5000
NODE_ENV=development
```

### 3. Database Setup
```bash
npm run migrate
```

### 4. Start Development
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
cd client && npm start
```

---

## 🌐 Replit Deployment

### Step 1: Create Replit Project
1. Go to https://replit.com
2. Click "Create" → "Import from GitHub"
3. Paste your repository URL
4. Click "Import"

### Step 2: Set Environment Variables
1. Click "Secrets" (lock icon)
2. Add all variables from `.env`:
   - DATABASE_URL
   - DISCORD_CLIENT_ID
   - DISCORD_CLIENT_SECRET
   - GROQ_API_KEY
   - SESSION_SECRET

### Step 3: Configure Database
```bash
# In Replit shell
npm run migrate
```

### Step 4: Deploy
```bash
npm start
```

Your app will be live at: `https://your-replit-name.replit.dev`

---

## 🐳 Docker Deployment

### Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
RUN npm run build

# Setup backend
WORKDIR /app
COPY . .

# Expose port
EXPOSE 5000

# Run migrations and start
CMD ["sh", "-c", "npm run migrate && npm start"]
```

### Build & Run
```bash
# Build image
docker build -t elite-tok-club .

# Run container
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://... \
  -e DISCORD_CLIENT_ID=... \
  -e DISCORD_CLIENT_SECRET=... \
  -e GROQ_API_KEY=... \
  -e SESSION_SECRET=... \
  elite-tok-club
```

---

## ☁️ Heroku Deployment

### Step 1: Install Heroku CLI
```bash
npm install -g heroku
heroku login
```

### Step 2: Create App
```bash
heroku create your-app-name
```

### Step 3: Add PostgreSQL
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

### Step 4: Set Environment Variables
```bash
heroku config:set DISCORD_CLIENT_ID=your_id
heroku config:set DISCORD_CLIENT_SECRET=your_secret
heroku config:set GROQ_API_KEY=your_key
heroku config:set SESSION_SECRET=your_secret
```

### Step 5: Deploy
```bash
git push heroku main
heroku run npm run migrate
```

---

## 🔧 AWS Deployment

### Using Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js-18 elite-tok-club

# Create environment
eb create production

# Set environment variables
eb setenv DATABASE_URL=... DISCORD_CLIENT_ID=... etc

# Deploy
eb deploy
```

---

## 📋 Pre-Deployment Checklist

### Security
- [ ] Change SESSION_SECRET to random value
- [ ] Use strong database password
- [ ] Enable HTTPS
- [ ] Set CORS properly
- [ ] Review security headers
- [ ] Enable rate limiting

### Database
- [ ] Run migrations
- [ ] Create backups
- [ ] Test connection
- [ ] Verify indexes
- [ ] Check permissions

### Environment
- [ ] All env variables set
- [ ] NODE_ENV=production
- [ ] API keys configured
- [ ] Discord OAuth configured
- [ ] Groq API key valid

### Frontend
- [ ] Build optimized
- [ ] Assets minified
- [ ] Images optimized
- [ ] No console errors
- [ ] Responsive design tested

### Backend
- [ ] Error handling complete
- [ ] Logging configured
- [ ] Database pooling set
- [ ] Socket.io configured
- [ ] API tested

---

## 🔍 Post-Deployment

### Verify Deployment
```bash
# Check health
curl https://your-app.com/health

# Check API
curl https://your-app.com/api/auth/me

# Check Socket.io
# Open browser console and verify connection
```

### Monitor Performance
- Set up error tracking (Sentry)
- Configure logging (LogRocket)
- Monitor database (pgAdmin)
- Track analytics (Google Analytics)

### Backup Strategy
```bash
# Daily backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Store in S3
aws s3 cp backup-*.sql s3://your-bucket/backups/
```

---

## 🔄 Continuous Deployment

### GitHub Actions
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Replit
        run: |
          curl -X POST https://replit.com/api/v1/deploy \
            -H "Authorization: Bearer ${{ secrets.REPLIT_TOKEN }}" \
            -d "repo=${{ github.repository }}"
```

---

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Verify migrations
npm run migrate
```

### Discord OAuth Not Working
- Verify CLIENT_ID and SECRET
- Check redirect URI matches
- Ensure Discord app is public
- Check browser console for errors

### Socket.io Connection Issues
- Check CORS settings
- Verify Socket.io port
- Check firewall rules
- Review browser console

### AI Features Not Working
- Verify Groq API key
- Check API rate limits
- Review error logs
- Test with curl

---

## 📊 Performance Optimization

### Frontend
```bash
# Build optimized
npm run build

# Analyze bundle
npm run analyze

# Compress assets
gzip -9 build/static/*
```

### Backend
```bash
# Enable compression
npm install compression

# Use clustering
npm install cluster

# Monitor performance
npm install clinic
```

### Database
```sql
-- Create indexes
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_messages_case_id ON messages(case_id);
CREATE INDEX idx_evidence_case_id ON evidence(case_id);

-- Analyze queries
EXPLAIN ANALYZE SELECT * FROM cases WHERE client_id = 1;
```

---

## 🔐 Security Hardening

### HTTPS
```bash
# Generate SSL certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Use in Express
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

### CORS
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

---

## 📈 Scaling

### Horizontal Scaling
```bash
# Use load balancer (nginx)
# Deploy multiple instances
# Use Redis for sessions
# Use CDN for static assets
```

### Vertical Scaling
```bash
# Increase server resources
# Optimize database queries
# Enable caching
# Use connection pooling
```

### Database Scaling
```bash
# Read replicas
# Sharding
# Partitioning
# Archiving old data
```

---

## 🆘 Support

### Getting Help
- Check logs: `npm run logs`
- Review errors: Check error tracking
- Test API: Use Postman
- Debug frontend: Browser DevTools

### Common Issues
1. **Port already in use**: `lsof -i :5000`
2. **Database locked**: Check active connections
3. **Memory leak**: Use clinic.js
4. **Slow queries**: Use EXPLAIN ANALYZE

---

## 📞 Emergency Procedures

### Database Down
```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Verify data
SELECT COUNT(*) FROM users;
```

### API Down
```bash
# Check logs
tail -f logs/error.log

# Restart service
systemctl restart elite-tok-club

# Check health
curl https://your-app.com/health
```

### Security Breach
1. Rotate all secrets
2. Review access logs
3. Update security groups
4. Notify users
5. Deploy patch

---

## 📚 Additional Resources

- [Express.js Deployment](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Production Build](https://create-react-app.dev/docs/production-build/)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)
- [Socket.io Deployment](https://socket.io/docs/v4/deployment/)

---

**Deployment Status**: ✅ READY FOR PRODUCTION

**Last Updated**: 2024
**Version**: 1.0.0
