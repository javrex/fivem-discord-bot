import { ActivityType } from 'discord.js';

// Bot hazır olduğunda çalışır
export default function(client) {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('FiveM Yönetim', { type: ActivityType.Watching });
}
