# Notebook (Gemini Notebook / NotebookLM)

Tab per creare notebook, aggiungere fonti, fare domande e generare contenuti
Studio (podcast, report, quiz, flashcard, mappe mentali, slide) su
[Gemini Notebook](https://notebooklm.google.com), senza uscire da AGYUI.

Usa [`nlm`](https://github.com/jacob-bd/gemini-notebook-mcp-cli), CLI di terze
parti — **non è un plugin ufficiale Google**, e non esiste un'API ufficiale
di Gemini Notebook. `nlm` funziona leggendo i cookie di sessione del tuo
account Google.

## Solo self-hosted, di proposito

Questo plugin **non è pensato per il SaaS multi-utente**. Il motivo: i cookie
che `nlm` salva sono la sessione Google intera (non uno scope limitato a
Notebook — chi li ha in mano ha accesso al tuo account Google). Farlo per
ogni utente della SaaS richiederebbe un browser virtuale per persona e la
custodia dei loro cookie Google: un salto di rischio che non vale il
beneficio. Qui gira su una sola macchina, per un solo account, sotto il tuo
controllo diretto.

## Setup (una volta sola)

Il plugin porta con sé un ambiente Python isolato (`venv/`, non versionato in
git — va creato su ogni macchina dove serve):

```bash
cd plugins/agyui-plugin-notebook
python3 -m venv venv
venv/bin/pip install notebooklm-mcp-cli
```

### Login

`nlm` estrae i cookie da un vero browser che apre lui stesso — su un server
senza desktop questo non funziona. Si usa invece la **modalità manuale**:
estrai i cookie una volta dal tuo browser normale, poi importali qui.

1. Apri Chrome (o altro browser) sul tuo computer, vai su
   https://notebooklm.google.com e accedi
2. Premi F12 → tab **Network** → filtra per `batchexecute`
3. Apri un notebook per generare una richiesta, clicca su una riga
   `batchexecute` nella lista
4. Nel pannello a destra, **Request Headers** → trova la riga `cookie:` →
   copia il valore
5. Salvalo in un file di testo, es. `cookies.txt`, e caricalo sulla macchina
   dove gira AGYUI (es. `scp cookies.txt tino@server:/tmp/`)
6. Sulla macchina:
   ```bash
   cd plugins/agyui-plugin-notebook
   venv/bin/nlm login --manual --file /tmp/cookies.txt
   ```
7. Riavvia il plugin dalla UI (o `pm2 restart agycodeui`) e verifica: la
   pillola di stato nel tab deve diventare "account collegato"

I cookie durano a lungo ma non per sempre: se lo stato torna "non
collegato", ripeti dal punto 5 con cookie freschi. `nlm auth refresh` può
rinnovarli in automatico se hai fatto un `nlm login` con browser reale invece
del file mode — non garantito nel nostro caso.

### Percorso del binario

Il server del plugin chiama `venv/bin/nlm` per percorso assoluto (variabile
`NLM_BIN` in `server.js`, sovrascrivibile via env se il venv sta altrove).
Non serve che `nlm` sia nel `PATH` del processo agycodeui.

## Cosa fa

| Tab | Funzione |
|---|---|
| **Fonti** | aggiungi URL, video YouTube, testo incollato, o carica un file (PDF/TXT/MD) come fonte del notebook |
| **Chat** | fai domande sulle fonti del notebook (persiste anche nella UI web di Notebook) |
| **Studio** | genera Podcast, Report, Quiz, Flashcard, Mappa mentale, Slide; scarica quelli pronti |

## Cosa manca (scelta di scope, non limite tecnico)

`nlm` espone 43 strumenti; questo plugin ne copre un sottoinsieme utile:
niente video (richiede più tempo/quota), niente revisione slide, niente
ricerca web/Drive, niente batch/pipeline/tag/cross-notebook query, niente
condivisione notebook. Aggiungerli è un'estensione di `server.js` (stesso
pattern: uno spawn di `nlm <comando> --json` per rotta), non un redesign.

## Licenza

MIT, come AGYUI. `nlm`/`notebooklm-mcp-cli` ha la propria licenza (MIT) e
il proprio disclaimer: usa API interne non documentate di Google, a tuo
rischio.
