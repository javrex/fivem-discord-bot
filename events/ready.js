import { ActivityType } from 'discord.js';

export default function(client) {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('FiveM Yönetim', { type: ActivityType.Watching });
}