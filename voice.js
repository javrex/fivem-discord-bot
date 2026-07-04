import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';

let currentConnection = null;

export function getCurrentConnection() {
    return currentConnection;
}

export async function joinVoice(client, channelId) {
    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.log('Ses kanalı bulunamadı.');
            return null;
        }

        if (currentConnection) {
            currentConnection.destroy();
        }

        currentConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        currentConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(currentConnection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(currentConnection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch {
                currentConnection.destroy();
                currentConnection = null;
                setTimeout(() => joinVoice(client, channelId), 5000);
            }
        });

        currentConnection.on(VoiceConnectionStatus.Ready, () => {
            console.log(`${channel.name} ses kanalına bağlanıldı.`);
        });

        return currentConnection;
    } catch (error) {
        console.error('Ses kanalına bağlanırken hata:', error);
        return null;
    }
}
