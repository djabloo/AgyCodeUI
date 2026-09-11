const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

function createPluginsRouter(pluginManager, requireAuth) {
    const router = express.Router();
    const authMw = typeof requireAuth === "function" ? requireAuth : (req, res, next) => next();

    // 1. Servire asset statici del plugin (dist/index.js, icon.svg, ecc.) - PUBBLICO per dynamic import()
    router.get("/:name/assets/*", (req, res) => {
        const pluginName = req.params.name;
        const p = pluginManager.getPlugin(pluginName);
        if (!p) return res.status(404).send("Plugin non trovato");

        const subPath = req.params[0] || "";
        // Prevenzione Path Traversal
        if (subPath.includes("..") || path.isAbsolute(subPath)) {
            return res.status(400).send("Percorso non valido");
        }

        const filePath = path.join(p.dir, subPath);
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return res.status(404).send("Asset non trovato");
        }

        // Determina content type
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        } else if (filePath.endsWith(".svg")) {
            res.setHeader("Content-Type", "image/svg+xml");
        } else if (filePath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
        } else if (filePath.endsWith(".json")) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
        } else if (filePath.endsWith(".png")) {
            res.setHeader("Content-Type", "image/png");
        } else if (filePath.endsWith(".map")) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
        }

        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        fs.createReadStream(filePath).pipe(res);
    });

    // 2. Elenco di tutti i plugin con stato di esecuzione
    router.get("/", authMw, (req, res) => {
        try {
            const plugins = pluginManager.scanPlugins();
            res.json({ success: true, plugins });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 3. Ottieni manifest singolo plugin
    router.get("/:name/manifest", authMw, (req, res) => {
        const p = pluginManager.getPlugin(req.params.name);
        if (!p) return res.status(404).json({ error: "Plugin non trovato" });
        res.json(p.manifest || p);
    });

    // RPC endpoint proxy: inoltra le chiamate API del plugin al suo backend
    router.all("/:name/rpc/*", authMw, (req, res) => {
        const pluginName = req.params.name;
        const port = pluginManager.getPluginPort(pluginName);
        if (!port) {
            return res.status(503).json({ error: `Plugin server per "${pluginName}" non è attivo` });
        }

        const subPath = "/" + (req.params[0] || "");
        const queryIndex = req.url.indexOf("?");
        const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : "";
        const targetPath = subPath + queryString;

        const proxyReq = http.request({
            hostname: "127.0.0.1",
            port: port,
            path: targetPath,
            method: req.method,
            headers: {
                ...req.headers,
                host: `127.0.0.1:${port}`
            }
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on("error", (err) => {
            console.error(`[Plugin:${pluginName}] Errore RPC proxy:`, err.message);
            if (!res.headersSent) {
                res.status(502).json({ error: "Errore di comunicazione con il server plugin" });
            }
        });

        if (req.method !== "GET" && req.method !== "HEAD") {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }
    });

    // Abilita / disabilita plugin
    router.put("/:name/enable", authMw, async (req, res) => {
        try {
            const { enabled } = req.body;
            const result = await pluginManager.setEnabled(req.params.name, enabled);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Riavvia server del plugin
    router.post("/:name/restart", authMw, async (req, res) => {
        try {
            const port = await pluginManager.restartPluginServer(req.params.name);
            res.json({ success: true, port });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Installa nuovo plugin da URL Git
    router.post("/install", authMw, async (req, res) => {
        const { url } = req.body;
        if (!url || typeof url !== "string") {
            return res.status(400).json({ error: "URL repository Git obbligatorio" });
        }

        const cleanUrl = url.trim();
        // Estrai nome cartella
        const match = cleanUrl.match(/\/([^\/]+?)(\.git)?$/);
        if (!match) {
            return res.status(400).json({ error: "URL Git non valido" });
        }
        const targetDirName = match[1];
        const targetPath = path.join(__dirname, "../../plugins", targetDirName);

        if (fs.existsSync(targetPath)) {
            return res.status(400).json({ error: "Un plugin con questa cartella esiste gia" });
        }

        console.log(`[PluginManager] Clonazione plugin da ${cleanUrl} in ${targetPath}...`);
        const gitClone = spawn("git", ["clone", "--depth", "1", cleanUrl, targetPath], {
            stdio: ["ignore", "pipe", "pipe"]
        });

        gitClone.on("close", (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: "Errore durante il git clone del repository" });
            }

            // Esegui npm install && npm run build se necessario
            console.log(`[PluginManager] Installazione dipendenze per ${targetDirName}...`);
            const npmInstall = spawn("npm", ["install"], { cwd: targetPath, stdio: ["ignore", "pipe", "pipe"] });
            npmInstall.on("close", () => {
                const pkgPath = path.join(targetPath, "package.json");
                if (fs.existsSync(pkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                        if (pkg.scripts && pkg.scripts.build) {
                            console.log(`[PluginManager] Esecuzione npm run build per ${targetDirName}...`);
                            const npmBuild = spawn("npm", ["run", "build"], { cwd: targetPath });
                            npmBuild.on("close", () => {
                                const plugins = pluginManager.scanPlugins();
                                res.json({ success: true, message: "Plugin installato e compilato con successo", plugins });
                            });
                            return;
                        }
                    } catch (_) {}
                }
                const plugins = pluginManager.scanPlugins();
                res.json({ success: true, message: "Plugin installato con successo", plugins });
            });
        });
    });

    // Disinstalla plugin
    router.delete("/:name", authMw, async (req, res) => {
        const name = req.params.name;
        const p = pluginManager.getPlugin(name);
        if (!p) return res.status(404).json({ error: "Plugin non trovato" });

        try {
            pluginManager.stopPluginServer(name);
            if (fs.existsSync(p.dir)) {
                fs.rmSync(p.dir, { recursive: true, force: true });
            }
            const config = pluginManager.getConfig();
            delete config[name];
            pluginManager.saveConfig(config);
            res.json({ success: true, message: `Plugin ${name} rimosso` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

module.exports = createPluginsRouter;
