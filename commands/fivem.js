import { EmbedBuilder } from 'discord.js';

const FETCH_TIMEOUT = 10000;

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'md_pvp': '46.203.182.30',
    'guid_pvp': '141.98.50.34'
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

    const hostname = info.vars?.sv_hostname || info.vars?.sv_projectName || info.hostname || host;
    const clients = typeof info.clients === 'number' ? info.clients : (Array.isArray(players) ? players.length : 0);
    const maxClients = info.vars?.sv_maxClients || info.vars?.sv_maxclients || info.svMaxclients || '?';

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
    const address = KNOWN_SERVERS[serverChoice];

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

        const players = Array.isArray(result.players) ? result.players : [];
        const playerCount = players.length;
        const maxClients = result.maxClients;

        let playerList;
        if (players.length === 0) {
            playerList = 'Henüz oyuncu yok.';
        } else {
            const maxShow = 25;
            const shown = players.slice(0, maxShow);
            const lines = shown.map((p, i) => `\`${String(p.id).padEnd(4)}\` ${p.name || 'İsimsiz'} \`${p.ping || '?'}ms\``);
            playerList = lines.join('\n');
            if (players.length > maxShow) {
                playerList += `\n… ve ${players.length - maxShow} kişi daha`;
            }
        }

        const color = playerCount === 0 ? 0x95a5a6
            : playerCount < maxClients / 2 ? 0x2ecc71
            : playerCount < maxClients * 0.8 ? 0xf39c12
            : 0xe74c3c;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(displayName)
            .setDescription(`**${playerCount}** / **${maxClients}** oyuncu aktif`)
            .addFields({ name: `Oyuncu Listesi (${playerCount})`, value: playerList })
            .setFooter({ text: `${host}:${port}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}
