import { buildEmbed, buildComponents } from '../commands/maddex.js';

const MAX_KATILAN = 20;

// Katıl (maks 20), Yedek ve Ayrıl butonlarını yönetir
export default async function(interaction, client) {
    const { customId, message } = interaction;
    const data = client.activePolls.get(message.id);

    if (!data || data.type !== 'maddex') return;

    const userId = interaction.user.id;

    if (customId === 'maddex_katil') {
        if (data.katilanlar.length < MAX_KATILAN) {
            // Katılanlar 20'den azsa katılanlara ekle
            data.yedekler = data.yedekler.filter(id => id !== userId);

            if (!data.katilanlar.includes(userId)) {
                data.katilanlar.push(userId);
            }
        } else {
            // Katılanlar doluysa otomatik olarak yedeklere ekle
            if (!data.yedekler.includes(userId)) {
                data.yedekler.push(userId);
            }
        }
    } else if (customId === 'maddex_yedek') {
        // Katılanlardan varsa çıkar, yedeklere ekle
        data.katilanlar = data.katilanlar.filter(id => id !== userId);

        if (!data.yedekler.includes(userId)) {
            data.yedekler.push(userId);
        }
    } else if (customId === 'maddex_ayril') {
        // Her iki listeden de çıkar
        data.katilanlar = data.katilanlar.filter(id => id !== userId);
        data.yedekler = data.yedekler.filter(id => id !== userId);
    }

    const embed = buildEmbed(data, interaction.guild.name);
    const components = buildComponents();

    await interaction.update({ embeds: [embed], components });
}
