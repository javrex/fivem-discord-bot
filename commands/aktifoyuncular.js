import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { GameDig } from 'gamedig';
import { KNOWN_SERVERS, CFX_SERVERS } from '../utils/serverList.js';

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

const playerCache = new Map();
const CACHE_TTL = 30000;

async function getCachedPlayerList(serverKey, force = false) {
    if (!force) {
        const cached = playerCache.get(serverKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    }
    const cfxCode = CFX_SERVERS[serverKey];
    let players = null;
    if (cfxCode) {
        try {
            const res = await fetch(`https://frontend.cfx-services.net/api/servers/single/${cfxCode}`, {
                signal: AbortSignal.timeout(5000),
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (res.ok) {
                const data = await res.json();
                players = data.Data?.players || null;
            }
        } catch { /* ignore */ }
    } else {
        const address = KNOWN_SERVERS[serverKey];
        if (address) {
            const { host, port } = parseAddress(address);
            const result = await queryServer(host, port);
            players = result?.players || null;
        }
    }
    if (players) playerCache.set(serverKey, { data: players, ts: Date.now() });
    return players;
}

function buildPlayerSelectOptions(players, page) {
    const start = page * 25;
    const pagePlayers = players.slice(start, start + 25);
    return pagePlayers.map(p => ({
        label: (p.name || 'İsimsiz').substring(0, 100),
        value: String(typeof p.id === 'number' ? p.id : 0),
        description: `Ping: ${p.ping || '?'}ms • ID: ${p.id}`.substring(0, 100)
    }));
}

function buildMainComponents(serverKey, players, page) {
    const totalPages = Math.ceil(players.length / 25) || 1;
    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`select~${serverKey}`)
            .setPlaceholder('DETAYLI SORGU İÇİN OYUNCU SEÇİN')
            .addOptions(buildPlayerSelectOptions(players, page))
    );
    const navRow = new ActionRowBuilder().addComponents(
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
        new ButtonBuilder()
            .setCustomId(`refresh~${serverKey}~${page}`)
            .setLabel('Yenile')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
    );
    return [selectRow, navRow];
}

function buildPlayerDetailEmbed(displayName, player) {
    const discordId = (player.identifiers || []).find(id => id.startsWith('discord:'));
    const fivemId = (player.identifiers || []).find(id => id.startsWith('license:') || id.startsWith('fivem:'));
    const steamId = (player.identifiers || []).find(id => id.startsWith('steam:'));
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`🔎 ${displayName} — Oyuncu Detayı`)
        .addFields(
            { name: '👤 Oyuncu Adı', value: escapeMD(player.name || 'İsimsiz'), inline: true },
            { name: '🆔 Server ID', value: `\`${typeof player.id === 'number' ? player.id : 0}\``, inline: true },
            { name: '📶 Ping', value: `\`${player.ping || '?'}ms\``, inline: true },
            { name: '💬 Discord ID', value: discordId ? `\`${discordId.replace('discord:', '')}\`` : 'Bulunamadı', inline: false },
            { name: '🎮 FiveM License', value: fivemId ? `\`${fivemId.substring(0, 60)}\`` : 'Bulunamadı', inline: false },
            { name: '🎮 Steam ID', value: steamId ? `\`${steamId}\`` : 'Bulunamadı', inline: false }
        )
        .setFooter({ text: 'Son güncelleme' })
        .setTimestamp();
    return embed;
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

        const playersForSelect = await getCachedPlayerList(serverChoice);
        const [selectRow, navRow] = playersForSelect && playersForSelect.length > 0
            ? buildMainComponents(serverChoice, playersForSelect, 0)
            : [null, null];

        const components = [];
        if (selectRow) components.push(selectRow);
        if (navRow) components.push(navRow);

        const reply = await interaction.editReply({ embeds: [embed], components });

        const filter = i => i.user.id === interaction.user.id && i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (i) => {
            if (i.isStringSelectMenu()) {
                const selectedValue = i.values[0];
                const rawPlayers = await getCachedPlayerList(serverChoice);
                const player = rawPlayers?.find(p => String(p.id) === selectedValue);
                if (player) {
                    const detailEmbed = buildPlayerDetailEmbed(displayName, player);
                    await i.reply({ embeds: [detailEmbed], ephemeral: true });
                } else {
                    await i.reply({ content: 'Oyuncu bulunamadı.', ephemeral: true });
                }
                return;
            }

            const [action, key, pageStr] = i.customId.split('~');
            let newPage = parseInt(pageStr) || 0;

            const rawPlayers = await getCachedPlayerList(key, action === 'refresh');
            if (!rawPlayers || rawPlayers.length === 0) {
                await i.update({ content: 'Oyuncu verisi alınamadı.', embeds: [], components: [] });
                return;
            }

            if (action === 'prev') newPage = Math.max(0, newPage - 1);
            else if (action === 'next') newPage = Math.min(newPage + 1, Math.ceil(rawPlayers.length / 25) - 1);

            const [newSelectRow, newNavRow] = buildMainComponents(key, rawPlayers, newPage);
            await i.update({ embeds: [embed], components: [newSelectRow, newNavRow] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}