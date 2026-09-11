# 🪐 AGY Terminal — Web Terminal Plugin (Antigravity & AGYUI)

Terminale web multi-tab professionale e resiliente per **AGYUI** e **CloudCLI UI**, basato su [xterm.js](https://xtermjs.org/) e [node-pty](https://github.com/microsoft/node-pty) con integrazione nativa per **Google Antigravity CLI (`agy`)**.

Apre sessioni shell multiple a schede nel browser, garantisce la sopravvivenza dei processi PTY alle disconnessioni di rete, include scorciatoie dedicate per `agy` e rispetta il design system cosmico Deep Space di AGYUI.

## 🚀 Caratteristiche Principali

- **Supporto Nativo Antigravity (`agy`)**:
  - Inclusione automatica di `~/.local/bin` nel PATH per esecuzione immediata del comando `agy`.
  - Pulsante rapido `[🪐 agy]` nella barra superiore per invocare istantaneamente `agy`.
  - Tasto rapido `agy` dedicato nella barra tastiera mobile.
- **Multi-Tab Shells Resilienti**:
  - Tab illimitate con processi PTY indipendenti.
  - Sopravvivenza alle disconnessioni (riconnessione automatica senza terminare build o processi in esecuzione).
  - Ring buffer di output (256 KB) per il replay fedele dei log persi offline.
- **Tema Cosmico AGYUI**:
  - Tema predefinito **AGY Cosmic Dark** (`#06080F`, accenti Electric Cyan `#06B6D4`, selezione Cosmic Indigo `#6366F1`).
  - Supporto per temi aggiuntivi (VS Dark, One Dark, Dracula, Solarized Dark, Light).
- **Barra Tastiera Mobile Completa**:
  - Tasti Esc, Tab, Ctrl, Alt, `^C`, `^D`, `^Z`, frecce direzionali, `agy`, Pipe, Tilde, Slash, ecc.
- **Ricerca Avanzata nello Scrollback**:
  - `Ctrl+Shift+F` con conteggio occorrenze, navigazione e highlight in tempo reale.
- **Sicurezza Blindata (Deep-Space Hardening)**:
  - WebSocket vincolato su loopback `127.0.0.1` ed esclusione di connessioni con header `Origin` browser non autorizzati (prevenzione CSWSH).
  - Canale dati PTY e canale controllo JSON rigorosamente separati (binary vs text frames).
  - Validazione preventiva dei percorsi di lavoro e delle shell eseguibili.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+`` ` `` | New terminal tab |
| `Ctrl+Shift+F` | Search the scrollback |
| `Ctrl+Shift+C` / `⌘C` | Copy selection |
| `Ctrl+Shift+V` / `⌘V` | Paste |
| `←` `→` (tab bar focused) | Move between tabs |
| `Esc` (settings / search) | Close the popover or search bar |

Plain `Ctrl+C`, `Ctrl+V`, `Ctrl+D` and friends are **never** intercepted — they go straight to the
shell, so SIGINT, vim, emacs and tmux all behave normally.

## Settings

Open the gear icon in the toolbar:

| Setting | Notes |
|---|---|
| Theme | `Auto (match app)` follows CloudCLI's light/dark mode |
| Font size | 8–32 px, applied to every tab |
| Cursor | Block, bar or underline |
| Shell (new tabs) | Any shell discovered on the host; existing tabs are unaffected |
| Copy on select | Off by default |
| GPU acceleration | WebGL renderer. Turn it off if box drawing, emoji or CJK render as black squares |
| Screen reader mode | Enables xterm's accessibility tree (costs some performance) |

## Installation

**From CloudCLI UI (recommended):** open **Settings → Plugins**, paste this repository URL and click
**Install**. CloudCLI clones the repo, installs dependencies and starts the backend automatically.

**Manual:**

```bash
git clone --depth 1 https://github.com/cloudcli-ai/cloudcli-plugin-terminal.git \
  ~/.claude-code-ui/plugins/cloudcli-plugin-terminal
cd ~/.claude-code-ui/plugins/cloudcli-plugin-terminal
npm install
npm run build
```

Then restart CloudCLI UI to pick up the new plugin.

## Development

```bash
npm install
npm run dev        # esbuild watch mode
npm run typecheck  # tsc --noEmit
npm test           # node --test — unit tests plus real PTY/WebSocket integration tests
npm run build      # production bundles into dist/
```

| Path | Purpose |
|---|---|
| `manifest.json` | Plugin metadata — name, version, slot, entry points |
| `src/index.ts` | Frontend entry — toolbar, tabs, settings, search, mobile key bar |
| `src/session.ts` | One terminal tab: xterm.js instance plus its resilient socket |
| `src/server.ts` | Backend — PTY sessions, WebSocket, HTTP info endpoint |
| `src/shell.ts` | Shell discovery, environment and cwd resolution (pure, unit-tested) |
| `src/protocol.ts` | Wire protocol shared by both sides |
| `src/prefs.ts` | Preference and tab persistence |
| `src/ui/` | Themes, icons, stylesheet |
| `scripts/build.mjs` | esbuild bundling, plus node-pty native-binding repair |
| `test/` | `node --test` suites |
| `dist/` | Build output (generated) |

## Protocol

The browser and the plugin server keep control traffic and terminal output on separate WebSocket
frame types:

- **binary frames** carry raw PTY bytes, in both directions
- **text frames** carry JSON control messages (`hello`, `init`, `ready`, `resize`, `ping`, `exit`)

That separation is not cosmetic. When both shared one channel and the receiver guessed by looking
for a leading `{`, any command whose output was a lone JSON object — `cat package.json`, `jq -c`,
`docker inspect` — had its output swallowed, and could even forge an `exit` message.

The server sends `hello` first and the client replies with `init`. CloudCLI's WebSocket proxy opens
its upstream connection asynchronously and silently drops anything sent before that upstream is
ready, so `hello` is the client's proof that the whole path is up — and it carries the terminal size
and project directory into the very first spawn.

## Dependencies

| Package | Why |
|---|---|
| `node-pty` | Spawns native pseudo-terminal processes |
| `ws` | WebSocket server for terminal I/O |
| `@xterm/*` | Terminal emulator and addons, bundled into `dist/index.js` at build time |
| `esbuild` | Bundler |

These are all regular `dependencies` rather than `devDependencies` on purpose: CloudCLI installs
plugins using the host's own environment, and a host running with `NODE_ENV=production` makes npm
skip `devDependencies` entirely — which would leave `npm run build` with no bundler.

## Security

- The plugin's WebSocket server binds to `127.0.0.1` on an ephemeral port and **refuses any
  handshake that carries an `Origin` header**. WebSocket connections are not subject to the
  same-origin policy, so without that check any web page the user visited could have scanned
  loopback ports and opened a shell. Browsers always send `Origin`; the CloudCLI host proxy, being
  a Node client, never does.
- HTTP requests are likewise refused unless they are Origin-free and addressed to a loopback host,
  which closes the DNS-rebinding variant.
- Browser → host WebSocket connections are authenticated by CloudCLI's JWT proxy.
- The shell a client asks for is validated against the shells discovered on the machine, so the
  picker can never become an arbitrary-exec channel. Requested working directories are checked and
  fall back to `$HOME`.
- Concurrent PTYs are capped, and detached sessions are reaped after 30 minutes.
- The plugin server exits when the CloudCLI host process goes away, instead of leaving orphaned
  shells behind.
- No npm `postinstall` scripts.

The terminal gives you a shell as *you*, by design. It grants no privilege you do not already have
at a local prompt.

## Requirements

- CloudCLI UI **v1.0.0+**
- Node.js **18+**

## License

MIT
