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

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

function makeProgressBar(current, max, length = 10) {
    const maxNum = typeof max === 'number' && max > 0 ? max : 100;
    const filled = Math.round((current / maxNum) * length);
    return '🟩'.repeat(Math.min(filled, length)) + '⬜'.repeat(Math.max(length - filled, 0));
}

function chunkPlayers(players, size) {
    const chunks = [];
    for (let i = 0; i < players.length; i += size) chunks.push(players.slice(i, i + size));
    return chunks;
}

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const address = KNOWN_SERVERS[serverChoice];

    if (!address) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    const { host, port } = parseAddress(address);
    const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');

    try {
        let result = await queryServerDirect(host, port);

        if (!result.anySuccess) {
            const cfx = await queryServerCfx(host, port);
            if (cfx) result = cfx;
        }

        const players = Array.isArray(result.players) ? result.players : [];
        const playerCount = players.length;
        const maxVal = typeof result.maxClients === 'number' ? result.maxClients : parseInt(result.maxClients) || 0;

        const bar = makeProgressBar(playerCount, maxVal || playerCount || 1);

        const color = playerCount === 0 ? 0x6c757d
            : playerCount < (maxVal || 100) / 2 ? 0x00b894
            : playerCount < (maxVal || 100) * 0.8 ? 0xfdcb6e
            : 0xe17055;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(displayName)
            .setDescription(`${bar}  **${playerCount}** / **${result.maxClients}**`)
            .setTimestamp();

        if (players.length === 0) {
            embed.addFields({ name: 'Oyuncular', value: 'Sunucuda aktif oyuncu bulunmuyor.' });
        } else {
            const PER_PAGE = 25;
            const chunks = chunkPlayers(players, PER_PAGE);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const start = i * PER_PAGE + 1;
                const end = i * PER_PAGE + chunk.length;
                const label = chunks.length === 1 ? `Oyuncular (${playerCount})` : `Oyuncular ${start}-${end}`;

                const lines = chunk.map(p =>
                    `\`${String(p.id).padEnd(4)}\` ${escapeMD(p.name || 'İsimsiz')} \`${p.ping || '?'}ms\``
                );
                embed.addFields({ name: label, value: lines.join('\n') });
            }
        }

        embed.setFooter({ text: `${host}:${port}` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}
