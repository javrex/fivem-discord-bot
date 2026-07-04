import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const MAX_KATILAN = 20;

// Embed mesajını oluşturur
export function buildEmbed(data, guildName) {
    const katilanlar = data.katilanlar || [];
    const yedekler = data.yedekler || [];

    const katilanlarText = katilanlar.length > 0
        ? katilanlar.map(id => `<@${id}>`).join('\n')
        : 'Henüz kimse katılmadı.';

    const yedeklerText = yedekler.length > 0
        ? yedekler.map(id => `<@${id}>`).join('\n')
        : 'Henüz yedek yok.';

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Maddex')
        .addFields(
            { name: `Katılanlar (${katilanlar.length}/${MAX_KATILAN})`, value: katilanlarText },
            { name: `Yedekler (${yedekler.length})`, value: yedeklerText }
        )
        .setFooter({ text: guildName })
        .setTimestamp();
}

// Buton satırlarını oluşturur
export function buildComponents() {
    const katilButon = new ButtonBuilder()
        .setCustomId('maddex_katil')
        .setLabel('Katıl')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

    const yedekButon = new ButtonBuilder()
        .setCustomId('maddex_yedek')
        .setLabel('Yedek')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🟡');

    const ayrilButon = new ButtonBuilder()
        .setCustomId('maddex_ayril')
        .setLabel('Ayrıl')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

    return [new ActionRowBuilder().addComponents(katilButon, yedekButon, ayrilButon)];
}

// Slash komut çalıştığında embed ve butonları gönderir
export async function execute(interaction, client) {
    const data = { katilanlar: [], yedekler: [] };
    const embed = buildEmbed(data, interaction.guild.name);
    const components = buildComponents();

    const message = await interaction.reply({ embeds: [embed], components, fetchReply: true });

    client.activePolls.set(message.id, { type: 'maddex', channelId: interaction.channel.id, ...data });
}
