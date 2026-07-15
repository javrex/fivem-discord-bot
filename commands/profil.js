import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const BADGE_MAP = {
    Staff: '🛡️ Discord Staff',
    Partner: '🤝 Discord Partner',
    HypeSquad: '🏠 HypeSquad Events',
    BugHunterLevel1: '🐛 Bug Hunter (Seviye 1)',
    BugHunterLevel2: '🐞 Bug Hunter (Seviye 2)',
    HypeSquadOnlineHouse1: '🟤 HypeSquad Bravery',
    HypeSquadOnlineHouse2: '🟣 HypeSquad Brilliance',
    HypeSquadOnlineHouse3: '🟢 HypeSquad Balance',
    PremiumEarlySupporter: '🌟 Early Supporter',
    VerifiedDeveloper: '👨‍💻 Verified Bot Developer',
    CertifiedModerator: '🪪 Certified Moderator',
    ActiveDeveloper: '⌨️ Active Developer'
};

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const years = Math.floor(totalSec / 31536000);
    const months = Math.floor((totalSec % 31536000) / 2592000);
    const days = Math.floor(((totalSec % 31536000) % 2592000) / 86400);
    const parts = [];
    if (years > 0) parts.push(`${years} yıl`);
    if (months > 0) parts.push(`${months} ay`);
    if (days > 0) parts.push(`${days} gün`);
    return parts.length > 0 ? parts.join(', ') : '1 günden az';
}

function getBadges(user) {
    const flags = user.flags?.toArray() || [];
    return flags.map(f => BADGE_MAP[f] || null).filter(Boolean);
}

function getStatusEmoji(status) {
    const map = {
        online: '🟢 Çevrimiçi',
        idle: '🟡 Boşta',
        dnd: '🔴 Rahatsız Etmeyin',
        offline: '⚫ Çevrimdışı'
    };
    return map[status] || '⚫ Çevrimdışı';
}

function getActivity(presence) {
    if (!presence) return 'Herhangi bir aktivite yok.';
    const activity = presence.activities?.[0];
    if (!activity) return 'Herhangi bir aktivite yok.';
    return `${activity.emoji || ''} **${activity.name}**${activity.details ? ` — ${activity.details}` : ''}`;
}

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('kullanici') || interaction.user;
        const targetMember = interaction.guild.members.cache.get(targetUser.id)
            || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const user = await targetUser.fetch(true);
        const member = targetMember;

        const displayName = member?.displayName || user.globalName || user.username;
        const avatarUrl = user.displayAvatarURL({ size: 1024, forceStatic: false });
        const bannerUrl = user.bannerURL({ size: 1024, forceStatic: false });
        const accentColor = user.hexAccentColor || null;

        const createdDate = user.createdAt;
        const joinDate = member?.joinedAt || null;
        const accountAge = formatDuration(Date.now() - createdDate.getTime());
        const serverDuration = joinDate ? formatDuration(Date.now() - joinDate.getTime()) : 'Bulunamadı';

        const badges = getBadges(user);
        const highestRole = member?.roles.highest?.name !== '@everyone' ? member?.roles.highest : null;
        const roleCount = member?.roles.cache.size - 1 || 0;

        const voiceChannel = member?.voice.channel;
        const presence = member?.presence || null;
        const status = getStatusEmoji(presence?.status || 'offline');
        const activity = getActivity(presence);
        const boostSince = member?.premiumSince || null;
        const boostLevel = boostSince ? `Booster (${formatDuration(Date.now() - boostSince.getTime())})` : 'Boost yapmıyor';

        const embedColor = accentColor ? parseInt(accentColor.replace('#', ''), 16) : 0x2b2d31;

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${displayName}`, iconURL: avatarUrl })
            .setThumbnail(avatarUrl)
            .setDescription([
                `👤 **${escapeMD(user.username)}**`,
                user.discriminator !== '0' ? `#${user.discriminator}` : '',
                `🏷️ **${escapeMD(displayName)}**`
            ].filter(Boolean).join(' '))
            .addFields(
                { name: '🆔 Discord ID', value: `\`${user.id}\``, inline: true },
                { name: '🤖 Bot mu?', value: user.bot ? 'Evet' : 'Hayır', inline: true },
                { name: '🚀 Boost', value: boostLevel, inline: true },
                { name: '🎨 Profil Rengi', value: accentColor || 'Yok', inline: true },
                { name: '🟢 Durum', value: status, inline: true },
                { name: '🎮 Aktivite', value: activity, inline: false },
            );

        if (badges.length > 0) {
            embed.addFields({ name: '🎭 Rozetler', value: badges.join(', '), inline: false });
        }

        embed.addFields(
            { name: '👑 En Yüksek Rol', value: highestRole ? highestRole.toString() : 'Yok', inline: true },
            { name: '📋 Toplam Rol', value: roleCount > 0 ? `${roleCount} rol` : 'Rol yok', inline: true },
            { name: '🎙️ Ses Kanalı', value: voiceChannel ? `<#${voiceChannel.id}>` : 'Bağlı değil', inline: true },
            { name: '📅 Hesap Oluşturulma', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:f>\n⏳ ${accountAge}`, inline: true },
            { name: '📆 Sunucuya Katılma', value: joinDate ? `<t:${Math.floor(joinDate.getTime() / 1000)}:f>\n⏰ ${serverDuration}` : 'Bulunamadı', inline: true }
        );

        if (bannerUrl) {
            embed.setImage(bannerUrl);
        }

        embed.setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });
        embed.setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🖼️ Avatarı Aç')
                .setStyle(ButtonStyle.Link)
                .setURL(avatarUrl)
        );

        if (bannerUrl) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('🌄 Bannerı Aç')
                    .setStyle(ButtonStyle.Link)
                    .setURL(bannerUrl)
            );
        }

        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        const msg = `Bir hata oluştu: ${error.message}`;
        try {
            await interaction.editReply({ content: msg });
        } catch {
            try {
                await interaction.reply({ content: msg, ephemeral: true });
            } catch {
                // nothing we can do
            }
        }
    }
}

function escapeMD(text) {
    return String(text).replace(/[_*~`|>]/g, '\\$&');
}
