import { EmbedBuilder } from 'discord.js';
import config from '../config/index.js';

function isIp(value) {
    return value && (value.includes('.') || value.includes(':'));
}

async function fetchServer(ip) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const port = ip.includes(':') ? ip.split(':')[1] : '30120';
    const host = ip.includes(':') ? ip.split(':')[0] : ip;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
    };

    let response = await fetch(`https://servers-frontend.fivem.net/api/servers/session/${host}:${port}`, {
        signal: controller.signal, headers
    });

    if (!response.ok) {
        response = await fetch(`https://servers-frontend.fivem.net/api/servers/detail/${host}:${port}`, {
            signal: controller.signal, headers
        });
    }

    clearTimeout(timeout);
    return response;
}

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const servers = config.fivemServers || {};
    const serverValue = servers[serverChoice];

    if (!serverValue) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    try {
        const response = await fetchServer(serverValue);

        if (!response.ok) {
            return interaction.editReply({ content: `Sunucu bulunamadı veya cevap vermiyor.` });
        }

        const data = await response.json();
        const server = data.Data || data;

        if (!server) {
            return interaction.editReply({ content: 'Sunucu bilgileri alınamadı.' });
        }

        const players = server.players || [];
        const maxPlayers = server.svMaxclients || '?';
        const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace('_', ' ');

        let playerList;
        if (players.length > 0) {
            const list = players.slice(0, 30).map(p => `• ${p.name || 'İsimsiz'}`).join('\n');
            playerList = players.length > 30
                ? `${list}\n... ve ${players.length - 30} kişi daha`
                : list;
        } else {
            playerList = 'Henüz oyuncu yok.';
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(displayName)
            .setDescription(`**Oyuncular:** ${players.length}/${maxPlayers}`)
            .addFields({ name: `Aktif Oyuncular (${players.length})`, value: playerList })
            .setFooter({ text: `Sunucu: ${displayName}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        if (error.name === 'AbortError') {
            await interaction.editReply({ content: 'Sunucu yanıt vermedi, lütfen tekrar deneyin.' });
        } else {
            console.error('FiveM API hatası:', error);
            await interaction.editReply({ content: 'Sunucu sorgulanırken hata oluştu.' });
        }
    }
}
