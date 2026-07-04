import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Embed mesajını oluşturur
export function buildEmbed(data, guildName) {
    const katilanlar = data.katilanlar || [];

    const katilanlarText = katilanlar.length > 0
        ? katilanlar.map(id => `<@${id}>`).join('\n')
        : 'Henüz kimse katılmadı.';

    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Aktiflik')
        .addFields({ name: `Katılanlar (${katilanlar.length})`, value: katilanlarText })
        .setFooter({ text: guildName })
        .setTimestamp();
}

// Buton satırlarını oluşturur
export function buildComponents() {
    const katilButon = new ButtonBuilder()
        .setCustomId('aktiflik_katil')
        .setLabel('Katıl')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

    const ayrilButon = new ButtonBuilder()
        .setCustomId('aktiflik_ayril')
        .setLabel('Ayrıl')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');

    return [new ActionRowBuilder().addComponents(katilButon, ayrilButon)];
}

// Slash komut çalıştığında embed ve butonları gönderir
export async function execute(interaction, client) {
    const data = { katilanlar: [] };
    const embed = buildEmbed(data, interaction.guild.name);
    const components = buildComponents();

    const message = await interaction.reply({ embeds: [embed], components, fetchReply: true });

    // Buton etkileşimlerinde kullanılmak üzere veriyi kaydet
    client.activePolls.set(message.id, { type: 'aktiflik', channelId: interaction.channel.id, ...data });
}
