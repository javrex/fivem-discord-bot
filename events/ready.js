import { ActivityType } from 'discord.js';
import config from '../config/index.js';
import { joinVoice } from '../voice.js';

export default function(client) {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('FiveM Yönetim', { type: ActivityType.Watching });

    if (config.voiceChannelId) {
        console.log(`Ses kanalına bağlanılıyor: ${config.voiceChannelId}`);
        joinVoice(client, config.voiceChannelId);
    } else {
        console.log('VOICE_CHANNEL_ID bulunamadı, ses kanalına bağlanılmadı.');
    }
}
