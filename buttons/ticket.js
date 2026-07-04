import { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import config from '../config/index.js';

export default async function(interaction) {
    if (interaction.customId === 'ticket_ac') {
        await createTicket(interaction);
    } else if (interaction.customId === 'ticket_kapat') {
        await closeTicket(interaction);
    }
}

async function createTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!config.ticketCategoryId) {
        return interaction.editReply({ content: 'Ticket kategorisi ayarlanmamış.' });
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
                { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ...config.allowedRoles.map(roleId => ({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }))
            ]
        });

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Hoş Geldin')
            .setDescription('Yetkililer en kısa sürede size yardımcı olacaktır. Lütfen sorununuzu detaylıca anlatın.')
            .addFields(
                { name: 'Kullanıcı', value: `${interaction.user}`, inline: true },
                { name: 'Kullanıcı ID', value: interaction.user.id, inline: true }
            )
            .setFooter({ text: interaction.guild.name })
            .setTimestamp();

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_kapat')
                .setLabel('Kapat')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );

        const roleMentions = config.allowedRoles.map(id => `<@&${id}>`).join(' ');

        await channel.send({
            content: `${interaction.user} ${roleMentions}`,
            embeds: [embed],
            components: [closeButton]
        });

        await interaction.editReply({ content: `Ticketınız oluşturuldu: ${channel}` });
    } catch (error) {
        console.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({ content: 'Ticket oluşturulurken bir hata oluştu.' });
    }
}

async function closeTicket(interaction) {
    const hasPermission = interaction.member?.roles.cache.some(
        role => config.allowedRoles.includes(role.id)
    );

    if (!hasPermission) {
        return interaction.reply({ content: 'Ticket kapatma yetkiniz bulunmuyor.', ephemeral: true });
    }

    await interaction.reply({ content: 'Ticket 5 saniye içinde kapatılıyor...' });

    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (error) {
            console.error('Ticket silinirken hata:', error);
        }
    }, 5000);
}
