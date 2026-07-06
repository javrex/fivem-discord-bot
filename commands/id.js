import { EmbedBuilder } from 'discord.js';

const FETCH_TIMEOUT = 10000;

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'md_pvp': '46.203.182.30',
    'guid_pvp': '141.98.50.34',
    'dady_pvp': '46.203.182.68'
};

async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const playerId = interaction.options.getInteger('id');
    const address = KNOWN_SERVERS[serverChoice];

    if (!address) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    const parts = address.split(':');
    const host = parts[0];
    const port = parts[1] || '30120';
    const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');

    try {
        const res = await fetchWithTimeout(`http://${host}:${port}/players.json`);

        if (!res || !res.ok) {
            return interaction.editReply({ content: 'Sunucudan oyuncu listesi alınamadı.' });
        }

        const players = await res.json();

        if (!Array.isArray(players) || players.length === 0) {
            return interaction.editReply({ content: 'Sunucuda hiç oyuncu yok.' });
        }

        const player = players.find(p => p.id === playerId);

        if (!player) {
            return interaction.editReply({
                content: `${displayName} sunucusunda **ID ${playerId}** ile eşleşen oyuncu bulunamadı.`
            });
        }

        const discordId = (player.identifiers || []).find(i => i.startsWith('discord:'));
        const steamId = (player.identifiers || []).find(i => i.startsWith('steam:'));

        const discordValue = discordId
            ? `<@${discordId.replace('discord:', '')}>`
            : 'Tanımlanmamış';
        const steamValue = steamId
            ? `\`${steamId}\``
            : 'Tanımlanmamış';

        const embed = new EmbedBuilder()
            .setColor(0x2d3436)
            .setTitle('Oyuncu Bilgisi')
            .setDescription(`${displayName} — ID: **${playerId}**`)
            .addFields(
                { name: 'İsim', value: escapeMD(player.name || 'Bilinmiyor'), inline: true },
                { name: 'ID', value: `\`${player.id}\``, inline: true },
                { name: 'Ping', value: `\`${player.ping || '?'} ms\``, inline: true },
                { name: 'Discord', value: discordValue, inline: true },
                { name: 'Steam', value: steamValue, inline: true },
                { name: 'Sunucu', value: displayName, inline: true }
            )
            .setFooter({ text: `${host}:${port}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}
