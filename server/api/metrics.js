const express = require('express');

function createMetricsRouter(sessionManager, ptyManager) {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const sessions = sessionManager ? sessionManager.getSessions() : [];
            let totalMessages = 0;
            sessions.forEach(s => {
                totalMessages += s.messageCount || (s.messages ? s.messages.length : 0);
            });

            const activeSession = sessionManager?.getActiveSession();
            const activeMsgCount = activeSession?.messages && Array.isArray(activeSession.messages)
                ? activeSession.messages.length
                : 0;

            const wsCount = ptyManager?.workspaces ? Object.keys(ptyManager.workspaces).length : 1;
            const maxWorkspaces = 10;
            const quotaPercent = Math.min(100, Math.round((wsCount / maxWorkspaces) * 100));

            res.json({
                success: true,
                quota: {
                    workspacesUsed: wsCount,
                    workspacesMax: maxWorkspaces,
                    percent: quotaPercent,
                    tier: 'Standard Cloud Plan',
                    status: 'Attivo'
                },
                session: {
                    activeSessionId: activeSession?.id || null,
                    activeSessionTitle: activeSession?.title || 'Sessione corrente',
                    activeMessages: activeMsgCount,
                    totalSessions: sessions.length,
                    totalMessages: totalMessages,
                    runnerMode: (ptyManager?.runnerMode || 'host').toUpperCase(),
                    cliStatus: ptyManager?.getStatus() || { isAlive: true }
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

module.exports = createMetricsRouter;
