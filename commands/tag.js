import { EmbedBuilder } from 'discord.js';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34'
};

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
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

        let players = [];
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`http://${host}:${port}/players.json`, { signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) players = data;
            }
        } catch {}

        const matched = players.filter(p => p.name && p.name.toLowerCase().includes(search));
        if (matched.length === 0) continue;

        const lines = matched.map(p => {
            const name = escapeMD(p.name || 'İsimsiz');
            return `\`#${String(p.id).padEnd(3)}\` ${name} — \`${p.ping || '?'}ms\``;
        });

        embeds.push(new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle(`${displayName} — ${matched.length} oyuncu`)
            .setDescription(lines.length > 0 ? lines.join('\n') : 'Eşleşme bulunamadı.')
            .setFooter({ text: `${host}:${port}` })
            .setTimestamp());
    }

    if (embeds.length === 0) {
        await interaction.editReply({ content: `"${interaction.options.getString('isim')}" ile eşleşen oyuncu bulunamadı.` });
    } else {
        await interaction.editReply({ content: null, embeds });
    }
}