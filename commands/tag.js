import { EmbedBuilder } from 'discord.js';
import { GameDig } from 'gamedig';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34'
};

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

async function getPlayers(host, port) {
    try {
        const state = await GameDig.query({
            type: 'gta5f',
            host, port: parseInt(port),
            socketTimeout: 3000,
            attemptTimeout: 3000,
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
            const timer = setTimeout(() => controller.abort(), 4000);
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

export async function execute(interaction) {
    const search = interaction.options.getString('isim').toLowerCase();

    await interaction.reply({ content: '🔍 Aranıyor...' });

    const embeds = [];

    for (const [key, address] of Object.entries(KNOWN_SERVERS)) {
        const parts = address.split(':');
        const host = parts[0];
        const port = parts[1] || '30120';
        const displayName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

        const players = await getPlayers(host, port);
        const matched = players.filter(p => p.name && p.name.toLowerCase().includes(search));
        if (matched.length === 0) continue;

        const lines = matched.map(p => {
            const name = escapeMD(p.name || 'İsimsiz');
            return `\`#${String(p.id).padEnd(3)}\` ${name} — \`${p.ping || '?'}ms\``;
        });

        embeds.push(new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle(`${displayName} — ${matched.length} oyuncu`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `${host}:${port}` })
            .setTimestamp());
    }

    if (embeds.length === 0) {
        await interaction.editReply({ content: `"${interaction.options.getString('isim')}" ile eşleşen oyuncu bulunamadı.` });
    } else {
        await interaction.editReply({ content: null, embeds });
    }
}