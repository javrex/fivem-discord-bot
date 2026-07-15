import { EmbedBuilder } from 'discord.js';

export async function execute(interaction) {
    const botAvatar = interaction.client.user.displayAvatarURL({ size: 256 });

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('📋 Komutlar')
        .setDescription('Botun tüm komutları kategorilere ayrılmış şekilde aşağıda listelenmiştir.')
        .setThumbnail(botAvatar)
        .addFields(
            {
                name: '🎮 FiveM Komutları',
                value: [
                    '**</aktifoyuncular:1>**',
                    'Kayıtlı tüm FiveM sunucularındaki aktif oyuncuları listeler. Oyuncular arasında arama yapabilir, Server ID ve ping bilgilerini görüntüleyebilirsin.',
                    '',
                    '**</karşılaştır:2>**',
                    'İki kayıtlı FiveM sunucusunu oyuncu sayısı, doluluk oranı, durum, harita, OneSync, Voice ve build bilgisiyle karşılaştırır. Otomatik kazanan belirler.',
                    '',
                    '**</takip:3>**',
                    'Belirlediğin oyuncuyu takip eder. Oyuncu kayıtlı sunuculardan herhangi birine giriş yaptığında belirlediğin kanala bildirim gönderir. Spam koruması dahildir.',
                    '',
                    '**</id:4>**',
                    'FiveM sunucusunda Server ID ile oyuncu sorgular ve oyuncunun Discord ID, Steam ID gibi bilgilerini görüntüler.',
                    '',
                    '**</tag:5>**',
                    'Tüm kayıtlı sunucularda beş harf ve üzeri FiveM isimlerinde etiket araması yapar.'
                ].join('\n'),
                inline: false
            },
            {
                name: '🛡️ Moderasyon Komutları',
                value: [
                    '**</bansorgu:6>**',
                    'Belirli bir kullanıcının sunucuda banlı olup olmadığını kontrol eder. Ban sebebi, banlayan yetkili ve tarih bilgilerini gösterir (Audit Log bulunursa).',
                    '',
                    '**</banliste:7>**',
                    'Sunucudaki tüm banlı kullanıcıları sayfalı olarak listeler. Ban sebebi ve moderatör bilgisi gösterilir.',
                    '',
                    '**</sunuculog:8>**',
                    'Discord Audit Log kayıtlarını kategorilere ayırarak görüntüler. Ban, Kick, Timeout, Rol, Kanal, Nickname ve Sunucu loglarını içerir.',
                    '',
                    '**</toplusescekme:9>**',
                    'Belirtilen ses kanalına sunucudaki tüm kullanıcıları tek seferde taşır.'
                ].join('\n'),
                inline: false
            },
            {
                name: '👤 Kullanıcı Komutları',
                value: [
                    '**</profil:10>**',
                    'Kullanıcı hesabı hakkında detaylı bilgi gösterir: Discord ID, hesap yaşı, rozetler, roller, ses durumu, aktivite, boost süresi ve profil rengi.',
                    '',
                    '**</komutlar:11>**',
                    'Tüm komutları kategorilere ayrılmış şekilde listeler.'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔧 Buton / Menü Komutları',
                value: [
                    '**</aktiflik:12>**',
                    'Katılım buton mesajı gönderir. Kullanıcılar Katıl/Ayrıl butonlarıyla listeye eklenir.',
                    '',
                    '**</aktiflikbitir:13>**',
                    'Aktiflik mesajını sonlandırır ve butonları kaldırır.',
                    '',
                    '**</ingame:14>**',
                    'Ingame buton mesajı gönderir. Katıl, Yedek ve Ayrıl butonları bulunur.',
                    '',
                    '**</maddex:15>**',
                    'Maddex buton mesajı gönderir. Katılanlar 20 kişiyle sınırlıdır, taşanlar yedek listesine eklenir.',
                    '',
                    '**</ticketkur:16>**',
                    'Ticket panel mesajını kanala gönderir. Kullanıcılar buton ile ticket açabilir.',
                    '',
                    '**</mesaj:17>**',
                    'Bot ile belirtilen kanala özel mesaj gönderir.'
                ].join('\n'),
                inline: false
            }
        )
        .addFields({
            name: '💡 Not',
            value: 'Bazı bilgiler Discord API veya FiveM sunucusunun gizlilik ayarları nedeniyle görüntülenemeyebilir. Tüm komutların başında `/` kullanmayı unutma.',
            inline: false
        })
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
