# 🪐 AgyCodeUI (Antigravity Code UI)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-black.svg)](https://socket.io)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple.svg)](public/manifest.json)
[![Security: Hardened](https://img.shields.io/badge/Security-Hardened-red.svg)](#-sicurezza-hardened--difesa-in-profondit)
[![GitHub Discussions](https://img.shields.io/badge/Discussions-Join-teal.svg)](https://github.com/djabloo/AgyCodeUI/discussions)
[![Community](https://img.shields.io/badge/Community-Welcome-orange.svg)](COMMUNITY.md)

Un'interfaccia web e mobile moderna, reattiva e orientata alla sicurezza per interagire con **Google Antigravity CLI (`agy`)** da qualsiasi browser o smartphone, sia in esecuzione su una VPS remota sia in locale.

---

## 📱 Caratteristiche Principali

### 💬 Chat & Gestione Sessioni Multi-Conversazione
- Visualizzazione delle conversazioni in stile chat con rendering Markdown completo, formattazione tabelle ed elenchi.
- Evidenziazione sintattica del codice multilingua con **Highlight.js** e pulsante rapido di copia codice con un tocco.
- Streaming bidirezionale in tempo reale dei prompt e dell'output dell'agente.
- Gestione multi-sessione persistente (salvataggio locale su JSON, creazione, rinomina, ricerca testuale ed eliminazione sessioni).

### 💻 Terminale Interattivo PTY Dual-Mode
- Emulatore di terminale pseudo-TTY nativo basato su `node-pty`, `xterm.js` e WebSockets.
- Switch istantaneo tra la vista **Chat** e la vista **Terminale RAW** mantenendo la sincronizzazione del processo CLI sottostante.
- Supporto completo a sequenze ANSI, colori a 256/TrueColor e ridimensionamento dinamico della finestra (fit addon).

### 📱 PWA & Mobile-First Touch Experience
- Installabile come **Progressive Web App (PWA)** su iOS (Safari: *Aggiungi a Home*) e Android (Chrome: *Installa App*) per un'esperienza a schermo intero senza barre del browser.
- Icone adattive dedicate (192x192, 512x512, apple-touch-icon e favicon SVG).
- Layout ottimizzato `100dvh` con supporto per safe-area insets (evita sovrapposizioni con la tastiera virtuale e la home bar).
- Barra di navigazione ergonomica inferiore per l'uso con una sola mano su smartphone.

### ⚡ Quick Actions & Comandi Rapidi
- Barra di pulsanti rapidi a sfioramento per velocizzare l'interazione con l'agente CLI: `Sì (y)`, `No (n)`, `Invio`, `Ctrl+C`, `Tab`, `Esc`.
- Scorciatoie rapide per i comandi slash più utilizzati (`/goal`, `/plan`, `/schedule`, `/browser`, `/help`, `/models`, `/agents`, `/mcp`).

### 🎙️ Dettatura Vocale (Voice-to-Text)
- Trascrizione vocale in tempo reale basata su Web Speech API integrata nel campo prompt (supporto multilingua con riconoscimento automatico).

### 📂 File Explorer & Code Preview
- Navigazione ad albero dei file e cartelle del workspace di lavoro.
- Visualizzatore rapido del codice sorgente con pulsante *"Usa nel Prompt"* per allegare file direttamente nella conversazione.

### ⚙️ Centro Impostazioni Completo (5 Aree)
1. **🤖 Account & Modelli AI**: Switch a 1-clic tra modelli supportati (Gemini 3.7 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6 Thinking, Claude Opus 4.6 Thinking, GPT-OSS 120B) e regolazione del Reasoning Effort (*High, Medium, Low*).
2. **🔌 Server MCP (Model Context Protocol)**: Gestione completa dei server MCP (`agy mcp`), switch di attivazione/disattivazione, eliminazione e template di configurazione rapida (*Filesystem, GitHub, PostgreSQL, SQLite, Memory, Fetch*).
3. **🛡️ Permessi & Sicurezza**: Switch auto-approvazione permessi (`--dangerously-skip-permissions`), sandbox (`--sandbox`), cambio PIN di accesso e selezione cartella workspace.
4. **🧠 Skills**: Esploratore delle skill installate e built-in, visualizzatore formattato di `SKILL.md` ed editor per creare o rimuovere skill personalizzate.
5. **🧩 Plugin**: Gestione e ispezione dei plugin CLI installati (`agy plugin`) e importazione da configurazioni Gemini/Claude.

---

## 🛡️ Sicurezza Hardened & Difesa in Profondità

AgyCodeUI include un'architettura di sicurezza progettata specificamente per l'esposizione su server e VPS:

- 🔒 **Blocco Avvio Insicuro su `0.0.0.0`**: Il server termina immediatamente all'avvio (`process.exit(1)`) se configurato per ascoltare su tutte le interfacce (`0.0.0.0`) senza un `AUTH_PIN` attivo.
- ⏱️ **Verifica PIN Timing-Safe**: Confronto crittografico del PIN a tempo costante (`crypto.timingSafeEqual`) per neutralizzare attacchi di tipo side-channel timing.
- 🛑 **Protezione Anti Brute-Force**: Rate limiting basato su IP (`trust proxy` abilitato) che impone un blocco temporaneo di 15 minuti (`429 Too Many Requests`) dopo 5 tentativi di PIN errati consecutivi.
- 🛡️ **Protezione CSWSH (Cross-Site WebSocket Hijacking)**: Middleware CORS disabilitato su Express e verifica rigorosa dell'origine via `allowRequest` su Socket.io per impedire a siti web malevoli di dirottare la connessione WebSocket.
- 📁 **Prevenzione Rigorosa Path Traversal & Symlink Escape**:
  - Validazione regex restrittiva per nomi di Skills, MCP e Plugins (`validateSkillName`, `validateMcpName`, `validatePluginName`), con rifiuto immediato (`400 Bad Request`) di sequenze traversal come `../`.
  - Risoluzione canonica dei percorsi con `fs.realpathSync` nel File Explorer: qualsiasi tentativo di fuga dal workspace restituisce errore `403 Forbidden`.
- 💉 **Esecuzione Comandi Protetta**: Sostituito l'uso di shell con `execFile` e passaggio esplicito di array di argomenti sanitizzati (zero rischio di shell injection tramite metacaratteri `;`, `|`, `&&`, `$()`).
- 📝 **Protezione Injection nel File `.env`**: Validazione rigorosa che rigetta caratteri di nuova riga (`\r`, `\n`) durante il salvataggio dei parametri di configurazione.
- 🔑 **Gestione Sicura dei Token**: Il PIN viaggia unicamente tramite header `Authorization: Bearer <PIN>` nelle chiamate REST e tramite payload di handshake `socket.handshake.auth.token` in WebSocket (nessun leak nei parametri query URL o negli endpoint di stato).

---

## 🚀 Installazione e Configurazione

### 1. Prerequisiti
- **Node.js**: versione 20.x o superiore (LTS consigliata)
- **NPM**: versione 9.x o superiore
- **Google Antigravity CLI (`agy`)**: installata e configurata sul sistema host

### 2. Clonazione del Repository

```bash
git clone https://github.com/<your-username>/AgyCodeUI.git
cd AgyCodeUI
npm install
```

### 3. Configurazione Variabili d'Ambiente

Copia il template `.env.example` in `.env`:

```bash
cp .env.example .env
```

Modifica il file `.env` con i parametri desiderati:

```env
# Porta su cui ascolterà il server web
PORT=3080

# Per massima sicurezza su VPS usa HOST=127.0.0.1 (raggiungibile via Caddy Reverse Proxy o Tailscale).
# Se imposti HOST=0.0.0.0, l'impostazione di AUTH_PIN è OBBLIGATORIA.
HOST=127.0.0.1

# PIN/Password di sicurezza per l'accesso web (OBBLIGATORIO se HOST=0.0.0.0)
AUTH_PIN=IlTuoPinSicuro

# Cartella di lavoro iniziale per AGY CLI (opzionale, es. /home/utente/progetti o vuoto per default)
WORKSPACE_DIR=

# Comando CLI da eseguire (default: agy)
CLI_COMMAND=agy

# Parametri aggiuntivi per il comando agy (opzionale, es. --dangerously-skip-permissions)
CLI_ARGS=
```

### 4. Avvio dell'Applicazione

**Avvio standard:**
```bash
npm start
```

**Avvio in modalità sviluppo (con nodemon):**
```bash
npm run dev
```

**Avvio persistente in background con PM2 (Consigliato per Server / VPS):**
```bash
# Avvia il processo
pm2 start server/index.js --name agycodeui

# Salva la lista per il ripristino automatico al riavvio del server
pm2 save

# Configura il servizio systemd per l'avvio automatico al boot
pm2 startup
```

---

## 🔒 Best Practice per Distribuzione in Produzione

### Opzione A: Reverse Proxy Caddy con HTTPS Automatico (Consigliata)
Mantieni `HOST=127.0.0.1` nel file `.env` e configura un reverse proxy con certificato TLS automatico (es. con Caddy in `/etc/caddy/Caddyfile`):

```caddy
agy.tuodominio.com {
    reverse_proxy 127.0.0.1:3080
}
```

Ricarica Caddy con:
```bash
sudo systemctl reload caddy
```

### Opzione B: VPN Mesh Privata (Tailscale)
- Configura `HOST=127.0.0.1` o l'IP dell'interfaccia Tailscale.
- Accedi in sicurezza da smartphone o laptop tramite l'IP privato Tailscale senza dover aprire porte sul firewall pubblico.

### Configurazione Firewall (UFW)
Assicurati che la porta interna `3080/tcp` non sia esposta direttamente all'esterno:
```bash
# Se precedentemente aperta, rimuovi la regola per la porta 3080
sudo ufw delete allow 3080/tcp

# Mantieni aperte solo le porte standard HTTPS/HTTP per il proxy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 📁 Struttura del Progetto

```text
agycodeui/
├── package.json              # Dipendenze del progetto (express, socket.io, node-pty, dotenv)
├── LICENSE                   # Licenza MIT
├── .env.example              # Template variabili d'ambiente
├── README.md                 # Documentazione principale del progetto
│
├── server/
│   ├── index.js              # Server Express, Socket.io, timing-safe auth, rate limiting
│   ├── ptyManager.js         # Gestore ciclo di vita del processo pseudo-terminale node-pty
│   ├── sessionManager.js     # Gestione persistenza sessioni chat (JSON store)
│   ├── data/
│   │   └── sessions.json     # Archivio locale delle sessioni chat
│   └── api/
│       ├── files.js          # API REST file explorer con protezione symlink & traversal
│       ├── sessions.js       # API REST gestione conversazioni e cronologia
│       └── settings.js       # API REST modelli, server MCP, permessi, skills e plugin
│
└── public/
    ├── index.html            # Single Page Application (SPA) con Bottom Nav, Chat e Terminale
    ├── manifest.json         # Manifest PWA per installazione mobile nativa
    ├── favicon.ico / .svg    # Icone vettoriali e standard
    ├── icon-192.png          # Icona PWA per dispositivi mobili
    ├── icon-512.png          # Icona PWA ad alta risoluzione
    ├── apple-touch-icon.png  # Icona iOS per Homescreen
    ├── css/
    │   └── style.css         # Dark theme moderno, responsive 100dvh e animazioni
    └── js/
        ├── app.js            # Controller SPA, autenticazione PIN, tab routing
        ├── chat.js           # Controller chat, rendering Markdown/hljs, streaming
        ├── terminal.js       # Controller terminale xterm.js e connessione PTY
        ├── settings.js       # Controller centro impostazioni
        ├── fileExplorer.js   # Controller navigatore file e preview codice
        └── speech.js         # Controller riconoscimento vocale Web Speech API
```

---

## 📡 Riferimento API REST

Tutte le richieste API autenticate richiedono l'header `Authorization: Bearer <PIN>`:

| Metodo | Endpoint | Descrizione |
| :--- | :--- | :--- |
| `POST` | `/api/auth` | Verifica del PIN con rate limiting anti brute-force |
| `GET` | `/api/status` | Stato del processo PTY, sessione attiva e workspace |
| `POST` | `/api/restart` | Riavvio forzato del processo PTY |
| `GET` | `/api/sessions` | Elenco di tutte le sessioni salvate |
| `POST` | `/api/sessions` | Creazione di una nuova sessione |
| `GET` | `/api/sessions/:id` | Dettaglio e messaggi di una specifica sessione |
| `DELETE` | `/api/sessions/:id` | Eliminazione di una sessione |
| `PUT` | `/api/sessions/:id/title` | Modifica del titolo di una sessione |
| `GET` | `/api/files/tree?path=...` | Elenco directory e file (traversal & symlink safe) |
| `GET` | `/api/files/content?path=...` | Lettura contenuto file per anteprima |
| `GET` | `/api/settings/info` | Info configurazione, stato PIN e modelli disponibili |
| `POST` | `/api/settings/permissions` | Aggiornamento permessi CLI, PIN, args e modello |
| `GET` | `/api/settings/mcp` | Elenco server MCP configurati |
| `POST` | `/api/settings/mcp` | Aggiunta nuovo server MCP |
| `DELETE`| `/api/settings/mcp/:name` | Rimozione server MCP |
| `POST` | `/api/settings/mcp/:name/toggle` | Abilitazione / disabilitazione server MCP |
| `GET` | `/api/settings/skills` | Elenco delle skill installate e built-in |
| `POST` | `/api/settings/skills` | Creazione nuova skill (`SKILL.md`) con validazione |
| `GET` | `/api/settings/skills/:name/content` | Lettura sicura del file `SKILL.md` |
| `DELETE`| `/api/settings/skills/:name` | Eliminazione sicura della skill |
| `GET` | `/api/settings/plugins` | Elenco dei plugin installati e importati |
| `POST` | `/api/settings/plugins/install` | Installazione nuovo plugin CLI |
| `POST` | `/api/settings/plugins/import` | Importazione plugin da Gemini / Claude |
| `DELETE`| `/api/settings/plugins/:name` | Disinstallazione plugin |

---

## 👥 Community & Supporto

La community di **AgyCodeUI** e **AGYUI.ai** è aperta a tutti gli sviluppatori:
- 💬 **Domande & Idee**: partecipa alle conversazioni su [GitHub Discussions](https://github.com/djabloo/AgyCodeUI/discussions)
- 🐛 **Segnalazioni**: apri un report strutturato su [GitHub Issues](https://github.com/djabloo/AgyCodeUI/issues)
- 🤝 **Linee Guida**: consulta la nostra [Guida ai Contributi](CONTRIBUTING.md) e il [Codice di Condotta](CODE_OF_CONDUCT.md)
- 🧭 **Panoramica Community**: consulta [COMMUNITY.md](COMMUNITY.md) per tutti i canali e le risorse
- 🪐 **Cloud Platform & Demo**: [agyui.ai](https://agyui.ai) / [agy.proseo.it](https://agy.proseo.it)

---

## 📄 Licenza

Distribuito sotto licenza [MIT](LICENSE).

