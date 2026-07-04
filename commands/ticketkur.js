import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import config from '../config/index.js';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.guild.channels.cache.get(config.ticketPanelChannelId);
    if (!channel) {
        return interaction.editReply({ content: 'Ticket panel kanalı bulunamadı.' });
    }

    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Ticket Sistemi')
        .setDescription('Destek almak için aşağıdaki butonu kullanın.')
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_ac')
            .setLabel('Ticket Aç')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
    );

    await channel.send({ embeds: [embed], components: [button] });
    await interaction.editReply({ content: 'Ticket paneli gönderildi.' });
}
