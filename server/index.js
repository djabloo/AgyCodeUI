require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const PtyManager = require('./ptyManager');
const SessionManager = require('./sessionManager');
const fileRouter = require('./api/files');
const createSessionRouter = require('./api/sessions');
const createSettingsRouter = require('./api/settings');
const createWorkspacesRouter = require('./api/workspaces');
const createAgentsRouter = require('./api/agents');
const createWorkflowsRouter = require('./api/workflows');
const createMetricsRouter = require('./api/metrics');
const createPiiRouter = require('./api/pii');

const PORT = process.env.PORT || 3080;
const HOST = process.env.HOST || '0.0.0.0';
const AUTH_PIN = process.env.AUTH_PIN || '';

// Controllo di sicurezza all'avvio: blocca l'ascolto su host pubblico senza autenticazione
if (!AUTH_PIN && HOST !== '127.0.0.1' && HOST !== 'localhost' && !process.env.ALLOW_INSECURE) {
    console.error('\x1b[31m[FATAL] AUTH_PIN vuoto con HOST pubblico (' + HOST + '). Imposta AUTH_PIN o HOST=127.0.0.1 in .env per avviare il server.\x1b[0m');
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: false // Disabilita richieste cross-origin non autorizzate
    },
    allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        // Richieste non-browser o same-origin senza header Origin
        if (!origin) {
            return callback(null, true);
        }
        try {
            const originUrl = new URL(origin);
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            // Verifica che l'origin del client coincida esattamente con l'host del server (prevenzione CSWSH)
            if ((host && originUrl.host === host) || process.env.ALLOW_INSECURE) {
                return callback(null, true);
            }
            return callback(new Error('Origine WebSocket non consentita (Cross-Origin bloccato)'), false);
        } catch (e) {
            return callback(new Error('Header Origin non valido'), false);
        }
    }
});

app.use(express.json());

// Inizializza PTY Manager per Antigravity CLI
const pty = new PtyManager({
    workspaceDir: process.env.WORKSPACE_DIR || process.cwd(),
    command: process.env.CLI_COMMAND || 'agy',
    args: process.env.CLI_ARGS || ''
});

// Inizializza Session Manager per la cronologia delle chat
const sessionManager = new SessionManager();
sessionManager.setIo(io);

// Runner strutturato per la Chat (agy in modalità print + stream-json): niente scraping del terminale
const AgentRunner = require('./agentRunner');
const agentRunner = new AgentRunner({
    command: process.env.CLI_COMMAND || 'agy',
    getWorkspaceDir: () => pty.currentWorkspaceDir || process.env.WORKSPACE_DIR || process.cwd(),
    sessionManager,
    io
});

// Terminale e Chat sulla stessa conversazione agy: al cambio di sessione (o quando la chat
// crea una conversazione) il PTY viene riavviato con --conversation <id>
sessionManager.onActiveSessionChange = (session) => pty.setConversation(session ? session.conversationId : null);

// La Chat rispecchia la trascrizione agy della conversazione (anche i turni fatti dal terminale)
const TranscriptSync = require('./transcriptSync');
const transcriptSync = new TranscriptSync({ sessionManager, agentRunner });
agentRunner.onTurnComplete = (session) => setTimeout(() => transcriptSync.syncSession(session, true), 400);
transcriptSync.start();

// Gestione sicurezza PIN con Timing-Safe comparison e Rate Limiting
const authAttempts = new Map(); // ip -> { count, until }

function pinOk(candidate) {
    if (!AUTH_PIN) return false;
    if (!candidate || typeof candidate !== 'string') return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(AUTH_PIN);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function checkRateLimit(ip) {
    const rec = authAttempts.get(ip);
    if (rec && rec.until > Date.now()) {
        return rec.until;
    }
    return 0;
}

function recordFailedAttempt(ip) {
    const rec = authAttempts.get(ip);
    const count = (rec?.count || 0) + 1;
    const until = count >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
    authAttempts.set(ip, { count, until });
    return { count, until };
}

function resetRateLimit(ip) {
    authAttempts.delete(ip);
}

// Middleware di autenticazione per le API
function requireAuth(req, res, next) {
    if (!AUTH_PIN) return next();
    const authHeader = req.headers['authorization'];
    let token = '';
    if (authHeader && typeof authHeader === 'string') {
        token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    }
    if (token && pinOk(token)) {
        return next();
    }
    return res.status(401).json({ error: 'Non autorizzato. PIN errato o assente.' });
}

// Endpoint di verifica autenticazione con protezione brute-force
app.post('/api/auth', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const blockedUntil = checkRateLimit(ip);
    if (blockedUntil > 0) {
        const waitMinutes = Math.ceil((blockedUntil - Date.now()) / 60000);
        return res.status(429).json({ success: false, error: `Troppi tentativi falliti. Riprova tra ${waitMinutes} minuti.` });
    }

    const { pin } = req.body;
    if (!AUTH_PIN || pinOk(pin)) {
        resetRateLimit(ip);
        return res.json({ success: true, authenticated: true });
    }

    const { until } = recordFailedAttempt(ip);
    if (until > 0) {
        return res.status(429).json({ success: false, error: 'Troppi tentativi falliti. Accesso bloccato per 15 minuti.' });
    }
    return res.status(401).json({ success: false, error: 'PIN non valido' });
});

// Endpoint stato provider OAuth per frontend
app.get('/api/auth/providers', (req, res) => {
    res.json({
        google: { enabled: !!process.env.GOOGLE_CLIENT_ID, clientId: process.env.GOOGLE_CLIENT_ID || '' },
        github: { enabled: !!process.env.GITHUB_CLIENT_ID, clientId: process.env.GITHUB_CLIENT_ID || '' },
        email: true
    });
});

// Endpoint profilo utente per ambiente self-hosted
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
        user: {
            id: 'local-admin',
            email: 'admin@localhost',
            full_name: 'Admin Locale (Self-Hosted)',
            role: 'admin',
            auth_provider: 'local',
            permissions: { canExecute: true, canEditFiles: true, canManageMcp: true, canManageWorkspaces: true }
        },
        subscription: { plan_tier: 'self-hosted', credits_remaining: 'Illimitati' }
    });
});

// Endpoint di stato
app.get('/api/status', requireAuth, (req, res) => {
    res.json({
        ...pty.getStatus(),
        workspace: process.env.WORKSPACE_DIR || process.cwd(),
        command: process.env.CLI_COMMAND || 'agy',
        authRequired: !!AUTH_PIN,
        activeSession: sessionManager.getActiveSession()
    });
});

// Endpoint per riavviare la sessione CLI
app.post('/api/restart', requireAuth, (req, res) => {
    io.emit('terminal-reset');
    pty.restart();
    io.emit('terminal-output', '\r\n\x1b[32m[agycodeui] Sessione AGY riavviata con successo.\x1b[0m\r\n');
    res.json({ success: true, message: 'Sessione riavviata' });
});

// Router File Explorer, Sessioni, Impostazioni, Workspaces, Agenti e Workflows
app.use('/api/files', requireAuth, fileRouter);
app.use('/api/sessions', requireAuth, createSessionRouter(sessionManager, pty));
app.use('/api/settings', requireAuth, createSettingsRouter(sessionManager, pty));
app.use('/api/workspaces', requireAuth, createWorkspacesRouter(sessionManager, pty, io));
app.use('/api/agents', requireAuth, createAgentsRouter(sessionManager, pty, io));
app.use('/api/workflows', requireAuth, createWorkflowsRouter(sessionManager, pty, io));
app.use('/api/metrics', requireAuth, createMetricsRouter(sessionManager, pty));
app.use('/api/pii', requireAuth, createPiiRouter(pty));

// Servire i file statici del client
app.use(express.static(path.join(__dirname, '../public')));

// Socket.io Middleware per autenticazione sicura (solo auth payload)
io.use((socket, next) => {
    if (!AUTH_PIN) return next();
    const authPin = socket.handshake.auth ? socket.handshake.auth.token : null;
    if (authPin && pinOk(authPin)) {
        return next();
    }
    return next(new Error('Autenticazione richiesta'));
});

// Gestione connessione Socket.io
io.on('connection', (socket) => {
    console.log(`[Socket] Nuovo client connesso: ${socket.id}`);

    // Invia la cronologia recente del terminale al nuovo client
    const history = pty.getHistory();
    if (history) {
        socket.emit('terminal-output', history);
    }

    // Invia lo stato delle sessioni e la sessione attiva
    socket.emit('sessions-updated', sessionManager.getSessions());
    socket.emit('session-switched', sessionManager.getActiveSession());

    // Invio prompt da interfaccia Chat → turno strutturato (agy -p, stream-json)
    socket.on('chat-prompt', (promptText, options) => {
        if (!promptText || typeof promptText !== 'string' || !promptText.trim()) return;
        const session = sessionManager.getActiveSession();
        if (agentRunner.isBusy(session.id)) {
            socket.emit('chat-error', { sessionId: session.id, error: 'AGY sta ancora rispondendo: attendi la fine del turno o annulla.' });
            return;
        }
        sessionManager.addUserMessage(promptText);
        agentRunner.run(session, promptText, options && typeof options === 'object' ? options : {});
    });

    // Annulla il turno di chat in corso
    socket.on('chat-cancel', () => {
        const session = sessionManager.getActiveSession();
        agentRunner.cancel(session.id);
    });

    // Ricezione input da terminale interattivo (il terminale non alimenta più la chat)
    socket.on('terminal-input', (data) => {
        pty.write(data);
    });

    // Ridimensionamento terminale (resize)
    socket.on('resize', ({ cols, rows }) => {
        pty.resize(cols, rows);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnesso: ${socket.id}`);
    });
});

// Trasmetti l'output di PTY ai client (solo terminale: la chat usa AgentRunner)
pty.onData((data) => {
    io.emit('terminal-output', data);
});

// Il processo agy sotto il terminale viene sostituito (nuova conversazione,
// switch/eliminazione sessione): avvisa i client di svuotare lo schermo,
// altrimenti la vecchia sessione resta visibile come scrollback anche se
// il processo reale è già un altro (bug segnalato da Tino il 2026-09-06).
pty.onReset(() => {
    io.emit('terminal-reset');
});

// Avvia il PTY già allineato alla conversazione della sessione attiva (se esiste)
const activeAtBoot = sessionManager.getActiveSession();
pty.conversationId = activeAtBoot && activeAtBoot.conversationId ? activeAtBoot.conversationId : null;
pty.start();

// Avvia il server HTTP
server.listen(PORT, HOST, () => {
    console.log('====================================================');
    console.log(`🚀 agycodeui è attivo su http://${HOST}:${PORT}`);
    console.log(`📂 Cartella di lavoro: ${process.env.WORKSPACE_DIR || process.cwd()}`);
    console.log(`🔒 Protezione PIN: ${AUTH_PIN ? 'Abilitata' : 'Disabilitata'}`);
    console.log('====================================================');
});
