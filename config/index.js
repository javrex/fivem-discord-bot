import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let fileConfig = {};

try {
    fileConfig = require('./config.json');
} catch {}

const config = {
    token: process.env.TOKEN || fileConfig.token,
    clientId: process.env.CLIENT_ID || fileConfig.clientId,
    guildId: process.env.GUILD_ID || fileConfig.guildId,
    allowedRoles: process.env.ALLOWED_ROLES
        ? process.env.ALLOWED_ROLES.split(',').map(r => r.trim())
        : (fileConfig.allowedRoles || [])
};

export default config;
