import { EmbedBuilder } from 'discord.js';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34',
    'md_pvp': '46.203.182.30'
};

const CFX_SERVERS = {
    'md_rp': 'xjx5kr',
    'alesta_rp': 'gm3g4q',
    'md_pvp': 'z5gxl9'
};

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

async function fetchPlayersHTTP(host, port) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(`http://${host}:${port}/players.json`, { signal: controller.signal });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? data : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchPlayersCfx(joinCode) {
    try {
        const res = await fetch(`https://frontend.cfx-services.net/api/servers/single/${joinCode}`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.Data?.players || null;
    } catch {
        return null;
    }
}

export async function execute(interaction) {
    await interaction.deferReply();

    try {
        const serverChoice = interaction.options.getString('server');
        const playerId = interaction.options.getInteger('id');
        const cfxCode = CFX_SERVERS[serverChoice];

        let players;
        if (cfxCode) {
            players = await fetchPlayersCfx(cfxCode);
        } else {
            const address = KNOWN_SERVERS[serverChoice];
            if (!address) {
                return interaction.editReply({ content: 'Sunucu bulunamadı.' });
            }
            const parts = address.split(':');
            const host = parts[0];
            const port = parts[1] || '30120';
            players = await fetchPlayersHTTP(host, port);
        }

        if (!players) {
            return interaction.editReply({ content: `${serverChoice} sunucusuna erişilemedi.` });
        }

        if (players.length === 0) {
            return interaction.editReply({ content: 'Sunucuda hiç oyuncu yok.' });
        }

        const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');

        const player = players.find(p => p.id === playerId);

        if (!player) {
            return interaction.editReply({
                content: `${displayName} sunucusunda **ID ${playerId}** ile eşleşen oyuncu bulunamadı.`
            });
        }

        const discordId = (player.identifiers || []).find(i => i.startsWith('discord:'));
        const steamId = (player.identifiers || []).find(i => i.startsWith('steam:'));

        const address = cfxCode ? `cfx.re/join/${cfxCode}` : KNOWN_SERVERS[serverChoice] || '';
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