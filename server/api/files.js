const express = require('express');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const router = express.Router();

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

module.exports = router;
