import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import passport from 'passport';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import logger from './utils/logger.js';
import { specs } from './utils/swagger.js';

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
import internalRoutes from './routes/internal.js';
import { initReportsRoutes } from './routes/reports.js';
import { initComplianceRoutes } from './routes/compliance-predictions.js';
import { initAppealRoutes } from './routes/appeals.js';

// Services
import { startDeadlineMonitor } from './services/deadline-monitor.js';
import { createSocketEvents } from './services/socket-events.js';
import { setSocketEvents } from './routes/cases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', credentials: true },
});

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many AI requests, please try again later.',
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: (req.user as any)?.discord_id,
      ip: req.ip,
    });
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
      });
    }
  });
  next();
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/auth/login', authLimiter);
app.use('/api/ai', aiLimiter);

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
      maxAge: 30 * 24 * 60 * 60 * 1000,
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
app.use('/internal', internalRoutes);

// Feature 6: Reports & Exports
app.use('/api/reports', requireAuth, initReportsRoutes(pool));

// Feature 7: Compliance Predictions
app.use('/api/compliance-predictions', requireAuth, initComplianceRoutes(pool));

// Feature 8: Appeal Versioning
app.use('/api/appeals', requireAuth, initAppealRoutes(pool));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Health check failed', { error: (err as Error).message });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

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
    logger.debug('User disconnected', { socketId: socket.id });
  });
});

// Startup
async function start() {
  try {
    logger.info('Starting Elite Tok Club Portal...');

    // Initialize socket events
    const socketEvents = createSocketEvents(io);
    setSocketEvents(socketEvents);

    // Run migrations
    logger.info('Running database migrations...');
    const schema = await import('fs').then((fs) =>
      fs.promises.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf-8')
    );
    await pool.query(schema);
    logger.info('Database schema migrated');

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
    logger.info('Staff seeded');

    // Start deadline monitor
    startDeadlineMonitor(io);
    logger.info('Deadline monitor started');

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      logger.info(`Elite Tok Club Portal running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

start();

export { app, io };

