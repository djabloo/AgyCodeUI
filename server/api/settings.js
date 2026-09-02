const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function createSettingsRouter(sessionManager, ptyManager) {
    const router = express.Router();
    const envPath = path.join(__dirname, '..', '..', '.env');
    const cliCommand = process.env.CLI_COMMAND || 'agy';

    const envExecOptions = {
        encoding: 'utf8',
        timeout: 15000,
        env: {
            ...process.env,
            PATH: [
                path.join(os.homedir(), '.local', 'bin'),
                path.join(os.homedir(), '.gemini', 'antigravity-cli', 'bin'),
                process.env.PATH || ''
            ].filter(Boolean).join(path.delimiter)
        }
    };

    function runAgy(argv) {
        return new Promise((resolve) => {
            execFile(cliCommand, argv, envExecOptions, (error, stdout, stderr) => {
                if (error) {
                    return resolve({
                        success: false,
                        output: stderr || stdout || error.message,
                        error: error.message
                    });
                }
                resolve({ success: true, output: stdout });
            });
        });
    }

    function validateSkillName(name) {
        if (!name || typeof name !== 'string') return null;
        const trimmed = name.trim();
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            return null;
        }
        return trimmed;
    }

    function getSafeSkillDir(name) {
        const valid = validateSkillName(name);
        if (!valid) return null;
        const baseDir = path.resolve(os.homedir(), '.agents', 'skills');
        const targetDir = path.resolve(baseDir, valid);
        const rel = path.relative(baseDir, targetDir);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            return null;
        }
        return targetDir;
    }

    function validateMcpName(name) {
        if (!name || typeof name !== 'string') return null;
        const trimmed = name.trim();
        // Server MCP: ammessi caratteri alfanumerici, trattini, underscore e punti
        if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
            return null;
        }
        return trimmed;
    }

    function validatePluginName(name) {
        if (!name || typeof name !== 'string') return null;
        const trimmed = name.trim();
        // Plugin: nomi standard o scoped npm (es. @org/plugin, plugin-name)
        if (!/^(@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(trimmed)) {
            return null;
        }
        return trimmed;
    }

    function readEnvFile() {
        if (!fs.existsSync(envPath)) return {};
        const raw = fs.readFileSync(envPath, 'utf8');
        const env = {};
        raw.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const idx = trimmed.indexOf('=');
                const key = trimmed.slice(0, idx).trim();
                const val = trimmed.slice(idx + 1).trim();
                env[key] = val;
            }
        });
        return env;
    }

    function updateEnvFile(updates) {
        for (const [k, v] of Object.entries(updates)) {
            if (/[\r\n]/.test(k) || /[\r\n]/.test(String(v))) {
                throw new Error('I parametri di configurazione non possono contenere caratteri di nuova riga');
            }
        }

        let lines = [];
        if (fs.existsSync(envPath)) {
            lines = fs.readFileSync(envPath, 'utf8').split('\n');
        }
        const updatedKeys = new Set();
        const newLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const idx = trimmed.indexOf('=');
                const key = trimmed.slice(0, idx).trim();
                if (key in updates) {
                    updatedKeys.add(key);
                    return `${key}=${updates[key]}`;
                }
            }
            return line;
        });

        for (const [k, v] of Object.entries(updates)) {
            if (!updatedKeys.has(k)) {
                newLines.push(`${k}=${v}`);
            }
        }

        fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
        for (const [k, v] of Object.entries(updates)) {
            process.env[k] = v;
        }
    }

    // 1. Informazioni generali e lista modelli
    router.get('/info', async (req, res) => {
        try {
            const env = readEnvFile();
            const modelsResult = await runAgy(['models']);
            const models = [];
            if (modelsResult.success && modelsResult.output) {
                const lines = modelsResult.output.split('\n');
                for (const line of lines) {
                    const clean = line.replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1b\\))/g, '').replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '').trim();
                    if (clean) {
                        const parts = clean.includes('\t') ? clean.split('\t') : clean.split(/\s{2,}/);
                        if (parts.length >= 2) {
                            models.push({ id: parts[0].trim(), name: parts[1].trim() });
                        }
                    }
                }
            }

            res.json({
                port: env.PORT || process.env.PORT || '3080',
                host: env.HOST || process.env.HOST || '0.0.0.0',
                authPinSet: !!env.AUTH_PIN,
                authRequired: !!env.AUTH_PIN,
                workspaceDir: env.WORKSPACE_DIR || process.cwd(),
                cliCommand: env.CLI_COMMAND || 'agy',
                cliArgs: env.CLI_ARGS || '',
                models: models.length > 0 ? models : [
                    { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High)' },
                    { id: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash (Medium)' },
                    { id: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash (Low)' },
                    { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High)' },
                    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)' },
                    { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
                    { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' }
                ]
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 2. Server MCP
    router.get('/mcp', async (req, res) => {
        try {
            const result = await runAgy(['mcp', 'list']);
            const servers = [];
            if (result.success && result.output) {
                const lines = result.output.split('\n');
                let headerFound = false;
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line || line.includes('No MCP servers configured')) continue;
                    if (line.startsWith('NAME') && line.includes('STATUS')) {
                        headerFound = true;
                        continue;
                    }
                    if (headerFound) {
                        const parts = line.split(/\s+/);
                        if (parts.length >= 4) {
                            servers.push({
                                name: parts[0],
                                type: parts[1],
                                status: parts[2],
                                command: parts.slice(3).join(' ')
                            });
                        }
                    }
                }
            }
            res.json({ servers, raw: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/mcp', async (req, res) => {
        try {
            const { name, commandOrUrl, type, envs, headers, args } = req.body || {};
            if (!name || !commandOrUrl) {
                return res.status(400).json({ error: 'Nome e comando/URL sono obbligatori' });
            }

            const validName = validateMcpName(name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome server MCP non valido. Sono ammessi solo caratteri alfanumerici, punti, trattini o underscore (senza spazi o caratteri speciali).' });
            }

            const argv = ['mcp', 'add'];
            if (type && type !== 'stdio') {
                argv.push('--type', String(type).trim());
            }
            if (envs && Array.isArray(envs)) {
                envs.forEach(e => {
                    if (e && typeof e === 'string' && e.trim()) {
                        argv.push('--env', e.trim());
                    }
                });
            }
            if (headers && Array.isArray(headers)) {
                headers.forEach(h => {
                    if (h && typeof h === 'string' && h.trim()) {
                        argv.push('--header', h.trim());
                    }
                });
            }
            argv.push(validName, String(commandOrUrl).trim());
            if (args && typeof args === 'string' && args.trim()) {
                argv.push(...args.trim().split(/\s+/));
            }

            const result = await runAgy(argv);
            if (!result.success) {
                return res.status(400).json({ error: result.output });
            }
            res.json({ success: true, message: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/mcp/:name', async (req, res) => {
        try {
            const validName = validateMcpName(req.params.name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome server MCP non valido' });
            }
            const result = await runAgy(['mcp', 'remove', validName]);
            if (!result.success) {
                return res.status(400).json({ error: result.output });
            }
            res.json({ success: true, message: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/mcp/:name/toggle', async (req, res) => {
        try {
            const { enable } = req.body;
            const action = enable ? 'enable' : 'disable';
            const validName = validateMcpName(req.params.name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome server MCP non valido' });
            }
            const result = await runAgy(['mcp', action, validName]);
            if (!result.success) {
                return res.status(400).json({ error: result.output });
            }
            res.json({ success: true, message: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 3. Skills
    router.get('/skills', (req, res) => {
        try {
            const skills = [];
            const searchDirs = [
                path.join(os.homedir(), '.agents', 'skills'),
                path.join(process.env.WORKSPACE_DIR || process.cwd(), '.agents', 'skills')
            ];

            let lockData = {};
            const lockPath = path.join(os.homedir(), 'skills-lock.json');
            if (fs.existsSync(lockPath)) {
                try {
                    lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8')).skills || {};
                } catch (e) {}
            }

            const seenPaths = new Set();
            for (const baseDir of searchDirs) {
                if (fs.existsSync(baseDir)) {
                    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const validName = validateSkillName(entry.name);
                            if (!validName) continue;
                            const skillMdPath = path.resolve(baseDir, entry.name, 'SKILL.md');
                            if (seenPaths.has(skillMdPath)) continue;
                            if (fs.existsSync(skillMdPath)) {
                                seenPaths.add(skillMdPath);
                                const content = fs.readFileSync(skillMdPath, 'utf8');
                                let name = entry.name;
                                let description = '';
                                
                                const match = content.match(/^---\s*([\s\S]*?)\s*---/);
                                if (match) {
                                    const frontmatter = match[1];
                                    const nameMatch = frontmatter.match(/name:\s*([^\n]+)/);
                                    const descMatch = frontmatter.match(/description:\s*([^\n]+)/);
                                    if (nameMatch) name = nameMatch[1].trim();
                                    if (descMatch) description = descMatch[1].trim();
                                }

                                skills.push({
                                    name,
                                    folder: entry.name,
                                    description,
                                    path: skillMdPath,
                                    source: lockData[entry.name] ? lockData[entry.name].source : 'custom',
                                    isGlobal: baseDir.includes('.agents/skills')
                                });
                            }
                        }
                    }
                }
            }

            res.json({ skills });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/skills/:name/content', (req, res) => {
        try {
            const validName = validateSkillName(req.params.name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome skill non valido' });
            }
            const targetDir = getSafeSkillDir(validName);
            if (!targetDir) {
                return res.status(400).json({ error: 'Percorso skill non valido' });
            }
            const targetFile = path.join(targetDir, 'SKILL.md');
            if (fs.existsSync(targetFile)) {
                const content = fs.readFileSync(targetFile, 'utf8');
                return res.json({ name: validName, path: targetFile, content });
            }
            res.status(404).json({ error: 'Skill non trovata' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/skills', (req, res) => {
        try {
            const { name, description, content } = req.body || {};
            const validName = validateSkillName(name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome skill non valido. Usa solo caratteri alfanumerici, trattini o underscore (senza spazi o caratteri speciali).' });
            }
            const targetDir = getSafeSkillDir(validName);
            if (!targetDir) {
                return res.status(400).json({ error: 'Percorso skill non valido' });
            }
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            const skillFilePath = path.join(targetDir, 'SKILL.md');
            let fileContent = content;
            if (!fileContent) {
                fileContent = `---
name: ${validName}
description: ${description || 'Descrizione personalizzata per ' + validName}
---

# ${validName}

Istruzioni dettagliate per l'agente.
`;
            }
            fs.writeFileSync(skillFilePath, fileContent, 'utf8');
            res.json({ success: true, name: validName, path: skillFilePath });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/skills/:name', (req, res) => {
        try {
            const validName = validateSkillName(req.params.name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome skill non valido' });
            }
            const targetDir = getSafeSkillDir(validName);
            if (!targetDir) {
                return res.status(400).json({ error: 'Percorso skill non valido' });
            }
            if (fs.existsSync(targetDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
                return res.json({ success: true, message: 'Skill eliminata' });
            }
            res.status(404).json({ error: 'Skill non trovata' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 4. Plugins
    router.get('/plugins', async (req, res) => {
        try {
            const result = await runAgy(['plugin', 'list']);
            const plugins = [];
            if (result.success && result.output) {
                const lines = result.output.split('\n');
                for (const line of lines) {
                    const clean = line.trim();
                    if (!clean || clean.includes('No imported plugins')) continue;
                    plugins.push({ raw: clean, name: clean });
                }
            }
            res.json({ plugins, raw: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/plugins/install', async (req, res) => {
        try {
            const { target } = req.body || {};
            if (!target || typeof target !== 'string' || !target.trim()) {
                return res.status(400).json({ error: 'Nome o target plugin obbligatorio' });
            }
            const cleanTarget = target.trim();
            const result = await runAgy(['plugin', 'install', cleanTarget]);
            if (!result.success) {
                return res.status(400).json({ error: result.output });
            }
            res.json({ success: true, message: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/plugins/import', async (req, res) => {
        try {
            const source = (req.body && req.body.source && typeof req.body.source === 'string') ? req.body.source.trim() : 'gemini';
            const result = await runAgy(['plugin', 'import', source]);
            if (!result.success) {
                return res.status(400).json({ error: result.output });
            }
            res.json({ success: true, message: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/plugins/:name', async (req, res) => {
        try {
            const validName = validatePluginName(req.params.name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome plugin non valido' });
            }
            const result = await runAgy(['plugin', 'uninstall', validName]);
            if (!result.success) {
                return res.status(400).json({ error: result.output });
            }
            res.json({ success: true, message: result.output });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 5. Permessi e Configurazione Ambiente
    router.post('/permissions', (req, res) => {
        try {
            const { authPin, workspaceDir, dangerouslySkipPermissions, sandboxMode, model, effort } = req.body || {};
            const updates = {};
            if (typeof authPin === 'string' && authPin.trim()) {
                updates.AUTH_PIN = authPin.trim();
            }
            if (typeof workspaceDir === 'string' && workspaceDir.trim()) {
                const resolvedWorkspace = path.resolve(workspaceDir.trim());
                if (!fs.existsSync(resolvedWorkspace)) {
                    return res.status(400).json({ error: 'Cartella di lavoro non esistente' });
                }
                updates.WORKSPACE_DIR = resolvedWorkspace;
            }

            let args = [];
            if (dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
            if (sandboxMode) args.push('--sandbox');
            if (model && typeof model === 'string' && /^[a-zA-Z0-9_.-]+$/.test(model.trim())) {
                args.push(`--model ${model.trim()}`);
            }
            if (effort && ['low', 'medium', 'high'].includes(effort.trim())) {
                args.push(`--effort ${effort.trim()}`);
            }

            if (args.length > 0) {
                updates.CLI_ARGS = args.join(' ');
            } else if (req.body.updateArgs) {
                updates.CLI_ARGS = '';
            }

            updateEnvFile(updates);
            res.json({ success: true, message: 'Impostazioni aggiornate con successo' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
