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
import {
  requireAuth,
  requireStaff,
} from './auth/middleware.js';

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

// Services
import { startDeadlineMonitor } from './services/deadline-monitor.js';

// ─── Environment validation ────────────────────────────────────────────────
const REQUIRED_ENV = ['SESSION_SECRET', 'DATABASE_URL'];
const OPTIONAL_WARN = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ MISSING REQUIRED ENV VAR: ${key} — server cannot start`);
    process.exit(1);
  }
}
for (const key of OPTIONAL_WARN) {
  if (!process.env[key]) {
    console.warn(`⚠️  Missing optional env var: ${key} (Discord OAuth will be unavailable)`);
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

// Trust Replit's reverse proxy so secure cookies work in production
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Session ──────────────────────────────────────────────────────────────
const PgSession = pgSession(session);
app.use(
  session({
    store: new PgSession({
      pool,
      createTableIfMissing: true, // auto-create the "session" table if it doesn't exist
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
  console.log(`[Auth] Serializing user: discord_id=${user.discord_id}`);
  done(null, user.discord_id);
});

passport.deserializeUser(async (discord_id: string, done) => {
  try {
    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, 'client') as role
       FROM users u
       LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_id = $1`,
      [discord_id]
    );
    const user = result.rows[0] || null;
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    discord_oauth: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
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

  socket.on('join:user', (discordId: string) => {
    socket.join(`user:${discordId}`);
  });

  socket.on('join:case', (caseId: number) => {
    socket.join(`case:${caseId}`);
  });

  socket.on('join:admin', () => {
    socket.join('admin');
  });

  socket.on('join:policy_alerts', () => {
    socket.join('policy_alerts');
  });

  socket.on('message:send', async (data: { caseId: number; content: string; type?: string }) => {
    try {
      const { caseId, content } = data;
      if (!userId || !content || !caseId) return;
      const result = await pool.query(
        `INSERT INTO messages (case_id, sender_discord_id, sender_type, content)
         VALUES ($1, $2, 'client', $3) RETURNING *`,
        [caseId, userId, content]
      );
      io.to(`case:${caseId}`).emit('message:new', result.rows[0]);
    } catch (err) {
      console.error('[Socket] message:send error:', err);
    }
  });

  socket.on('disconnect', () => {
    // silent — avoid log spam in production
  });
});

// ─── Static frontend (production only) ────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h' }));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Global error handler (must be last) ─────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[UNHANDLED ERROR]', {
    method: req.method,
    url: req.url,
    message: err?.message,
    stack: err?.stack,
  });
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

    // Seed owner staff rows from environment
    const ownerIds = (process.env.OWNER_DISCORD_IDS || '').split(',').filter(Boolean);
    for (const ownerId of ownerIds) {
      await pool.query(
        `INSERT INTO staff (discord_id, name, role, active)
         VALUES ($1, $2, 'owner', true)
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
