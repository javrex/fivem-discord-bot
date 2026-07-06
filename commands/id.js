import { EmbedBuilder } from 'discord.js';
import { GameDig } from 'gamedig';

const FETCH_TIMEOUT = 10000;

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34',
    'zgroup_freeroam': 'play.z-tr.com',
    'wtls': '51.178.185.232',
    'wtls_2': '137.74.153.1',
    'cgn_network': '109.106.1.172',
    'slax_rp': 'slaxrp.ro',
    'transport_tycoon': 'server.tycoon.community'
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

async function getPlayersFromA2S(host, port) {
    try {
        const state = await GameDig.query({
            type: 'gta5f',
            host, port: parseInt(port),
            socketTimeout: 5000
        });
        return (state.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0,
            identifiers: []
        }));
    } catch {
        return null;
    }
}

async function getPlayersFromHTTP(host, port) {
    const res = await fetchWithTimeout(`http://${host}:${port}/players.json`).catch(() => null);
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) return null;
    return data;
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
        let players = await getPlayersFromA2S(host, port);
        if (!players) players = await getPlayersFromHTTP(host, port);
        if (!players) {
            return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
        }

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

        const embed = new EmbedBuilder()
            .setColor(0x2d3436)
            .setTitle('Oyuncu Bilgisi')
            .setDescription(`${displayName} — ID: **${playerId}**`)
            .addFields(
                { name: 'İsim', value: escapeMD(player.name || 'Bilinmiyor'), inline: true },
                { name: 'ID', value: `\`${player.id}\``, inline: true },
                { name: 'Ping', value: `\`${player.ping || '?'} ms\``, inline: true },
                { name: 'Discord', value: discordId ? `<@${discordId.replace('discord:', '')}>` : 'Tanımlanmamış', inline: true },
                { name: 'Steam', value: steamId ? `\`${steamId}\`` : 'Tanımlanmamış', inline: true },
                { name: 'Sunucu', value: displayName, inline: true }
            )
            .setFooter({ text: address })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}
