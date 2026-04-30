import express, { Request, Response } from 'express';
import { Client, EmbedBuilder, ChannelType, PermissionFlagsBits, TextChannel, DMChannel } from 'discord.js';

const app = express();
app.use(express.json());

let discordClient: Client | null = null;

// Initialize Discord client
export function initializeDiscordClient(client: Client) {
  discordClient = client;
  console.log('✓ Discord client initialized for bot bridge');
}

// Helper to ensure client is ready
const ensureClient = (res: Response) => {
  if (!discordClient || !discordClient.isReady()) {
    res.status(503).json({ error: 'Discord client not ready' });
    return false;
  }
  return true;
};

/**
 * POST /bot/mirror-message
 * Mirrors a message from portal to Discord channel
 */
app.post('/bot/mirror-message', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { channel_id, sender_name, content, attachments } = req.body;

    if (!channel_id || !sender_name || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const channel = await discordClient!.channels.fetch(channel_id);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found or not text-based' });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: sender_name })
      .setDescription(content)
      .setColor('#5865F2')
      .setTimestamp();

    if (attachments && attachments.length > 0) {
      embed.addFields({
        name: 'Attachments',
        value: attachments.map((a: any) => `[${a.name}](${a.url})`).join('\n'),
        inline: false
      });
    }

    const message = await channel.send({ embeds: [embed] });
    res.json({ success: true, message_id: message.id });
  } catch (err: any) {
    console.error('Error mirroring message:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/dm
 * Sends a direct message to a Discord user
 */
app.post('/bot/dm', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { discord_id, content, embed_data } = req.body;

    if (!discord_id || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await discordClient!.users.fetch(discord_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dmChannel = await user.createDM();
    let messageContent: any = { content };

    if (embed_data) {
      const embed = new EmbedBuilder()
        .setTitle(embed_data.title || 'Notification')
        .setDescription(embed_data.description || content)
        .setColor(embed_data.color || '#5865F2');

      if (embed_data.fields) {
        embed.addFields(embed_data.fields);
      }

      messageContent = { embeds: [embed] };
    }

    const message = await dmChannel.send(messageContent);
    res.json({ success: true, message_id: message.id });
  } catch (err: any) {
    console.error('Error sending DM:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/create-channel
 * Creates a new private channel for a case
 */
app.post('/bot/create-channel', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { guild_id, client_discord_id, case_id, account_username } = req.body;

    if (!guild_id || !client_discord_id || !case_id || !account_username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const guild = await discordClient!.guilds.fetch(guild_id);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const channelName = `case-${case_id}-${account_username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildPrivateThread,
      topic: `Case #${case_id} - ${account_username}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: client_discord_id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ]
    });

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`Case #${case_id}`)
      .setDescription(`Account: ${account_username}`)
      .setColor('#5865F2')
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });

    res.json({ success: true, channel_id: channel.id });
  } catch (err: any) {
    console.error('Error creating channel:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/status-update
 * Posts a status update to a case channel
 */
app.post('/bot/status-update', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { channel_id, case_id, new_status, message, updated_by } = req.body;

    if (!channel_id || !case_id || !new_status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const channel = await discordClient!.channels.fetch(channel_id);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found or not text-based' });
    }

    const statusColors: { [key: string]: string } = {
      pending: '#FFA500',
      intake: '#3498DB',
      profile_built: '#9B59B6',
      appeal_drafted: '#E74C3C',
      appeal_submitted: '#E67E22',
      awaiting_tiktok: '#F39C12',
      response_received: '#16A085',
      won: '#27AE60',
      denied: '#C0392B',
      escalated: '#8E44AD',
      closed: '#95A5A6'
    };

    const embed = new EmbedBuilder()
      .setTitle(`Case #${case_id} Status Update`)
      .setDescription(message || `Status changed to: **${new_status}**`)
      .setColor(statusColors[new_status] || '#5865F2')
      .addFields({
        name: 'New Status',
        value: new_status.replace(/_/g, ' ').toUpperCase(),
        inline: true
      });

    if (updated_by) {
      embed.addFields({
        name: 'Updated By',
        value: updated_by,
        inline: true
      });
    }

    embed.setTimestamp();

    const sentMessage = await channel.send({ embeds: [embed] });
    res.json({ success: true, message_id: sentMessage.id });
  } catch (err: any) {
    console.error('Error posting status update:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/broadcast-dms
 * Sends DMs to multiple users
 */
app.post('/bot/broadcast-dms', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { discord_ids, content, embed_data, title } = req.body;

    if (!discord_ids || !Array.isArray(discord_ids) || discord_ids.length === 0) {
      return res.status(400).json({ error: 'Invalid discord_ids array' });
    }

    if (!content && !embed_data) {
      return res.status(400).json({ error: 'Missing content or embed_data' });
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (const discord_id of discord_ids) {
      try {
        const user = await discordClient!.users.fetch(discord_id);
        const dmChannel = await user.createDM();

        let messageContent: any = { content };

        if (embed_data) {
          const embed = new EmbedBuilder()
            .setTitle(title || embed_data.title || 'Broadcast')
            .setDescription(embed_data.description || content)
            .setColor(embed_data.color || '#5865F2');

          if (embed_data.fields) {
            embed.addFields(embed_data.fields);
          }

          messageContent = { embeds: [embed] };
        }

        await dmChannel.send(messageContent);
        results.sent++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          discord_id,
          error: err.message
        });
      }
    }

    res.json(results);
  } catch (err: any) {
    console.error('Error broadcasting DMs:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/webhook-message
 * Sends a message via webhook (for portal updates)
 */
app.post('/bot/webhook-message', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { webhook_url, embed_data, content } = req.body;

    if (!webhook_url) {
      return res.status(400).json({ error: 'Missing webhook_url' });
    }

    if (!content && !embed_data) {
      return res.status(400).json({ error: 'Missing content or embed_data' });
    }

    const messageContent: any = { content };

    if (embed_data) {
      const embed = new EmbedBuilder()
        .setTitle(embed_data.title || 'Update')
        .setDescription(embed_data.description || content)
        .setColor(embed_data.color || '#5865F2');

      if (embed_data.fields) {
        embed.addFields(embed_data.fields);
      }

      if (embed_data.thumbnail) {
        embed.setThumbnail(embed_data.thumbnail);
      }

      messageContent.embeds = [embed];
    }

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageContent)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error sending webhook message:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/delete-webhook
 * Deletes a webhook
 */
app.post('/bot/delete-webhook', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { webhook_id, channel_id } = req.body;

    if (!webhook_id || !channel_id) {
      return res.status(400).json({ error: 'Missing webhook_id or channel_id' });
    }

    const channel = await discordClient!.channels.fetch(channel_id);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const webhooks = await channel.fetchWebhooks();
    const webhook = webhooks.find(w => w.id === webhook_id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await webhook.delete();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /bot/create-webhook
 * Creates a webhook in a channel
 */
app.post('/bot/create-webhook', async (req: Request, res: Response) => {
  if (!ensureClient(res)) return;

  try {
    const { channel_id, webhook_name } = req.body;

    if (!channel_id) {
      return res.status(400).json({ error: 'Missing channel_id' });
    }

    const channel = await discordClient!.channels.fetch(channel_id);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Channel not found or not text-based' });
    }

    const webhook = await channel.createWebhook({
      name: webhook_name || 'Portal Updates',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    });

    res.json({
      success: true,
      webhook_id: webhook.id,
      webhook_url: webhook.url,
      webhook_token: webhook.token
    });
  } catch (err: any) {
    console.error('Error creating webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.BOT_BRIDGE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Bot bridge running on port ${PORT}`);
});

export default app;
