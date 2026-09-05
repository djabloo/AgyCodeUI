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
  agentRunner.js         Chat: per ogni prompt lancia `agy -p=<testo> --output-format stream-json` e traduce gli eventi
  sessionManager.js      sessioni chat (sessions.json), messaggi strutturati (content/thinking/toolCalls)
  transcriptSync.js      specchia in chat la trascrizione agy (~/.gemini/antigravity-cli/brain/<conv>/.system_generated/logs/transcript.jsonl)
  api/                   files (tree/content/upload), sessions, settings, workspaces, agents, workflows, metrics
public/                 frontend vanilla JS (index.html, js/*.js, css/style.css)
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
