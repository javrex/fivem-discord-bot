import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent, PermissionFlagsBits } from 'discord.js';

const PER_PAGE = 5;

const CATEGORIES = [
    { key: 'ban', label: '🔨 Ban Logları', desc: 'Son banlanan kullanıcılar', color: 0xed4245 },
    { key: 'unban', label: '🔓 Unban Logları', desc: 'Son banı kaldırılan kullanıcılar', color: 0x57f287 },
    { key: 'kick', label: '👢 Kick Logları', desc: 'Son atılan kullanıcılar', color: 0xfee75c },
    { key: 'timeout', label: '⏳ Timeout Logları', desc: 'Timeout verilen kullanıcılar', color: 0xfee75c },
    { key: 'untimeout', label: '🔄 Timeout Kaldırma', desc: 'Timeoutu kaldırılan kullanıcılar', color: 0x57f287 },
    { key: 'role_add', label: '➕ Rol Verme', desc: 'Rol verilen kullanıcılar', color: 0x2ecc71 },
    { key: 'role_remove', label: '➖ Rol Alma', desc: 'Rolü alınan kullanıcılar', color: 0xe67e22 },
    { key: 'nick', label: '📝 Nick Değişiklikleri', desc: 'İsmi değiştirilen kullanıcılar', color: 0x3498db },
    { key: 'channel_delete', label: '🗑️ Kanal Silme', desc: 'Silinen kanallar', color: 0xe74c3c },
    { key: 'channel_create', label: '📁 Kanal Oluşturma', desc: 'Oluşturulan kanallar', color: 0x2ecc71 },
    { key: 'role_create', label: '🎭 Rol Oluşturma', desc: 'Oluşturulan roller', color: 0x9b59b6 },
    { key: 'role_delete', label: '🗑️ Rol Silme', desc: 'Silinen roller', color: 0xe74c3c },
    { key: 'guild_update', label: '⚙️ Sunucu Ayarları', desc: 'Değiştirilen sunucu ayarları', color: 0x95a5a6 }
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

async function fetchAuditData(guild) {
    const data = {};
    const promises = [
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 100 }).catch(() => null),
        guild.fetchAuditLogs({ type: AuditLogEvent.GuildUpdate, limit: 100 }).catch(() => null)
    ];

    const results = await Promise.allSettled(promises);

    const rawBan = results[0].status === 'fulfilled' && results[0].value ? results[0].value.entries : [];
    const rawUnban = results[1].status === 'fulfilled' && results[1].value ? results[1].value.entries : [];
    const rawKick = results[2].status === 'fulfilled' && results[2].value ? results[2].value.entries : [];
    const rawMemberUpdate = results[3].status === 'fulfilled' && results[3].value ? results[3].value.entries : [];
    const rawRoleUpdate = results[4].status === 'fulfilled' && results[4].value ? results[4].value.entries : [];
    const rawChannelCreate = results[5].status === 'fulfilled' && results[5].value ? results[5].value.entries : [];
    const rawChannelDelete = results[6].status === 'fulfilled' && results[6].value ? results[6].value.entries : [];
    const rawRoleCreate = results[7].status === 'fulfilled' && results[7].value ? results[7].value.entries : [];
    const rawRoleDelete = results[8].status === 'fulfilled' && results[8].value ? results[8].value.entries : [];
    const rawGuildUpdate = results[9].status === 'fulfilled' && results[9].value ? results[9].value.entries : [];

    data.ban = rawBan.map(e => formatEntry(e, 'Ban'));
    data.unban = rawUnban.map(e => formatEntry(e, 'Unban'));
    data.kick = rawKick.map(e => formatEntry(e, 'Kick'));

    const timeoutAdd = [];
    const timeoutRemove = [];
    const nickChanges = [];

    for (const e of rawMemberUpdate) {
        const changes = e.changes || [];
        const hasTimeout = changes.some(c => c.key === 'communication_disabled_until');
        const hasNick = changes.some(c => c.key === 'nick');

        if (hasTimeout) {
            const change = changes.find(c => c.key === 'communication_disabled_until');
            if (change.old === null && change.new !== null) {
                timeoutAdd.push(formatEntry(e, 'Timeout'));
            } else if (change.old !== null && change.new === null) {
                timeoutRemove.push(formatEntry(e, 'Timeout Kaldırma'));
            }
        }
        if (hasNick) {
            nickChanges.push(formatEntry(e, 'Nick Değişikliği'));
        }
    }

    data.timeout = timeoutAdd;
    data.untimeout = timeoutRemove;
    data.nick = nickChanges;

    const roleAdd = [];
    const roleRemove = [];

    for (const e of rawRoleUpdate) {
        const changes = e.changes || [];
        const added = changes.filter(c => c.key === '$add');
        const removed = changes.filter(c => c.key === '$remove');

        for (const c of added) {
            for (const role of (c.new || [])) {
                roleAdd.push({ ...formatEntry(e, 'Rol Verme'), roleName: role.name, roleId: role.id });
            }
        }
        for (const c of removed) {
            for (const role of (c.new || [])) {
                roleRemove.push({ ...formatEntry(e, 'Rol Alma'), roleName: role.name, roleId: role.id });
            }
        }
    }

    data.role_add = roleAdd;
    data.role_remove = roleRemove;
    data.channel_create = rawChannelCreate.map(e => {
        const name = e.target?.name || (e.changes?.find(c => c.key === 'name')?.new) || 'Bilinmiyor';
        return { ...formatEntry(e, 'Kanal Oluşturma'), targetName: name };
    });
    data.channel_delete = rawChannelDelete.map(e => {
        const name = e.target?.name || (e.changes?.find(c => c.key === 'name')?.old) || 'Bilinmiyor';
        return { ...formatEntry(e, 'Kanal Silme'), targetName: name };
    });
    data.role_create = rawRoleCreate.map(e => {
        const name = e.target?.name || (e.changes?.find(c => c.key === 'name')?.new) || 'Bilinmiyor';
        return { ...formatEntry(e, 'Rol Oluşturma'), targetName: name };
    });
    data.role_delete = rawRoleDelete.map(e => {
        const name = e.target?.name || (e.changes?.find(c => c.key === 'name')?.old) || 'Bilinmiyor';
        return { ...formatEntry(e, 'Rol Silme'), targetName: name };
    });
    data.guild_update = rawGuildUpdate.map(e => {
        const changedKeys = (e.changes || []).map(c => c.key).join(', ') || 'Bilinmeyen değişiklik';
        return { ...formatEntry(e, 'Sunucu Ayarı'), changeSummary: changedKeys };
    });

    return data;
}

function formatEntry(e, actionLabel) {
    return {
        id: e.id,
        targetId: e.targetId || 'Bilinmiyor',
        targetTag: e.target?.tag || e.target?.username || 'Bilinmiyor',
        executorId: e.executorId || 'Bilinmiyor',
        executorTag: e.executor?.tag || e.executor?.username || 'Bilinmiyor',
        reason: e.reason || null,
        createdAt: e.createdAt,
        actionLabel
    };
}

function buildEmbed(categoryKey, entries, page, totalPages, guild, iconURL) {
    const cat = CATEGORY_MAP[categoryKey];
    if (!cat) return null;

    const start = (page - 1) * PER_PAGE;
    const pageEntries = entries.slice(start, start + PER_PAGE);

    const embed = new EmbedBuilder()
        .setColor(cat.color)
        .setTitle(`${cat.label} — ${entries.length} kayıt`)
        .setDescription(cat.desc)
        .setTimestamp()
        .setFooter({ text: `${guild.name} • Sayfa ${page}/${totalPages}`, iconURL: iconURL || null });

    if (pageEntries.length === 0) {
        embed.addFields({ name: '📭 Kayıt', value: 'Bu kategoride kayıt bulunamadı.', inline: false });
        return embed;
    }

    for (const entry of pageEntries) {
        const lines = [
            `👤 **Hedef:** ${entry.targetTag} (\`${entry.targetId}\`)`,
            `👮 **Yetkili:** ${entry.executorTag} (\`${entry.executorId}\`)`,
            `📅 **Tarih:** <t:${Math.floor(entry.createdAt.getTime() / 1000)}:f>`,
            `📌 **İşlem:** ${entry.actionLabel}`
        ];

        if (entry.reason) {
            lines.push(`📝 **Sebep:** ${entry.reason}`);
        }

        if (entry.roleName) {
            lines.push(`🎭 **Rol:** <@&${entry.roleId}>`);
        }

        if (entry.targetName) {
            lines.push(`📁 **İsim:** ${entry.targetName}`);
        }

        if (entry.changeSummary) {
            lines.push(`⚙️ **Değişen:** ${entry.changeSummary}`);
        }

        embed.addFields({ name: `▸ ${entry.targetTag}`, value: lines.join('\n'), inline: false });
    }

    return embed;
}

function buildComponents(categoryKey, page, totalPages) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('category')
        .setPlaceholder('Kategori seç...');

    for (const cat of CATEGORIES) {
        menu.addOptions({
            label: cat.label,
            value: cat.key,
            description: cat.desc,
            default: cat.key === categoryKey
        });
    }

    const prevBtn = new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('⬅ Önceki')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1);

    const nextBtn = new ButtonBuilder()
        .setCustomId('next')
        .setLabel('➡ Sonraki')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages);

    const refreshBtn = new ButtonBuilder()
        .setCustomId('refresh')
        .setLabel('🔄 Yenile')
        .setStyle(ButtonStyle.Primary);

    return [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(prevBtn, refreshBtn, nextBtn)
    ];
}

function hasPermission(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ViewAuditLog);
}

export async function execute(interaction, client) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({
            content: 'Bu komutu kullanmak için **Administrator** veya **View Audit Log** yetkisine sahip olmalısın.',
            ephemeral: true
        });
    }

    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        return interaction.reply({
            content: 'Botun **View Audit Log** yetkisi bulunmuyor. Lütfen bir yetkiliye botun bu yetkiye sahip olduğundan emin olmasını söyle.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const guild = interaction.guild;
        const iconURL = guild.iconURL();

        const auditData = await fetchAuditData(guild);

        let currentCategory = 'ban';
        let currentPage = 1;

        function getEntries(key) {
            return auditData[key] || [];
        }

        function getTotalPages(key) {
            const entries = getEntries(key);
            return Math.max(1, Math.ceil(entries.length / PER_PAGE));
        }

        const totalPages = getTotalPages(currentCategory);
        const embed = buildEmbed(currentCategory, getEntries(currentCategory), currentPage, totalPages, guild, iconURL);

        if (!embed) {
            return interaction.editReply({ content: 'Kategori bulunamadı.' });
        }

        const components = buildComponents(currentCategory, currentPage, totalPages);
        const reply = await interaction.editReply({ embeds: [embed], components });

        const filter = i => i.user.id === interaction.user.id && i.message.id === reply.id;
        const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async i => {
            try {
                if (i.isStringSelectMenu() && i.customId === 'category') {
                    currentCategory = i.values[0];
                    currentPage = 1;

                    const newTotal = getTotalPages(currentCategory);
                    const newEmbed = buildEmbed(currentCategory, getEntries(currentCategory), currentPage, newTotal, guild, iconURL);
                    const newComponents = buildComponents(currentCategory, currentPage, newTotal);

                    await i.update({ embeds: [newEmbed], components: newComponents });
                } else if (i.isButton()) {
                    if (i.customId === 'prev' && currentPage > 1) {
                        currentPage--;
                    } else if (i.customId === 'next' && currentPage < getTotalPages(currentCategory)) {
                        currentPage++;
                    } else if (i.customId === 'refresh') {
                        const freshData = await fetchAuditData(guild);
                        Object.assign(auditData, freshData);
                    }

                    const newTotal = getTotalPages(currentCategory);
                    const newEmbed = buildEmbed(currentCategory, getEntries(currentCategory), currentPage, newTotal, guild, iconURL);
                    const newComponents = buildComponents(currentCategory, currentPage, newTotal);

                    await i.update({ embeds: [newEmbed], components: newComponents });
                }
            } catch {
                // ignore interaction errors
            }
        });

        collector.on('end', () => {
            // Süre doldu — butonlar artık çalışmaz, sessizce geç
        });
    } catch (error) {
        console.error('Sunucu log hatası:', error);
        await interaction.editReply({ content: 'Loglar alınırken bir hata oluştu.' }).catch(() => {});
    }
}
