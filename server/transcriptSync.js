const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * TranscriptSync: rende la Chat lo specchio della conversazione agy, qualunque sia
 * l'origine dei messaggi (chat o terminale). agy scrive ogni conversazione in
 *   ~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript.jsonl
 * (una riga JSON per step: USER_INPUT, PLANNER_RESPONSE con content/thinking/tool_calls,
 * GENERIC = risultato tool, SYSTEM_MESSAGE). Come claudecodeui con i .jsonl di Claude Code.
 */
class TranscriptSync {
    constructor({ sessionManager, agentRunner, pollMs = 1500 }) {
        this.sm = sessionManager;
        this.runner = agentRunner;
        this.pollMs = pollMs;
        this.lastSig = new Map(); // conversationId -> `${size}:${mtimeMs}`
        this.timer = null;
    }

    transcriptPath(conversationId) {
        if (!conversationId || !/^[a-zA-Z0-9-]+$/.test(conversationId)) return null;
        return path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain', conversationId, '.system_generated', 'logs', 'transcript.jsonl');
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), this.pollMs);
        if (this.timer.unref) this.timer.unref();
    }

    tick() {
        const session = this.sm.getActiveSession();
        if (!session || !session.conversationId) return;
        if (this.runner && this.runner.isBusy(session.id)) return; // durante lo streaming lascia fare ad AgentRunner
        this.syncSession(session);
    }

    /**
     * Rilegge la trascrizione e, se cambiata, sostituisce i messaggi della sessione.
     * @returns {boolean} true se la sessione è stata aggiornata
     */
    syncSession(session, force = false) {
        const file = this.transcriptPath(session.conversationId);
        if (!file) return false;
        let stat;
        try { stat = fs.statSync(file); } catch (e) { return false; }
        const sig = `${stat.size}:${Math.round(stat.mtimeMs)}`;
        if (!force && this.lastSig.get(session.conversationId) === sig) return false;
        this.lastSig.set(session.conversationId, sig);

        let raw;
        try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
        const messages = TranscriptSync.parse(raw, session.conversationId);
        if (!messages.length) return false;

        const before = JSON.stringify(session.messages.map(m => [m.role, m.content, (m.toolCalls || []).length]));
        const after = JSON.stringify(messages.map(m => [m.role, m.content, (m.toolCalls || []).length]));
        if (before === after) return false;

        session.messages = messages;
        session.updatedAt = new Date().toISOString();
        // Titolo automatico dal primo messaggio utente
        const firstUser = messages.find(m => m.role === 'user');
        if (firstUser && (!session.title || /^Nuova Sessione/.test(session.title))) {
            const t = firstUser.content.trim().slice(0, 40);
            session.title = (t + (firstUser.content.length > 40 ? '...' : '')).replace(/^[\/#!\s]+/, '') || session.title;
        }
        this.sm.save(false);
        if (this.sm.io) {
            this.sm.io.emit('session-switched', session);
            this.sm.io.emit('sessions-updated', this.sm.getSessions());
        }
        return true;
    }

    /**
     * Converte le righe della trascrizione in messaggi chat (user / assistant).
     */
    static parse(raw, conversationId) {
        const messages = [];
        let current = null; // turno assistente in costruzione
        const lines = raw.split('\n');

        const closeTurn = () => {
            if (current) {
                current.content = current.parts.join('\n\n').trim();
                delete current.parts;
                if (current.content || current.toolCalls.length || current.thinking) messages.push(current);
                current = null;
            }
        };

        lines.forEach((line, idx) => {
            const l = line.trim();
            if (!l) return;
            let o;
            try { o = JSON.parse(l); } catch (e) { return; }
            const source = o.source || '';
            const type = o.type || '';
            const ts = o.created_at || new Date().toISOString();

            if (type === 'USER_INPUT') {
                closeTurn();
                const text = TranscriptSync.extractUserText(o.content || '');
                if (!text) return;
                messages.push({ id: `t-${conversationId.slice(0, 8)}-${idx}`, role: 'user', content: text, timestamp: ts, fromTranscript: true });
                return;
            }
            if (source !== 'MODEL') return; // SYSTEM_MESSAGE e altro: ignorati

            if (!current) {
                current = { id: `t-${conversationId.slice(0, 8)}-${idx}`, role: 'assistant', parts: [], thinking: '', toolCalls: [], status: 'done', timestamp: ts, fromTranscript: true };
            }

            if (type === 'PLANNER_RESPONSE') {
                if (o.thinking) current.thinking += (current.thinking ? '\n\n' : '') + String(o.thinking).trim();
                if (Array.isArray(o.tool_calls)) {
                    o.tool_calls.forEach((tc, j) => {
                        current.toolCalls.push({
                            stepIndex: `${idx}.${j}`,
                            name: tc.name || 'tool',
                            params: TranscriptSync.cleanArgs(tc.args),
                            state: 'DONE',
                        });
                    });
                }
                if (o.content && String(o.content).trim()) current.parts.push(String(o.content).trim());
            } else if (type === 'GENERIC') {
                // Risultato di un tool: se segnala errore, marca l'ultima tool call
                const c = String(o.content || '');
                const last = current.toolCalls[current.toolCalls.length - 1];
                if (last) {
                    const m = c.match(/exited with code (\d+)/);
                    if (m && m[1] !== '0') { last.state = 'ERROR'; last.error = `exit code ${m[1]}`; }
                    if (/TOOL_ERROR|Permission denied/i.test(c)) { last.state = 'ERROR'; last.error = c.split('\n').find(x => /error|denied/i.test(x)) || 'errore tool'; }
                }
            }
        });
        closeTurn();
        return messages;
    }

    static extractUserText(content) {
        const m = content.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
        let text = m ? m[1] : content;
        text = text.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '').trim();
        return text;
    }

    static cleanArgs(args) {
        if (!args || typeof args !== 'object') return null;
        const out = {};
        for (const [k, v] of Object.entries(args)) {
            if (k === 'toolAction' || k === 'toolSummary') continue;
            let val = v;
            if (typeof val === 'string') {
                // agy salva i valori JSON-encoded ("\"/workspace\"")
                try { const p = JSON.parse(val); if (typeof p === 'string' || typeof p === 'number') val = p; } catch (e) { /* plain */ }
            }
            out[k] = val;
        }
        return out;
    }
}

module.exports = TranscriptSync;
