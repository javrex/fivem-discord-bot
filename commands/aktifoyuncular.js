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

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

function makeBar(current, max, length = 8) {
    const m = typeof max === 'number' && max > 0 ? max : 100;
    const filled = Math.round((current / m) * length);
    return '🟩'.repeat(Math.min(filled, length)) + '⬜'.repeat(Math.max(length - filled, 0));
}

async function queryA2S(host, port) {
    try {
        const state = await GameDig.query({
            type: 'gta5f',
            host, port: parseInt(port),
            socketTimeout: 5000
        });
        const players = (state.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
        return {
            hostname: state.name || host,
            clients: players.length,
            maxClients: state.maxplayers || '?',
            players,
            anySuccess: true
        };
    } catch {
        return null;
    }
}

async function queryHTTP(host, port) {
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

    if (!anySuccess) return null;

    const hostname = info.vars?.sv_hostname || info.vars?.sv_projectName || info.hostname || host;
    const clients = typeof info.clients === 'number' ? info.clients : (Array.isArray(players) ? players.length : 0);
    const maxClients = info.vars?.sv_maxClients || info.vars?.sv_maxclients || info.svMaxclients || '?';

    return { hostname, clients, maxClients, players: Array.isArray(players) ? players : [], anySuccess: true };
}

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const address = KNOWN_SERVERS[serverChoice];

    if (!address) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');
    const { host, port } = parseAddress(address);

    try {
        let result = await queryA2S(host, port);
        if (!result) result = await queryHTTP(host, port);
        if (!result) {
            return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
        }

        const players = Array.isArray(result.players) ? result.players : [];
        const playerCount = players.length;
        const maxVal = typeof result.maxClients === 'number' ? result.maxClients : parseInt(result.maxClients) || 0;

        const bar = makeBar(playerCount, maxVal || playerCount || 1);
        const maxShow = 60;
        const shown = players.slice(0, maxShow);

        const lines = shown.map(p => {
            const name = escapeMD(p.name || 'İsimsiz');
            return `\`#${String(p.id).padEnd(3)}\` ${name} — \`${p.ping || '?'}ms\``;
        });

        const color = playerCount === 0 ? 0x636e72
            : playerCount < (maxVal || 100) / 2 ? 0x00b894
            : playerCount < (maxVal || 100) * 0.8 ? 0xfdcb6e
            : 0xd63031;

        let descLines = [`${bar}  **${playerCount} / ${result.maxClients}**`];
        if (lines.length > 0) {
            descLines.push('');
            descLines = descLines.concat(lines);
        }
        if (playerCount > maxShow) {
            descLines.push(`*+${playerCount - maxShow} oyuncu daha listelenemedi*`);
        }
        if (playerCount === 0) {
            descLines.push('Sunucuda aktif oyuncu bulunmuyor.');
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(displayName)
            .setDescription(descLines.join('\n'))
            .setFooter({ text: `${host}:${port}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}
