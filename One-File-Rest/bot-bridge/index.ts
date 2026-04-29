import express from 'express';

const app = express();
app.use(express.json());

// Internal API for Discord bot bridge
// This runs on port 3001 and communicates with the main server

app.post('/bot/mirror-message', (req, res) => {
  const { channel_id, sender_name, content, attachments } = req.body;
  // TODO: Implement Discord message mirroring
  res.json({ success: true });
});

app.post('/bot/dm', (req, res) => {
  const { discord_id, content } = req.body;
  // TODO: Implement Discord DM sending
  res.json({ success: true });
});

app.post('/bot/create-channel', (req, res) => {
  const { guild_id, client_discord_id, case_id, account_username } = req.body;
  // TODO: Implement Discord channel creation
  res.json({ channel_id: 'mock-channel-id' });
});

app.post('/bot/status-update', (req, res) => {
  const { channel_id, case_id, new_status, message } = req.body;
  // TODO: Implement Discord status update
  res.json({ success: true });
});

app.post('/bot/broadcast-dms', (req, res) => {
  const { discord_ids, content } = req.body;
  // TODO: Implement Discord broadcast DMs
  res.json({ sent: discord_ids.length });
});

const PORT = process.env.BOT_BRIDGE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Bot bridge running on port ${PORT}`);
});
