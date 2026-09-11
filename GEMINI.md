# AgyCodeUI — Memoria di progetto per Antigravity (agy)

Questo file viene letto automaticamente da `agy` (regola di directory `GEMINI.md`) quando lavora in questo repo.
Repo pubblico, self-hosted, open source: **non aggiungere qui dettagli sull'infrastruttura privata di chi lo
ospita** (domini, credenziali, layout VPS) — quelli vivono nel repo separato e privato del servizio cloud che
usa questo progetto come base (vedi §5).

---

## 1. Cos'è

**AgyCodeUI**: interfaccia web (chat + terminale PTY + file + impostazioni) per **Google Antigravity CLI (`agy`)**,
ispirata a CloudCLI/claudecodeui. Pensata per essere installata sul proprio server e usata da browser o smartphone,
in alternativa al terminale nudo.

## 2. Struttura del repo

```
server/                 backend (Express + Socket.io + node-pty)
  index.js              server, auth PIN, socket (terminal-input/output, chat-prompt, chat-cancel)
  ptyManager.js          processo agy interattivo nel terminale; --conversation <id> per seguire la chat
  pluginManager.js       gestione ciclo di vita plugin, discovery, spawn backend su porte effimere e WS proxy
  agentRunner.js         Chat: per ogni prompt lancia `agy -p=<testo> --output-format stream-json` e traduce gli eventi
  sessionManager.js      sessioni chat (sessions.json), messaggi strutturati (content/thinking/toolCalls)
  transcriptSync.js      specchia in chat la trascrizione agy (~/.gemini/antigravity-cli/brain/<conv>/.system_generated/logs/transcript.jsonl)
  api/                   files, sessions, settings, workspaces, agents, workflows, metrics, plugins (asset, rpc, toggle)
plugins/                cartella dei plugin AGYUI installati (agyui-plugin-terminal, agyui-plugin-starter)
public/                 frontend vanilla JS (index.html, js/plugins.js, js/*.js, css/style.css)
```

## 3. Chat e terminale (decisioni prese)

- La chat NON legge il terminale (produrrebbe righe ─────, barra di stato, parole spezzate). Usa
  `agy -p=<testo> --output-format stream-json` e traduce gli eventi NDJSON in messaggi strutturati
  (testo, thinking, tool call con stato ACTIVE/DONE/ERROR).
- Terminale e chat condividono la stessa conversazione agy: al cambio sessione il PTY riparte con
  `agy --conversation <id>` (come `claude --resume` in claudecodeui). Il riallineamento avviene **a fine
  turno** della chat, altrimenti agy segnala "Conversation already open".
- Ciò che si scrive nel terminale compare in chat a fine risposta grazie a `transcriptSync.js`.
- Cliccare una sessione nella sidebar fa `POST /api/sessions/:id/switch` (rende attiva la sessione anche
  lato server: senza questo i nuovi messaggi finiscono nell'ultima sessione usata, non in quella aperta).
- Allegati: `POST /api/files/upload` (via `express.raw`, niente multer) salva in `<workspace>/agy_uploads/`
  e il percorso viene messo in testa al prompt.
- Terminale: font 13px/lineHeight 1.05 (le schermate TUI di agy hanno ~30 righe, altrimenti i pulsanti
  restano fuori vista), pulsanti Copia/Incolla, Ctrl+C con selezione = copia invece di interrompere il processo.
- Attenzione alla sintassi: `agy -p` va scritto `-p=<testo>`, altrimenti mangia il flag successivo come prompt.
- Il tool `/browser` di agy non funziona su host arm64: Google non pubblica il driver Playwright per quell'architettura.
- **Rizzo-PII Shield (Dati Riservati & Privacy)**: Microservizio locale Docker (`rizzo-pii` su porta 5005) che esegue
  l'anonimizzazione on-premise di PDF, file di testo e Markdown. Nomi, codici fiscali, IBAN, email e indirizzi
  vengono oscurati prima del prompt all'agente. I file censurati vengono salvati in `<workspace>/pii-clean/`.
  Integrato sia via pulsante dedicato nella chat (`#chat-pii-btn`), sia nella card dell'ambiente via modal.
- **Quick Model & Reasoning Effort Selector**: Popover compatto inline nell'header della chat (`.chat-model-popover`)
  per switch rapido tra modelli agy e selezione del Thinking Effort (low, medium, high), preservando i flag CLI
  (`--dangerously-skip-permissions`, `--sandbox`).
- **Sistema di Internazionalizzazione (i18n)**: Supporto completo multilingua (Italiano IT, Inglese EN, Tedesco DE)
  con commutazione dinamica live, persistenza (`localStorage['agy_lang']`) e riallineamento automatico dei componenti
  tramite evento `agy-lang-changed`. Copre tutti i controlli della sidebar, drawer footer ("Segnala Problema",
  "Community", "Pannello Ambienti", "Impostazioni"), "Pannello Sviluppo Ambienti di Lavoro", quote, wizard di
  creazione ambiente a 3 step ("Nuovo Progetto", "Importa da GitHub", "Software & Runtime"), e tutti i modal.
- **Ottimizzazione Mobile & Accessibilità Terminale**:
  - **Header compatto e pulito**: rimossi i selettori di lingua e tema giorno/notte dall'header dell'IDE per liberare spazio
    orizzontale critico (rimangono disponibili nelle Impostazioni e sulla landing page).
  - **Titolo responsive**: `.header-session-title-group` vincolato con troncamento a riga singola ed ellipsis (`text-overflow: ellipsis`),
    nascondendo il sottotitolo su schermi stretti per evitare l'avvolgimento del testo su 4-5 righe.
  - **Navigazione sempre visibile**: le tab di navigazione (`.nav-tabs`) mantengono `flex-shrink: 0` su mobile con touch target confortevoli
    (36x34px), garantendo che la tab del **Terminale** sia sempre accessibile ed esclusiva nell'header superiore (rimosse le chiamate ridondanti nel footer drawer e nei chip chat).
  - **Toolbar chat fluida**: barra degli strumenti del composer con scorrimento orizzontale touch per evitare il taglio del badge
    modello su smartphone, e badge statistici numerici nascosti su mobile.
- **Risoluzione Refresh Sidebar & Sincronizzazione Brain**:
  - L'icona di refresh della sidebar esegue `window.agySidebar.refreshAll()` con animazione rotante (`spin-animation`).
  - Il refresh ricarica sia i progetti (`loadWorkspaces`) che le sessioni (`window.agyChat.fetchSessions(false)`),
    senza chiudere forzatamente il drawer laterale su mobile né interrompere la chat attiva.
  - Lato server, `sessionManager.discoverBrainSessions()` effettua la scansione automatica di `~/.gemini/antigravity-cli/brain/`
    importando qualsiasi conversazione creata direttamente da CLI o da terminale, sincronizzando titolo e metadata.
  - `sessionManager.load()` preserva in modo sicuro l'`activeSessionId` senza sovrascriverlo con la prima sessione.
- **Sistema Plugin Modulare AGYUI**:
  - Cartella dedicata `plugins/` in cui risiedono i plugin conformi al manifest (`manifest.json`).
  - **Plugin Ufficiali**:
    - `agyui-plugin-terminal`: Terminale web avanzato basato su xterm.js con multi-tab, visualizzato nell'interfaccia come **XTerm** (per distinguerlo chiaramente dal terminale integrato di AGY), supporto nativo comandi CLI agy e sopravvivenza dei processi PTY alle disconnessioni.
    - `agyui-plugin-starter`: **Project Stats**, dashboard analitica di codice, file, dimensioni e ripartizione estensioni calcolate via endpoint RPC.
  - **Backend Isolato & Proxying**: ogni plugin con script `server` viene eseguito come processo child Node.js su porta effimera locale (`127.0.0.1`), comunicando la prontezza tramite `{"ready": true, "port": ...}`. Il backend di AGYUI inoltra i WebSockets (`/plugin-ws/:name`) e le chiamate RPC (`/api/plugins/:name/rpc/*`) verso la porta corretta.
  - **Caricamento Moduli Dinamico**: gli asset statici dei plugin sono esposti pubblicamente su `/api/plugins/:name/assets/*` permettendo il dynamic ES module `import()` diretto dal browser senza blocchi di autenticazione.
  - **Navbar Orizzontale Flessibile**: la barra comandi superiore (`.nav-tabs`) include supporto per scorrimento orizzontale via rotellina del mouse (`wheel` event), scrollbar sottile e `flex-shrink: 0` sui singoli tab per evitare compressioni grafiche.
  - **Pulizia UI**: rimossa l'icona circolare cloud ridondante in alto a destra. Rimossi tutti i riferimenti di branding a terze parti a favore dell'identità AGYUI proprietaria.

## 4. Esecuzione self-hosted

```bash
npm install
cp .env.example .env   # imposta PORT, HOST, AUTH_PIN (obbligatorio se HOST=0.0.0.0), WORKSPACE_DIR, CLI_COMMAND=agy
npm start               # oppure pm2 start server/index.js --name agycodeui
```

Il server richiede `agy` installato e autenticato sulla macchina (o lo fa fare all'utente al primo
avvio del terminale integrato: schermate Termini e "trust folder" si superano con ↓ → Invio).

## 5. Nota per chi mantiene anche un servizio cloud basato su questo repo

Questo progetto può essere usato come base per un servizio SaaS multi-tenant (container isolato per
utente, piani, billing, backoffice). Quella logica **non vive in questo repo pubblico**: va tenuta in un
repository separato e privato, che dipende da questo solo per `server/` e `public/` (es. servendoli da un
proxy/gateway esterno, o copiandoli come contesto di build di un'immagine Docker). Non reintrodurre qui
cartelle tipo `saas/` con billing, orchestrazione container o backoffice: è successo una volta (poi rimosso
e spostato in repo privato) — evitarlo di nuovo.

## 6. Regole per l'agente che lavora qui

- Non aggiungere dipendenze npm senza un motivo chiaro.
- Non introdurre frame/bordi attorno a chat e terminale, non duplicare i menu (layout ispirato a
  claudecodeui: un solo header, titolo e tab sulla stessa riga).
- Testare sempre il giro completo dopo modifiche a chat/terminale: nuova sessione → messaggio → cambio
  sessione → terminale, in entrambe le direzioni.
- Non mettere mai token/PIN in query string o in posti leggibili da JS non necessari.
- Non committare mai segreti, chiavi API, dettagli di infrastruttura di chi ospita il servizio (domini,
  path server, credenziali) in questo repo pubblico.
