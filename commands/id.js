import { EmbedBuilder } from 'discord.js';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34'
};

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}

async function fetchPlayers(host, port) {
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

export async function execute(interaction) {
    await interaction.deferReply();

    try {
        const serverChoice = interaction.options.getString('server');
        const playerId = interaction.options.getInteger('id');
        const address = KNOWN_SERVERS[serverChoice];

        if (!address) {
            return interaction.editReply({ content: 'Sunucu bulunamadı.' });
        }

        const parts = address.split(':');
        const host = parts[0];
        const port = parts[1] || '30120';
        const displayName = serverChoice.charAt(0).toUpperCase() + serverChoice.slice(1).replace(/_/g, ' ');

        const players = await fetchPlayers(host, port);
        if (!players) {
            return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
        }

        if (players.length === 0) {
            return interaction.editReply({ content: 'Sunucuda hiç oyuncu yok.' });
        }

        const player = players.find(p => p.id === playerId);

        if (!player) {
            return interaction.editReply({
                content: `${displayName} sunucusunda **ID ${playerId}** ile eşleşen oyuncu bulunamadı.`
            });
        }

        const discordId = (player.identifiers || []).find(i => i.startsWith('discord:'));
        const steamId = (player.identifiers || []).find(i => i.startsWith('steam:'));

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