let voiceModule = null;
let currentConnection = null;

async function getVoiceModule() {
    if (voiceModule === null) {
        try {
            voiceModule = await import('@discordjs/voice');
        } catch {
            voiceModule = false;
        }
    }
    return voiceModule;
}

export function getCurrentConnection() {
    return currentConnection;
}

export async function joinVoice(client, channelId) {
    const mod = await getVoiceModule();
    if (!mod) return null;

    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) return null;

        if (currentConnection) {
            currentConnection.destroy();
        }

        const { joinVoiceChannel, VoiceConnectionStatus } = mod;

        currentConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        currentConnection.on(VoiceConnectionStatus.Destroyed, () => {
            currentConnection = null;
        });

        currentConnection.on('error', () => {
            currentConnection = null;
        });

        return currentConnection;
    } catch (error) {
        console.error('Ses kanalına bağlanırken hata:', error);
        return null;
    }
}
