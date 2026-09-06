/**
 * AGY UI - PII Redaction bridge
 *
 * Proxy verso il servizio locale rizzo-pii (https://github.com/Rizzo-AI-Academy/rizzo-pii),
 * un unico container condiviso sull'host (127.0.0.1:5005, offline, nessun dato esce dalla
 * macchina). Non e' esposto agli ambienti/container utente: qui gira lato host, l'agente
 * legge poi il file gia' anonimizzato dalla cartella pii-clean/ del workspace.
 */

const express = require('express');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const RIZZO_PII_URL = process.env.RIZZO_PII_URL || 'http://127.0.0.1:5005';

function createPiiRouter() {
    const router = express.Router();
    const dataDir = path.resolve(__dirname, '../data');
    const workspacesFile = path.join(dataDir, 'workspaces.json');

    function getStoredWorkspaces() {
        if (fs.existsSync(workspacesFile)) {
            try {
                return JSON.parse(fs.readFileSync(workspacesFile, 'utf8'));
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    // Il path del workspace target deve corrispondere a uno noto: niente scritture
    // arbitrarie sul filesystem a partire da un header controllato dal client.
    function resolveAllowedWorkspacePath(rawPath) {
        if (!rawPath) return null;
        const resolved = path.resolve(rawPath);
        const known = getStoredWorkspaces().map(w => path.resolve(w.path));
        if (process.env.WORKSPACE_DIR) known.push(path.resolve(process.env.WORKSPACE_DIR));
        return known.includes(resolved) ? resolved : null;
    }

    router.get('/health', async (req, res) => {
        try {
            const r = await fetch(`${RIZZO_PII_URL}/health`, { signal: AbortSignal.timeout(4000) });
            const data = await r.json().catch(() => ({}));
            res.status(r.ok ? 200 : 503).json({ available: r.ok, ...data });
        } catch (e) {
            res.status(503).json({ available: false, error: 'Servizio PII non raggiungibile' });
        }
    });

    // Upload raw (stesso pattern di /api/files/upload): body = bytes del file,
    // metadati passati via header per evitare una dipendenza multer.
    router.post('/redact', express.raw({ type: () => true, limit: '30mb' }), async (req, res) => {
        try {
            const workspacePath = resolveAllowedWorkspacePath(
                req.headers['x-workspace-path'] ? decodeURIComponent(req.headers['x-workspace-path']) : null
            );
            if (!workspacePath) {
                return res.status(403).json({ error: 'Ambiente non riconosciuto' });
            }
            if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
                return res.status(400).json({ error: 'File vuoto o non valido' });
            }

            const rawName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : 'documento';
            const safeName = (path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)) || 'documento';
            const isPdf = safeName.toLowerCase().endsWith('.pdf');

            const form = new FormData();
            form.append(isPdf ? 'pdf' : 'file', new Blob([req.body]), safeName);
            // Salviamo solo il testo/PDF anonimizzato, mai la mappa reversibile:
            // non serve chiedere al servizio di calcolarla.
            if (!isPdf) form.append('include_mapping', '0');

            // /pdf -> PDF veramente redatto (contenuto rimosso, non solo coperto).
            // /analyze -> JSON con testo anonimizzato, per .txt/.md.
            const endpoint = isPdf ? '/pdf' : '/analyze';
            let rizzoRes;
            try {
                rizzoRes = await fetch(`${RIZZO_PII_URL}${endpoint}`, {
                    method: 'POST',
                    body: form,
                    signal: AbortSignal.timeout(10 * 60 * 1000)
                });
            } catch (e) {
                return res.status(503).json({ error: 'Servizio PII non raggiungibile' });
            }

            if (!rizzoRes.ok) {
                const errText = await rizzoRes.text().catch(() => '');
                return res.status(502).json({ error: `Servizio PII: errore ${rizzoRes.status}`, details: errText.slice(0, 300) });
            }

            const outDir = path.join(workspacePath, 'pii-clean');
            await fsPromises.mkdir(outDir, { recursive: true });

            let outName, outBuffer;
            if (isPdf) {
                outBuffer = Buffer.from(await rizzoRes.arrayBuffer());
                outName = safeName.replace(/\.pdf$/i, '') + '.anonimizzato.pdf';
            } else {
                const json = await rizzoRes.json();
                outBuffer = Buffer.from(json.anonymized_text || json.text || JSON.stringify(json, null, 2), 'utf8');
                outName = safeName.replace(/\.[^.]+$/, '') + '.anonimizzato.txt';
            }

            const outPath = path.join(outDir, outName);
            await fsPromises.writeFile(outPath, outBuffer);

            res.json({
                success: true,
                path: path.relative(workspacePath, outPath).replace(/\\/g, '/'),
                name: outName,
                size: outBuffer.length
            });
        } catch (e) {
            console.error('[PII] redact error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

module.exports = createPiiRouter;
