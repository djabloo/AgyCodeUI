# XTerm

Terminale web a schede per AgyCloud, basato su [xterm.js](https://xtermjs.org/)
e [node-pty](https://github.com/microsoft/node-pty). È l'unico plugin
preinstallato.

## Cosa fa

- **Schede multiple**, ognuna con la sua shell.
- **Resiste alle disconnessioni**: se cade la rete i processi continuano
  (build, test, `agy`) e alla riconnessione rivedi l'output perso.
- **Tasto `agy`** nella barra per avviare Google Antigravity al volo.
- **Barra tasti per il telefono**: Esc, Tab, Ctrl, Alt, `^C`, `^D`, `^Z`,
  frecce, pipe, tilde e altri.
- **Ricerca** nello storico con `Ctrl+Shift+F`.
- **Temi**: automatico (segue AgyCloud chiaro/scuro), VS Dark, One Dark,
  Dracula, Solarized Dark, Light.

## Scorciatoie

| Scorciatoia | Azione |
|---|---|
| `Ctrl+Shift+`` ` `` | Nuova scheda |
| `Ctrl+Shift+F` | Cerca nello storico |
| `Ctrl+Shift+C` / `⌘C` | Copia la selezione |
| `Ctrl+Shift+V` / `⌘V` | Incolla |
| `←` `→` (barra schede attiva) | Passa da una scheda all'altra |
| `Esc` | Chiude impostazioni o ricerca |

`Ctrl+C`, `Ctrl+V`, `Ctrl+D` normali non vengono mai intercettati: arrivano
alla shell, quindi vim, emacs e tmux funzionano come sempre.

## Impostazioni

Dall'ingranaggio nella barra: tema, dimensione del carattere, forma del
cursore, shell per le nuove schede, copia alla selezione, accelerazione GPU
(disattivala se vedi quadrati neri al posto di bordi o emoji) e modalità
lettore di schermo.

## Come si usa

Già installato. Con l'interruttore in **Impostazioni → Plugin** puoi
**spegnerlo** se non lo usi: la scheda sparisce dal menu e non occupa memoria.

## Sviluppo

```bash
npm install
npm run dev        # build in watch mode
npm run typecheck
npm test           # test unitari e di integrazione (PTY e WebSocket reali)
npm run build      # bundle di produzione in dist/
```

## Licenza

MIT, come AgyCloud.
