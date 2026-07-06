import { EmbedBuilder } from 'discord.js';
import { GameDig } from 'gamedig';

const FETCH_TIMEOUT = 10000;

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'md_pvp': '46.203.182.30',
    'guid_pvp': '141.98.50.34',
    'fave_pvp': '46.203.182.16',
    'gun_pvp': 'cfx:qqa5q44',
    'md_rp': '185.29.166.7',
    'lol_pvp': '45.8.187.16'
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

async function getPlayersFromCfx(host, port) {
    const endpoint = port ? `${host}:${port}` : host;
    const res = await fetchWithTimeout(`https://servers-frontend.fivem.net/api/servers/session/${endpoint}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }
    }).catch(() => null);
    if (!res || !res.ok) return null;
    const data = await res.json().catch(() => null);
    const sv = data?.Data || data;
    if (sv && Array.isArray(sv.players)) return sv.players;
    return null;
}

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const playerId = interaction.options.getInteger('id');
    const address = KNOWN_SERVERS[serverChoice];

    if (!address) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');

    try {
        let players;

        if (address.startsWith('cfx:')) {
            players = await getPlayersFromCfx(address.replace('cfx:', ''));
            if (!players) {
                return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
            }
        } else {
            const parts = address.split(':');
            const host = parts[0];
            const port = parts[1] || '30120';
            players = await getPlayersFromA2S(host, port);
            if (!players) players = await getPlayersFromHTTP(host, port);
            if (!players) players = await getPlayersFromCfx(host, port);
            if (!players) {
                return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
            }
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
            .setFooter({ text: address.startsWith('cfx:') ? `cfx:${address.replace('cfx:', '')}` : address })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}
