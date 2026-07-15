import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'takip.json');

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

export function addTakip(guildId, playerName, addedBy) {
    const data = load();
    const key = playerName.toLowerCase();
    if (!data[guildId]) data[guildId] = {};
    if (data[guildId][key]) return false;
    data[guildId][key] = {
        player_name: playerName,
        added_by: addedBy,
        added_at: new Date().toISOString()
    };
    save();
    return true;
}

export function removeTakip(guildId, playerName) {
    const data = load();
    const key = playerName.toLowerCase();
    if (!data[guildId] || !data[guildId][key]) return false;
    delete data[guildId][key];
    if (Object.keys(data[guildId]).length === 0) delete data[guildId];
    save();
    return true;
}

export function getTakipList(guildId) {
    const data = load();
    return data[guildId] || {};
}

export function getAllTrackedPlayers() {
    const data = load();
    const result = [];
    for (const [guildId, players] of Object.entries(data)) {
        for (const [key, info] of Object.entries(players)) {
            result.push({ guildId, key, ...info });
        }
    }
    return result;
}
