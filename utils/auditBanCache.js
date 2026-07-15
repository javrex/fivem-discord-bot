import { AuditLogEvent } from 'discord.js';

export async function buildAuditBanMap(guild, limit = 100) {
    const map = new Map();
    try {
        const auditLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanAdd,
            limit
        });
        for (const entry of auditLogs.entries.values()) {
            const targetId = entry.target?.id;
            if (!targetId || map.has(targetId)) continue;
            map.set(targetId, {
                moderator: entry.executor?.globalName || entry.executor?.username || 'Bilinmiyor',
                moderatorId: entry.executor?.id || null,
                reason: entry.reason || null,
                date: entry.createdAt
            });
        }
    } catch { /* audit log alınamazsa boş map */ }
    return map;
}
