import { buildEmbed } from './aktiflik.js';

export async function execute(interaction, client) {
    let targetId = null;

    for (const [messageId, data] of client.activePolls) {
        if (data.type === 'aktiflik' && data.channelId === interaction.channel.id) {
            targetId = messageId;
            break;
        }
    }

    if (!targetId) {
        return interaction.reply({
            content: 'Bu kanalda aktif bir aktiflik mesajı bulunamadı.',
            ephemeral: true
        });
    }

    const data = client.activePolls.get(targetId);
    const embed = buildEmbed(data, interaction.guild.name)
        .setTitle('Aktiflik (Bitti)');

    try {
        const message = await interaction.channel.messages.fetch(targetId);
        await message.edit({ embeds: [embed], components: [] });
        client.activePolls.delete(targetId);

        await interaction.reply({
            content: 'Aktiflik sonlandırıldı.',
            ephemeral: true
        });
    } catch {
        await interaction.reply({
            content: 'Mesaj bulunamadı veya düzenlenemedi.',
            ephemeral: true
        });
    }
}
