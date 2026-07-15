import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'ban_logs.json');

let cache = null;

function ensureDir() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
    if (cache) return cache;
    ensureDir();
    if (existsSync(DATA_FILE)) {
        try {
            cache = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
        } catch {
            cache = {};
        }
    } else {
        cache = {};
    }
    return cache;
}

function save() {
    ensureDir();
    writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

export function addBanLog(guildId, userId, userName, reason, moderatorId, moderatorName) {
    const data = load();
    if (!data[guildId]) data[guildId] = {};
    data[guildId][userId] = {
        user_name: userName,
        reason: reason || null,
        moderator_id: moderatorId || null,
        moderator_name: moderatorName || null,
        banned_at: new Date().toISOString()
    };
    save();
}

export function getBanLog(guildId, userId) {
    const data = load();
    return data[guildId]?.[userId] || null;
}

export function getAllBanLogs(guildId) {
    const data = load();
    return data[guildId] || {};
}
