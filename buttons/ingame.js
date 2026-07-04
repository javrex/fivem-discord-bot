import { buildEmbed, buildComponents } from '../commands/ingame.js';

// Katıl, Yedek ve Ayrıl butonlarını yönetir
export default async function(interaction, client) {
    const { customId, message } = interaction;
    const data = client.activePolls.get(message.id);

    if (!data || data.type !== 'ingame') return;

    const userId = interaction.user.id;

    if (customId === 'ingame_katil') {
        // Yedeklerden varsa çıkar, katılanlara ekle
        data.yedekler = data.yedekler.filter(id => id !== userId);

        if (!data.katilanlar.includes(userId)) {
            data.katilanlar.push(userId);
        }
    } else if (customId === 'ingame_yedek') {
        // Katılanlardan varsa çıkar, yedeklere ekle
        data.katilanlar = data.katilanlar.filter(id => id !== userId);

        if (!data.yedekler.includes(userId)) {
            data.yedekler.push(userId);
        }
    } else if (customId === 'ingame_ayril') {
        // Her iki listeden de çıkar
        data.katilanlar = data.katilanlar.filter(id => id !== userId);
        data.yedekler = data.yedekler.filter(id => id !== userId);
    }

    const embed = buildEmbed(data, interaction.guild.name);
    const components = buildComponents();

    await interaction.update({ embeds: [embed], components });
}
