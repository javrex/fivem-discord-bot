import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
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

        const bans = await interaction.guild.bans.fetch();
        if (bans.size === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('📋 Ban Listesi')
                .setDescription('Bu sunucuda banlı kullanıcı bulunmuyor.')
                .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                .setTimestamp();
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        const auditMap = await buildAuditBanMap(interaction.guild, 100);

        const allEntries = bans.map(ban => {
            const u = ban.user;
            const a = auditMap.get(u.id);
            return {
                id: u.id,
                name: u.globalName || u.username || 'Bilinmiyor',
                avatar: u.displayAvatarURL({ forceStatic: false }),
                reason: ban.reason || a?.reason || null,
                moderator: a?.moderator || null,
                date: a?.date || null
            };
        });

        const perPage = 10;
        const totalPages = Math.ceil(allEntries.length / perPage) || 1;

        function buildEmbed(page) {
            const start = page * perPage;
            const pageEntries = allEntries.slice(start, start + perPage);
            const lines = pageEntries.map((e, i) => {
                const reason = e.reason || 'Belirtilmemiş';
                const mod = e.moderator || 'Denetim kaydında bulunamadı.';
                const date = e.date
                    ? `<t:${Math.floor(e.date.getTime() / 1000)}:f>`
                    : 'Denetim kaydında bulunamadı.';
                return [
                    `**${start + i + 1}.** 👤 ${e.name}`,
                    `🆔 \`${e.id}\``,
                    `👮 ${mod}`,
                    `📝 ${reason}`,
                    `📅 ${date}`
                ].join('\n');
            });

            return new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle(`📋 Ban Listesi — Toplam ${allEntries.length} ban`)
                .setDescription(lines.join('\n\n'))
                .setFooter({ text: `Sayfa ${page + 1}/${totalPages} • ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
                .setTimestamp();
        }

        function buildRow(page) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`banliste~prev~${page}`)
                    .setLabel('Önceki Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅')
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`banliste~next~${page}`)
                    .setLabel('Sonraki Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('➡')
                    .setDisabled(page >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`banliste~refresh~${page}`)
                    .setLabel('Yenile')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄')
            );
        }

        const reply = await interaction.editReply({
            embeds: [buildEmbed(0)],
            components: [buildRow(0)]
        });

        const filter = i => i.user.id === interaction.user.id && i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (i) => {
            const [, action, pageStr] = i.customId.split('~');
            let newPage = parseInt(pageStr) || 0;

            if (action === 'prev') newPage = Math.max(0, newPage - 1);
            else if (action === 'next') newPage = Math.min(newPage + 1, totalPages - 1);

            await i.update({ embeds: [buildEmbed(newPage)], components: [buildRow(newPage)] });
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {});
        });
    } catch (error) {
        await interaction.editReply({ content: `Bir hata oluştu: ${error.message}` }).catch(() => {});
    }
}
