const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const execFileAsync = util.promisify(execFile);

module.exports = function createSettingsRouter(sessionManager, ptyManager) {
    const router = express.Router();
    const envPath = path.join(__dirname, '..', '..', '.env');
    const dataDir = path.resolve(__dirname, '../data');
    const sharedSetupFile = path.join(dataDir, 'shared-setup.json');
    const onboardingFile = path.join(dataDir, 'onboarding.json');
    const cliCommand = process.env.CLI_COMMAND || 'agy';

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

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
        if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
            return null;
        }
        return trimmed;
    }

    function validatePluginName(name) {
        if (!name || typeof name !== 'string') return null;
        const trimmed = name.trim();
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

    // 2. Git Configuration Endpoints
    router.get('/git', async (req, res) => {
        try {
            let name = '';
            let email = '';
            try {
                const { stdout: nOut } = await execFileAsync('git', ['config', '--global', 'user.name']);
                name = nOut.trim();
            } catch (e) {}
            try {
                const { stdout: eOut } = await execFileAsync('git', ['config', '--global', 'user.email']);
                email = eOut.trim();
            } catch (e) {}

            res.json({
                success: true,
                name: name || 'Proseo',
                email: email || 'djabloo@gmail.com',
                isConfigured: !!(name && email)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/git', async (req, res) => {
        try {
            const { name, email } = req.body || {};
            if (!name || !email) {
                return res.status(400).json({ error: 'Nome ed email Git sono obbligatori' });
            }

            const cleanName = String(name).trim().replace(/[\r\n]/g, '');
            const cleanEmail = String(email).trim().replace(/[\r\n]/g, '');

            await execFileAsync('git', ['config', '--global', 'user.name', cleanName]);
            await execFileAsync('git', ['config', '--global', 'user.email', cleanEmail]);

            res.json({
                success: true,
                message: 'Configurazione Git globale salvata con successo',
                name: cleanName,
                email: cleanEmail
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 3. AI Agents Connect / Login Endpoints
    router.get('/agents', async (req, res) => {
        try {
            // AGY UI gira solo su Google Antigravity (agy): nessun altro agente/CLI
            // e' installato o supportato, quindi non se ne elencano altri qui.
            const agents = [
                {
                    id: 'antigravity',
                    name: 'Google Antigravity (agy)',
                    provider: 'gemini',
                    icon: 'planet',
                    badge: 'Ready · v1.1.22',
                    status: 'connected',
                    statusText: 'Configurato ed attivo',
                    color: 'cyan'
                }
            ];

            res.json({ success: true, agents });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agents/login', async (req, res) => {
        try {
            const { agentId, apiKey, token } = req.body || {};
            if (!agentId) return res.status(400).json({ error: 'agentId obbligatorio' });

            const homeDir = os.homedir();
            if (agentId === 'claude-code' && (token || apiKey)) {
                const claudePath = path.join(homeDir, '.claude.json');
                const config = { token: token || apiKey, updatedAt: new Date().toISOString() };
                fs.writeFileSync(claudePath, JSON.stringify(config, null, 2), 'utf8');
            } else if (agentId === 'openai-codex' && apiKey) {
                updateEnvFile({ OPENAI_API_KEY: apiKey.trim() });
            }

            res.json({ success: true, message: `Agente ${agentId} configurato con successo` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 4. Onboarding Status Endpoints
    router.get('/onboarding', (req, res) => {
        try {
            let state = { completed: false };
            if (fs.existsSync(onboardingFile)) {
                state = JSON.parse(fs.readFileSync(onboardingFile, 'utf8'));
            }
            res.json({ success: true, ...state });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/onboarding/complete', (req, res) => {
        try {
            const state = { completed: true, completedAt: new Date().toISOString() };
            fs.writeFileSync(onboardingFile, JSON.stringify(state, null, 2), 'utf8');
            res.json({ success: true, message: 'Onboarding completato con successo' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 5. Shared Setup (Template Layer) Endpoints
    router.get('/shared-setup', (req, res) => {
        try {
            let config = {
                skills: [
                    { name: 'frontend-design', description: 'Creazione interfacce e stili UI con standard moderni' },
                    { name: 'find-skills', description: 'Scoperta ed installazione rapida di nuove skill per agenti' },
                    { name: 'agy-customizations', description: 'Guida ufficiale ad estensioni, MCP e hook di Antigravity' }
                ],
                mcpServers: [
                    { name: 'filesystem', type: 'stdio', status: 'active', command: 'npx -y @modelcontextprotocol/server-filesystem /home/tino/workspace' },
                    { name: 'fetch', type: 'stdio', status: 'active', command: 'npx -y @modelcontextprotocol/server-fetch' }
                ],
                updatedAt: new Date().toISOString()
            };

            if (fs.existsSync(sharedSetupFile)) {
                try {
                    config = JSON.parse(fs.readFileSync(sharedSetupFile, 'utf8'));
                } catch (e) {}
            }

            res.json({ success: true, sharedSetup: config });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/shared-setup', (req, res) => {
        try {
            const { skills, mcpServers } = req.body || {};
            const config = {
                skills: skills || [],
                mcpServers: mcpServers || [],
                updatedAt: new Date().toISOString()
            };
            fs.writeFileSync(sharedSetupFile, JSON.stringify(config, null, 2), 'utf8');
            res.json({ success: true, message: 'Shared Setup (Template Layer) salvato con successo', sharedSetup: config });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 6. Server MCP
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
                return res.status(400).json({ error: 'Nome server MCP non valido. Sono ammessi solo caratteri alfanumerici, punti, trattini o underscore.' });
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

    // 7. Skills
    router.get('/skills', (req, res) => {
        try {
            const skillsBase = path.resolve(os.homedir(), '.agents', 'skills');
            const skills = [];
            if (fs.existsSync(skillsBase)) {
                const entries = fs.readdirSync(skillsBase, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const skillName = entry.name;
                        const skillFile = path.join(skillsBase, skillName, 'SKILL.md');
                        let description = '';
                        let hasDoc = false;
                        if (fs.existsSync(skillFile)) {
                            hasDoc = true;
                            const content = fs.readFileSync(skillFile, 'utf8');
                            const match = content.match(/description:\s*(.+)/i) || content.match(/^#+\s*(.+)$/m);
                            if (match && match[1]) {
                                description = match[1].replace(/['"]/g, '').trim();
                            }
                        }
                        skills.push({ name: skillName, description, hasDoc, path: path.join(skillsBase, skillName) });
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
            const skillFile = path.join(targetDir, 'SKILL.md');
            if (!fs.existsSync(skillFile)) {
                return res.status(404).json({ error: 'SKILL.md non trovato' });
            }
            const content = fs.readFileSync(skillFile, 'utf8');
            res.json({ name: validName, content });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/skills', (req, res) => {
        try {
            const { name, content, description } = req.body || {};
            const validName = validateSkillName(name);
            if (!validName) {
                return res.status(400).json({ error: 'Nome skill non valido. Usa solo caratteri alfanumerici, trattini o underscore.' });
            }
            const targetDir = getSafeSkillDir(validName);
            if (!targetDir) {
                return res.status(400).json({ error: 'Percorso skill non valido' });
            }
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            const skillFilePath = path.join(targetDir, 'SKILL.md');
            let initialContent = content;
            if (!initialContent) {
                initialContent = `---\nname: ${validName}\ndescription: ${description || 'Skill personalizzata'}\n---\n\n# ${validName}\n\nIstruzioni per l'agente:\n`;
            }
            fs.writeFileSync(skillFilePath, initialContent, 'utf8');
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

    // 8. Plugins
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

    // 9. Permessi e Configurazione Ambiente
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

    // 10. Antigravity CLI (agy) Authentication & Status
    const geminiDir = path.join(os.homedir(), '.gemini', 'antigravity-cli');
    const oauthTokenFile = path.join(geminiDir, 'antigravity-oauth-token');
    const settingsJsonFile = path.join(geminiDir, 'settings.json');

    router.get('/agy-auth/status', async (req, res) => {
        try {
            const hasTokenFile = fs.existsSync(oauthTokenFile);
            let authMethod = 'none';
            let tokenPreview = '';
            let tokenValid = false;

            if (hasTokenFile) {
                try {
                    const raw = fs.readFileSync(oauthTokenFile, 'utf8');
                    const parsed = JSON.parse(raw);
                    authMethod = parsed.auth_method || 'oauth';
                    if (parsed.token) {
                        tokenValid = true;
                        tokenPreview = typeof parsed.token === 'string' 
                            ? parsed.token.substring(0, 8) + '...' + parsed.token.slice(-4)
                            : 'Presente (Token attivo)';
                    }
                } catch (e) {
                    tokenValid = false;
                }
            }

            // Test if agy models executes without error
            const testRun = await runAgy(['models']);
            const cliConnected = testRun.success && !testRun.output.includes('authentication required') && !testRun.output.includes('login required');

            res.json({
                success: true,
                hasTokenFile,
                tokenValid,
                authMethod,
                tokenPreview,
                cliConnected,
                status: cliConnected ? 'connected' : (hasTokenFile ? 'token_present_unverified' : 'unauthenticated'),
                message: cliConnected ? 'Antigravity CLI autenticata ed attiva' : 'Autenticazione richiesta per Antigravity CLI'
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agy-auth/token', async (req, res) => {
        try {
            const { token, authMethod } = req.body || {};
            if (!token || typeof token !== 'string') {
                return res.status(400).json({ error: 'Token Antigravity non valido o vuoto' });
            }

            if (!fs.existsSync(geminiDir)) {
                fs.mkdirSync(geminiDir, { recursive: true });
            }

            const tokenPayload = {
                auth_method: authMethod || 'consumer',
                token: token.trim()
            };

            fs.writeFileSync(oauthTokenFile, JSON.stringify(tokenPayload, null, 2), { mode: 0o600 });

            // Test agy models
            const testRun = await runAgy(['models']);
            const isOk = testRun.success;

            res.json({
                success: true,
                message: isOk ? 'Token salvato e verificato con successo!' : 'Token salvato. Connessione CLI pronta.',
                cliConnected: isOk
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agy-auth/start-login', async (req, res) => {
        try {
            if (ptyManager) {
                ptyManager.write('agy\r');
            }
            res.json({
                success: true,
                message: 'Comando di avvio e login AGY inviato al terminale'
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agy-auth/logout', async (req, res) => {
        try {
            if (fs.existsSync(oauthTokenFile)) {
                const backupFile = oauthTokenFile + '.bak';
                fs.renameSync(oauthTokenFile, backupFile);
            }
            res.json({
                success: true,
                message: 'Sessione Antigravity CLI disconnessa'
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 11. Antigravity Permissions & Commands Whitelist
    router.get('/agy-permissions', (req, res) => {
        try {
            let agySettings = {
                allowNonWorkspaceAccess: false,
                permissions: { allow: [] },
                trustedWorkspaces: []
            };

            if (fs.existsSync(settingsJsonFile)) {
                try {
                    agySettings = JSON.parse(fs.readFileSync(settingsJsonFile, 'utf8'));
                } catch (e) {}
            }

            const env = readEnvFile();
            const cliArgs = env.CLI_ARGS || process.env.CLI_ARGS || '';

            const rawAllow = (agySettings.permissions && Array.isArray(agySettings.permissions.allow))
                ? agySettings.permissions.allow
                : [];

            // Extract command names from format "command(ls)"
            const allowedCommands = rawAllow.map(rule => {
                const match = rule.match(/command\(([^)]+)\)/);
                return match ? match[1] : rule;
            });

            res.json({
                success: true,
                allowNonWorkspaceAccess: !!agySettings.allowNonWorkspaceAccess,
                trustedWorkspaces: agySettings.trustedWorkspaces || [],
                allowedCommands,
                dangerouslySkipPermissions: cliArgs.includes('--dangerously-skip-permissions'),
                sandboxMode: cliArgs.includes('--sandbox'),
                currentModel: agySettings.model || 'Gemini 3.8 Flash (Medium)'
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agy-permissions', (req, res) => {
        try {
            const { allowNonWorkspaceAccess, allowedCommands, dangerouslySkipPermissions, sandboxMode } = req.body || {};

            let agySettings = {};
            if (fs.existsSync(settingsJsonFile)) {
                try {
                    agySettings = JSON.parse(fs.readFileSync(settingsJsonFile, 'utf8'));
                } catch (e) {}
            }

            if (typeof allowNonWorkspaceAccess === 'boolean') {
                agySettings.allowNonWorkspaceAccess = allowNonWorkspaceAccess;
            }

            if (Array.isArray(allowedCommands)) {
                if (!agySettings.permissions) agySettings.permissions = {};
                agySettings.permissions.allow = allowedCommands.map(cmd => {
                    const clean = String(cmd).trim();
                    return clean.startsWith('command(') ? clean : `command(${clean})`;
                });
            }

            if (!fs.existsSync(geminiDir)) {
                fs.mkdirSync(geminiDir, { recursive: true });
            }
            fs.writeFileSync(settingsJsonFile, JSON.stringify(agySettings, null, 2), { mode: 0o600 });

            // Also update CLI_ARGS in .env
            const env = readEnvFile();
            let args = (env.CLI_ARGS || '').split(/\s+/).filter(a => a && a !== '--dangerously-skip-permissions' && a !== '--sandbox');
            if (dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
            if (sandboxMode) args.push('--sandbox');

            updateEnvFile({ CLI_ARGS: args.join(' ') });

            res.json({
                success: true,
                message: 'Permessi Antigravity salvati con successo',
                settings: agySettings
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agy-permissions/whitelist/add', (req, res) => {
        try {
            const { command } = req.body || {};
            if (!command || typeof command !== 'string' || !command.trim()) {
                return res.status(400).json({ error: 'Comando non specificato' });
            }

            let agySettings = { permissions: { allow: [] } };
            if (fs.existsSync(settingsJsonFile)) {
                try {
                    agySettings = JSON.parse(fs.readFileSync(settingsJsonFile, 'utf8'));
                } catch (e) {}
            }

            if (!agySettings.permissions) agySettings.permissions = {};
            if (!Array.isArray(agySettings.permissions.allow)) agySettings.permissions.allow = [];

            const formatted = `command(${command.trim()})`;
            if (!agySettings.permissions.allow.includes(formatted)) {
                agySettings.permissions.allow.push(formatted);
                if (!fs.existsSync(geminiDir)) fs.mkdirSync(geminiDir, { recursive: true });
                fs.writeFileSync(settingsJsonFile, JSON.stringify(agySettings, null, 2), { mode: 0o600 });
            }

            res.json({ success: true, message: `Comando "${command}" aggiunto alla whitelist` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/agy-permissions/whitelist/remove', (req, res) => {
        try {
            const { command } = req.body || {};
            if (!command || typeof command !== 'string') {
                return res.status(400).json({ error: 'Comando non specificato' });
            }

            let agySettings = { permissions: { allow: [] } };
            if (fs.existsSync(settingsJsonFile)) {
                try {
                    agySettings = JSON.parse(fs.readFileSync(settingsJsonFile, 'utf8'));
                } catch (e) {}
            }

            if (agySettings.permissions && Array.isArray(agySettings.permissions.allow)) {
                const formatted = `command(${command.trim()})`;
                agySettings.permissions.allow = agySettings.permissions.allow.filter(c => c !== formatted && c !== command.trim());
                fs.writeFileSync(settingsJsonFile, JSON.stringify(agySettings, null, 2), { mode: 0o600 });
            }

            res.json({ success: true, message: `Comando rimosso dalla whitelist` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
