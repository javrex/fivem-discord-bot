import { PermissionFlagsBits } from 'discord.js';
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

function debug(...args) {
    console.log(`[TAKIP-MONITOR]`, ...args);
}

async function queryAllServers() {
    const results = new Map();
    debug(`queryAllServers başlıyor — ${Object.keys(CFX_SERVERS).length} sunucu taranacak`);

    const promises = Object.entries(CFX_SERVERS).map(async ([key, joinCode]) => {
        try {
            const url = `https://frontend.cfx-services.net/api/servers/single/${joinCode}`;
            debug(`  ↳ ${key} (${joinCode}) sorgulanıyor: ${url}`);
            const res = await fetch(url, {
                signal: AbortSignal.timeout(5000),
                headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (!res.ok) {
                debug(`  ✗ ${key} HTTP ${res.status} ${res.statusText}`);
                return;
            }
            const data = await res.json();
            if (!data.Data) {
                debug(`  ✗ ${key} data.Data mevcut değil`);
                return;
            }
            const players = data.Data.players || [];
            debug(`  ✓ ${key}: ${players.length} oyuncu bulundu`);
            if (players.length > 0) {
                const names = players.map(p => `"${p.name || '(isimsiz)'}"`).join(', ');
                debug(`    İsimler: ${names}`);
            }
            results.set(key, players);
        } catch (err) {
            debug(`  ✗ ${key} hata: ${err?.message || err}`);
        }
    });

    await Promise.allSettled(promises);
    debug(`queryAllServers tamam: ${results.size} sunucu başarılı`);
    return results;
}

async function sendNotification(client, trackEntry, serverKey, serverId, ping) {
    const displayName = SERVER_DISPLAY[serverKey] || serverKey;
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    debug(`sendNotification çağrıldı — oyuncu: "${trackEntry.player_name}", sunucu: ${displayName}, serverId: ${serverId}, ping: ${ping}`);

    if (!trackEntry.channel_id) {
        debug(`  ✗ channel_id yok — bildirim gönderilemez`);
        return;
    }
    debug(`  channel_id: ${trackEntry.channel_id}`);

    try {
        const channel = await client.channels.fetch(trackEntry.channel_id);
        if (!channel) {
            debug(`  ✗ Kanal bulunamadı (null döndü)`);
            return;
        }
        debug(`  ✓ Kanal bulundu: #${channel.name} (${channel.id})`);

        const me = channel.guild.members.me || await channel.guild.members.fetch(client.user.id);
        const perms = channel.permissionsFor(me);

        if (!perms) {
            debug(`  ✗ permsFor(me) null döndü`);
            return;
        }

        const hasView = perms.has(PermissionFlagsBits.ViewChannel);
        const hasSend = perms.has(PermissionFlagsBits.SendMessages);
        const hasEmbed = perms.has(PermissionFlagsBits.EmbedLinks);
        debug(`  Yetkiler — ViewChannel:${hasView} SendMessages:${hasSend} EmbedLinks:${hasEmbed}`);

        if (!hasView || !hasSend || !hasEmbed) {
            debug(`  ✗ Yetersiz yetki — bildirim gönderilemedi`);
            return;
        }

        debug(`  ↳ Embed gönderiliyor...`);
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
        debug(`  ✓ BİLDİRİLDİ — kanal: #${channel.name} | oyuncu: ${trackEntry.player_name} | sunucu: ${displayName}`);
    } catch (err) {
        debug(`  ✗ Gönderim hatası: ${err?.message || err} (${err?.constructor?.name || 'unknown'})`);
    }
}

async function runCheck(client) {
    debug(`=== KONTROL DÖNGÜSÜ BAŞLADI ===`);

    const tracked = getAllTrackedPlayers();
    debug(`Takip kayıtları: ${tracked.length} adet`);

    if (tracked.length === 0) {
        debug(`Takip kaydı yok, onlineState temizleniyor.`);
        onlineState.clear();
        debug(`=== KONTROL DÖNGÜSÜ BİTTİ (kayıt yok) ===`);
        return;
    }

    for (const t of tracked) {
        debug(`  Takip edilen: "${t.player_name}" (key: "${t.key}") — kanal: ${t.channel_id || 'YOK'} — ekleyen: ${t.added_by}`);
    }

    const nameToTracks = new Map();
    for (const t of tracked) {
        if (!nameToTracks.has(t.key)) nameToTracks.set(t.key, []);
        nameToTracks.get(t.key).push(t);
    }
    debug(`Eşleme tablosu: ${nameToTracks.size} benzersiz isim`);

    const serverPlayers = await queryAllServers();
    debug(`Sunucu sorgu sonucu: ${serverPlayers.size} sunucudan veri alındı`);

    if (serverPlayers.size === 0) {
        debug(`✗ Hiçbir sunucudan veri alınamadı — kontrol iptal`);
        debug(`=== KONTROL DÖNGÜSÜ BİTTİ (veri yok) ===`);
        return;
    }

    const foundKeys = new Set();

    for (const [serverKey, players] of serverPlayers) {
        debug(`  Sunucu ${serverKey}: ${players.length} oyuncu`);

        for (const player of players) {
            const pNameRaw = player.name || '';
            const pName = pNameRaw.toLowerCase().trim();
            if (!pName) {
                debug(`    ↳ Boş isim atlandı`);
                continue;
            }

            debug(`    Oyuncu: "${pNameRaw}" (norm: "${pName}") — eşleşme aranıyor...`);

            const tracks = nameToTracks.get(pName);
            if (!tracks) {
                debug(`    ✗ Eşleşme: HAYIR`);
                continue;
            }

            debug(`    ✓ Eşleşme: EVET — ${tracks.length} kayıt bulundu`);

            for (const track of tracks) {
                const stateKey = `${track.guildId}:${track.key}`;
                debug(`      stateKey: ${stateKey}`);

                if (foundKeys.has(stateKey)) {
                    debug(`      ↳ Zaten bulundu (önceki sunucuda) — atlanıyor`);
                    continue;
                }
                foundKeys.add(stateKey);

                const wasOnline = onlineState.get(stateKey) || false;
                debug(`      Önceki durum: ${wasOnline ? 'ONLINE' : 'OFFLINE'}`);

                if (!wasOnline) {
                    debug(`      ↳ Yeni giriş — bildirim gönderiliyor...`);
                    onlineState.set(stateKey, true);
                    await sendNotification(client, track, serverKey, player.id ?? '?', player.ping ?? '?');
                } else {
                    debug(`      ↳ Zaten online — bildirim atlandı`);
                }
            }
        }
    }

    debug(`Bulunan stateKey'ler (${foundKeys.size}): ${[...foundKeys].join(', ')}`);

    for (const [stateKey, wasOnline] of onlineState) {
        const isOnline = foundKeys.has(stateKey);
        if (!isOnline && wasOnline) {
            debug(`  ↳ ${stateKey} çevrimdışı oldu — state sıfırlanıyor`);
            onlineState.set(stateKey, false);
        }
    }

    const validKeys = new Set(tracked.map(t => `${t.guildId}:${t.key}`));
    for (const stateKey of onlineState.keys()) {
        if (!validKeys.has(stateKey)) {
            debug(`  ↳ ${stateKey} takipten çıkmış — state temizleniyor`);
            onlineState.delete(stateKey);
        }
    }

    debug(`=== KONTROL DÖNGÜSÜ BİTTİ ===`);
}

let intervalId = null;

export function startMonitor(client) {
    debug(`✅ Takip servisi başlatıldı! (setInterval: 60000ms = 60 saniye, ilk kontrol: 10sn sonra)`);
    if (intervalId) {
        debug(`⚠️  Monitor zaten çalışıyor, yeniden başlatılmadı`);
        return;
    }
    setTimeout(() => runCheck(client), 10000);
    intervalId = setInterval(() => runCheck(client), 60000);
    debug(`setInterval ID: ${intervalId}`);
}

export function stopMonitor() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        debug(`Monitor durduruldu`);
    }
}
