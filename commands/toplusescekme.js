import { ChannelType } from 'discord.js';

// Ses kanalındaki tüm kullanıcıları hedef kanala taşır
export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetChannel = interaction.options.getChannel('kanal');
    const afkChannelId = interaction.guild.afkChannelId;

    const membersToMove = [];

    // Tüm ses kanallarını tara
    for (const [, channel] of interaction.guild.channels.cache) {
        if (channel.type !== ChannelType.GuildVoice) continue;
        if (channel.id === targetChannel.id) continue;
        if (afkChannelId && channel.id === afkChannelId) continue;

        for (const [, member] of channel.members) {
            if (member.user.bot) continue;
            membersToMove.push(member);
        }
    }

    // Kullanıcıları hedef kanala taşı
    let movedCount = 0;

    for (const member of membersToMove) {
        try {
            await member.voice.setChannel(targetChannel.id);
            movedCount++;
        } catch {
            // Taşınamayan kullanıcılar varsa sessizce geç
        }
    }

    await interaction.editReply({
        content: `${movedCount} kullanıcı başarıyla ${targetChannel.name} kanalına taşındı.`
    });
}
