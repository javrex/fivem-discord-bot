import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { getBanLog, getAllBanLogs } from '../utils/banStore.js';

async function checkPermissions(interaction) {
    const memberPerms = interaction.memberPermissions;
    if (!memberPerms.has(PermissionFlagsBits.Administrator) && !memberPerms.has(PermissionFlagsBits.BanMembers)) {
        await interaction.editReply({ content: 'Bu komutu kullanmak için **Administrator** veya **Ban Members** yetkisine sahip olmalısınız.' });
        return false;
    }
    const botMember = await interaction.guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
        await interaction.editReply({ content: 'Botun **Ban Members** yetkisi yok. Ban listesini sorgulayamıyorum.' });
        return false;
    }
    return true;
}

async function handleSorgu(interaction) {
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
    const displayName = user.globalName || user.username || 'Bilinmiyor';
    const log = getBanLog(interaction.guild.id, user.id);

    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🔨 Ban Sorgusu')
        .addFields(
            { name: '👤 Kullanıcı', value: displayName, inline: true },
            { name: '🆔 Discord ID', value: `\`${user.id}\``, inline: true },
            { name: '📌 Durum', value: '✅ Banlı', inline: true },
            { name: '📝 Ban Sebebi', value: banInfo.reason || 'Belirtilmemiş', inline: false },
            { name: '👮 Banlayan Yetkili', value: log?.moderator_name || 'Discord API tarafından sağlanmıyor.', inline: true },
            { name: '📅 Ban Tarihi', value: log?.banned_at ? `<t:${Math.floor(new Date(log.banned_at).getTime() / 1000)}:f>` : 'Discord API tarafından sağlanmıyor.', inline: true },
            { name: '🌐 Sunucu', value: interaction.guild.name, inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ forceStatic: false }))
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleListe(interaction) {
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

    const logs = getAllBanLogs(interaction.guild.id);
    const allEntries = bans.map(ban => {
        const user = ban.user;
        const log = logs[user.id] || null;
        return {
            user,
            reason: ban.reason || null,
            log
        };
    });

    const totalPages = Math.ceil(allEntries.length / 10) || 1;
    let currentPage = 0;

    function buildEmbed(page) {
        const start = page * 10;
        const pageEntries = allEntries.slice(start, start + 10);
        const lines = pageEntries.map((entry, i) => {
            const name = entry.user.globalName || entry.user.username || 'Bilinmiyor';
            const reason = entry.reason || entry.log?.reason || 'Belirtilmemiş';
            const modName = entry.log?.moderator_name || 'Discord API tarafından sağlanmıyor.';
            const date = entry.log?.banned_at
                ? `<t:${Math.floor(new Date(entry.log.banned_at).getTime() / 1000)}:f>`
                : 'Discord API tarafından sağlanmıyor.';
            return [
                `**${start + i + 1}.** 👤 ${name}`,
                `🆔 \`${entry.user.id}\``,
                `📝 ${reason}`,
                `👮 ${modName}`,
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
                .setCustomId(`banpage~prev~${page}`)
                .setLabel('Önceki Sayfa')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅')
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`banpage~next~${page}`)
                .setLabel('Sonraki Sayfa')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('➡')
                .setDisabled(page >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(`banpage~refresh~${page}`)
                .setLabel('Yenile')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄')
        );
    }

    const reply = await interaction.editReply({ embeds: [buildEmbed(0)], components: [buildRow(0)] });

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
}

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'sorgu') {
            await handleSorgu(interaction);
        } else if (subcommand === 'liste') {
            await handleListe(interaction);
        }
    } catch (error) {
        await interaction.editReply({ content: `Bir hata oluştu: ${error.message}` }).catch(() => {});
    }
}
