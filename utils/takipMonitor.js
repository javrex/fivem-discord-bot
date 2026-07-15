import { PermissionFlagsBits } from 'discord.js';
import { GameDig } from 'gamedig';
import { getAllTrackedPlayers } from './takipStore.js';
import { KNOWN_SERVERS, CFX_SERVERS, SERVER_DISPLAY, ALL_SERVER_KEYS } from './serverList.js';

const onlineState = new Map();

function debug(...args) {
    console.log(`[TAKIP-MONITOR]`, ...args);
}

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
        return (state.players || []).map(p => ({
            id: typeof p.id === 'number' ? p.id : 0,
            name: p.name || 'İsimsiz',
            ping: p.ping || 0
        }));
    } catch {
        return null;
    }
}

async function queryHTTP(host, port) {
    try {
        const res = await fetch(`http://${host}:${port}/players.json`, {
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? data : null;
    } catch {
        return null;
    }
}

async function queryServerDirect(host, port) {
    let players = await queryA2S(host, port);
    if (!players) players = await queryHTTP(host, port);
    return players;
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
        return data.Data.players || [];
    } catch {
        return null;
    }
}

async function queryAllServers() {
    const results = new Map();
    debug(`Sorgulanacak sunucular (${ALL_SERVER_KEYS.length}): ${ALL_SERVER_KEYS.join(', ')}`);

    const promises = ALL_SERVER_KEYS.map(async (key) => {
        const cfxCode = CFX_SERVERS[key];
        if (cfxCode) {
            debug(`  ↳ ${key} — CFX API ile sorgulanıyor (join: ${cfxCode})`);
            const players = await queryCfxAPI(cfxCode);
            if (players) {
                debug(`  ✓ ${key}: ${players.length} oyuncu (CFX API)`);
                results.set(key, players);
            } else {
                debug(`  ✗ ${key}: CFX API başarısız`);
            }
        } else {
            const address = KNOWN_SERVERS[key];
            if (!address) {
                debug(`  ✗ ${key}: bilinmeyen sunucu`);
                return;
            }
            const { host, port } = parseAddress(address);
            debug(`  ↳ ${key} — A2S/HTTP ile sorgulanıyor (${host}:${port})`);
            const players = await queryServerDirect(host, port);
            if (players) {
                debug(`  ✓ ${key}: ${players.length} oyuncu (A2S/HTTP)`);
                results.set(key, players);
            } else {
                debug(`  ✗ ${key}: A2S/HTTP başarısız`);
            }
        }
    });

    await Promise.allSettled(promises);
    debug(`Sorgu tamam: ${results.size}/${ALL_SERVER_KEYS.length} sunucu başarılı`);

    for (const [key] of results) {
        const players = results.get(key);
        if (players.length > 0) {
            const names = players.map(p => `"${p.name || '(isimsiz)'}"`).join(', ');
            debug(`    ${key} oyuncuları: ${names}`);
        }
    }

    return results;
}

async function sendNotification(client, trackEntry, serverKey, serverId, ping) {
    const displayName = SERVER_DISPLAY[serverKey] || serverKey;
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    debug(`sendNotification — oyuncu: "${trackEntry.player_name}", sunucu: ${displayName}, serverId: ${serverId}, ping: ${ping}`);

    if (!trackEntry.channel_id) {
        debug(`  ✗ channel_id yok`);
        return;
    }
    debug(`  Kanal ID: ${trackEntry.channel_id}`);

    try {
        const channel = await client.channels.fetch(trackEntry.channel_id);
        if (!channel) {
            debug(`  ✗ Kanal bulunamadı (null)`);
            return;
        }
        debug(`  ✓ Kanal: #${channel.name} (${channel.id})`);

        const me = channel.guild.members.me || await channel.guild.members.fetch(client.user.id);
        const perms = channel.permissionsFor(me);

        if (!perms) {
            debug(`  ✗ permsFor null`);
            return;
        }

        const hasView = perms.has(PermissionFlagsBits.ViewChannel);
        const hasSend = perms.has(PermissionFlagsBits.SendMessages);
        const hasEmbed = perms.has(PermissionFlagsBits.EmbedLinks);
        debug(`  Yetkiler — View:${hasView} Send:${hasSend} Embed:${hasEmbed}`);

        if (!hasView || !hasSend || !hasEmbed) {
            debug(`  ✗ Yetersiz yetki`);
            return;
        }

        debug(`  ↳ Mesaj gönderiliyor...`);
        await channel.send({
            content: `<@${trackEntry.added_by}>`,
            embeds: [{
                color: 0x00ff88,
                title: '🚨 Takip Edilen Oyuncu Çevrimiçi!',
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
        debug(`  ✓ BİLDİRİLDİ — #${channel.name} | ${trackEntry.player_name} | ${displayName}`);
    } catch (err) {
        debug(`  ✗ Hata: ${err?.message || err} (${err?.constructor?.name})`);
    }
}

async function runCheck(client) {
    debug(`=== KONTROL DÖNGÜSÜ BAŞLADI ===`);

    const tracked = getAllTrackedPlayers();
    debug(`Takip kayıtları: ${tracked.length} adet`);

    if (tracked.length === 0) {
        onlineState.clear();
        debug(`=== KONTROL DÖNGÜSÜ BİTTİ (kayıt yok) ===`);
        return;
    }

    for (const t of tracked) {
        debug(`  Kayıtlı: "${t.player_name}" (key: "${t.key}") — kanal: ${t.channel_id || 'YOK'}`);
    }

    const nameToTracks = new Map();
    for (const t of tracked) {
        if (!nameToTracks.has(t.key)) nameToTracks.set(t.key, []);
        nameToTracks.get(t.key).push(t);
    }
    debug(`Eşleme tablosu: ${nameToTracks.size} benzersiz isim`);

    const serverPlayers = await queryAllServers();
    debug(`Sunucu verileri: ${serverPlayers.size} sunucu`);

    if (serverPlayers.size === 0) {
        debug(`✗ Hiçbir sunucudan veri alınamadı`);
        debug(`=== KONTROL DÖNGÜSÜ BİTTİ (veri yok) ===`);
        return;
    }

    const foundKeys = new Set();

    for (const [serverKey, players] of serverPlayers) {
        debug(`  ${serverKey}: ${players.length} oyuncu inceleniyor`);

        for (const player of players) {
            const pNameRaw = player.name || '';
            const pName = pNameRaw.toLowerCase().trim();
            if (!pName) continue;

            debug(`    "${pNameRaw}" (norm: "${pName}") — eşleşme?`);

            const tracks = nameToTracks.get(pName);
            if (!tracks) {
                debug(`    ✗ Eşleşme: HAYIR`);
                continue;
            }

            debug(`    ✓ Eşleşme: EVET — ${tracks.length} kayıt`);

            for (const track of tracks) {
                const stateKey = `${track.guildId}:${track.key}`;
                if (foundKeys.has(stateKey)) {
                    debug(`      ↳ ${stateKey} zaten bulundu`);
                    continue;
                }
                foundKeys.add(stateKey);

                const wasOnline = onlineState.get(stateKey) || false;
                debug(`      state: ${wasOnline ? 'ONLINE' : 'OFFLINE'}`);

                if (!wasOnline) {
                    onlineState.set(stateKey, true);
                    debug(`      ↳ YENİ GİRİŞ — bildirim`);
                    await sendNotification(client, track, serverKey, player.id ?? '?', player.ping ?? '?');
                } else {
                    debug(`      ↳ ZATEN ONLINE — atlandı`);
                }
            }
        }
    }

    for (const [stateKey, wasOnline] of onlineState) {
        const isOnline = foundKeys.has(stateKey);
        if (!isOnline && wasOnline) {
            debug(`  ↳ ${stateKey} çevrimdışı — state sıfırlandı`);
            onlineState.set(stateKey, false);
        }
    }

    const validKeys = new Set(tracked.map(t => `${t.guildId}:${t.key}`));
    for (const stateKey of onlineState.keys()) {
        if (!validKeys.has(stateKey)) {
            onlineState.delete(stateKey);
        }
    }

    debug(`=== KONTROL DÖNGÜSÜ BİTTİ ===`);
}

let intervalId = null;

export function startMonitor(client) {
    debug(`✅ Takip servisi başlatıldı! (setInterval: 60000ms, ilk kontrol: 10sn)`);
    if (intervalId) return;
    setTimeout(() => runCheck(client), 10000);
    intervalId = setInterval(() => runCheck(client), 60000);
}

export function stopMonitor() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        debug(`Monitor durduruldu`);
    }
}
