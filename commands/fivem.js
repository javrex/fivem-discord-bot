import { EmbedBuilder } from 'discord.js';
import config from '../config/index.js';

const FETCH_TIMEOUT = 10000;

function parseAddress(value) {
    const parts = value.split(':');
    return { host: parts[0], port: parts[1] || '30120' };
}

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

async function queryServerDirect(host, port) {
    const baseUrl = `http://${host}:${port}`;
    let anySuccess = false;

    const [infoRes, playersRes] = await Promise.all([
        fetchWithTimeout(`${baseUrl}/info.json`).catch(() => null),
        fetchWithTimeout(`${baseUrl}/players.json`).catch(() => null)
    ]);

    let info = {};
    let players = [];

    if (infoRes && infoRes.ok) {
        anySuccess = true;
        try { info = await infoRes.json(); } catch {}
    }

    if (playersRes && playersRes.ok) {
        anySuccess = true;
        try { players = await playersRes.json(); } catch {}
    }

    const hostname = info.vars?.sv_hostname || info.hostname || host;
    const clients = typeof info.clients === 'number' ? info.clients : (Array.isArray(players) ? players.length : 0);
    const maxClients = info.vars?.sv_maxclients || info.svMaxclients || '?';

    return { hostname, clients, maxClients, players: Array.isArray(players) ? players : [], anySuccess };
}

async function queryServerCfx(host, port) {
    const urls = [
        `https://servers-frontend.fivem.net/api/servers/session/${host}:${port}`,
        `https://servers-frontend.fivem.net/api/servers/detail/${host}:${port}`
    ];

    for (const url of urls) {
        const res = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            const sv = data.Data || data;
            if (sv && sv.players) {
                return {
                    hostname: sv.hostname || host,
                    clients: sv.clients || 0,
                    maxClients: sv.svMaxclients || '?',
                    players: Array.isArray(sv.players) ? sv.players : []
                };
            }
        }
    }
    return null;
}

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const servers = config.fivemServers || {};
    const address = servers[serverChoice];

    if (!address) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    const { host, port } = parseAddress(address);
    const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace('_', ' ');

    try {
        let result = await queryServerDirect(host, port);

        if (!result.anySuccess) {
            const cfx = await queryServerCfx(host, port);
            if (cfx) result = cfx;
        }

        const playerCount = Array.isArray(result.players) ? result.players.length : (result.clients || 0);
        const playerList = result.players.length > 0
            ? result.players.slice(0, 30).map(p => `• ${p.name || 'İsimsiz'}`).join('\n')
            : 'Henüz oyuncu yok.';

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(displayName)
            .setDescription(`**Oyuncular:** ${playerCount}/${result.maxClients}`)
            .addFields({ name: `Aktif Oyuncular (${playerCount})`, value: playerList })
            .setFooter({ text: `${host}:${port}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('FiveM sorgu hatası:', error);
        await interaction.editReply({ content: 'Sunucu sorgulanırken hata oluştu.' });
    }
}
