import * as aktiflikCommand from '../commands/aktiflik.js';
import * as ingameCommand from '../commands/ingame.js';
import * as maddexCommand from '../commands/maddex.js';
import * as toplusescekmeCommand from '../commands/toplusescekme.js';
import * as aktiflikbitirCommand from '../commands/aktiflikbitir.js';
import * as komutlarCommand from '../commands/komutlar.js';
import * as ticketkurCommand from '../commands/ticketkur.js';
import * as mesajCommand from '../commands/mesaj.js';
import * as fivemCommand from '../commands/fivem.js';

import handleAktiflikButton from '../buttons/aktiflik.js';
import handleIngameButton from '../buttons/ingame.js';
import handleMaddexButton from '../buttons/maddex.js';
import config from '../config/index.js';

// Komut isimleriyle işleyicileri eşleştir
const commandMap = {
    'aktiflik': aktiflikCommand,
    'ingame': ingameCommand,
    'maddex': maddexCommand,
    'toplusescekme': toplusescekmeCommand,
    'aktiflikbitir': aktiflikbitirCommand,
    'komutlar': komutlarCommand,
    'ticketkur': ticketkurCommand,
    'mesaj': mesajCommand,
    'fivem': fivemCommand
};

// Gelen tüm etkileşimleri yönetir
export default async function(interaction, client) {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName !== 'komutlar' && interaction.commandName !== 'fivem') {
                const allowedRoles = Array.isArray(config.allowedRoles) ? config.allowedRoles : [];
                const hasPermission = interaction.member?.roles.cache.some(
                    role => allowedRoles.includes(role.id)
                );

                if (!hasPermission) {
                    return interaction.reply({
                        content: 'Bu komutu kullanma yetkiniz bulunmuyor.',
                        ephemeral: true
                    });
                }
            }

            const command = commandMap[interaction.commandName];
            if (command) {
                await command.execute(interaction, client);
            }
        } else if (interaction.isButton()) {
            const customId = interaction.customId;

            // Buton customId'sine göre ilgili işleyiciye yönlendir
            if (customId.startsWith('aktiflik_')) {
                await handleAktiflikButton(interaction, client);
            } else if (customId.startsWith('ingame_')) {
                await handleIngameButton(interaction, client);
            } else if (customId.startsWith('maddex_')) {
                await handleMaddexButton(interaction, client);
            } else if (customId.startsWith('ticket_')) {
                const handleTicketButton = (await import('../buttons/ticket.js')).default;
                await handleTicketButton(interaction, client);
            }
        }
    } catch (error) {
        console.error('İşlem sırasında hata:', error);

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Bir hata oluştu.' });
            } else if (interaction.isRepliable()) {
                await interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
            }
        } catch {}
    }
}
