/**
 * AGYUI PII — anonimizzazione documenti dentro l'interfaccia AGYUI.
 *
 * Non reimplementa il rilevamento: usa il motore Rizzo-PII gia' installato
 * (container condiviso su 127.0.0.1:5005, offline) attraverso il bridge
 * autenticato /api/pii/engine/*, che esiste identico in self-hosted
 * (server/api/pii.js) e in SaaS (gateway/index.js). Il plugin e' solo
 * frontend: nessun processo da avviare, stesso comportamento nei due mondi.
 *
 * In piu' rispetto all'UI del motore: "Salva per l'agente", che scrive il
 * risultato in <workspace>/pii-clean/ tramite /api/pii/redact, cosi' l'agente
 * legge il documento gia' censurato invece dell'originale.
 */

const API = '/api/pii';
const ENGINE = API + '/engine';
const MAP_KEY = 'agypii_map';

const CSS = `
.agypii { display:flex; flex-direction:column; height:100%; overflow:hidden;
  font-family: var(--font-family, sans-serif); color: var(--text-main, #cbd5e1); }
.agypii * { box-sizing:border-box; }

.agypii-top { display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  padding:14px 18px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08)); }
.agypii-brand { display:flex; align-items:center; gap:10px; font-family:var(--font-display, sans-serif);
  font-weight:800; font-size:1.05rem; color:var(--text-bright,#fff); letter-spacing:-.01em; }
.agypii-brand .agypii-mark { width:30px; height:30px; border-radius:9px; display:grid; place-items:center;
  background:linear-gradient(135deg, rgba(6,182,212,.22), rgba(139,92,246,.22));
  border:1px solid rgba(6,182,212,.35); color:var(--accent,#06b6d4); }
.agypii-brand small { display:block; font-family:var(--font-mono,monospace); font-weight:500;
  font-size:.66rem; color:var(--text-muted,#94a3b8); letter-spacing:.02em; }
.agypii-pill { margin-left:auto; display:inline-flex; align-items:center; gap:7px; padding:5px 11px;
  border-radius:999px; font-family:var(--font-mono,monospace); font-size:.68rem;
  border:1px solid var(--border-color,rgba(255,255,255,.08)); background:rgba(255,255,255,.03);
  color:var(--text-muted,#94a3b8); }
.agypii-dot { width:7px; height:7px; border-radius:50%; background:var(--text-muted,#94a3b8); }
.agypii-dot.ok { background:var(--success,#10b981); box-shadow:0 0 0 3px rgba(16,185,129,.15); }
.agypii-dot.ko { background:var(--danger,#ef4444); box-shadow:0 0 0 3px rgba(239,68,68,.15); }

.agypii-grid { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);
  gap:14px; padding:14px 18px 18px; overflow:hidden; }
@media (max-width: 980px) { .agypii-grid { grid-template-columns:minmax(0,1fr); overflow:auto; }
  .agypii-card { min-height:340px; } }

.agypii-card { display:flex; flex-direction:column; min-height:0; overflow:hidden;
  background:var(--bg-card, rgba(13,18,31,.85)); border:1px solid var(--border-color,rgba(255,255,255,.08));
  border-radius:var(--radius-lg,18px); }
.agypii-tabs { display:flex; gap:2px; padding:8px 8px 0; overflow-x:auto; scrollbar-width:none; }
.agypii-tabs::-webkit-scrollbar { display:none; }
.agypii-tab { flex:0 0 auto; padding:7px 13px; border:none; background:transparent; cursor:pointer;
  border-radius:9px 9px 0 0; font-family:var(--font-mono,monospace); font-size:.72rem; font-weight:600;
  color:var(--text-muted,#94a3b8); transition:background .15s, color .15s; }
.agypii-tab:hover { background:var(--bg-hover,#1c2438); color:var(--text-bright,#fff); }
.agypii-tab.on { background:var(--bg-secondary,#121829); color:var(--accent,#06b6d4);
  box-shadow:inset 0 -2px 0 var(--accent,#06b6d4); }
.agypii-pane { flex:1; min-height:0; overflow:auto; padding:14px; display:none; }
.agypii-pane.on { display:block; }
.agypii-pane.flex { display:none; }
.agypii-pane.flex.on { display:flex; flex-direction:column; }

.agypii-ta { width:100%; flex:1; min-height:200px; resize:none; padding:12px 14px;
  background:var(--bg-main,#06080F); color:var(--text-main,#cbd5e1);
  border:1px solid var(--border-color,rgba(255,255,255,.08)); border-radius:var(--radius-md,12px);
  font-family:var(--font-mono,monospace); font-size:.78rem; line-height:1.6; outline:none; }
.agypii-ta:focus { border-color:rgba(6,182,212,.5); }

.agypii-drop { flex:1; min-height:200px; display:grid; place-content:center; justify-items:center; gap:8px;
  text-align:center; padding:24px; border:1.5px dashed var(--border-light,rgba(255,255,255,.15));
  border-radius:var(--radius-md,12px); background:rgba(255,255,255,.015); cursor:pointer;
  transition:border-color .15s, background .15s; }
.agypii-drop:hover, .agypii-drop.hot { border-color:var(--accent,#06b6d4); background:rgba(6,182,212,.06); }
.agypii-drop h4 { margin:0; font-family:var(--font-display,sans-serif); font-size:.92rem; color:var(--text-bright,#fff); }
.agypii-drop p { margin:0; font-size:.74rem; color:var(--text-muted,#94a3b8); }
.agypii-file { display:flex; align-items:center; gap:10px; margin-top:10px; padding:10px 12px;
  border-radius:var(--radius-md,12px); background:rgba(6,182,212,.07); border:1px solid rgba(6,182,212,.25);
  font-family:var(--font-mono,monospace); font-size:.74rem; color:var(--text-bright,#fff); }
.agypii-file button { margin-left:auto; background:none; border:none; color:var(--text-muted,#94a3b8);
  cursor:pointer; font-size:1rem; line-height:1; }

.agypii-opts { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:12px; }
.agypii-chip { display:inline-flex; align-items:center; gap:7px; padding:6px 11px; cursor:pointer;
  border-radius:999px; border:1px solid var(--border-color,rgba(255,255,255,.08));
  background:rgba(255,255,255,.03); font-family:var(--font-mono,monospace); font-size:.7rem;
  color:var(--text-muted,#94a3b8); transition:border-color .15s, color .15s; }
.agypii-chip:hover { border-color:var(--border-light,rgba(255,255,255,.15)); color:var(--text-bright,#fff); }
.agypii-chip.on { border-color:rgba(6,182,212,.45); color:var(--accent,#06b6d4); background:rgba(6,182,212,.08); }
.agypii-sw { position:relative; width:30px; height:17px; border-radius:999px; flex:0 0 auto;
  background:rgba(255,255,255,.12); transition:background .15s; }
.agypii-sw::after { content:''; position:absolute; top:2px; left:2px; width:13px; height:13px; border-radius:50%;
  background:#fff; transition:transform .15s; }
.agypii-chip.on .agypii-sw { background:var(--accent,#06b6d4); }
.agypii-chip.on .agypii-sw::after { transform:translateX(13px); }

.agypii-acts { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.agypii-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 15px; cursor:pointer;
  border-radius:var(--radius-md,12px); border:1px solid var(--border-color,rgba(255,255,255,.08));
  background:rgba(255,255,255,.04); color:var(--text-main,#cbd5e1);
  font-family:var(--font-family,sans-serif); font-size:.78rem; font-weight:600;
  transition:background .15s, border-color .15s, transform .1s; }
.agypii-btn:hover:not(:disabled) { background:var(--bg-hover,#1c2438); border-color:var(--border-light,rgba(255,255,255,.15)); }
.agypii-btn:active:not(:disabled) { transform:translateY(1px); }
.agypii-btn:disabled { opacity:.45; cursor:not-allowed; }
.agypii-btn.primary { border:none; color:#fff;
  background:linear-gradient(135deg, var(--accent-cyan,#06b6d4), var(--accent-violet,#8b5cf6)); }
.agypii-btn.primary:hover:not(:disabled) { filter:brightness(1.1); }
.agypii-btn svg { width:15px; height:15px; }

.agypii-msg { margin-top:12px; padding:10px 12px; border-radius:var(--radius-md,12px);
  font-size:.75rem; line-height:1.5; display:none; }
.agypii-msg.on { display:block; }
.agypii-msg.err { background:rgba(239,68,68,.1); color:#fca5a5; border:1px solid rgba(239,68,68,.28); }
.agypii-msg.ok { background:rgba(16,185,129,.1); color:#6ee7b7; border:1px solid rgba(16,185,129,.28); }
.agypii-msg.warn { background:rgba(245,158,11,.1); color:#fcd34d; border:1px solid rgba(245,158,11,.28); }

.agypii-stats { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:12px; }
.agypii-stat { padding:5px 10px; border-radius:8px; background:rgba(255,255,255,.04);
  border:1px solid var(--border-color,rgba(255,255,255,.08));
  font-family:var(--font-mono,monospace); font-size:.68rem; color:var(--text-muted,#94a3b8); }
.agypii-stat b { color:var(--text-bright,#fff); font-weight:700; }

.agypii-text { padding:13px 15px; border-radius:var(--radius-md,12px); background:var(--bg-main,#06080F);
  border:1px solid var(--border-color,rgba(255,255,255,.08)); font-family:var(--font-mono,monospace);
  font-size:.78rem; line-height:1.75; white-space:pre-wrap; word-break:break-word; }
.agypii-ent { padding:1px 4px; border-radius:5px; background:rgba(239,68,68,.16);
  border-bottom:1.5px solid rgba(239,68,68,.5); cursor:help; }
.agypii-ph { padding:1px 5px; border-radius:5px; background:rgba(6,182,212,.14);
  border-bottom:1.5px solid rgba(6,182,212,.5); color:var(--accent,#06b6d4); font-weight:600; }

.agypii-tbl { width:100%; border-collapse:collapse; font-size:.74rem; }
.agypii-tbl th { text-align:left; padding:7px 9px; font-family:var(--font-mono,monospace); font-size:.65rem;
  text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted,#94a3b8);
  border-bottom:1px solid var(--border-color,rgba(255,255,255,.08)); }
.agypii-tbl td { padding:7px 9px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:top; }
.agypii-tbl tr:hover td { background:rgba(255,255,255,.02); }
.agypii-tag { display:inline-block; padding:2px 7px; border-radius:6px; background:rgba(139,92,246,.14);
  color:#c4b5fd; font-family:var(--font-mono,monospace); font-size:.66rem; font-weight:600; }
.agypii-src { font-family:var(--font-mono,monospace); font-size:.64rem; color:var(--text-muted,#94a3b8); }
.agypii-val { font-family:var(--font-mono,monospace); word-break:break-all; }

.agypii-taglist { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:6px;
  margin-top:10px; max-height:240px; overflow:auto; padding-right:4px; }
.agypii-tagitem { display:flex; align-items:flex-start; gap:8px; padding:7px 9px; cursor:pointer;
  border-radius:9px; border:1px solid var(--border-color,rgba(255,255,255,.08)); background:rgba(255,255,255,.02); }
.agypii-tagitem:hover { border-color:var(--border-light,rgba(255,255,255,.15)); }
.agypii-tagitem input { margin:2px 0 0; accent-color:var(--accent,#06b6d4); }
.agypii-tagitem .n { font-family:var(--font-mono,monospace); font-size:.68rem; color:var(--text-bright,#fff); }
.agypii-tagitem .d { font-size:.66rem; color:var(--text-muted,#94a3b8); line-height:1.35; }

.agypii-pages { display:flex; flex-direction:column; gap:12px; }
.agypii-page { border-radius:var(--radius-md,12px); overflow:hidden;
  border:1px solid var(--border-color,rgba(255,255,255,.08)); background:#fff; }
.agypii-page img { display:block; width:100%; height:auto; }
.agypii-pagelbl { font-family:var(--font-mono,monospace); font-size:.66rem; color:var(--text-muted,#94a3b8); }

.agypii-empty { display:grid; place-content:center; justify-items:center; gap:10px; height:100%;
  min-height:220px; text-align:center; color:var(--text-muted,#94a3b8); }
.agypii-empty svg { width:34px; height:34px; opacity:.35; }
.agypii-empty p { margin:0; font-size:.78rem; max-width:340px; line-height:1.6; }
.agypii-spin { animation:agypii-rot 1s linear infinite; }
@keyframes agypii-rot { to { transform:rotate(360deg); } }
.agypii-note { margin-top:10px; font-size:.68rem; color:var(--text-muted,#94a3b8); line-height:1.55; }
.agypii-note b { color:var(--text-main,#cbd5e1); }
`;

const ICONS = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7H7v7"/><path d="M7 3v5h8"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>',
  loader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

// ── stato ────────────────────────────────────────────────────────────────
const st = {
  mode: 'text',        // 'text' | 'file'
  file: null,
  tags: [],            // catalogo tag dal motore
  excluded: new Set(), // tag da NON anonimizzare
  mapping: true,       // dizionario reversibile (permette la decodifica)
  result: null,        // ultima risposta /analyze
  doc: null,           // ultima anteprima PDF { doc_id, n_pages, ... }
  outTab: 'preview',
  busy: false
};

let root = null;
let host = null;

// ── utility ──────────────────────────────────────────────────────────────
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const $ = (sel) => root && root.querySelector(sel);
const $$ = (sel) => root ? Array.from(root.querySelectorAll(sel)) : [];

function authHeaders(extra) {
  // self-hosted: PIN in localStorage. SaaS: cookie httpOnly, nessun header.
  const token = localStorage.getItem('agy_pin') || '';
  const h = Object.assign({}, extra || {});
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function errText(res) {
  try {
    const j = await res.json();
    return j.error || j.details || ('HTTP ' + res.status);
  } catch (e) {
    return 'HTTP ' + res.status;
  }
}

function setMsg(kind, text) {
  const box = $('.agypii-msg');
  if (!box) return;
  if (!text) { box.className = 'agypii-msg'; box.textContent = ''; return; }
  box.className = 'agypii-msg on ' + kind;
  box.textContent = text;
}

function setBusy(on, label) {
  st.busy = on;
  $$('.agypii-acts .agypii-btn').forEach(b => { b.disabled = on; });
  const run = $('#agypii-run');
  if (run) {
    run.innerHTML = on
      ? ICONS.loader.replace('<svg', '<svg class="agypii-spin"') + ' ' + esc(label || 'Analisi in corso…')
      : ICONS.play + ' Analizza';
  }
}

function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function storedMap() {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (e) { return {}; }
}

function storeMap(map) {
  if (!map || !Object.keys(map).length) return;
  try {
    // Unisce ai segnaposto gia' noti: cosi' si decodifica anche testo
    // prodotto da un'analisi precedente.
    localStorage.setItem(MAP_KEY, JSON.stringify(Object.assign(storedMap(), map)));
  } catch (e) { /* quota piena o storage negato: la decodifica restera' parziale */ }
}

// ── chiamate al motore ───────────────────────────────────────────────────
// Il corpo cambia forma a seconda dell'input: JSON per il testo incollato,
// multipart per i file (il motore accetta entrambi sulle stesse rotte).
function engineBody() {
  const excl = Array.from(st.excluded);
  if (st.mode === 'file') {
    if (!st.file) return null;
    const fd = new FormData();
    const isPdf = /\.pdf$/i.test(st.file.name);
    fd.append(isPdf ? 'pdf' : 'file', st.file, st.file.name);
    if (excl.length) fd.append('exclude_tags', excl.join(','));
    fd.append('include_mapping', st.mapping ? '1' : '0');
    return { body: fd };
  }
  const text = ($('#agypii-text') || {}).value || '';
  if (!text.trim()) return null;
  return {
    json: { text, exclude_tags: excl, include_mapping: st.mapping }
  };
}

async function callEngine(path, payload, asBlob) {
  const opts = { method: 'POST' };
  if (payload.json) {
    opts.headers = authHeaders({ 'Content-Type': 'application/json' });
    opts.body = JSON.stringify(payload.json);
  } else {
    opts.headers = authHeaders();   // multipart: il browser mette il boundary
    opts.body = payload.body;
  }
  const res = await fetch(ENGINE + path, opts);
  if (!res.ok) throw new Error(await errText(res));
  return asBlob ? res : res.json();
}

// ── azioni ───────────────────────────────────────────────────────────────
async function doAnalyze() {
  const payload = engineBody();
  if (!payload) {
    setMsg('warn', st.mode === 'file' ? 'Scegli prima un documento.' : 'Incolla del testo da analizzare.');
    return;
  }
  setMsg('', '');
  setBusy(true, 'Analisi in corso…');
  try {
    const data = await callEngine('/analyze', payload);
    st.result = data;
    st.doc = null;
    if (data.mapping) storeMap(data.mapping);
    st.outTab = 'preview';
    renderOut();
    const n = data.n_entities || 0;
    setMsg(n ? 'ok' : 'warn', n
      ? n + ' dati personali rilevati e sostituiti (' + (data.n_unique || 0) + ' distinti).'
      : 'Nessun dato personale rilevato in questo contenuto.');
  } catch (e) {
    setMsg('err', e.message);
  } finally {
    setBusy(false);
  }
}

async function doPdf(preview) {
  const payload = engineBody();
  if (!payload) {
    setMsg('warn', st.mode === 'file' ? 'Scegli prima un documento.' : 'Incolla del testo o carica un PDF.');
    return;
  }
  setMsg('', '');
  setBusy(true, preview ? 'Preparazione anteprima…' : 'Creazione PDF…');
  try {
    if (preview) {
      const data = await callEngine('/pdf/preview', payload);
      st.doc = data;
      st.outTab = 'pdf';
      renderOut();
      await loadPages();
      setMsg('ok', (data.redactions || 0) + ' occorrenze rimosse su ' + (data.n_pages || 0) + ' pagine.'
        + (data.residual ? ' Attenzione: ' + data.residual + ' valori restano in chiaro.' : ''));
    } else {
      const res = await callEngine('/pdf', payload, true);
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename=([^;]+)/);
      const name = (m ? m[1].trim().replace(/"/g, '') : 'documento_anonimizzato.pdf');
      download(blob, name);
      setMsg('ok', 'PDF anonimizzato scaricato: ' + name);
    }
  } catch (e) {
    setMsg('err', e.message);
  } finally {
    setBusy(false);
  }
}

// Le pagine sono protette dall'auth come il resto: niente <img src> diretto,
// si scarica il PNG con l'header e lo si mostra da blob URL.
async function loadPages() {
  if (!st.doc || !st.doc.doc_id) return;
  const wrap = $('#agypii-pages');
  if (!wrap) return;
  wrap.innerHTML = '';
  // Le pagine del motore sono indicizzate da 0: page/0.png e' la prima.
  for (let i = 0; i < (st.doc.n_pages || 1); i++) {
    const box = document.createElement('div');
    box.className = 'agypii-page';
    wrap.appendChild(box);
    try {
      const res = await fetch(ENGINE + '/doc/' + encodeURIComponent(st.doc.doc_id) + '/page/' + i + '.png',
        { headers: authHeaders() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const url = URL.createObjectURL(await res.blob());
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Pagina ' + (i + 1) + ' anonimizzata';
      img.onload = () => setTimeout(() => URL.revokeObjectURL(url), 1000);
      box.appendChild(img);
    } catch (e) {
      box.innerHTML = '<div style="padding:14px;color:#ef4444;font-size:.74rem">Pagina ' + (i + 1) + ' non caricata: ' + esc(e.message) + '</div>';
    }
  }
}

async function doDownloadDoc() {
  if (!st.doc || !st.doc.doc_id) return;
  try {
    const res = await fetch(ENGINE + '/doc/' + encodeURIComponent(st.doc.doc_id) + '/file.pdf',
      { headers: authHeaders() });
    if (!res.ok) throw new Error(await errText(res));
    download(await res.blob(), st.doc.filename || 'documento_anonimizzato.pdf');
    setMsg('ok', 'PDF anonimizzato scaricato.');
  } catch (e) {
    setMsg('err', e.message);
  }
}

// Valore aggiunto rispetto all'UI del motore: il file censurato finisce nel
// workspace (pii-clean/), cosi' l'agente legge quello e non l'originale.
async function doSaveForAgent() {
  let bytes, name;
  if (st.mode === 'file') {
    if (!st.file) { setMsg('warn', 'Scegli prima un documento.'); return; }
    bytes = await st.file.arrayBuffer();
    name = st.file.name;
  } else {
    const text = ($('#agypii-text') || {}).value || '';
    if (!text.trim()) { setMsg('warn', 'Incolla del testo da anonimizzare.'); return; }
    bytes = new TextEncoder().encode(text);
    const d = new Date();
    const stamp = d.toISOString().slice(0, 16).replace(/[-:T]/g, '');
    name = 'testo-' + stamp + '.txt';
  }

  setMsg('', '');
  setBusy(true, 'Salvataggio…');
  try {
    const res = await fetch(API + '/redact', {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(name)
      }),
      body: bytes
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    setMsg('ok', "Salvato in \"" + data.path + "\" (" + fmtBytes(data.size) + "): l’agente lo legge da lì.");
  } catch (e) {
    setMsg('err', e.message);
  } finally {
    setBusy(false);
  }
}

function doDecode() {
  const src = ($('#agypii-dec-in') || {}).value || '';
  const out = $('#agypii-dec-out');
  if (!out) return;
  const map = storedMap();
  const keys = Object.keys(map).sort((a, b) => b.length - a.length); // [X_10] prima di [X_1]
  if (!keys.length) {
    out.innerHTML = '<span style="color:var(--text-muted)">Nessun dizionario salvato: esegui prima una analisi con il dizionario reversibile attivo.</span>';
    return;
  }
  let hits = 0;
  let html = '';
  let rest = src;
  const re = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  let last = 0, m;
  while ((m = re.exec(rest)) !== null) {
    html += esc(rest.slice(last, m.index));
    html += '<span class="agypii-ent" title="' + esc(m[0]) + '">' + esc(map[m[0]]) + '</span>';
    last = m.index + m[0].length;
    hits++;
  }
  html += esc(rest.slice(last));
  out.innerHTML = html || '<span style="color:var(--text-muted)">Incolla sopra il testo anonimizzato.</span>';
  setMsg(hits ? 'ok' : 'warn', hits
    ? hits + ' segnaposto ripristinati dal dizionario locale.'
    : 'Nessun segnaposto riconosciuto in questo testo.');
}

function doForgetMap() {
  try { localStorage.removeItem(MAP_KEY); } catch (e) {}
  const out = $('#agypii-dec-out');
  if (out) out.innerHTML = '<span style="color:var(--text-muted)">Dizionario cancellato.</span>';
  renderOut();
  setMsg('ok', 'Dizionario reversibile cancellato da questo browser.');
}

// ── rendering risultati ──────────────────────────────────────────────────
function emptyState(text) {
  return '<div class="agypii-empty">' + ICONS.shield + '<p>' + esc(text) + '</p></div>';
}

function segmentsHtml(anonymized) {
  const segs = (st.result && st.result.segments) || [];
  if (!segs.length) return '';
  return segs.map(s => {
    if (!s.label) return esc(s.t);
    if (anonymized) {
      return '<span class="agypii-ph" title="' + esc(s.label) + (s.validated ? ' · validato' : '') + '">'
        + esc(s.ph) + '</span>';
    }
    return '<span class="agypii-ent" title="' + esc(s.label) + ' → ' + esc(s.ph) + '">' + esc(s.t) + '</span>';
  }).join('');
}

function statsHtml() {
  const r = st.result;
  if (!r) return '';
  const bySrc = r.by_source || {};
  const parts = [
    '<span class="agypii-stat">entità <b>' + (r.n_entities || 0) + '</b></span>',
    '<span class="agypii-stat">distinte <b>' + (r.n_unique || 0) + '</b></span>',
    '<span class="agypii-stat">caratteri <b>' + (r.n_chars || 0) + '</b></span>'
  ];
  Object.keys(bySrc).forEach(k => {
    parts.push('<span class="agypii-stat">' + esc(k) + ' <b>' + bySrc[k] + '</b></span>');
  });
  if (r.mapping_enabled === false) {
    parts.push('<span class="agypii-stat">dizionario <b>off</b></span>');
  }
  if ((r.excluded_tags || []).length) {
    parts.push('<span class="agypii-stat">esclusi <b>' + r.excluded_tags.length + '</b></span>');
  }
  return '<div class="agypii-stats">' + parts.join('') + '</div>';
}

function entitiesHtml() {
  const r = st.result;
  if (!r) return emptyState('Nessuna analisi ancora eseguita.');
  const segs = (r.segments || []).filter(s => s.label);
  if (!segs.length) return emptyState('Nessun dato personale rilevato.');

  // Una riga per segnaposto distinto, con il numero di occorrenze.
  const rows = new Map();
  segs.forEach(s => {
    const k = s.ph;
    if (!rows.has(k)) rows.set(k, { ph: s.ph, label: s.label, src: s.src, val: s.t, validated: s.validated, n: 0 });
    rows.get(k).n++;
  });

  const hasMap = r.mapping_enabled !== false;
  return '<table class="agypii-tbl"><thead><tr>'
    + '<th>Segnaposto</th><th>Tipo</th>' + (hasMap ? '<th>Valore originale</th>' : '')
    + '<th>Fonte</th><th>N.</th></tr></thead><tbody>'
    + Array.from(rows.values()).map(e =>
        '<tr><td><span class="agypii-ph">' + esc(e.ph) + '</span></td>'
        + '<td><span class="agypii-tag">' + esc(e.label) + '</span></td>'
        + (hasMap ? '<td class="agypii-val">' + esc(e.val) + '</td>' : '')
        + '<td class="agypii-src">' + esc(e.src || '') + (e.validated ? ' ✓' : '') + '</td>'
        + '<td class="agypii-src">' + e.n + '</td></tr>'
      ).join('')
    + '</tbody></table>';
}

function pdfHtml() {
  if (st.doc) {
    const d = st.doc;
    return '<div class="agypii-stats">'
      + '<span class="agypii-stat">pagine <b>' + (d.n_pages || 0) + '</b></span>'
      + '<span class="agypii-stat">redazioni <b>' + (d.redactions || 0) + '</b></span>'
      + (d.residual ? '<span class="agypii-stat" style="color:#fcd34d">residui <b>' + d.residual + '</b></span>' : '')
      + (d.skipped ? '<span class="agypii-stat">saltati <b>' + d.skipped + '</b></span>' : '')
      + '</div>'
      + '<div class="agypii-acts" style="margin:0 0 12px">'
      + '<button class="agypii-btn primary" id="agypii-dl-doc">' + ICONS.pdf + ' Scarica PDF anonimizzato</button>'
      + '</div>'
      + '<div class="agypii-pages" id="agypii-pages"></div>';
  }
  return emptyState('Carica un PDF e usa "Anteprima PDF" per vedere le pagine con le redazioni applicate. Il contenuto viene rimosso davvero dal file, non solo coperto.');
}

function decodeHtml() {
  const n = Object.keys(storedMap()).length;
  return '<p class="agypii-note" style="margin-top:0">'
    + 'Il dizionario reversibile resta <b>solo in questo browser</b> e permette di rileggere un testo anonimizzato. '
    + 'Segnaposto memorizzati: <b>' + n + '</b>.</p>'
    + '<textarea class="agypii-ta" id="agypii-dec-in" style="min-height:120px;margin-bottom:10px" '
    + 'placeholder="Incolla qui il testo anonimizzato, es. Il sig. [FULLNAME_1] con CF [CF_1]…"></textarea>'
    + '<div class="agypii-acts" style="margin:0 0 12px">'
    + '<button class="agypii-btn primary" id="agypii-dec-run">' + ICONS.unlock + ' Decodifica</button>'
    + '<button class="agypii-btn" id="agypii-dec-forget">' + ICONS.trash + ' Cancella dizionario</button>'
    + '</div>'
    + '<div class="agypii-text" id="agypii-dec-out"><span style="color:var(--text-muted)">Il testo ripristinato comparirà qui.</span></div>';
}

function renderOut() {
  const panes = {
    preview: st.result
      ? statsHtml() + '<div class="agypii-text">' + segmentsHtml(false) + '</div>'
        + '<p class="agypii-note">In rosso i dati personali trovati nel testo originale. Passa il mouse per vedere il segnaposto che li sostituisce.</p>'
      : emptyState('Incolla un testo o carica un documento, poi premi Analizza. Il rilevamento gira in locale: nessun dato esce da questa macchina.'),
    clean: st.result
      ? '<div class="agypii-acts" style="margin:0 0 12px"><button class="agypii-btn" id="agypii-copy">' + ICONS.copy + ' Copia testo</button></div>'
        + '<div class="agypii-text">' + segmentsHtml(true) + '</div>'
      : emptyState('Qui comparirà il testo con i dati personali sostituiti dai segnaposto.'),
    ents: entitiesHtml(),
    pdf: pdfHtml(),
    decode: decodeHtml()
  };

  Object.keys(panes).forEach(k => {
    const pane = $('#agypii-pane-' + k);
    if (pane) {
      pane.innerHTML = panes[k];
      pane.classList.toggle('on', st.outTab === k);
    }
    const tab = $('.agypii-tab[data-out="' + k + '"]');
    if (tab) tab.classList.toggle('on', st.outTab === k);
  });

  const copy = $('#agypii-copy');
  if (copy) copy.onclick = () => {
    navigator.clipboard.writeText((st.result && st.result.anonymized_text) || '')
      .then(() => setMsg('ok', 'Testo anonimizzato copiato negli appunti.'))
      .catch(() => setMsg('err', 'Copia non riuscita.'));
  };
  const dl = $('#agypii-dl-doc');
  if (dl) dl.onclick = doDownloadDoc;
  const decRun = $('#agypii-dec-run');
  if (decRun) decRun.onclick = doDecode;
  const decForget = $('#agypii-dec-forget');
  if (decForget) decForget.onclick = doForgetMap;
}

function renderTags() {
  const box = $('#agypii-taglist');
  if (!box) return;
  if (!st.tags.length) {
    box.innerHTML = '<p class="agypii-note" style="grid-column:1/-1">Catalogo tag non disponibile.</p>';
    return;
  }
  box.innerHTML = st.tags.map(t => {
    const tag = t.tag || t;
    const desc = t.it || t.en || '';
    return '<label class="agypii-tagitem"><input type="checkbox" data-tag="' + esc(tag) + '"'
      + (st.excluded.has(tag) ? ' checked' : '') + '>'
      + '<span><span class="n">' + esc(tag) + '</span><br><span class="d">' + esc(desc) + '</span></span></label>';
  }).join('');
  box.querySelectorAll('input[data-tag]').forEach(cb => {
    cb.onchange = () => {
      const tag = cb.getAttribute('data-tag');
      if (cb.checked) st.excluded.add(tag); else st.excluded.delete(tag);
      const chip = $('#agypii-tagchip');
      if (chip) {
        chip.classList.toggle('on', st.excluded.size > 0);
        chip.querySelector('span').textContent = st.excluded.size
          ? st.excluded.size + ' tag esclusi' : 'Tutti i tag attivi';
      }
    };
  });
}

// ── mount ────────────────────────────────────────────────────────────────
const SHELL = `
<div class="agypii">
  <div class="agypii-top">
    <div class="agypii-brand">
      <span class="agypii-mark">__SHIELD__</span>
      <span>PII<small>motore Rizzo-PII · in locale, niente esce da qui</small></span>
    </div>
    <span class="agypii-pill" id="agypii-health"><span class="agypii-dot"></span> controllo motore…</span>
  </div>

  <div class="agypii-grid">
    <div class="agypii-card">
      <div class="agypii-tabs">
        <button class="agypii-tab on" data-in="text">Testo</button>
        <button class="agypii-tab" data-in="file">Documento</button>
      </div>

      <div class="agypii-pane flex on" id="agypii-in-text">
        <textarea class="agypii-ta" id="agypii-text"
          placeholder="Incolla qui il testo da anonimizzare: contratti, verbali, email, note del cliente…"></textarea>
      </div>

      <div class="agypii-pane flex" id="agypii-in-file">
        <div class="agypii-drop" id="agypii-drop">
          __UPLOAD__
          <h4>Trascina un documento qui</h4>
          <p>PDF, TXT o Markdown — oppure clicca per sceglierlo</p>
        </div>
        <input type="file" id="agypii-fileinput" accept=".pdf,.txt,.md,.markdown" hidden>
        <div id="agypii-fileinfo"></div>
      </div>

      <div style="padding:0 14px 14px">
        <div class="agypii-opts">
          <button class="agypii-chip" id="agypii-tagchip"><span>Tutti i tag attivi</span></button>
          <button class="agypii-chip on" id="agypii-mapchip">
            <span class="agypii-sw"></span><span>Dizionario reversibile</span>
          </button>
        </div>
        <div id="agypii-tagbox" style="display:none"><div class="agypii-taglist" id="agypii-taglist"></div></div>
        <div class="agypii-acts">
          <button class="agypii-btn primary" id="agypii-run">__PLAY__ Analizza</button>
          <button class="agypii-btn" id="agypii-preview">__PDF__ Anteprima PDF</button>
          <button class="agypii-btn" id="agypii-pdf">__PDF__ Scarica PDF</button>
          <button class="agypii-btn" id="agypii-save">__SAVE__ Salva per l’agente</button>
        </div>
        <div class="agypii-msg"></div>
      </div>
    </div>

    <div class="agypii-card">
      <div class="agypii-tabs">
        <button class="agypii-tab on" data-out="preview">Anteprima</button>
        <button class="agypii-tab" data-out="clean">Anonimizzato</button>
        <button class="agypii-tab" data-out="ents">Entità</button>
        <button class="agypii-tab" data-out="pdf">PDF</button>
        <button class="agypii-tab" data-out="decode">Decodifica</button>
      </div>
      <div class="agypii-pane on" id="agypii-pane-preview"></div>
      <div class="agypii-pane" id="agypii-pane-clean"></div>
      <div class="agypii-pane" id="agypii-pane-ents"></div>
      <div class="agypii-pane" id="agypii-pane-pdf"></div>
      <div class="agypii-pane" id="agypii-pane-decode"></div>
    </div>
  </div>
</div>`;

function pickFile(f) {
  st.file = f || null;
  const info = $('#agypii-fileinfo');
  if (!info) return;
  info.innerHTML = st.file
    ? '<div class="agypii-file">' + ICONS.pdf + '<span>' + esc(st.file.name) + '</span>'
      + '<span style="color:var(--text-muted)">' + fmtBytes(st.file.size) + '</span>'
      + '<button id="agypii-filedrop" title="Rimuovi">&times;</button></div>'
    : '';
  const rm = $('#agypii-filedrop');
  if (rm) rm.onclick = () => pickFile(null);
}

async function checkHealth() {
  const pill = $('#agypii-health');
  if (!pill) return;
  try {
    const res = await fetch(API + '/health', { headers: authHeaders() });
    const d = await res.json();
    if (res.ok && d.available !== false) {
      pill.innerHTML = '<span class="agypii-dot ok"></span> '
        + esc(d.model || 'motore attivo') + ' · ' + esc(d.device || 'cpu');
    } else {
      pill.innerHTML = '<span class="agypii-dot ko"></span> motore non raggiungibile';
    }
  } catch (e) {
    pill.innerHTML = '<span class="agypii-dot ko"></span> motore non raggiungibile';
  }
}

async function loadTags() {
  try {
    const res = await fetch(ENGINE + '/settings', { headers: authHeaders() });
    if (!res.ok) return;
    const d = await res.json();
    st.tags = d.tags || [];
    renderTags();
  } catch (e) { /* il catalogo e' un di piu': senza, si anonimizza tutto */ }
}

export async function mount(container, api) {
  host = container;

  if (!document.getElementById('agypii-styles')) {
    const style = document.createElement('style');
    style.id = 'agypii-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  container.innerHTML = SHELL
    .replace('__SHIELD__', ICONS.shield)
    .replace('__UPLOAD__', ICONS.upload)
    .replace('__PLAY__', ICONS.play)
    .replace(/__PDF__/g, ICONS.pdf)
    .replace('__SAVE__', ICONS.save);
  root = container.querySelector('.agypii');

  // tab input (testo / documento)
  $$('.agypii-tab[data-in]').forEach(t => {
    t.onclick = () => {
      st.mode = t.getAttribute('data-in');
      $$('.agypii-tab[data-in]').forEach(x => x.classList.toggle('on', x === t));
      const isText = st.mode === 'text';
      $('#agypii-in-text').classList.toggle('on', isText);
      $('#agypii-in-file').classList.toggle('on', !isText);
    };
  });

  // tab output
  $$('.agypii-tab[data-out]').forEach(t => {
    t.onclick = () => { st.outTab = t.getAttribute('data-out'); renderOut(); };
  });

  // file: click, dialog, drag & drop
  const drop = $('#agypii-drop');
  const input = $('#agypii-fileinput');
  drop.onclick = () => input.click();
  input.onchange = () => pickFile(input.files && input.files[0]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
    e.preventDefault(); drop.classList.add('hot');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => {
    e.preventDefault(); drop.classList.remove('hot');
  }));
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) pickFile(f);
  });

  // opzioni
  const tagchip = $('#agypii-tagchip');
  tagchip.onclick = () => {
    const box = $('#agypii-tagbox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  };
  const mapchip = $('#agypii-mapchip');
  mapchip.onclick = () => {
    st.mapping = !st.mapping;
    mapchip.classList.toggle('on', st.mapping);
  };

  // azioni
  $('#agypii-run').onclick = doAnalyze;
  $('#agypii-preview').onclick = () => doPdf(true);
  $('#agypii-pdf').onclick = () => doPdf(false);
  $('#agypii-save').onclick = doSaveForAgent;

  renderOut();
  checkHealth();
  loadTags();
}

export function unmount() {
  if (host) host.innerHTML = '';
  root = null;
  host = null;
  st.result = null;
  st.doc = null;
  st.file = null;
}
