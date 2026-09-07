# 🪐 Guida ai Contributi (Contributing Guide)

Grazie per l'interesse a contribuire ad **AgyCodeUI / AGYUI**!  
Questo progetto è open source e accoglie contributi dalla community: correzioni di bug, nuove funzionalità, miglioramenti all'interfaccia mobile/PWA, nuove skills e server MCP per Google Antigravity (`agy`).

---

## 📋 Indice
1. [Linee Guida Generali](#1-linee-guida-generali)
2. [Setup dell'Ambiente di Sviluppo](#2-setup-dellambiente-di-sviluppo)
3. [Sicurezza: I Principi Non Negoziabili](#3-sicurezza-i-principi-non-negoziabili)
4. [Come Proporre Modifiche (Pull Request)](#4-come-proporre-modifiche-pull-request)
5. [Come Contribuire Nuovi Template MCP o Skills](#5-come-contribuire-nuovi-template-mcp-o-skills)
6. [Segnalazione di Vulnerabilità di Sicurezza](#6-segnalazione-di-vulnerabilità-di-sicurezza)

---

## 1. Linee Guida Generali

- **Discuti prima di grandi refactoring**: Per modifiche architetturali importanti o nuove dipendenze pesanti, apri prima una discussione in [GitHub Discussions (Ideas & RFC)](https://github.com/djabloo/AgyCodeUI/discussions) per allinearci.
- **Zero dipendenze superflue**: Manteniamo il footprint leggero e performante sia su server VPS a basse risorse che su macchine locali.
- **Supporto Mobile-First**: L'interfaccia deve restare perfettamente fruibile su schermi touch (layout `100dvh`, safe-area insets, bottoni ergonomici).

---

## 2. Setup dell'Ambiente di Sviluppo

### Requisiti
- **Node.js**: v20.x o superiore
- **Google Antigravity CLI (`agy`)**: installato e autenticato nel PATH di sistema (`agy --version`)
- **Git**

### Installazione
```bash
# 1. Clona il tuo fork
git clone https://github.com/tuo-username/AgyCodeUI.git
cd AgyCodeUI

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente
cp .env.example .env
# Modifica .env impostando un AUTH_PIN di sviluppo (es. AUTH_PIN=1234)

# 4. Avvia il server in modalità sviluppo
npm start
```

Il server sarà accessibile su `http://127.0.0.1:3080`.

---

## 3. Sicurezza: I Principi Non Negoziabili

AgyCodeUI è un'interfaccia web che espone un terminale PTY e la CLI `agy`. Ogni riga di codice deve rispettare rigorosi standard di difesa in profondità:

1. **Mai usare `exec()`**: Utilizzare sempre `execFile()` con passaggio di array di argomenti espliciti e sanitizzati. Non concatenare mai stringhe utente all'interno di comandi shell.
2. **Validazione dei Nomi & Prevenzione Path Traversal**: Qualsiasi identificatore di skill, MCP o plugin deve passare per funzioni di validazione rigorosa (`validateSkillName`, `validateMcpName`). Rigettare caratteri speciali (`../`, `~`, slash) con `400 Bad Request`.
3. **Verifica Percorsi Canonici**: Utilizzare sempre `fs.realpathSync` per verificare che la destinazione reale di symlink o percorsi si trovi rigorosamente all'interno del workspace consentito.
4. **Verifica Origine WebSocket (CSWSH)**: Non rilassare mai le policy di `allowRequest` su Socket.io per prevenire attacchi Cross-Site WebSocket Hijacking.

---

## 4. Come Proporre Modifiche (Pull Request)

1. Esegui il fork del repository.
2. Crea un branch semantico:
   - `feat/nome-funzionalita` per nuove feature
   - `fix/descrizione-bug` per bugfix
   - `docs/aggiornamento-guida` per documentazione
3. Assicurati che i test esistenti passino:
   ```bash
   npm test
   ```
4. Scrivi messaggi di commit chiari e sintetici (es. `fix(terminal): handle resize debounce on mobile rotation`).
5. Apri una Pull Request verso il branch `main` compilando il template fornito.

---

## 5. Come Contribuire Nuovi Template MCP o Skills

### Aggiungere un Template MCP
I template per i server MCP si trovano in `server/mcp.js`. Se vuoi aggiungere un preset ufficiale:
- Assicurati che utilizzi un pacchetto standard o un comando npx/docker ben documentato.
- Includi una descrizione chiara e le variabili d'ambiente necessarie (es. API token, connection string).

### Aggiungere una Custom Skill
Le skills built-in o di esempio devono contenere:
- `SKILL.md` con frontmatter YAML valido (`name`, `description`).
- Istruzioni step-by-step concise e non ambigue.

---

## 6. Segnalazione di Vulnerabilità di Sicurezza

Se identifichi una falla di sicurezza (RCE, bypass di autenticazione, path traversal o token leak):
- **NON aprire una issue pubblica**.
- Contatta direttamente il maintainer o invia una segnalazione privata tramite [GitHub Security Advisories](https://github.com/djabloo/AgyCodeUI/security/advisories/new).
