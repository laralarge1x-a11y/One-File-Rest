import express, { Request, Response, NextFunction } from 'express';

const app = express();
app.use(express.json());

function requireBridgeToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.BOT_BRIDGE_TOKEN;
  if (!expected) {
    res.status(503).json({ error: 'BOT_BRIDGE_TOKEN not configured' });
    return;
  }
  const header = req.header('authorization') || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (presented !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

app.get('/bot/health', requireBridgeToken, (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'bot-bridge', timestamp: new Date().toISOString() });
});

// Internal API for Discord bot bridge
// This runs on port 3001 and communicates with the main server

app.post('/bot/mirror-message', (_req: Request, res: Response) => {
  // TODO: Implement Discord message mirroring
  res.json({ success: true });
});

app.post('/bot/dm', (_req: Request, res: Response) => {
  // TODO: Implement Discord DM sending
  res.json({ success: true });
});

app.post('/bot/create-channel', (_req: Request, res: Response) => {
  // TODO: Implement Discord channel creation
  res.json({ channel_id: 'mock-channel-id' });
});

app.post('/bot/status-update', (_req: Request, res: Response) => {
  // TODO: Implement Discord status update
  res.json({ success: true });
});

app.post('/bot/broadcast-dms', (req: Request, res: Response) => {
  const { discord_ids } = req.body || {};
  // TODO: Implement Discord broadcast DMs
  res.json({ sent: Array.isArray(discord_ids) ? discord_ids.length : 0 });
});

const PORT = process.env.BOT_BRIDGE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Bot bridge running on port ${PORT}`);
});
