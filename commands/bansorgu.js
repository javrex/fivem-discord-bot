import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const memberPerms = interaction.memberPermissions;
        if (!memberPerms.has(PermissionFlagsBits.Administrator) && !memberPerms.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({ content: 'Bu komutu kullanmak için **Administrator** veya **Ban Members** yetkisine sahip olmalısınız.' });
        }

        const botMember = await interaction.guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.editReply({ content: 'Botun **Ban Members** yetkisi yok. Ban listesini sorgulayamıyorum.' });
        }

        const targetUser = interaction.options.getUser('kullanici');
        const targetId = interaction.options.getString('id');

        let userId;
        if (targetUser) {
            userId = targetUser.id;
        } else if (targetId) {
            if (!/^\d{17,20}$/.test(targetId)) {
                return interaction.editReply({ content: 'Geçersiz Discord ID formatı. ID sadece rakamlardan oluşmalıdır (17-20 karakter).' });
            }
            userId = targetId;
        } else {
            return interaction.editReply({ content: 'Bir kullanıcı etiketleyin veya Discord ID girin.' });
        }

        let banInfo;
        try {
            banInfo = await interaction.guild.bans.fetch(userId);
        } catch (e) {
            if (e.status === 404 || e.code === 10026) {
                const notBannedEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('❌ Ban Sorgusu')
                    .setDescription('Bu kullanıcı bu Discord sunucusunda **banlı değil**.')
                    .addFields(
                        { name: '🆔 Discord ID', value: `\`${userId}\``, inline: false }
                    )
                    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                    .setTimestamp();
                return interaction.editReply({ embeds: [notBannedEmbed] });
            }
            throw e;
        }

        const user = banInfo.user;
        const displayName = user.globalName || user.username || 'Bilinmiyor';

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🔨 Ban Sorgusu')
            .addFields(
                { name: '👤 Kullanıcı', value: displayName, inline: true },
                { name: '🆔 Discord ID', value: `\`${user.id}\``, inline: true },
                { name: '📌 Durum', value: '✅ Banlı', inline: true },
                { name: '📝 Ban Sebebi', value: banInfo.reason || 'Belirtilmemiş', inline: false },
                { name: '🌐 Sunucu', value: interaction.guild.name, inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ forceStatic: false }))
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Bir hata oluştu: ${error.message}` }).catch(() => {});
    }
}
