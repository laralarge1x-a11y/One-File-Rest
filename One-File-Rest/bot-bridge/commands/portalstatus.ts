import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import pool from '../../server/db/client.js';
import { PLAN_CONFIG } from '../../shared/plans.js';

export const data = new SlashCommandBuilder()
  .setName('portalstatus')
  .setDescription('View all clients with portal access')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option
      .setName('filter')
      .setDescription('Filter by access status')
      .setRequired(false)
      .addChoices(
        { name: 'All', value: 'all' },
        { name: 'Active only', value: 'active' },
        { name: 'Revoked only', value: 'revoked' }
      )
  );

export async function execute(interaction: any) {
  try {
    const filter = interaction.options.getString('filter') ?? 'all';

    await interaction.deferReply({ ephemeral: true });

    // Fetch portal access records
    let query = `SELECT * FROM portal_access ORDER BY granted_at DESC`;
    let params: any[] = [];

    if (filter === 'active') {
      query = `SELECT * FROM portal_access WHERE access_active = true ORDER BY granted_at DESC`;
    } else if (filter === 'revoked') {
      query = `SELECT * FROM portal_access WHERE access_active = false ORDER BY revoked_at DESC`;
    }

    const result = await pool.query(query, params);
    const records = result.rows;

    if (records.length === 0) {
      const noDataEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('📊 Portal Status')
        .setDescription(`No portal access records found with filter: **${filter}**`)
        .setTimestamp();

      return interaction.editReply({ embeds: [noDataEmbed] });
    }

    // Paginate: 10 records per page
    const itemsPerPage = 10;
    const totalPages = Math.ceil(records.length / itemsPerPage);
    let currentPage = 0;

    const buildEmbed = (page: number) => {
      const start = page * itemsPerPage;
      const end = start + itemsPerPage;
      const pageRecords = records.slice(start, end);

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('📊 Portal Access Status')
        .setDescription(`Showing ${start + 1}–${Math.min(end, records.length)} of ${records.length} clients`)
        .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
        .setTimestamp();

      for (const record of pageRecords) {
        const planConfig = PLAN_CONFIG[record.plan as keyof typeof PLAN_CONFIG];
        const statusEmoji = record.access_active ? '✅' : '🚫';
        const statusText = record.access_active ? 'Active' : 'Revoked';

        const fieldValue = [
          `**${statusEmoji} ${statusText}**`,
          `Plan: ${planConfig?.emoji} ${planConfig?.displayName}`,
          `Start: ${new Date(record.subscription_start).toLocaleDateString()}`,
          `Channel: <#${record.update_channel_id}>`,
          record.access_active
            ? `Granted: ${new Date(record.granted_at).toLocaleDateString()}`
            : `Revoked: ${new Date(record.revoked_at).toLocaleDateString()}`
        ].join('\n');

        embed.addFields({
          name: `${record.discord_username} (${record.discord_id})`,
          value: fieldValue,
          inline: false
        });
      }

      return embed;
    };

    const buildButtons = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>();

      if (page > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`portal_status_prev_${page}`)
            .setLabel('← Previous')
            .setStyle(ButtonStyle.Primary)
        );
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId('portal_status_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Secondary)
      );

      if (page < totalPages - 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`portal_status_next_${page}`)
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
        );
      }

      return row;
    };

    const message = await interaction.editReply({
      embeds: [buildEmbed(currentPage)],
      components: [buildButtons(currentPage)]
    });

    // Button collector
    const buttonFilter = (i: any) => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter: buttonFilter, time: 300000 });

    collector.on('collect', async (buttonInteraction: any) => {
      if (buttonInteraction.customId === 'portal_status_close') {
        await buttonInteraction.update({
          content: '✅ Portal status viewer closed.',
          embeds: [],
          components: []
        });
        collector.stop();
        return;
      }

      if (buttonInteraction.customId.startsWith('portal_status_next_')) {
        currentPage++;
      } else if (buttonInteraction.customId.startsWith('portal_status_prev_')) {
        currentPage--;
      }

      await buttonInteraction.update({
        embeds: [buildEmbed(currentPage)],
        components: [buildButtons(currentPage)]
      });
    });

    collector.on('end', () => {
      // Collector ended
    });
  } catch (err) {
    console.error('Unhandled error in portalstatus command:', err);
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
