import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import passport from 'passport';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import pool from './db/client.js';
import { setIO } from './socket-store.js';
import { discordStrategy } from './auth/discord.js';
import { requireAuth, requireStaff, requireAdmin } from './auth/middleware.js';

// Routes
import authRoutes from './routes/auth.js';
import casesRoutes from './routes/cases.js';
import messagesRoutes from './routes/messages.js';
import evidenceRoutes from './routes/evidence.js';
import templatesRoutes from './routes/templates.js';
import policiesRoutes from './routes/policies.js';
import broadcastRoutes from './routes/broadcast.js';
import aiRoutes from './routes/ai.js';
import analyticsRoutes from './routes/analytics.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import complianceRoutes from './routes/compliance.js';
import adminRoutes from './routes/admin.js';
import botBridgeRoutes from './routes/botbridge.js';

// Services
import { startDeadlineMonitor } from './services/deadline-monitor.js';

// ─── Environment validation ────────────────────────────────────────────────
const REQUIRED_ENV = ['SESSION_SECRET', 'DATABASE_URL'];
const OPTIONAL_WARN = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'GROQ_API_KEY', 'DISCORD_BOT_TOKEN', 'ADMIN_DISCORD_IDS', 'BOT_BRIDGE_TOKEN'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ MISSING REQUIRED ENV VAR: ${key} — server cannot start`);
    process.exit(1);
  }
}
for (const key of OPTIONAL_WARN) {
  if (!process.env[key]) {
    console.warn(`⚠️  Missing env var: ${key}`);
  }
}

// ─── App setup ────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', credentials: true },
});
setIO(io);

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Session ──────────────────────────────────────────────────────────────
const PgSession = pgSession(session);
app.use(
  session({
    store: new PgSession({
      pool,
      createTableIfMissing: true,
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

// ─── Passport ─────────────────────────────────────────────────────────────
if (discordStrategy) {
  passport.use(discordStrategy);
  console.log('✓ Discord OAuth strategy registered');
} else {
  console.warn('⚠️  Discord OAuth strategy not registered — login will be unavailable');
}

passport.serializeUser((user: any, done) => {
  done(null, user.discord_id);
});

passport.deserializeUser(async (discord_id: string, done) => {
  try {
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, u.role, 'client') as resolved_role
       FROM users u
       LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_id = $1`,
      [discord_id]
    );
    if (!result.rows[0]) return done(null, null);
    const user = result.rows[0];
    // Override with admin if in ADMIN_DISCORD_IDS
    if (adminIds.includes(discord_id)) {
      user.role = 'admin';
    } else {
      user.role = user.resolved_role || 'client';
    }
    done(null, user);
  } catch (err) {
    console.error('[Auth] deserializeUser error:', err);
    done(err);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/bot', botBridgeRoutes);
app.use('/api/cases', requireAuth, casesRoutes);
app.use('/api/messages', requireAuth, messagesRoutes);
app.use('/api/evidence', requireAuth, evidenceRoutes);
app.use('/api/templates', requireStaff, templatesRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/broadcast', requireStaff, broadcastRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/analytics', requireStaff, analyticsRoutes);
app.use('/api/subscriptions', requireAuth, subscriptionsRoutes);
app.use('/api/compliance', requireAuth, complianceRoutes);
app.use('/api/admin', requireStaff, adminRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    discord_oauth: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    bot_configured: !!process.env.DISCORD_BOT_TOKEN,
    timestamp: new Date().toISOString(),
  });
});

// ─── Socket.io ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = (socket.handshake.auth as any)?.userId;

  socket.on('case:join', (data: { caseId: number } | number) => {
    const caseId = typeof data === 'object' ? data.caseId : data;
    socket.join(`case:${caseId}`);
  });
  socket.on('case:leave', (data: { caseId: number } | number) => {
    const caseId = typeof data === 'object' ? data.caseId : data;
    socket.leave(`case:${caseId}`);
  });
  socket.on('join:user', (discordId: string) => { socket.join(`user:${discordId}`); });
  socket.on('join:case', (caseId: number) => { socket.join(`case:${caseId}`); });
  socket.on('join:admin', () => { socket.join('admin'); });
  socket.on('join:policy_alerts', () => { socket.join('policy_alerts'); });

  socket.on('message:send', async (data: { caseId: number; content: string }) => {
    try {
      const { caseId, content } = data;
      if (!userId || !content || !caseId) return;
      const result = await pool.query(
        `INSERT INTO messages (case_id, sender_discord_id, sender_type, content) VALUES ($1, $2, 'client', $3) RETURNING *`,
        [caseId, userId, content]
      );
      io.to(`case:${caseId}`).emit('message:new', result.rows[0]);
    } catch (err) {
      console.error('[Socket] message:send error:', err);
    }
  });
});

// ─── Static frontend (production only) ────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h' }));
  app.use((_req, res) => { res.sendFile(path.join(clientDist, 'index.html')); });
}

// ─── Global error handler ─────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED ERROR]', { method: req.method, url: req.url, message: err?.message });
  res.status(err?.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err?.message,
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────
async function start() {
  try {
    console.log('Running database migrations...');
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('✓ Database schema migrated');

    // Seed owner/admin staff rows from environment
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);
    for (const adminId of adminIds) {
      await pool.query(
        `INSERT INTO staff (discord_id, name, role, active) VALUES ($1, $2, 'owner', true)
         ON CONFLICT (discord_id) DO UPDATE SET role = 'owner', active = true`,
        [adminId.trim(), 'Admin']
      );
      await pool.query(
        `UPDATE users SET role = 'admin' WHERE discord_id = $1`,
        [adminId.trim()]
      );
    }
    // Legacy OWNER_DISCORD_IDS support
    const ownerIds = (process.env.OWNER_DISCORD_IDS || '').split(',').filter(Boolean);
    for (const ownerId of ownerIds) {
      await pool.query(
        `INSERT INTO staff (discord_id, name, role, active) VALUES ($1, $2, 'owner', true)
         ON CONFLICT (discord_id) DO NOTHING`,
        [ownerId.trim(), 'Owner']
      );
    }
    console.log('✓ Staff seeded');

    startDeadlineMonitor(io);
    console.log('✓ Deadline monitor started');

    const PORT = process.env.NODE_ENV === 'production' ? 5000 : (Number(process.env.PORT) || 3000);
    httpServer.listen(PORT, () => {
      console.log(`✓ Elite Tok Club Portal running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
export { app, io };
