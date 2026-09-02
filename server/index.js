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
            if (host && originUrl.host === host) {
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

    // Invio prompt da interfaccia Chat
    socket.on('chat-prompt', (promptText) => {
        if (!promptText || !promptText.trim()) return;
        sessionManager.addUserMessage(promptText);
        pty.write(promptText + '\r');
    });

    // Ricezione input da terminale interattivo
    socket.on('terminal-input', (data) => {
        if (typeof data === 'string' && data.length > 3 && data.endsWith('\r')) {
            const clean = SessionManager.cleanAnsi(data.slice(0, -1)).trim();
            if (clean && !clean.startsWith('\x1b') && clean !== 'y' && clean !== 'n') {
                sessionManager.addUserMessage(clean);
            }
        }
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

// Trasmetti l'output di PTY a tutti i client collegati e al SessionManager
pty.onData((data) => {
    io.emit('terminal-output', data);
    sessionManager.handlePtyStream(data);
});

// Avvia il PTY
pty.start();

// Avvia il server HTTP
server.listen(PORT, HOST, () => {
    console.log('====================================================');
    console.log(`🚀 agycodeui è attivo su http://${HOST}:${PORT}`);
    console.log(`📂 Cartella di lavoro: ${process.env.WORKSPACE_DIR || process.cwd()}`);
    console.log(`🔒 Protezione PIN: ${AUTH_PIN ? 'Abilitata' : 'Disabilitata'}`);
    console.log('====================================================');
});
