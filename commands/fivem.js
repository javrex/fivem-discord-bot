import { EmbedBuilder } from 'discord.js';
import config from '../config/index.js';

export async function execute(interaction) {
    await interaction.deferReply();

    const serverChoice = interaction.options.getString('server');
    const servers = config.fivemServers || {};
    const serverId = servers[serverChoice];

    if (!serverId) {
        return interaction.editReply({ content: 'Sunucu bulunamadı.' });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return interaction.editReply({ content: `Sunucu bulunamadı. (${response.status})` });
        }

        const data = await response.json();
        const server = data.Data;

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
            .setTitle(`${displayName}`)
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
