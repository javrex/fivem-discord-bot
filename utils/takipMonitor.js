import { getAllTrackedPlayers } from './takipStore.js';

const CFX_SERVERS = {
    'md_rp': 'xjx5kr',
    'alesta_rp': 'gm3g4q',
    'md_pvp': 'z5gxl9',
    'pwuc_rp': 'bdxpkrp',
    'ria_rp': 'zjvqmgd'
};

const SERVER_DISPLAY = {
    'md_rp': 'MD RP',
    'alesta_rp': 'Alesta RP',
    'md_pvp': 'MD PvP',
    'pwuc_rp': 'PWUC RP',
    'ria_rp': 'Ria RP'
};

const onlineState = new Map();

async function queryAllServers() {
    const results = new Map();
    const promises = Object.entries(CFX_SERVERS).map(async ([key, joinCode]) => {
        try {
            const res = await fetch(`https://frontend.cfx-services.net/api/servers/single/${joinCode}`, {
                signal: AbortSignal.timeout(5000),
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.Data) return;
            results.set(key, data.Data.players || []);
        } catch {
            // skip failed queries
        }
    });
    await Promise.allSettled(promises);
    return results;
}

async function sendNotification(client, trackEntry, serverKey, serverId, ping) {
    const displayName = SERVER_DISPLAY[serverKey] || serverKey;
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    try {
        const user = await client.users.fetch(trackEntry.added_by);
        await user.send({
            embeds: [{
                color: 0x00ff88,
                title: '🚨 Takip Ettiğin Oyuncu Çevrimiçi!',
                fields: [
                    { name: '👤 Oyuncu', value: trackEntry.player_name, inline: false },
                    { name: '🎮 Sunucu', value: displayName, inline: true },
                    { name: '🆔 Server ID', value: String(serverId), inline: true },
                    { name: '📶 Ping', value: `${ping} ms`, inline: true },
                    { name: '🕒 Tespit', value: dateStr, inline: false }
                ],
                timestamp: now.toISOString()
            }]
        });
    } catch {
        // DM kapalı veya kullanıcı bulunamadı, sessizce geç
    }
}

async function runCheck(client) {
    const tracked = getAllTrackedPlayers();
    if (tracked.length === 0) {
        onlineState.clear();
        return;
    }

    const nameToTracks = new Map();
    for (const t of tracked) {
        if (!nameToTracks.has(t.key)) nameToTracks.set(t.key, []);
        nameToTracks.get(t.key).push(t);
    }

    const serverPlayers = await queryAllServers();
    if (serverPlayers.size === 0) return;

    const foundKeys = new Set();

    for (const [serverKey, players] of serverPlayers) {
        for (const player of players) {
            const pName = (player.name || '').toLowerCase();
            if (!pName) continue;
            const tracks = nameToTracks.get(pName);
            if (!tracks) continue;
            for (const track of tracks) {
                const stateKey = `${track.guildId}:${track.key}`;
                if (foundKeys.has(stateKey)) continue;
                foundKeys.add(stateKey);

                const wasOnline = onlineState.get(stateKey) || false;
                if (!wasOnline) {
                    onlineState.set(stateKey, true);
                    await sendNotification(client, track, serverKey, player.id ?? '?', player.ping ?? '?');
                }
            }
        }
    }

    for (const [stateKey, wasOnline] of onlineState) {
        const isOnline = foundKeys.has(stateKey);
        if (!isOnline && wasOnline) {
            onlineState.set(stateKey, false);
        }
    }

    const validKeys = new Set(tracked.map(t => `${t.guildId}:${t.key}`));
    for (const stateKey of onlineState.keys()) {
        if (!validKeys.has(stateKey)) {
            onlineState.delete(stateKey);
        }
    }
}

let intervalId = null;

export function startMonitor(client) {
    if (intervalId) return;
    setTimeout(() => runCheck(client), 10000);
    intervalId = setInterval(() => runCheck(client), 60000);
}

export function stopMonitor() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
