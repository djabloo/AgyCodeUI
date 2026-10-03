/**
 * AgyCloud Notebook — frontend. Parla con il server del plugin via RPC
 * (/api/plugins/agyui-plugin-notebook/rpc/*) passando sempre il workspace
 * corrente (letto da /api/status, la stessa fonte usata dal resto della IDE),
 * cosi' segue automaticamente lo switch ambiente invece di restare fisso.
 */

const CSS = `
.agynb { display:flex; height:100%; overflow:hidden; position:relative; font-family: var(--font-family, sans-serif); color: var(--text-main, #cbd5e1); }
.agynb * { box-sizing:border-box; }

.agynb-side { width:260px; flex:0 0 auto; display:flex; flex-direction:column; min-height:0;
  border-right:1px solid var(--border-color, rgba(255,255,255,.08)); background: var(--bg-card, rgba(13,18,31,.85)); }
.agynb-side-top { padding:14px; border-bottom:1px solid var(--border-color, rgba(255,255,255,.08)); }
.agynb-brand-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.agynb-brand { display:flex; align-items:center; gap:9px; font-family:var(--font-display, sans-serif);
  font-weight:800; font-size:1rem; color:var(--text-bright,#fff); margin-bottom:8px; }
.agynb-brand .agynb-mark { width:26px; height:26px; border-radius:8px; display:grid; place-items:center;
  background:linear-gradient(135deg, rgba(6,182,212,.22), rgba(139,92,246,.22));
  border:1px solid rgba(6,182,212,.35); color:var(--accent,#06b6d4); flex-shrink:0; }
.agynb-brand .agynb-mark svg { width:15px; height:15px; }
.agynb-side-close, .agynb-side-open { display:none; align-items:center; justify-content:center;
  background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; padding:4px; flex-shrink:0; }
.agynb-side-close svg, .agynb-side-open svg { width:16px; height:16px; flex-shrink:0; }
.agynb-side-open { position:absolute; top:10px; left:10px; z-index:4; background:var(--bg-card,rgba(13,18,31,.9));
  border:1px solid var(--border-color,rgba(255,255,255,.08)); border-radius:8px; width:34px; height:34px; }
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
/* Il body dell'app ha "user-select:none" globale (per l'UX di drag/resize del
   resto dell'interfaccia): senza questa riga il testo del Notebook - risposte,
   fonti, contenuti - non era selezionabile/copiabile. */
.agynb-pane, .agynb-viewer-body { user-select:text; -webkit-user-select:text; }
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

.agynb-src { display:flex; align-items:center; gap:9px; padding:9px 11px; border-radius:9px; cursor:pointer;
  background:rgba(255,255,255,.02); border:1px solid var(--border-color,rgba(255,255,255,.06)); margin-bottom:6px; }
.agynb-src:hover { border-color:var(--border-light,rgba(255,255,255,.15)); }
.agynb-src .t { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.78rem; }
.agynb-src .agynb-del { background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; flex-shrink:0; }
.agynb-src .agynb-del svg { width:14px; height:14px; }

.agynb-chatlog { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
.agynb-msg { padding:10px 13px; border-radius:var(--radius-md,12px); font-size:.82rem; line-height:1.6; max-width:85%; }
.agynb-msg.q { align-self:flex-end; background:rgba(6,182,212,.12); border:1px solid rgba(6,182,212,.25); }
.agynb-msg.a { align-self:flex-start; background:rgba(255,255,255,.04); border:1px solid var(--border-color,rgba(255,255,255,.08)); }
.agynb-msg.a p:first-child { margin-top:0; } .agynb-msg.a p:last-child { margin-bottom:0; }
.agynb-thinking { display:flex; align-items:center; gap:4px; padding:14px 16px; }
.agynb-thinking span { width:6px; height:6px; border-radius:50%; background:var(--text-muted,#94a3b8); animation:agynb-think 1.2s ease-in-out infinite; }
.agynb-thinking span:nth-child(2) { animation-delay:.2s; } .agynb-thinking span:nth-child(3) { animation-delay:.4s; }
@keyframes agynb-think { 0%, 80%, 100% { opacity:.3; transform:scale(0.8); } 40% { opacity:1; transform:scale(1); } }

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
  border-radius:var(--radius-lg,16px); width:min(760px,100%); max-height:85vh; display:flex; flex-direction:column; overflow:hidden; transition:width .2s ease; }
.agynb-viewer-card.wide { width:min(1100px, 95vw); max-height:92vh; }
.agynb-viewer-iframe { width:100%; height:75vh; border:none; border-radius:8px; background:var(--bg-main,#06080F); display:block; }
.agynb-viewer-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px;
  border-bottom:1px solid var(--border-color,rgba(255,255,255,.08)); }
.agynb-viewer-head span { font-weight:700; font-size:.86rem; color:var(--text-bright,#fff); }
.agynb-viewer-close { background:none; border:none; color:var(--text-muted,#94a3b8); cursor:pointer; font-size:1.1rem; }
.agynb-viewer-body { padding:18px 20px; overflow-y:auto; font-size:.84rem; line-height:1.7; }
.agynb-viewer-body table { border-collapse:collapse; width:100%; margin:8px 0; }
.agynb-viewer-body th, .agynb-viewer-body td { border:1px solid var(--border-color,rgba(255,255,255,.1)); padding:6px 10px; font-size:.78rem; }
.agynb-viewer-body pre { background:var(--bg-main,#06080F); padding:12px; border-radius:8px; overflow-x:auto; }
.agynb-viewer-body .mermaid { background:#fff; border-radius:10px; padding:14px; }
/* AI Flashcards Interattive */
.agynb-fc-wrap { display:flex; flex-direction:column; gap:16px; align-items:center; width:100%; max-width:680px; margin:0 auto; user-select:none; }
.agynb-fc-topbar { display:flex; justify-content:space-between; align-items:center; width:100%; gap:12px; }
.agynb-fc-progress-wrap { flex:1; height:6px; background:rgba(255,255,255,.08); border-radius:9999px; overflow:hidden; }
.agynb-fc-progress-bar { height:100%; width:0%; background:linear-gradient(90deg, #06b6d4, #8b5cf6); transition:width .3s ease; }
.agynb-fc-viewmode { display:flex; gap:6px; }
.agynb-fc-viewmode button { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); color:var(--text-muted,#94a3b8); padding:4px 10px; border-radius:6px; font-size:.74rem; cursor:pointer; font-weight:600; }
.agynb-fc-viewmode button.active { background:rgba(6,182,212,.15); color:#38BDF8; border-color:rgba(6,182,212,.3); }

.agynb-fc-scene { width:100%; height:320px; perspective:1200px; cursor:pointer; }
.agynb-fc-card { width:100%; height:100%; position:relative; transform-style:preserve-3d; transition:transform .5s cubic-bezier(0.4, 0, 0.2, 1); border-radius:16px; }
.agynb-fc-card.flipped { transform:rotateY(180deg); }

.agynb-fc-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:16px; padding:28px 24px; display:flex; flex-direction:column; justify-content:space-between; border:1px solid rgba(255,255,255,.1); box-shadow:0 12px 32px rgba(0,0,0,.4); }
.agynb-fc-front { background:linear-gradient(145deg, #131B2E 0%, #0A0F1D 100%); color:#F8FAFC; }
.agynb-fc-back { background:linear-gradient(145deg, #0D2026 0%, #081418 100%); color:#F8FAFC; transform:rotateY(180deg); border-color:rgba(6,182,212,.35); }

.agynb-fc-badge { display:inline-flex; align-items:center; gap:6px; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; padding:4px 10px; border-radius:9999px; align-self:flex-start; font-family:var(--font-mono,monospace); }
.agynb-fc-front .agynb-fc-badge { background:rgba(99,102,241,.18); color:#A5B4FC; border:1px solid rgba(99,102,241,.3); }
.agynb-fc-back .agynb-fc-badge { background:rgba(16,185,129,.18); color:#6EE7B7; border:1px solid rgba(16,185,129,.3); }

.agynb-fc-content { font-size:1.15rem; font-weight:600; line-height:1.6; text-align:center; margin:auto 0; padding:10px; max-height:180px; overflow-y:auto; user-select:text; -webkit-user-select:text; }
.agynb-fc-back .agynb-fc-content { font-size:1.02rem; font-weight:400; color:#E2E8F0; }

.agynb-fc-hint { font-size:.74rem; color:var(--text-muted,#94a3b8); text-align:center; display:flex; align-items:center; justify-content:center; gap:6px; }

.agynb-fc-controls { display:flex; align-items:center; justify-content:space-between; width:100%; gap:10px; }
.agynb-fc-btn { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:var(--text-bright,#fff); padding:8px 16px; border-radius:9999px; font-size:.82rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all .2s ease; }
.agynb-fc-btn:hover:not(:disabled) { background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.25); transform:translateY(-1px); }
.agynb-fc-btn:disabled { opacity:.4; cursor:not-allowed; }
.agynb-fc-btn.flip { background:linear-gradient(135deg, rgba(6,182,212,.2), rgba(99,102,241,.2)); border-color:rgba(6,182,212,.4); }
.agynb-fc-counter { font-family:var(--font-mono,monospace); font-size:.82rem; color:var(--text-muted,#94a3b8); font-weight:600; }

.agynb-fc-listview { width:100%; display:flex; flex-direction:column; gap:12px; user-select:text; -webkit-user-select:text; }
.agynb-fc-item { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:16px; transition:border-color .2s ease; }
.agynb-fc-item:hover { border-color:rgba(6,182,212,.25); }
.agynb-fc-item-num { font-family:var(--font-mono,monospace); font-size:.7rem; color:var(--text-muted,#94a3b8); margin-bottom:4px; font-weight:700; text-transform:uppercase; }
.agynb-fc-item-q { font-weight:700; color:#38BDF8; font-size:.9rem; margin-bottom:8px; line-height:1.5; }
.agynb-fc-item-a { color:#E2E8F0; font-size:.84rem; line-height:1.6; }

.agynb-viewer-foot { padding:10px 16px; border-top:1px solid var(--border-color,rgba(255,255,255,.08)); display:flex; justify-content:flex-end; }

.agynb-msgbar { padding:10px 12px; border-radius:var(--radius-md,10px); font-size:.76rem; margin-top:10px; display:none; }
.agynb-msgbar.on { display:block; }
.agynb-msgbar.err { background:rgba(239,68,68,.1); color:#fca5a5; border:1px solid rgba(239,68,68,.28); }
.agynb-msgbar.ok { background:rgba(16,185,129,.1); color:#6ee7b7; border:1px solid rgba(16,185,129,.28); }
.agynb-spin { animation:agynb-rot 1s linear infinite; }
@keyframes agynb-rot { to { transform:rotate(360deg); } }

/* Sotto i 768px lista e contenuto non stanno affiancati (spazio insufficiente
   in verticale su telefono): la lista diventa un overlay a tutta larghezza,
   apribile/chiudibile, invece del layout fisso a due colonne di desktop. */
@media (max-width: 768px) {
  .agynb-side { position:absolute; inset:0; z-index:5; width:100%; }
  .agynb-side.agynb-side-hidden { display:none; }
  .agynb-side-close { display:flex; }
  .agynb-side-open { display:none; }
  .agynb-side-open.show { display:flex; }
  .agynb-main { width:100%; }
}
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
  loader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  infographic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 16V8"/><path d="M12 16v-4"/><path d="M17 16v-7"/></svg>',
  presentation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  gdrive: '<svg viewBox="0 0 87.3 78" style="width:14px; height:14px; vertical-align:middle;"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.25z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5l-25.4-44c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8z" fill="#ffba00"/><path d="m27.5 53-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.9c1.6 0 3.15-.45 4.5-1.2l-13.75-23.8z" fill="#2684fc"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>'
};

const STUDIO_TYPES = [
  { kind: 'audio_overview', label: 'Overview Audio', icon: 'mic' },
  { kind: 'report', label: 'Report', icon: 'doc' },
  { kind: 'presentation', label: 'Presentazione', icon: 'presentation' },
  { kind: 'infographic', label: 'Infografica', icon: 'infographic' },
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
  busy: false,
  // Sotto i 768px la lista notebook e il contenuto (Fonti/Chat/Studio) non
  // stanno affiancati: la lista diventa un overlay a tutta larghezza che si
  // apre/chiude, invece di stare sempre visibile come su desktop.
  sideOpen: true
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
  // Il parametro si chiama "wspath" e non "workspace" di proposito: nel SaaS
  // ogni richiesta passa anche dal gateway AgyCloud, che usa GIA' un
  // parametro/query "workspace" per instradare al container giusto (uno slug
  // tipo "default", non un percorso). Chiamandolo uguale, il gateway lo
  // intercettava prima ancora di arrivare qui e provava a instradare verso uno
  // slug inesistente (il nostro percorso assoluto) -> 404 solo in SaaS, mai in
  // self-hosted (li' non c'e' nessun gateway davanti). Vedi memoria progetto.
  const isRead = method === 'GET' || method === 'HEAD';
  let finalPath = path;
  let finalBody = null;
  if (isRead) {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = path + sep + 'wspath=' + encodeURIComponent(st.workspace || '');
  } else {
    finalBody = Object.assign({ wspath: st.workspace }, body || {});
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
  // Su mobile la lista e' un overlay: appena l'utente scegli un notebook, la
  // chiudiamo per lasciare tutto lo spazio al contenuto (Fonti/Chat/Studio).
  if (window.innerWidth <= 768) setSideOpen(false);
  loadNotebooks();
}

function setSideOpen(open) {
  st.sideOpen = open;
  const side = $('#agynb-side');
  const openBtn = $('#agynb-side-open');
  if (side) side.classList.toggle('agynb-side-hidden', !open);
  if (openBtn) openBtn.classList.toggle('show', !open);
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
    <div class="agynb-src" onclick="window.agyNotebookPlugin.openSource('${esc(s.name)}')">
      <span class="t" title="${esc(s.name)}">${esc(s.name)}</span>
      <button class="agynb-del" title="Rimuovi" onclick="event.stopPropagation(); window.agyNotebookPlugin.deleteSource('${esc(s.name)}')">${ICONS.trash}</button>
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

async function openSource(name) {
  const nb = activeNotebook();
  if (!nb) return;
  const viewer = $('#agynb-viewer');
  const card = $('#agynb-viewer-card');
  const extBtn = $('#agynb-viewer-external');
  const titleEl = $('#agynb-viewer-title');
  const bodyEl = $('#agynb-viewer-body');
  const downloadBtn = $('#agynb-viewer-download');
  titleEl.textContent = name;
  bodyEl.innerHTML = '<p style="color:var(--text-muted)">Caricamento…</p>';
  if (card) card.classList.remove('wide');
  if (extBtn) { extBtn.style.display = 'none'; extBtn.onclick = null; }
  viewer.classList.add('on');
  if (downloadBtn) downloadBtn.style.display = 'none';

  try {
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/sources/${encodeURIComponent(name)}/content`);
    bodyEl.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit;">${esc(data.content)}</pre>`;
  } catch (e) {
    bodyEl.innerHTML = `<p style="color:#fca5a5">${esc(e.message)}</p>`;
  } finally {
    if (downloadBtn) downloadBtn.style.display = '';
  }
}

async function addSourceUrl() {
  const input = $('#agynb-src-url');
  const url = input.value.trim();
  if (!url) return;
  const btn = $('#agynb-add-url');
  const original = btn ? btn.innerHTML : '';
  // Un link YouTube passa da agy (navigazione web + trascrizione): puo' richiedere
  // anche un minuto, molto piu' di una pagina web normale - senza uno stato di
  // caricamento visibile sembra che il pulsante non abbia fatto nulla.
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = ICONS.loader.replace('<svg', '<svg class="agynb-spin"') + ' Recupero contenuto…';
  }
  setMsg('', '');
  try {
    await addSourceCommon({ url }, true);
    input.value = '';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = original; }
  }
}

async function addSourceText() {
  const ta = $('#agynb-src-text');
  const titleInput = $('#agynb-src-text-title');
  const text = ta.value.trim();
  if (!text) return;
  const btn = $('#agynb-add-text');
  const original = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = ICONS.loader.replace('<svg', '<svg class="agynb-spin"') + ' Aggiungo…'; }
  setMsg('', '');
  try {
    await addSourceCommon({ text, title: titleInput.value.trim() || undefined }, true);
    ta.value = '';
    titleInput.value = '';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = original; }
  }
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
  box.innerHTML = st.chatLog.map((m) => m.thinking
    ? '<div class="agynb-msg a agynb-thinking"><span></span><span></span><span></span></div>'
    : `<div class="agynb-msg ${m.role}">${m.role === 'a' ? md(m.text) : esc(m.text)}</div>`
  ).join('')
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
  st.chatLog.push({ role: 'a', text: '', thinking: true });
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

let flashcardsKeyHandler = null;

function parseFlashcards(content) {
  const cards = [];
  const lines = (content || '').split('\n');
  let curF = null;
  let curB = null;
  let target = null;

  for (const rawLine of lines) {
    const l = rawLine.trim();
    const fMatch = l.match(/^(?:\*\*Fronte:\*\*|Fronte:|Front:|\*\*Front:\*\*)\s*(.*)/i);
    const rMatch = l.match(/^(?:\*\*Retro:\*\*|Retro:|Back:|\*\*Back:\*\*)\s*(.*)/i);

    if (fMatch) {
      if (curF && curB) {
        cards.push({ front: curF.trim(), back: curB.trim() });
        curB = null;
      }
      curF = fMatch[1];
      target = 'front';
    } else if (rMatch) {
      curB = rMatch[1];
      target = 'back';
    } else if (l) {
      if (target === 'front' && curF !== null) {
        curF += '\n' + l;
      } else if (target === 'back' && curB !== null) {
        curB += '\n' + l;
      }
    }
  }
  if (curF && curB) {
    cards.push({ front: curF.trim(), back: curB.trim() });
  }
  return cards;
}

function renderFlashcardsViewer(container, markdownContent) {
  const cards = parseFlashcards(markdownContent);
  if (!cards.length) {
    container.innerHTML = md(markdownContent);
    return;
  }

  let curIdx = 0;
  let isFlipped = false;
  let viewMode = 'deck'; // 'deck' | 'list'

  function update() {
    if (viewMode === 'list') {
      container.innerHTML = `
        <div class="agynb-fc-wrap">
          <div class="agynb-fc-topbar">
            <span class="agynb-fc-counter">${cards.length} flashcard create</span>
            <div class="agynb-fc-viewmode">
              <button id="agynb-fc-mode-deck">Deck 3D</button>
              <button id="agynb-fc-mode-list" class="active">Elenco</button>
            </div>
          </div>
          <div class="agynb-fc-listview">
            ${cards.map((c, i) => `
              <div class="agynb-fc-item">
                <div class="agynb-fc-item-num">Carta ${i + 1} di ${cards.length}</div>
                <div class="agynb-fc-item-q">Domanda: ${esc(c.front)}</div>
                <div class="agynb-fc-item-a">Risposta: ${esc(c.back)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      const btnDeck = $('#agynb-fc-mode-deck');
      if (btnDeck) btnDeck.onclick = () => { viewMode = 'deck'; update(); };
      return;
    }

    const card = cards[curIdx];
    const pct = Math.round(((curIdx + 1) / cards.length) * 100);

    container.innerHTML = `
      <div class="agynb-fc-wrap">
        <div class="agynb-fc-topbar">
          <span class="agynb-fc-counter">Carta ${curIdx + 1} di ${cards.length}</span>
          <div class="agynb-fc-progress-wrap">
            <div class="agynb-fc-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="agynb-fc-viewmode">
            <button id="agynb-fc-mode-deck" class="active">Deck 3D</button>
            <button id="agynb-fc-mode-list">Elenco</button>
          </div>
        </div>

        <div class="agynb-fc-scene" id="agynb-fc-scene" title="Clicca per girare">
          <div class="agynb-fc-card ${isFlipped ? 'flipped' : ''}" id="agynb-fc-card">
            <div class="agynb-fc-face agynb-fc-front">
              <span class="agynb-fc-badge">Domanda / Concetto</span>
              <div class="agynb-fc-content">${esc(card.front)}</div>
              <div class="agynb-fc-hint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                Clicca o premi Spazio per girare la carta
              </div>
            </div>
            <div class="agynb-fc-face agynb-fc-back">
              <span class="agynb-fc-badge">Risposta / Soluzione</span>
              <div class="agynb-fc-content">${esc(card.back)}</div>
              <div class="agynb-fc-hint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                Clicca o premi Spazio per tornare alla domanda
              </div>
            </div>
          </div>
        </div>

        <div class="agynb-fc-controls">
          <button class="agynb-fc-btn" id="agynb-fc-prev" ${curIdx === 0 ? 'disabled' : ''}>
            ← Precedente
          </button>
          <button class="agynb-fc-btn flip" id="agynb-fc-flip">
            ${isFlipped ? 'Mostra Domanda' : 'Gira Carta (Spazio)'}
          </button>
          <button class="agynb-fc-btn" id="agynb-fc-next" ${curIdx === cards.length - 1 ? 'disabled' : ''}>
            Successiva →
          </button>
        </div>
      </div>
    `;

    const sceneEl = $('#agynb-fc-scene');
    if (sceneEl) {
      sceneEl.onclick = () => {
        isFlipped = !isFlipped;
        const cardEl = $('#agynb-fc-card');
        if (cardEl) cardEl.classList.toggle('flipped', isFlipped);
        const flipBtn = $('#agynb-fc-flip');
        if (flipBtn) flipBtn.textContent = isFlipped ? 'Mostra Domanda' : 'Gira Carta (Spazio)';
      };
    }

    const flipBtn = $('#agynb-fc-flip');
    if (flipBtn) {
      flipBtn.onclick = (e) => {
        e.stopPropagation();
        isFlipped = !isFlipped;
        const cardEl = $('#agynb-fc-card');
        if (cardEl) cardEl.classList.toggle('flipped', isFlipped);
        flipBtn.textContent = isFlipped ? 'Mostra Domanda' : 'Gira Carta (Spazio)';
      };
    }

    const prevBtn = $('#agynb-fc-prev');
    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        if (curIdx > 0) { curIdx--; isFlipped = false; update(); }
      };
    }

    const nextBtn = $('#agynb-fc-next');
    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        if (curIdx < cards.length - 1) { curIdx++; isFlipped = false; update(); }
      };
    }

    const modeListBtn = $('#agynb-fc-mode-list');
    if (modeListBtn) {
      modeListBtn.onclick = () => { viewMode = 'list'; update(); };
    }
  }

  update();

  if (flashcardsKeyHandler) {
    window.removeEventListener('keydown', flashcardsKeyHandler);
  }
  flashcardsKeyHandler = (e) => {
    if (!$('#agynb-viewer')?.classList.contains('on') || viewMode !== 'deck') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      isFlipped = !isFlipped;
      const cardEl = $('#agynb-fc-card');
      if (cardEl) cardEl.classList.toggle('flipped', isFlipped);
      const flipBtn = $('#agynb-fc-flip');
      if (flipBtn) flipBtn.textContent = isFlipped ? 'Mostra Domanda' : 'Gira Carta (Spazio)';
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (curIdx < cards.length - 1) { curIdx++; isFlipped = false; update(); }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (curIdx > 0) { curIdx--; isFlipped = false; update(); }
    }
  };
  window.addEventListener('keydown', flashcardsKeyHandler);
}

async function openArtifact(name) {
  const nb = activeNotebook();
  if (!nb) return;
  const viewer = $('#agynb-viewer');
  const card = $('#agynb-viewer-card');
  const titleEl = $('#agynb-viewer-title');
  const bodyEl = $('#agynb-viewer-body');
  const extBtn = $('#agynb-viewer-external');
  titleEl.textContent = name;
  bodyEl.innerHTML = '<p style="color:var(--text-muted)">Caricamento…</p>';
  if (card) card.classList.remove('wide');
  if (extBtn) { extBtn.style.display = 'none'; extBtn.onclick = null; }
  viewer.classList.add('on');
  $('#agynb-viewer-download').onclick = () => downloadArtifact(name);

  try {
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(name)}/content`);
    if (name.startsWith('audio_overview-') || name.startsWith('infographic-') || name.startsWith('presentation-') || name.endsWith('.html')) {
      if (card) card.classList.add('wide');
      const blob = new Blob([data.content], { type: 'text/html; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      if (extBtn) {
        extBtn.style.display = 'inline-flex';
        extBtn.onclick = () => window.open(blobUrl, '_blank');
      }
      // NO "allow-same-origin" insieme ad "allow-scripts": un blob: URL creato da
      // questa pagina erediterebbe la NOSTRA origine, e allow-same-origin darebbe
      // allo script generato da agy accesso a localStorage/cookie e a chiamate
      // fetch() autenticate verso il nostro stesso backend. Le fonti di un
      // notebook possono contenere testo arbitrario (pagine web, PDF caricati):
      // un prompt-injection nella fonte potrebbe convincere agy a includere uno
      // script che esfiltra agy_pin. Senza allow-same-origin l'iframe resta a
      // origine opaca (null) - la navigazione a slide/JS decorativo dentro il
      // documento generato continua a funzionare, l'accesso alla pagina host no.
      bodyEl.innerHTML = `<iframe class="agynb-viewer-iframe" sandbox="allow-scripts allow-modals" src="${blobUrl}"></iframe>`;
    } else if (name.startsWith('flashcards-')) {
      renderFlashcardsViewer(bodyEl, data.content);
    } else if (name.startsWith('mindmap-')) {
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
  if (flashcardsKeyHandler) {
    window.removeEventListener('keydown', flashcardsKeyHandler);
    flashcardsKeyHandler = null;
  }
  const card = $('#agynb-viewer-card');
  if (card) card.classList.remove('wide');
  const extBtn = $('#agynb-viewer-external');
  if (extBtn) { extBtn.style.display = 'none'; extBtn.onclick = null; }
  const bodyEl = $('#agynb-viewer-body');
  if (bodyEl) bodyEl.innerHTML = '';
}

async function downloadArtifact(name) {
  const nb = activeNotebook();
  if (!nb) return;
  try {
    const data = await call('GET', `/notebooks/${encodeURIComponent(nb.id)}/studio/${encodeURIComponent(name)}/content`);
    const mime = (name.startsWith('infographic-') || name.startsWith('presentation-') || name.endsWith('.html')) ? 'text/html' : 'text/markdown';
    const blob = new Blob([data.content], { type: mime });
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
          <button class="agynb-btn" id="agynb-src-gdrive" onclick="window.agyGoogleDrive && window.agyGoogleDrive.openForNotebook()">${ICONS.gdrive} Google Drive</button>
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
  <div class="agynb-side" id="agynb-side">
    <div class="agynb-side-top">
      <div class="agynb-brand-row">
        <div class="agynb-brand"><span class="agynb-mark">__ICON__</span><span>Notebook</span></div>
        <button class="agynb-side-close" id="agynb-side-close" title="Chiudi lista">__CLOSE__</button>
      </div>
      <span class="agynb-health" id="agynb-health"><span class="agynb-dot"></span> verifica…</span>
      <button class="agynb-newbtn" id="agynb-new">__PLUS__ Nuovo notebook</button>
    </div>
    <div class="agynb-nblist" id="agynb-nblist"></div>
  </div>
  <div class="agynb-main" id="agynb-main"></div>
  <button class="agynb-side-open" id="agynb-side-open" title="Notebook">__LIST__</button>
</div>
<div class="agynb-viewer" id="agynb-viewer">
  <div class="agynb-viewer-card" id="agynb-viewer-card">
    <div class="agynb-viewer-head">
      <span id="agynb-viewer-title"></span>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="agynb-btn" id="agynb-viewer-external" style="display:none; padding:4px 9px; font-size:.74rem;">${ICONS.external} Nuova scheda</button>
        <button class="agynb-viewer-close" id="agynb-viewer-close">&times;</button>
      </div>
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

  container.innerHTML = SHELL.replace('__ICON__', ICONS.notebook).replace('__PLUS__', ICONS.plus)
    .replace('__CLOSE__', ICONS.close).replace('__LIST__', ICONS.list);
  root = container;

  $('#agynb-new').onclick = createNotebook;
  $('#agynb-viewer-close').onclick = closeViewer;
  $('#agynb-viewer').onclick = (e) => { if (e.target.id === 'agynb-viewer') closeViewer(); };
  $('#agynb-side-close').onclick = () => setSideOpen(false);
  $('#agynb-side-open').onclick = () => setSideOpen(true);

  window.agyNotebookPlugin = { selectNotebook, deleteNotebook, deleteSource, openSource, deleteArtifact, openArtifact, addSourceFile, activeNotebook };
  window.agynbAddSourceFile = addSourceFile;

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
