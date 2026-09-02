/**
 * AGYUI - Workspaces & Projects Management API
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function createWorkspacesRouter(sessionManager, ptyManager, io) {
    const router = express.Router();
    const dataDir = path.resolve(__dirname, '../data');
    const workspacesFile = path.join(dataDir, 'workspaces.json');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Default known projects list
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

    // Scan default directories for projects
    async function discoverWorkspaces() {
        const discovered = [];
        const currentPath = ptyManager?.currentWorkspaceDir || process.env.WORKSPACE_DIR || process.cwd();
        const seenPaths = new Set();

        const os = require('os');
        const homeDir = os.homedir();
        const candidateDirs = [
            currentPath,
            path.join(homeDir, '.agycodeui'),
            path.join(homeDir, 'projects'),
            path.join(homeDir, 'workspace'),
            '/opt/credimas',
            '/opt/proseo',
            '/opt/typobello',
            '/opt/aibradar',
            '/opt/cogaguard',
            '/opt/wcag',
            '/opt/directus',
            '/opt/n8n'
        ];

        // Add custom stored workspaces
        const stored = getStoredWorkspaces();
        stored.forEach(ws => {
            if (ws.path && !candidateDirs.includes(ws.path)) {
                candidateDirs.push(ws.path);
            }
        });

        for (const dir of candidateDirs) {
            if (!dir || seenPaths.has(dir)) continue;
            seenPaths.add(dir);

            if (fs.existsSync(dir)) {
                try {
                    const stat = fs.statSync(dir);
                    if (stat.isDirectory()) {
                        const name = path.basename(dir) || dir;
                        const branch = await getGitBranch(dir);
                        discovered.push({
                            id: Buffer.from(dir).toString('base64url').slice(0, 16),
                            name: name === '.agycodeui' ? 'AgyCodeUI (Root)' : name,
                            path: dir,
                            isCurrent: path.resolve(dir) === path.resolve(currentPath),
                            gitBranch: branch,
                            hasGit: !!branch
                        });
                    }
                } catch (e) {}
            }
        }

        return discovered;
    }

    /**
     * GET /api/workspaces
     * List all available workspaces
     */
    router.get('/', async (req, res) => {
        try {
            const list = await discoverWorkspaces();
            const current = list.find(w => w.isCurrent) || {
                id: 'default',
                name: path.basename(ptyManager?.currentWorkspaceDir || process.cwd()),
                path: ptyManager?.currentWorkspaceDir || process.cwd(),
                isCurrent: true
            };

            res.json({
                success: true,
                current,
                workspaces: list
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * POST /api/workspaces/switch
     * Switch active working directory
     * Body: { path }
     */
    router.post('/switch', async (req, res) => {
        try {
            const { path: targetPath } = req.body || {};
            if (!targetPath || typeof targetPath !== 'string') {
                return res.status(400).json({ error: 'Percorso workspace non specificato' });
            }

            const resolvedPath = path.resolve(targetPath);
            if (!fs.existsSync(resolvedPath)) {
                return res.status(404).json({ error: `La cartella ${resolvedPath} non esiste` });
            }

            const stat = fs.statSync(resolvedPath);
            if (!stat.isDirectory()) {
                return res.status(400).json({ error: 'Il percorso specificato non è una cartella' });
            }

            // Update PTY manager workspace directory
            if (ptyManager) {
                ptyManager.currentWorkspaceDir = resolvedPath;
                ptyManager.spawnPty(); // Restart PTY in the new working directory
            }

            // Update session manager active path
            if (sessionManager) {
                sessionManager.currentWorkspaceDir = resolvedPath;
            }

            // Notify connected WebSocket clients
            if (io) {
                io.emit('workspace-switched', {
                    path: resolvedPath,
                    name: path.basename(resolvedPath)
                });
            }

            res.json({
                success: true,
                message: `Workspace cambiato in ${resolvedPath}`,
                currentPath: resolvedPath
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * POST /api/workspaces/add
     * Save a custom workspace path
     * Body: { path, name }
     */
    router.post('/add', (req, res) => {
        try {
            const { path: targetPath, name } = req.body || {};
            if (!targetPath) return res.status(400).json({ error: 'Percorso non specificato' });

            const resolvedPath = path.resolve(targetPath);
            if (!fs.existsSync(resolvedPath)) {
                return res.status(404).json({ error: 'Cartella non trovata' });
            }

            const stored = getStoredWorkspaces();
            if (!stored.some(w => w.path === resolvedPath)) {
                stored.push({
                    id: Buffer.from(resolvedPath).toString('base64url').slice(0, 16),
                    name: name || path.basename(resolvedPath),
                    path: resolvedPath
                });
                saveStoredWorkspaces(stored);
            }

            res.json({ success: true, message: 'Workspace aggiunto con successo' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

module.exports = createWorkspacesRouter;
