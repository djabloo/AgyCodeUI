const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { WebSocket } = require("ws");

const PLUGINS_DIR = path.join(__dirname, "../plugins");
const CONFIG_PATH = path.join(__dirname, "data/plugins.json");
const services = require("./pluginServices");

// Catalogo: i plugin presenti nella cartella sono "disponibili", l'utente
// installa solo quelli che gli servono. Preinstallato solo il terminale.
// Chi aveva gia' una configurazione (plugins.json) la mantiene com'e'.
const DEFAULT_INSTALLED = (process.env.AGY_DEFAULT_PLUGINS || "agyui-plugin-terminal")
    .split(",").map(s => s.trim()).filter(Boolean);

// Plugin distribuiti con AgyCloud: disinstallarli li spegne soltanto, i file restano
// (fanno parte dell'immagine/repo e servono per reinstallarli con un clic).
// Plugin consentiti dal piano AgyCloud (es. piano PII: solo PII). Vuoto = tutti.
// E' solo per mostrare il lucchetto nel catalogo: il blocco vero sta sul gateway.
const PLAN_PLUGINS = (process.env.AGY_PLAN_PLUGINS || "").split(",").map(s => s.trim()).filter(Boolean);
function lockedByPlan(name) {
    return PLAN_PLUGINS.length > 0 && !PLAN_PLUGINS.includes(name);
}

function isBundled(name) {
    return name.startsWith("agyui-plugin-");
}

class PluginManager {
    constructor() {
        this.runningPlugins = new Map(); // name -> { process, port, status, startTime }
        this.startingPlugins = new Map(); // name -> Promise<number>
        this.serviceStates = new Map(); // service -> { state, ... } (solo con agente plugin)
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(PLUGINS_DIR)) {
            fs.mkdirSync(PLUGINS_DIR, { recursive: true });
        }
        const dataDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(CONFIG_PATH)) {
            const initial = {};
            for (const name of DEFAULT_INSTALLED) initial[name] = { enabled: true };
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(initial, null, 2), "utf-8");
        }
    }

    getConfig() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
            }
        } catch (e) {
            console.error("[PluginManager] Errore lettura plugins.json:", e.message);
        }
        return {};
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
        } catch (e) {
            console.error("[PluginManager] Errore salvataggio plugins.json:", e.message);
        }
    }

    async init() {
        this.ensureDirectories();
        const plugins = this.scanPlugins();
        console.log(`[PluginManager] Trovati ${plugins.length} plugin nella cartella plugins/`);
        for (const p of plugins) {
            if (p.enabled && p.server) {
                this.startPluginServer(p.name, p.dir, p.server).catch(err => {
                    console.warn(`[PluginManager] Impossibile avviare il server per ${p.name}: ${err.message}`);
                });
            }
        }
    }

    scanPlugins() {
        this.ensureDirectories();
        const config = this.getConfig();
        const results = [];
        if (!fs.existsSync(PLUGINS_DIR)) return results;

        const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const dir = path.join(PLUGINS_DIR, entry.name);
            const manifestPath = path.join(dir, "manifest.json");
            if (!fs.existsSync(manifestPath)) continue;

            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                const name = manifest.name || entry.name;
                // Un plugin escluso dal piano risulta spento anche se era installato
                // (es. passaggio da Hobby al piano PII): niente schede che non funzionano.
                const enabled = !lockedByPlan(name) && (config[name] !== undefined ? !!config[name].enabled : DEFAULT_INSTALLED.includes(name));
                const service = typeof manifest.service === "string" ? manifest.service : null;

                // Cerca info repo git se presenti
                let repo = "";
                try {
                    const gitConfigPath = path.join(dir, ".git/config");
                    if (fs.existsSync(gitConfigPath)) {
                        const gitConfig = fs.readFileSync(gitConfigPath, "utf-8");
                        const m = gitConfig.match(/url\s*=\s*(.+)/);
                        if (m) {
                            repo = m[1].trim()
                                .replace(/^git@github\.com:/, "https://github.com/")
                                .replace(/\.git$/, "")
                                .replace(/^https?:\/\/github\.com\//, "");
                        }
                    }
                } catch (_) {}

                const running = this.runningPlugins.get(name);
                results.push({
                    id: name,
                    name,
                    displayName: manifest.displayName || name,
                    version: manifest.version || "1.0.0",
                    description: manifest.description || "",
                    author: manifest.author || "Community",
                    icon: manifest.icon || "icon.svg",
                    slot: manifest.slot || "tab",
                    type: manifest.type || "module",
                    entry: manifest.entry || "dist/index.js",
                    server: manifest.server || null,
                    repo: repo || (name === "agyui-plugin-terminal" || name === "web-terminal" ? "agyui/agyui-plugin-terminal" : (name === "agyui-plugin-starter" || name === "project-stats" ? "agyui/agyui-plugin-starter" : "")),
                    enabled,
                    installed: enabled,
                    bundled: isBundled(name),
                    locked: lockedByPlan(name),
                    service,
                    serviceState: service ? (this.serviceStates.get(service) || null) : null,
                    serviceManaged: !!service && services.enabled(),
                    status: running ? "running" : (enabled ? (manifest.server ? "stopped" : "ready") : "disabled"),
                    port: running ? running.port : null,
                    manifest,
                    dir
                });
            } catch (e) {
                console.error(`[PluginManager] Manifest non valido in ${entry.name}:`, e.message);
            }
        }
        return results;
    }

    getPlugin(name) {
        const list = this.scanPlugins();
        return list.find(p => p.name === name || p.id === name)
            || (name === "web-terminal" ? list.find(p => p.name === "agyui-plugin-terminal") : null)
            || (name === "project-stats" ? list.find(p => p.name === "agyui-plugin-starter") : null);
    }

    getPluginDir(name) {
        const p = this.getPlugin(name);
        return p ? p.dir : null;
    }

    getPluginPort(name) {
        const running = this.runningPlugins.get(name)
            || (name === "web-terminal" ? this.runningPlugins.get("agyui-plugin-terminal") : null)
            || (name === "agyui-plugin-terminal" ? this.runningPlugins.get("web-terminal") : null);
        return running ? running.port : null;
    }

    buildPluginEnv(name) {
        // Eredita tutto l'ambiente del processo agycodeui (CLI_COMMAND, WORKSPACE_DIR,
        // CLI_ARGS, ecc.): un plugin abilitato dall'utente gira gia' come lui con
        // pieno accesso al filesystem, quindi non e' un nuovo confine di fiducia.
        // Prima venivano passate solo 4 variabili: qualunque plugin che avesse
        // bisogno di sapere il comando CLI configurato (es. per invocare "agy" in
        // modo non interattivo) vedeva sempre il default 'agy', ignorando CLI_COMMAND.
        return { ...process.env, PLUGIN_NAME: name };
    }

    startPluginServer(name, pluginDir, serverEntry) {
        if (this.runningPlugins.has(name)) {
            return Promise.resolve(this.runningPlugins.get(name).port);
        }
        if (this.startingPlugins.has(name)) {
            return this.startingPlugins.get(name);
        }

        const startPromise = new Promise((resolve, reject) => {
            const serverPath = path.join(pluginDir, serverEntry);
            if (!fs.existsSync(serverPath)) {
                return reject(new Error(`File server non trovato: ${serverPath}`));
            }

            console.log(`[PluginManager] Avvio server per "${name}" (${serverPath})...`);
            const proc = spawn("node", [serverPath], {
                cwd: pluginDir,
                env: this.buildPluginEnv(name),
                stdio: ["ignore", "pipe", "pipe"]
            });

            let resolved = false;
            let stdout = "";

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.startingPlugins.delete(name);
                    proc.kill();
                    reject(new Error("Timeout: il server plugin non ha risposto entro 10s"));
                }
            }, 10000);

            proc.stdout.on("data", (chunk) => {
                if (resolved) return;
                stdout += chunk.toString();
                const lines = stdout.split("\n");
                for (const line of lines) {
                    try {
                        const msg = JSON.parse(line.trim());
                        if (msg.ready && typeof msg.port === "number") {
                            clearTimeout(timeout);
                            resolved = true;
                            this.startingPlugins.delete(name);
                            this.runningPlugins.set(name, {
                                process: proc,
                                port: msg.port,
                                status: "running",
                                startTime: Date.now()
                            });
                            proc.on("exit", () => {
                                console.log(`[PluginManager] Server plugin "${name}" terminato.`);
                                this.runningPlugins.delete(name);
                            });
                            console.log(`[PluginManager] Server "${name}" attivo sulla porta ${msg.port}`);
                            resolve(msg.port);
                            return;
                        }
                    } catch (_) {}
                }
            });

            proc.stderr.on("data", (chunk) => {
                console.warn(`[Plugin:${name}] ${chunk.toString().trim()}`);
            });

            proc.on("error", (err) => {
                clearTimeout(timeout);
                this.startingPlugins.delete(name);
                reject(err);
            });
        });

        this.startingPlugins.set(name, startPromise);
        return startPromise;
    }

    stopPluginServer(name) {
        const running = this.runningPlugins.get(name);
        if (running && running.process) {
            try {
                running.process.kill();
            } catch (e) {
                console.error(`[PluginManager] Errore arresto ${name}:`, e.message);
            }
            this.runningPlugins.delete(name);
        }
    }

    async restartPluginServer(name) {
        this.stopPluginServer(name);
        const p = this.getPlugin(name);
        if (p && p.server) {
            return this.startPluginServer(name, p.dir, p.server);
        }
        return null;
    }

    async setEnabled(name, enabled) {
        if (enabled && lockedByPlan(name)) {
            throw new Error("Plugin non incluso nel tuo piano: disponibile da Hobby in su.");
        }
        const config = this.getConfig();
        config[name] = { ...config[name], enabled: !!enabled };
        this.saveConfig(config);

        const p = this.getPlugin(name);
        if (!enabled) {
            this.stopPluginServer(name);
            // Servizio esterno (es. Rizzo-PII sulla VPS): disinstallare libera il disco
            if (p && p.service && services.enabled()) {
                try {
                    this.serviceStates.set(p.service, await services.uninstall(p.service));
                } catch (e) {
                    console.warn(`[PluginManager] Rimozione servizio ${p.service} non riuscita: ${e.message}`);
                }
            }
        } else {
            if (p && p.server) {
                await this.startPluginServer(name, p.dir, p.server);
            }
            // Il download del servizio puo' durare minuti: parte in background,
            // l'interfaccia segue lo stato con refreshServiceStates().
            if (p && p.service && services.enabled()) {
                try {
                    this.serviceStates.set(p.service, await services.install(p.service));
                } catch (e) {
                    this.serviceStates.set(p.service, { state: "error", error: e.message });
                }
            }
        }
        return { success: true, enabled: !!enabled };
    }

    /** Aggiorna lo stato dei servizi dei plugin installati (no-op senza agente plugin). */
    async refreshServiceStates() {
        if (!services.enabled()) return;
        const wanted = new Set(this.scanPlugins().filter(p => p.enabled && p.service).map(p => p.service));
        await Promise.all([...wanted].map(async (svc) => {
            try {
                this.serviceStates.set(svc, await services.status(svc));
            } catch (e) {
                this.serviceStates.set(svc, { state: "error", error: e.message });
            }
        }));
    }

    handleWsProxy(clientWs, pathname) {
        const pluginName = pathname.replace(/^\/plugin-ws\//, "").split("?")[0];
        if (!pluginName || /[^a-zA-Z0-9_-]/.test(pluginName)) {
            clientWs.close(4400, "Invalid plugin name");
            return;
        }

        const port = this.getPluginPort(pluginName);
        if (!port) {
            console.warn(`[PluginManager] WS proxy rifiutato: plugin "${pluginName}" non in esecuzione`);
            clientWs.close(4404, "Plugin not running");
            return;
        }

        const upstream = new WebSocket(`ws://127.0.0.1:${port}/ws`);

        upstream.on("open", () => {
            console.log(`[PluginManager] WS proxy connesso a "${pluginName}" (porta ${port})`);
        });

        upstream.on("message", (data, isBinary) => {
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(data, { binary: isBinary });
            }
        });

        clientWs.on("message", (data, isBinary) => {
            if (upstream.readyState === WebSocket.OPEN) {
                upstream.send(data, { binary: isBinary });
            }
        });

        upstream.on("close", () => {
            if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
        });

        clientWs.on("close", () => {
            if (upstream.readyState === WebSocket.OPEN) upstream.close();
        });

        upstream.on("error", (err) => {
            console.error(`[PluginManager] Errore proxy WS "${pluginName}":`, err.message);
            if (clientWs.readyState === WebSocket.OPEN) clientWs.close(4502, "Upstream error");
        });

        clientWs.on("error", () => {
            if (upstream.readyState === WebSocket.OPEN) upstream.close();
        });
    }

    shutdown() {
        for (const [name, rec] of this.runningPlugins.entries()) {
            console.log(`[PluginManager] Chiusura plugin "${name}"...`);
            try { rec.process.kill(); } catch (_) {}
        }
        this.runningPlugins.clear();
    }
}

module.exports = PluginManager;
