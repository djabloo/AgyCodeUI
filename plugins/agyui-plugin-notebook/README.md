# Notebook

Notebook di ricerca nativo AGYUI: raccogli fonti, fai domande vincolate a
quelle fonti, genera Report/Quiz/Flashcard/Mappa mentale/Tabella dati —
tutto senza uscire dalla IDE.

## Motore: agy, non un servizio esterno

A differenza di un wrapper su NotebookLM/Gemini Notebook (valutato e
scartato: richiedeva i cookie di sessione dell'intero account Google, con
tutti i rischi che comporta), questo plugin usa **agy** — lo stesso motore
già autenticato in ogni ambiente, self-hosted o SaaS che sia. Nessun
account terzo, nessun bridge speciale, nessuna dipendenza nuova.

Concretamente: le "fonti" sono file dentro il workspace
(`<workspace>/.agy-notebook/<id>/sources/`), e ogni domanda o generazione
lancia `agy` in modalità non interattiva ("print mode": `agy -p=<prompt>
--output-format stream-json --dangerously-skip-permissions`), lo stesso
meccanismo già usato da `server/agentRunner.js` per la Chat strutturata.
Per lo Studio, invece di fidarsi di un output JSON generato dall'LLM, si
chiede ad agy di **scrivere** il risultato in un file preciso (usa i suoi
stessi strumenti di lettura/scrittura file) — più robusto che fare il
parse di qualcosa che un modello ha "inventato" in stdout.

## Cosa fa

| Tab | Funzione |
|---|---|
| **Fonti** | URL (il testo viene estratto), file caricato, o testo incollato |
| **Chat** | domande vincolate esplicitamente alle fonti del notebook — la prima domanda imposta il contesto, le successive continuano la stessa conversazione agy (`--conversation`) |
| **Studio** | Report, Quiz, Flashcard, Mappa mentale (renderizzata con Mermaid), Tabella dati |

## Cosa manca (scelta di scope, non limite tecnico)

Niente Audio/Video/Presentazione/Infografica: richiederebbero sintesi
vocale o generazione video/immagini, che `agy` non fa. Aggiungerli in
futuro è un servizio a parte, non un'estensione naturale di questo plugin.

## Note tecniche

- **Workspace**: il plugin legge sempre il workspace corrente da
  `/api/status` (stessa fonte usata dal resto della IDE) e lo passa ad
  ogni chiamata — segue automaticamente lo switch ambiente.
- **Estrazione testo da URL**: strip HTML essenziale via regex, non una
  vera libreria di readability — può includere rumore (menu, nav) su
  pagine complesse. Sufficiente per dare contesto ad agy, non perfetto.
- **Timeout**: le chiamate ad agy hanno un timeout di 10 minuti
  (`NOTEBOOK_AGY_TIMEOUT_MS`, sovrascrivibile via env) — generare uno
  Studio su fonti lunghe non è istantaneo.

## Licenza

MIT, come AGYUI.
