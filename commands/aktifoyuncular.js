import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { GameDig } from 'gamedig';
import { KNOWN_SERVERS, CFX_SERVERS, ALL_SERVER_KEYS, SERVER_DISPLAY } from '../utils/serverList.js';

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
    const timer = setTimeout(() => controller.abort(), 3000);
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
            signal: AbortSignal.timeout(3000),
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

const serverCache = new Map();
const CACHE_TTL = 30000;

async function fetchServerData(key) {
    const cached = serverCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        refreshInBackground(key);
        return cached.data;
    }
    const cfxCode = CFX_SERVERS[key];
    const address = KNOWN_SERVERS[key];
    if (!address) return null;
    const { host, port } = parseAddress(address);
    const result = cfxCode ? await queryCfxAPI(cfxCode) : await queryServer(host, port);
    if (result) {
        serverCache.set(key, { data: result, ts: Date.now() });
    }
    return result;
}

async function refreshInBackground(key) {
    const cfxCode = CFX_SERVERS[key];
    const address = KNOWN_SERVERS[key];
    if (!address) return;
    const { host, port } = parseAddress(address);
    const result = cfxCode ? await queryCfxAPI(cfxCode) : await queryServer(host, port);
    if (result) {
        serverCache.set(key, { data: result, ts: Date.now() });
    }
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

function buildDetailComponents(serverKey, players, page) {
    const totalPages = Math.ceil(players.length / 25) || 1;
    const hasPlayers = players.length > 0;
    const selectRow = hasPlayers ? new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`select~${serverKey}`)
            .setPlaceholder('DETAYLI SORGU İÇİN OYUNCU SEÇİN')
            .addOptions(buildPlayerSelectOptions(players, page))
    ) : null;
    const navRow = new ActionRowBuilder().addComponents(
        ...(hasPlayers ? [
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
        ] : []),
        new ButtonBuilder()
            .setCustomId('back')
            .setLabel('Geri Dön')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀')
    );
    return [selectRow, navRow];
}

function buildOverviewEmbed(results) {
    const lines = ALL_SERVER_KEYS.map(key => {
        const displayName = SERVER_DISPLAY[key] || key;
        const data = results.get(key);
        if (!data) {
            return `❌ **${displayName}** — Erişilemedi`;
        }
        const players = Array.isArray(data.players) ? data.players : [];
        const maxClients = data.maxClients || '?';
        const bar = makeBar(players.length, typeof maxClients === 'number' ? maxClients : 1);
        return `${bar} **${displayName}** — 👥 ${players.length}/${maxClients}`;
    });

    return new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🎮 Sunucu Durumları')
        .setDescription([
            `╔════════════════════╗`,
            `     🎮 Aktif Oyuncular`,
            `╚════════════════════╝`,
            '',
            ...lines,
            '',
            `────────────`,
            `🔄 Son güncelleme: <t:${Math.floor(Date.now() / 1000)}:R>`
        ].join('\n'));
}

function buildServerDetailEmbed(displayName, data, key) {
    const players = Array.isArray(data.players) ? data.players : [];
    const playerCount = players.length;
    const maxVal = typeof data.maxClients === 'number' ? data.maxClients : parseInt(data.maxClients) || 0;
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
    const cfxCode = CFX_SERVERS[key];
    const address = KNOWN_SERVERS[key];

    return new EmbedBuilder()
        .setColor(color)
        .setDescription([
            `╔════════════════════╗`,
            `     🎮 ${displayName}`,
            `╚════════════════════╝`,
            '',
            `🟢 **${playerCount > 0 ? 'Çevrimiçi' : 'Boş'}**`,
            `👥 **${playerCount}** / ${data.maxClients}`,
            `🌐 ${cfxCode ? `cfx.re/join/${cfxCode}` : address}`,
            '',
            ...(lines.length > 0 ? [`${bar}`, '', ...lines] : ['Sunucuda aktif oyuncu bulunmuyor.']),
            ...(playerCount > maxShow ? [`*+${playerCount - maxShow} oyuncu daha*`] : []),
            '',
            `────────────`,
            `🔄 Son güncelleme: <t:${Math.floor(Date.now() / 1000)}:R>`
        ].join('\n'));
}

function buildPlayerDetailEmbed(displayName, player) {
    const discordId = (player.identifiers || []).find(id => id.startsWith('discord:'));
    const fivemId = (player.identifiers || []).find(id => id.startsWith('license:') || id.startsWith('fivem:'));
    const steamId = (player.identifiers || []).find(id => id.startsWith('steam:'));
    return new EmbedBuilder()
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
}

export async function execute(interaction) {
    await interaction.deferReply();

    try {
        const settled = await Promise.allSettled(
            ALL_SERVER_KEYS.map(async key => {
                const data = await fetchServerData(key);
                return { key, data };
            })
        );

        const results = new Map();
        for (const s of settled) {
            if (s.status === 'fulfilled' && s.value && s.value.data) {
                results.set(s.value.key, s.value.data);
            }
        }

        const embed = buildOverviewEmbed(results);

        const availableServers = ALL_SERVER_KEYS.filter(key => results.has(key));
        const components = [];
        if (availableServers.length > 0) {
            components.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('server_select')
                        .setPlaceholder('🔍 Detay için sunucu seçin')
                        .addOptions(
                            availableServers.map(key => ({
                                label: `${SERVER_DISPLAY[key] || key} (${results.get(key).players.length} oyuncu)`,
                                value: key,
                                description: `👥 ${results.get(key).players.length}/${results.get(key).maxClients || '?'}`
                            }))
                        )
                )
            );
        }

        const reply = await interaction.editReply({ embeds: [embed], components });

        const filter = i => i.user.id === interaction.user.id && i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (i) => {
            if (i.isStringSelectMenu() && i.customId === 'server_select') {
                const selectedKey = i.values[0];
                let data = results.get(selectedKey);

                if (!data) {
                    data = await fetchServerData(selectedKey);
                    if (data) results.set(selectedKey, data);
                }

                if (!data) {
                    await i.update({ content: `${SERVER_DISPLAY[selectedKey] || selectedKey} sunucusuna erişilemedi.`, embeds: [], components: [] });
                    return;
                }

                const displayName = SERVER_DISPLAY[selectedKey] || selectedKey;
                const detailEmbed = buildServerDetailEmbed(displayName, data, selectedKey);
                const players = Array.isArray(data.players) ? data.players : [];
                const [selectRow, navRow] = buildDetailComponents(selectedKey, players, 0);

                const comps = [];
                if (selectRow) comps.push(selectRow);
                comps.push(navRow);

                await i.update({ embeds: [detailEmbed], components: comps });
                return;
            }

            if (i.customId === 'back') {
                const overviewEmbed = buildOverviewEmbed(results);
                const avail = ALL_SERVER_KEYS.filter(key => results.has(key));
                const comps = avail.length > 0
                    ? [
                        new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('server_select')
                                .setPlaceholder('🔍 Detay için sunucu seçin')
                                .addOptions(
                                    avail.map(key => ({
                                        label: `${SERVER_DISPLAY[key] || key} (${results.get(key).players.length} oyuncu)`,
                                        value: key,
                                        description: `👥 ${results.get(key).players.length}/${results.get(key).maxClients || '?'}`
                                    }))
                                )
                        )
                    ]
                    : [];
                await i.update({ embeds: [overviewEmbed], components: comps });
                return;
            }

            if (i.isStringSelectMenu()) {
                const selectedValue = i.values[0];
                const key = i.customId.split('~')[1];
                const data = results.get(key);
                if (!data) {
                    await i.reply({ content: 'Sunucu verisi bulunamadı.', ephemeral: true });
                    return;
                }
                const players = Array.isArray(data.players) ? data.players : [];
                const player = players.find(p => String(p.id) === selectedValue);
                if (player) {
                    const detailEmbed = buildPlayerDetailEmbed(SERVER_DISPLAY[key] || key, player);
                    await i.reply({ embeds: [detailEmbed], ephemeral: true });
                } else {
                    await i.reply({ content: 'Oyuncu bulunamadı.', ephemeral: true });
                }
                return;
            }

            const [action, key, pageStr] = i.customId.split('~');
            let newPage = parseInt(pageStr) || 0;
            let players;

            if (action === 'refresh') {
                const fresh = await fetchServerData(key);
                if (fresh) {
                    results.set(key, fresh);
                    players = Array.isArray(fresh.players) ? fresh.players : [];
                } else {
                    players = null;
                }
            } else {
                const data = results.get(key);
                players = data ? (Array.isArray(data.players) ? data.players : []) : null;
            }

            if (!players || players.length === 0) {
                await i.update({ content: 'Oyuncu verisi alınamadı.', embeds: [], components: [] });
                return;
            }

            if (action === 'prev') newPage = Math.max(0, newPage - 1);
            else if (action === 'next') newPage = Math.min(newPage + 1, Math.ceil(players.length / 25) - 1);

            const data = results.get(key) || { players, maxClients: '?', hostname: '' };
            const displayName = SERVER_DISPLAY[key] || key;
            const detailEmbed = buildServerDetailEmbed(displayName, data, key);
            const [newSelectRow, newNavRow] = buildDetailComponents(key, players, newPage);
            const newComps = [];
            if (newSelectRow) newComps.push(newSelectRow);
            newComps.push(newNavRow);
            await i.update({ embeds: [detailEmbed], components: newComps });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    } catch (error) {
        await interaction.editReply({ content: `Hata: ${error.message}` }).catch(() => {});
    }
}

async function refreshAllServers() {
    const promises = ALL_SERVER_KEYS.map(key => refreshInBackground(key));
    await Promise.allSettled(promises);
}

let backgroundInterval = null;

export function startPlayerCache() {
    if (backgroundInterval) return;
    refreshAllServers();
    backgroundInterval = setInterval(refreshAllServers, 60000);
}

export function stopPlayerCache() {
    if (backgroundInterval) {
        clearInterval(backgroundInterval);
        backgroundInterval = null;
    }
}
