import { buildEmbed, buildComponents } from '../commands/aktiflik.js';

// Katıl ve Ayrıl butonlarını yönetir
export default async function(interaction, client) {
    const { customId, message } = interaction;
    const data = client.activePolls.get(message.id);

    if (!data || data.type !== 'aktiflik') return;

    const userId = interaction.user.id;

    if (customId === 'aktiflik_katil') {
        // Kullanıcı zaten katılmışsa tekrar ekleme
        if (!data.katilanlar.includes(userId)) {
            data.katilanlar.push(userId);
        }
    } else if (customId === 'aktiflik_ayril') {
        // Kullanıcıyı katılanlar listesinden çıkar
        data.katilanlar = data.katilanlar.filter(id => id !== userId);
    }

    const embed = buildEmbed(data, interaction.guild.name);
    const components = buildComponents();

    await interaction.update({ embeds: [embed], components });
}
