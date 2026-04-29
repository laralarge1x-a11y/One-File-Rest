import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  WebhookClient,
} from 'discord.js';
import pool from '../../server/db/client.js';

export const data = new SlashCommandBuilder()
  .setName('removewebaccess')
  .setDescription('Revoke a client\'s portal access when their subscription ends')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The client whose portal access should be revoked')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for removal (shown internally only)')
      .setRequired(false)
      .addChoices(
        { name: 'Subscription cancelled by client', value: 'client_cancelled' },
        { name: 'Subscription expired (non-renewal)', value: 'expired' },
        { name: 'Payment failed', value: 'payment_failed' },
        { name: 'Removed by admin', value: 'admin_removed' },
        { name: 'Violation of terms', value: 'tos_violation' }
      )
  );

export async function execute(interaction: any) {
  try {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') ?? 'admin_removed';

    // Step 1: Validate
    const accessResult = await pool.query(
      `SELECT * FROM portal_access WHERE discord_id = $1`,
      [user.id]
    );

    if (accessResult.rows.length === 0) {
      return interaction.reply({
        content: '❌ This user does not have an active portal access record.',
        ephemeral: true
      });
    }

    const record = accessResult.rows[0];

    if (!record.access_active) {
      return interaction.reply({
        content: '❌ This user\'s portal access is already revoked.',
        ephemeral: true
      });
    }

    // Step 2: Defer ephemerally
    await interaction.deferReply({ ephemeral: true });

    // Step 3: Build confirmation embed with buttons
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⚠️ Confirm Portal Access Revocation')
      .setDescription(`You are about to revoke portal access for **${user.tag}**.\n\nThis will:\n• Immediately invalidate their portal login link\n• Remove their ability to access any portal page\n• Delete the update webhook from their channel\n• Send them a DM informing them their access has ended\n\n**This action takes effect immediately upon confirmation.**`)
      .addFields(
        { name: 'Client', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Plan', value: record.plan, inline: true },
        { name: 'Portal URL', value: record.portal_url, inline: false },
        { name: 'Reason', value: reason ?? 'Not specified', inline: true },
        { name: 'Update Channel', value: `<#${record.update_channel_id}>`, inline: true }
      )
      .setTimestamp();

    const confirmRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_revoke_${user.id}`)
          .setLabel('Yes, Revoke Access')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🚫'),
        new ButtonBuilder()
          .setCustomId(`cancel_revoke_${user.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✖️')
      );

    const confirmMessage = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [confirmRow]
    });

    // Step 4: Wait for button interaction
    const buttonFilter = (i: any) => i.customId.startsWith('confirm_revoke_') || i.customId.startsWith('cancel_revoke_');
    const buttonCollector = confirmMessage.createMessageComponentCollector({ filter: buttonFilter, time: 60000 });

    buttonCollector.on('collect', async (buttonInteraction: any) => {
      if (buttonInteraction.customId === `cancel_revoke_${user.id}`) {
        await buttonInteraction.update({
          content: '✅ Revocation cancelled. No changes were made.',
          embeds: [],
          components: []
        });
        buttonCollector.stop();
        return;
      }

      if (buttonInteraction.customId === `confirm_revoke_${user.id}`) {
        try {
          // 5a. Revoke access in portal_access table
          await pool.query(
            `UPDATE portal_access SET
              access_active = false,
              revoked_at = NOW(),
              revoked_by = $1,
              revoke_reason = $2,
              updated_at = NOW()
            WHERE discord_id = $3`,
            [buttonInteraction.user.id, reason, user.id]
          );

          // 5b. Invalidate token in portal users table via internal API
          try {
            await fetch(`${process.env.PORTAL_URL}/internal/revoke-access`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
              },
              body: JSON.stringify({ discord_id: user.id })
            });
          } catch (err) {
            console.error('Portal revoke API error:', err);
          }

          // 5c. Delete the webhook from Discord
          let webhookDeleted = false;
          try {
            if (record.webhook_id && record.webhook_token) {
              const webhookClient = new WebhookClient({ id: record.webhook_id, token: record.webhook_token });
              await webhookClient.delete();
              webhookDeleted = true;
            }
          } catch (err) {
            console.error('Webhook deletion failed (may already be deleted):', err);
          }

          // 5d. Send DM to the client
          let dmSent = false;
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('Your Elite Tok Club Portal Access Has Ended')
              .setDescription(`Hi ${user.username},\n\nYour access to the Elite Tok Club client portal has been removed as your subscription has ended.\n\nIf you believe this is a mistake or would like to re-subscribe, please message us in your channel.\n\n— Elite Tok Club Team`)
              .addFields(
                { name: 'What This Means', value: '• Your portal link is no longer active\n• Your case history is preserved\n• You can re-subscribe at any time to regain access' }
              )
              .setTimestamp();

            await user.send({ embeds: [dmEmbed] });
            dmSent = true;
          } catch (err) {
            console.error('Could not DM client (DMs may be disabled):', err);
          }

          // 5e. Log the action
          await pool.query(
            `INSERT INTO staff_activity_log (staff_discord_id, action, entity_type, details, created_at)
             VALUES ($1, 'portal_access_revoked', 'user', $2, NOW())`,
            [
              buttonInteraction.user.id,
              JSON.stringify({
                client_discord_id: user.id,
                reason,
                portal_url: record.portal_url
              })
            ]
          );

          // 5f. Update the confirmation message
          const successEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Portal Access Revoked')
            .addFields(
              { name: 'Client', value: `${user.tag}`, inline: true },
              { name: 'Revoked By', value: `${buttonInteraction.user.tag}`, inline: true },
              { name: 'Reason', value: reason ?? 'Not specified', inline: true },
              { name: 'DM Sent', value: dmSent ? '✅ Yes' : '⚠️ No (client has DMs disabled)', inline: true },
              { name: 'Webhook', value: webhookDeleted ? '🗑️ Deleted' : '⚠️ Already deleted', inline: true },
              { name: 'Portal Token', value: '🚫 Invalidated', inline: true }
            )
            .setTimestamp();

          await buttonInteraction.update({
            embeds: [successEmbed],
            components: []
          });

          buttonCollector.stop();
        } catch (err) {
          console.error('Error during revocation:', err);
          await buttonInteraction.update({
            content: '❌ An error occurred during revocation. Please check the logs.',
            embeds: [],
            components: []
          });
          buttonCollector.stop();
        }
      }
    });

    buttonCollector.on('end', () => {
      // Collector ended (timeout or manual stop)
    });
  } catch (err) {
    console.error('Unhandled error in removewebaccess command:', err);
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
