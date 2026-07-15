import { Client, GatewayIntentBits, Collection } from 'discord.js';
import config from './config/index.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration
    ]
});

client.activePolls = new Collection();

import readyEvent from './events/ready.js';
import interactionCreateEvent from './events/interactionCreate.js';
import banLogEvent from './events/banLog.js';

client.once('clientReady', (c) => readyEvent(c, client));
client.on('interactionCreate', (i) => interactionCreateEvent(i, client));
client.on('guildBanAdd', (ban) => banLogEvent(ban, client));

client.login(config.token);