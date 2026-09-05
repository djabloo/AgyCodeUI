const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const readline = require('readline');

/**
 * AgentRunner: esegue i prompt della Chat in modalità "print" di agy
 * (`agy -p=<prompt> --output-format stream-json`) e traduce gli eventi NDJSON
 * in messaggi strutturati per la UI. Niente scraping del terminale: testo pulito,
 * tool call tracciate, conversazione ripresa con --conversation <id>.
 *
 * Eventi agy osservati:
 *  {"event":"init","conversation_id":"..."}
 *  {"event":"step_update","step_update":{"step_type":"user_input"|"agent_response"|"tool", "state":"ACTIVE"|"DONE"|"ERROR", "text_delta":"...", "tool_name":"...", "tool_info":{...}, "usage":{...}}}
 *  {"event":"result","result":{"status":"SUCCESS"|..., "response":"...", "usage":{...}, "conversation_id":"..."}}
 */
class AgentRunner {
    constructor(options = {}) {
        this.command = options.command || process.env.CLI_COMMAND || 'agy';
        this.getWorkspaceDir = options.getWorkspaceDir || (() => process.env.WORKSPACE_DIR || process.cwd());
        this.sessionManager = options.sessionManager;
        this.io = options.io || null;
        this.active = new Map(); // sessionId -> { child, messageId }
        this.onTurnComplete = null; // callback(session) a fine turno (usato da TranscriptSync)
        this.printTimeoutMs = parseInt(process.env.CHAT_PRINT_TIMEOUT_MS || '600000', 10);
    }

    setIo(io) { this.io = io; }

    isBusy(sessionId) {
        return this.active.has(sessionId);
    }

    /**
     * Estrae --model / --effort / --sandbox da CLI_ARGS (impostazioni salvate in .env)
     */
    parseCliArgs() {
        const raw = (process.env.CLI_ARGS || '').split(' ').filter(Boolean);
        const out = { model: null, effort: null, sandbox: false };
        for (let i = 0; i < raw.length; i++) {
            if (raw[i] === '--model' && raw[i + 1]) out.model = raw[++i];
            else if (raw[i].startsWith('--model=')) out.model = raw[i].slice(8);
            else if (raw[i] === '--effort' && raw[i + 1]) out.effort = raw[++i];
            else if (raw[i].startsWith('--effort=')) out.effort = raw[i].slice(9);
            else if (raw[i] === '--sandbox') out.sandbox = true;
        }
        return out;
    }

    buildEnv() {
        const envPath = [
            path.join(os.homedir(), '.local', 'bin'),
            path.join(os.homedir(), '.gemini', 'antigravity-cli', 'bin'),
            process.env.PATH || ''
        ].filter(Boolean).join(path.delimiter);
        return { ...process.env, PATH: envPath, NO_COLOR: '1', TERM: 'dumb' };
    }

    /**
     * Esegue un turno di chat per la sessione attiva.
     */
    run(session, promptText, options = {}) {
        const sm = this.sessionManager;
        if (!session || !promptText || !promptText.trim()) return null;
        if (this.active.has(session.id)) {
            this.emit('chat-error', { sessionId: session.id, error: 'AGY sta ancora rispondendo: attendi la fine del turno o annulla.' });
            return null;
        }

        const cli = this.parseCliArgs();
        const model = options.model || cli.model || null;
        const effort = options.effort || cli.effort || null;

        const args = [`-p=${promptText}`, '--output-format', 'stream-json', '--dangerously-skip-permissions'];
        if (session.conversationId) args.push('--conversation', session.conversationId);
        if (model) args.push('--model', model);
        if (effort) args.push('--effort', effort);
        if (cli.sandbox) args.push('--sandbox');

        const msg = sm.beginAssistantMessage(session);
        const cwd = this.getWorkspaceDir();
        let child;
        try {
            child = spawn(this.command, args, { cwd, env: this.buildEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (err) {
            sm.finalizeAssistantMessage(session, msg, { error: `Impossibile avviare ${this.command}: ${err.message}` });
            return null;
        }

        this.active.set(session.id, { child, messageId: msg.id });
        let stderrBuf = '';
        let gotResult = false;

        const timer = setTimeout(() => {
            stderrBuf += `\n[agycodeui] Timeout dopo ${Math.round(this.printTimeoutMs / 1000)}s, processo terminato.`;
            try { child.kill('SIGTERM'); } catch (e) { /* ignore */ }
        }, this.printTimeoutMs);

        const rl = readline.createInterface({ input: child.stdout });
        rl.on('line', (line) => {
            if (!line.trim()) return;
            let ev;
            try { ev = JSON.parse(line); } catch (e) {
                // Riga non JSON (es. avviso): la aggiungo come testo
                sm.appendAssistantDelta(session, msg, line + '\n');
                return;
            }
            this.handleEvent(session, msg, ev);
            if (ev.event === 'result') gotResult = true;
        });

        child.stderr.on('data', (d) => { stderrBuf += d.toString(); if (stderrBuf.length > 20000) stderrBuf = stderrBuf.slice(-20000); });

        child.on('close', (code) => {
            clearTimeout(timer);
            this.active.delete(session.id);
            if (msg._newConversation) {
                delete msg._newConversation;
                sm.notifyConversationChanged(session);
            }
            if (typeof this.onTurnComplete === 'function') {
                try { this.onTurnComplete(session); } catch (e) { /* ignore */ }
            }
            const cleanErr = stderrBuf.split('\n').filter((l) => l && !/logging before google\.Init|DeprecationWarning/.test(l)).join('\n').trim();
            if (!gotResult && !msg.content.trim() && !msg.toolCalls.length) {
                sm.finalizeAssistantMessage(session, msg, { error: cleanErr || `agy terminato con codice ${code}` });
            } else if (code !== 0 && !gotResult) {
                sm.finalizeAssistantMessage(session, msg, { error: cleanErr || `agy terminato con codice ${code}` });
            } else {
                sm.finalizeAssistantMessage(session, msg, {});
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            this.active.delete(session.id);
            sm.finalizeAssistantMessage(session, msg, { error: err.message });
        });

        return msg;
    }

    cancel(sessionId) {
        const a = this.active.get(sessionId);
        if (!a) return false;
        try { a.child.kill('SIGINT'); } catch (e) { /* ignore */ }
        setTimeout(() => { try { a.child.kill('SIGKILL'); } catch (e) { /* ignore */ } }, 3000);
        return true;
    }

    handleEvent(session, msg, ev) {
        const sm = this.sessionManager;
        if (ev.event === 'init') {
            if (ev.conversation_id && session.conversationId !== ev.conversation_id) {
                session.conversationId = ev.conversation_id;
                sm.save(false);
                // Il terminale verrà allineato a fine turno (vedi close): farlo ora, con il
                // processo print ancora vivo, fa scattare in agy "Conversation already open".
                msg._newConversation = true;
            }
            return;
        }

        if (ev.event === 'step_update' && ev.step_update) {
            const su = ev.step_update;
            if (su.step_type === 'agent_response') {
                if (su.text_delta) sm.appendAssistantDelta(session, msg, su.text_delta);
                if (su.usage) msg.usage = su.usage;
            } else if (su.step_type === 'tool') {
                sm.upsertToolCall(session, msg, {
                    stepIndex: su.step_index,
                    name: su.tool_name || (su.tool_info && su.tool_info.name) || 'tool',
                    state: su.state || 'ACTIVE',
                    params: su.tool_info ? su.tool_info.parameters : null,
                    error: su.tool_info && su.tool_info.error ? (su.tool_info.error.message || String(su.tool_info.error)) : null,
                    durationSeconds: su.duration_seconds || null,
                });
            } else if (su.step_type === 'thinking' && su.text_delta) {
                sm.appendAssistantThinking(session, msg, su.text_delta);
            }
            return;
        }

        if (ev.event === 'result' && ev.result) {
            const r = ev.result;
            if (r.conversation_id) session.conversationId = r.conversation_id;
            if (r.usage) msg.usage = r.usage;
            // Se non è arrivato nessun delta (es. risposta solo finale), usa il testo completo
            if (!msg.content.trim() && r.response) sm.appendAssistantDelta(session, msg, r.response);
            if (r.status && r.status !== 'SUCCESS') msg.error = `Stato: ${r.status}`;
            return;
        }
    }

    emit(name, payload) {
        if (this.io) this.io.emit(name, payload);
    }
}

module.exports = AgentRunner;
