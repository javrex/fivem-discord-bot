import { AuditLogEvent } from 'discord.js';
import { addBanLog } from '../utils/banStore.js';

export default async function (ban, client) {
    try {
        const { user, guild } = ban;
        const reason = ban.reason || null;

        let moderatorId = null;
        let moderatorName = null;

        try {
            await new Promise(r => setTimeout(r, 1500));
            const auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 5
            });
            const entry = auditLogs.entries.find(e => e.target?.id === user.id);
            if (entry) {
                moderatorId = entry.executor?.id || null;
                moderatorName = entry.executor?.globalName || entry.executor?.username || null;
            }
        } catch { /* audit log alınamazsa moderator bilgisi olmadan kaydet */ }

        addBanLog(guild.id, user.id, user.globalName || user.username || 'Bilinmiyor', reason, moderatorId, moderatorName);
    } catch { /* sessiz geç */ }
}
