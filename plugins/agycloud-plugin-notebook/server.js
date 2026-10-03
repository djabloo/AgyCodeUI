/**
 * AgyCloud Notebook — notebook di ricerca nativo, motore "agy" (Google Antigravity).
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

function runPython(scriptPath, args, { env, timeoutMs = 600000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: env || process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timeout durante la generazione audio (${Math.round(timeoutMs / 1000)}s)`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      // codice 2 = errore vocale gia' spiegato in una riga (chiave, credito, voce)
      else if (code === 2 && stderr.trim()) reject(new Error(stderr.trim().split('\n').pop()));
      else reject(new Error(stderr || stdout || `Processo python terminato con codice ${code}`));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── impostazioni voci (Edge gratuito / ElevenLabs con la chiave dell'utente) ──
// Fuori dal workspace di proposito: il workspace puo' finire in git o essere
// condiviso, la chiave no. In SaaS la home del container e' persistente
// (/home/developer), quindi la chiave sopravvive ai riavvii dell'ambiente.
const SETTINGS_PATH = path.join(os.homedir(), '.config', 'agycloud', 'notebook.json');
const ELEVEN_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_v3'];
const VOICE_ID_RE = /^[a-zA-Z0-9]{10,40}$/;

function readSettings() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch (e) { /* prima volta */ }
  const el = s.elevenlabs || {};
  return {
    provider: s.provider === 'elevenlabs' ? 'elevenlabs' : 'edge',
    elevenlabs: {
      apiKey: el.apiKey || '',
      model: ELEVEN_MODELS.includes(el.model) ? el.model : 'eleven_multilingual_v2',
      voiceA: el.voiceA || '',
      voiceB: el.voiceB || '',
      voiceAName: el.voiceAName || '',
      voiceBName: el.voiceBName || ''
    }
  };
}

async function writeSettings(s) {
  await fsp.mkdir(path.dirname(SETTINGS_PATH), { recursive: true, mode: 0o700 });
  await fsp.writeFile(SETTINGS_PATH, JSON.stringify(s, null, 2), { mode: 0o600 });
  await fsp.chmod(SETTINGS_PATH, 0o600).catch(() => {});
}

// Chiave effettiva: quella salvata dall'utente, altrimenti ELEVENLABS_API_KEY
// dell'ambiente (utile in self-hosted, impostata nel .env).
function elevenKey(s) {
  if (s.elevenlabs.apiKey) return { key: s.elevenlabs.apiKey, source: 'settings' };
  if (process.env.ELEVENLABS_API_KEY) return { key: process.env.ELEVENLABS_API_KEY, source: 'env' };
  return { key: '', source: null };
}

function publicSettings(s) {
  const { key, source } = elevenKey(s);
  return {
    provider: s.provider,
    elevenlabs: {
      hasKey: !!key,
      keySource: source,
      keyHint: key ? '…' + key.slice(-4) : '',
      model: s.elevenlabs.model,
      models: ELEVEN_MODELS,
      voiceA: s.elevenlabs.voiceA,
      voiceB: s.elevenlabs.voiceB,
      voiceAName: s.elevenlabs.voiceAName,
      voiceBName: s.elevenlabs.voiceBName
    }
  };
}

async function elevenFetch(key, apiPath) {
  const r = await fetch('https://api.elevenlabs.io' + apiPath, {
    headers: { 'xi-api-key': key, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = data && data.detail;
    const msg = (d && (d.message || (typeof d === 'string' ? d : ''))) || ('HTTP ' + r.status);
    const code = d && typeof d === 'object' ? d.status : '';
    const err = new Error(code === 'missing_permissions'
      ? 'La chiave ElevenLabs non ha il permesso per questa operazione (' + msg + ')'
      : r.status === 401 ? 'Chiave ElevenLabs non valida' : 'ElevenLabs: ' + msg);
    err.status = r.status;
    err.code = code;
    throw err;
  }
  return data;
}

// Ambiente del processo python per la sintesi: provider scelto + chiave/voci.
function ttsEnv(requested) {
  const s = readSettings();
  const provider = requested === 'elevenlabs' || requested === 'edge' ? requested : s.provider;
  const env = { ...process.env, NOTEBOOK_TTS_PROVIDER: provider };
  if (provider === 'elevenlabs') {
    const { key } = elevenKey(s);
    if (!key) throw new Error('Per le voci ElevenLabs inserisci prima la tua chiave in Studio → Voci.');
    env.ELEVENLABS_API_KEY = key;
    env.ELEVENLABS_MODEL = s.elevenlabs.model;
    if (s.elevenlabs.voiceA) env.ELEVENLABS_VOICE_A = s.elevenlabs.voiceA;
    if (s.elevenlabs.voiceB) env.ELEVENLABS_VOICE_B = s.elevenlabs.voiceB;
  }
  return env;
}


// ── estrazione testo semplice da HTML per le fonti URL (nessuna dipendenza nuova) ──
// youtube.com/watch, youtu.be/, youtube.com/shorts, m.youtube.com: pagine SPA
// pesantemente lato-client, il semplice fetch+strip-tag qui sotto recupera solo
// il guscio HTML iniziale (cookie banner, nav, JSON-LD) e non il contenuto del
// video - producendo una fonte "riempita" di rumore invece che di contenuto
// utile. Per questi URL si delega ad agy (che ha capacita' reali di
// navigazione web) il compito di aprire il video e riassumerne il contenuto.
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i;

async function fetchYoutubeAsText(url, workspace) {
  const prompt = `Usa le tue capacità di navigazione web per aprire questo video YouTube: ${url}\n` +
    `Scrivi in italiano, in questo ordine: il titolo del video, il canale, poi un riassunto dettagliato ` +
    `del contenuto (usa la trascrizione/i sottotitoli se riesci a recuperarli, altrimenti la descrizione ` +
    `e le informazioni disponibili sulla pagina). Rispondi SOLO con questo testo, senza premesse, ` +
    `commenti aggiuntivi o markdown decorativo.`;
  const result = await runAgy(prompt, { cwd: workspace });
  if (result.error) throw new Error(result.error);
  const text = (result.response || '').trim();
  if (!text) throw new Error('agy non è riuscito a recuperare il contenuto del video');
  const title = text.split('\n')[0].replace(/^#+\s*/, '').replace(/^titolo:\s*/i, '').trim().slice(0, 90) || 'Video YouTube';
  return { title, text: `Fonte (video YouTube): ${url}\n\n${text}` };
}

async function fetchUrlAsText(url, workspace) {
  if (YOUTUBE_RE.test(url)) return fetchYoutubeAsText(url, workspace);

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
  audio_overview: {
    ext: 'html',
    json: true,
    jsonKey: 'dialogue',
    script: 'generate_audio_overview.py',
    prompt: (srcRel, jsonAbs) => `Leggi attentamente tutti i file dentro "${srcRel}". Genera un copione per un episodio podcast "Audio Overview" a 2 voci (Diego ed Elsa) in italiano, brillante, approfondito e colloquiale, che discuta i punti chiave, i concetti e le implicazioni emersi ESCLUSIVAMENTE da quelle fonti.
Scrivi ESATTAMENTE e SOLO un file JSON valido nel percorso assoluto "${jsonAbs}" con questa identica struttura:
{
  "title": "Titolo accattivante dell'episodio",
  "subtitle": "Breve sintesi dei temi trattati",
  "takeaways": [
    "Punto chiave 1 estratto dai documenti",
    "Punto chiave 2 estratto dai documenti",
    "Punto chiave 3 estratto dai documenti",
    "Punto chiave 4 estratto dai documenti"
  ],
  "dialogue": [
    {"speaker": "Diego", "text": "Benvenuti a questo episodio! Oggi analizziamo..."},
    {"speaker": "Elsa", "text": "Ciao Diego! Esatto, i documenti evidenziano..."},
    {"speaker": "Diego", "text": "..."},
    {"speaker": "Elsa", "text": "..."}
  ]
}
Il dialogo deve essere un confronto fluido, intelligente ed esaustivo, con 10-14 battute alternate tra Diego ed Elsa (in italiano naturale e chiaro).
Salva il JSON ESATTAMENTE nel file "${jsonAbs}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
  },
  report: {
    ext: 'md',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro la cartella "${srcRel}" (ignora eventuali sottocartelle non pertinenti). Scrivi un report professionale in italiano, formato Markdown, che riassuma i temi principali, i punti chiave e le conclusioni rilevabili SOLO da quei file (non aggiungere conoscenza esterna). Usa titoli, sezioni e un elenco puntato dove utile. Salva il risultato ESATTAMENTE nel file "${outRel}" (sovrascrivilo se esiste già). Non modificare nessun altro file. Al termine rispondi solo "Fatto."`
  },
  infographic: {
    ext: 'html',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro "${srcRel}". Genera un'infografica esecutiva, visiva e professionale basata ESCLUSIVAMENTE su quel contenuto.
Il formato deve essere un singolo file HTML5 completo e autonomo, con CSS moderno incorporato in un tag <style> (nessuna dipendenza esterna obbligatoria) e layout responsive.
L'infografica deve includere:
1. Header accattivante con Titolo, Sottotitolo e badge tematico.
2. Griglia di 3-4 KPI o metriche chiave in evidenza (valori grandi, percentuali o numeri rilevanti estratti dalle fonti).
3. Sezione concettuale a card o comparativa (es. Problema vs Soluzione, oppure i Pilastri Chiave con icone SVG inline).
4. Pipeline o Flusso a step (sequenza logica/operativa a blocchi con frecce o numerazione).
5. Sezione "Takeaways / Sintesi Strategica" (card riassuntive).
6. Stile CSS curato: palette scura elegante o neutra pulita, tipografia leggibile, card con bordi sottili e contrasti marcati, e regole @media print per una stampa/salvataggio PDF perfetta.
Salva il file ESATTAMENTE in "${outRel}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
  },
  presentation: {
    ext: 'html',
    prompt: (srcRel, outRel) => `Leggi tutti i file dentro "${srcRel}". Genera una presentazione professionale di diapositive (slide deck di 7-10 slide) basata ESCLUSIVAMENTE su quel contenuto.
Il formato deve essere un singolo file HTML5 completo e autonomo, con CSS e JavaScript vanilla incorporati (nessuna dipendenza esterna obbligatoria).
La presentazione deve includere:
1. Struttura delle slide:
   - Slide 1: Copertina con Titolo, Sottotitolo e contesto.
   - Slide 2: Agenda dei temi principali.
   - Slide 3-7: Slide di contenuto tematiche (es. Il Problema, La Soluzione, Dati & Metriche con card numeriche, Architettura/Processo a step, Casi studio).
   - Slide 8: Conclusioni e Key Takeaways strategici.
   - Slide 9: Slide di chiusura / Q&A.
2. Controlli e navigazione slide:
   - Navigazione con frecce da tastiera (Freccia destra/spazio = avanti, freccia sinistra = indietro).
   - Pulsanti visivi a schermo "← Precedente" e "Successiva →", contatore slide (es. "Slide 3 / 9") e barra di avanzamento.
   - Tasto "F" per attivare o disattivare la modalità schermo intero (fullscreen).
3. Stile visivo:
   - Formato 16:9 con centratura fluida, tema scuro moderno ed elegante (#0D1219, contrasti elevati, accenti ciano/ambra/viola), card ben spaziate.
   - Regole @media print per stampare o salvare tutte le slide in un unico PDF (una slide per pagina, page-break-after: always; break-after: page).
Salva il file ESATTAMENTE in "${outRel}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
  },
  video_presentation: {
    ext: 'html',
    json: true,
    jsonKey: 'slides',
    script: 'generate_video_presentation.py',
    prompt: (srcRel, jsonAbs) => `Leggi attentamente tutti i file dentro "${srcRel}". Prepara un video narrato di 7-9 slide in italiano che spieghi in modo chiaro e coinvolgente i contenuti di quelle fonti, ESCLUSIVAMENTE sulla base di esse.
Per ogni slide scrivi il testo visibile (breve, da slide) e il parlato del narratore (frasi naturali da ascoltare, 50-90 parole, che spiegano e collegano i punti invece di leggerli; niente elenchi, niente markdown, niente emoji, numeri scritti in modo pronunciabile).
Scrivi ESATTAMENTE e SOLO un file JSON valido nel percorso assoluto "${jsonAbs}" con questa struttura:
{
  "title": "Titolo del video",
  "subtitle": "Sottotitolo breve",
  "slides": [
    {"layout": "cover", "title": "...", "subtitle": "...", "narration": "..."},
    {"layout": "bullets", "title": "...", "bullets": ["max 5 punti brevi"], "narration": "..."},
    {"layout": "kpis", "title": "...", "kpis": [{"value": "42%", "label": "cosa misura"}], "narration": "..."},
    {"layout": "steps", "title": "...", "steps": ["passo 1", "passo 2", "passo 3"], "narration": "..."},
    {"layout": "quote", "title": "...", "quote": "frase chiave dalle fonti", "narration": "..."},
    {"layout": "closing", "title": "In sintesi", "bullets": ["..."], "narration": "..."}
  ]
}
Layout disponibili: cover (solo la prima), bullets, kpis (2-4 valori numerici REALI presi dalle fonti; se non ci sono numeri non usarlo), steps (3-5 passi), quote, closing (solo l'ultima). Varia i layout in base al contenuto.
Salva il JSON ESATTAMENTE nel file "${jsonAbs}" (sovrascrivilo se esiste). Non modificare altri file. Al termine rispondi solo "Fatto."`
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

function studioPromptFor(kind, sourcesDirAbs, outAbs) {
  const t = STUDIO_TYPES[kind];
  if (!t) return null;
  // Percorsi ASSOLUTI, non relativi al workspace: agy mantiene una propria idea
  // interna di "cartella corrente" che puo' andare alla deriva durante una
  // conversazione lunga (osservato: finisce per puntare dentro la sua stessa
  // cartella di configurazione ~/.gemini/antigravity-cli, bloccata da una
  // regola di sicurezza hardcoded) - un percorso relativo si spezza in quel
  // caso, uno assoluto no. Vedi lo stesso ragionamento nel prompt di /query.
  return t.prompt(sourcesDirAbs, outAbs);
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

    // GET /settings — impostazioni voci (la chiave non esce mai: solo le ultime 4 cifre)
    if (req.method === 'GET' && pathname === '/settings') {
      return sendJson(res, 200, publicSettings(readSettings()));
    }

    // POST /settings { provider?, elevenlabsKey?, model?, voiceA?, voiceB?, voiceAName?, voiceBName? }
    // elevenlabsKey: stringa nuova = salva (dopo verifica), "" = rimuovi, assente = invariata.
    if (req.method === 'POST' && pathname === '/settings') {
      const s = readSettings();
      if (body.provider === 'edge' || body.provider === 'elevenlabs') s.provider = body.provider;
      if (typeof body.elevenlabsKey === 'string') {
        const k = body.elevenlabsKey.trim();
        if (k) {
          if (!/^[A-Za-z0-9_-]{20,128}$/.test(k)) return sendJson(res, 400, { error: 'Formato chiave ElevenLabs non valido' });
          // Verifica subito la chiave. Una chiave con permessi ristretti (solo
          // sintesi, senza lettura voci) e' valida: si accetta lo stesso.
          try { await elevenFetch(k, '/v1/voices'); } catch (e) {
            if (e.code !== 'missing_permissions') return sendJson(res, 400, { error: e.message });
          }
        }
        s.elevenlabs.apiKey = k;
      }
      if (ELEVEN_MODELS.includes(body.model)) s.elevenlabs.model = body.model;
      for (const slot of ['voiceA', 'voiceB']) {
        if (typeof body[slot] === 'string') {
          const v = body[slot].trim();
          if (v && !VOICE_ID_RE.test(v)) return sendJson(res, 400, { error: 'Id voce non valido' });
          s.elevenlabs[slot] = v;
          const nameKey = slot + 'Name';
          s.elevenlabs[nameKey] = v ? String(body[nameKey] || '').slice(0, 80) : '';
        }
      }
      if (s.provider === 'elevenlabs' && !elevenKey(s).key) {
        return sendJson(res, 400, { error: 'Inserisci la chiave ElevenLabs prima di sceglierlo come motore' });
      }
      await writeSettings(s);
      return sendJson(res, 200, publicSettings(s));
    }

    // GET /elevenlabs/voices — libreria voci dell'account + caratteri residui del mese
    if (req.method === 'GET' && pathname === '/elevenlabs/voices') {
      const { key } = elevenKey(readSettings());
      if (!key) return sendJson(res, 400, { error: 'Chiave ElevenLabs non impostata' });
      try {
        const data = await elevenFetch(key, '/v1/voices');
        const voices = (data.voices || []).map((v) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category || '',
          labels: v.labels || {},
          preview: v.preview_url || ''
        })).sort((a, b) => a.name.localeCompare(b.name));
        let quota = null;
        // Serve il permesso user_read sulla chiave: se manca, niente contatore.
        try {
          const sub = await elevenFetch(key, '/v1/user/subscription');
          quota = { used: sub.character_count, limit: sub.character_limit, tier: sub.tier, resetAt: sub.next_character_count_reset_unix };
        } catch (e) { /* facoltativo */ }
        return sendJson(res, 200, { voices, quota });
      } catch (e) {
        return sendJson(res, 502, { error: e.message });
      }
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
            const { title, text } = await fetchUrlAsText(body.url, workspace);
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

      // GET /notebooks/:id/sources/:name/content — testo grezzo per la preview
      if (req.method === 'GET' && parts.length === 5 && parts[2] === 'sources' && parts[4] === 'content') {
        const name = safeFileName(decodeURIComponent(parts[3]));
        const filePath = path.join(sourcesDir, name);
        if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'File non trovato' });
        const content = await fsp.readFile(filePath, 'utf8');
        return sendJson(res, 200, { name, content });
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
        const isFirst = !meta.conversationId;
        // Percorso ASSOLUTO, non relativo al workspace: durante una conversazione
        // lunga agy puo' perdere l'ancoraggio alla cartella di lavoro iniziale
        // (osservato in produzione: un percorso relativo come ".agy-notebook/id/sources"
        // veniva risolto dentro ~/.gemini/antigravity-cli invece che nel workspace,
        // bloccato poi da una regola di sicurezza hardcoded che protegge quella
        // cartella). Un percorso assoluto non dipende da quello stato interno.
        const prompt = isFirst
          ? `Da questo momento sei l'assistente di ricerca di un notebook. Rispondi SEMPRE usando esclusivamente il contenuto dei file nella cartella "${sourcesDir}" (fonti: ${sourceFiles.join(', ')}), mai conoscenza esterna, a meno che le fonti stesse non ci rimandino esplicitamente. Se l'informazione richiesta non è nelle fonti, dillo chiaramente invece di inventare. Rispondi in italiano, in modo diretto, senza premesse superflue.\n\nDomanda: ${question}`
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

        // Tipi con voce (Overview Audio, Video narrato): agy scrive un JSON,
        // poi lo script python sintetizza le voci e impagina l'HTML finale.
        if (type.json) {
          // Motore vocale verificato PRIMA di far lavorare agy per minuti:
          // senza chiave ElevenLabs si fallisce subito, non a copione pronto.
          let env;
          try { env = ttsEnv(body.provider); } catch (e) { return sendJson(res, 400, { error: e.message }); }

          const jsonPath = path.join(studioDir, `.temp-${kind}-${tsStamp()}.json`);
          const prompt = type.prompt(sourcesDir, jsonPath);

          const result = await runAgy(prompt, { cwd: workspace });

          let jsonData = null;
          if (fs.existsSync(jsonPath)) {
            try {
              const raw = await fsp.readFile(jsonPath, 'utf8');
              jsonData = JSON.parse(raw);
            } catch (e) {
              console.error('Errore lettura JSON copione:', e);
            }
          }

          // Se agy ha restituito il JSON direttamente nella risposta invece che nel file
          if (!jsonData && result.response) {
            const m = result.response.match(new RegExp('\\{[\\s\\S]*"' + type.jsonKey + '"[\\s\\S]*\\}'));
            if (m) {
              try {
                jsonData = JSON.parse(m[0]);
                await fsp.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
              } catch (e) {}
            }
          }

          if (!jsonData || !Array.isArray(jsonData[type.jsonKey]) || !jsonData[type.jsonKey].length) {
            await fsp.unlink(jsonPath).catch(() => {});
            return sendJson(res, 502, { error: result.error || 'agy non ha generato il copione' });
          }

          const scriptPath = path.join(__dirname, 'scripts', type.script);
          try {
            await runPython(scriptPath, [jsonPath, outAbs], { env });
          } catch (pyErr) {
            await fsp.unlink(jsonPath).catch(() => {});
            return sendJson(res, 500, { error: 'Errore durante la sintesi audio: ' + pyErr.message });
          }

          await fsp.unlink(jsonPath).catch(() => {});

          if (!fs.existsSync(outAbs)) {
            return sendJson(res, 502, { error: 'Sintesi completata ma il file finale non è presente' });
          }

          return sendJson(res, 200, { name: outName, provider: env.NOTEBOOK_TTS_PROVIDER });
        }

        const prompt = studioPromptFor(kind, sourcesDir, outAbs);
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
