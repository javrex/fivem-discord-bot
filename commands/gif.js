import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import sharp from 'sharp';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

export async function execute(interaction) {
    const attachment = interaction.options.getAttachment('resim', true);

    const ext = attachment.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        return interaction.reply({
            content: 'Desteklenen formatlar:\n**PNG**\n**JPG**\n**JPEG**\n**WEBP**',
            ephemeral: true
        });
    }

    if (!ALLOWED_MIMES.includes(attachment.contentType)) {
        return interaction.reply({
            content: 'Desteklenen formatlar:\n**PNG**\n**JPG**\n**JPEG**\n**WEBP**',
            ephemeral: true
        });
    }

    if (attachment.size > 8 * 1024 * 1024) {
        return interaction.reply({
            content: 'Dosya boyutu 8 MB\'dan büyük olamaz.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const response = await fetch(attachment.url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
            return interaction.editReply({ content: 'Resim indirilemedi. Lütfen tekrar dene.' });
        }

        const inputBuffer = Buffer.from(await response.arrayBuffer());

        const metadata = await sharp(inputBuffer).metadata();
        const maxDimension = 2000;
        let pipeline = sharp(inputBuffer);

        if ((metadata.width && metadata.width > maxDimension) || (metadata.height && metadata.height > maxDimension)) {
            pipeline = pipeline.resize({
                width: metadata.width > maxDimension ? maxDimension : undefined,
                height: metadata.height > maxDimension ? maxDimension : undefined,
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        const gifBuffer = await pipeline
            .gif({
                colours: 256,
                dither: 0,
                loop: 0,
                delay: 100
            })
            .toBuffer();

        const baseName = attachment.name.replace(/\.[^.]+$/, '');
        const gifFile = new AttachmentBuilder(gifBuffer, { name: `${baseName}.gif` });

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('✅ GIF başarıyla oluşturuldu')
            .addFields(
                { name: '📁 Orijinal', value: attachment.name, inline: true },
                { name: '📦 Orijinal Boyut', value: formatSize(attachment.size), inline: true },
                { name: '📦 GIF Boyutu', value: formatSize(gifBuffer.length), inline: true },
                { name: '📐 Çözünürlük', value: `${metadata.width}×${metadata.height}`, inline: true }
            )
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], files: [gifFile] });
    } catch (error) {
        console.error('GIF dönüştürme hatası:', error);
        await interaction.editReply({ content: '❌ GIF oluşturulamadı. Dosyanın geçerli bir resim olduğundan emin ol.' }).catch(() => {});
    }
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
