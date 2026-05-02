import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Events,
  TextChannel,
  ChannelType,
  Message,
  WebhookClient,
  PermissionFlagsBits,
} from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const PORTAL_URL = process.env.PORTAL_URL || 'https://one-file-rest.replit.app';
const BOT_TOKEN_HEADER = process.env.BOT_BRIDGE_TOKEN || '';

if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set — bot cannot start');
  process.exit(1);
}

// ─── Plan metadata ────────────────────────────────────────────────────────
const PLANS: Record<string, {
  name: string; price: string; color: number;
  response: string; violations: string; features: string[];
}> = {
  basic_guard: {
    name: 'Basic Guard Plan',
    price: '$79/month',
    color: 0x5865F2,
    response: '48–72 hours',
    violations: '1 violation/month',
    features: [
      '1 violation handled per month',
      '48–72 hour response time',
      'Custom appeal writing',
      '1-on-1 standard support',
      'Basic violation analysis',
      'Appeal status tracking',
      'Optional express upgrade available',
    ],
  },
  fortnightly_defense: {
    name: 'Fortnightly Defense Plan',
    price: '$159/2 weeks',
    color: 0x57F287,
    response: 'Under 12 hours',
    violations: 'Up to 3 violations per 2 weeks',
    features: [
      'Up to 3 violations per 2 weeks',
      'Priority response under 12 hours',
      'Full-service appeal handling',
      'Direct expert chat',
      'Advanced violation analysis + prevention tips',
      'Escalation support',
      'Faster platform follow-ups',
      'Ticket priority over Basic users',
    ],
  },
  proshield_creator: {
    name: 'ProShield Creator Plan',
    price: '$259/month',
    color: 0xFFD700,
    response: 'Priority — fastest queue',
    violations: 'Up to 5 violations/month',
    features: [
      'Up to 5 violations/month',
      'Priority handling — top queue',
      'End-to-end case management',
      'Direct 1-on-1 expert access',
      'Advanced appeal frameworks + proven templates',
      'Weekly account audits and risk checks',
      'Personalized prevention strategy',
      'Creator growth and compliance guidance',
      'Unlimited support and follow-ups',
      'Highest escalation priority',
    ],
  },
};

// ─── Admin check ──────────────────────────────────────────────────────────
function isAdmin(discordId: string): boolean {
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  return adminIds.includes(discordId);
}

// ─── Bot bridge API caller ────────────────────────────────────────────────
async function callBridge<T = any>(method: string, path: string, body?: any): Promise<T> {
  const response = await fetch(`${PORTAL_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BOT_TOKEN_HEADER}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bridge API error ${response.status}: ${text.substring(0, 200)}`);
  }
  return response.json() as T;
}

// ─── Discord client ───────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
  ],
});

// Cache of channelId → discordId mappings (refreshed periodically)
let channelUserMap: Map<string, string> = new Map();

async function refreshChannelMap() {
  try {
    const users = await callBridge<Array<{ discord_id: string; discord_channel_id: string }>>('GET', '/bot/channels');
    channelUserMap = new Map(users.map((u) => [u.discord_channel_id, u.discord_id]));
    console.log(`[Bot] Channel map refreshed: ${channelUserMap.size} channels`);
  } catch (err) {
    console.error('[Bot] Failed to refresh channel map:', err);
  }
}

// ─── Slash commands ───────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('giveaccess')
    .setDescription('Grant portal access to a user in this channel')
    .addUserOption((opt) => opt.setName('user').setDescription('The Discord user to grant access').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('plan').setDescription('Subscription plan').setRequired(true)
        .addChoices(
          { name: 'Basic Guard — $79/month', value: 'basic_guard' },
          { name: 'Fortnightly Defense — $159/2 weeks', value: 'fortnightly_defense' },
          { name: 'ProShield Creator — $259/month', value: 'proshield_creator' }
        )
    )
    .addStringOption((opt) => opt.setName('start_date').setDescription('Start date (YYYY-MM-DD)').setRequired(true))
    .addStringOption((opt) => opt.setName('end_date').setDescription('End date (YYYY-MM-DD)').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('revokeaccess')
    .setDescription('Revoke portal access from a user')
    .addUserOption((opt) => opt.setName('user').setDescription('The Discord user to revoke').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('casestatus')
    .setDescription('View all cases for a user')
    .addUserOption((opt) => opt.setName('user').setDescription('The Discord user').setRequired(true))
    .toJSON(),
];

// ─── Register slash commands ──────────────────────────────────────────────
async function registerCommands() {
  if (!GUILD_ID) { console.warn('[Bot] DISCORD_GUILD_ID not set — skipping command registration'); return; }
  const rest = new REST().setToken(TOKEN!);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user!.id, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered to guild:', GUILD_ID);
  } catch (err) {
    console.error('[Bot] Failed to register commands:', err);
  }
}

// ─── /giveaccess handler ──────────────────────────────────────────────────
async function handleGiveAccess(interaction: ChatInputCommandInteraction) {
  // Step 1 — Admin check
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: '❌ You don\'t have permission to run this command.', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const plan = interaction.options.getString('plan', true);
  const startDate = interaction.options.getString('start_date', true);
  const endDate = interaction.options.getString('end_date', true);
  const planMeta = PLANS[plan];
  if (!planMeta) {
    await interaction.reply({ content: '❌ Invalid plan selected.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Step 2 — The current channel IS the customer's private channel
    const channelId = interaction.channelId;
    const channel = interaction.channel as TextChannel;

    // Step 3 — Create or find existing 'Portal Updates' webhook
    let webhookUrl = '';
    try {
      const existingWebhooks = await channel.fetchWebhooks();
      const existing = existingWebhooks.find((wh) => wh.name === 'Portal Updates');
      if (existing) {
        webhookUrl = existing.url;
      } else {
        const newWebhook = await channel.createWebhook({
          name: 'Portal Updates',
          avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
          reason: 'Elite Tok Club — Portal updates webhook',
        });
        webhookUrl = newWebhook.url;
      }
    } catch (whErr) {
      console.error('[Bot] Webhook create error:', whErr);
    }

    // Step 4 — Sync user to database
    await callBridge('POST', '/bot/users/sync', {
      discord_id: targetUser.id,
      discord_username: targetUser.username,
      discord_avatar: targetUser.avatar,
      plan,
      plan_start: startDate,
      plan_expiry: endDate,
      discord_channel_id: channelId,
      discord_webhook_url: webhookUrl,
    });

    // Refresh channel map
    channelUserMap.set(channelId, targetUser.id);

    // Step 5 — Send welcome embed in the current channel
    const welcomeEmbed = new EmbedBuilder()
      .setColor(planMeta.color)
      .setTitle(`✅ Welcome to TikTok Recovery Portal, ${targetUser.username}!`)
      .setDescription('Your access has been granted. Here is everything you need to know.')
      .addFields(
        { name: '📦 Your Plan', value: planMeta.name, inline: true },
        { name: '💰 Price', value: planMeta.price, inline: true },
        { name: '📅 Active From', value: new Date(startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), inline: true },
        { name: '📅 Active Until', value: new Date(endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), inline: true },
        { name: '⚡ Response Time', value: planMeta.response, inline: true },
        { name: '🎯 Violations Covered', value: planMeta.violations, inline: true },
        { name: '✨ Your Benefits', value: planMeta.features.map((f) => `• ${f}`).join('\n'), inline: false },
        { name: '🌐 Portal Access', value: `Login with Discord at: ${PORTAL_URL}`, inline: false },
        {
          name: '📋 How to Use',
          value: '1. Click the portal link above\n2. Login with your Discord account (one time only, you stay logged in)\n3. Submit your cases and track progress\n4. All updates appear here in this channel automatically',
          inline: false,
        },
      )
      .setFooter({ text: `TikTok Recovery Portal • Access granted by ${interaction.user.username}` })
      .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });

    // Step 6 — Ephemeral reply to admin
    await interaction.editReply({
      content: `✅ Access granted for **${targetUser.username}**. Webhook created in this channel. Portal link sent. Database updated.`,
    });
  } catch (err) {
    console.error('[Bot] /giveaccess error:', err);
    await interaction.editReply({ content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
  }
}

// ─── /revokeaccess handler ────────────────────────────────────────────────
async function handleRevokeAccess(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: '❌ You don\'t have permission to run this command.', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  await interaction.deferReply({ ephemeral: true });

  try {
    // Get user info from database
    let userData: any;
    try {
      userData = await callBridge('GET', `/bot/users/${targetUser.id}`);
    } catch {
      await interaction.editReply({ content: `❌ User **${targetUser.username}** not found in the database.` });
      return;
    }

    // Revoke in database
    await callBridge('POST', `/bot/users/${targetUser.id}/revoke`);

    // Post revoke embed in their channel
    if (userData.discord_channel_id) {
      try {
        const channel = await client.channels.fetch(userData.discord_channel_id) as TextChannel;
        if (channel && channel.isTextBased()) {
          const revokeEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('⛔ Access Revoked')
            .setDescription('Your TikTok Recovery Portal access has been revoked.')
            .addFields(
              { name: '📋 What This Means', value: 'Your portal account is now inactive. You can no longer submit new cases or access the portal.', inline: false },
              { name: '❓ Questions?', value: 'Please contact support if you believe this is a mistake.', inline: false },
            )
            .setFooter({ text: `TikTok Recovery Portal • Revoked by ${interaction.user.username}` })
            .setTimestamp();
          await channel.send({ embeds: [revokeEmbed] });
        }
      } catch (channelErr) {
        console.error('[Bot] Could not post revoke notice to channel:', channelErr);
      }
    }

    await interaction.editReply({
      content: `✅ Access revoked for **${targetUser.username}**. They have been notified in their channel.`,
    });
  } catch (err) {
    console.error('[Bot] /revokeaccess error:', err);
    await interaction.editReply({ content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
  }
}

// ─── /casestatus handler ──────────────────────────────────────────────────
async function handleCaseStatus(interaction: ChatInputCommandInteraction) {
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({ content: '❌ You don\'t have permission to run this command.', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  await interaction.deferReply({ ephemeral: true });

  try {
    const cases = await callBridge<any[]>('GET', `/bot/cases?discord_id=${targetUser.id}`);

    if (!cases || cases.length === 0) {
      await interaction.editReply({ content: `📋 **${targetUser.username}** has no cases on record.` });
      return;
    }

    const statusEmoji: Record<string, string> = {
      pending: '⏳', intake: '📥', profile_built: '🏗️', appeal_drafted: '✍️',
      appeal_submitted: '📤', awaiting_tiktok: '⌛', response_received: '📩',
      won: '✅', denied: '❌', escalated: '🚨', closed: '🔒',
    };

    const caseEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📋 Cases for ${targetUser.username}`)
      .setDescription(`Found **${cases.length}** case(s)`)
      .addFields(
        cases.slice(0, 10).map((c) => ({
          name: `${statusEmoji[c.status] || '📁'} Case #${c.id} — ${c.violation_type || 'Unknown'}`,
          value: `Status: **${c.status}**\nAccount: @${c.account_username || 'N/A'}\nCreated: ${new Date(c.created_at).toLocaleDateString()}`,
          inline: true,
        }))
      )
      .setFooter({ text: 'TikTok Recovery Portal' })
      .setTimestamp();

    await interaction.editReply({ embeds: [caseEmbed] });
  } catch (err) {
    console.error('[Bot] /casestatus error:', err);
    await interaction.editReply({ content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot online: ${readyClient.user.tag}`);
  await registerCommands();
  await refreshChannelMap();
  // Refresh channel map every 5 minutes
  setInterval(refreshChannelMap, 5 * 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'giveaccess': await handleGiveAccess(interaction); break;
      case 'revokeaccess': await handleRevokeAccess(interaction); break;
      case 'casestatus': await handleCaseStatus(interaction); break;
    }
  } catch (err) {
    console.error('[Bot] Unhandled command error:', err);
    const errMsg = { content: '❌ An unexpected error occurred.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errMsg).catch(console.error);
    } else {
      await interaction.reply(errMsg).catch(console.error);
    }
  }
});

// Discord → Portal message mirroring
client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.channelId) return;

  const discordUserId = channelUserMap.get(message.channelId);
  if (!discordUserId) return; // Not a tracked customer channel

  // Only mirror messages from the channel owner (not admins)
  if (message.author.id !== discordUserId) return;

  try {
    // Find the latest open case for this user to attach the message to
    const cases = await callBridge<any[]>('GET', `/bot/cases?discord_id=${discordUserId}`);
    const openCase = cases.find((c) => !['won', 'denied', 'closed'].includes(c.status));
    if (!openCase) return;

    const attachments = message.attachments.map((att) => ({
      url: att.url,
      name: att.name,
      type: att.contentType || 'unknown',
    }));

    await callBridge('POST', '/bot/messages/receive', {
      discord_user_id: discordUserId,
      case_id: openCase.id,
      content: message.content || '[attachment]',
      attachments,
    });

    console.log(`[Bot] Mirrored message from ${message.author.username} to case #${openCase.id}`);
  } catch (err) {
    console.error('[Bot] Message mirror error:', err);
  }
});

client.on(Events.Error, (err) => {
  console.error('[Bot] Client error:', err);
});

// ─── Start ────────────────────────────────────────────────────────────────
client.login(TOKEN).catch((err) => {
  console.error('❌ Bot login failed:', err);
  process.exit(1);
});
