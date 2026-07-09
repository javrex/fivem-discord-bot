import { EmbedBuilder } from 'discord.js';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34'
};

function parseAddress(value) {
    const parts = value.split(':');
    return { host: parts[0], port: parts[1] || '30120' };
}

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

function makeBar(current, max, length = 8) {
    const m = typeof max === 'number' && max > 0 ? max : 100;
    const filled = Math.round((current / m) * length);
    return '🟩'.repeat(Math.min(filled, length)) + '⬜'.repeat(Math.max(length - filled, 0));
}

async function fetchJSON(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function queryServer(host, port) {
    const [info, players] = await Promise.all([
        fetchJSON(`http://${host}:${port}/info.json`),
        fetchJSON(`http://${host}:${port}/players.json`)
    ]);

    if (!info && !players) return null;

    const hostname = info?.vars?.sv_hostname || info?.vars?.sv_projectName || info?.hostname || host;
    const clients = typeof info?.clients === 'number' ? info.clients : (Array.isArray(players) ? players.length : 0);
    const maxClients = info?.vars?.sv_maxClients || info?.vars?.sv_maxclients || info?.svMaxclients || '?';

    return { hostname, clients, maxClients, players: Array.isArray(players) ? players : [] };
}

export async function execute(interaction) {
    await interaction.deferReply();

    try {
        const serverChoice = interaction.options.getString('server');
        const address = KNOWN_SERVERS[serverChoice];

        if (!address) {
            return interaction.editReply({ content: 'Sunucu bulunamadı.' });
        }

        const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');
        const { host, port } = parseAddress(address);

        const result = await queryServer(host, port);
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