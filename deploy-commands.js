import { REST, Routes, SlashCommandBuilder, ChannelType } from 'discord.js';
import config from './config/index.js';

const commands = [
    new SlashCommandBuilder()
        .setName('aktiflik')
        .setDescription('Aktiflik buton mesajı gönderir'),

    new SlashCommandBuilder()
        .setName('ingame')
        .setDescription('Ingame buton mesajı gönderir'),

    new SlashCommandBuilder()
        .setName('maddex')
        .setDescription('Maddex buton mesajı gönderir (maksimum 20 kişi)'),

    new SlashCommandBuilder()
        .setName('toplusescekme')
        .setDescription('Ses kanalındaki herkesi seçilen kanala taşır')
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Taşınacak ses kanalı')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('aktiflikbitir')
        .setDescription('Aktiflik mesajını sonlandırır'),

    new SlashCommandBuilder()
        .setName('komutlar')
        .setDescription('Tüm komutları listeler'),

    new SlashCommandBuilder()
        .setName('ticketkur')
        .setDescription('Ticket panel mesajını gönderir'),

    new SlashCommandBuilder()
        .setName('mesaj')
        .setDescription('Bot ile mesaj gönderir')
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Mesajın gönderileceği kanal')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mesaj')
                .setDescription('Gönderilecek mesaj')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('aktifoyuncular')
        .setDescription('FiveM sunucusundaki aktif oyuncuları listeler')
        .addStringOption(option =>
            option.setName('server')
                .setDescription('Sorgulanacak sunucu')
                .addChoices(
                    { name: 'Well', value: 'well' },
                    { name: 'Alesta Rp', value: 'alesta_rp' },
                    { name: 'Guid Pvp', value: 'guid_pvp' },
                    { name: 'Z-Group FreeRoam', value: 'zgroup_freeroam' },
                    { name: 'Welcome to LS', value: 'wtls' },
                    { name: 'Welcome to LS 2', value: 'wtls_2' },
                    { name: 'CGN Network', value: 'cgn_network' },
                    { name: 'Slax RP', value: 'slax_rp' },
                    { name: 'Transport Tycoon', value: 'transport_tycoon' }
                )
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('id')
        .setDescription('ID ile oyuncu sorgula')
        .addStringOption(option =>
            option.setName('server')
                .setDescription('Sunucu seçin')
                .addChoices(
                    { name: 'Well', value: 'well' },
                    { name: 'Alesta Rp', value: 'alesta_rp' },
                    { name: 'Guid Pvp', value: 'guid_pvp' },
                    { name: 'Z-Group FreeRoam', value: 'zgroup_freeroam' },
                    { name: 'Welcome to LS', value: 'wtls' },
                    { name: 'Welcome to LS 2', value: 'wtls_2' },
                    { name: 'CGN Network', value: 'cgn_network' },
                    { name: 'Slax RP', value: 'slax_rp' },
                    { name: 'Transport Tycoon', value: 'transport_tycoon' }
                )
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('Oyuncu ID')
                .setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(config.token);

try {
    console.log('Komutlar kaydediliyor...');

    await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands.map(cmd => cmd.toJSON()) }
    );

    console.log('Komutlar başarıyla kaydedildi!');
} catch (error) {
    console.error('Komut kaydedilirken hata:', error);
}
