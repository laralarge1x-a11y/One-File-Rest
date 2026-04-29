import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import passport from 'passport';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';

import pool from './db/client.js';
import { discordStrategy } from './auth/discord.js';
import {
  requireAuth,
  requireStaff,
  requireCaseManager,
  requireOwner,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', credentials: true },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = pgSession(session);
app.use(
  session({
    store: new PgSession({ pool }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
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

passport.use(discordStrategy);
passport.serializeUser((user: any, done) => {
  done(null, user.discord_id);
});
passport.deserializeUser(async (discord_id: string, done) => {
  try {
    const result = await pool.query(
      `SELECT u.*, s.role FROM users u
       LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_id = $1`,
      [discord_id]
    );
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err);
  }
});

app.use(passport.initialize());
app.use(passport.session());

// Routes
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
  res.json({ status: 'ok' });
});

// Socket.io
io.on('connection', (socket) => {
  const userId = (socket.handshake.auth as any).userId;

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

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Startup
async function start() {
  try {
    // Run migrations
    console.log('Running database migrations...');
    const schema = await import('fs').then((fs) =>
      fs.promises.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf-8')
    );
    await pool.query(schema);
    console.log('✓ Database schema migrated');

    // Seed staff if needed
    const ownerIds = (process.env.OWNER_DISCORD_IDS || '').split(',').filter(Boolean);
    for (const ownerId of ownerIds) {
      await pool.query(
        `INSERT INTO staff (discord_id, name, role, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (discord_id) DO NOTHING`,
        [ownerId.trim(), 'Owner', 'owner', true]
      );
    }
    console.log('✓ Staff seeded');

    // Start deadline monitor
    startDeadlineMonitor(io);
    console.log('✓ Deadline monitor started');

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      console.log(`✓ Elite Tok Club Portal running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { app, io };
