import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { buildAuditBanMap } from '../utils/auditBanCache.js';

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
        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            return interaction.editReply({ content: 'Botun **View Audit Log** yetkisi yok. Denetim kayıtlarını sorgulayamıyorum.' });
        }

        const targetUser = interaction.options.getUser('kullanici');
        const targetId = interaction.options.getString('id');

        let userId;
        let userName;
        if (targetUser) {
            userId = targetUser.id;
            userName = targetUser.globalName || targetUser.username || 'Bilinmiyor';
        } else if (targetId) {
            if (!/^\d{17,20}$/.test(targetId)) {
                return interaction.editReply({ content: 'Geçersiz Discord ID formatı. ID sadece rakamlardan oluşmalıdır (17-20 karakter).' });
            }
            userId = targetId;
            userName = null;
        } else {
            return interaction.editReply({ content: 'Bir kullanıcı etiketleyin veya Discord ID girin.' });
        }

        let banInfo;
        try {
            banInfo = await interaction.guild.bans.fetch(userId);
        } catch (e) {
            if (e.status === 404 || e.code === 10026) {
                const embed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('❌ Ban Sorgusu')
                    .setDescription('Bu kullanıcı bu Discord sunucusunda **banlı değil**.')
                    .addFields({ name: '🆔 Discord ID', value: `\`${userId}\``, inline: false })
                    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }
            throw e;
        }

        const user = banInfo.user;
        const displayName = userName || user.globalName || user.username || 'Bilinmiyor';

        const auditMap = await buildAuditBanMap(interaction.guild, 20);
        const audit = auditMap.get(user.id);

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🔨 Ban Sorgusu')
            .addFields(
                { name: '👤 Kullanıcı Adı', value: displayName, inline: true },
                { name: '🆔 Discord ID', value: `\`${user.id}\``, inline: true },
                { name: '🔨 Ban Durumu', value: '✅ Banlı', inline: true },
                { name: '📝 Ban Sebebi', value: banInfo.reason || audit?.reason || 'Belirtilmemiş', inline: false },
                { name: '👮 Banlayan Yetkili', value: audit?.moderator || 'Denetim kaydında bulunamadı.', inline: true },
                { name: '📅 Banlanma Tarihi', value: audit?.date ? `<t:${Math.floor(audit.date.getTime() / 1000)}:f>` : 'Denetim kaydında bulunamadı.', inline: true },
                { name: '🌐 Sunucu Adı', value: interaction.guild.name, inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ forceStatic: false }))
            .setFooter({ text: `${interaction.guild.name} • Sorgulama`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({ content: `Bir hata oluştu: ${error.message}` }).catch(() => {});
    }
}
