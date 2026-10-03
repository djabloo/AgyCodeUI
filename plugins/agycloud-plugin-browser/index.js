/**
 * Browser — scheda per il sotto-agente browser di agy (Google Antigravity).
 *
 * Il browser vero e' quello interno di agy (comando /browser), che pilota il
 * Chromium dell'ambiente: questo plugin non avvia processi propri, prepara la
 * richiesta e la manda alla Chat, dove l'agente la esegue. Lo stato di Chromium
 * arriva da /api/settings/browser/status (stessa rotta nel self-hosted e, via
 * gateway, nel container SaaS).
 */

const CSS = `
.agybr { display:flex; flex-direction:column; height:100%; overflow:auto;
  font-family: var(--font-family, sans-serif); color: var(--text-main, #cbd5e1); }
.agybr * { box-sizing:border-box; }
.agybr-top { display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  padding:14px 18px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08)); }
.agybr-brand { display:flex; align-items:center; gap:10px; font-family:var(--font-display, sans-serif);
  font-weight:800; font-size:1.05rem; color:var(--text-bright,#fff); }
.agybr-mark { width:30px; height:30px; border-radius:9px; display:grid; place-items:center;
  background:linear-gradient(135deg, rgba(6,182,212,.22), rgba(139,92,246,.22));
  border:1px solid rgba(6,182,212,.35); color:var(--accent,#06b6d4); }
.agybr-mark svg { width:17px; height:17px; }
.agybr-brand small { display:block; font-family:var(--font-mono,monospace); font-weight:500;
  font-size:.66rem; color:var(--text-muted,#94a3b8); }
.agybr-pill { margin-left:auto; display:inline-flex; align-items:center; gap:7px; padding:5px 11px;
  border-radius:999px; font-family:var(--font-mono,monospace); font-size:.68rem;
  border:1px solid var(--border-color,rgba(255,255,255,.08)); background:rgba(255,255,255,.03);
  color:var(--text-muted,#94a3b8); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.agybr-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; background:var(--text-muted,#94a3b8); }
.agybr-dot.ok { background:var(--success,#10b981); box-shadow:0 0 0 3px rgba(16,185,129,.15); }
.agybr-dot.ko { background:var(--danger,#ef4444); box-shadow:0 0 0 3px rgba(239,68,68,.15); }
.agybr-body { padding:18px; display:flex; flex-direction:column; gap:16px; max-width:860px; width:100%; margin:0 auto; }
.agybr-card { background:var(--bg-card, rgba(13,18,31,.85)); border:1px solid var(--border-color,rgba(255,255,255,.08));
  border-radius:var(--radius-lg,18px); padding:18px; display:flex; flex-direction:column; gap:12px; }
.agybr-label { font-size:.74rem; font-weight:700; color:var(--text-muted,#94a3b8); text-transform:uppercase; letter-spacing:.04em; }
.agybr-input, .agybr-text { width:100%; padding:11px 13px; border-radius:var(--radius-md,12px);
  border:1px solid var(--border-light, rgba(255,255,255,.15)); background:var(--bg-secondary,#121829);
  color:var(--text-bright,#fff); font:inherit; font-size:.9rem; outline:none; }
.agybr-input { font-family:var(--font-mono,monospace); font-size:.85rem; }
.agybr-text { min-height:92px; resize:vertical; }
.agybr-input:focus, .agybr-text:focus { border-color:var(--accent,#06b6d4); }
.agybr-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.agybr-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:var(--radius-md,12px);
  border:none; cursor:pointer; font:inherit; font-weight:700; font-size:.88rem; color:#fff;
  background:linear-gradient(90deg, var(--accent-cyan,#06b6d4), var(--accent-blue,#6366f1)); }
.agybr-btn:disabled { opacity:.5; cursor:not-allowed; }
.agybr-btn svg { width:16px; height:16px; }
.agybr-hint { font-size:.78rem; color:var(--text-muted,#94a3b8); }
.agybr-ex { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:10px; }
.agybr-chip { text-align:left; padding:11px 13px; border-radius:var(--radius-md,12px); cursor:pointer;
  border:1px solid var(--border-color,rgba(255,255,255,.08)); background:rgba(255,255,255,.03);
  color:var(--text-main,#cbd5e1); font:inherit; font-size:.82rem; line-height:1.35; }
.agybr-chip:hover { border-color:var(--accent,#06b6d4); color:var(--text-bright,#fff); }
.agybr-chip b { display:block; color:var(--text-bright,#fff); margin-bottom:3px; }
.agybr-warn { font-size:.82rem; color:var(--warning,#f59e0b); }
`;

const ICON_GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';

const EXAMPLES = [
  { title: 'Riassumi una pagina', task: 'Apri la pagina e riassumi i punti principali in italiano.' },
  { title: 'Controlla un sito', task: 'Apri la pagina, verifica che si carichi correttamente e descrivi cosa vedi, segnalando errori evidenti.' },
  { title: 'Estrai dati', task: 'Apri la pagina ed estrai in una tabella i dati principali (titoli, prezzi, date o contatti presenti).' },
  { title: 'Prova un modulo', task: 'Apri la pagina, trova il modulo principale e compilalo con dati di prova, SENZA inviarlo. Dimmi quali campi ci sono e se qualcosa non funziona.' },
  { title: 'Confronta pagine', task: 'Apri le pagine indicate e confrontale: cosa hanno in comune e cosa cambia.' },
  { title: 'Cerca sul web', task: 'Cerca sul web le informazioni piu\' recenti su questo argomento e citami le fonti.' },
];

const SHELL = `
<div class="agybr">
  <div class="agybr-top">
    <div class="agybr-brand"><span class="agybr-mark">${ICON_GLOBE}</span>
      <div>Browser<small>sotto-agente browser di agy</small></div></div>
    <span class="agybr-pill" id="agybr-status"><span class="agybr-dot"></span> verifica Chromium…</span>
  </div>
  <div class="agybr-body">
    <div class="agybr-card">
      <label class="agybr-label" for="agybr-url">Indirizzo (facoltativo)</label>
      <input class="agybr-input" id="agybr-url" type="url" placeholder="https://esempio.com" autocomplete="off" spellcheck="false">
      <label class="agybr-label" for="agybr-task">Cosa deve fare agy</label>
      <textarea class="agybr-text" id="agybr-task" placeholder="Es. apri la pagina e riassumi i punti principali"></textarea>
      <div class="agybr-row">
        <button class="agybr-btn" id="agybr-run">${ICON_PLAY} Avvia nella Chat</button>
        <span class="agybr-hint">La richiesta parte nella Chat: segui lì cosa fa l'agente.</span>
      </div>
      <div class="agybr-warn" id="agybr-warn" hidden></div>
    </div>
    <div class="agybr-card">
      <span class="agybr-label">Esempi</span>
      <div class="agybr-ex" id="agybr-ex"></div>
    </div>
  </div>
</div>`;

let host = null;
let root = null;

const $ = (sel) => root && root.querySelector(sel);

function authHeaders() {
  // self-hosted: PIN in localStorage. SaaS: cookie httpOnly, nessun header.
  const token = localStorage.getItem('agy_pin') || '';
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function checkChromium() {
  const pill = $('#agybr-status');
  try {
    const res = await fetch('/api/settings/browser/status', { headers: authHeaders() });
    const d = res.ok ? await res.json() : null;
    if (!root) return;
    if (d && d.installed) {
      pill.innerHTML = `<span class="agybr-dot ok"></span> ${escapeHtml(d.version || 'Chromium pronto')}`;
    } else {
      pill.innerHTML = '<span class="agybr-dot ko"></span> Chromium non trovato';
      const warn = $('#agybr-warn');
      warn.hidden = false;
      warn.textContent = "Su questo server non c'è Chrome/Chromium: agy non può aprire pagine finché non viene installato.";
    }
  } catch (e) {
    if (pill) pill.innerHTML = '<span class="agybr-dot ko"></span> stato non disponibile';
  }
}

function run() {
  const url = $('#agybr-url').value.trim();
  const task = $('#agybr-task').value.trim();
  const warn = $('#agybr-warn');
  if (!url && !task) {
    warn.hidden = false;
    warn.textContent = 'Scrivi un indirizzo o cosa deve fare agy.';
    return;
  }
  if (url && !/^https?:\/\//i.test(url)) {
    warn.hidden = false;
    warn.textContent = "L'indirizzo deve iniziare con http:// o https://";
    return;
  }
  warn.hidden = true;
  const prompt = ['/browser', url, task].filter(Boolean).join(' ');
  if (window.agyApp) window.agyApp.switchTab('chat-tab');
  if (window.agyChat && typeof window.agyChat.sendPrompt === 'function') {
    window.agyChat.sendPrompt(prompt);
  }
}

export async function mount(container) {
  host = container;
  if (!document.getElementById('agybr-styles')) {
    const style = document.createElement('style');
    style.id = 'agybr-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  container.innerHTML = SHELL;
  root = container.querySelector('.agybr');

  $('#agybr-ex').innerHTML = EXAMPLES.map((ex, i) =>
    `<button class="agybr-chip" data-i="${i}"><b>${escapeHtml(ex.title)}</b>${escapeHtml(ex.task)}</button>`).join('');
  root.querySelectorAll('.agybr-chip').forEach((b) => {
    b.onclick = () => {
      $('#agybr-task').value = EXAMPLES[Number(b.getAttribute('data-i'))].task;
      $('#agybr-task').focus();
    };
  });
  $('#agybr-run').onclick = run;
  $('#agybr-task').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run();
  });

  checkChromium();
}

export function unmount() {
  if (host) host.innerHTML = '';
  root = null;
  host = null;
}
