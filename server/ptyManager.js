const pty = require('node-pty');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

class PtyManager {
    constructor(options = {}) {
        this.options = options;
        this.currentWorkspaceDir = options.workspaceDir || process.env.WORKSPACE_DIR || process.cwd();
        this.runnerMode = options.runnerMode || process.env.RUNNER_MODE || 'host'; // 'host' | 'docker'
        this.containerName = options.containerName || null;
        this.conversationId = null; // conversazione agy condivisa con la Chat (--conversation <id>)
        this.ptyProcess = null;
        this.outputHistory = '';
        this.maxHistoryLength = 50000;
        this.listeners = new Set();
        this.resetListeners = new Set(); // avvisano il client di svuotare lo schermo (nuova conversazione)
        this.isWindows = os.platform() === 'win32';
    }

    /**
     * Start PTY process (either Host native CLI or Docker Sandbox Container)
     */
    async start() {
        if (this.ptyProcess) {
            const old = this.ptyProcess;
            this.ptyProcess = null;
            this.killProcess(old);
        }

        const workspaceDir = this.currentWorkspaceDir;
        const defaultShell = this.isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');

        if (this.runnerMode === 'docker') {
            await this.startDockerPty(workspaceDir);
        } else {
            this.startHostPty(workspaceDir, defaultShell);
        }

        return this;
    }

    /**
     * Launch PTY connected directly to Docker Sandbox Runner
     */
    async startDockerPty(workspaceDir) {
        const cleanName = path.basename(workspaceDir).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'default';
        const container = this.containerName || `agyrunner_${cleanName}`;
        this.containerName = container;

        console.log(`[PTY:Docker] Inizializzazione Sandbox Runner per '${container}' in ${workspaceDir}...`);

        try {
            // Check if container is running, start it or create it
            const { stdout } = await execFileAsync('docker', ['inspect', '--format', '{{.State.Status}}', container]).catch(() => ({ stdout: '' }));
            const status = stdout.trim();

            if (status !== 'running') {
                if (status === 'paused') {
                    await execFileAsync('docker', ['unpause', container]);
                } else if (status === 'exited' || status === 'created') {
                    await execFileAsync('docker', ['start', container]);
                } else {
                    // Container does not exist, create and start it
                    console.log(`[PTY:Docker] Creazione nuovo container sandbox: ${container}`);
                    const runArgs = [
                        'run', '-d',
                        '--name', container,
                        '--security-opt', 'no-new-privileges:true',
                        '--cap-drop', 'ALL',
                        '--cap-add', 'CHOWN',
                        '--cap-add', 'SETUID',
                        '--cap-add', 'SETGID',
                        '-v', `${workspaceDir}:/workspace:rw`,
                        '-w', '/workspace',
                        'agyrunner:latest',
                        'tail', '-f', '/dev/null'
                    ];
                    await execFileAsync('docker', runArgs).catch(async () => {
                        // Fallback to node:22-bookworm-slim if agyrunner:latest not found
                        runArgs[runArgs.indexOf('agyrunner:latest')] = 'node:22-bookworm-slim';
                        await execFileAsync('docker', runArgs);
                    });
                }
            }

            const welcomeMsg = `\r\n\x1b[1;36m🪐 AGYUI Docker Sandbox Runner Connesso\x1b[0m\r\n` +
                               `\x1b[90mContainer:\x1b[0m \x1b[33m${container}\x1b[0m | \x1b[90mVolume:\x1b[0m \x1b[32m${workspaceDir}\x1b[0m -> \x1b[35m/workspace\x1b[0m\r\n\r\n`;
            this.broadcastData(welcomeMsg);

            // Spawn interactive docker exec PTY
            this.ptyProcess = pty.spawn('docker', [
                'exec',
                '-it',
                '-e', 'TERM=xterm-256color',
                '-e', 'COLORTERM=truecolor',
                '-e', 'WORKSPACE=/workspace',
                '-w', '/workspace',
                container,
                '/bin/bash'
            ], {
                name: 'xterm-256color',
                cols: this.options.cols || 80,
                rows: this.options.rows || 24,
                cwd: workspaceDir,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                }
            });

            this.bindPtyEvents();
        } catch (err) {
            console.error('[PTY:Docker] Errore avvio Docker Sandbox:', err.message);
            const errMsg = `\r\n\x1b[31m[Errore Docker Sandbox]\x1b[0m Impossibile agganciare il container: ${err.message}\r\n` +
                           `\x1b[33mFallback automatico su Host CLI locale...\x1b[0m\r\n\r\n`;
            this.broadcastData(errMsg);
            this.runnerMode = 'host';
            this.startHostPty(workspaceDir, this.isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash'));
        }
    }

    /**
     * Launch PTY directly on the Host machine
     */
    startHostPty(workspaceDir, defaultShell) {
        let command = this.options.command || process.env.CLI_COMMAND || 'agy';
        let args = this.options.args ? this.options.args.split(' ').filter(Boolean) : [];

        let spawnCmd = command;
        let spawnArgs = args;

        // Terminale e Chat condividono la stessa conversazione agy (come claudecodeui con --resume)
        if (this.conversationId && !spawnArgs.includes('--conversation') && !spawnArgs.includes('--continue')) {
            spawnArgs = [...spawnArgs, '--conversation', this.conversationId];
        }

        console.log(`[PTY:Host] Avvio processo: ${spawnCmd} ${spawnArgs.join(' ')} in ${workspaceDir}`);

        const envPath = [
            path.join(os.homedir(), '.local', 'bin'),
            path.join(os.homedir(), '.gemini', 'antigravity-cli', 'bin'),
            process.env.PATH || ''
        ].filter(Boolean).join(path.delimiter);

        const env = {
            ...process.env,
            PATH: envPath,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            FORCE_COLOR: '1'
        };

        try {
            this.ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
                name: 'xterm-256color',
                cols: this.options.cols || 80,
                rows: this.options.rows || 24,
                cwd: workspaceDir,
                env
            });
        } catch (err) {
            console.warn(`[PTY:Host] Impossibile avviare direttamente '${spawnCmd}'. Fallback su shell (${defaultShell}):`, err.message);
            const shellArgs = this.isWindows ? ['-NoLogo', '-NoExit', '-Command', command] : ['-c', command || defaultShell];
            this.ptyProcess = pty.spawn(defaultShell, shellArgs, {
                name: 'xterm-256color',
                cols: this.options.cols || 80,
                rows: this.options.rows || 24,
                cwd: workspaceDir,
                env
            });
        }

        this.bindPtyEvents();
    }

    /**
     * Bind listeners to ptyProcess
     */
    bindPtyEvents() {
        if (!this.ptyProcess) return;
        const proc = this.ptyProcess;

        proc.onData((data) => {
            // Ignora l'output di un processo già sostituito (evita schermate sovrapposte)
            if (this.ptyProcess !== proc) return;
            this.broadcastData(data);
        });

        proc.onExit(({ exitCode, signal }) => {
            console.log(`[PTY] Processo ${proc.pid} terminato con codice: ${exitCode}, signal: ${signal}`);
            // Solo se è ancora il processo corrente: un processo vecchio non deve azzerare quello nuovo
            if (this.ptyProcess !== proc) return;
            const exitMsg = `\r\n\x1b[33m[agycodeui] Processo terminato (codice: ${exitCode ?? signal}). Invia un comando o tocca 'Riavvia' per riaprire.\x1b[0m\r\n`;
            this.broadcastData(exitMsg);
            this.ptyProcess = null;
        });
    }

    /**
     * Termina un processo PTY in modo affidabile (SIGTERM, poi SIGKILL se ancora vivo)
     */
    killProcess(proc) {
        if (!proc) return;
        const pid = proc.pid;
        try { proc.kill('SIGTERM'); } catch (e) { /* già morto */ }
        setTimeout(() => {
            try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch (e) { /* già terminato */ }
        }, 1500);
    }

    /**
     * Broadcast data to internal history and registered socket listeners
     */
    broadcastData(data) {
        this.outputHistory += data;
        if (this.outputHistory.length > this.maxHistoryLength) {
            this.outputHistory = this.outputHistory.slice(-this.maxHistoryLength);
        }
        for (const listener of this.listeners) {
            try {
                listener(data);
            } catch (e) {}
        }
    }

    /**
     * Switch workspace and optionally runner mode
     */
    async setWorkspace(workspaceDir, runnerMode = 'host', containerName = null) {
        this.currentWorkspaceDir = path.resolve(workspaceDir);
        this.runnerMode = runnerMode;
        if (containerName) this.containerName = containerName;
        this.outputHistory = '';
        return await this.start();
    }

    write(data) {
        if (!this.ptyProcess) {
            this.start();
        }
        if (this.ptyProcess) {
            try {
                this.ptyProcess.write(data);
            } catch (err) {
                console.error('[PTY] Write error:', err.message);
            }
        }
    }

    resize(cols, rows) {
        if (this.ptyProcess && cols > 0 && rows > 0) {
            try {
                this.ptyProcess.resize(cols, rows);
            } catch (err) {
                console.error('[PTY] Errore durante il resize:', err.message);
            }
        }
    }

    async restart() {
        this.outputHistory = '';
        return await this.start();
    }

    /**
     * Allinea il terminale alla conversazione della sessione Chat attiva.
     * Riavvia agy con --conversation <id> solo se cambia davvero.
     */
    async setConversation(conversationId) {
        const next = conversationId || null;
        if (next === this.conversationId && this.ptyProcess) return false;
        this.conversationId = next;
        // Il vecchio processo agy viene ucciso e ne parte uno nuovo (vedi start()):
        // senza avvisare il client di svuotare lo schermo, la sessione eliminata/cambiata
        // resta visibile come scrollback anche se il processo sotto e' gia' un altro.
        this._notifyReset();
        if (next) {
            this.broadcastData(`\r\n\x1b[90m[agycodeui] Terminale allineato alla conversazione della chat (${next.slice(0, 8)}…)\x1b[0m\r\n`);
        }
        await this.restart();
        return true;
    }

    onReset(callback) {
        this.resetListeners.add(callback);
        return () => this.resetListeners.delete(callback);
    }

    _notifyReset() {
        for (const listener of this.resetListeners) {
            try {
                listener();
            } catch (e) {
                console.error('[PTY] Errore listener reset:', e.message);
            }
        }
    }

    onData(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    getHistory() {
        return this.outputHistory;
    }

    getStatus() {
        return {
            running: !!this.ptyProcess,
            pid: this.ptyProcess ? this.ptyProcess.pid : null,
            platform: os.platform(),
            workspace: this.currentWorkspaceDir,
            runnerMode: this.runnerMode,
            containerName: this.containerName
        };
    }
}

module.exports = PtyManager;
