/**
 * AGYUI Plugin: Flow (Rizzo Flow Integration)
 *
 * Backend proxy e bridge per Rizzo Flow (motore decisionale typed a 0 token generati).
 * Comunica con il daemon locale rizzo-flow (porta 8017 di default) o esegue
 * una valutazione probabilistica di fallback locale quando il daemon è offline.
 */

const http = require('node:http');

let FLOW_URL = process.env.RIZZO_FLOW_URL || 'http://127.0.0.1:8017';

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve({ raw });
      }
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
    title: 'Snake AI Decision (SemIf / Jev Demo)',
    icon: '🐍',
    description: 'La celebre demo di Rizzo Flow: predizione della prossima mossa di gioco a 0 token.',
    state: {
      grid_size: [16, 16],
      head: [7, 8],
      current_direction: "right",
      food: [7, 12],
      danger_ahead: false,
      danger_left: false,
      danger_right: true
    },
    questions: {
      next_move: {
        type: "choice",
        instructions: "In quale direzione deve muoversi il serpente per avvicinarsi al cibo evitando gli ostacoli?",
        options: [
          { id: "continue_straight", description: "Prosegui dritto verso destra." },
          { id: "turn_left", description: "Gira a sinistra verso l'alto." },
          { id: "turn_right", description: "Gira a destra verso il basso (pericolo!)." }
        ]
      },
      safe_move: {
        type: "boolean",
        instructions: "La direzione selezionata è sicura e priva di collisioni immediate?"
      }
    }
  }
];

// ── MOTORE DI VALUTAZIONE PROBABILISTICA LOCALE (FALLBACK / OFFLINE SIMULATOR) ──
function evaluateSimulatedDecisions(state, questions) {
  const stateStr = typeof state === 'string' ? state : JSON.stringify(state);
  const stateLower = stateStr.toLowerCase();
  const answers = {};

  const startMs = Date.now();

  for (const [qid, q] of Object.entries(questions)) {
    const qType = q.type || 'boolean';
    const instructions = (q.instructions || '').toLowerCase();

    if (qType === 'boolean') {
      let scoreTrue = 0.5;
      const positiveWords = ['accedere', 'login', 'urgente', 'blocc', 'sicur', 'produzione', 'errore', 'help', 'manca', 'fail', 'spam', 'phish', 'critico'];
      const negativeWords = ['nessun', 'funziona', 'regolare', 'basso', 'risolto', 'ok'];

      positiveWords.forEach(w => { if (stateLower.includes(w)) scoreTrue += 0.08; });
      negativeWords.forEach(w => { if (stateLower.includes(w)) scoreTrue -= 0.06; });

      // Calcola probabilità normalizzata
      scoreTrue = Math.max(0.04, Math.min(0.96, scoreTrue));
      const scoreFalse = +(1 - scoreTrue).toFixed(4);
      scoreTrue = +scoreTrue.toFixed(4);

      const val = scoreTrue >= 0.5;
      answers[qid] = {
        type: 'boolean',
        value: val,
        status: 'ok',
        probability_true_given_available: scoreTrue,
        probabilities: {
          true: scoreTrue,
          false: scoreFalse
        },
        uncertainty: {
          entropy: +(-scoreTrue * Math.log2(scoreTrue) - scoreFalse * Math.log2(scoreFalse)).toFixed(3),
          margin: +Math.abs(scoreTrue - scoreFalse).toFixed(3)
        },
        input_tokens: Math.ceil(stateStr.length / 4) + 24
      };
    } else if (qType === 'choice') {
      const options = q.options || [];
      if (!options.length) continue;

      let weights = options.map((opt) => {
        let w = 1.0;
        const words = (opt.id + ' ' + (opt.description || '')).toLowerCase().split(/[\s,._-]+/);
        words.forEach(word => {
          if (word.length > 2 && stateLower.includes(word)) w += 2.5;
        });
        return w;
      });

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const rawProbs = weights.map(w => w / totalWeight);

      // Softmax sharpening
      const expProbs = rawProbs.map(p => Math.exp(p * 2.5));
      const expSum = expProbs.reduce((a, b) => a + b, 0);
      const probs = expProbs.map(p => +(p / expSum).toFixed(4));

      let maxIdx = 0;
      probs.forEach((p, idx) => { if (p > probs[maxIdx]) maxIdx = idx; });

      const probMap = {};
      options.forEach((opt, idx) => { probMap[opt.id] = probs[idx]; });

      answers[qid] = {
        type: 'choice',
        value: options[maxIdx].id,
        status: 'ok',
        probabilities: probMap,
        uncertainty: {
          margin: +(probs[maxIdx] - (probs.filter((_, i) => i !== maxIdx).sort((a,b)=>b-a)[0] || 0)).toFixed(3)
        },
        input_tokens: Math.ceil(stateStr.length / 4) + options.length * 15
      };
    } else if (qType === 'score') {
      const levels = q.levels || [];
      const numLevels = levels.length || 3;
      let levelScores = new Array(numLevels).fill(1.0);

      if (stateLower.includes('critico') || stateLower.includes('blocc') || stateLower.includes('oggi') || stateLower.includes('elevato')) {
        levelScores[numLevels - 1] += 3.5;
      } else if (stateLower.includes('rallentat') || stateLower.includes('medio')) {
        const mid = Math.floor(numLevels / 2);
        levelScores[mid] += 3.0;
      } else {
        levelScores[0] += 2.0;
      }

      const tot = levelScores.reduce((a, b) => a + b, 0);
      const probs = levelScores.map(s => +(s / tot).toFixed(4));
      let best = 0;
      probs.forEach((p, i) => { if (p > probs[best]) best = i; });

      const probMap = {};
      levels.forEach((l, i) => { probMap[String(i)] = probs[i]; });

      answers[qid] = {
        type: 'score',
        value: best,
        status: 'ok',
        probabilities: probMap,
        levels: levels,
        input_tokens: Math.ceil(stateStr.length / 4) + numLevels * 12
      };
    } else if (qType === 'numeric') {
      const anchors = q.anchors || [];
      let val = anchors.length ? anchors[Math.floor(anchors.length / 2)].value : 5.0;
      if (stateLower.includes('stasera') || stateLower.includes('poche ore') || stateLower.includes('oggi')) {
        val = anchors.length ? anchors[0].value : 2.0;
      }
      answers[qid] = {
        type: 'numeric',
        value: val,
        unit: q.unit || '',
        status: 'ok',
        input_tokens: Math.ceil(stateStr.length / 4) + 30
      };
    }
  }

  const elapsed = Date.now() - startMs + Math.floor(Math.random() * 25 + 35); // realistico ~50ms

  return {
    answers,
    timing: {
      queue_ms: 1.2,
      prefill_ms: +(elapsed * 0.85).toFixed(1),
      total_ms: elapsed
    },
    simulated: true,
    model: "Spark-X2.5-4B (Simulatore locale Rizzo Flow)"
  };
}

// ── SERVER HTTP PRINCIPALE ──
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    const method = req.method;

    // GET /health
    if (pathname === '/health' && method === 'GET') {
      let isOnline = false;
      let modelInfo = null;

      try {
        const check = await fetch(`${FLOW_URL}/health`, { signal: AbortSignal.timeout(1200) });
        if (check.ok) {
          const data = await check.json();
          isOnline = true;
          modelInfo = data.model || 'Spark-X2.5';
        }
      } catch (_) {}

      return sendJson(res, 200, {
        status: isOnline ? 'ready' : 'fallback',
        online: isOnline,
        url: FLOW_URL,
        model: modelInfo || 'Spark-X2.5-4B (Fallback)',
        simulated: !isOnline
      });
    }

    // GET /presets
    if (pathname === '/presets' && method === 'GET') {
      return sendJson(res, 200, PRESETS);
    }

    // POST /decide
    if (pathname === '/decide' && method === 'POST') {
      const body = await readBody(req);
      const state = body.state;
      const questions = body.questions;

      if (!state || !questions) {
        return sendJson(res, 400, { error: 'Parametri "state" e "questions" obbligatori.' });
      }

      // Prova il daemon reale Rizzo Flow se attivo
      let flowRes = null;
      try {
        const resp = await fetch(`${FLOW_URL}/v1/decisions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, questions }),
          signal: AbortSignal.timeout(30000)
        });
        if (resp.ok) {
          flowRes = await resp.json();
          flowRes.simulated = false;
          if (flowRes.timing && typeof flowRes.timing.total_seconds === 'number') {
            flowRes.timing.total_ms = Math.round(flowRes.timing.total_seconds * 1000);
          }
        } else {
          const errText = await resp.text();
          console.warn('[FlowPlugin] Errore HTTP da rizzo-flow:', resp.status, errText);
        }
      } catch (err) {
        console.warn('[FlowPlugin] Errore connessione daemon:', err.message);
      }

      if (flowRes) {
        return sendJson(res, 200, flowRes);
      }

      // Fallback: motore di valutazione probabilistica integrato
      const simulatedResult = evaluateSimulatedDecisions(state, questions);
      return sendJson(res, 200, simulatedResult);
    }

    // POST /config
    if (pathname === '/config' && method === 'POST') {
      const body = await readBody(req);
      if (body.url && typeof body.url === 'string') {
        FLOW_URL = body.url.trim().replace(/\/+$/, '');
        return sendJson(res, 200, { success: true, url: FLOW_URL });
      }
      return sendJson(res, 400, { error: 'URL non valido' });
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
