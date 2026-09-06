const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

class SessionManager {
    constructor(dataPath) {
        this.dataPath = dataPath || path.join(__dirname, 'data', 'sessions.json');
        // Tombstone delle conversationId eliminate dall'utente: senza, discoverBrainSessions()
        // le resuscita ad ogni GET /api/sessions perché la cartella agy su disco (brain/<id>)
        // non sparisce solo perché abbiamo tolto la sessione da sessions.json.
        this.deletedConvIdsPath = path.join(path.dirname(this.dataPath), 'deleted-conversations.json');
        this.deletedConversationIds = new Set();
        this.sessions = [];
        this.activeSessionId = null;
        this.currentAssistantMessage = null;
        this.currentBuffer = '';
        this.flushTimer = null;
        this.saveDebounceTimer = null;
        this.pendingPromptEcho = null;
        this.io = null;
        this.onActiveSessionChange = null; // callback(session): usato per allineare il terminale alla conversazione
        this._loadDeletedConversationIds();
        this.load();
    }

    _loadDeletedConversationIds() {
        try {
            if (fs.existsSync(this.deletedConvIdsPath)) {
                const raw = JSON.parse(fs.readFileSync(this.deletedConvIdsPath, 'utf8'));
                if (Array.isArray(raw)) this.deletedConversationIds = new Set(raw);
            }
        } catch (e) {
            console.warn('[SessionManager] Errore caricamento deleted-conversations.json:', e.message);
        }
    }

    _saveDeletedConversationIds() {
        try {
            const dir = path.dirname(this.deletedConvIdsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.deletedConvIdsPath, JSON.stringify([...this.deletedConversationIds], null, 2), 'utf8');
        } catch (e) {
            console.error('[SessionManager] Errore salvataggio deleted-conversations.json:', e.message);
        }
    }

    _notifyActive(session) {
        if (!session || session.id !== this.activeSessionId) return;
        if (typeof this.onActiveSessionChange === 'function') {
            try {
                const r = this.onActiveSessionChange(session);
                if (r && typeof r.catch === 'function') r.catch(e => console.warn('[SessionManager] onActiveSessionChange:', e.message));
            } catch (e) {
                console.warn('[SessionManager] onActiveSessionChange:', e.message);
            }
        }
    }

    // Chiamato da AgentRunner quando la conversazione agy della sessione viene creata/cambia
    notifyConversationChanged(session) {
        this._notifyActive(session);
    }

    setIo(io) {
        this.io = io;
    }

    load() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const raw = fs.readFileSync(this.dataPath, 'utf8');
                this.sessions = JSON.parse(raw);
            } else {
                this.sessions = [];
            }
        } catch (e) {
            console.error('[SessionManager] Errore caricamento sessioni:', e);
            this.sessions = [];
        }

        if (this.sessions.length === 0) {
            const initialSession = this.createSession({ title: 'Nuova Sessione AGY' });
            this.activeSessionId = initialSession.id;
        } else if (!this.activeSessionId || !this.sessions.find(s => s.id === this.activeSessionId)) {
            this.activeSessionId = this.sessions[0].id;
        }
    }

    discoverBrainSessions() {
        try {
            const brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
            if (!fs.existsSync(brainDir)) return;
            const entries = fs.readdirSync(brainDir, { withFileTypes: true });
            let addedAny = false;

            const existingConvIds = new Set();
            this.sessions.forEach(s => {
                if (s.conversationId) existingConvIds.add(s.conversationId);
            });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const convId = entry.name;
                if (!/^[a-zA-Z0-9-]+$/.test(convId)) continue;
                if (existingConvIds.has(convId)) continue;
                if (this.deletedConversationIds.has(convId)) continue;

                const transcriptFile = path.join(brainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');
                if (!fs.existsSync(transcriptFile)) continue;

                try {
                    const stat = fs.statSync(transcriptFile);
                    if (stat.size === 0) continue;

                    const content = fs.readFileSync(transcriptFile, 'utf8');
                    const lines = content.split('\n');
                    let title = 'Sessione Antigravity ' + convId.slice(0, 8);
                    let createdAt = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
                    let updatedAt = stat.mtime.toISOString();

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line.trim());
                            if (parsed.created_at && !createdAt) createdAt = parsed.created_at;
                            if (parsed.type === 'USER_INPUT') {
                                const rawText = typeof parsed.content === 'string' ? parsed.content : '';
                                const match = rawText.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
                                let clean = match ? match[1] : rawText;
                                clean = clean.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '').trim();
                                if (clean) {
                                    title = clean.slice(0, 40) + (clean.length > 40 ? '...' : '');
                                    break;
                                }
                            }
                        } catch (e) {}
                    }

                    const newSession = {
                        id: 'brain-' + convId,
                        conversationId: convId,
                        title: title.replace(/^[\/#!\s]+/, '') || 'Sessione Antigravity',
                        createdAt,
                        updatedAt,
                        workspace: process.env.WORKSPACE_DIR || process.cwd(),
                        messages: []
                    };

                    this.sessions.push(newSession);
                    existingConvIds.add(convId);
                    addedAny = true;
                } catch (err) {}
            }

            if (addedAny) {
                this.save(true);
            }
        } catch (e) {
            console.warn('[SessionManager] Errore discoverBrainSessions:', e.message);
        }
    }

    save(immediate = false) {
        if (immediate) {
            if (this.saveDebounceTimer) {
                clearTimeout(this.saveDebounceTimer);
                this.saveDebounceTimer = null;
            }
            this._writeSessionsToFile();
        } else {
            if (!this.saveDebounceTimer) {
                this.saveDebounceTimer = setTimeout(() => {
                    this.saveDebounceTimer = null;
                    this._writeSessionsToFile();
                }, 1000);
            }
        }
    }

    _writeSessionsToFile() {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const tempPath = this.dataPath + '.' + Date.now() + '.tmp';
            const data = JSON.stringify(this.sessions, null, 2);
            fs.writeFileSync(tempPath, data, 'utf8');
            fs.renameSync(tempPath, this.dataPath);
        } catch (e) {
            console.error('[SessionManager] Errore salvataggio sessioni:', e);
        }
    }

    getSessions() {
        return this.sessions.map(s => {
            const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
            return {
                id: s.id,
                title: s.title || 'Sessione senza titolo',
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                workspace: s.workspace || '',
                messageCount: s.messages ? s.messages.length : 0,
                lastMessagePreview: lastMsg ? (typeof lastMsg.content === 'string' ? lastMsg.content.slice(0, 100) : '') : '',
                isActive: s.id === this.activeSessionId
            };
        }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }

    getSession(id) {
        return this.sessions.find(s => s.id === id) || null;
    }

    getActiveSession() {
        let session = this.getSession(this.activeSessionId);
        if (!session) {
            if (this.sessions.length > 0) {
                session = this.sessions[0];
                this.activeSessionId = session.id;
            } else {
                session = this.createSession({ title: 'Nuova Sessione AGY' });
            }
        }
        return session;
    }

    createSession(options = {}) {
        const id = options.id || 'session-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
        const session = {
            id,
            title: options.title || 'Nuova Sessione AGY',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspace: options.workspace || process.env.WORKSPACE_DIR || process.cwd(),
            messages: []
        };

        this.sessions.unshift(session);
        this.activeSessionId = id;
        this.currentAssistantMessage = null;
        this.pendingPromptEcho = null;
        this.save(true);

        if (this.io) {
            this.io.emit('sessions-updated', this.getSessions());
            this.io.emit('session-switched', session);
        }
        this._notifyActive(session);

        return session;
    }

    switchSession(id) {
        const session = this.getSession(id);
        if (!session) return null;
        this.activeSessionId = id;
        this.currentAssistantMessage = null;
        this.pendingPromptEcho = null;
        if (this.io) {
            this.io.emit('sessions-updated', this.getSessions());
            this.io.emit('session-switched', session);
        }
        this._notifyActive(session);
        return session;
    }

    deleteSession(id) {
        const index = this.sessions.findIndex(s => s.id === id);
        if (index !== -1) {
            const deletedSession = this.sessions[index];
            if (deletedSession.conversationId) {
                // Senza questo tombstone, la prossima GET /api/sessions la resuscita:
                // discoverBrainSessions() la ritrova ancora su disco (agy non cancella
                // la sua cartella brain/<id> solo perché l'abbiamo tolta da sessions.json).
                this.deletedConversationIds.add(deletedSession.conversationId);
                this._saveDeletedConversationIds();
            }
            this.sessions.splice(index, 1);
            if (this.activeSessionId === id) {
                if (this.sessions.length > 0) {
                    this.activeSessionId = this.sessions[0].id;
                } else {
                    const newS = this.createSession({ title: 'Nuova Sessione AGY' });
                    this.activeSessionId = newS.id;
                }
            }
            this.save(true);
            if (this.io) {
                this.io.emit('sessions-updated', this.getSessions());
                this.io.emit('session-switched', this.getActiveSession());
            }
            this._notifyActive(this.getActiveSession());
            return true;
        }
        return false;
    }

    updateSessionTitle(id, title) {
        const session = this.getSession(id);
        if (session) {
            session.title = title.trim() || 'Sessione senza titolo';
            session.updatedAt = new Date().toISOString();
            this.save(true);
            if (this.io) {
                this.io.emit('sessions-updated', this.getSessions());
            }
            return session;
        }
        return null;
    }

    // Aggiunge un messaggio utente alla sessione attiva
    addUserMessage(text) {
        if (!text || !text.trim()) return;
        const session = this.getActiveSession();
        
        // Auto-rinomina la sessione se ha ancora il titolo predefinito
        if (session.title === 'Nuova Sessione AGY' || session.title.startsWith('Nuova Sessione')) {
            const cleanTitle = text.trim().slice(0, 40) + (text.length > 40 ? '...' : '');
            session.title = cleanTitle.replace(/^[\/#!\s]+/, '');
        }

        const msg = {
            id: 'msg-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
            role: 'user',
            content: text.trim(),
            timestamp: new Date().toISOString()
        };

        session.messages.push(msg);
        session.updatedAt = new Date().toISOString();
        this.save(true);

        // Resetta il turno di risposta dell'assistente e imposta il prompt echo atteso
        this.currentAssistantMessage = null;
        this.pendingPromptEcho = text.trim();

        if (this.io) {
            this.io.emit('chat-message', { sessionId: session.id, message: msg });
            this.io.emit('sessions-updated', this.getSessions());
        }

        return msg;
    }

    // Aggiunge un messaggio assistente diretto
    addAssistantMessage(content, toolCalls = []) {
        const session = this.getActiveSession();
        const msg = {
            id: 'msg-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
            role: 'assistant',
            content: content,
            toolCalls: toolCalls || [],
            timestamp: new Date().toISOString()
        };

        session.messages.push(msg);
        session.updatedAt = new Date().toISOString();
        this.save(true);

        if (this.io) {
            this.io.emit('chat-message', { sessionId: session.id, message: msg });
            this.io.emit('sessions-updated', this.getSessions());
        }

        return msg;
    }

    // ── Turni strutturati (AgentRunner, modalità print stream-json) ──────────

    beginAssistantMessage(session) {
        const msg = {
            id: 'msg-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
            role: 'assistant',
            content: '',
            thinking: '',
            toolCalls: [],
            status: 'streaming',
            timestamp: new Date().toISOString()
        };
        session.messages.push(msg);
        session.updatedAt = new Date().toISOString();
        this.currentAssistantMessage = msg;
        this.save(false);
        this._emitStream(session, msg);
        return msg;
    }

    appendAssistantDelta(session, msg, delta) {
        if (!delta) return;
        msg.content += delta;
        session.updatedAt = new Date().toISOString();
        this.save(false);
        this._emitStream(session, msg, delta);
    }

    appendAssistantThinking(session, msg, delta) {
        if (!delta) return;
        msg.thinking = (msg.thinking || '') + delta;
        this._emitStream(session, msg);
    }

    upsertToolCall(session, msg, tool) {
        const existing = msg.toolCalls.find(t => t.stepIndex === tool.stepIndex);
        if (existing) {
            Object.assign(existing, tool);
        } else {
            msg.toolCalls.push(tool);
        }
        this.save(false);
        this._emitStream(session, msg);
    }

    finalizeAssistantMessage(session, msg, { error } = {}) {
        msg.status = error ? 'error' : 'done';
        if (error) msg.error = error;
        if (msg.usage && msg.usage.total_tokens) msg.tokens_used = msg.usage.total_tokens;
        session.updatedAt = new Date().toISOString();
        if (this.currentAssistantMessage && this.currentAssistantMessage.id === msg.id) this.currentAssistantMessage = null;
        this.save(true);
        if (this.io) {
            this.io.emit('chat-message', { sessionId: session.id, message: msg });
            this.io.emit('sessions-updated', this.getSessions());
        }
    }

    _emitStream(session, msg, delta = '') {
        if (!this.io) return;
        this.io.emit('chat-stream', {
            sessionId: session.id,
            messageId: msg.id,
            delta,
            fullContent: msg.content,
            thinking: msg.thinking || '',
            toolCalls: msg.toolCalls || [],
            status: msg.status || 'streaming'
        });
    }

    // Pulisce sequenze di controllo ANSI, codici di colore e caratteri di rendering xterm
    static cleanAnsi(str) {
        if (!str) return '';
        return str
            // Comprehensive ANSI escape sequence removal (CSI, OSC, DEC, etc.)
            .replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1b\\))/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // Remove terminal spinners and progress characters
            .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣻⣽⣾⢿⡿⣟⣯⣷]/g, '')
            // Normalize newlines
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
    }

    // Analizza e processa lo stream di dati proveniente dal PTY
    handlePtyStream(rawChunk) {
        let cleaned = SessionManager.cleanAnsi(rawChunk);
        if (!cleaned) return;

        // Sopprimi l'echo del prompt utente se presente all'inizio dello stream
        if (this.pendingPromptEcho) {
            if (cleaned.includes(this.pendingPromptEcho)) {
                cleaned = cleaned.replace(this.pendingPromptEcho, '').trimStart();
                this.pendingPromptEcho = null;
            } else if (this.pendingPromptEcho.startsWith(cleaned.trim())) {
                // Chunk parziale di echo
                return;
            }
        }

        // Ignora i banner di inizializzazione della CLI se non contengono testo utile
        if (cleaned.includes('Accessing workspace:') || cleaned.includes('Do you trust')) {
            return;
        }

        // Filtra righe di stato transitorie tipiche di CLI interattive
        cleaned = cleaned
            .replace(/[└│┌]\s*Tip:[^\n]*/gi, '')
            .replace(/\?\s*for shortcuts/gi, '')
            .replace(/Generating\.\.\./gi, '')
            .replace(/\r/g, '\n');

        if (!cleaned.trim()) return;

        this.currentBuffer += cleaned;

        // Raggruppa e processa in micro-batch (debounce 80ms)
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushPtyBuffer();
        }, 80);
    }

    flushPtyBuffer() {
        if (!this.currentBuffer) return;
        const textToProcess = this.currentBuffer;
        this.currentBuffer = '';

        const session = this.getActiveSession();
        if (!session) return;

        // Se non c'è un messaggio assistente aperto per il turno corrente, creane uno
        if (!this.currentAssistantMessage) {
            this.currentAssistantMessage = {
                id: 'msg-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
                role: 'assistant',
                content: '',
                toolCalls: [],
                timestamp: new Date().toISOString()
            };
            session.messages.push(this.currentAssistantMessage);
        }

        this.currentAssistantMessage.content += textToProcess;
        session.updatedAt = new Date().toISOString();
        this.save(false); // Salva in modo asincrono debounced

        if (this.io) {
            this.io.emit('chat-stream', {
                sessionId: session.id,
                messageId: this.currentAssistantMessage.id,
                delta: textToProcess,
                fullContent: this.currentAssistantMessage.content
            });
        }
    }
}

module.exports = SessionManager;
