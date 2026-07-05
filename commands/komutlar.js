import { EmbedBuilder } from 'discord.js';

export async function execute(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Komutlar')
        .setDescription('Botun tüm komutları ve açıklamaları')
        .addFields(
            { name: '/aktiflik', value: 'Katılım buton mesajı gönderir. Kullanıcılar Katıl/Ayrıl butonlarıyla listeye eklenir.' },
            { name: '/aktiflikbitir', value: 'Aktiflik mesajını sonlandırır ve butonları kaldırır.' },
            { name: '/ingame', value: 'Ingame buton mesajı gönderir. Katıl, Yedek ve Ayrıl butonları bulunur.' },
            { name: '/maddex', value: 'Maddex buton mesajı gönderir. Katılanlar 20 kişiyle sınırlıdır, taşanlar yedek listesine eklenir.' },
            { name: '/toplusescekme', value: 'Belirtilen ses kanalına sunucudaki tüm kullanıcıları taşır.' },
            { name: '/ticketkur', value: 'Ticket panel mesajını kanala gönderir.' },
            { name: '/mesaj', value: 'Bot ile belirtilen kanala mesaj gönderir.' },
            { name: '/aktifoyuncular', value: 'FiveM sunucusundaki aktif oyuncuları listeler.' },
            { name: '/id', value: 'FiveM sunucusunda ID ile oyuncu sorgular.' },
            { name: '/komutlar', value: 'Tüm komutları listeler.' }
        )
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
