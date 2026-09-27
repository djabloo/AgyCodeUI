/**
 * AGYUI Plugin: agy-flow
 *
 * Playground per decisioni tipizzate (boolean, choice, score, numeric) con
 * probabilità reali lette dai logprobs di un modello su OpenRouter (chiave
 * dell'utente). Design ispirato a Rizzo Flow di Rizzo AI Academy.
 */

const MODEL_STORAGE_KEY = 'agyflow_model';

const CSS = `
.agyflow {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-main, #07090e);
  color: var(--text-main, #cbd5e1);
  font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  user-select: text;
  -webkit-user-select: text;
}

.agyflow * { box-sizing: border-box; }

/* ── HEADER & STATUS ── */
.agyflow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-card, rgba(13, 18, 31, 0.85));
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  gap: 14px;
  flex-shrink: 0;
}

.agyflow-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agyflow-logo-wrap {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(6, 182, 212, 0.25));
  border: 1px solid rgba(168, 85, 247, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c084fc;
}

.agyflow-logo-wrap svg { width: 19px; height: 19px; }

.agyflow-title-group h2 {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--text-bright, #fff);
  display: flex;
  align-items: center;
  gap: 8px;
}

.agyflow-title-group p {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-muted, #94a3b8);
}

.agyflow-engine-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  padding: 4px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
}

.agyflow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}

.agyflow-dot.ok { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
.agyflow-dot.simulated { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }

.agyflow-cfg-btn {
  background: none;
  border: none;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  padding: 2px 4px;
  display: flex;
  align-items: center;
}
.agyflow-cfg-btn:hover { color: #fff; }

/* ── PRESETS BAR ── */
.agyflow-presets-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
  overflow-x: auto;
  flex-shrink: 0;
}

.agyflow-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-main, #cbd5e1);
  font-size: 0.76rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.agyflow-preset-btn:hover {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.4);
  color: #fff;
}

.agyflow-preset-btn.active {
  background: rgba(168, 85, 247, 0.25);
  border-color: #a855f7;
  color: #fff;
}

/* ── MAIN WORKSPACE (2 PANELS) ── */
.agyflow-workspace {
  display: grid;
  grid-template-columns: minmax(360px, 48%) minmax(360px, 52%);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .agyflow-workspace {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
}

.agyflow-col-left, .agyflow-col-right {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 18px 20px;
  gap: 16px;
}

.agyflow-col-left {
  border-right: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
}

.agyflow-panel-card {
  background: var(--bg-card, rgba(13, 18, 31, 0.7));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agyflow-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agyflow-panel-head h3 {
  margin: 0;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  color: var(--text-muted, #94a3b8);
}

.agyflow-textarea {
  width: 100%;
  min-height: 110px;
  background: rgba(6, 8, 15, 0.8);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.09));
  border-radius: 10px;
  color: var(--text-bright, #fff);
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 10px 12px;
  resize: vertical;
  outline: none;
}

.agyflow-textarea:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 1px #a855f7;
}

/* ── QUESTIONS LIST & ITEM ── */
.agyflow-q-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agyflow-q-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agyflow-q-head {
  display: grid;
  grid-template-columns: 1fr 110px auto;
  gap: 8px;
  align-items: center;
}

.agyflow-input, .agyflow-select {
  background: rgba(6, 8, 15, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  color: #fff;
  padding: 6px 9px;
  font-size: 0.78rem;
  outline: none;
}

.agyflow-input:focus, .agyflow-select:focus {
  border-color: #a855f7;
}

.agyflow-btn-del {
  background: none;
  border: none;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  padding: 4px;
}
.agyflow-btn-del:hover { color: #ef4444; }

.agyflow-btn-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 9px;
  color: var(--text-muted, #94a3b8);
  font-size: 0.76rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.agyflow-btn-add:hover {
  background: rgba(168, 85, 247, 0.08);
  border-color: #a855f7;
  color: #c084fc;
}

.agyflow-run-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.35);
  transition: all 0.15s ease;
}

.agyflow-run-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
.agyflow-run-btn:disabled { opacity: 0.6; cursor: wait; }

/* ── RIGHT PANEL (TELEMETRY & RESULTS) ── */
.agyflow-metrics-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.agyflow-metric-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
}

.agyflow-metric-val {
  font-family: var(--font-mono, monospace);
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
}

.agyflow-metric-lbl {
  font-size: 0.68rem;
  color: var(--text-muted, #94a3b8);
  text-transform: uppercase;
  margin-top: 2px;
}

.agyflow-results-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agyflow-card-answer {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agyflow-ans-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.agyflow-ans-id {
  font-family: var(--font-mono, monospace);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-bright, #fff);
}

.agyflow-ans-badge {
  font-size: 0.65rem;
  font-family: var(--font-mono, monospace);
  padding: 2px 7px;
  border-radius: 12px;
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
  border: 1px solid rgba(6, 182, 212, 0.3);
  text-transform: uppercase;
}

.agyflow-ans-winner {
  font-size: 1.25rem;
  font-weight: 800;
  font-family: var(--font-mono, monospace);
  color: #38bdf8;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.agyflow-ans-winner small {
  font-size: 0.74rem;
  color: var(--text-muted, #94a3b8);
  font-weight: 400;
}

/* ── PROBABILITY BARS ── */
.agyflow-bar-row {
  display: grid;
  grid-template-columns: 140px 1fr 50px;
  gap: 10px;
  align-items: center;
  font-size: 0.75rem;
  margin-top: 4px;
}

.agyflow-bar-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-muted, #94a3b8);
}

.agyflow-bar-row.win .agyflow-bar-name {
  color: #fff;
  font-weight: 600;
}

.agyflow-bar-track {
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  position: relative;
  overflow: hidden;
}

.agyflow-bar-fill {
  height: 100%;
  border-radius: 20px;
  background: #64748b;
  transition: width 0.35s ease;
}

.agyflow-bar-row.win .agyflow-bar-fill {
  background: linear-gradient(90deg, #a855f7 0%, #06b6d4 100%);
}

.agyflow-bar-pct {
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  text-align: right;
  color: var(--text-muted, #94a3b8);
}

.agyflow-bar-row.win .agyflow-bar-pct {
  color: #38bdf8;
  font-weight: 700;
}

/* ── ACTIONS BAR (BRIDGE AGY) ── */
.agyflow-actions-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
}

.agyflow-act-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  color: #fff;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.agyflow-act-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.agyflow-act-btn.primary {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%);
  border-color: rgba(6, 182, 212, 0.5);
  color: #fff;
}

.agyflow-act-btn.primary:hover {
  filter: brightness(1.15);
}

.agyflow-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-muted, #94a3b8);
  text-align: center;
}

.agyflow-empty-state svg {
  width: 44px;
  height: 44px;
  opacity: 0.35;
}

/* ── MODAL SETTINGS ── */
.agyflow-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: none;
  place-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.agyflow-modal-overlay.open { display: grid; }

.agyflow-modal-card {
  width: 90%;
  max-width: 480px;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
`;

const ICONS = {
  flow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 6h4a5 5 0 0 1 5 5"/><path d="M9 18h4a5 5 0 0 0 5-5"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`
};

let hostContainer = null;
let rpcClient = null;
let currentPresets = [];
let activePresetId = 'ticket';
let currentStateData = {};
let currentQuestionsData = {};
let latestDecisionResult = null;
let healthInfo = null;

function selectedModel() {
  return localStorage.getItem(MODEL_STORAGE_KEY) || (healthInfo && healthInfo.default_model) || '';
}

function modelLabel(id) {
  const m = healthInfo && healthInfo.models ? healthInfo.models.find((x) => x.id === id) : null;
  return m ? m.label : id;
}

function esc(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function mount(container, api) {
  hostContainer = container;
  rpcClient = api.rpc.bind(api);

  if (!document.getElementById('agyflow-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'agyflow-styles';
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  }

  container.innerHTML = `
    <div class="agyflow">
      <!-- HEADER -->
      <div class="agyflow-header">
        <div class="agyflow-brand">
          <div class="agyflow-logo-wrap">${ICONS.flow}</div>
          <div class="agyflow-title-group">
            <h2>agy-flow <span style="font-weight:400; color:var(--text-muted); font-size:0.75rem;">decisioni tipizzate</span></h2>
            <p>Probabilità reali (logprobs) su ogni opzione · design ispirato a Rizzo Flow di Rizzo AI Academy</p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          <div class="agyflow-engine-status" id="agyflow-status-pill">
            <span class="agyflow-dot" id="agyflow-status-dot"></span>
            <span id="agyflow-status-text">Connessione...</span>
          </div>
          <button class="agyflow-cfg-btn" id="agyflow-open-cfg-btn" title="Modello e chiave OpenRouter">${ICONS.settings}</button>
        </div>
      </div>

      <!-- PRESETS BAR -->
      <div class="agyflow-presets-bar" id="agyflow-presets-container">
        <!-- Rendered via JS -->
      </div>

      <!-- WORKSPACE -->
      <div class="agyflow-workspace">
        <!-- LEFT: INPUT & QUESTIONS -->
        <div class="agyflow-col-left">
          <!-- STATE INPUT -->
          <div class="agyflow-panel-card">
            <div class="agyflow-panel-head">
              <h3>Stato Non Strutturato (State)</h3>
              <span style="font-size:0.72rem; color:var(--text-muted);">Testo, JSON o Log</span>
            </div>
            <textarea class="agyflow-textarea" id="agyflow-state-input" placeholder="Inserisci il testo o stato da valutare..."></textarea>
          </div>

          <!-- QUESTIONS BUILDER -->
          <div class="agyflow-panel-card">
            <div class="agyflow-panel-head">
              <h3>Domande Tipizzate (Questions)</h3>
              <button class="agyflow-act-btn" id="agyflow-add-q-btn" style="padding:4px 9px; font-size:0.72rem;">${ICONS.plus} Domanda</button>
            </div>
            <div class="agyflow-q-list" id="agyflow-q-list"></div>
          </div>

          <!-- RUN BUTTON -->
          <button class="agyflow-run-btn" id="agyflow-run-btn">
            ${ICONS.sparkles} Esegui Decisione
          </button>
        </div>

        <!-- RIGHT: DECISION MATRIX -->
        <div class="agyflow-col-right" id="agyflow-col-right">
          <!-- METRICS -->
          <div class="agyflow-metrics-row">
            <div class="agyflow-metric-card">
              <div class="agyflow-metric-val" id="agyflow-metric-latency">--</div>
              <div class="agyflow-metric-lbl">Latenza</div>
            </div>
            <div class="agyflow-metric-card">
              <div class="agyflow-metric-val" id="agyflow-metric-gen" style="color:#10b981;">--</div>
              <div class="agyflow-metric-lbl">Token generati</div>
            </div>
            <div class="agyflow-metric-card">
              <div class="agyflow-metric-val" id="agyflow-metric-tokens">--</div>
              <div class="agyflow-metric-lbl">Input Tokens</div>
            </div>
          </div>

          <!-- RESULTS CONTAINER -->
          <div class="agyflow-results-list" id="agyflow-results-list">
            <div class="agyflow-empty-state">
              ${ICONS.flow}
              <p>Seleziona un preset o componi le tue domande tipizzate e premi <b>Esegui Decisione</b> per visualizzare la matrice delle probabilità.</p>
            </div>
          </div>

          <!-- ACTIONS / BRIDGE -->
          <div class="agyflow-actions-bar" id="agyflow-actions-bar" style="display:none;">
            <button class="agyflow-act-btn primary" id="agyflow-btn-bridge-chat">
              ${ICONS.chat} Invia alla Chat di AGY
            </button>
            <button class="agyflow-act-btn" id="agyflow-btn-copy-json">
              ${ICONS.copy} Copia JSON
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL CONFIG -->
      <div class="agyflow-modal-overlay" id="agyflow-cfg-modal">
        <div class="agyflow-modal-card">
          <h3 style="margin:0; font-size:1rem; color:#fff;">Modello e chiave OpenRouter</h3>
          <div id="agyflow-cfg-key" style="font-size:0.76rem; line-height:1.5;"></div>
          <p style="margin:0; font-size:0.74rem; color:var(--text-muted); line-height:1.5;">
            agy-flow usa la <b>tua</b> chiave OpenRouter: i costi (circa 1 centesimo ogni 1000 decisioni) sono sul tuo account.
            In AgyCloud: <b>Dashboard → Chiavi API → OpenRouter</b>. Nel self-hosted: <code>OPENROUTER_API_KEY</code> nel file <code>.env</code>.
          </p>
          <div>
            <label style="display:block; font-size:0.74rem; color:var(--text-muted); margin-bottom:4px;">Modello (se non risponde si passa al successivo)</label>
            <select class="agyflow-select" id="agyflow-cfg-model" style="width:100%;"></select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
            <button class="agyflow-act-btn" id="agyflow-cfg-cancel">Annulla</button>
            <button class="agyflow-act-btn primary" id="agyflow-cfg-save">Salva</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Event Listeners
  initEvents();

  // Load Presets & Check Health
  await checkHealth();
  await loadPresets();
}

export function unmount() {
  if (hostContainer) hostContainer.innerHTML = '';
  hostContainer = null;
  rpcClient = null;
}

async function checkHealth() {
  const dot = document.getElementById('agyflow-status-dot');
  const txt = document.getElementById('agyflow-status-text');
  try {
    const res = await rpcClient('GET', 'health');
    if (res.error) throw new Error(res.error);
    healthInfo = res;
    const key = res.key || {};
    if (key.configured && key.valid !== false) {
      dot.className = 'agyflow-dot ok';
      txt.textContent = `OpenRouter · ${modelLabel(selectedModel())}`;
      txt.style.color = '#10b981';
    } else if (key.configured) {
      dot.className = 'agyflow-dot';
      txt.textContent = 'Chiave OpenRouter non valida';
      txt.style.color = '#ef4444';
    } else {
      dot.className = 'agyflow-dot simulated';
      txt.textContent = 'Chiave OpenRouter mancante';
      txt.style.color = '#f59e0b';
    }
  } catch (e) {
    if (dot) dot.className = 'agyflow-dot';
    if (txt) {
      txt.textContent = 'Non collegato';
      txt.style.color = '#ef4444';
    }
  }
}

async function loadPresets() {
  try {
    const list = await rpcClient('GET', 'presets');
    currentPresets = list || [];
    renderPresetsBar();
    if (currentPresets.length > 0) {
      applyPreset(currentPresets[0].id);
    }
  } catch (e) {
    console.error('Errore caricamento preset:', e);
  }
}

function renderPresetsBar() {
  const container = document.getElementById('agyflow-presets-container');
  if (!container) return;

  container.innerHTML = currentPresets.map(p => `
    <button class="agyflow-preset-btn ${p.id === activePresetId ? 'active' : ''}" data-pid="${p.id}">
      <span>${p.icon || '⚡'}</span>
      <span>${esc(p.title)}</span>
    </button>
  `).join('') + `
    <button class="agyflow-preset-btn" id="agyflow-btn-blank">
      <span>➕</span>
      <span>Nuovo Vuoto</span>
    </button>
  `;

  container.querySelectorAll('[data-pid]').forEach(btn => {
    btn.onclick = () => applyPreset(btn.getAttribute('data-pid'));
  });

  const blankBtn = document.getElementById('agyflow-btn-blank');
  if (blankBtn) {
    blankBtn.onclick = () => {
      activePresetId = 'blank';
      renderPresetsBar();
      currentStateData = "Inserisci qui il testo o dati del caso da analizzare...";
      currentQuestionsData = {
        is_relevant: { type: "boolean", instructions: "Questo elemento richiede una revisione immediata?" }
      };
      syncInputs();
    };
  }
}

function applyPreset(pid) {
  const p = currentPresets.find(x => x.id === pid);
  if (!p) return;
  activePresetId = pid;
  renderPresetsBar();

  currentStateData = p.state;
  currentQuestionsData = JSON.parse(JSON.stringify(p.questions));
  syncInputs();
}

function syncInputs() {
  const stateEl = document.getElementById('agyflow-state-input');
  if (stateEl) {
    stateEl.value = typeof currentStateData === 'string'
      ? currentStateData
      : JSON.stringify(currentStateData, null, 2);
  }
  renderQuestionsList();
}

function renderQuestionsList() {
  const listEl = document.getElementById('agyflow-q-list');
  if (!listEl) return;

  const entries = Object.entries(currentQuestionsData);
  if (!entries.length) {
    listEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.75rem;">Nessuna domanda presente. Clicca "+ Domanda" per aggiungerne una.</div>`;
    return;
  }

  listEl.innerHTML = entries.map(([qid, q]) => `
    <div class="agyflow-q-item" data-qid="${esc(qid)}">
      <div class="agyflow-q-head">
        <input type="text" class="agyflow-input q-id-input" value="${esc(qid)}" placeholder="ID Univoco" />
        <select class="agyflow-select q-type-select">
          <option value="boolean" ${q.type === 'boolean' ? 'selected' : ''}>Boolean (Sì/No)</option>
          <option value="choice" ${q.type === 'choice' ? 'selected' : ''}>Choice (Opzioni)</option>
          <option value="score" ${q.type === 'score' ? 'selected' : ''}>Score (Rubric)</option>
          <option value="numeric" ${q.type === 'numeric' ? 'selected' : ''}>Numeric (Stima)</option>
        </select>
        <button class="agyflow-btn-del" title="Elimina domanda">${ICONS.trash}</button>
      </div>
      <div>
        <input type="text" class="agyflow-input q-inst-input" style="width:100%;" value="${esc(q.instructions || '')}" placeholder="Istruzioni per la decisione..." />
      </div>
      ${renderQuestionExtra(q)}
    </div>
  `).join('');

  // Handlers
  listEl.querySelectorAll('.agyflow-q-item').forEach(el => {
    const oldQid = el.getAttribute('data-qid');
    const idInput = el.querySelector('.q-id-input');
    const typeSelect = el.querySelector('.q-type-select');
    const instInput = el.querySelector('.q-inst-input');
    const delBtn = el.querySelector('.agyflow-btn-del');

    idInput.onchange = () => {
      const newQid = idInput.value.trim().replace(/\s+/g, '_');
      if (newQid && newQid !== oldQid) {
        currentQuestionsData[newQid] = currentQuestionsData[oldQid];
        delete currentQuestionsData[oldQid];
        renderQuestionsList();
      }
    };

    typeSelect.onchange = () => {
      const newType = typeSelect.value;
      currentQuestionsData[oldQid].type = newType;
      if (newType === 'choice' && !currentQuestionsData[oldQid].options) {
        currentQuestionsData[oldQid].options = [
          { id: "opt_a", description: "Prima opzione" },
          { id: "opt_b", description: "Seconda opzione" }
        ];
      } else if (newType === 'score' && !currentQuestionsData[oldQid].levels) {
        currentQuestionsData[oldQid].levels = ["Basso", "Medio", "Alto"];
      }
      renderQuestionsList();
    };

    instInput.onchange = () => {
      currentQuestionsData[oldQid].instructions = instInput.value;
    };

    delBtn.onclick = () => {
      delete currentQuestionsData[oldQid];
      renderQuestionsList();
    };
  });
}

function renderQuestionExtra(q) {
  if (q.type === 'choice' && Array.isArray(q.options)) {
    return `
      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
        <b>Opzioni (${q.options.length}):</b> ${q.options.map(o => `<code style="color:#c084fc;">${esc(o.id)}</code>`).join(', ')}
      </div>
    `;
  }
  if (q.type === 'score' && Array.isArray(q.levels)) {
    return `
      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
        <b>Livelli Rubric:</b> ${q.levels.map((l, i) => `${i}: "${esc(l.slice(0, 30))}..."`).join(' | ')}
      </div>
    `;
  }
  return '';
}

function renderConfigModal() {
  const keyEl = document.getElementById('agyflow-cfg-key');
  const sel = document.getElementById('agyflow-cfg-model');
  const key = (healthInfo && healthInfo.key) || {};
  if (keyEl) {
    if (!key.configured) {
      keyEl.innerHTML = '<span style="color:#f59e0b;">⚠ Nessuna chiave OpenRouter configurata.</span>';
    } else if (key.valid === false) {
      keyEl.innerHTML = '<span style="color:#ef4444;">✕ La chiave OpenRouter non è valida o è stata revocata.</span>';
    } else {
      const spent = typeof key.usage === 'number' ? ` · spesa finora: $${key.usage.toFixed(3)}` : '';
      const limit = key.limit === null || key.limit === undefined
        ? ' · <span style="color:#f59e0b;">nessun limite di spesa impostato</span>'
        : ` · limite: $${key.limit}`;
      keyEl.innerHTML = `<span style="color:#10b981;">✓ Chiave OpenRouter attiva</span>${spent}${limit}`;
    }
  }
  if (sel) {
    const models = (healthInfo && healthInfo.models) || [];
    const current = selectedModel();
    sel.innerHTML = models.map((m) => `<option value="${esc(m.id)}" ${m.id === current ? 'selected' : ''}>${esc(m.label)} — ${esc(m.id)}</option>`).join('');
  }
}

function renderNoKeyNotice(container, code, message) {
  const title = code === 'NO_KEY' ? 'Serve una chiave OpenRouter'
    : code === 'INVALID_KEY' ? 'Chiave OpenRouter non valida'
    : code === 'NO_CREDIT' ? 'Credito OpenRouter esaurito'
    : 'Errore';
  container.innerHTML = `
    <div style="padding:14px 16px; border-radius:10px; background:rgba(245, 158, 11, 0.10); border:1px solid rgba(245, 158, 11, 0.35); font-size:0.78rem; line-height:1.6; color:#fde68a;">
      <b>${esc(title)}</b><br>${esc(message || '')}<br>
      Aggiungila in <b>Dashboard → Chiavi API → OpenRouter</b> (AgyCloud) oppure come <code>OPENROUTER_API_KEY</code> nel <code>.env</code> (self-hosted), poi ricarica il plugin.
      <div style="margin-top:10px;">
        <button class="agyflow-act-btn" id="agyflow-run-agy">Esegui con agy (senza probabilità, più lento)</button>
      </div>
    </div>
  `;
  const agyBtn = document.getElementById('agyflow-run-agy');
  if (agyBtn) agyBtn.onclick = () => executeDecision('agy');
}

function initEvents() {
  const runBtn = document.getElementById('agyflow-run-btn');
  const addQBtn = document.getElementById('agyflow-add-q-btn');
  const copyBtn = document.getElementById('agyflow-btn-copy-json');
  const bridgeBtn = document.getElementById('agyflow-btn-bridge-chat');
  const cfgOpenBtn = document.getElementById('agyflow-open-cfg-btn');
  const cfgModal = document.getElementById('agyflow-cfg-modal');
  const cfgCancel = document.getElementById('agyflow-cfg-cancel');
  const cfgSave = document.getElementById('agyflow-cfg-save');

  if (runBtn) runBtn.onclick = () => executeDecision();

  if (addQBtn) {
    addQBtn.onclick = () => {
      const idx = Object.keys(currentQuestionsData).length + 1;
      const newId = `decision_${idx}`;
      currentQuestionsData[newId] = {
        type: "choice",
        instructions: "Seleziona la classificazione corretta per questo caso:",
        options: [
          { id: "opzione_1", description: "Descrizione opzione 1" },
          { id: "opzione_2", description: "Descrizione opzione 2" }
        ]
      };
      renderQuestionsList();
    };
  }

  if (copyBtn) {
    copyBtn.onclick = () => {
      if (!latestDecisionResult) return;
      navigator.clipboard.writeText(JSON.stringify(latestDecisionResult, null, 2));
      const oldTxt = copyBtn.innerHTML;
      copyBtn.innerHTML = `✓ Copiato!`;
      setTimeout(() => { copyBtn.innerHTML = oldTxt; }, 1800);
    };
  }

  if (bridgeBtn) {
    bridgeBtn.onclick = bridgeDecisionToAgyChat;
  }

  if (cfgOpenBtn) {
    cfgOpenBtn.onclick = () => {
      renderConfigModal();
      cfgModal.classList.add('open');
    };
  }
  if (cfgCancel) cfgCancel.onclick = () => cfgModal.classList.remove('open');
  if (cfgSave) {
    cfgSave.onclick = async () => {
      const sel = document.getElementById('agyflow-cfg-model');
      if (sel && sel.value) localStorage.setItem(MODEL_STORAGE_KEY, sel.value);
      cfgModal.classList.remove('open');
      await checkHealth();
    };
  }

  // Scorciatoia da tastiera: Ctrl+Enter o Cmd+Enter lancia la decisione
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.closest('.agyflow'))) {
        e.preventDefault();
        executeDecision();
      }
    }
  });
}

async function executeDecision(engine) {
  const runBtn = document.getElementById('agyflow-run-btn');
  const stateInput = document.getElementById('agyflow-state-input');
  const resultsContainer = document.getElementById('agyflow-results-list');
  const actionsBar = document.getElementById('agyflow-actions-bar');

  let stateVal = stateInput.value.trim();
  try {
    stateVal = JSON.parse(stateVal);
  } catch (_) {}

  runBtn.disabled = true;
  runBtn.innerHTML = engine === 'agy'
    ? `<span class="spin-animation">⏳</span> agy sta valutando (può richiedere un minuto)...`
    : `<span class="spin-animation">⏳</span> Calcolo decisione...`;

  try {
    const res = await rpcClient('POST', 'decide', {
      state: stateVal,
      questions: currentQuestionsData,
      model: selectedModel(),
      engine: engine === 'agy' ? 'agy' : undefined
    });

    if (res.code === 'NO_KEY' || res.code === 'INVALID_KEY' || res.code === 'NO_CREDIT') {
      latestDecisionResult = null;
      actionsBar.style.display = 'none';
      renderNoKeyNotice(resultsContainer, res.code, res.error);
      return;
    }
    if (res.error) throw new Error(res.error);

    latestDecisionResult = res;

    // Metriche reali, nessun valore di ripiego inventato
    document.getElementById('agyflow-metric-latency').textContent = res.timing ? `${Math.round(res.timing.total_ms)} ms` : '--';
    document.getElementById('agyflow-metric-gen').textContent = res.generated_tokens != null ? String(res.generated_tokens) : '--';

    let totToks = 0;
    if (res.answers) {
      Object.values(res.answers).forEach(a => { totToks += (a.input_tokens || 0); });
    }
    document.getElementById('agyflow-metric-tokens').textContent = totToks ? String(totToks) : '--';

    renderDecisionResults(res);
    actionsBar.style.display = 'flex';
  } catch (err) {
    resultsContainer.innerHTML = `
      <div style="padding:16px; border-radius:10px; background:rgba(239, 68, 68, 0.15); border:1px solid #ef4444; color:#fca5a5;">
        <b>Errore esecuzione decisione:</b>
        <pre style="margin-top:6px; font-size:0.75rem; white-space:pre-wrap;">${esc(err.message)}</pre>
      </div>
    `;
  } finally {
    runBtn.disabled = false;
    runBtn.innerHTML = `${ICONS.sparkles} Esegui Decisione`;
  }
}

function getAnswerWinner(ans) {
  if (!ans) return '';
  if (ans.type === 'choice') {
    if (ans.choice !== undefined && ans.choice !== null) return ans.choice;
  } else if (ans.type === 'score') {
    if (ans.score !== undefined && ans.score !== null) {
      return typeof ans.score === 'number' ? +ans.score.toFixed(2) : ans.score;
    }
  }
  if (ans.value !== undefined && ans.value !== null) return ans.value;

  // Fallback: opzione con probabilità più alta
  if (ans.probabilities) {
    const sorted = Object.entries(ans.probabilities).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) return sorted[0][0];
  }
  return '';
}

function renderDecisionResults(res) {
  const container = document.getElementById('agyflow-results-list');
  if (!container || !res.answers) return;

  const cardsHtml = Object.entries(res.answers).map(([qid, ans]) => {
    const origQ = currentQuestionsData[qid] || {};
    const qType = ans.type || origQ.type || 'choice';
    const winVal = getAnswerWinner(ans);

    let displayVal = String(winVal);
    if (ans.status === 'error') {
      displayVal = 'Nessuna risposta';
    } else if (qType === 'boolean') {
      displayVal = (winVal === true || winVal === 'true') ? 'VERO (true)' : 'FALSO (false)';
    } else if (winVal === '__insufficient__' || ans.status === 'insufficient_evidence') {
      displayVal = `Indeterminato (${winVal})`;
    } else if (qType === 'numeric' && typeof ans.expected === 'number') {
      displayVal = `${winVal}${ans.unit ? ' ' + ans.unit : ''} (valore atteso: ${ans.expected})`;
    }
    const margin = ans.uncertainty && typeof ans.uncertainty.margin === 'number' ? ans.uncertainty.margin : null;
    const detail = ans.error
      ? `<div style="font-size:0.72rem; color:#fca5a5; margin-top:4px;">${esc(ans.error)}</div>`
      : `<div style="font-size:0.68rem; color:var(--text-muted); margin-top:4px;">${ans.model ? 'modello: ' + esc(modelLabel(ans.model)) : ''}${margin !== null ? ` · margine sulla seconda opzione: ${(margin * 100).toFixed(1)} pt` : ''}${ans.status === 'low_coverage' ? ' · <span style="color:#f59e0b;">risposta poco aderente alle opzioni, valuta con cautela</span>' : ''}</div>`;

    return `
      <div class="agyflow-card-answer">
        <div class="agyflow-ans-top">
          <span class="agyflow-ans-id">${esc(qid)}</span>
          <span class="agyflow-ans-badge">${esc(qType)}</span>
        </div>

        <div style="font-size:0.74rem; color:var(--text-muted);">${esc(origQ.instructions || '')}</div>

        <div class="agyflow-ans-winner">
          <span>${esc(displayVal)}</span>
          ${ans.status ? `<small>stato: ${esc(ans.status)}</small>` : ''}
        </div>

        <!-- BARS -->
        <div style="margin-top:8px;">
          ${renderProbabilityBars(ans, origQ, winVal)}
        </div>
        ${detail}
      </div>
    `;
  }).join('');

  const noticeHtml = res.no_probabilities ? `
    <div style="padding:8px 12px; border-radius:8px; background:rgba(245, 158, 11, 0.12); border:1px solid rgba(245, 158, 11, 0.3); font-size:0.72rem; color:#fcd34d;">
      ⚡ <b>Valutato con agy, senza probabilità:</b> le risposte sono quelle scelte dal modello, ma non c'è una distribuzione di confidenza. Per le probabilità reali configura una chiave OpenRouter.
    </div>
  ` : '';

  container.innerHTML = noticeHtml + cardsHtml;
}

function renderProbabilityBars(ans, origQ, winVal) {
  if (!ans.probabilities) return '';

  const entries = Object.entries(ans.probabilities);
  entries.sort((a, b) => b[1] - a[1]);

  return entries.map(([optId, prob]) => {
    const pct = (prob * 100).toFixed(1);
    const isWin = String(winVal) === String(optId);

    // Etichetta leggibile
    let label = optId;
    if (origQ.type === 'choice' && Array.isArray(origQ.options)) {
      const found = origQ.options.find(o => o.id === optId);
      if (found) label = `${found.id} (${found.description || ''})`;
    } else if (origQ.type === 'score' && Array.isArray(origQ.levels)) {
      const idx = parseInt(optId, 10);
      if (!isNaN(idx) && origQ.levels[idx]) label = `L${idx}: ${origQ.levels[idx]}`;
    }

    return `
      <div class="agyflow-bar-row ${isWin ? 'win' : ''}">
        <span class="agyflow-bar-name" title="${esc(label)}">${esc(label)}</span>
        <div class="agyflow-bar-track">
          <div class="agyflow-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <span class="agyflow-bar-pct">${pct}%</span>
      </div>
    `;
  }).join('');
}

function bridgeDecisionToAgyChat() {
  if (!latestDecisionResult || !latestDecisionResult.answers) return;

  const lines = [
    `🎯 **Valutazione decisionale agy-flow**:`,
    latestDecisionResult.no_probabilities
      ? `Ho valutato lo stato con agy (senza distribuzione di probabilità). Ecco le decisioni:`
      : `Ho valutato lo stato leggendo le probabilità reali del modello (${latestDecisionResult.model || 'OpenRouter'}). Ecco le decisioni:`
  ];

  for (const [qid, ans] of Object.entries(latestDecisionResult.answers)) {
    const origQ = currentQuestionsData[qid] || {};
    const winVal = getAnswerWinner(ans);
    let winProb = '';
    if (ans.probabilities && ans.probabilities[winVal] !== undefined) {
      winProb = `(confidenza: ${(ans.probabilities[winVal] * 100).toFixed(1)}%)`;
    }
    const qDesc = origQ.instructions || qid;
    lines.push(`- **${qid}**: \`${winVal}\` ${winProb} — *${qDesc}*`);
  }

  lines.push(`\nStato analizzato:\n\`\`\`json\n${JSON.stringify(currentStateData, null, 2)}\n\`\`\``);
  lines.push(`\nIn base a questa matrice decisionale, procedi con le azioni operative pertinenti.`);

  const promptText = lines.join('\n');

  // Cambia tab verso la chat in modo sicuro (senza causare schermata nera)
  if (window.agyApp && typeof window.agyApp.switchTab === 'function') {
    window.agyApp.switchTab('chat-tab');
  }

  // Inietta nel composer della chat di AGY e focalizza
  setTimeout(() => {
    if (window.agyChat && typeof window.agyChat.insertPrompt === 'function') {
      window.agyChat.insertPrompt(promptText);
    } else {
      const input = document.getElementById('chat-prompt-input') || document.querySelector('textarea.chat-prompt-input') || document.getElementById('chat-input');
      if (input) {
        input.value = promptText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    }
  }, 100);
}
