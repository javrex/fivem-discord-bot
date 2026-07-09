import { Client, GatewayIntentBits, Collection } from 'discord.js';
import config from './config/index.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.activePolls = new Collection();

import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';

client.once('clientReady', (c) => readyEvent(c, client));
client.on('interactionCreate', (i) => interactionCreateEvent(i, client));

client.login(config.token);