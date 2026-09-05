/**
 * AGYUI - Environments & Workspaces Management API
 * Supports Cloud Environments, GitHub Clone, Docker Sandbox, Host CLI, and SSH Helpers
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

function createWorkspacesRouter(sessionManager, ptyManager, io) {
    const router = express.Router();
    const dataDir = path.resolve(__dirname, '../data');
    const workspacesFile = path.join(dataDir, 'workspaces.json');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    function getStoredWorkspaces() {
        if (fs.existsSync(workspacesFile)) {
            try {
                return JSON.parse(fs.readFileSync(workspacesFile, 'utf8'));
            } catch (e) {
                console.error('[Workspaces] Error reading workspaces.json:', e.message);
            }
        }
        return [];
    }

    function saveStoredWorkspaces(list) {
        fs.writeFileSync(workspacesFile, JSON.stringify(list, null, 2), 'utf8');
    }

    // Detect git branch for a directory
    function getGitBranch(dirPath) {
        return new Promise((resolve) => {
            const gitDir = path.join(dirPath, '.git');
            if (!fs.existsSync(gitDir)) return resolve(null);
            
            execFile('git', ['-C', dirPath, 'branch', '--show-current'], { timeout: 1500 }, (err, stdout) => {
                if (err || !stdout) return resolve(null);
                resolve(stdout.trim());
            });
        });
    }

    // Inspect Docker container status
    async function getDockerContainerStatus(containerName) {
        if (!containerName) return 'not_created';
        try {
            const { stdout } = await execFileAsync('docker', [
                'inspect',
                '--format',
                '{{.State.Status}}',
                containerName
            ]);
            return stdout.trim();
        } catch (e) {
            return 'not_created';
        }
    }

    // Calculate directory size (approximate or quick check)
    async function getDirSize(dirPath) {
        try {
            const { stdout } = await execFileAsync('du', ['-sh', dirPath], { timeout: 2000 });
            const size = stdout.trim().split(/\s+/)[0];
            return size || '0 KB';
        } catch (e) {
            return '12 MB';
        }
    }

    // Count sessions associated with a workspace
    function getSessionCountForWorkspace(wsPath) {
        if (!sessionManager || typeof sessionManager.getSessions !== 'function') return 0;
        const sessions = sessionManager.getSessions();
        if (!sessions || !Array.isArray(sessions)) return 0;
        return sessions.filter(s => {
            if (s.workspaceDir) {
                return path.resolve(s.workspaceDir) === path.resolve(wsPath);
            }
            return false;
        }).length;
    }

    // Scan default directories and stored list for environments
    async function discoverWorkspaces() {
        const discovered = [];
        const currentPath = ptyManager?.currentWorkspaceDir || process.env.WORKSPACE_DIR || process.cwd();
        const seenPaths = new Set();
        const homeDir = os.homedir();

        const candidateDirs = [
            currentPath,
            path.join(homeDir, 'workspace'),
            path.join(homeDir, 'projects'),
            path.join(homeDir, '.agycodeui'),
            '/opt/agyui',
            '/opt/credimas',
            '/opt/proseo',
            '/opt/typobello',
            '/opt/aibradar',
            '/opt/cogaguard',
            '/opt/wcag'
        ];

        const stored = getStoredWorkspaces();
        stored.forEach(ws => {
            if (ws.path && !candidateDirs.includes(ws.path)) {
                candidateDirs.push(ws.path);
            }
        });

        for (const dir of candidateDirs) {
            if (!dir || seenPaths.has(path.resolve(dir))) continue;
            seenPaths.add(path.resolve(dir));

            if (fs.existsSync(dir)) {
                try {
                    const stat = fs.statSync(dir);
                    if (stat.isDirectory()) {
                        const name = path.basename(dir) || dir;
                        const branch = await getGitBranch(dir);
                        const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'default';
                        const containerName = `agyrunner_${cleanName}`;
                        const containerStatus = await getDockerContainerStatus(containerName);

                        const storedEntry = stored.find(s => path.resolve(s.path) === path.resolve(dir));
                        const isCurrent = path.resolve(dir) === path.resolve(currentPath);
                        const isRunning = storedEntry?.status !== 'stopped';

                        const sessionCount = getSessionCountForWorkspace(dir);
                        const slug = storedEntry?.slug || `${cleanName}-${Buffer.from(dir).toString('hex').slice(0, 6)}`;

                        discovered.push({
                            id: storedEntry?.id || Buffer.from(dir).toString('base64url').slice(0, 16),
                            name: storedEntry?.name || (name === '.agycodeui' ? 'AgyCodeUI (Root)' : name),
                            slug: slug,
                            url: `${slug}.agy.proseo.it`,
                            path: dir,
                            isCurrent: isCurrent,
                            status: isRunning ? 'running' : 'stopped',
                            isFavorite: !!storedEntry?.isFavorite,
                            gitBranch: branch,
                            hasGit: !!branch,
                            sessionCount: sessionCount,
                            runnerMode: storedEntry?.runnerMode || (dir.startsWith('/opt/') ? 'docker' : 'host'),
                            containerName,
                            containerStatus,
                            model: storedEntry?.model || 'gemini-3.7-flash',
                            tools: storedEntry?.tools || ['Node.js 22', 'Python 3', 'Git + SSH', 'Build tools', 'Antigravity CLI'],
                            createdAt: storedEntry?.createdAt || stat.birthtime || stat.mtime
                        });
                    }
                } catch (e) {}
            }
        }

        return discovered;
    }

    /**
     * GET /api/workspaces
     * List all environments and workspaces
     */
    router.get('/', async (req, res) => {
        try {
            const list = await discoverWorkspaces();
            const current = list.find(w => w.isCurrent) || list[0] || {
                id: 'default',
                name: 'workspace',
                slug: 'workspace-default',
                url: 'workspace.agy.proseo.it',
                path: ptyManager?.currentWorkspaceDir || process.cwd(),
                isCurrent: true,
                status: 'running',
                runnerMode: ptyManager?.runnerMode || 'host',
                sessionCount: 0
            };

            res.json({
                success: true,
                current,
                quota: {
                    used: list.length,
                    total: 10,
                    text: `${list.length} of 10 env`
                },
                activeRunnerMode: ptyManager?.runnerMode || 'host',
                workspaces: list
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * POST /api/workspaces/create
     * 3-Step Wizard: Create Environment / Import from GitHub
     */
    router.post('/create', async (req, res) => {
        try {
            const {
                name,
                type = 'blank', // 'blank' | 'github'
                repoUrl = '',
                gitBranch = '',
                slug = '',
                tools = [],
                runnerMode = 'host',
                model = 'gemini-3.7-flash'
            } = req.body || {};

            if (!name || typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({ error: 'Il nome del progetto è obbligatorio' });
            }

            const cleanProjectName = name.trim();
            const generatedSlug = slug && slug.trim() 
                ? slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
                : `${cleanProjectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-${Math.random().toString(36).substring(2, 8)}`;

            const homeDir = os.homedir();
            const targetDir = path.join(homeDir, 'workspace', generatedSlug);

            // Create target directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // If importing from GitHub, clone the repository
            if (type === 'github' && repoUrl && repoUrl.trim()) {
                const gitArgs = ['clone'];
                if (gitBranch && gitBranch.trim()) {
                    gitArgs.push('-b', gitBranch.trim());
                }
                gitArgs.push(repoUrl.trim(), targetDir);

                try {
                    // Clone directly into directory
                    await execFileAsync('git', gitArgs, { timeout: 60000 });
                } catch (cloneErr) {
                    console.warn('[Workspaces] Git clone error:', cloneErr.message);
                    // If targetDir already had files or clone failed, ensure dir exists
                }
            } else {
                // Initialize blank workspace with a simple README.md
                const readmePath = path.join(targetDir, 'README.md');
                if (!fs.existsSync(readmePath)) {
                    fs.writeFileSync(readmePath, `# ${cleanProjectName}\n\nAmbiente di sviluppo creato con AGYUI.\n\n- Data creazione: ${new Date().toISOString()}\n- Runner: ${runnerMode}\n- Modello: ${model}\n`, 'utf8');
                }
            }

            // Save in workspaces.json
            const stored = getStoredWorkspaces();
            const wsId = Buffer.from(targetDir).toString('base64url').slice(0, 16);
            
            const newEnv = {
                id: wsId,
                name: cleanProjectName,
                slug: generatedSlug,
                url: `${generatedSlug}.agy.proseo.it`,
                path: targetDir,
                runnerMode,
                model,
                status: 'running',
                type,
                repoUrl: repoUrl || null,
                tools: tools.length > 0 ? tools : ['Node.js 22', 'Python 3', 'Git + SSH', 'Build tools', 'Antigravity CLI'],
                createdAt: new Date().toISOString(),
                isFavorite: false
            };

            const existingIdx = stored.findIndex(w => path.resolve(w.path) === path.resolve(targetDir));
            if (existingIdx >= 0) {
                stored[existingIdx] = { ...stored[existingIdx], ...newEnv };
            } else {
                stored.push(newEnv);
            }
            saveStoredWorkspaces(stored);

            // Switch to this new environment
            if (ptyManager) {
                await ptyManager.setWorkspace(targetDir, runnerMode);
            }
            if (sessionManager) {
                sessionManager.currentWorkspaceDir = targetDir;
            }

            if (io) {
                io.emit('workspace-switched', {
                    path: targetDir,
                    name: cleanProjectName,
                    slug: generatedSlug,
                    runnerMode
                });
            }

            res.json({
                success: true,
                message: `Ambiente "${cleanProjectName}" creato con successo!`,
                environment: newEnv
            });
        } catch (e) {
            console.error('[Workspaces] Error in create:', e);
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * POST /api/workspaces/switch
     * Switch active working directory and runner environment
     */
    router.post('/switch', async (req, res) => {
        try {
            const { path: targetPath, runnerMode = 'host', containerName } = req.body || {};
            if (!targetPath || typeof targetPath !== 'string') {
                return res.status(400).json({ error: 'Percorso workspace non specificato' });
            }

            const resolvedPath = path.resolve(targetPath);
            if (!fs.existsSync(resolvedPath)) {
                return res.status(404).json({ error: 'La cartella del workspace specificata non esiste' });
            }

            const stat = fs.statSync(resolvedPath);
            if (!stat.isDirectory()) {
                return res.status(400).json({ error: 'Il percorso specificato non è una cartella' });
            }

            if (ptyManager && typeof ptyManager.setWorkspace === 'function') {
                await ptyManager.setWorkspace(resolvedPath, runnerMode, containerName);
            } else if (ptyManager) {
                ptyManager.currentWorkspaceDir = resolvedPath;
            }

            if (sessionManager) {
                sessionManager.currentWorkspaceDir = resolvedPath;
            }

            const branch = await getGitBranch(resolvedPath);

            if (io) {
                io.emit('workspace-switched', {
                    path: resolvedPath,
                    name: path.basename(resolvedPath),
                    runnerMode: ptyManager?.runnerMode || runnerMode,
                    containerName: ptyManager?.containerName || containerName,
                    gitBranch: branch
                });
            }

            res.json({
                success: true,
                message: `Workspace cambiato in ${resolvedPath} (${runnerMode.toUpperCase()} mode)`,
                currentPath: resolvedPath,
                runnerMode: ptyManager?.runnerMode || runnerMode,
                containerName: ptyManager?.containerName || containerName
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * POST /api/workspaces/action
     * Controls environment status: 'start' | 'stop' | 'restart'
     */
    router.post('/action', async (req, res) => {
        try {
            const { id, path: wsPath, action } = req.body || {};
            if (!action) return res.status(400).json({ error: 'Azione richiesta' });

            const stored = getStoredWorkspaces();
            const target = stored.find(w => w.id === id || (wsPath && path.resolve(w.path) === path.resolve(wsPath)));

            if (target) {
                if (action === 'stop') {
                    target.status = 'stopped';
                } else if (action === 'start' || action === 'restart') {
                    target.status = 'running';
                }
                saveStoredWorkspaces(stored);
            }

            if (action === 'restart' && ptyManager) {
                ptyManager.restart();
            }

            res.json({ success: true, action, status: target?.status || 'running' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * POST /api/workspaces/favorite
     * Toggle favorite status
     */
    router.post('/favorite', async (req, res) => {
        try {
            const { id, path: wsPath } = req.body || {};
            const stored = getStoredWorkspaces();
            let found = stored.find(w => w.id === id || (wsPath && path.resolve(w.path) === path.resolve(wsPath)));

            if (!found && wsPath) {
                found = {
                    id: Buffer.from(wsPath).toString('base64url').slice(0, 16),
                    name: path.basename(wsPath),
                    path: wsPath,
                    isFavorite: true
                };
                stored.push(found);
            } else if (found) {
                found.isFavorite = !found.isFavorite;
            }

            saveStoredWorkspaces(stored);
            res.json({ success: true, isFavorite: found?.isFavorite });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * PUT /api/workspaces/rename
     * Rename workspace/environment
     */
    router.put('/rename', async (req, res) => {
        try {
            const { id, path: wsPath, newName } = req.body || {};
            if (!newName || !newName.trim()) {
                return res.status(400).json({ error: 'Nuovo nome non specificato' });
            }

            const stored = getStoredWorkspaces();
            const found = stored.find(w => w.id === id || (wsPath && path.resolve(w.path) === path.resolve(wsPath)));
            if (found) {
                found.name = newName.trim();
                saveStoredWorkspaces(stored);
            }

            res.json({ success: true, name: newName.trim() });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * DELETE /api/workspaces/:id
     * Remove environment from list
     */
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            let stored = getStoredWorkspaces();
            stored = stored.filter(w => w.id !== id);
            saveStoredWorkspaces(stored);
            res.json({ success: true, message: 'Ambiente rimosso' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * GET /api/workspaces/ssh-info
     * Returns SSH connection parameters for the environment
     */
    router.get('/ssh-info', async (req, res) => {
        try {
            const host = process.env.SSH_HOST || 'agy.proseo.it';
            const user = process.env.SSH_USER || 'tino';
            const port = process.env.SSH_PORT || '22';
            const activePath = ptyManager?.currentWorkspaceDir || process.cwd();

            res.json({
                success: true,
                host,
                user,
                port,
                workspaceDir: activePath,
                command: `ssh ${user}@${host} -p ${port}`,
                webTerminalUrl: '/#terminal'
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

module.exports = createWorkspacesRouter;
