/**
 * AGYUI Notebook — notebook di ricerca nativo, motore "agy" (Google Antigravity).
 *
 * Niente account/cookie di terze parti: le "fonti" sono file dentro il workspace
 * stesso (<workspace>/.agy-notebook/<id>/sources/), e le domande/generazioni
 * passano da agy in modalita' non interattiva ("print mode"), lo stesso
 * meccanismo gia' usato da server/agentRunner.js per la Chat strutturata
 * (agy -p=<prompt> --output-format stream-json --dangerously-skip-permissions).
 * Funziona identico in self-hosted e in ogni container SaaS: e' lo stesso agy
 * gia' autenticato per l'utente, non serve nessun bridge o servizio esterno.
 *
 * Le fonti restano dentro il workspace dell'utente: agy le legge con i suoi
 * stessi strumenti (non serve estrarre testo da PDF a parte). Per lo Studio,
 * invece di fidarsi di un output strutturato in stdout, si chiede ad agy di
 * SCRIVERE il risultato in un file preciso — e poi lo si rilegge: piu' robusto
 * che fare il parse di JSON generato da un LLM.
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const NOTEBOOK_DIRNAME = '.agy-notebook';
const AGY_TIMEOUT_MS = parseInt(process.env.NOTEBOOK_AGY_TIMEOUT_MS || '600000', 10); // 10 min: Studio su fonti lunghe non è istantaneo

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
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

// ── path del workspace: SEMPRE dal client (che lo legge da /api/status), mai
// da una env var del processo plugin — il plugin non sa quale sia il
// workspace "attivo" adesso, puo' cambiare con lo switch ambiente.
function resolveWorkspace(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const resolved = path.resolve(raw);
  try {
    if (!fs.statSync(resolved).isDirectory()) return null;
  } catch (e) {
    return null;
  }
  return resolved;
}

function safeId(id) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id || '') ? id : null;
}

function notebookDir(workspace, id) {
  return path.join(workspace, NOTEBOOK_DIRNAME, id);
}

function safeFileName(name, fallback) {
  const base = path.basename(String(name || fallback || 'file')).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
  return base || fallback || 'file';
}

function tsStamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

// ── invocazione non interattiva di agy (stesso pattern di server/agentRunner.js) ──
function buildAgyEnv() {
  const envPath = [
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.gemini', 'antigravity-cli', 'bin'),
    process.env.PATH || ''
  ].filter(Boolean).join(path.delimiter);
  return { ...process.env, PATH: envPath, NO_COLOR: '1', TERM: 'dumb' };
}

function runAgy(prompt, { cwd, conversationId }) {
  return new Promise((resolve) => {
    const command = process.env.CLI_COMMAND || 'agy';
    const args = [`-p=${prompt}`, '--output-format', 'stream-json', '--dangerously-skip-permissions'];
    if (conversationId) args.push('--conversation', conversationId);

    let child;
    try {
      child = spawn(command, args, { cwd, env: buildAgyEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return resolve({ error: `Impossibile avviare ${command}: ${err.message}` });
    }

    let response = '';
    let newConversationId = conversationId || null;
    let status = null;
    let stderrBuf = '';
    let gotResult = false;

    const timer = setTimeout(() => {
      stderrBuf += `\nTimeout dopo ${Math.round(AGY_TIMEOUT_MS / 1000)}s.`;
      try { child.kill('SIGTERM'); } catch (e) {}
    }, AGY_TIMEOUT_MS);

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let ev;
      try { ev = JSON.parse(line); } catch (e) { return; }

      if (ev.event === 'init' && ev.conversation_id) {
        newConversationId = ev.conversation_id;
      } else if (ev.event === 'step_update' && ev.step_update && ev.step_update.step_type === 'agent_response') {
        if (ev.step_update.text_delta) response += ev.step_update.text_delta;
      } else if (ev.event === 'result' && ev.result) {
        gotResult = true;
        if (ev.result.conversation_id) newConversationId = ev.result.conversation_id;
        if (!response.trim() && ev.result.response) response = ev.result.response;
        if (ev.result.status && ev.result.status !== 'SUCCESS') status = ev.result.status;
      }
    });

    child.stderr.on('data', (d) => { stderrBuf += d.toString(); if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (!gotResult && !response.trim()) {
        return resolve({ error: (stderrBuf.trim() || `agy terminato con codice ${code}`).split('\n').slice(0, 6).join(' ') });
      }
      if (status) return resolve({ error: 'Stato: ' + status, response, conversationId: newConversationId });
      resolve({ response: response.trim(), conversationId: newConversationId });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ error: err.message });
    });
  });
}

// ── estrazione testo semplice da HTML per le fonti URL (nessuna dipendenza nuova) ──
async function fetchUrlAsText(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' su ' + url);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : url;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|p|div|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  return { title, text: `Fonte: ${url}\n\n${text}` };
}

// ── template Studio: si chiede ad agy di SCRIVERE il file, non di rispondere in chat ──
const STUDIO_TYPES = {
  report: {
    ext: 'md',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro la cartella "${srcRel}" (ignora eventuali sottocartelle non pertinenti). Scrivi un report professionale in italiano, formato Markdown, che riassuma i temi principali, i punti chiave e le conclusioni rilevabili SOLO da quei file (non aggiungere conoscenza esterna). Usa titoli, sezioni e un elenco puntato dove utile. Salva il risultato ESATTAMENTE nel file "${outRel}" (sovrascrivilo se esiste già). Non modificare nessun altro file. Al termine rispondi solo "Fatto."`
  },
  quiz: {
    ext: 'md',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro "${srcRel}". Genera un quiz di 8 domande a risposta multipla (4 opzioni ciascuna, una sola corretta) basato ESCLUSIVAMENTE sul contenuto di quei file. Formato Markdown: per ogni domanda numerata, le 4 opzioni come elenco puntato (a, b, c, d), poi una riga "**Risposta corretta:** lettera" e una breve spiegazione. Scrivi il risultato ESATTAMENTE nel file "${outRel}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
  },
  flashcards: {
    ext: 'md',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro "${srcRel}". Genera 12 flashcard (domanda/risposta breve) sui concetti chiave, basate ESCLUSIVAMENTE su quel contenuto. Formato Markdown: per ognuna, "**Fronte:** ..." seguito da "**Retro:** ...", separate da una riga vuota. Scrivi il risultato ESATTAMENTE nel file "${outRel}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
  },
  mindmap: {
    ext: 'md',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro "${srcRel}". Costruisci una mappa mentale dei concetti principali e delle loro relazioni, basata ESCLUSIVAMENTE su quel contenuto, in sintassi Mermaid "mindmap" (radice = argomento centrale, rami = temi, foglie = dettagli; usa indentazione a 2 spazi come richiede Mermaid). Scrivi ESATTAMENTE questo, niente altro testo, nel file "${outRel}" (sovrascrivilo se esiste):\n\`\`\`mermaid\nmindmap\n  root((Argomento))\n    ...\n\`\`\`\nNon modificare altri file. Al termine rispondi solo "Fatto."`
  },
  datatable: {
    ext: 'md',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro "${srcRel}". Organizza le informazioni chiave (fatti, dati, cifre, nomi, date — qualunque cosa sia strutturabile) in una tabella Markdown con colonne sensate basate ESCLUSIVAMENTE su quel contenuto. Se non ci sono dati chiaramente tabellari, estrai comunque i concetti principali in righe con colonne "Argomento" e "Dettaglio". Scrivi il risultato ESATTAMENTE nel file "${outRel}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
  }
};

function studioPromptFor(kind, sourcesDirAbs, workspace, outRel) {
  const t = STUDIO_TYPES[kind];
  if (!t) return null;
  const srcRel = path.relative(workspace, sourcesDirAbs).replace(/\\/g, '/');
  return t.prompt(srcRel, outRel);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    const parts = pathname.split('/').filter(Boolean);
    const wantsBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = wantsBody ? await readJsonBody(req) : {};
    // Chiave "wspath", non "workspace": nel SaaS la richiesta passa anche dal
    // gateway, che usa GIA' un parametro "workspace" (uno slug per instradare
    // al container giusto) - chiamandolo uguale il gateway lo intercettava prima
    // di arrivare qui. Vedi lo stesso commento in index.js.
    const workspace = resolveWorkspace(wantsBody ? body.wspath : searchParams.get('wspath'));

    // GET /health?workspace=... — verifica che il comando agy risponda
    if (req.method === 'GET' && pathname === '/health') {
      const command = process.env.CLI_COMMAND || 'agy';
      const { execFile } = require('node:child_process');
      return execFile(command, ['--version'], { env: buildAgyEnv(), timeout: 5000 }, (err, stdout) => {
        sendJson(res, 200, { available: !err, version: (stdout || '').trim().split('\n')[0] || null });
      });
    }

    if (!workspace) return sendJson(res, 400, { error: 'Ambiente/workspace non valido o non specificato' });
    const baseDir = path.join(workspace, NOTEBOOK_DIRNAME);
    await fsp.mkdir(baseDir, { recursive: true });

    // GET /notebooks
    if (req.method === 'GET' && pathname === '/notebooks') {
      const entries = await fsp.readdir(baseDir, { withFileTypes: true }).catch(() => []);
      const list = [];
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        try {
          const meta = JSON.parse(await fsp.readFile(path.join(baseDir, e.name, 'meta.json'), 'utf8'));
          list.push(meta);
        } catch (err) { /* cartella orfana senza meta.json: ignorata */ }
      }
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return sendJson(res, 200, list);
    }

    // POST /notebooks { title }
    if (req.method === 'POST' && pathname === '/notebooks') {
      const title = (body.title || '').trim();
      if (!title) return sendJson(res, 400, { error: 'Titolo obbligatorio' });
      const id = crypto.randomBytes(6).toString('hex');
      const dir = notebookDir(workspace, id);
      await fsp.mkdir(path.join(dir, 'sources'), { recursive: true });
      await fsp.mkdir(path.join(dir, 'studio'), { recursive: true });
      const meta = { id, title, createdAt: new Date().toISOString(), conversationId: null };
      await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
      return sendJson(res, 200, meta);
    }

    // Rotte sotto /notebooks/:id/...
    if (parts[0] === 'notebooks' && parts[1]) {
      const id = safeId(parts[1]);
      if (!id) return sendJson(res, 400, { error: 'Id notebook non valido' });
      const dir = notebookDir(workspace, id);
      const metaPath = path.join(dir, 'meta.json');
      if (!fs.existsSync(metaPath)) return sendJson(res, 404, { error: 'Notebook non trovato' });
      const readMeta = async () => JSON.parse(await fsp.readFile(metaPath, 'utf8'));
      const writeMeta = async (m) => fsp.writeFile(metaPath, JSON.stringify(m, null, 2));

      // DELETE /notebooks/:id
      if (req.method === 'DELETE' && parts.length === 2) {
        await fsp.rm(dir, { recursive: true, force: true });
        return sendJson(res, 200, { success: true });
      }

      const sourcesDir = path.join(dir, 'sources');
      const studioDir = path.join(dir, 'studio');

      // GET /notebooks/:id/sources
      if (req.method === 'GET' && parts.length === 3 && parts[2] === 'sources') {
        const entries = await fsp.readdir(sourcesDir, { withFileTypes: true }).catch(() => []);
        const list = await Promise.all(entries.filter((e) => e.isFile()).map(async (e) => {
          const st = await fsp.stat(path.join(sourcesDir, e.name));
          return { name: e.name, size: st.size, mtime: st.mtimeMs };
        }));
        list.sort((a, b) => a.mtime - b.mtime);
        return sendJson(res, 200, list);
      }

      // POST /notebooks/:id/sources { url } | { text, title } | { fileName, fileData }
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'sources') {
        try {
          if (body.url) {
            const { title, text } = await fetchUrlAsText(body.url);
            const name = safeFileName(title, 'pagina-web') + '-' + crypto.randomBytes(3).toString('hex') + '.txt';
            await fsp.writeFile(path.join(sourcesDir, name), text, 'utf8');
            return sendJson(res, 200, { name });
          }
          if (body.text) {
            const name = safeFileName(body.title || 'nota', 'nota') + '-' + crypto.randomBytes(3).toString('hex') + '.txt';
            await fsp.writeFile(path.join(sourcesDir, name), body.text, 'utf8');
            return sendJson(res, 200, { name });
          }
          if (body.fileName && body.fileData) {
            const name = crypto.randomBytes(3).toString('hex') + '-' + safeFileName(body.fileName);
            await fsp.writeFile(path.join(sourcesDir, name), Buffer.from(body.fileData, 'base64'));
            return sendJson(res, 200, { name });
          }
          return sendJson(res, 400, { error: 'Serve url, text o un file' });
        } catch (e) {
          return sendJson(res, 502, { error: e.message });
        }
      }

      // DELETE /notebooks/:id/sources/:name
      if (req.method === 'DELETE' && parts.length === 4 && parts[2] === 'sources') {
        const name = safeFileName(decodeURIComponent(parts[3]));
        await fsp.unlink(path.join(sourcesDir, name)).catch(() => {});
        return sendJson(res, 200, { success: true });
      }

      // GET /notebooks/:id/chat
      if (req.method === 'GET' && parts.length === 3 && parts[2] === 'chat') {
        const chatPath = path.join(dir, 'chat.json');
        const log = fs.existsSync(chatPath) ? JSON.parse(await fsp.readFile(chatPath, 'utf8')) : [];
        return sendJson(res, 200, log);
      }

      // POST /notebooks/:id/query { question }
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'query') {
        const question = (body.question || '').trim();
        if (!question) return sendJson(res, 400, { error: 'Domanda obbligatoria' });

        const sourceFiles = await fsp.readdir(sourcesDir).catch(() => []);
        if (!sourceFiles.length) return sendJson(res, 400, { error: 'Aggiungi almeno una fonte prima di fare domande' });

        const meta = await readMeta();
        const srcRel = path.relative(workspace, sourcesDir).replace(/\\/g, '/');
        const isFirst = !meta.conversationId;
        const prompt = isFirst
          ? `Da questo momento sei l'assistente di ricerca di un notebook. Rispondi SEMPRE usando esclusivamente il contenuto dei file nella cartella "${srcRel}" (fonti: ${sourceFiles.join(', ')}), mai conoscenza esterna, a meno che le fonti stesse non ci rimandino esplicitamente. Se l'informazione richiesta non è nelle fonti, dillo chiaramente invece di inventare. Rispondi in italiano, in modo diretto, senza premesse superflue.\n\nDomanda: ${question}`
          : question;

        const result = await runAgy(prompt, { cwd: workspace, conversationId: meta.conversationId });
        if (result.error && !result.response) return sendJson(res, 502, { error: result.error });

        if (result.conversationId && result.conversationId !== meta.conversationId) {
          meta.conversationId = result.conversationId;
          await writeMeta(meta);
        }

        const chatPath = path.join(dir, 'chat.json');
        const log = fs.existsSync(chatPath) ? JSON.parse(await fsp.readFile(chatPath, 'utf8')) : [];
        log.push({ role: 'q', text: question, ts: Date.now() });
        log.push({ role: 'a', text: result.response, ts: Date.now() });
        await fsp.writeFile(chatPath, JSON.stringify(log.slice(-200), null, 2));

        return sendJson(res, 200, { answer: result.response });
      }

      // GET /notebooks/:id/studio
      if (req.method === 'GET' && parts.length === 3 && parts[2] === 'studio') {
        const entries = await fsp.readdir(studioDir, { withFileTypes: true }).catch(() => []);
        const list = await Promise.all(entries.filter((e) => e.isFile()).map(async (e) => {
          const st = await fsp.stat(path.join(studioDir, e.name));
          const kind = e.name.split('-')[0];
          return { name: e.name, kind, size: st.size, mtime: st.mtimeMs };
        }));
        list.sort((a, b) => b.mtime - a.mtime);
        return sendJson(res, 200, list);
      }

      // POST /notebooks/:id/studio { kind }
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'studio') {
        const kind = body.kind;
        const type = STUDIO_TYPES[kind];
        if (!type) return sendJson(res, 400, { error: 'Tipo non valido' });

        const sourceFiles = await fsp.readdir(sourcesDir).catch(() => []);
        if (!sourceFiles.length) return sendJson(res, 400, { error: 'Aggiungi almeno una fonte prima di generare contenuti' });

        const outName = `${kind}-${tsStamp()}.${type.ext}`;
        const outAbs = path.join(studioDir, outName);
        const outRel = path.relative(workspace, outAbs).replace(/\\/g, '/');
        const prompt = studioPromptFor(kind, sourcesDir, workspace, outRel);

        const result = await runAgy(prompt, { cwd: workspace });
        if (result.error && !fs.existsSync(outAbs)) return sendJson(res, 502, { error: result.error });
        if (!fs.existsSync(outAbs)) return sendJson(res, 502, { error: 'agy non ha scritto il file atteso' });

        return sendJson(res, 200, { name: outName });
      }

      // GET /notebooks/:id/studio/:name/content — testo grezzo per il rendering
      if (req.method === 'GET' && parts.length === 5 && parts[2] === 'studio' && parts[4] === 'content') {
        const name = safeFileName(decodeURIComponent(parts[3]));
        const filePath = path.join(studioDir, name);
        if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'File non trovato' });
        const content = await fsp.readFile(filePath, 'utf8');
        return sendJson(res, 200, { name, content });
      }

      // DELETE /notebooks/:id/studio/:name
      if (req.method === 'DELETE' && parts.length === 4 && parts[2] === 'studio') {
        const name = safeFileName(decodeURIComponent(parts[3]));
        await fsp.unlink(path.join(studioDir, name)).catch(() => {});
        return sendJson(res, 200, { success: true });
      }
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
