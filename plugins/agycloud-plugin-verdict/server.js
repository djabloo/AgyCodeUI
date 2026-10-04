/**
 * AgyCloud Plugin: agy-verdict — verdetti e decisioni tipizzate con probabilità reali.
 *
 * Calcola le probabilità (logprobs) dell'unico token generato su scelte a lettere
 * (A, B, C...) a zero token generati. Esegue su OpenRouter o modello locale via BYOK.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const OPENROUTER_API = 'https://openrouter.ai/api/v1';

// Modelli verificati con supporto logprobs nativo per scelte multiple
const MODELS = [
  { id: 'mistralai/mistral-nemo', label: 'Mistral Nemo (12B)' },
  { id: 'qwen/qwen-2.5-7b-instruct', label: 'Qwen 2.5 (7B Instruct)' },
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 (8B)' },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', reasoningOff: true },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRST'; // top_logprobs arriva al massimo a 20
const MAX_QUESTIONS = 20;
const REQUEST_TIMEOUT_MS = 20000;
const AGY_TIMEOUT_MS = parseInt(process.env.VERDICT_AGY_TIMEOUT_MS || process.env.FLOW_AGY_TIMEOUT_MS || '180000', 10);

const apiKey = () => {
  try {
    const envPath = process.env.AGY_ENV_FILE || path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/^OPENROUTER_API_KEY=(.*)$/m);
      if (m && m[1]) return m[1].trim();
    }
  } catch (_) {}
  return (process.env.OPENROUTER_API_KEY || '').trim();
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── PRESETS DECISIONALI PRECONFIGURATI ──
const PRESETS = [
  {
    id: 'ticket',
    title: 'Assistenza Clienti & Ticket Triage',
    icon: '🎫',
    description: 'Classificazione priorità, coda dipartimento e urgenza da messaggi non strutturati.',
    state: {
      message: "Non riesco più ad accedere al mio account dopo aver resettato la password. Ho una consegna bloccata per un cliente entro stasera! Il pagamento dell'abbonamento annuale è andato a buon fine.",
      account: { subscription_active: true, plan: "growth", reset_attempts: 3 }
    },
    questions: {
      needs_access_support: {
        type: "boolean",
        instructions: "Il cliente ha bisogno di assistenza tecnica per l'accesso all'account?"
      },
      queue: {
        type: "choice",
        instructions: "A quale reparto di assistenza deve essere inoltrata questa richiesta?",
        options: [
          { id: "access_security", description: "Problemi di credenziali, login, 2FA o ripristino account." },
          { id: "billing", description: "Problemi relativi a fatture, rinnovi, carte o rimborsi." },
          { id: "product_support", description: "Domande su funzionalità o bug dell'applicazione." },
          { id: "sales", description: "Richieste commerciali o upgrade di licenza." }
        ]
      },
      urgency: {
        type: "score",
        instructions: "Quanto è critico il livello di urgenza della situazione per il cliente?",
        levels: [
          "Bassa: Nessuna scadenza ravvicinata e nessun lavoro bloccato.",
          "Media: Attività rallentata, ma esiste un workaround.",
          "Alta: Operatività completamente bloccata con scadenza entro poche ore."
        ]
      },
      deadline_hours: {
        type: "numeric",
        instructions: "Quante ore mancano alla scadenza indicata?",
        unit: "ore",
        anchors: [
          { value: 2, description: "Scadenza imminente entro 2 ore." },
          { value: 6, description: "Scadenza entro la giornata lavorativa (circa 6 ore)." },
          { value: 24, description: "Scadenza entro domani o oltre." }
        ]
      }
    }
  },
  {
    id: 'agent_router',
    title: 'Agent Workflow Router',
    icon: '⚡',
    description: 'Routing deterministico per indirizzare i task degli agenti AI verso le skill corrette.',
    state: {
      user_prompt: "Dobbiamo verificare le vulnerabilità di sicurezza del modulo di autenticazione JWT e aggiungere test di regressione prima di fare il deploy in produzione.",
      repo_context: { branch: "feature/jwt-auth", changed_files: 14, target_env: "production" }
    },
    questions: {
      target_specialist: {
        type: "choice",
        instructions: "Quale subagente o competenza specializzata deve prendere in carico questo task?",
        options: [
          { id: "security_auditor", description: "Audit sicurezza, analisi vulnerabilità, token e permessi." },
          { id: "test_engineer", description: "Creazione ed esecuzione di test unitari ed end-to-end." },
          { id: "devops_release", description: "Deployment, configurazione pipeline CI/CD e monitoraggio infra." },
          { id: "fullstack_coder", description: "Implementazione di nuove feature applicative generiche." }
        ]
      },
      requires_human_approval: {
        type: "boolean",
        instructions: "L'operazione coinvolge l'ambiente di produzione o modifiche critiche che richiedono approvazione umana?"
      },
      risk_level: {
        type: "score",
        instructions: "Valuta il livello di rischio dell'intervento sul sistema:",
        levels: [
          "Livello 1: Rischio minimo o nullo (documentazione, refactor isolato).",
          "Livello 2: Rischio moderato (nuovi endpoint, modifiche testate in staging).",
          "Livello 3: Rischio elevato (autenticazione, dati utente, deploy diretto prod)."
        ]
      }
    }
  },
  {
    id: 'code_review',
    title: 'Code Review & PR Verdict',
    icon: '🔍',
    description: 'Verdetto sintetico su pull request, complessità delle modifiche e requisiti di test.',
    state: {
      pr_diff: "@@ -45,6 +45,18 @@ async function authenticate(req, res) {\n+ const token = req.headers['authorization'];\n+ if (!token) return res.status(401).json({ error: 'No token' });\n+ const decoded = jwt.verify(token, process.env.SECRET);\n+ req.user = decoded;\n+ next();\n }",
      tests_included: false,
      files_touched: 2
    },
    questions: {
      verdict: {
        type: "choice",
        instructions: "Qual è il verdetto consigliato per questa Pull Request?",
        options: [
          { id: "approved", description: "Codice corretto, pulito e pronto per il merge immediato." },
          { id: "request_changes", description: "Mancano test obbligatori o ci sono problemi da correggere." },
          { id: "needs_discussion", description: "Approccio architetturale da discutere prima del merge." }
        ]
      },
      missing_tests: {
        type: "boolean",
        instructions: "La modifica manca di test automatizzati correlati?"
      },
      code_risk: {
        type: "score",
        instructions: "Gravità del rischio introdotto nel codice:",
        levels: [
          "Basso: Modifica cosmetica o commenti.",
          "Medio: Nuova logica con gestione errori di base.",
          "Critico: Modifiche di sicurezza o gestione token prive di test dedicati."
        ]
      }
    }
  },
  {
    id: 'content_moderation',
    title: 'Content & Safety Moderation',
    icon: '🛡️',
    description: 'Analisi policy, conformità e rilevamento contenuti indesiderati con logprobs.',
    state: {
      submitted_content: "Offerta imperdibile! Clicca subito qui per vincere un buono acquisto da 500€ senza fare nulla: http://fake-link-win-cash.xyz/claim",
      author_reputation: "new_account",
      ip_country: "unknown"
    },
    questions: {
      is_acceptable: {
        type: "boolean",
        instructions: "Il contenuto rispetta le linee guida ed è sicuro per la pubblicazione?"
      },
      flag_reason: {
        type: "choice",
        instructions: "Se il contenuto viola le policy, qual è la motivazione principale?",
        options: [
          { id: "none", description: "Nessuna violazione rilevata." },
          { id: "spam_phishing", description: "Link malevoli, truffe, phishing o spam promozionale ingannevole." },
          { id: "hate_speech", description: "Incitamento all'odio o molestie verso gruppi o individui." },
          { id: "inappropriate", description: "Contenuti espliciti o non pertinenti." }
        ]
      },
      confidence: {
        type: "score",
        instructions: "Livello di certezza della violazione:",
        levels: [
          "Basso / Inconcludente",
          "Probabile violazione",
          "Violazione palese e inequivocabile"
        ]
      }
    }
  },
  {
    id: 'snake_move',
    title: 'Snake AI Decision',
    icon: '🐍',
    description: 'Demo classica: prossima mossa del serpente, con la probabilità di ogni direzione.',
    // Coordinate esplicite {riga, colonna}: con coppie [a, b] senza convenzione
    // i modelli non sapevano se il cibo fosse davanti o di lato e davano
    // risposte opposte. Qui il cibo e' sulla stessa riga, 4 colonne avanti.
    state: {
      griglia: "16x16, coordinate {riga, colonna}, riga 0 in alto, colonna 0 a sinistra",
      testa: { riga: 7, colonna: 8 },
      direzione_attuale: "destra (verso colonne crescenti)",
      cibo: { riga: 7, colonna: 12 },
      ostacoli_adiacenti: { davanti: false, a_sinistra: false, a_destra: true }
    },
    questions: {
      next_move: {
        type: "choice",
        instructions: "Quale mossa avvicina il serpente al cibo senza andare contro un ostacolo?",
        options: [
          { id: "continue_straight", description: "Prosegui dritto, verso destra (colonna +1)." },
          { id: "turn_left", description: "Gira a sinistra, verso l'alto (riga -1)." },
          { id: "turn_right", description: "Gira a destra, verso il basso (riga +1)." }
        ]
      },
      straight_is_safe: {
        type: "boolean",
        instructions: "Proseguire dritto è sicuro, cioè non c'è un ostacolo subito davanti?"
      }
    }
  }
];

// ── Domande → opzioni a lettere ──
// Ogni tipo si riduce a una scelta: le "ancore" delle domande numeriche
// diventano le opzioni, cosi' anche li' si ottiene una distribuzione.
function optionsFor(q) {
  const type = q.type || 'boolean';
  if (type === 'boolean') {
    return [{ key: 'true', text: 'Sì / vero' }, { key: 'false', text: 'No / falso' }];
  }
  if (type === 'choice') {
    return (q.options || []).map((o) => ({ key: String(o.id), text: o.description ? `${o.id}: ${o.description}` : String(o.id) }));
  }
  if (type === 'score') {
    return (q.levels || []).map((l, i) => ({ key: String(i), text: String(l) }));
  }
  if (type === 'numeric') {
    return (q.anchors || []).map((a) => ({
      key: String(a.value),
      text: `${a.value}${q.unit ? ' ' + q.unit : ''}${a.description ? ': ' + a.description : ''}`,
    }));
  }
  return [];
}

function setTypedValue(ans, q, key) {
  const type = q.type || 'boolean';
  if (type === 'boolean') ans.value = key === 'true';
  else if (type === 'score') { ans.value = Number(key); ans.score = Number(key); }
  else if (type === 'numeric') { ans.value = Number(key); ans.unit = q.unit || ''; }
  else { ans.value = key; ans.choice = key; }
}

function buildMessages(stateStr, q, opts) {
  const lines = opts.map((o, i) => `${LETTERS[i]}) ${o.text}`);
  return [
    {
      role: 'system',
      content: 'Sei un motore decisionale. Valuta lo stato e rispondi alla domanda scegliendo UNA delle opzioni. Rispondi solo con la lettera dell\'opzione, senza nessun altro testo.',
    },
    {
      role: 'user',
      content: `Stato:\n${stateStr}\n\nDomanda: ${q.instructions || ''}\n\nOpzioni:\n${lines.join('\n')}\n\nRisposta (una sola lettera):`,
    },
  ];
}

class FlowError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function callOpenRouter(model, messages, nOpts) {
  const body = {
    model: model.id,
    messages,
    max_tokens: 1,
    temperature: 0,
    logprobs: true,
    top_logprobs: 20,
    // Solo provider che restituiscono davvero i logprobs: senza, OpenRouter
    // puo' instradare su un provider che li ignora in silenzio.
    provider: { require_parameters: true },
  };
  // Da mandare SOLO ai modelli ragionanti: sugli altri il parametro fa fallire
  // la ricerca di un provider compatibile ("No endpoints found").
  if (model.reasoningOff) body.reasoning = { enabled: false };

  const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}`, 'X-Title': 'agy-verdict' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* risposta non JSON */ }
  if (!res.ok || !data || data.error) {
    const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    throw new FlowError(msg, res.status);
  }

  const first = data.choices && data.choices[0] && data.choices[0].logprobs
    && data.choices[0].logprobs.content && data.choices[0].logprobs.content[0];
  const top = first && first.top_logprobs;
  if (!top || !top.length) throw new FlowError('il provider non ha restituito le probabilità', 502);

  const mass = new Array(nOpts).fill(0);
  for (const t of top) {
    const tok = String(t.token || '').trim().replace(/[).:\]]+$/, '').toUpperCase();
    if (tok.length !== 1) continue;
    const idx = LETTERS.indexOf(tok);
    if (idx >= 0 && idx < nOpts) mass[idx] += Math.exp(t.logprob);
  }
  return { mass, usage: data.usage || {} };
}

function buildAnswer(q, opts, mass, usage, modelId) {
  const coverage = mass.reduce((a, b) => a + b, 0);
  const probs = mass.map((m) => m / coverage);
  const probabilities = {};
  opts.forEach((o, i) => { probabilities[o.key] = +probs[i].toFixed(4); });

  const ranked = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const best = ranked[0];
  const second = ranked.length > 1 ? probs[ranked[1]] : 0;
  const entropy = -probs.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);

  const ans = {
    type: q.type || 'boolean',
    // coverage = quota di probabilita' finita su lettere valide: se e' bassa il
    // modello voleva rispondere altro e la distribuzione e' poco affidabile.
    status: coverage < 0.5 ? 'low_coverage' : 'ok',
    probabilities,
    uncertainty: { margin: +(probs[best] - second).toFixed(3), entropy: +entropy.toFixed(3), coverage: +coverage.toFixed(3) },
    input_tokens: usage.prompt_tokens || null,
    model: modelId,
  };
  setTypedValue(ans, q, opts[best].key);
  if ((q.type || 'boolean') === 'numeric') {
    ans.expected = +opts.reduce((s, o, i) => s + Number(o.key) * probs[i], 0).toFixed(2);
  }
  return ans;
}

async function decideQuestion(stateStr, q, preferredModelId) {
  const type = q.type || 'boolean';
  const opts = optionsFor(q);
  if (opts.length < 2) {
    return { type, status: 'error', error: type === 'numeric' ? 'Servono almeno due "anchors" per una domanda numerica.' : 'Servono almeno due opzioni.' };
  }
  if (opts.length > LETTERS.length) return { type, status: 'error', error: `Massimo ${LETTERS.length} opzioni per domanda.` };

  const preferred = MODELS.find((m) => m.id === preferredModelId);
  const order = preferred ? [preferred, ...MODELS.filter((m) => m !== preferred)] : MODELS;
  const messages = buildMessages(stateStr, q, opts);
  const errors = [];

  for (const model of order) {
    try {
      const { mass, usage } = await callOpenRouter(model, messages, opts.length);
      if (mass.every((m) => m === 0)) { errors.push(`${model.label}: risposta fuori dalle opzioni`); continue; }
      return buildAnswer(q, opts, mass, usage, model.id);
    } catch (e) {
      // Chiave non valida o credito esaurito: inutile provare gli altri modelli.
      if (e.status === 401) throw new FlowError('Chiave OpenRouter non valida o revocata.', 401, 'INVALID_KEY');
      if (e.status === 402) throw new FlowError('Credito OpenRouter esaurito o limite di spesa raggiunto.', 402, 'NO_CREDIT');
      errors.push(`${model.label}: ${e.message}`);
    }
  }

  const hint = errors.some((m) => /No endpoints found/i.test(m))
    ? ' Se hai escluso dei provider nelle impostazioni privacy del tuo account OpenRouter, riattivane almeno uno che supporti i logprobs.'
    : '';
  return { type, status: 'error', error: errors.join(' · ') + hint };
}

async function decideWithOpenRouter(state, questions, preferredModelId) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state, null, 2);
  const t0 = Date.now();
  const entries = Object.entries(questions);
  const pairs = await Promise.all(entries.map(async ([qid, q]) => [qid, await decideQuestion(stateStr, q, preferredModelId)]));
  const answers = Object.fromEntries(pairs);
  const models = [...new Set(Object.values(answers).map((a) => a.model).filter(Boolean))];
  const labels = models.map((id) => (MODELS.find((m) => m.id === id) || { label: id }).label);
  return {
    answers,
    engine: 'openrouter',
    model: labels.join(', ') || null,
    generated_tokens: entries.length,
    timing: { total_ms: Date.now() - t0 },
  };
}

// ── Fallback agy (senza probabilita') ──
function buildAgyEnv() {
  const envPath = [
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.gemini', 'antigravity-cli', 'bin'),
    process.env.PATH || '',
  ].filter(Boolean).join(path.delimiter);
  return { ...process.env, PATH: envPath, NO_COLOR: '1', TERM: 'dumb' };
}

function runAgy(prompt, cwd) {
  return new Promise((resolve) => {
    const command = process.env.CLI_COMMAND || 'agy';
    let child;
    try {
      child = spawn(command, [`-p=${prompt}`, '--output-format', 'stream-json'], { cwd, env: buildAgyEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return resolve({ error: `Impossibile avviare ${command}: ${err.message}` });
    }
    let response = '';
    let stderrBuf = '';
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch (e) { /* gia' terminato */ } }, AGY_TIMEOUT_MS);

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      let ev;
      try { ev = JSON.parse(line); } catch (e) { return; }
      if (ev.event === 'step_update' && ev.step_update && ev.step_update.step_type === 'agent_response' && ev.step_update.text_delta) {
        response += ev.step_update.text_delta;
      } else if (ev.event === 'result' && ev.result && !response.trim() && ev.result.response) {
        response = ev.result.response;
      }
    });
    child.stderr.on('data', (d) => { stderrBuf = (stderrBuf + d.toString()).slice(-4000); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!response.trim()) return resolve({ error: stderrBuf.trim().split('\n').slice(0, 4).join(' ') || `agy terminato con codice ${code}` });
      resolve({ response });
    });
    child.on('error', (err) => { clearTimeout(timer); resolve({ error: err.message }); });
  });
}

async function decideWithAgy(state, questions) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state, null, 2);
  const spec = Object.entries(questions).map(([qid, q]) => {
    const keys = optionsFor(q).map((o) => JSON.stringify(o.key)).join(', ');
    return `- ${qid}: ${q.instructions || ''}\n  valori ammessi: ${keys}`;
  }).join('\n');
  // Niente --dangerously-skip-permissions: qui agy deve solo leggere e rispondere.
  const prompt = 'Sei un motore decisionale. Non usare strumenti e non leggere né modificare file: rispondi solo in base allo stato qui sotto.\n\n'
    + `Stato:\n${stateStr}\n\nDomande:\n${spec}\n\n`
    + 'Rispondi SOLO con un oggetto JSON su una riga: una chiave per ogni domanda, come valore uno dei valori ammessi. Nessun altro testo.';

  const t0 = Date.now();
  const r = await runAgy(prompt, process.env.WORKSPACE_DIR || os.homedir());
  if (r.error) throw new FlowError(`agy: ${r.error}`, 502);
  const match = r.response.match(/\{[\s\S]*\}/);
  let parsed = null;
  try { parsed = match ? JSON.parse(match[0]) : null; } catch (e) { /* gestito sotto */ }
  if (!parsed || typeof parsed !== 'object') throw new FlowError('agy non ha restituito un JSON valido.', 502);

  const answers = {};
  for (const [qid, q] of Object.entries(questions)) {
    const opts = optionsFor(q);
    const key = parsed[qid] === undefined ? null : String(parsed[qid]);
    const ans = { type: q.type || 'boolean', model: 'agy' };
    if (opts.some((o) => o.key === key)) { ans.status = 'ok'; setTypedValue(ans, q, key); }
    else { ans.status = 'error'; ans.error = `Valore non ammesso restituito da agy: ${parsed[qid]}`; }
    answers[qid] = ans;
  }
  return { answers, engine: 'agy', model: 'agy', no_probabilities: true, timing: { total_ms: Date.now() - t0 } };
}

// ── Stato della chiave (GET /key di OpenRouter non consuma credito) ──
async function keyStatus() {
  if (!apiKey()) return { configured: false };
  try {
    const res = await fetch(`${OPENROUTER_API}/key`, { headers: { Authorization: `Bearer ${apiKey()}` }, signal: AbortSignal.timeout(5000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.data) return { configured: true, valid: false };
    return { configured: true, valid: true, limit: data.data.limit ?? null, usage: data.data.usage ?? null };
  } catch (e) {
    return { configured: true, valid: null, error: 'OpenRouter non raggiungibile' };
  }
}

// ── Server HTTP ──
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        key: await keyStatus(),
        models: MODELS.map(({ id, label }) => ({ id, label })),
        default_model: MODELS[0].id,
      });
    }

    if (pathname === '/presets' && req.method === 'GET') {
      return sendJson(res, 200, PRESETS);
    }

    if (pathname === '/decide' && req.method === 'POST') {
      const { state, questions, model, engine } = await readBody(req);
      if (!state || !questions || typeof questions !== 'object' || !Object.keys(questions).length) {
        return sendJson(res, 400, { error: 'Servono "state" e almeno una domanda in "questions".' });
      }
      if (Object.keys(questions).length > MAX_QUESTIONS) {
        return sendJson(res, 400, { error: `Massimo ${MAX_QUESTIONS} domande per decisione.` });
      }
      try {
        if (engine === 'agy') return sendJson(res, 200, await decideWithAgy(state, questions));
        if (!apiKey()) {
          return sendJson(res, 400, { code: 'NO_KEY', error: 'Nessuna chiave OpenRouter configurata.' });
        }
        return sendJson(res, 200, await decideWithOpenRouter(state, questions, model));
      } catch (e) {
        if (e instanceof FlowError) return sendJson(res, e.status || 502, { code: e.code || 'FLOW_ERROR', error: e.message });
        throw e;
      }
    }

    sendJson(res, 404, { error: 'Rotta non trovata' });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(0, '127.0.0.1', () => {
  console.log(JSON.stringify({ ready: true, port: server.address().port }));
});
