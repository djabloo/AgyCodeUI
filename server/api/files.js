const express = require('express');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const router = express.Router();

const UPLOAD_DIR_NAME = 'agy_uploads';

function getSafePath(baseDir, reqPath = '') {
    const base = path.resolve(baseDir);
    const resolved = path.resolve(base, reqPath);
    
    // Check lexical path traversal
    const rel = path.relative(base, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    
    // Symlink escape protection: check canonical realpaths
    try {
        const realBase = fs.realpathSync(base);
        if (fs.existsSync(resolved)) {
            const realTarget = fs.realpathSync(resolved);
            const realRel = path.relative(realBase, realTarget);
            if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
                return null;
            }
            return realTarget;
        }
        return resolved;
    } catch (e) {
        return null;
    }
}

router.get('/tree', async (req, res) => {
    try {
        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const targetPath = getSafePath(baseDir, req.query.path || '');
        
        if (!targetPath) {
            return res.status(403).json({ error: 'Accesso negato: percorso non consentito' });
        }

        let entries;
        try {
            entries = await fsPromises.readdir(targetPath, { withFileTypes: true });
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Directory non trovata' });
            }
            throw err;
        }

        const items = await Promise.all(
            entries
                .filter(entry => !entry.name.startsWith('.git') && entry.name !== 'node_modules')
                .map(async (entry) => {
                    const fullItemPath = path.join(targetPath, entry.name);
                    const relativePath = path.relative(baseDir, fullItemPath);
                    let size = 0;
                    if (!entry.isDirectory()) {
                        try {
                            const stat = await fsPromises.stat(fullItemPath);
                            size = stat.size;
                        } catch (e) {}
                    }
                    return {
                        name: entry.name,
                        path: relativePath.replace(/\\/g, '/'),
                        isDir: entry.isDirectory(),
                        size
                    };
                })
        );

        // Ordina: prima le cartelle, poi i file
        items.sort((a, b) => {
            if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
            return a.isDir ? -1 : 1;
        });

        res.json({
            currentPath: path.relative(baseDir, targetPath).replace(/\\/g, '/'),
            items
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/content', async (req, res) => {
    try {
        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const targetPath = getSafePath(baseDir, req.query.path || '');

        if (!targetPath) {
            return res.status(403).json({ error: 'Accesso negato: percorso non consentito' });
        }

        let stat;
        try {
            stat = await fsPromises.stat(targetPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'File non trovato' });
            }
            throw err;
        }

        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Il percorso specificato è una directory' });
        }

        // Limit file size to 1MB for preview
        if (stat.size > 1024 * 1024) {
            return res.status(400).json({ error: 'File troppo grande per l\'anteprima (>1MB)' });
        }

        const content = await fsPromises.readFile(targetPath, 'utf8');
        res.json({
            path: req.query.path,
            content,
            size: stat.size
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload allegati chat (file o screenshot) — body raw (nessuna dipendenza multer)
router.post('/upload', express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
    try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            return res.status(400).json({ error: 'File vuoto o non valido' });
        }

        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const rawName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : 'file';
        const safeName = (path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)) || 'file';
        const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const finalName = `${uniquePrefix}-${safeName}`;

        const uploadDir = path.join(baseDir, UPLOAD_DIR_NAME);
        await fsPromises.mkdir(uploadDir, { recursive: true });

        // Difesa in profondità: verifica che il percorso finale resti dentro uploadDir
        const safeTarget = getSafePath(baseDir, path.join(UPLOAD_DIR_NAME, finalName));
        if (!safeTarget) {
            return res.status(403).json({ error: 'Percorso non consentito' });
        }

        await fsPromises.writeFile(safeTarget, req.body);

        const relativePath = path.relative(baseDir, safeTarget).replace(/\\/g, '/');
        res.json({ success: true, path: relativePath, name: finalName, size: req.body.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint per servire file binari raw (immagini, audio, video, PDF)
router.get('/raw', async (req, res) => {
    try {
        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const targetPath = getSafePath(baseDir, req.query.path || '');

        if (!targetPath) {
            return res.status(403).json({ error: 'Accesso negato: percorso non consentito' });
        }

        let stat;
        try {
            stat = await fsPromises.stat(targetPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'File non trovato' });
            }
            throw err;
        }

        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'Il percorso specificato è una directory' });
        }

        const ext = path.extname(targetPath).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.bmp': 'image/bmp',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.pdf': 'application/pdf',
            '.json': 'application/json',
            '.txt': 'text/plain; charset=utf-8',
            '.md': 'text/markdown; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.html': 'text/html; charset=utf-8'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'no-cache');

        const stream = fs.createReadStream(targetPath);
        stream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Salvataggio modifiche da Code Editor
router.post('/save', async (req, res) => {
    try {
        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const filePath = req.body.path;
        const content = req.body.content;

        if (filePath === undefined || content === undefined) {
            return res.status(400).json({ error: 'Parametri "path" e "content" obbligatori' });
        }

        const targetPath = getSafePath(baseDir, filePath);
        if (!targetPath) {
            return res.status(403).json({ error: 'Accesso negato: percorso non consentito' });
        }

        try {
            const stat = await fsPromises.stat(targetPath);
            if (stat.isDirectory()) {
                return res.status(400).json({ error: 'Impossibile salvare: il percorso è una directory' });
            }
        } catch (e) {
            const parentDir = path.dirname(targetPath);
            await fsPromises.mkdir(parentDir, { recursive: true });
        }

        await fsPromises.writeFile(targetPath, content, 'utf8');
        const stat = await fsPromises.stat(targetPath);

        res.json({
            success: true,
            path: filePath,
            size: stat.size,
            mtime: stat.mtime
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Creazione nuovo file o cartella
router.post('/create', async (req, res) => {
    try {
        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const itemPath = req.body.path;
        const isDir = !!req.body.isDir;

        if (!itemPath) {
            return res.status(400).json({ error: 'Parametro "path" obbligatorio' });
        }

        const targetPath = getSafePath(baseDir, itemPath);
        if (!targetPath) {
            return res.status(403).json({ error: 'Accesso negato: percorso non consentito' });
        }

        if (fs.existsSync(targetPath)) {
            return res.status(409).json({ error: 'File o cartella già esistente' });
        }

        if (isDir) {
            await fsPromises.mkdir(targetPath, { recursive: true });
        } else {
            const parentDir = path.dirname(targetPath);
            await fsPromises.mkdir(parentDir, { recursive: true });
            await fsPromises.writeFile(targetPath, '', 'utf8');
        }

        res.json({ success: true, path: itemPath, isDir });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminazione file o cartella
router.delete('/delete', async (req, res) => {
    try {
        const baseDir = process.env.WORKSPACE_DIR || process.cwd();
        const itemPath = req.query.path || (req.body && req.body.path);

        if (!itemPath) {
            return res.status(400).json({ error: 'Parametro "path" obbligatorio' });
        }

        const targetPath = getSafePath(baseDir, itemPath);
        if (!targetPath) {
            return res.status(403).json({ error: 'Accesso negato: percorso non consentito' });
        }

        const stat = await fsPromises.stat(targetPath);
        if (stat.isDirectory()) {
            await fsPromises.rm(targetPath, { recursive: true, force: true });
        } else {
            await fsPromises.unlink(targetPath);
        }

        res.json({ success: true, path: itemPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
