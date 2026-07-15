import { EmbedBuilder } from 'discord.js';
import { GameDig } from 'gamedig';
import { KNOWN_SERVERS, CFX_SERVERS, SERVER_DISPLAY } from '../utils/serverList.js';

function parseAddress(value) {
    const parts = value.split(':');
    return { host: parts[0], port: parts[1] || '30120' };
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
            map: state.map || null,
            players
        };
    } catch {
        return null;
    }
}

async function queryHTTP(host, port) {
    try {
        const [infoRes, playersRes] = await Promise.all([
            fetch(`http://${host}:${port}/info.json`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
            fetch(`http://${host}:${port}/players.json`, { signal: AbortSignal.timeout(5000) }).catch(() => null)
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

        return {
            hostname,
            clients,
            maxClients,
            map: info.vars?.sv_mapName || info.mapname || null,
            players: Array.isArray(players) ? players : []
        };
    } catch {
        return null;
    }
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
        const d = data.Data;
        const players = (d.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
        return {
            hostname: d.hostname || joinCode,
            clients: d.clients || players.length,
            maxClients: d.svMaxclients || d.sv_maxclients || '?',
            map: d.mapname || null,
            oneSync: d.oneSync || null,
            voice: d.vars?.voiceEnabled ?? d.voiceEnabled ?? null,
            gameBuild: d.gameBuild ?? null,
            version: d.server || null,
            enhancedHost: d.enhancedHostSupport ?? null,
            private: d.private ?? null,
            players
        };
    } catch {
        return null;
    }
}

function calcAvgPing(players) {
    if (!players || players.length === 0) return null;
    const valid = players.filter(p => typeof p.ping === 'number' && p.ping > 0);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((sum, p) => sum + p.ping, 0) / valid.length);
}

function fillPercent(clients, max) {
    const maxNum = typeof max === 'number' ? max : parseInt(max);
    const clientNum = typeof clients === 'number' ? clients : parseInt(clients);
    if (!maxNum || maxNum <= 0 || isNaN(clientNum)) return null;
    return Math.round((clientNum / maxNum) * 100);
}

function statusEmoji(online) {
    return online ? '🟢 Online' : '🔴 Offline';
}

function boolText(val) {
    if (val === true || val === 'true' || val === 1 || val === '1' || val === 'On' || val === 'Enabled') return '✅ Aktif';
    if (val === false || val === 'false' || val === 0 || val === '0' || val === 'Off' || val === 'Disabled') return '❌ Kapalı';
    return val || 'Bilinmiyor';
}

function formatValue(val) {
    if (val === null || val === undefined || val === '') return 'Bilinmiyor';
    return String(val);
}

async function queryServer(key) {
    const cfxCode = CFX_SERVERS[key];
    if (cfxCode) {
        const data = await queryCfxAPI(cfxCode);
        if (data) return { ...data, key, online: true };
        return { key, online: false, hostname: SERVER_DISPLAY[key] || key };
    }
    const address = KNOWN_SERVERS[key];
    if (!address) return { key, online: false, hostname: SERVER_DISPLAY[key] || key };
    const { host, port } = parseAddress(address);
    let data = await queryA2S(host, port);
    if (!data) data = await queryHTTP(host, port);
    if (data) return { ...data, key, online: true };
    return { key, online: false, hostname: SERVER_DISPLAY[key] || key };
}

export async function execute(interaction) {
    const key1 = interaction.options.getString('sunucu1', true);
    const key2 = interaction.options.getString('sunucu2', true);

    if (key1 === key2) {
        return interaction.reply({ content: 'Aynı sunucuyu karşılaştıramazsın. Lütfen iki farklı sunucu seç.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const [result1, result2] = await Promise.all([
            queryServer(key1),
            queryServer(key2)
        ]);

        const name1 = SERVER_DISPLAY[key1] || key1;
        const name2 = SERVER_DISPLAY[key2] || key2;

        const players1 = result1.online ? result1.clients : '—';
        const players2 = result2.online ? result2.clients : '—';
        const max1 = result1.online ? result1.maxClients : '—';
        const max2 = result2.online ? result2.maxClients : '—';
        const fill1 = result1.online ? fillPercent(result1.clients, result1.maxClients) : null;
        const fill2 = result2.online ? fillPercent(result2.clients, result2.maxClients) : null;
        const ping1 = result1.online && result1.players ? calcAvgPing(result1.players) : null;
        const ping2 = result2.online && result2.players ? calcAvgPing(result2.players) : null;
        const map1 = result1.online ? result1.map : null;
        const map2 = result2.online ? result2.map : null;

        let winnerPlayers = '', winnerFill = '', winnerPing = '', overallWinner = '';

        if (result1.online && result2.online) {
            const p1 = typeof result1.clients === 'number' ? result1.clients : parseInt(result1.clients) || 0;
            const p2 = typeof result2.clients === 'number' ? result2.clients : parseInt(result2.clients) || 0;
            if (p1 > p2) winnerPlayers = `🏆 ${name1}`;
            else if (p2 > p1) winnerPlayers = `🏆 ${name2}`;
            else winnerPlayers = '⚖️ Eşit';

            if (fill1 !== null && fill2 !== null) {
                if (fill1 > fill2) winnerFill = `📈 ${name1}`;
                else if (fill2 > fill1) winnerFill = `📈 ${name2}`;
                else winnerFill = '⚖️ Eşit';
            } else {
                winnerFill = '—';
            }

            if (ping1 !== null && ping2 !== null) {
                if (ping1 < ping2) winnerPing = `⚡ ${name1}`;
                else if (ping2 < ping1) winnerPing = `⚡ ${name2}`;
                else winnerPing = '⚖️ Eşit';
            } else {
                winnerPing = '—';
            }

            const score1 = (p1 > p2 ? 1 : 0) + ((fill1 !== null && fill2 !== null && fill1 > fill2) ? 1 : 0) + ((ping1 !== null && ping2 !== null && ping1 < ping2) ? 1 : 0);
            const score2 = (p2 > p1 ? 1 : 0) + ((fill1 !== null && fill2 !== null && fill2 > fill1) ? 1 : 0) + ((ping1 !== null && ping2 !== null && ping2 < ping1) ? 1 : 0);
            if (score1 > score2) overallWinner = `🥇 **${name1}** önde.`;
            else if (score2 > score1) overallWinner = `🥇 **${name2}** önde.`;
            else overallWinner = '⚖️ İki sunucu da eşit durumda.';
        } else if (result1.online && !result2.online) {
            overallWinner = `🥇 **${name1}** çevrimiçi (${name2} erişilemez).`;
        } else if (!result1.online && result2.online) {
            overallWinner = `🥇 **${name2}** çevrimiçi (${name1} erişilemez).`;
        } else {
            overallWinner = '❌ İki sunucuya da erişilemedi.';
        }

        const descLines = [
            `## ${name1} vs ${name2}`,
            '',
            `🎮 **İsim**`,
            `${result1.online ? result1.hostname : '—'}`,
            `${result2.online ? result2.hostname : '—'}`,
            '',
            `🟢 **Durum**`,
            `${statusEmoji(result1.online)}`,
            `${statusEmoji(result2.online)}`,
            '',
            `👥 **Aktif Oyuncu**`,
            `${players1}`,
            `${players2}`,
            '',
            `👤 **Maksimum Oyuncu**`,
            `${max1}`,
            `${max2}`,
            '',
            `📊 **Doluluk Oranı**`,
            `${fill1 !== null ? `%${fill1}` : '—'}`,
            `${fill2 !== null ? `%${fill2}` : '—'}`,
            '',
            `📡 **Ortalama Ping**`,
            `${ping1 !== null ? `${ping1} ms` : '—'}`,
            `${ping2 !== null ? `${ping2} ms` : '—'}`,
            '',
            `🗺️ **Harita**`,
            `${formatValue(map1)}`,
            `${formatValue(map2)}`,
            '',
            `🧩 **OneSync**`,
            `${result1.online ? boolText(result1.oneSync) : '—'}`,
            `${result2.online ? boolText(result2.oneSync) : '—'}`,
            '',
            `🔊 **Voice**`,
            `${result1.online ? boolText(result1.voice) : '—'}`,
            `${result2.online ? boolText(result2.voice) : '—'}`,
            '',
            `🖥️ **Game Build**`,
            `${result1.online ? formatValue(result1.gameBuild) : '—'}`,
            `${result2.online ? formatValue(result2.gameBuild) : '—'}`,
            '',
            `📌 **Server Version**`,
            `${result1.online ? formatValue(result1.version) : '—'}`,
            `${result2.online ? formatValue(result2.version) : '—'}`,
            '',
            `━━━━━━━━━━━━━━━━━━`
        ];

        const winnerLines = [];
        if (winnerPlayers && winnerPlayers !== '—') winnerLines.push(`**${winnerPlayers}**`);
        if (winnerFill && winnerFill !== '—') winnerLines.push(`**${winnerFill}**`);
        if (winnerPing && winnerPing !== '—') winnerLines.push(`**${winnerPing}**`);
        if (winnerLines.length > 0) descLines.push('', winnerLines.join('\n'));

        descLines.push('', overallWinner);

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('🏆 Sunucu Karşılaştırma')
            .setDescription(descLines.join('\n'))
            .setFooter({ text: interaction.guild?.name || 'FiveM Bot', iconURL: interaction.guild?.iconURL() || null })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Karşılaştırma hatası:', error);
        await interaction.editReply({ content: 'Karşılaştırma yapılırken bir hata oluştu.' }).catch(() => {});
    }
}
