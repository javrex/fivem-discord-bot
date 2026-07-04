import { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import config from '../config/index.js';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!config.ticketCategoryId) {
        return interaction.editReply({ content: 'Ticket sistemi yapılandırılmamış.' });
    }

    const category = interaction.guild.channels.cache.get(config.ticketCategoryId);
    if (!category) {
        return interaction.editReply({ content: 'Ticket kategorisi bulunamadı.' });
    }

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existingTicket = interaction.guild.channels.cache.find(
        c => c.parentId === config.ticketCategoryId && c.name === `talep-${safeName}`
    );

    if (existingTicket) {
        return interaction.editReply({ content: `Zaten açık bir ticketınız var: ${existingTicket}` });
    }

    try {
        const channel = await interaction.guild.channels.create({
            name: `talep-${safeName}`,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                },
                ...config.ticketSupportRoles.map(roleId => ({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }))
            ]
        });

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Ticket')
            .setDescription('Yetkililer en kısa sürede size yardımcı olacaktır.')
            .addFields({ name: 'Kullanıcı', value: `${interaction.user}` })
            .setFooter({ text: interaction.guild.name })
            .setTimestamp();

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_kapat')
                .setLabel('Kapat')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );

        await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeButton] });
        await interaction.editReply({ content: `Ticketınız oluşturuldu: ${channel}` });
    } catch (error) {
        console.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({ content: 'Ticket oluşturulurken bir hata oluştu.' });
    }
}
