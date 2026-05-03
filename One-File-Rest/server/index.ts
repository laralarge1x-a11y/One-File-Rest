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
import { requireAuth, requireStaff, requireAdmin, requireActiveStaff } from './auth/middleware.js';

// Routes
import authRoutes from './routes/auth.js';
import casesRoutes from './routes/cases.js';
import messagesRoutes from './routes/messages.js';
import evidenceRoutes from './routes/evidence.js';
import templatesRoutes from './routes/templates.js';
import policiesRoutes from './routes/policies.js';
import broadcastRoutes from './routes/broadcast.js';
import aiRoutes from './routes/ai.js';
import aiAskRoutes from './routes/ai-ask.js';
import analyticsRoutes from './routes/analytics.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import complianceRoutes from './routes/compliance.js';
import adminRoutes from './routes/admin.js';
import adminStageBoardRoutes from './routes/admin-stage-board.js';
import botBridgeRoutes from './routes/botbridge.js';
import notificationsRoutes from './routes/notifications.js';
import pushRoutes from './routes/push.js';
import accountsRoutes from './routes/accounts.js';
import kbRoutes from './routes/kb.js';
import checklistRoutes from './routes/checklist.js';
import exportsRoutes from './routes/exports.js';
import staffPublicRoutes from './routes/staff-public.js';
import adminQueueRoutes from './routes/admin-queue.js';
import devicesRoutes from './routes/devices.js';

// Services
import { startDeadlineMonitor } from './services/deadline-monitor.js';
import { trackConnect, trackDisconnect } from './services/presence.js';

// ─── Environment validation ────────────────────────────────────────────────
const REQUIRED_ENV: Array<{ key: string; reason: string }> = [
  { key: 'DATABASE_URL', reason: 'PostgreSQL connection' },
  { key: 'SESSION_SECRET', reason: 'session encryption' },
  { key: 'DISCORD_CLIENT_ID', reason: 'OAuth login' },
  { key: 'DISCORD_CLIENT_SECRET', reason: 'OAuth login' },
  { key: 'DISCORD_REDIRECT_URI', reason: 'OAuth callback' },
];
const OPTIONAL_ENV: Array<{ key: string; reason: string }> = [
  { key: 'GROQ_API_KEY', reason: 'AI features' },
  { key: 'ADMIN_DISCORD_IDS', reason: 'admin auto-detection will not work' },
  { key: 'BOT_BRIDGE_TOKEN', reason: 'bot bridge will reject all bot requests' },
  { key: 'DISCORD_BOT_TOKEN', reason: 'Discord bot cannot start' },
  { key: 'DISCORD_GUILD_ID', reason: 'slash commands cannot register' },
  { key: 'FIREBASE_SERVER_KEY', reason: 'native Android admin app cannot receive push notifications' },
];

console.log('\n┌─────────────────────────────────────────────────────────────┐');
console.log('│ Elite Tok Club — Startup Environment Checklist              │');
console.log('└─────────────────────────────────────────────────────────────┘');
for (const { key, reason } of REQUIRED_ENV) {
  if (process.env[key]) {
    console.log(`✅ ${key.padEnd(24)} — set`);
  } else {
    console.error(`❌ ${key.padEnd(24)} — REQUIRED for ${reason}, server cannot start`);
  }
}
for (const { key, reason } of OPTIONAL_ENV) {
  if (process.env[key]) {
    console.log(`✅ ${key.padEnd(24)} — set`);
  } else {
    console.warn(`⚠️  ${key.padEnd(24)} — NOT SET (${reason})`);
  }
}
console.log('');

const missingRequired = REQUIRED_ENV.filter(({ key }) => !process.env[key]);
if (missingRequired.length > 0) {
  console.error(`❌ Cannot start — missing required env vars: ${missingRequired.map((v) => v.key).join(', ')}`);
  process.exit(1);
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
const sessionMiddleware = session({
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
});
app.use(sessionMiddleware);

// Share session with socket.io so we can authenticate sockets from cookies
io.engine.use(sessionMiddleware);

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
const ROUTE_MOUNTS: Array<{ prefix: string; router: any }> = [];
const mount = (prefix: string, ...handlers: any[]) => {
  const router = handlers[handlers.length - 1];
  ROUTE_MOUNTS.push({ prefix, router });
  app.use(prefix, ...handlers);
};

mount('/auth', authRoutes);
mount('/bot', botBridgeRoutes);
mount('/api/cases', requireAuth, casesRoutes);
mount('/api/messages', requireAuth, messagesRoutes);
mount('/api/evidence', requireAuth, evidenceRoutes);
mount('/api/templates', requireStaff, templatesRoutes);
mount('/api/policies', policiesRoutes);
mount('/api/broadcast', requireStaff, broadcastRoutes);
mount('/api/ai', requireAuth, aiRoutes);
mount('/api/ai', requireActiveStaff, aiAskRoutes);
mount('/api/analytics', requireStaff, analyticsRoutes);
mount('/api/subscriptions', requireAuth, subscriptionsRoutes);
mount('/api/compliance', requireAuth, complianceRoutes);
mount('/api/admin', requireStaff, adminQueueRoutes);
mount('/api/admin', requireStaff, adminStageBoardRoutes);
mount('/api/admin', requireStaff, adminRoutes);
mount('/api/notifications', requireAuth, notificationsRoutes);
mount('/api/push', requireAuth, pushRoutes);
mount('/api/accounts', requireAuth, accountsRoutes);
mount('/api/kb', requireAuth, kbRoutes);
mount('/api/checklist', requireAuth, checklistRoutes);
mount('/api/exports', requireAuth, exportsRoutes);
mount('/api/staff-public', requireAuth, staffPublicRoutes);
mount('/api/devices', requireStaff, devicesRoutes);

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
// Resolve the authenticated user for a socket from its express session.
// This is the SINGLE source of truth — clients cannot supply their identity.
async function resolveSocketUser(socket: any): Promise<{ discordId: string; role: string } | null> {
  const sess = (socket.request as any)?.session;
  const passportUser = sess?.passport?.user;
  if (!passportUser) return null;
  try {
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const r = await pool.query(
      `SELECT u.discord_id, COALESCE(s.role, u.role, 'client') AS role
       FROM users u LEFT JOIN staff s ON s.discord_id = u.discord_id
       WHERE u.discord_id = $1`,
      [passportUser]
    );
    if (r.rows.length === 0) return null;
    const role = adminIds.includes(passportUser) ? 'admin' : (r.rows[0].role || 'client');
    return { discordId: r.rows[0].discord_id, role };
  } catch {
    return null;
  }
}

const STAFF_ROLES = new Set(['support', 'case_manager', 'owner', 'admin']);

io.on('connection', async (socket) => {
  const authed = await resolveSocketUser(socket);
  if (!authed) {
    // Allow the socket to live (some pages do not need auth) but deny privileged joins.
    socket.disconnect(true);
    return;
  }
  const { discordId, role } = authed;
  const isStaff = STAFF_ROLES.has(role);

  // Auto-join the user's own private room — clients NEVER pick this.
  socket.join(`user:${discordId}`);
  if (isStaff) socket.join('admin');
  trackConnect(discordId, socket.id, io);
  socket.on('disconnect', () => trackDisconnect(discordId, socket.id, io));

  // Verify the user owns/has access to a case before joining its room.
  async function canAccessCase(caseId: number): Promise<boolean> {
    if (isStaff) return true;
    try {
      const r = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      return r.rows[0]?.user_discord_id === discordId;
    } catch { return false; }
  }

  socket.on('case:join', async (data: { caseId: number } | number) => {
    const caseId = typeof data === 'object' ? data.caseId : data;
    if (!Number.isFinite(Number(caseId))) return;
    if (await canAccessCase(Number(caseId))) socket.join(`case:${caseId}`);
  });
  socket.on('case:leave', (data: { caseId: number } | number) => {
    const caseId = typeof data === 'object' ? data.caseId : data;
    socket.leave(`case:${caseId}`);
  });
  socket.on('join:case', async (caseId: number) => {
    if (!Number.isFinite(Number(caseId))) return;
    if (await canAccessCase(Number(caseId))) socket.join(`case:${caseId}`);
  });
  // join:user is deprecated and IGNORED — server auto-joins from the session.
  // Staff-only rooms are gated by role.
  socket.on('join:admin', () => { if (isStaff) socket.join('admin'); });
  socket.on('join:policy_alerts', () => { socket.join('policy_alerts'); });

  socket.on('message:send', async (data: { caseId: number; content: string }) => {
    try {
      const { caseId, content } = data || ({} as any);
      if (!content || !Number.isFinite(Number(caseId))) return;
      if (!(await canAccessCase(Number(caseId)))) return;
      const senderType = isStaff ? 'staff' : 'client';
      const result = await pool.query(
        `INSERT INTO messages (case_id, sender_discord_id, sender_type, content) VALUES ($1, $2, $3, $4) RETURNING *`,
        [caseId, discordId, senderType, content]
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

      // ─── Print all registered routes ────────────────────────────────────
      try {
        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│ Registered Routes                                           │');
        console.log('└─────────────────────────────────────────────────────────────┘');
        const collected: string[] = [];
        // Top-level direct routes (e.g. /health)
        const appRouter = (app as any).router || (app as any)._router;
        for (const layer of appRouter?.stack || []) {
          if (layer.route?.path) {
            const methods = Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase()).join(',');
            collected.push(`${methods.padEnd(10)} ${layer.route.path}`);
          }
        }
        // Mounted sub-routers with explicit prefixes
        for (const { prefix, router } of ROUTE_MOUNTS) {
          for (const layer of router?.stack || []) {
            if (layer.route?.path) {
              const methods = Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase()).join(',');
              const fullPath = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`;
              collected.push(`${methods.padEnd(10)} ${fullPath}`);
            }
          }
        }
        collected.sort().forEach((r) => console.log(`  ${r}`));
        console.log(`  Total: ${collected.length} routes\n`);
      } catch (e) {
        console.warn('[startup] Route enumeration failed:', e);
      }
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
export { app, io };
