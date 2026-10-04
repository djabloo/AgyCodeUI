const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const auth = require('../auth');

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

    function removeEnvKey(keyToRemove) {
        if (!keyToRemove || typeof keyToRemove !== 'string') return;
        if (!fs.existsSync(envPath)) return;
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        const newLines = lines.filter(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const idx = trimmed.indexOf('=');
                const key = trimmed.slice(0, idx).trim();
                if (key === keyToRemove) {
                    return false;
                }
            }
            return true;
        });
        fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
        delete process.env[keyToRemove];
    }

    function maskKey(key) {
        if (!key || typeof key !== 'string') return '';
        const trimmed = key.trim();
        if (trimmed.length <= 8) return '••••••••';
        return `${trimmed.substring(0, 4)}••••${trimmed.substring(trimmed.length - 4)}`;
    }

    const STANDARD_PROVIDERS = [
        { id: 'gemini', name: 'Google Gemini / AI Studio', envVar: 'GEMINI_API_KEY', placeholder: 'AIzaSy...' },
        { id: 'anthropic', name: 'Anthropic Claude', envVar: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-api03-...' },
        { id: 'openai', name: 'OpenAI (GPT-4o, o1, o3)', envVar: 'OPENAI_API_KEY', placeholder: 'sk-proj-...' },
        { id: 'openrouter', name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', placeholder: 'sk-or-v1-...' },
        { id: 'groq', name: 'Groq Cloud', envVar: 'GROQ_API_KEY', placeholder: 'gsk_...' },
        { id: 'deepseek', name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', placeholder: 'sk-...' },
        { id: 'elevenlabs', name: 'ElevenLabs (Voice & Audio)', envVar: 'ELEVENLABS_API_KEY', placeholder: 'sk_...' },
        { id: 'mistral', name: 'Mistral AI', envVar: 'MISTRAL_API_KEY', placeholder: '...' },
        { id: 'xai', name: 'xAI (Grok)', envVar: 'XAI_API_KEY', placeholder: 'xai-...' },
        { id: 'perplexity', name: 'Perplexity AI', envVar: 'PERPLEXITY_API_KEY', placeholder: 'pplx-...' },
        { id: 'together', name: 'Together AI', envVar: 'TOGETHER_API_KEY', placeholder: '...' },
        { id: 'cohere', name: 'Cohere', envVar: 'COHERE_API_KEY', placeholder: '...' },
        { id: 'cerebras', name: 'Cerebras', envVar: 'CEREBRAS_API_KEY', placeholder: 'csk-...' },
        { id: 'replicate', name: 'Replicate', envVar: 'REPLICATE_API_TOKEN', placeholder: 'r8_...' },
        { id: 'huggingface', name: 'Hugging Face', envVar: 'HF_TOKEN', placeholder: 'hf_...' },
        { id: 'fal', name: 'fal.ai', envVar: 'FAL_KEY', placeholder: '...' },
        { id: 'fireworks', name: 'Fireworks AI', envVar: 'FIREWORKS_API_KEY', placeholder: 'fw_...' },
        { id: 'sambanova', name: 'SambaNova', envVar: 'SAMBANOVA_API_KEY', placeholder: '...' },
        { id: 'voyage', name: 'Voyage AI', envVar: 'VOYAGE_API_KEY', placeholder: 'pa-...' },
        { id: 'tavily', name: 'Tavily Search', envVar: 'TAVILY_API_KEY', placeholder: 'tvly-...' },
        { id: 'serpapi', name: 'SerpAPI', envVar: 'SERPAPI_API_KEY', placeholder: '...' },
        { id: 'custom', name: 'Altro / Personalizzato (Custom)', envVar: '', placeholder: 'Incolla la chiave API segreta' }
    ];

    // Nomi ammessi per le chiavi personalizzate: devono sembrare una chiave e non
    // toccare la configurazione del server (AUTH_PIN, HOST, WORKSPACE_DIR, ...).
    const RESERVED_ENV = new Set(['SETUP_TOKEN', 'GOOGLE_PICKER_API_KEY', 'MAIL_WEBHOOK_SECRET', 'JWT_SECRET', 'SESSION_SECRET']);
    function isAllowedKeyName(name) {
        return /^[A-Z][A-Z0-9_]{1,63}$/.test(name)
            && /_(KEY|TOKEN|SECRET)$/.test(name)
            && !/^(AGY_|AGYUI_|AUTH_|NODE_|LD_|PLUGIN_|NPM_|GIT_)/.test(name)
            && !RESERVED_ENV.has(name);
    }

    const byokMetaFile = path.join(dataDir, 'byok-meta.json');
    function readByokMeta() {
        if (!fs.existsSync(byokMetaFile)) return {};
        try {
            return JSON.parse(fs.readFileSync(byokMetaFile, 'utf8'));
        } catch (_) {
            return {};
        }
    }
    function saveByokMeta(meta) {
        fs.writeFileSync(byokMetaFile, JSON.stringify(meta, null, 2), 'utf8');
    }

    // BYOK: Gestione chiavi API personali
    router.get('/keys', (req, res) => {
        try {
            const env = readEnvFile();
            const meta = readByokMeta();
            const keys = [];
            const seenEnvVars = new Set();

            for (const [envVar, info] of Object.entries(meta)) {
                const val = env[envVar] || process.env[envVar];
                if (val) {
                    seenEnvVars.add(envVar);
                    keys.push({
                        envVar,
                        provider: info.provider || 'custom',
                        name: info.name || envVar,
                        keyHint: maskKey(val),
                        updatedAt: info.updatedAt || null,
                        isCustom: info.provider === 'custom' || !STANDARD_PROVIDERS.some(p => p.id === info.provider && p.id !== 'custom')
                    });
                }
            }

            for (const sp of STANDARD_PROVIDERS) {
                if (sp.id === 'custom' || !sp.envVar) continue;
                if (!seenEnvVars.has(sp.envVar)) {
                    const val = env[sp.envVar] || process.env[sp.envVar];
                    if (val) {
                        seenEnvVars.add(sp.envVar);
                        keys.push({
                            envVar: sp.envVar,
                            provider: sp.id,
                            name: sp.name,
                            keyHint: maskKey(val),
                            updatedAt: null,
                            isCustom: false
                        });
                    }
                }
            }

            res.json({
                keys,
                providers: STANDARD_PROVIDERS
            });
        } catch (e) {
            console.error('[Settings] Errore GET /keys:', e);
            res.status(500).json({ error: 'Impossibile recuperare le chiavi' });
        }
    });

    router.post('/keys', (req, res) => {
        try {
            let { provider, customEnvVar, customName, apiKey } = req.body || {};
            if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
                return res.status(400).json({ error: 'Chiave API obbligatoria' });
            }
            apiKey = apiKey.trim();

            let targetEnvVar = '';
            let targetName = '';
            let isCustom = false;

            if (provider === 'custom' || !provider) {
                if (!customEnvVar || typeof customEnvVar !== 'string') {
                    return res.status(400).json({ error: 'Nome variabile d\'ambiente obbligatorio per provider personalizzato' });
                }
                targetEnvVar = customEnvVar.trim().toUpperCase();
                if (!isAllowedKeyName(targetEnvVar)) {
                    return res.status(400).json({ error: 'Nome non valido: usa lettere maiuscole, numeri e underscore e termina con _KEY, _TOKEN o _SECRET (es. CUSTOM_API_KEY). Le variabili di configurazione del server non sono ammesse.' });
                }
                targetName = (customName && typeof customName === 'string' && customName.trim()) ? customName.trim() : targetEnvVar;
                provider = 'custom';
                isCustom = true;
            } else {
                const sp = STANDARD_PROVIDERS.find(p => p.id === provider.toLowerCase());
                if (!sp || sp.id === 'custom') {
                    return res.status(400).json({ error: 'Provider non riconosciuto' });
                }
                targetEnvVar = sp.envVar;
                targetName = sp.name;
            }

            // Salva nel file .env e aggiorna process.env
            updateEnvFile({ [targetEnvVar]: apiKey });

            // Salva metadati
            const meta = readByokMeta();
            meta[targetEnvVar] = {
                provider,
                name: targetName,
                updatedAt: new Date().toISOString()
            };
            saveByokMeta(meta);

            res.json({
                success: true,
                key: {
                    envVar: targetEnvVar,
                    provider,
                    name: targetName,
                    keyHint: maskKey(apiKey),
                    isCustom
                }
            });
        } catch (e) {
            console.error('[Settings] Errore POST /keys:', e);
            res.status(500).json({ error: e.message || 'Errore nel salvataggio della chiave' });
        }
    });

    router.delete('/keys/:envVar', (req, res) => {
        try {
            const { envVar } = req.params;
            if (!envVar || !/^[A-Z0-9_]+$/i.test(envVar)) {
                return res.status(400).json({ error: 'Nome variabile non valido' });
            }
            const normalized = envVar.trim().toUpperCase();

            // Si cancellano solo chiavi: quelle registrate qui o dei provider noti,
            // mai altre voci del .env (es. AUTH_PIN)
            const meta = readByokMeta();
            const known = !!meta[normalized] || STANDARD_PROVIDERS.some(p => p.envVar === normalized);
            if (!known) {
                return res.status(404).json({ error: 'Chiave non trovata' });
            }
            removeEnvKey(normalized);

            if (meta[normalized]) {
                delete meta[normalized];
                saveByokMeta(meta);
            }

            res.json({ success: true, removed: normalized });
        } catch (e) {
            console.error('[Settings] Errore DELETE /keys:', e);
            res.status(500).json({ error: e.message || 'Errore nella rimozione della chiave' });
        }
    });

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
                authRequired: auth.enabled,
                authMode: auth.mode,
                workspaceDir: env.WORKSPACE_DIR || process.cwd(),
                cliCommand: env.CLI_COMMAND || 'agy',
                cliArgs: env.CLI_ARGS || '',
                googleClientId: env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
                googlePickerApiKey: env.GOOGLE_PICKER_API_KEY || process.env.GOOGLE_PICKER_API_KEY || '',
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
                name: name || '',
                email: email || '',
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
                    { name: 'filesystem', type: 'stdio', status: 'active', command: `npx -y @modelcontextprotocol/server-filesystem ${require('os').homedir()}/workspace` },
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

            // Estrazione e isolamento automatico di eventuali variabili o credenziali (-e, --env)
            // passate per errore nel comando o negli argomenti, per evitare che finiscano in chiaro nei log o nella UI.
            let cleanCmd = String(commandOrUrl).trim();
            let cleanArgs = typeof args === 'string' ? args.trim() : '';
            const allEnvs = [];

            if (envs && Array.isArray(envs)) {
                envs.forEach(e => {
                    if (e && typeof e === 'string' && e.trim()) allEnvs.push(e.trim());
                });
            }

            const envFlagRegex = /(?:^|\s+)(?:-e|--env)(?:\s+|=)(["'][^"']+["']|[^\s]+)/g;

            cleanCmd = cleanCmd.replace(envFlagRegex, (match, val) => {
                const cleaned = val.replace(/^["']|["']$/g, '');
                if (cleaned && !allEnvs.includes(cleaned)) allEnvs.push(cleaned);
                return '';
            }).replace(/\s+/g, ' ').trim();

            cleanArgs = cleanArgs.replace(envFlagRegex, (match, val) => {
                const cleaned = val.replace(/^["']|["']$/g, '');
                if (cleaned && !allEnvs.includes(cleaned)) allEnvs.push(cleaned);
                return '';
            }).replace(/\s+/g, ' ').trim();

            const argv = ['mcp', 'add'];
            if (type && type !== 'stdio') {
                argv.push('--type', String(type).trim());
            }

            // I flag --env devono sempre precedere il nome del server in agy
            allEnvs.forEach(e => {
                argv.push('--env', e);
            });

            if (headers && Array.isArray(headers)) {
                headers.forEach(h => {
                    if (h && typeof h === 'string' && h.trim()) {
                        argv.push('--header', h.trim());
                    }
                });
            }

            // Separa il comando eseguibile dal resto se inseriti insieme
            const cmdParts = cleanCmd.split(/\s+/);
            const executable = cmdParts[0];
            const cmdArgs = cmdParts.slice(1);

            argv.push(validName, executable);
            if (cmdArgs.length > 0) {
                argv.push(...cmdArgs);
            }
            if (cleanArgs) {
                argv.push(...cleanArgs.split(/\s+/));
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
                // Sui nodi AgyCloud l'accesso e' l'account del cliente: un PIN
                // lo scavalcherebbe al prossimo riavvio (auth.js da' priorita' al PIN).
                if (auth.mode === 'account') {
                    return res.status(400).json({ error: 'Questo nodo usa l\'accesso con account: il PIN non e\' disponibile.' });
                }
                updates.AUTH_PIN = authPin.trim();
            }
            if (typeof workspaceDir === 'string' && workspaceDir.trim()) {
                const resolvedWorkspace = path.resolve(workspaceDir.trim());
                if (!fs.existsSync(resolvedWorkspace)) {
                    return res.status(400).json({ error: 'Cartella di lavoro non esistente' });
                }
                updates.WORKSPACE_DIR = resolvedWorkspace;
            }

            // Gestione modulare e sicura di CLI_ARGS: preserva i flag esistenti quando si modifica modello/ragionamento
            const currentEnv = readEnvFile();
            const currentArgs = (currentEnv.CLI_ARGS || process.env.CLI_ARGS || '').split(/\s+/).filter(Boolean);

            let skipPerms = dangerouslySkipPermissions !== undefined ? dangerouslySkipPermissions : currentArgs.includes('--dangerously-skip-permissions');
            let sandbox = sandboxMode !== undefined ? sandboxMode : currentArgs.includes('--sandbox');

            let curModel = null;
            let curEffort = null;
            for (let i = 0; i < currentArgs.length; i++) {
                if (currentArgs[i] === '--model' && currentArgs[i + 1]) curModel = currentArgs[i + 1];
                else if (currentArgs[i].startsWith('--model=')) curModel = currentArgs[i].slice(8);
                else if (currentArgs[i] === '--effort' && currentArgs[i + 1]) curEffort = currentArgs[i + 1];
                else if (currentArgs[i].startsWith('--effort=')) curEffort = currentArgs[i].slice(9);
            }

            const targetModel = (model && typeof model === 'string' && /^[a-zA-Z0-9_.-]+$/.test(model.trim()))
                ? model.trim()
                : curModel;
            const targetEffort = (effort && ['low', 'medium', 'high'].includes(effort.trim()))
                ? effort.trim()
                : curEffort;

            let args = [];
            if (skipPerms) args.push('--dangerously-skip-permissions');
            if (sandbox) args.push('--sandbox');
            if (targetModel) args.push(`--model ${targetModel}`);
            if (targetEffort) args.push(`--effort ${targetEffort}`);

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

    // 9b. Configurazione Google Drive (Picker API Key e Client ID)
    router.post('/gdrive-config', (req, res) => {
        try {
            const { clientId, apiKey } = req.body || {};
            const updates = {};
            if (typeof clientId === 'string') updates.GOOGLE_CLIENT_ID = clientId.trim();
            if (typeof apiKey === 'string') updates.GOOGLE_PICKER_API_KEY = apiKey.trim();
            if (Object.keys(updates).length > 0) {
                updateEnvFile(updates);
            }
            res.json({ success: true, message: 'Configurazione Google Drive salvata' });
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

    // ==========================================
    // 📊 MODELS & USAGE QUOTA TELEMETRY
    // ==========================================

    // Quota e crediti VERI, letti da agy (/usage e /credits, gli stessi dati
    // dell'app Antigravity ufficiale per l'account con cui agy e' collegato).
    // Ogni chiamata ad agy richiede qualche secondo: cache breve.
    let usageCache = { at: 0, data: null };
    const USAGE_CACHE_MS = 2 * 60 * 1000;

    function agyEnv() {
        const home = require('os').homedir();
        const extra = [path.join(home, '.local', 'bin'), path.join(home, '.gemini', 'antigravity-cli', 'bin')];
        return { ...process.env, PATH: [...extra, process.env.PATH || ''].join(':'), NO_COLOR: '1', TERM: 'dumb' };
    }

    async function runAgySlash(command) {
        const cli = process.env.CLI_COMMAND || 'agy';
        const { stdout } = await execFileAsync(cli, [`-p=${command}`], {
            cwd: process.env.WORKSPACE_DIR || require('os').homedir(),
            env: agyEnv(),
            timeout: 60000,
            maxBuffer: 1024 * 1024
        });
        return String(stdout || '');
    }

    function refreshText(iso, percent) {
        if (percent >= 100) return 'Limite non ancora usato.';
        const t = Date.parse(iso);
        if (!t) return 'Limite in parte usato.';
        let mins = Math.max(0, Math.round((t - Date.now()) / 60000));
        const d = Math.floor(mins / 1440); mins -= d * 1440;
        const h = Math.floor(mins / 60); const m = mins - h * 60;
        const parts = [];
        if (d) parts.push(`${d} ${d === 1 ? 'giorno' : 'giorni'}`);
        if (h) parts.push(`${h} ${h === 1 ? 'ora' : 'ore'}`);
        if (!d && m) parts.push(`${m} min`);
        return `Limite in parte usato: torna pieno tra ${parts.join(' e ') || 'pochi minuti'}.`;
    }

    // Righe "Gruppo<TAB>Etichetta<TAB>87%<TAB>2026-10-10T07:46:16Z"
    function parseUsage(text) {
        const groups = [];
        for (const line of text.split('\n')) {
            const cols = line.split('\t').map((c) => c.trim());
            if (cols.length < 3) continue;
            const pct = parseInt(cols[2], 10);
            if (!Number.isFinite(pct)) continue;
            let g = groups.find((x) => x.name === cols[0]);
            if (!g) { g = { name: cols[0], limits: [] }; groups.push(g); }
            g.limits.push({ label: cols[1], remaining: pct, resetAt: cols[3] || null, text: refreshText(cols[3], pct) });
        }
        return groups;
    }

    function parseCredits(text) {
        const out = { remaining: null, upgradeUrl: null };
        for (const line of text.split('\n')) {
            const [k, v] = line.split('\t').map((c) => (c || '').trim());
            if (/remaining credits/i.test(k || '')) out.remaining = parseInt(v, 10);
            if (/^upgrade$/i.test(k || '') && /^https:\/\//.test(v || '')) out.upgradeUrl = v;
        }
        return out;
    }

    router.get('/models-usage', async (req, res) => {
        const force = req.query.refresh === '1';
        if (!force && usageCache.data && Date.now() - usageCache.at < USAGE_CACHE_MS) {
            return res.json(usageCache.data);
        }
        try {
            const [usageOut, creditsOut] = await Promise.all([runAgySlash('/usage'), runAgySlash('/credits')]);
            const groups = parseUsage(usageOut);
            if (!groups.length) {
                return res.json({ success: false, error: 'agy non ha restituito la quota: controlla di aver fatto il login di Antigravity nel Terminale.' });
            }
            const data = { success: true, groups, credits: parseCredits(creditsOut), updatedAt: new Date().toISOString() };
            usageCache = { at: Date.now(), data };
            res.json(data);
        } catch (e) {
            const msg = /not logged|login|auth/i.test(String(e.stderr || e.message))
                ? 'agy non e\' collegato al tuo account: fai il login di Antigravity nel Terminale.'
                : 'Impossibile leggere la quota da agy in questo momento.';
            res.json({ success: false, error: msg });
        }
    });

    // ==========================================
    // 🌐 BROWSER SETTINGS & SUBAGENT POLICY
    // ==========================================

    router.get('/browser/status', async (req, res) => {
        try {
            const browserSettingsFile = path.join(dataDir, 'browser-settings.json');
            let stored = {
                enabled: false,
                executionPolicy: 'request_review', // 'request_review' | 'allow_always' | 'disallow'
                actuationRules: [
                    { id: 'rule-1', type: 'allow', pattern: 'https://*.google.com/*' },
                    { id: 'rule-2', type: 'allow', pattern: 'https://github.com/*' },
                    { id: 'rule-3', type: 'deny', pattern: 'https://*.internal/*' }
                ]
            };

            if (fs.existsSync(browserSettingsFile)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(browserSettingsFile, 'utf8'));
                    stored = { ...stored, ...parsed };
                } catch (e) {}
            }

            // Check Chrome / Chromium availability on host
            let chromeInstalled = false;
            let chromeVersion = '';
            let chromePath = '';

            const candidates = [
                '/usr/local/bin/google-chrome',
                '/usr/local/bin/chromium',
                '/snap/chromium/current/usr/lib/chromium-browser/chrome',
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/snap/bin/chromium',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            ];

            for (const cand of candidates) {
                try {
                    if (fs.existsSync(cand)) {
                        const { stdout } = await execFileAsync(cand, ['--version'], { timeout: 4000 });
                        if (stdout && stdout.trim()) {
                            chromeInstalled = true;
                            chromeVersion = stdout.trim();
                            chromePath = cand;
                            break;
                        }
                    }
                } catch (e) {}
            }

            res.json({
                success: true,
                installed: chromeInstalled,
                version: chromeVersion,
                path: chromePath,
                enabled: !!stored.enabled,
                executionPolicy: stored.executionPolicy,
                actuationRules: stored.actuationRules
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/browser/settings', (req, res) => {
        try {
            const { enabled, executionPolicy, actuationRules } = req.body || {};
            const browserSettingsFile = path.join(dataDir, 'browser-settings.json');
            let stored = {
                enabled: false,
                executionPolicy: 'request_review',
                actuationRules: []
            };

            if (fs.existsSync(browserSettingsFile)) {
                try { stored = JSON.parse(fs.readFileSync(browserSettingsFile, 'utf8')); } catch (e) {}
            }

            if (typeof enabled === 'boolean') stored.enabled = enabled;
            if (executionPolicy) stored.executionPolicy = executionPolicy;
            if (Array.isArray(actuationRules)) stored.actuationRules = actuationRules;

            fs.writeFileSync(browserSettingsFile, JSON.stringify(stored, null, 2), 'utf8');
            res.json({ success: true, settings: stored });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
