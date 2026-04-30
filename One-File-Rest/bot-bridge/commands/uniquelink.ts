import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import pool from '../../server/db/client.js';
import { PLAN_CONFIG } from '../../shared/plans.js';

export const data = new SlashCommandBuilder()
  .setName('uniquelink')
  .setDescription('Generate and send a unique portal link to a client')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The client to send the portal link to')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('plan')
      .setDescription('The subscription plan the client is on')
      .setRequired(true)
      .addChoices(
        { name: 'Basic Guard Plan — $79/month', value: 'basic' },
        { name: 'Fortnightly Defense Plan — $159/2 weeks', value: 'fortnightly' },
        { name: 'ProShield Creator Plan — $259/month', value: 'proshield' }
      )
  )
  .addStringOption(option =>
    option
      .setName('start_date')
      .setDescription('Subscription start date (format: DD/MM/YYYY)')
      .setRequired(true)
  );

export async function execute(interaction: any): Promise<void> {
  try {
    // Step 1: Validate channel
    if (!interaction.channel || !interaction.channel.isTextBased()) {
      return interaction.reply({
        content: '❌ This command can only be used in a text channel.',
        ephemeral: true
      });
    }

    if (!interaction.channel.permissionsFor(interaction.client.user).has('ManageWebhooks')) {
      return interaction.reply({
        content: '❌ I need the **Manage Webhooks** permission in this channel to continue. Please grant it and try again.',
        ephemeral: true
      });
    }

    // Step 2: Validate user
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ That user could not be found in this server.',
        ephemeral: true
      });
    }

    // Step 3: Validate and parse date
    const dateStr = interaction.options.getString('start_date');
    const dateParts = dateStr.split('/');

    if (dateParts.length !== 3 || isNaN(parseInt(dateParts[0])) || isNaN(parseInt(dateParts[1])) || isNaN(parseInt(dateParts[2]))) {
      return interaction.reply({
        content: '❌ Invalid date format. Please use **DD/MM/YYYY** (example: 15/01/2025)',
        ephemeral: true
      });
    }

    const [day, month, year] = dateParts.map((p: string) => parseInt(p));
    const parsedDate = new Date(year, month - 1, day);

    if (isNaN(parsedDate.getTime())) {
      return interaction.reply({
        content: '❌ Invalid date. Please enter a valid date in DD/MM/YYYY format.',
        ephemeral: true
      });
    }

    const now = new Date();
    const futureThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (parsedDate > futureThreshold) {
      console.warn(`Warning: subscription start date ${dateStr} is more than 7 days in the future`);
    }

    // Step 4: Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Step 5: Create or retrieve webhook
    let webhook: any;
    try {
      const existingWebhooks = await interaction.channel.fetchWebhooks();
      const botWebhook = existingWebhooks.find((wh: any) => wh.applicationId === interaction.client.application.id);

      if (botWebhook) {
        webhook = botWebhook;
      } else {
        webhook = await interaction.channel.createWebhook({
          name: 'Elite Tok Club Portal',
          reason: `Portal update webhook for client ${user.tag}`
        });
      }
    } catch (err) {
      console.error('Webhook creation failed:', err);
      return interaction.editReply({
        content: '❌ Failed to create webhook. Make sure I have **Manage Webhooks** permission in this channel.'
      });
    }

    // Step 6: Get or create portal token
    let portal_token: string;
    let portal_url: string;

    try {
      const portalResponse = await fetch(`${process.env.PORTAL_URL}/internal/get-or-create-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
        },
        body: JSON.stringify({
          discord_id: user.id,
          discord_username: user.tag,
          discord_avatar: user.displayAvatarURL()
        })
      });

      if (!portalResponse.ok) {
        throw new Error(`Portal API error: ${portalResponse.status}`);
      }

      const portalData = await portalResponse.json();
      portal_token = portalData.portal_token;
      portal_url = portalData.portal_url;
    } catch (err) {
      console.error('Portal API error:', err);
      return interaction.editReply({
        content: '❌ Portal server is currently unreachable. Try again in a moment or contact the developer.'
      });
    }

    // Step 7: Save subscription data to database
    const plan = interaction.options.getString('plan');
    const formattedDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

    try {
      await pool.query(
        `INSERT INTO portal_access (
          discord_id, discord_username, plan, subscription_start,
          portal_token, portal_url, update_channel_id,
          webhook_id, webhook_url, webhook_token, access_active, granted_at, granted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), $11)
        ON CONFLICT (discord_id) DO UPDATE SET
          plan = EXCLUDED.plan,
          subscription_start = EXCLUDED.subscription_start,
          portal_token = EXCLUDED.portal_token,
          portal_url = EXCLUDED.portal_url,
          update_channel_id = EXCLUDED.update_channel_id,
          webhook_id = EXCLUDED.webhook_id,
          webhook_url = EXCLUDED.webhook_url,
          webhook_token = EXCLUDED.webhook_token,
          access_active = true,
          updated_at = NOW()`,
        [
          user.id, user.tag, plan, parsedDate,
          portal_token, portal_url, interaction.channel.id,
          webhook.id, webhook.url, webhook.token, interaction.user.id
        ]
      );
    } catch (err) {
      console.error('Database error:', err);
      return interaction.editReply({
        content: '❌ A database error occurred. The action was not completed.'
      });
    }

    // Step 8: Get plan details
    const planDetails = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];

    // Step 9: Send portal link embed to channel (PUBLIC)
    const portalEmbed = new EmbedBuilder()
      .setColor(planDetails.color)
      .setTitle('🌐 Your Elite Tok Club Portal is Ready')
      .setDescription(`Hey ${user}, your personal case management portal has been set up. Everything about your case — updates, messages, evidence, and appeal progress — is tracked here in real time.`)
      .addFields(
        {
          name: `${planDetails.emoji} Your Plan`,
          value: `**${planDetails.displayName}**\n${planDetails.price}`,
          inline: true
        },
        {
          name: '📅 Subscription Start',
          value: `**${formattedDate}**`,
          inline: true
        },
        {
          name: '🔗 Your Portal Link',
          value: `**[Click here to access your portal](${portal_url})**\n\n> This link is unique to you. Do not share it with anyone.\n> Login is done automatically via your Discord account.`,
          inline: false
        },
        {
          name: '✅ What You Can Do in the Portal',
          value: [
            '• View real-time case progress & appeal timeline',
            '• Message Henry directly',
            '• Upload evidence & screenshots',
            '• Track all your TikTok accounts',
            '• View TikTok policy alerts',
            '• Manage your subscription'
          ].join('\n'),
          inline: false
        },
        {
          name: `📋 Your Plan Includes`,
          value: planDetails.features.map(f => `• ${f}`).join('\n'),
          inline: false
        }
      )
      .setFooter({
        text: 'Elite Tok Club • Your portal link never expires • Bookmark it for quick access',
        iconURL: interaction.guild.iconURL() ?? undefined
      })
      .setTimestamp();

    await interaction.channel.send({
      content: `${user}`,
      embeds: [portalEmbed]
    });

    // Step 10: Reply to Henry (ephemeral confirmation)
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Portal Access Granted')
      .addFields(
        { name: 'Client', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Plan', value: planDetails.displayName, inline: true },
        { name: 'Start Date', value: formattedDate, inline: true },
        { name: 'Portal URL', value: portal_url, inline: false },
        { name: 'Webhook', value: `✅ Created and saved in this channel`, inline: true },
        { name: 'Update Channel', value: `${interaction.channel}`, inline: true }
      )
      .setDescription('The portal link has been sent in this channel. All portal updates for this client will be delivered here via webhook.')
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed] });

    // Step 11: Log the action
    await pool.query(
      `INSERT INTO staff_activity_log (staff_discord_id, action, entity_type, details, created_at)
       VALUES ($1, 'portal_access_granted', 'user', $2, NOW())`,
      [
        interaction.user.id,
        JSON.stringify({
          client_discord_id: user.id,
          plan,
          portal_url,
          channel_id: interaction.channel.id
        })
      ]
    );
  } catch (err) {
    console.error('Unhandled error in uniquelink command:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Something went wrong. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.editReply({
        content: '❌ Something went wrong. Please try again.'
      });
    }
  }
}
