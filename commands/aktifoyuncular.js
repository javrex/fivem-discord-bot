import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { GameDig } from 'gamedig';
import { KNOWN_SERVERS, CFX_SERVERS, SERVER_DISPLAY } from '../utils/serverList.js';

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
        const url = `https://frontend.cfx-services.net/api/servers/single/${joinCode}`;
        console.log(`[CFX-DEBUG] Fetching: ${url}`);
        const res = await fetch(url, {
            signal: AbortSignal.timeout(3000),
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        console.log(`[CFX-DEBUG] ${joinCode} | status: ${res.status} | ok: ${res.ok} | contentType: ${res.headers.get('content-type')}`);
        if (!res.ok) {
            console.log(`[CFX-DEBUG] ${joinCode} | not ok, returning null`);
            return null;
        }
        const text = await res.text();
        console.log(`[CFX-DEBUG] ${joinCode} | response length: ${text.length} | first 200: ${text.substring(0, 200)}`);
        let data;
        try { data = JSON.parse(text); } catch (e) {
            console.log(`[CFX-DEBUG] ${joinCode} | JSON parse error: ${e.message}`);
            return null;
        }
        if (!data.Data) {
            console.log(`[CFX-DEBUG] ${joinCode} | data.Data is null/undefined`);
            return null;
        }
        const rawPlayers = data.Data.players;
        console.log(`[CFX-DEBUG] ${joinCode} | players type: ${typeof rawPlayers} | isArray: ${Array.isArray(rawPlayers)} | length: ${rawPlayers ? rawPlayers.length : 'N/A'}`);
        if (rawPlayers && rawPlayers.length > 0) {
            console.log(`[CFX-DEBUG] ${joinCode} | first player sample:`, JSON.stringify(rawPlayers[0]).substring(0, 200));
        }
        const players = (rawPlayers || []).map(p => {
            try {
                return {
                    id: typeof p.id === 'number' ? p.id : 0,
                    name: p.name || 'İsimsiz',
                    ping: p.ping || 0
                };
            } catch (mapErr) {
                console.log(`[CFX-DEBUG] ${joinCode} | map error for player:`, mapErr.message);
                return { id: 0, name: 'İsimsiz', ping: 0 };
            }
        });
        const maxClients = data.Data.svMaxclients || data.Data.sv_maxclients || '?';
        const hostname = data.Data.hostname || joinCode;
        console.log(`[CFX-DEBUG] ${joinCode} | success: ${players.length} players, maxClients: ${maxClients}, hostname: ${hostname}`);
        return { hostname, clients: data.Data.clients || players.length, maxClients, players };
    } catch (err) {
        console.log(`[CFX-DEBUG] ${joinCode} | CAUGHT ERROR: ${err.message}`);
        console.log(`[CFX-DEBUG] ${joinCode} | STACK: ${err.stack}`);
        return null;
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

function buildMainComponents(serverKey, players, page) {
    const totalPages = Math.ceil(players.length / 25) || 1;
    const hasPlayers = players.length > 0;
    const selectRow = hasPlayers ? new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`select~${serverKey}`)
            .setPlaceholder('DETAYLI SORGU İÇİN OYUNCU SEÇİN')
            .addOptions(buildPlayerSelectOptions(players, page))
    ) : null;
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`prev~${serverKey}~${page}`)
            .setLabel('Önceki Sayfa')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅')
            .setDisabled(page === 0 || !hasPlayers),
        new ButtonBuilder()
            .setCustomId(`next~${serverKey}~${page}`)
            .setLabel('Sonraki Sayfa')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡')
            .setDisabled(page >= totalPages - 1 || !hasPlayers),
        new ButtonBuilder()
            .setCustomId(`refresh~${serverKey}~${page}`)
            .setLabel('Yenile')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
    );
    return [selectRow, navRow];
}

function buildServerEmbed(displayName, data, key) {
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
        const serverChoice = interaction.options.getString('sunucu') || interaction.options.getString('server');
        const address = KNOWN_SERVERS[serverChoice];

        if (!address) {
            return interaction.editReply({ content: 'Sunucu bulunamadı.' });
        }

        const displayName = SERVER_DISPLAY[serverChoice] || serverChoice;
        const cfxCode = CFX_SERVERS[serverChoice];
        const { host, port } = parseAddress(address);

        console.log(`[CFX-DEBUG] execute | serverChoice: ${serverChoice} | address: ${address} | cfxCode: ${cfxCode || 'NONE'} | host: ${host} | port: ${port}`);
        const result = cfxCode
            ? await queryCfxAPI(cfxCode)
            : await queryServer(host, port);

        if (!result) {
            console.log(`[CFX-DEBUG] execute | ${serverChoice} | result is null/undefined, showing erisilemedi`);
            return interaction.editReply({ content: `${displayName} sunucusuna erişilemedi.` });
        }
        console.log(`[CFX-DEBUG] execute | ${serverChoice} | result OK | players: ${Array.isArray(result.players) ? result.players.length : 'NOT_ARRAY'} | maxClients: ${result.maxClients} | hostname: ${result.hostname}`);

        const state = { result, players: Array.isArray(result.players) ? result.players : [] };
        const embed = buildServerEmbed(displayName, state.result, serverChoice);
        const [selectRow, navRow] = buildMainComponents(serverChoice, state.players, 0);

        const components = [];
        if (selectRow) components.push(selectRow);
        components.push(navRow);

        const reply = await interaction.editReply({ embeds: [embed], components });

        const filter = i => i.user.id === interaction.user.id && i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (i) => {
            if (i.isStringSelectMenu()) {
                const selectedValue = i.values[0];
                const player = state.players.find(p => String(p.id) === selectedValue);
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

            if (action === 'refresh') {
                const fresh = cfxCode
                    ? await queryCfxAPI(cfxCode)
                    : await queryServer(host, port);
                if (!fresh || !Array.isArray(fresh.players) || fresh.players.length === 0) {
                    await i.update({ content: 'Oyuncu verisi alınamadı.', embeds: [], components: [] });
                    return;
                }
                state.result = fresh;
                state.players = fresh.players;
            } else {
                if (action === 'prev') newPage = Math.max(0, newPage - 1);
                else if (action === 'next') newPage = Math.min(newPage + 1, Math.ceil(state.players.length / 25) - 1);
            }

            const detailEmbed = buildServerEmbed(displayName, state.result, key);
            const [newSelectRow, newNavRow] = buildMainComponents(key, state.players, newPage);
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
