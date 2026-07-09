import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GameDig } from 'gamedig';

const KNOWN_SERVERS = {
    'well': '5.231.120.202',
    'alesta_rp': 'alestarp.com',
    'guid_pvp': '141.98.50.34',
    'md_rp': '185.29.166.7'
};

const CFX_SERVERS = {
    'md_rp': 'xjx5kr'
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

async function queryA2S(host, port) {
    try {
        const state = await GameDig.query({
            type: 'gta5f',
            host, port: parseInt(port),
            socketTimeout: 3000,
            attemptTimeout: 3000,
            maxAttempts: 1
        });
        const players = (state.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
        return {
            hostname: state.name || host,
            clients: players.length,
            maxClients: state.maxplayers || '?',
            players
        };
    } catch {
        return null;
    }
}

async function queryHTTP(host, port) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const [infoRes, playersRes] = await Promise.all([
            fetch(`http://${host}:${port}/info.json`, { signal: controller.signal }).catch(() => null),
            fetch(`http://${host}:${port}/players.json`, { signal: controller.signal }).catch(() => null)
        ]);

        if ((!infoRes || !infoRes.ok) && (!playersRes || !playersRes.ok)) return null;

        let info = {};
        let players = [];

        if (infoRes && infoRes.ok) {
            try { info = await infoRes.json(); } catch {}
        }
        if (playersRes && playersRes.ok) {
            try { players = await playersRes.json(); } catch {}
        }

        const hostname = info.vars?.sv_hostname || info.vars?.sv_projectName || info.hostname || host;
        const clients = typeof info.clients === 'number' ? info.clients : (Array.isArray(players) ? players.length : 0);
        const maxClients = info.vars?.sv_maxClients || info.vars?.sv_maxclients || info.svMaxclients || '?';

        return { hostname, clients, maxClients, players: Array.isArray(players) ? players : [] };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function queryServer(host, port) {
    let result = await queryA2S(host, port);
    if (!result) result = await queryHTTP(host, port);
    return result;
}

async function queryCfxAPI(joinCode) {
    try {
        const res = await fetch(`https://frontend.cfx-services.net/api/servers/single/${joinCode}`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.Data) return null;
        const players = (data.Data.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
        return {
            hostname: data.Data.hostname || joinCode,
            clients: data.Data.clients || players.length,
            maxClients: data.Data.svMaxclients || data.Data.sv_maxclients || '?',
            players
        };
    } catch {
        return null;
    }
}

async function getDetailedPlayerList(serverKey) {
    const cfxCode = CFX_SERVERS[serverKey];
    if (cfxCode) {
        try {
            const res = await fetch(`https://frontend.cfx-services.net/api/servers/single/${cfxCode}`, {
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
    const address = KNOWN_SERVERS[serverKey];
    if (!address) return null;
    const { host, port } = parseAddress(address);
    const result = await queryServer(host, port);
    return result?.players || null;
}

function formatPlayerDetailed(p) {
    const discordId = (p.identifiers || []).find(id => id.startsWith('discord:'));
    return [
        `👤 **${escapeMD(p.name || 'İsimsiz')}**`,
        `🆔 Server ID: \`${typeof p.id === 'number' ? p.id : 0}\``,
        discordId ? `💬 Discord: \`${discordId.replace('discord:', '')}\`` : `💬 Discord: Bulunamadı`,
        `📶 Ping: \`${p.ping || '?'}ms\``,
    ].join('\n');
}

function buildDetailedEmbed(serverKey, players, page, perPage = 5) {
    const displayName = serverKey.charAt(0).toUpperCase() + serverKey.slice(1).replace(/_/g, ' ');
    const totalPages = Math.ceil(players.length / perPage) || 1;
    const start = page * perPage;
    const pagePlayers = players.slice(start, start + perPage);
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`🔎 ${displayName} — Detaylı Sorgu`)
        .setDescription(pagePlayers.length > 0 ? pagePlayers.map(formatPlayerDetailed).join('\n\n') : 'Oyuncu bulunamadı.')
        .setFooter({ text: `Sayfa ${page + 1}/${totalPages} • ${players.length} oyuncu` })
        .setTimestamp();
    return embed;
}

function buildDetailButtons(serverKey, page, totalPages) {
    const row = new ActionRowBuilder();
    if (totalPages > 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`prev~${serverKey}~${page}`)
                .setLabel('Önceki Sayfa')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅')
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`next~${serverKey}~${page}`)
                .setLabel('Sonraki Sayfa')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➡')
                .setDisabled(page >= totalPages - 1),
        );
    }
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`refresh~${serverKey}~${page}`)
            .setLabel('Yenile')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
    );
    return row;
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

        const parsed = parseAddress(address);
        let host = parsed.host;
        let port = parsed.port;
        let cfxCode = CFX_SERVERS[serverChoice];

        // Cfx.re'de kayıtlı sunucular doğrudan Cfx.re API'den sorgulanır
        let result = cfxCode
            ? await queryCfxAPI(cfxCode)
            : await queryServer(host, port);

        if (result && cfxCode) {
            host = cfxCode;
            port = '';
        }

        if (!result) {
            return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
        }

        const isCfx = cfxCode && !port;

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

        const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription([
                `╔════════════════════╗`,
                `     🎮 ${displayName}`,
                `╚════════════════════╝`,
                '',
                `🟢 **${playerCount > 0 ? 'Çevrimiçi' : 'Boş'}**`,
                `👥 **${playerCount}** / ${result.maxClients}`,
                `🌐 ${isCfx ? `cfx.re/join/${cfxCode}` : `${host}:${port}`}`,
                '',
                ...(lines.length > 0
                    ? [`${bar}`, '', ...lines]
                    : ['Sunucuda aktif oyuncu bulunmuyor.']),
                ...(playerCount > maxShow ? [`*+${playerCount - maxShow} oyuncu daha*`] : []),
                '',
                `────────────`,
                `🔄 Son güncelleme: <t:${Math.floor(Date.now() / 1000)}:R>`
            ].join('\n'));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`detayli~${serverChoice}~0`)
                .setLabel('Detaylı Sorgu')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔎')
        );

        const reply = await interaction.editReply({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === interaction.user.id && i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (i) => {
            const [action, key, pageStr] = i.customId.split('~');
            const currentPage = parseInt(pageStr) || 0;

            if (action === 'detayli') {
                await i.deferUpdate();
                const rawPlayers = await getDetailedPlayerList(key);
                if (!rawPlayers || rawPlayers.length === 0) {
                    await i.editReply({ content: 'Oyuncu verisi alınamadı.', embeds: [], components: [] });
                    return;
                }
                const totalPages = Math.ceil(rawPlayers.length / 5) || 1;
                const detailEmbed = buildDetailedEmbed(key, rawPlayers, 0, 5);
                const detailBtns = buildDetailButtons(key, 0, totalPages);
                await i.editReply({ embeds: [detailEmbed], components: [detailBtns] });
                return;
            }

            await i.deferUpdate();
            const rawPlayers = await getDetailedPlayerList(key);
            if (!rawPlayers || rawPlayers.length === 0) {
                await i.editReply({ content: 'Oyuncu verisi alınamadı.', embeds: [], components: [] });
                return;
            }

            let newPage = currentPage;
            if (action === 'prev') newPage = Math.max(0, currentPage - 1);
            if (action === 'next') newPage = currentPage + 1;

            const totalPages = Math.ceil(rawPlayers.length / 5) || 1;
            const detailEmbed = buildDetailedEmbed(key, rawPlayers, newPage, 5);
            const detailBtns = buildDetailButtons(key, newPage, totalPages);
            await i.editReply({ embeds: [detailEmbed], components: [detailBtns] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}