import { EmbedBuilder } from 'discord.js';
import { addTakip, removeTakip, getTakipList } from '../utils/takipStore.js';

export async function execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ekle') return handleEkle(interaction);
    if (sub === 'sil') return handleSil(interaction);
    if (sub === 'liste') return handleListe(interaction, client);
}

async function handleEkle(interaction) {
    const playerName = interaction.options.getString('oyuncuadı', true).trim();
    if (!playerName) {
        return interaction.reply({ content: 'Geçerli bir oyuncu adı girin.', ephemeral: true });
    }

    const added = addTakip(interaction.guildId, playerName, interaction.user.id, interaction.channel.id);
    if (!added) {
        return interaction.reply({
            content: `**${playerName}** zaten takip listende bulunuyor.`,
            ephemeral: true
        });
    }

    await interaction.reply({
        content: `✅ **${playerName}** takip listene eklendi. Oyuncu herhangi bir sunucuda görüldüğünde <#${interaction.channel.id}> kanalına bildirim gönderilecek.`,
        ephemeral: true
    });
}

async function handleSil(interaction) {
    const playerName = interaction.options.getString('oyuncuadı', true).trim();
    if (!playerName) {
        return interaction.reply({ content: 'Geçerli bir oyuncu adı girin.', ephemeral: true });
    }

    const removed = removeTakip(interaction.guildId, playerName);
    if (!removed) {
        return interaction.reply({
            content: `**${playerName}** takip listenizde bulunamadı.`,
            ephemeral: true
        });
    }

    await interaction.reply({
        content: `✅ **${playerName}** takip listenden kaldırıldı.`,
        ephemeral: true
    });
}

async function handleListe(interaction, client) {
    const list = getTakipList(interaction.guildId);
    const entries = Object.values(list);

    if (entries.length === 0) {
        return interaction.reply({
            content: 'Takip listen boş. Bir oyuncuyu takibe eklemek için `/takip ekle` komutunu kullan.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('🎯 Takip Edilen Oyuncular')
        .setDescription(`Toplam **${entries.length}** oyuncu takip ediliyor.`)
        .setTimestamp()
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

    const fields = [];
    for (const entry of entries) {
        let addedBy = 'Bilinmiyor';
        try {
            const user = await client.users.fetch(entry.added_by);
            addedBy = user.tag;
        } catch {}

        const channelInfo = entry.channel_id ? `<#${entry.channel_id}>` : 'Bilinmiyor';
        const date = new Date(entry.added_at);
        const dateStr = date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        fields.push({
            name: `👤 ${entry.player_name}`,
            value: `Ekleyen: ${addedBy}\nKanal: ${channelInfo}\nTarih: ${dateStr}`,
            inline: false
        });
    }

    embed.addFields(fields);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}
