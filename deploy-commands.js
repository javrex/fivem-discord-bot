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
        .setName('fivem')
        .setDescription('FiveM sunucu bilgilerini sorgular')
        .addStringOption(option =>
            option.setName('server')
                .setDescription('Sorgulanacak sunucu')
                .addChoices(
                    { name: 'Well', value: 'well' },
                    { name: 'Alesta Rp', value: 'alesta_rp' },
                    { name: 'Md Pvp', value: 'md_pvp' },
                    { name: 'Guid Pvp', value: 'guid_pvp' }
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
                    { name: 'Md Pvp', value: 'md_pvp' },
                    { name: 'Guid Pvp', value: 'guid_pvp' }
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
