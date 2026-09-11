/**
 * AGYUI Notebook — Gemini Notebook (NotebookLM) dentro l'interfaccia AGYUI.
 * Frontend puro: parla con il server del plugin via RPC (/api/plugins/agyui-plugin-notebook/rpc/*),
 * che a sua volta chiama la CLI "nlm". Vedi README.md per il setup del login.
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
.agynb-nbitem .agynb-del { opacity:0; background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; padding:2px; }
.agynb-nbitem:hover .agynb-del { opacity:1; }
.agynb-empty-side { padding:20px 14px; text-align:center; color:var(--text-muted,#94a3b8); font-size:.76rem; }

.agynb-main { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
.agynb-nbheader { padding:14px 18px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08));
  display:flex; align-items:center; justify-content:space-between; gap:10px; }
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
.agynb-sel { padding:8px 10px; background:var(--bg-main,#06080F); color:var(--text-main,#cbd5e1);
  border:1px solid var(--border-color,rgba(255,255,255,.08)); border-radius:var(--radius-sm,8px); font-size:.76rem; }
.agynb-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 13px; cursor:pointer;
  border-radius:var(--radius-sm,8px); border:1px solid var(--border-color,rgba(255,255,255,.08));
  background:rgba(255,255,255,.04); color:var(--text-main,#cbd5e1); font-size:.76rem; font-weight:600; white-space:nowrap; }
.agynb-btn:hover:not(:disabled) { background:var(--bg-hover,#1c2438); }
.agynb-btn:disabled { opacity:.45; cursor:not-allowed; }
.agynb-btn.primary { border:none; color:#fff; background:linear-gradient(135deg, var(--accent-cyan,#06b6d4), var(--accent-violet,#8b5cf6)); }
.agynb-btn svg { width:14px; height:14px; }

.agynb-tag { display:inline-flex; gap:5px; padding:3px 9px; border-radius:999px; cursor:pointer;
  font-family:var(--font-mono,monospace); font-size:.68rem; border:1px solid var(--border-color,rgba(255,255,255,.08));
  color:var(--text-muted,#94a3b8); background:rgba(255,255,255,.03); }
.agynb-tag.on { border-color:rgba(6,182,212,.45); color:var(--accent,#06b6d4); background:rgba(6,182,212,.08); }

.agynb-src { display:flex; align-items:center; gap:9px; padding:9px 11px; border-radius:9px;
  background:rgba(255,255,255,.02); border:1px solid var(--border-color,rgba(255,255,255,.06)); margin-bottom:6px; }
.agynb-src .t { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.78rem; }
.agynb-src .agynb-del { background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; }

.agynb-chatlog { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
.agynb-msg { padding:10px 13px; border-radius:var(--radius-md,12px); font-size:.82rem; line-height:1.6; max-width:85%; }
.agynb-msg.q { align-self:flex-end; background:rgba(6,182,212,.12); border:1px solid rgba(6,182,212,.25); }
.agynb-msg.a { align-self:flex-start; background:rgba(255,255,255,.04); border:1px solid var(--border-color,rgba(255,255,255,.08));
  white-space:pre-wrap; }

.agynb-art { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:9px;
  background:rgba(255,255,255,.02); border:1px solid var(--border-color,rgba(255,255,255,.06)); margin-bottom:6px; }
.agynb-art .t { flex:1; font-size:.78rem; }
.agynb-art svg { width:16px; height:16px; flex-shrink:0; }
.agynb-badge { padding:2px 8px; border-radius:999px; font-family:var(--font-mono,monospace); font-size:.64rem; font-weight:700; }
.agynb-badge.ready { background:rgba(16,185,129,.15); color:#6ee7b7; }
.agynb-badge.pending { background:rgba(245,158,11,.15); color:#fcd34d; }
.agynb-badge.error { background:rgba(239,68,68,.15); color:#fca5a5; }

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
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
  quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12" y1="17" y2="17.01"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="6" rx="2"/><path d="M3 10h18"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.5"/><circle cx="5" cy="16" r="2.5"/><circle cx="19" cy="16" r="2.5"/><path d="M12 8.5v3M9.5 14 11 10M14.5 14 13 10"/></svg>',
  slides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  loader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>'
};

const STUDIO_TYPES = [
  { kind: 'audio', label: 'Podcast', icon: 'mic', opts: { format: ['deep_dive', 'brief', 'critique', 'debate'], length: ['short', 'default', 'long'] } },
  { kind: 'report', label: 'Report', icon: 'doc', opts: { format: ['Briefing Doc', 'Study Guide', 'Blog Post'] } },
  { kind: 'quiz', label: 'Quiz', icon: 'quiz', opts: { difficulty: ['easy', 'medium', 'hard'] } },
  { kind: 'flashcards', label: 'Flashcard', icon: 'cards', opts: { difficulty: ['easy', 'medium', 'hard'] } },
  { kind: 'mindmap', label: 'Mappa mentale', icon: 'map', opts: {} },
  { kind: 'slides', label: 'Slide', icon: 'slides', opts: {} }
];

// ── stato ────────────────────────────────────────────────────────────────
const st = {
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
let rpc = null; // api.rpc(method, path, body) fornita da plugins.js

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const $ = (sel) => root && root.querySelector(sel);
const $$ = (sel) => root ? Array.from(root.querySelectorAll(sel)) : [];

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

// Il token per l'auth verso /api/plugins/*/rpc/* lo mette gia' plugins.js;
// qui basta chiamare rpc() e gestire l'errore che arriva dal server del plugin
// (spawna "nlm", quindi i messaggi sono spesso testo umano, non solo JSON).
async function call(method, path, body) {
  const data = await rpc(method, path, body);
  if (data && data.error) throw new Error(data.error);
  return data;
}

async function checkHealth() {
  const pill = $('#agynb-health');
  if (!pill) return;
  try {
    const d = await call('GET', '/health');
    pill.innerHTML = d.available
      ? '<span class="agynb-dot ok"></span> account collegato'
      : '<span class="agynb-dot ko"></span> non collegato — vedi README del plugin';
  } catch (e) {
    pill.innerHTML = '<span class="agynb-dot ko"></span> non raggiungibile';
  }
}

async function loadNotebooks() {
  const list = $('#agynb-nblist');
  if (!list) return;
  list.innerHTML = '<div class="agynb-empty-side">Caricamento…</div>';
  try {
    const data = await call('GET', '/notebooks');
    st.notebooks = Array.isArray(data) ? data : (data.notebooks || []);
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
      <span class="t">${esc(n.emoji ? n.emoji + ' ' : '')}${esc(n.title || n.name || 'Senza titolo')}</span>
      <button class="agynb-del" title="Elimina" onclick="event.stopPropagation(); window.agyNotebookPlugin.deleteNotebook('${esc(n.id)}')">${ICONS.trash}</button>
    </div>
  `).join('');
  renderMain();
}

async function selectNotebook(id) {
  st.activeId = id;
  st.sources = [];
  st.studio = [];
  st.chatLog = [];
  $$('.agynb-nbitem').forEach((el) => el.classList.remove('on'));
  await loadNotebooks();
}

async function createNotebook() {
  const title = prompt('Titolo del nuovo notebook:');
  if (!title || !title.trim()) return;
  try {
    const data = await call('POST', '/notebooks', { title: title.trim() });
    setMsg('', '');
    await loadNotebooks();
    if (data && data.id) selectNotebook(data.id);
  } catch (e) {
    alert('Errore creazione notebook: ' + e.message);
  }
}

async function deleteNotebook(id) {
  const nb = st.notebooks.find((n) => n.id === id);
  if (!confirm(`Eliminare il notebook "${nb ? (nb.title || nb.name) : id}"? L'operazione e' irreversibile su Gemini Notebook.`)) return;
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
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/sources`);
    st.sources = Array.isArray(data) ? data : (data.sources || []);
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
      <span class="t" title="${esc(s.title || s.url || s.id)}">${esc(s.title || s.url || s.id)}</span>
      <button class="agynb-del" title="Rimuovi" onclick="window.agyNotebookPlugin.deleteSource('${esc(s.id)}')">${ICONS.trash}</button>
    </div>
  `).join('');
}

async function deleteSource(id) {
  if (!confirm('Rimuovere questa fonte dal notebook?')) return;
  try {
    await call('DELETE', '/sources/' + encodeURIComponent(id));
  } catch (e) { /* alcune versioni di nlm vogliono la rotta sotto /notebooks: ignoriamo e ricarichiamo comunque */ }
  loadSources();
}

async function addSourceUrl() {
  const input = $('#agynb-src-url');
  const url = input.value.trim();
  if (!url) return;
  await addSourceCommon({ url }, input);
}

async function addSourceYoutube() {
  const input = $('#agynb-src-yt');
  const url = input.value.trim();
  if (!url) return;
  await addSourceCommon({ youtube: url }, input);
}

async function addSourceText() {
  const ta = $('#agynb-src-text');
  const titleInput = $('#agynb-src-text-title');
  const text = ta.value.trim();
  if (!text) return;
  await addSourceCommon({ text, title: titleInput.value.trim() || undefined }, ta, [titleInput]);
}

async function addSourceFile(file) {
  if (!file) return;
  setMsg('', '');
  const btn = $('#agynb-src-file-label');
  if (btn) btn.textContent = 'Caricamento…';
  try {
    const buf = await file.arrayBuffer();
    const b64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));
    const nb = activeNotebook();
    await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/sources`, { fileName: file.name, fileData: b64 });
    setMsg('ok', 'Fonte "' + file.name + '" aggiunta.');
    loadSources();
  } catch (e) {
    setMsg('err', e.message);
  } finally {
    if (btn) btn.innerHTML = ICONS.upload + ' Carica file';
  }
}

async function addSourceCommon(payload, clearEl, alsoClear) {
  const nb = activeNotebook();
  if (!nb) return;
  setMsg('', '');
  try {
    await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/sources`, payload);
    if (clearEl) clearEl.value = '';
    (alsoClear || []).forEach((el) => { if (el) el.value = ''; });
    setMsg('ok', 'Fonte aggiunta.');
    loadSources();
  } catch (e) {
    setMsg('err', e.message);
  }
}

// ── tab Chat ─────────────────────────────────────────────────────────────
function renderChatLog() {
  const box = $('#agynb-chatlog');
  if (!box) return;
  box.innerHTML = st.chatLog.map((m) => `<div class="agynb-msg ${m.role}">${esc(m.text)}</div>`).join('')
    || '<p style="color:var(--text-muted); font-size:.78rem;">Fai una domanda sulle fonti di questo notebook.</p>';
  box.scrollTop = box.scrollHeight;
}

async function sendQuery() {
  const nb = activeNotebook();
  const input = $('#agynb-chat-input');
  const question = input.value.trim();
  if (!nb || !question) return;
  input.value = '';
  st.chatLog.push({ role: 'q', text: question });
  st.chatLog.push({ role: 'a', text: '…' });
  renderChatLog();
  const btn = $('#agynb-chat-send');
  if (btn) btn.disabled = true;
  try {
    const data = await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/query`, { question });
    st.chatLog[st.chatLog.length - 1] = { role: 'a', text: data.answer || data.response || JSON.stringify(data) };
  } catch (e) {
    st.chatLog[st.chatLog.length - 1] = { role: 'a', text: 'Errore: ' + e.message };
  } finally {
    if (btn) btn.disabled = false;
    renderChatLog();
  }
}

// ── tab Studio ───────────────────────────────────────────────────────────
function studioStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('fail') || s.includes('error')) return 'error';
  if (s.includes('ready') || s.includes('complet') || s.includes('done')) return 'ready';
  return 'pending';
}

async function loadStudio() {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/studio`);
    st.studio = Array.isArray(data) ? data : (data.artifacts || data.items || []);
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
    const cls = studioStatusClass(a.status);
    const kindMeta = STUDIO_TYPES.find((t) => t.kind === (a.type || a.kind)) || STUDIO_TYPES[0];
    return `
      <div class="agynb-art">
        ${ICONS[kindMeta.icon] || ICONS.doc}
        <span class="t">${esc(a.title || kindMeta.label)}</span>
        <span class="agynb-badge ${cls}">${esc(a.status || '—')}</span>
        ${cls === 'ready' ? `<button class="agynb-btn" onclick="window.agyNotebookPlugin.downloadArtifact('${esc(a.id)}','${esc(a.type || a.kind || kindMeta.kind)}')">${ICONS.download}</button>` : ''}
        <button class="agynb-del" title="Elimina" onclick="window.agyNotebookPlugin.deleteArtifact('${esc(a.id)}')">${ICONS.trash}</button>
      </div>
    `;
  }).join('');
}

async function createStudio(kind) {
  const nb = activeNotebook();
  if (!nb) return;
  const meta = STUDIO_TYPES.find((t) => t.kind === kind);
  const payload = { kind };
  if (meta && meta.opts.format) payload.format = meta.opts.format[0];
  if (meta && meta.opts.length) payload.length = meta.opts.length[1] || meta.opts.length[0];
  if (meta && meta.opts.difficulty) payload.difficulty = meta.opts.difficulty[1] || meta.opts.difficulty[0];

  setMsg('', '');
  const btn = $(`.agynb-studio-create[data-kind="${kind}"]`);
  if (btn) { btn.disabled = true; btn.innerHTML = ICONS.loader.replace('<svg', '<svg class="agynb-spin"'); }
  try {
    await call('POST', `/notebooks/${encodeURIComponent(nb.id)}/studio`, payload);
    setMsg('ok', (meta ? meta.label : 'Contenuto') + ' in generazione: può richiedere qualche minuto.');
    loadStudio();
  } catch (e) {
    setMsg('err', e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = (ICONS[meta.icon] || ICONS.doc) + ' ' + meta.label; }
  }
}

async function downloadArtifact(id, kind) {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    const token = localStorage.getItem('agy_pin') || '';
    const url = `/api/plugins/agyui-plugin-notebook/rpc/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(id)}?kind=${encodeURIComponent(kind)}`
      + (token ? '&token=' + encodeURIComponent(token) : '');
    const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || ('HTTP ' + res.status));
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^";]+)"?/);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = m ? m[1] : ('notebook-' + id);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) {
    setMsg('err', 'Download non riuscito: ' + e.message);
  }
}

async function deleteArtifact(id) {
  const nb = activeNotebook();
  if (!nb || !confirm('Eliminare questo contenuto Studio?')) return;
  try {
    await call('DELETE', `/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(id)}`);
    loadStudio();
  } catch (e) {
    alert('Errore eliminazione: ' + e.message);
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
    <div class="agynb-nbheader">
      <span class="agynb-nbtitle">${esc(nb.emoji ? nb.emoji + ' ' : '')}${esc(nb.title || nb.name || 'Senza titolo')}</span>
    </div>
    <div class="agynb-tabs">
      <button class="agynb-tab" data-tab="sources">Fonti</button>
      <button class="agynb-tab" data-tab="chat">Chat</button>
      <button class="agynb-tab" data-tab="studio">Studio</button>
    </div>

    <div class="agynb-pane" id="agynb-pane-sources">
      <div class="agynb-card">
        <div class="agynb-row" style="margin-bottom:8px;">
          <input type="text" id="agynb-src-url" class="agynb-inp" placeholder="https://... (pagina web)">
          <button class="agynb-btn" id="agynb-add-url">${ICONS.link} Aggiungi URL</button>
        </div>
        <div class="agynb-row" style="margin-bottom:8px;">
          <input type="text" id="agynb-src-yt" class="agynb-inp" placeholder="Link YouTube">
          <button class="agynb-btn" id="agynb-add-yt">${ICONS.youtube} Aggiungi video</button>
        </div>
        <div class="agynb-row" style="margin-bottom:8px;">
          <input type="file" id="agynb-src-file" hidden accept=".pdf,.txt,.md,.docx">
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
        <p style="margin:0 0 10px; font-size:.76rem; color:var(--text-muted);">Genera contenuti dalle fonti del notebook (richiede almeno una fonte). La generazione gira lato Google, può richiedere qualche minuto.</p>
        <div class="agynb-row">
          ${STUDIO_TYPES.map((t) => `<button class="agynb-btn agynb-studio-create" data-kind="${t.kind}">${ICONS[t.icon]} ${t.label}</button>`).join('')}
        </div>
      </div>
      <div id="agynb-studio-list"></div>
    </div>

    <div class="agynb-msgbar" id="agynb-msg"></div>
  `;

  $$('.agynb-tab').forEach((tab) => {
    tab.onclick = () => switchTab(tab.getAttribute('data-tab'));
  });
  $('#agynb-add-url').onclick = addSourceUrl;
  $('#agynb-add-yt').onclick = addSourceYoutube;
  $('#agynb-add-text').onclick = addSourceText;
  $('#agynb-src-file').onchange = (e) => addSourceFile(e.target.files && e.target.files[0]);
  $('#agynb-chat-send').onclick = sendQuery;
  $('#agynb-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
  });
  $$('.agynb-studio-create').forEach((btn) => {
    btn.onclick = () => createStudio(btn.getAttribute('data-kind'));
  });

  switchTab(st.activeTab || 'sources');
  if (window.lucide) window.lucide.createIcons();
}

function switchTab(tab) {
  st.activeTab = tab;
  $$('.agynb-tab').forEach((t) => t.classList.toggle('on', t.getAttribute('data-tab') === tab));
  $$('.agynb-pane').forEach((p) => p.classList.toggle('on', p.id === 'agynb-pane-' + tab));
  if (tab === 'sources') loadSources();
  else if (tab === 'chat') renderChatLog();
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
  root = container.querySelector('.agynb');

  $('#agynb-new').onclick = createNotebook;

  window.agyNotebookPlugin = { selectNotebook, deleteNotebook, deleteSource, downloadArtifact, deleteArtifact };

  checkHealth();
  await loadNotebooks();
}

export function unmount() {
  if (host) host.innerHTML = '';
  root = null;
  host = null;
  delete window.agyNotebookPlugin;
}
