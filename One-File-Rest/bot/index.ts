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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
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
  durationDays: number;
}> = {
  basic_guard: {
    name: 'Basic Guard Plan',
    price: '$79/month',
    color: 0x5865F2,
    response: '48–72 hours',
    violations: '1 violation/month',
    durationDays: 30,
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
    durationDays: 14,
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
    durationDays: 30,
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
    .addStringOption((opt) => opt.setName('end_date').setDescription('Optional — auto-renews via payment gateway if omitted (YYYY-MM-DD)').setRequired(false))
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

  // ─── Ask Elite (omniscient AI) ──────────────────────────────────────────
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Elite — staff-only AI assistant with full portal + Discord visibility')
    .addStringOption((opt) => opt.setName('question').setDescription('Your question').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('persondossier')
    .setDescription('Ask Elite — full dossier on a person (cases, history, Discord activity).')
    .addUserOption((opt) => opt.setName('user').setDescription('The Discord user').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('dossier')
    .setDescription('AI brief on a case (staff only)')
    .addIntegerOption((opt) => opt.setName('case_id').setDescription('Case ID').setRequired(true))
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
  const endDateInput = interaction.options.getString('end_date', false);
  const planMeta = PLANS[plan];
  if (!planMeta) {
    await interaction.reply({ content: '❌ Invalid plan selected.', ephemeral: true });
    return;
  }

  // If no end_date provided, auto-compute next billing date from plan duration.
  // Subscription auto-renews via the payment gateway, so this is just the next renewal anchor.
  const autoRenew = !endDateInput;
  let endDate = endDateInput || '';
  if (autoRenew) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      await interaction.reply({ content: '❌ Invalid start_date format. Use YYYY-MM-DD.', ephemeral: true });
      return;
    }
    const next = new Date(start);
    next.setUTCDate(next.getUTCDate() + planMeta.durationDays);
    endDate = next.toISOString().slice(0, 10);
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

    // Step 5 — Send polished welcome embed + action buttons in the channel
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const renewalLine = autoRenew
      ? `🔄 Auto-renews **${fmtDate(endDate)}**`
      : `📅 Active until **${fmtDate(endDate)}**`;

    const welcomeEmbed = new EmbedBuilder()
      .setColor(planMeta.color)
      .setAuthor({ name: 'Elite Tok Club  •  Membership Activated' })
      .setTitle(`Welcome, ${targetUser.username} 👋`)
      .setDescription(
        `You're now on the **${planMeta.name}** — ${planMeta.price}.\n` +
        `${renewalLine}\n\u200b`
      )
      .addFields(
        {
          name: '⚡  Response Time',
          value: planMeta.response,
          inline: true,
        },
        {
          name: '🎯  Coverage',
          value: planMeta.violations,
          inline: true,
        },
        {
          name: '📅  Started',
          value: fmtDate(startDate),
          inline: true,
        },
        {
          name: '✨  What\'s included',
          value: planMeta.features.map((f) => `›  ${f}`).join('\n'),
          inline: false,
        },
        {
          name: '\u200b',
          value:
            '**Getting started**\n' +
            '`1` Open the portal below and sign in with Discord\n' +
            '`2` Submit your case in a guided step-by-step flow\n' +
            '`3` Track progress live — every update mirrors here automatically',
          inline: false,
        },
      )
      .setFooter({ text: `Granted by ${interaction.user.username}  •  Elite Tok Club Portal` })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Open Portal')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🌐')
        .setURL(PORTAL_URL),
      new ButtonBuilder()
        .setCustomId(`etc:newcase:${targetUser.id}`)
        .setLabel('Submit New Case')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`etc:mycases:${targetUser.id}`)
        .setLabel('My Cases')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`etc:help:${targetUser.id}`)
        .setLabel('Help')
        .setEmoji('💬')
        .setStyle(ButtonStyle.Secondary),
    );

    await channel.send({ embeds: [welcomeEmbed], components: [actionRow] });

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
  backfillDiscordHistory().catch((e) => console.error('[Bot] Backfill failed:', e?.message));
});

async function backfillDiscordHistory() {
  const days = parseInt(process.env.AI_BACKFILL_DAYS || '7', 10);
  const perChannel = parseInt(process.env.AI_BACKFILL_LIMIT_PER_CHANNEL || '200', 10);
  const cutoff = Date.now() - days * 86400_000;
  const targets = new Set<string>([
    ...channelUserMap.keys(),
    ...AI_STAFF_CHANNELS,
  ]);
  if (targets.size === 0) {
    console.log('[Bot] Backfill: no tracked channels yet — skipping.');
    return;
  }
  let total = 0;
  for (const channelId of targets) {
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !('messages' in channel)) continue;
      const fetched = await (channel as TextChannel).messages.fetch({ limit: Math.min(perChannel, 100) }).catch(() => null);
      if (!fetched) continue;
      const batch: Array<Record<string, unknown>> = [];
      for (const msg of fetched.values()) {
        if (msg.createdTimestamp < cutoff) continue;
        batch.push({
          id: msg.id,
          channel_id: msg.channelId,
          guild_id: msg.guildId,
          author_discord_id: msg.author.id,
          author_username: msg.author.username,
          is_bot: msg.author.bot,
          content: msg.content || '',
          attachments: Array.from(msg.attachments.values()).map((a) => ({ id: a.id, url: a.url, name: a.name, size: a.size })),
          embeds: msg.embeds.map((e) => ({ title: e.title, description: e.description, url: e.url })),
          referenced_message_id: msg.reference?.messageId || null,
          created_at: new Date(msg.createdTimestamp).toISOString(),
          edited_at: msg.editedTimestamp ? new Date(msg.editedTimestamp).toISOString() : null,
        });
      }
      if (batch.length === 0) continue;
      await callBridge('POST', '/bot/discord-messages/bulk-ingest', { messages: batch });
      total += batch.length;
    } catch (err: any) {
      console.warn(`[Bot] Backfill channel ${channelId} failed:`, err?.message);
    }
  }
  console.log(`[Bot] Backfill complete: indexed ${total} historical messages across ${targets.size} channels (last ${days}d).`);
}

// ─── Customer button handlers (Submit New Case / My Cases / Help) ─────────
async function handleCustomerButton(interaction: ButtonInteraction) {
  const [, action, ownerId] = interaction.customId.split(':');

  // Only the user the buttons were created for can use them
  if (ownerId && interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '🔒 These buttons belong to another user. Use `/giveaccess` to get your own welcome panel, or open the portal directly: ' + PORTAL_URL,
      ephemeral: true,
    });
    return;
  }

  if (action === 'newcase') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📝  Submit a new case')
      .setDescription(
        `Open the portal and you'll be guided through a clean step-by-step form:\n` +
        `›  Violations on the account\n` +
        `›  Screenshots of the violation\n` +
        `›  Purchase & verification details\n` +
        `›  Previous appeals (if any)\n` +
        `›  Account metrics (GMV, frozen commission, etc.)\n\n` +
        `Everything autosaves — you can stop and resume anytime.`,
      )
      .setFooter({ text: 'Elite Tok Club Portal' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Open Submission Form').setStyle(ButtonStyle.Link).setEmoji('🚀').setURL(`${PORTAL_URL}/cases/new`),
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (action === 'mycases') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const cases = await callBridge<any[]>('GET', `/bot/cases?discord_id=${interaction.user.id}`);
      if (!cases || cases.length === 0) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setLabel('Submit Your First Case').setStyle(ButtonStyle.Link).setEmoji('📝').setURL(`${PORTAL_URL}/cases/new`),
        );
        await interaction.editReply({
          content: '📋  You don\'t have any cases yet.',
          components: [row],
        });
        return;
      }
      const statusEmoji: Record<string, string> = {
        pending: '⏳', intake: '📥', profile_built: '🏗️', appeal_drafted: '✍️',
        appeal_submitted: '📤', awaiting_tiktok: '⌛', response_received: '📩',
        won: '✅', denied: '❌', escalated: '🚨', closed: '🔒',
      };
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📋  Your cases  •  ${cases.length} total`)
        .setDescription(
          cases.slice(0, 8).map((c) => {
            const emoji = statusEmoji[c.status] || '📁';
            const acct = c.account_username ? `@${c.account_username}` : 'Account pending';
            return `${emoji}  **Case #${c.id}** — ${c.violation_type || 'Violation'}\n` +
                   `\u2002\u2002${acct}  •  \`${c.status}\`  •  ${new Date(c.created_at).toLocaleDateString()}`;
          }).join('\n\n'),
        )
        .setFooter({ text: 'Elite Tok Club Portal' });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('View All in Portal').setStyle(ButtonStyle.Link).setEmoji('🌐').setURL(`${PORTAL_URL}/cases`),
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[Bot] mycases button error:', err);
      await interaction.editReply({ content: '❌ Could not load your cases right now. Please try again in a moment.' });
    }
    return;
  }

  if (action === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('💬  We\'re here to help')
      .setDescription(
        `**The fastest way to reach us:**\n` +
        `Just send a message in this channel — your assigned specialist sees it instantly and replies here and inside the portal.\n\n` +
        `**Common questions**\n` +
        `›  *How long until you reply?* — depends on your plan (12h–72h)\n` +
        `›  *How do I add a screenshot?* — drop it as an attachment in this channel, or upload inside your case in the portal\n` +
        `›  *Can I check my case status?* — tap **My Cases** above, or open the portal anytime`,
      )
      .setFooter({ text: 'Elite Tok Club Portal  •  Reply here to chat with your specialist' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Unknown action.', ephemeral: true });
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'giveaccess': await handleGiveAccess(interaction); break;
        case 'revokeaccess': await handleRevokeAccess(interaction); break;
        case 'casestatus': await handleCaseStatus(interaction); break;
        case 'ask': await handleAsk(interaction); break;
        case 'dossier': await handleDossier(interaction); break;
        case 'persondossier': await handlePersonDossier(interaction); break;
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('etc:')) {
      await handleCustomerButton(interaction);
      return;
    }
  } catch (err) {
    console.error('[Bot] Unhandled interaction error:', err);
    if (interaction.isRepliable()) {
      const errMsg = { content: '❌ An unexpected error occurred.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(console.error);
      } else {
        await interaction.reply(errMsg).catch(console.error);
      }
    }
  }
});

function chunkMessage(s: string, max = 1900): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  let rest = s;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.6) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

function buildSourcesEmbed(sources: Array<{ type: string; id: any; label: string; url?: string }>) {
  if (!sources || sources.length === 0) return null;
  const top = sources.slice(0, 8);
  const lines = top.map((s, i) => `\`#${i + 1}\` ${s.url ? `[${s.label}](${s.url})` : s.label}`);
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📚  Sources')
    .setDescription(lines.join('\n'))
    .setFooter({ text: sources.length > 8 ? `+ ${sources.length - 8} more` : 'Ask Elite' });
}

async function runAsk(question: string, staffDiscordId: string, contextHint?: any) {
  return await callBridge<{ answer: string; sources: any[]; thread_id: number; tools: string[] }>(
    'POST', '/bot/ai/ask',
    { staff_discord_id: staffDiscordId, question, context_hint: contextHint }
  );
}

// Channel-confidentiality guard. Ask Elite answers can contain other clients'
// data, internal notes, audit detail — they must never be posted in channels
// that include non-staff. Default: ephemeral (only the asker sees it). The
// AI_STAFF_CHANNEL_IDS env var lets owners opt-in specific staff-only
// channels (e.g. internal #ops) to public mode.
const AI_STAFF_CHANNELS = new Set(
  (process.env.AI_STAFF_CHANNEL_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);
function isStaffOnlyChannel(channelId: string | null | undefined): boolean {
  return !!channelId && AI_STAFF_CHANNELS.has(channelId);
}

async function handleAsk(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString('question', true);
  const ephemeral = !isStaffOnlyChannel(interaction.channelId);
  await interaction.deferReply({ ephemeral });
  try {
    const result = await runAsk(question, interaction.user.id);
    const chunks = chunkMessage(result.answer);
    await interaction.editReply({ content: chunks[0] });
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i], ephemeral });
    }
    const srcEmbed = buildSourcesEmbed(result.sources || []);
    if (srcEmbed) await interaction.followUp({ embeds: [srcEmbed], ephemeral });
  } catch (err: any) {
    const msg = err?.message || 'failed';
    const friendly = /not_staff/i.test(msg)
      ? '🔒 Ask Elite is staff-only. If you should have access, ping an owner to add you to the staff table.'
      : `❌ Ask Elite error: ${msg.slice(0, 300)}`;
    await interaction.editReply({ content: friendly });
  }
}

async function handlePersonDossier(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  const ephemeral = !isStaffOnlyChannel(interaction.channelId);
  await interaction.deferReply({ ephemeral });
  try {
    const result = await runAsk(
      `Build an executive dossier for the person <@${target.id}> (discord_id ${target.id}, username ${target.username}). Use getClientDossier. Cover: who they are, every case they've had, current standing/plan, recent portal + Discord activity, and the recommended next step. Under 280 words.`,
      interaction.user.id,
      { client_discord_id: target.id }
    );
    const chunks = chunkMessage(result.answer);
    await interaction.editReply({ content: `**👤  Dossier · ${target.username}**\n\n${chunks[0]}` });
    for (let i = 1; i < chunks.length; i++) await interaction.followUp({ content: chunks[i], ephemeral });
    const srcEmbed = buildSourcesEmbed(result.sources || []);
    if (srcEmbed) await interaction.followUp({ embeds: [srcEmbed], ephemeral });
  } catch (err: any) {
    const msg = err?.message || 'failed';
    await interaction.editReply({ content: /not_staff/i.test(msg) ? '🔒 Staff only.' : `❌ Dossier error: ${msg.slice(0, 300)}` });
  }
}

async function handleDossier(interaction: ChatInputCommandInteraction) {
  const caseId = interaction.options.getInteger('case_id', true);
  const ephemeral = !isStaffOnlyChannel(interaction.channelId);
  await interaction.deferReply({ ephemeral });
  try {
    const result = await runAsk(
      `Build an executive dossier for case #${caseId}. Cover client, violation, current stage, deadline risk, evidence completeness, what they said in portal vs Discord, recommended next step. Under 250 words.`,
      interaction.user.id,
      { case_id: caseId }
    );
    const chunks = chunkMessage(result.answer);
    await interaction.editReply({ content: `**📄  Dossier · Case #${caseId}**\n\n${chunks[0]}` });
    for (let i = 1; i < chunks.length; i++) await interaction.followUp({ content: chunks[i], ephemeral });
    const srcEmbed = buildSourcesEmbed(result.sources || []);
    if (srcEmbed) await interaction.followUp({ embeds: [srcEmbed], ephemeral });
  } catch (err: any) {
    const msg = err?.message || 'failed';
    const friendly = /not_staff/i.test(msg)
      ? '🔒 Staff only.'
      : `❌ Dossier error: ${msg.slice(0, 300)}`;
    await interaction.editReply({ content: friendly });
  }
}

// ─── Discord → Portal message mirroring + AI indexing ─────────────────────
// We only index channels that are useful to Ask Elite:
//   1) tracked private customer channels (channelUserMap)
//   2) channels explicitly opted-in via AI_STAFF_CHANNEL_IDS
// This keeps a busy guild's general/voice/announcements out of the index
// and bounds DB growth to roughly (active customers + opted-in channels).
function shouldIndex(channelId: string): boolean {
  if (channelUserMap.has(channelId)) return true;
  if (AI_STAFF_CHANNELS.has(channelId)) return true;
  return false;
}

async function indexDiscordMessage(message: Message) {
  if (!message.guildId || !message.channelId) return;
  if (!shouldIndex(message.channelId)) return;
  try {
    await callBridge('POST', '/bot/discord-messages/ingest', {
      id: message.id,
      channel_id: message.channelId,
      guild_id: message.guildId,
      author_discord_id: message.author.id,
      author_username: message.author.username,
      is_bot: message.author.bot,
      content: message.content || '',
      attachments: Array.from(message.attachments.values()).map((a) => ({
        url: a.url, name: a.name, type: a.contentType || 'unknown',
      })),
      embeds: message.embeds.map((e) => ({ title: e.title, description: e.description })),
      referenced_message_id: message.reference?.messageId || null,
      created_at: message.createdAt.toISOString(),
      edited_at: message.editedAt?.toISOString() || null,
    });
  } catch (err) {
    // Indexing failures are non-fatal; the orchestrator will just have a
    // slightly older view of the channel.
    console.warn('[Bot] Index failed for message', message.id, (err as Error).message);
  }
}

client.on(Events.MessageCreate, async (message: Message) => {
  if (!message.channelId) return;

  // 1) Always index (silent) — never index DMs.
  indexDiscordMessage(message).catch(() => {});

  // 2) @mention → Ask Elite. To prevent leaking other clients' data into a
  // mixed-audience channel, we ONLY answer in:
  //   • a channel explicitly listed in AI_STAFF_CHANNEL_IDS, OR
  //   • a DM to the bot (no guildId)
  // In any other channel we nudge the asker to use the slash command (which
  // replies ephemerally) or DM the bot.
  if (!message.author.bot && client.user && message.mentions.has(client.user.id)) {
    const cleaned = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .trim();
    if (cleaned.length > 1) {
      const isDM = !message.guildId;
      const isStaffChan = isStaffOnlyChannel(message.channelId);
      if (!isDM && !isStaffChan) {
        try {
          await message.reply({ content: '🔒 To protect client confidentiality, I only answer @mentions in staff-only channels or DMs. Use `/ask` here for an ephemeral reply, or DM me directly.' });
        } catch {}
        return;
      }
      try { await message.channel.sendTyping(); } catch {}
      try {
        const result = await runAsk(cleaned, message.author.id);
        const chunks = chunkMessage(result.answer);
        await message.reply({ content: chunks[0] });
        for (let i = 1; i < chunks.length; i++) {
          if ('send' in message.channel) await (message.channel as any).send({ content: chunks[i] });
        }
        const srcEmbed = buildSourcesEmbed(result.sources || []);
        if (srcEmbed && 'send' in message.channel) await (message.channel as any).send({ embeds: [srcEmbed] });
      } catch (err: any) {
        const msg = err?.message || 'failed';
        const friendly = /not_staff/i.test(msg)
          ? '🔒 Ask Elite is staff-only.'
          : `❌ ${msg.slice(0, 300)}`;
        try { await message.reply({ content: friendly }); } catch {}
      }
      return;
    }
  }

  // 3) Existing portal mirroring (unchanged) — only client → portal
  if (message.author.bot) return;
  const discordUserId = channelUserMap.get(message.channelId);
  if (!discordUserId) return;
  if (message.author.id !== discordUserId) return;

  try {
    const cases = await callBridge<any[]>('GET', `/bot/cases?discord_id=${discordUserId}`);
    const openCase = cases.find((c) => !['won', 'denied', 'closed'].includes(c.status));
    if (!openCase) return;

    const attachments = message.attachments.map((att) => ({
      url: att.url, name: att.name, type: att.contentType || 'unknown',
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

client.on(Events.MessageUpdate, async (_old, msg) => {
  if (msg.partial) { try { await msg.fetch(); } catch { return; } }
  if ((msg as Message).guildId) indexDiscordMessage(msg as Message).catch(() => {});
});

client.on(Events.MessageDelete, async (msg) => {
  if (!msg.id) return;
  try {
    await callBridge('POST', '/bot/discord-messages/delete', { id: msg.id });
  } catch {}
});

client.on(Events.Error, (err) => {
  console.error('[Bot] Client error:', err);
});

// ─── Start ────────────────────────────────────────────────────────────────
client.login(TOKEN).catch((err) => {
  console.error('❌ Bot login failed:', err);
  process.exit(1);
});
