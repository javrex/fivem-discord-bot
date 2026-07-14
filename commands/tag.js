import { EmbedBuilder } from 'discord.js';
import { GameDig } from 'gamedig';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34'
};

const CFX_SERVERS = {
    'md_rp': 'xjx5kr',
    'alesta_rp': 'gm3g4q',
    'md_pvp': 'z5gxl9',
    'pwuc_rp': 'bdxpkrp',
    'ria_rp': 'zjvqmgd'
};

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

async function getPlayers(host, port) {
    try {
        const state = await GameDig.query({
            type: 'gta5f',
            host, port: parseInt(port),
            socketTimeout: 2000,
            attemptTimeout: 2000,
            maxAttempts: 1
        });
        return (state.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
    } catch {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`http://${host}:${port}/players.json`, { signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
                const data = await res.json();
                return Array.isArray(data) ? data : [];
            }
        } catch {}
        return [];
    }
}

async function getPlayersFromCfx(joinCode) {
    try {
        const res = await fetch(`https://frontend.cfx-services.net/api/servers/single/${joinCode}`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.Data || !data.Data.players) return [];
        return data.Data.players.map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
    } catch {
        return [];
    }
}

export async function execute(interaction) {
    const search = interaction.options.getString('isim').toLowerCase();

    await interaction.reply({ content: '🔍 Aranıyor...' });

    const queries = [];

    for (const [key, address] of Object.entries(KNOWN_SERVERS)) {
        const parts = address.split(':');
        queries.push({ key, host: parts[0], port: parts[1] || '30120', type: 'normal' });
    }

    for (const [key, code] of Object.entries(CFX_SERVERS)) {
        queries.push({ key, code, type: 'cfx' });
    }

    const results = await Promise.all(queries.map(async (q) => {
        const displayName = q.key.charAt(0).toUpperCase() + q.key.slice(1).replace(/_/g, ' ');
        const players = q.type === 'cfx' ? await getPlayersFromCfx(q.code) : await getPlayers(q.host, q.port);
        const matched = players.filter(p => p.name && p.name.toLowerCase().includes(search));
        return { displayName, matched, host: q.code || q.host, port: q.type === 'cfx' ? '' : q.port, isCfx: q.type === 'cfx', code: q.code };
    }));

    const embeds = [];

    for (const r of results) {
        if (r.matched.length === 0) continue;
        const lines = r.matched.map(p => {
            const name = escapeMD(p.name || 'İsimsiz');
            return `\`#${String(p.id).padEnd(3)}\` ${name} — \`${p.ping || '?'}ms\``;
        });
        embeds.push(new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle(`${r.displayName} — ${r.matched.length} oyuncu`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: r.isCfx ? `cfx.re/join/${r.code}` : `${r.host}:${r.port}` })
            .setTimestamp());
    }

    if (embeds.length === 0) {
        await interaction.editReply({ content: `"${interaction.options.getString('isim')}" ile eşleşen oyuncu bulunamadı.` });
    } else {
        await interaction.editReply({ content: null, embeds });
    }
}