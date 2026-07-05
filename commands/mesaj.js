import { ChannelType } from 'discord.js';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('kanal');
    const mesaj = interaction.options.getString('mesaj');

    if (channel.type !== ChannelType.GuildText) {
        return interaction.editReply({ content: 'Yalnızca metin kanalları seçilebilir.' });
    }

    try {
        await channel.send(mesaj);
        await interaction.editReply({ content: `Mesaj ${channel} kanalına gönderildi.` });
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        await interaction.editReply({ content: 'Mesaj gönderilirken bir hata oluştu.' });
    }
}
