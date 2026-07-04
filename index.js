import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import config from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Aktiflik, ingame ve maddex komutlarının verilerini saklamak için koleksiyon
client.activePolls = new Collection();

import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';

client.once('ready', (c) => readyEvent(c, client));
client.on('interactionCreate', (i) => interactionCreateEvent(i, client));

client.login(config.token);
