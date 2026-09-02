const pty = require('node-pty');
const os = require('os');
const path = require('path');

class PtyManager {
    constructor(options = {}) {
        this.options = options;
        this.ptyProcess = null;
        this.outputHistory = '';
        this.maxHistoryLength = 50000;
        this.listeners = new Set();
        this.isWindows = os.platform() === 'win32';
    }

    start() {
        const workspaceDir = this.options.workspaceDir || process.env.WORKSPACE_DIR || process.cwd();
        const defaultShell = this.isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');
        
        let command = this.options.command || process.env.CLI_COMMAND || 'agy';
        let args = this.options.args ? this.options.args.split(' ').filter(Boolean) : [];

        let spawnCmd = command;
        let spawnArgs = args;

        console.log(`[PTY] Avvio processo: ${spawnCmd} ${spawnArgs.join(' ')} in ${workspaceDir}`);

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
            console.warn(`[PTY] Impossibile avviare direttamente '${spawnCmd}'. Fallback su shell (${defaultShell}):`, err.message);
            const shellArgs = this.isWindows ? ['-NoLogo', '-NoExit', '-Command', command] : ['-c', command || defaultShell];
            this.ptyProcess = pty.spawn(defaultShell, shellArgs, {
                name: 'xterm-256color',
                cols: this.options.cols || 80,
                rows: this.options.rows || 24,
                cwd: workspaceDir,
                env
            });
        }

        this.ptyProcess.onData((data) => {
            this.outputHistory += data;
            if (this.outputHistory.length > this.maxHistoryLength) {
                this.outputHistory = this.outputHistory.slice(-this.maxHistoryLength);
            }
            for (const listener of this.listeners) {
                listener(data);
            }
        });

        this.ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`[PTY] Processo terminato con codice: ${exitCode}, signal: ${signal}`);
            const exitMsg = `\r\n\x1b[33m[agycodeui] Processo terminato (codice: ${exitCode ?? signal}). Invia un comando o tocca 'Riavvia' per riaprire.\x1b[0m\r\n`;
            this.outputHistory += exitMsg;
            for (const listener of this.listeners) {
                listener(exitMsg);
            }
            this.ptyProcess = null;
        });

        return this;
    }

    write(data) {
        if (!this.ptyProcess) {
            this.start();
        }
        if (this.ptyProcess) {
            this.ptyProcess.write(data);
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

    restart() {
        if (this.ptyProcess) {
            try {
                this.ptyProcess.kill();
            } catch (e) {}
            this.ptyProcess = null;
        }
        this.outputHistory = '';
        return this.start();
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
            platform: os.platform()
        };
    }
}

module.exports = PtyManager;
