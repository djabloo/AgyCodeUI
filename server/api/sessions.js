const express = require('express');

module.exports = function createSessionRouter(sessionManager, ptyManager) {
    const router = express.Router();

    // Elenco di tutte le sessioni
    router.get('/', (req, res) => {
        try {
            sessionManager.load();
            if (typeof sessionManager.discoverBrainSessions === 'function') {
                sessionManager.discoverBrainSessions();
            }
            const list = sessionManager.getSessions();
            res.json({ sessions: list });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Dettaglio di una sessione specifica
    router.get('/:id', (req, res) => {
        try {
            const session = sessionManager.getSession(req.params.id);
            if (!session) {
                return res.status(404).json({ error: 'Sessione non trovata' });
            }
            res.json({ session });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Crea una nuova sessione
    router.post('/', (req, res) => {
        try {
            const { title, workspace } = req.body || {};
            const session = sessionManager.createSession({ title, workspace });
            res.json({ success: true, session });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Seleziona la sessione attiva
    router.post('/:id/switch', (req, res) => {
        try {
            const session = sessionManager.switchSession(req.params.id);
            if (!session) {
                return res.status(404).json({ error: 'Sessione non trovata' });
            }
            res.json({ success: true, session });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Rinomina una sessione
    router.put('/:id/title', (req, res) => {
        try {
            const { title } = req.body || {};
            if (!title) {
                return res.status(400).json({ error: 'Titolo obbligatorio' });
            }
            const session = sessionManager.updateSessionTitle(req.params.id, title);
            if (!session) {
                return res.status(404).json({ error: 'Sessione non trovata' });
            }
            res.json({ success: true, session });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Elimina una sessione
    router.delete('/:id', (req, res) => {
        try {
            const deleted = sessionManager.deleteSession(req.params.id);
            if (!deleted) {
                return res.status(404).json({ error: 'Sessione non trovata' });
            }
            res.json({ success: true, message: 'Sessione eliminata' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Riprende una sessione riavviando AGY con --continue se supportato
    router.post('/:id/resume', (req, res) => {
        try {
            const session = sessionManager.switchSession(req.params.id);
            if (!session) {
                return res.status(404).json({ error: 'Sessione non trovata' });
            }

            // Il terminale viene allineato automaticamente alla conversazione della sessione
            // (hook onActiveSessionChange); se la sessione non ha ancora una conversazione, riavvia agy pulito.
            if (ptyManager && !session.conversationId) {
                ptyManager.setConversation(null);
            }

            res.json({ success: true, message: 'Sessione ripresa', session });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
