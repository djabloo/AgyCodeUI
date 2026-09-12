/**
 * AGYUI Notebook — frontend. Parla con il server del plugin via RPC
 * (/api/plugins/agyui-plugin-notebook/rpc/*) passando sempre il workspace
 * corrente (letto da /api/status, la stessa fonte usata dal resto della IDE),
 * cosi' segue automaticamente lo switch ambiente invece di restare fisso.
 */

const CSS = `
.agynb { display:flex; height:100%; overflow:hidden; font-family: var(--font-family, sans-serif); color: var(--text-main, #cbd5e1); }
.agynb * { box-sizing:border-box; }

.agynb-side { width:260px; flex:0 0 auto; display:flex; flex-direction:column; min-height:0;
  border-right:1px solid var(--border-color, rgba(255,255,255,.08)); background: var(--bg-card, rgba(13,18,31,.85)); }
.agynb-side-top { padding:14px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08)); }
.agynb-brand { display:flex; align-items:center; gap:9px; font-family:var(--font-display, sans-serif);
  font-weight:800; font-size:1rem; color:var(--text-bright,#fff); margin-bottom:8px; }
.agynb-brand .agynb-mark { width:26px; height:26px; border-radius:8px; display:grid; place-items:center;
  background:linear-gradient(135deg, rgba(6,182,212,.22), rgba(139,92,246,.22));
  border:1px solid rgba(6,182,212,.35); color:var(--accent,#06b6d4); flex-shrink:0; }
.agynb-brand .agynb-mark svg { width:15px; height:15px; }
.agynb-health { display:inline-flex; align-items:center; gap:6px; font-family:var(--font-mono,monospace);
  font-size:.66rem; color:var(--text-muted,#94a3b8); }
.agynb-dot { width:6px; height:6px; border-radius:50%; background:var(--text-muted,#94a3b8); flex-shrink:0; }
.agynb-dot.ok { background:var(--success,#10b981); }
.agynb-dot.ko { background:var(--danger,#ef4444); }
.agynb-newbtn { width:100%; margin-top:10px; display:flex; align-items:center; justify-content:center; gap:6px;
  padding:8px; border-radius:var(--radius-md,10px); border:none; cursor:pointer; color:#fff; font-size:.78rem; font-weight:600;
  background:linear-gradient(135deg, var(--accent-cyan,#06b6d4), var(--accent-violet,#8b5cf6)); }
.agynb-newbtn:hover { filter:brightness(1.1); }
.agynb-newbtn svg { width:14px; height:14px; flex-shrink:0; }

.agynb-nblist { flex:1; overflow-y:auto; padding:8px; }
.agynb-nbitem { display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:9px; cursor:pointer;
  font-size:.8rem; color:var(--text-main,#cbd5e1); }
.agynb-nbitem:hover { background:var(--bg-hover,#1c2438); }
.agynb-nbitem.on { background:rgba(6,182,212,.1); color:var(--text-bright,#fff); border:1px solid rgba(6,182,212,.3); }
.agynb-nbitem span.t { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.agynb-nbitem .agynb-del { opacity:0; background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; padding:2px; flex-shrink:0; }
.agynb-nbitem .agynb-del svg { width:13px; height:13px; }
.agynb-nbitem:hover .agynb-del { opacity:1; }
.agynb-empty-side { padding:20px 14px; text-align:center; color:var(--text-muted,#94a3b8); font-size:.76rem; }

.agynb-main { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.agynb-nbheader { padding:14px 18px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08)); }
.agynb-nbtitle { font-family:var(--font-display,sans-serif); font-weight:700; font-size:1.05rem; color:var(--text-bright,#fff); }
.agynb-tabs { display:flex; gap:2px; padding:0 18px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08)); }
.agynb-tab { padding:9px 14px; border:none; background:transparent; cursor:pointer; border-radius:9px 9px 0 0;
  font-family:var(--font-mono,monospace); font-size:.74rem; font-weight:600; color:var(--text-muted,#94a3b8); }
.agynb-tab:hover { color:var(--text-bright,#fff); }
.agynb-tab.on { color:var(--accent,#06b6d4); box-shadow:inset 0 -2px 0 var(--accent,#06b6d4); }
.agynb-pane { flex:1; overflow-y:auto; padding:18px; display:none; }
.agynb-pane.on { display:block; }
.agynb-pane-flex.on { display:flex; flex-direction:column; }
.agynb-empty { display:grid; place-content:center; justify-items:center; gap:10px; height:100%; min-height:220px;
  text-align:center; color:var(--text-muted,#94a3b8); }
.agynb-empty svg { width:32px; height:32px; opacity:.35; }
.agynb-empty p { margin:0; font-size:.78rem; max-width:360px; line-height:1.6; }

.agynb-card { background:var(--bg-card, rgba(13,18,31,.85)); border:1px solid var(--border-color, rgba(255,255,255,.08));
  border-radius:var(--radius-md,12px); padding:14px; margin-bottom:12px; }
.agynb-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.agynb-inp { flex:1; min-width:160px; padding:8px 11px; background:var(--bg-main,#06080F); color:var(--text-main,#cbd5e1);
  border:1px solid var(--border-color,rgba(255,255,255,.08)); border-radius:var(--radius-sm,8px);
  font-family:var(--font-family,sans-serif); font-size:.78rem; outline:none; }
.agynb-inp:focus { border-color:rgba(6,182,212,.5); }
.agynb-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 13px; cursor:pointer;
  border-radius:var(--radius-sm,8px); border:1px solid var(--border-color,rgba(255,255,255,.08));
  background:rgba(255,255,255,.04); color:var(--text-main,#cbd5e1); font-size:.76rem; font-weight:600; white-space:nowrap; }
.agynb-btn:hover:not(:disabled) { background:var(--bg-hover,#1c2438); }
.agynb-btn:disabled { opacity:.55; cursor:not-allowed; }
.agynb-btn.primary { border:none; color:#fff; background:linear-gradient(135deg, var(--accent-cyan,#06b6d4), var(--accent-violet,#8b5cf6)); }
.agynb-btn svg { width:14px; height:14px; flex-shrink:0; }

.agynb-src { display:flex; align-items:center; gap:9px; padding:9px 11px; border-radius:9px;
  background:rgba(255,255,255,.02); border:1px solid var(--border-color,rgba(255,255,255,.06)); margin-bottom:6px; }
.agynb-src .t { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.78rem; }
.agynb-src .agynb-del { background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; flex-shrink:0; }
.agynb-src .agynb-del svg { width:14px; height:14px; }

.agynb-chatlog { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
.agynb-msg { padding:10px 13px; border-radius:var(--radius-md,12px); font-size:.82rem; line-height:1.6; max-width:85%; }
.agynb-msg.q { align-self:flex-end; background:rgba(6,182,212,.12); border:1px solid rgba(6,182,212,.25); }
.agynb-msg.a { align-self:flex-start; background:rgba(255,255,255,.04); border:1px solid var(--border-color,rgba(255,255,255,.08)); }
.agynb-msg.a p:first-child { margin-top:0; } .agynb-msg.a p:last-child { margin-bottom:0; }

.agynb-art { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:9px; cursor:pointer;
  background:rgba(255,255,255,.02); border:1px solid var(--border-color,rgba(255,255,255,.06)); margin-bottom:6px; }
.agynb-art:hover { border-color:var(--border-light,rgba(255,255,255,.15)); }
.agynb-art svg.k { width:16px; height:16px; flex-shrink:0; color:var(--accent,#06b6d4); }
.agynb-art .t { flex:1; font-size:.78rem; }
.agynb-art .meta { font-family:var(--font-mono,monospace); font-size:.64rem; color:var(--text-muted,#94a3b8); }
.agynb-art button.agynb-del { background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; flex-shrink:0; }
.agynb-art button.agynb-del svg { width:14px; height:14px; }

.agynb-viewer { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:50; display:none; align-items:center; justify-content:center; padding:24px; }
.agynb-viewer.on { display:flex; }
.agynb-viewer-card { background:var(--bg-card,#0d1219); border:1px solid var(--border-color,rgba(255,255,255,.08));
  border-radius:var(--radius-lg,16px); width:min(760px,100%); max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
.agynb-viewer-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px;
  border-bottom:1px solid var(--border-color,rgba(255,255,255,.08)); }
.agynb-viewer-head span { font-weight:700; font-size:.86rem; color:var(--text-bright,#fff); }
.agynb-viewer-close { background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; font-size:1.1rem; }
.agynb-viewer-body { padding:18px 20px; overflow-y:auto; font-size:.84rem; line-height:1.7; }
.agynb-viewer-body table { border-collapse:collapse; width:100%; margin:8px 0; }
.agynb-viewer-body th, .agynb-viewer-body td { border:1px solid var(--border-color,rgba(255,255,255,.1)); padding:6px 10px; font-size:.78rem; }
.agynb-viewer-body pre { background:var(--bg-main,#06080F); padding:12px; border-radius:8px; overflow-x:auto; }
.agynb-viewer-body .mermaid { background:#fff; border-radius:10px; padding:14px; }
.agynb-viewer-foot { padding:10px 16px; border-top:1px solid var(--border-color,rgba(255,255,255,.08)); display:flex; justify-content:flex-end; }

.agynb-msgbar { padding:10px 12px; border-radius:var(--radius-md,10px); font-size:.76rem; margin-top:10px; display:none; }
.agynb-msgbar.on { display:block; }
.agynb-msgbar.err { background:rgba(239,68,68,.1); color:#fca5a5; border:1px solid rgba(239,68,68,.28); }
.agynb-msgbar.ok { background:rgba(16,185,129,.1); color:#6ee7b7; border:1px solid rgba(16,185,129,.28); }
.agynb-spin { animation:agynb-rot 1s linear infinite; }
@keyframes agynb-rot { to { transform:rotate(360deg); } }
`;

const ICONS = {
  notebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7"/><path d="M9 11h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12" y1="17" y2="17.01"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="6" rx="2"/><path d="M3 10h18"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.5"/><circle cx="5" cy="16" r="2.5"/><circle cx="19" cy="16" r="2.5"/><path d="M12 8.5v3M9.5 14 11 10M14.5 14 13 10"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  loader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
};

const STUDIO_TYPES = [
  { kind: 'report', label: 'Report', icon: 'doc' },
  { kind: 'quiz', label: 'Quiz', icon: 'quiz' },
  { kind: 'flashcards', label: 'Flashcard', icon: 'cards' },
  { kind: 'mindmap', label: 'Mappa mentale', icon: 'map' },
  { kind: 'datatable', label: 'Tabella dati', icon: 'table' }
];

// ── stato ────────────────────────────────────────────────────────────────
const st = {
  workspace: null,
  notebooks: [],
  activeId: null,
  activeTab: 'sources',
  sources: [],
  studio: [],
  chatLog: [],
  busy: false
};

let root = null;
let host = null;
let rpc = null;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const $ = (sel) => root && root.querySelector(sel);
const $$ = (sel) => root ? Array.from(root.querySelectorAll(sel)) : [];
const md = (text) => (window.marked ? window.marked.parse(text) : `<pre>${esc(text)}</pre>`);

function activeNotebook() {
  return st.notebooks.find((n) => n.id === st.activeId) || null;
}

function setMsg(kind, text) {
  const box = $('#agynb-msg');
  if (!box) return;
  if (!text) { box.className = 'agynb-msgbar'; box.textContent = ''; return; }
  box.className = 'agynb-msgbar on ' + kind;
  box.textContent = text;
}

// fetch() nel browser rifiuta un body su GET/HEAD ("Request with GET/HEAD
// method cannot have body") - per quei metodi il workspace va in query string,
// esattamente come si aspetta server.js (che legge searchParams solo per GET).
async function call(method, path, body) {
  const isRead = method === 'GET' || method === 'HEAD';
  let finalPath = path;
  let finalBody = null;
  if (isRead) {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = path + sep + 'workspace=' + encodeURIComponent(st.workspace || '');
  } else {
    finalBody = Object.assign({ workspace: st.workspace }, body || {});
  }
  const data = await rpc(method, finalPath, finalBody);
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function resolveWorkspace() {
  try {
    const token = localStorage.getItem('agy_pin') || '';
    const res = await fetch('/api/status', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    const data = await res.json();
    st.workspace = data.workspace || null;
  } catch (e) {
    st.workspace = null;
  }
}

async function checkHealth() {
  const pill = $('#agynb-health');
  if (!pill) return;
  try {
    const d = await call('GET', '/health');
    pill.innerHTML = d.available
      ? '<span class="agynb-dot ok"></span> motore agy attivo'
      : '<span class="agynb-dot ko"></span> agy non risponde';
  } catch (e) {
    pill.innerHTML = '<span class="agynb-dot ko"></span> non raggiungibile';
  }
}

async function loadNotebooks() {
  const list = $('#agynb-nblist');
  if (!list) return;
  if (!st.workspace) {
    list.innerHTML = '<div class="agynb-empty-side">Ambiente non rilevato.</div>';
    return;
  }
  list.innerHTML = '<div class="agynb-empty-side">Caricamento…</div>';
  try {
    st.notebooks = await call('GET', '/notebooks');
  } catch (e) {
    list.innerHTML = `<div class="agynb-empty-side">${esc(e.message)}</div>`;
    return;
  }
  if (!st.notebooks.length) {
    list.innerHTML = '<div class="agynb-empty-side">Nessun notebook ancora.<br>Creane uno con "+ Nuovo".</div>';
    renderMain();
    return;
  }
  if (!st.activeId || !activeNotebook()) st.activeId = st.notebooks[0].id;
  list.innerHTML = st.notebooks.map((n) => `
    <div class="agynb-nbitem ${n.id === st.activeId ? 'on' : ''}" onclick="window.agyNotebookPlugin.selectNotebook('${esc(n.id)}')">
      <span class="t">${esc(n.title || 'Senza titolo')}</span>
      <button class="agynb-del" title="Elimina" onclick="event.stopPropagation(); window.agyNotebookPlugin.deleteNotebook('${esc(n.id)}')">${ICONS.trash}</button>
    </div>
  `).join('');
  if (window.lucide) window.lucide.createIcons();
  renderMain();
}

function selectNotebook(id) {
  st.activeId = id;
  st.sources = [];
  st.studio = [];
  st.chatLog = [];
  loadNotebooks();
}

async function createNotebook() {
  const title = prompt('Titolo del nuovo notebook:');
  if (!title || !title.trim()) return;
  try {
    const nb = await call('POST', '/notebooks', { title: title.trim() });
    await loadNotebooks();
    selectNotebook(nb.id);
  } catch (e) {
    alert('Errore creazione notebook: ' + e.message);
  }
}

async function deleteNotebook(id) {
  const nb = st.notebooks.find((n) => n.id === id);
  if (!confirm(`Eliminare il notebook "${nb ? nb.title : id}" e tutte le sue fonti/contenuti? Non si può annullare.`)) return;
  try {
    await call('DELETE', '/notebooks/' + encodeURIComponent(id));
    if (st.activeId === id) st.activeId = null;
    await loadNotebooks();
  } catch (e) {
    alert('Errore eliminazione: ' + e.message);
  }
}

// ── tab Fonti ────────────────────────────────────────────────────────────
async function loadSources() {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    st.sources = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/sources`);
  } catch (e) {
    st.sources = [];
  }
  renderSourcesList();
}

function renderSourcesList() {
  const box = $('#agynb-sources-list');
  if (!box) return;
  if (!st.sources.length) {
    box.innerHTML = '<p style="color:var(--text-muted); font-size:.78rem;">Nessuna fonte ancora.</p>';
    return;
  }
  box.innerHTML = st.sources.map((s) => `
    <div class="agynb-src">
      <span class="t" title="${esc(s.name)}">${esc(s.name)}</span>
      <button class="agynb-del" title="Rimuovi" onclick="window.agyNotebookPlugin.deleteSource('${esc(s.name)}')">${ICONS.trash}</button>
    </div>
  `).join('');
  if (window.lucide) window.lucide.createIcons();
}

async function deleteSource(name) {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    await call('DELETE', `/notebooks/${encodeURIComponent(nb.id)}/sources/${encodeURIComponent(name)}`);
    loadSources();
  } catch (e) {
    alert('Errore rimozione: ' + e.message);
  }
}

async function addSourceUrl() {
  const input = $('#agynb-src-url');
  const url = input.value.trim();
  if (!url) return;
  await addSourceCommon({ url });
  input.value = '';
}

async function addSourceText() {
  const ta = $('#agynb-src-text');
  const titleInput = $('#agynb-src-text-title');
  const text = ta.value.trim();
  if (!text) return;
  await addSourceCommon({ text, title: titleInput.value.trim() || undefined });
  ta.value = '';
  titleInput.value = '';
}

async function addSourceFile(file) {
  if (!file) return;
  setMsg('', '');
  const label = $('#agynb-src-file-label');
  const original = label ? label.innerHTML : '';
  if (label) { label.innerHTML = ICONS.loader.replace('<svg', '<svg class="agynb-spin"') + ' Caricamento…'; label.disabled = true; }
  try {
    const buf = await file.arrayBuffer();
    const b64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));
    await addSourceCommon({ fileName: file.name, fileData: b64 }, true);
  } finally {
    if (label) { label.innerHTML = original; label.disabled = false; }
  }
}

async function addSourceCommon(payload, quiet) {
  const nb = activeNotebook();
  if (!nb) return;
  if (!quiet) setMsg('', '');
  try {
    await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/sources`, payload);
    setMsg('ok', 'Fonte aggiunta.');
    loadSources();
  } catch (e) {
    setMsg('err', e.message);
  }
}

// ── tab Chat ─────────────────────────────────────────────────────────────
async function loadChat() {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    st.chatLog = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/chat`);
  } catch (e) {
    st.chatLog = [];
  }
  renderChatLog();
}

function renderChatLog() {
  const box = $('#agynb-chatlog');
  if (!box) return;
  box.innerHTML = st.chatLog.map((m) => `<div class="agynb-msg ${m.role}">${m.role === 'a' ? md(m.text) : esc(m.text)}</div>`).join('')
    || '<p style="color:var(--text-muted); font-size:.78rem;">Fai una domanda: risponde solo in base alle fonti di questo notebook.</p>';
  box.scrollTop = box.scrollHeight;
}

async function sendQuery() {
  const nb = activeNotebook();
  const input = $('#agynb-chat-input');
  const question = input.value.trim();
  if (!nb || !question || st.busy) return;
  input.value = '';
  st.chatLog.push({ role: 'q', text: question });
  st.chatLog.push({ role: 'a', text: '…' });
  renderChatLog();
  st.busy = true;
  const btn = $('#agynb-chat-send');
  if (btn) btn.disabled = true;
  try {
    const data = await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/query`, { question });
    st.chatLog[st.chatLog.length - 1] = { role: 'a', text: data.answer };
  } catch (e) {
    st.chatLog[st.chatLog.length - 1] = { role: 'a', text: 'Errore: ' + esc(e.message) };
  } finally {
    st.busy = false;
    if (btn) btn.disabled = false;
    renderChatLog();
  }
}

// ── tab Studio ───────────────────────────────────────────────────────────
async function loadStudio() {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    st.studio = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/studio`);
  } catch (e) {
    st.studio = [];
  }
  renderStudioList();
}

function renderStudioList() {
  const box = $('#agynb-studio-list');
  if (!box) return;
  if (!st.studio.length) {
    box.innerHTML = '<p style="color:var(--text-muted); font-size:.78rem;">Nessun contenuto Studio ancora. Creane uno sopra.</p>';
    return;
  }
  box.innerHTML = st.studio.map((a) => {
    const meta = STUDIO_TYPES.find((t) => t.kind === a.kind) || STUDIO_TYPES[0];
    const when = new Date(a.mtime).toLocaleString();
    const iconSvg = (ICONS[meta.icon] || ICONS.doc).replace('<svg ', '<svg class="k" ');
    return `
      <div class="agynb-art" onclick="window.agyNotebookPlugin.openArtifact('${esc(a.name)}')">
        ${iconSvg}
        <span class="t">${esc(meta.label)}</span>
        <span class="meta">${esc(when)}</span>
        <button class="agynb-del" title="Elimina" onclick="event.stopPropagation(); window.agyNotebookPlugin.deleteArtifact('${esc(a.name)}')">${ICONS.trash}</button>
      </div>
    `;
  }).join('');
  if (window.lucide) window.lucide.createIcons();
}

async function createStudio(kind) {
  const nb = activeNotebook();
  if (!nb || st.busy) return;
  const meta = STUDIO_TYPES.find((t) => t.kind === kind);
  setMsg('', '');
  st.busy = true;
  const btn = $(`.agynb-studio-create[data-kind="${kind}"]`);
  const original = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = ICONS.loader.replace('<svg', '<svg class="agynb-spin"') + ' ' + meta.label + '…'; }
  try {
    await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/studio`, { kind });
    setMsg('ok', meta.label + ' generato.');
    loadStudio();
  } catch (e) {
    setMsg('err', e.message);
  } finally {
    st.busy = false;
    if (btn) { btn.disabled = false; btn.innerHTML = original; if (window.lucide) window.lucide.createIcons(); }
  }
}

async function deleteArtifact(name) {
  const nb = activeNotebook();
  if (!nb || !confirm('Eliminare questo contenuto Studio?')) return;
  try {
    await call('DELETE', `/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(name)}`);
    loadStudio();
  } catch (e) {
    alert('Errore eliminazione: ' + e.message);
  }
}

let mermaidLib = null;
async function loadMermaid() {
  if (mermaidLib) return mermaidLib;
  const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
  mod.default.initialize({ startOnLoad: false, theme: 'default' });
  mermaidLib = mod.default;
  return mermaidLib;
}

async function openArtifact(name) {
  const nb = activeNotebook();
  if (!nb) return;
  const viewer = $('#agynb-viewer');
  const titleEl = $('#agynb-viewer-title');
  const bodyEl = $('#agynb-viewer-body');
  titleEl.textContent = name;
  bodyEl.innerHTML = '<p style="color:var(--text-muted)">Caricamento…</p>';
  viewer.classList.add('on');
  $('#agynb-viewer-download').onclick = () => downloadArtifact(name);

  try {
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(name)}/content`);
    if (name.startsWith('mindmap-')) {
      const match = data.content.match(/```mermaid\n([\s\S]*?)```/);
      const code = match ? match[1].trim() : data.content.trim();
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render('agynb-mmd-' + Date.now(), code);
        bodyEl.innerHTML = `<div class="mermaid">${svg}</div>`;
      } catch (e) {
        bodyEl.innerHTML = `<p style="color:#fca5a5">Rendering mappa non riuscito: ${esc(e.message)}</p><pre>${esc(code)}</pre>`;
      }
    } else {
      bodyEl.innerHTML = md(data.content);
    }
  } catch (e) {
    bodyEl.innerHTML = `<p style="color:#fca5a5">${esc(e.message)}</p>`;
  }
}

function closeViewer() {
  $('#agynb-viewer').classList.remove('on');
}

async function downloadArtifact(name) {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(name)}/content`);
    const blob = new Blob([data.content], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) {
    alert('Download non riuscito: ' + e.message);
  }
}

// ── shell principale ─────────────────────────────────────────────────────
function renderMain() {
  const main = $('#agynb-main');
  if (!main) return;
  const nb = activeNotebook();

  if (!nb) {
    main.innerHTML = `<div class="agynb-empty">${ICONS.notebook}<p>Seleziona un notebook a sinistra, o creane uno nuovo per iniziare.</p></div>`;
    return;
  }

  main.innerHTML = `
    <div class="agynb-nbheader"><span class="agynb-nbtitle">${esc(nb.title)}</span></div>
    <div class="agynb-tabs">
      <button class="agynb-tab" data-tab="sources">Fonti</button>
      <button class="agynb-tab" data-tab="chat">Chat</button>
      <button class="agynb-tab" data-tab="studio">Studio</button>
    </div>

    <div class="agynb-pane" id="agynb-pane-sources">
      <div class="agynb-card">
        <div class="agynb-row" style="margin-bottom:8px;">
          <input type="text" id="agynb-src-url" class="agynb-inp" placeholder="https://... (pagina web, il testo verrà estratto)">
          <button class="agynb-btn" id="agynb-add-url">${ICONS.link} Aggiungi URL</button>
        </div>
        <div class="agynb-row" style="margin-bottom:8px;">
          <input type="file" id="agynb-src-file" hidden accept=".pdf,.txt,.md,.docx,.csv">
          <button class="agynb-btn" id="agynb-src-file-label" onclick="document.getElementById('agynb-src-file').click()">${ICONS.upload} Carica file</button>
        </div>
        <textarea id="agynb-src-text" class="agynb-inp" style="min-height:70px; width:100%; resize:vertical; margin-bottom:6px;" placeholder="Oppure incolla del testo come fonte…"></textarea>
        <div class="agynb-row">
          <input type="text" id="agynb-src-text-title" class="agynb-inp" placeholder="Titolo (opzionale)">
          <button class="agynb-btn" id="agynb-add-text">${ICONS.doc} Aggiungi testo</button>
        </div>
      </div>
      <div id="agynb-sources-list"></div>
    </div>

    <div class="agynb-pane agynb-pane-flex" id="agynb-pane-chat">
      <div class="agynb-chatlog" id="agynb-chatlog" style="flex:1; overflow-y:auto;"></div>
      <div class="agynb-row">
        <input type="text" id="agynb-chat-input" class="agynb-inp" placeholder="Fai una domanda sulle fonti di questo notebook…">
        <button class="agynb-btn primary" id="agynb-chat-send">${ICONS.send} Chiedi</button>
      </div>
    </div>

    <div class="agynb-pane" id="agynb-pane-studio">
      <div class="agynb-card">
        <p style="margin:0 0 10px; font-size:.76rem; color:var(--text-muted);">Genera contenuti dalle fonti del notebook (richiede almeno una fonte). Il motore è agy: legge le fonti e scrive il risultato, di solito in meno di un minuto.</p>
        <div class="agynb-row">
          ${STUDIO_TYPES.map((t) => `<button class="agynb-btn agynb-studio-create" data-kind="${t.kind}">${ICONS[t.icon]} ${t.label}</button>`).join('')}
        </div>
      </div>
      <div id="agynb-studio-list"></div>
    </div>

    <div class="agynb-msgbar" id="agynb-msg"></div>
  `;

  $$('.agynb-tab').forEach((tab) => { tab.onclick = () => switchTab(tab.getAttribute('data-tab')); });
  $('#agynb-add-url').onclick = addSourceUrl;
  $('#agynb-add-text').onclick = addSourceText;
  $('#agynb-src-file').onchange = (e) => addSourceFile(e.target.files && e.target.files[0]);
  $('#agynb-chat-send').onclick = sendQuery;
  $('#agynb-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
  });
  $$('.agynb-studio-create').forEach((btn) => { btn.onclick = () => createStudio(btn.getAttribute('data-kind')); });

  switchTab(st.activeTab || 'sources');
  if (window.lucide) window.lucide.createIcons();
}

function switchTab(tab) {
  st.activeTab = tab;
  $$('.agynb-tab').forEach((t) => t.classList.toggle('on', t.getAttribute('data-tab') === tab));
  $$('.agynb-pane').forEach((p) => p.classList.toggle('on', p.id === 'agynb-pane-' + tab));
  if (tab === 'sources') loadSources();
  else if (tab === 'chat') loadChat();
  else if (tab === 'studio') loadStudio();
}

const SHELL = `
<div class="agynb">
  <div class="agynb-side">
    <div class="agynb-side-top">
      <div class="agynb-brand"><span class="agynb-mark">__ICON__</span><span>Notebook</span></div>
      <span class="agynb-health" id="agynb-health"><span class="agynb-dot"></span> verifica…</span>
      <button class="agynb-newbtn" id="agynb-new">__PLUS__ Nuovo notebook</button>
    </div>
    <div class="agynb-nblist" id="agynb-nblist"></div>
  </div>
  <div class="agynb-main" id="agynb-main"></div>
</div>
<div class="agynb-viewer" id="agynb-viewer">
  <div class="agynb-viewer-card">
    <div class="agynb-viewer-head">
      <span id="agynb-viewer-title"></span>
      <button class="agynb-viewer-close" id="agynb-viewer-close">&times;</button>
    </div>
    <div class="agynb-viewer-body" id="agynb-viewer-body"></div>
    <div class="agynb-viewer-foot">
      <button class="agynb-btn" id="agynb-viewer-download">${ICONS.download} Scarica</button>
    </div>
  </div>
</div>`;

export async function mount(container, api) {
  host = container;
  rpc = api.rpc;

  if (!document.getElementById('agynb-styles')) {
    const style = document.createElement('style');
    style.id = 'agynb-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  container.innerHTML = SHELL.replace('__ICON__', ICONS.notebook).replace('__PLUS__', ICONS.plus);
  root = container;

  $('#agynb-new').onclick = createNotebook;
  $('#agynb-viewer-close').onclick = closeViewer;
  $('#agynb-viewer').onclick = (e) => { if (e.target.id === 'agynb-viewer') closeViewer(); };

  window.agyNotebookPlugin = { selectNotebook, deleteNotebook, deleteSource, deleteArtifact, openArtifact };

  await resolveWorkspace();
  checkHealth();
  await loadNotebooks();
}

export function unmount() {
  if (host) host.innerHTML = '';
  root = null;
  host = null;
  delete window.agyNotebookPlugin;
}
