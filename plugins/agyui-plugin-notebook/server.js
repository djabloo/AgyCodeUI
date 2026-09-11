/**
 * AGYUI Notebook — bridge verso Gemini Notebook (ex NotebookLM) tramite la CLI
 * "nlm" (github.com/jacob-bd/gemini-notebook-mcp-cli). Nessuna API ufficiale
 * esiste: la CLI usa i cookie di sessione Google, importati una volta con
 * `nlm login --manual --file <cookies>` (vedi README di questo plugin).
 *
 * Solo self-hosted, di proposito: i cookie sono l'intera sessione Google
 * dell'account, non uno scope limitato a Notebook. Multi-tenant richiederebbe
 * un browser virtuale per utente e la custodia dei loro cookie Google — un
 * salto di rischio che non abbiamo fatto (vedi README).
 *
 * Ogni chiamata RPC spawna un comando `nlm ... --json` e ne fa il parse.
 * Nessun processo persistente lato nlm: e' la CLI stessa a gestire cookie/cache.
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');

const NLM_BIN = process.env.NLM_BIN || path.join(__dirname, 'venv', 'bin', 'nlm');
const EXEC_TIMEOUT_MS = 10 * 60 * 1000; // gli Studio content (podcast/video) impiegano minuti, non secondi
const TMP_DIR = path.join(os.tmpdir(), 'agyui-notebook');
fs.mkdirSync(TMP_DIR, { recursive: true });

function runNlm(args) {
  return new Promise((resolve) => {
    execFile(NLM_BIN, args, { timeout: EXEC_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

// La CLI stampa JSON pulito su stdout con --json; in errore lo status e' su
// stderr (spesso testo umano, non JSON) — quindi non tentiamo il parse lato
// errore, restituiamo il messaggio cosi' com'e'.
async function nlmJson(args) {
  const { err, stdout, stderr } = await runNlm([...args, '--json']);
  if (err) {
    const msg = stderr || stdout || err.message;
    throw new Error(msg.split('\n').slice(0, 4).join(' ').trim() || 'Errore nlm');
  }
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error('Risposta non valida da nlm: ' + stdout.slice(0, 200));
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 30 * 1024 * 1024) { reject(new Error('Corpo troppo grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJsonBody(req) {
  return readBody(req).then((buf) => {
    if (!buf.length) return {};
    try { return JSON.parse(buf.toString('utf8')); } catch (e) { return {}; }
  });
}

const ARTIFACT_KIND = {
  audio: { create: 'audio', download: 'audio', ext: 'm4a' },
  video: { create: 'video', download: 'video', ext: 'mp4' },
  report: { create: 'report', download: 'report', ext: 'md' },
  quiz: { create: 'quiz', download: 'quiz', ext: 'html' },
  flashcards: { create: 'flashcards', download: 'flashcards', ext: 'md' },
  mindmap: { create: 'mindmap', download: 'mind-map', ext: 'json' },
  slides: { create: 'slides', download: 'slide-deck', ext: 'pdf' }
};

const server = http.createServer(async (req, res) => {
  try {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    const parts = pathname.split('/').filter(Boolean);

    // GET /health — stato autenticazione (per l'indicatore nella UI)
    if (req.method === 'GET' && pathname === '/health') {
      const { err, stderr, stdout } = await runNlm(['login', '--check']);
      return sendJson(res, 200, { available: !err, message: (stderr || stdout || '').split('\n')[0] });
    }

    // GET /notebooks — elenco
    if (req.method === 'GET' && pathname === '/notebooks') {
      const data = await nlmJson(['notebook', 'list']);
      return sendJson(res, 200, data);
    }

    // POST /notebooks { title } — crea
    if (req.method === 'POST' && pathname === '/notebooks') {
      const { title } = await readJsonBody(req);
      if (!title || !title.trim()) return sendJson(res, 400, { error: 'Titolo obbligatorio' });
      const data = await nlmJson(['notebook', 'create', title.trim()]);
      return sendJson(res, 200, data);
    }

    // DELETE /notebooks/:id
    if (req.method === 'DELETE' && parts.length === 2 && parts[0] === 'notebooks') {
      const data = await nlmJson(['notebook', 'delete', parts[1], '--confirm']);
      return sendJson(res, 200, data);
    }

    // GET /notebooks/:id/sources
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'notebooks' && parts[2] === 'sources') {
      const data = await nlmJson(['source', 'list', parts[1]]);
      return sendJson(res, 200, data);
    }

    // POST /notebooks/:id/sources { url } | { youtube } | { text, title } | { fileName, fileData(base64) }
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'notebooks' && parts[2] === 'sources') {
      const body = await readJsonBody(req);
      const notebookId = parts[1];
      const args = ['source', 'add', notebookId, '--wait'];
      let tmpFile = null;
      if (body.url) {
        args.push('--url', body.url);
      } else if (body.youtube) {
        args.push('--youtube', body.youtube);
      } else if (body.text) {
        args.push('--text', body.text);
        if (body.title) args.push('--title', body.title);
      } else if (body.fileName && body.fileData) {
        const safeName = path.basename(body.fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'documento';
        tmpFile = path.join(TMP_DIR, `${crypto.randomBytes(6).toString('hex')}-${safeName}`);
        fs.writeFileSync(tmpFile, Buffer.from(body.fileData, 'base64'));
        args.push('--file', tmpFile);
      } else {
        return sendJson(res, 400, { error: 'Serve url, youtube, text o un file' });
      }
      try {
        const data = await nlmJson(args);
        return sendJson(res, 200, data);
      } finally {
        if (tmpFile) fs.unlink(tmpFile, () => {});
      }
    }

    // DELETE /sources/:id
    if (req.method === 'DELETE' && parts.length === 2 && parts[0] === 'sources') {
      const { err, stderr, stdout } = await runNlm(['source', 'delete', parts[1], '--confirm']);
      if (err) return sendJson(res, 502, { error: (stderr || stdout).split('\n')[0] });
      return sendJson(res, 200, { success: true });
    }

    // POST /notebooks/:id/query { question }
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'notebooks' && parts[2] === 'query') {
      const { question } = await readJsonBody(req);
      if (!question || !question.trim()) return sendJson(res, 400, { error: 'Domanda obbligatoria' });
      const data = await nlmJson(['notebook', 'query', parts[1], question.trim()]);
      return sendJson(res, 200, data);
    }

    // GET /notebooks/:id/studio — stato artefatti generati
    if (req.method === 'GET' && parts.length === 3 && parts[0] === 'notebooks' && parts[2] === 'studio') {
      const data = await nlmJson(['studio', 'status', parts[1]]);
      return sendJson(res, 200, data);
    }

    // POST /notebooks/:id/studio { kind, format, length, style, difficulty, count, focus, language }
    if (req.method === 'POST' && parts.length === 3 && parts[0] === 'notebooks' && parts[2] === 'studio') {
      const body = await readJsonBody(req);
      const kind = ARTIFACT_KIND[body.kind];
      if (!kind) return sendJson(res, 400, { error: 'Tipo di contenuto non valido' });
      const args = [kind.create, 'create', parts[1]];
      if (body.format) args.push('--format', body.format);
      if (body.length) args.push('--length', body.length);
      if (body.style) args.push('--style', body.style);
      if (body.difficulty) args.push('--difficulty', body.difficulty);
      if (body.count) args.push('--count', String(body.count));
      if (body.focus) args.push('--focus', body.focus);
      if (body.language) args.push('--language', body.language);
      args.push('--confirm');
      const data = await nlmJson(args);
      return sendJson(res, 200, data);
    }

    // GET /notebooks/:id/studio/:artifactId/download?kind=audio — scarica e restituisce il file
    if (req.method === 'GET' && parts.length === 4 && parts[0] === 'notebooks' && parts[2] === 'studio') {
      const kind = ARTIFACT_KIND[searchParams.get('kind')];
      if (!kind) return sendJson(res, 400, { error: 'Tipo di contenuto non valido' });
      const notebookId = parts[1];
      const artifactId = parts[3];
      const outFile = path.join(TMP_DIR, `${crypto.randomBytes(6).toString('hex')}.${kind.ext}`);
      const { err, stderr, stdout } = await runNlm(['download', kind.download, notebookId, '--id', artifactId, '--output', outFile]);
      if (err || !fs.existsSync(outFile)) {
        return sendJson(res, 502, { error: (stderr || stdout || (err && err.message) || 'Download fallito').split('\n')[0] });
      }
      try {
        const buf = fs.readFileSync(outFile);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="notebook-${artifactId}.${kind.ext}"`
        });
        res.end(buf);
      } finally {
        fs.unlink(outFile, () => {});
      }
      return;
    }

    // DELETE /notebooks/:id/studio/:artifactId
    if (req.method === 'DELETE' && parts.length === 4 && parts[0] === 'notebooks' && parts[2] === 'studio') {
      const { err, stderr, stdout } = await runNlm(['studio', 'delete', parts[1], parts[3], '--confirm']);
      if (err) return sendJson(res, 502, { error: (stderr || stdout).split('\n')[0] });
      return sendJson(res, 200, { success: true });
    }

    sendJson(res, 404, { error: 'Rotta non trovata' });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  console.log(JSON.stringify({ ready: true, port: addr.port }));
});
