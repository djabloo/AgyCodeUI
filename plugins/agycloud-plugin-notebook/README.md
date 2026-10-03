# Notebook

Un notebook di ricerca dentro AgyCloud: raccogli le tue fonti, fai domande che
restano vincolate a quelle fonti e genera materiali pronti da usare, dal report
al podcast. Il motore è **agy** (Google Antigravity) con il tuo account Google:
nessuna chiave API e nessun servizio esterno da collegare.

## Cosa fa

**Fonti**
- testo incollato
- pagine web (da un indirizzo URL)
- video YouTube (agy apre il video e ne ricava titolo, canale e riassunto)
- file: PDF, TXT, Markdown, DOCX, CSV

**Chat**: domande sulle fonti del notebook. La conversazione prosegue con il
contesto delle domande precedenti.

**Studio**: genera a partire dalle fonti

| Formato | Risultato |
|---|---|
| Overview Audio | podcast a due voci (Diego ed Elsa) con player interattivo e trascrizione sincronizzata |
| Video narrato | presentazione video con voce narrante e slide sincronizzate in automatico |
| Presentazione | slide HTML a schermo intero, navigabili da tastiera, stampabili in PDF |
| Report | documento di sintesi |
| Infografica | pagina visiva stampabile in PDF |
| Quiz | domande a risposta multipla |
| Flashcard | carte domanda/risposta interattive |
| Mappa mentale | schema dei concetti (Mermaid) |
| Tabella dati | dati estratti dalle fonti, in tabella |

Tutto quello che crei resta nel tuo workspace, nella cartella `.agy-notebook/`.

## Come si usa

1. **Impostazioni → Plugin → Notebook → Installa**: compare la scheda in alto.
2. Crea un notebook, aggiungi le fonti, poi usa Chat o Studio.
3. Clicca su **Voci** nello Studio o nella barra laterale per configurare il motore vocale: puoi usare **Edge** (gratuito) oppure **ElevenLabs** inserendo la tua API Key e scegliendo le tue voci preferite.
4. Non ti serve per un po'? **Spegnilo** con l'interruttore: la scheda sparisce
   dal menu e il plugin non occupa memoria. Riaccenderlo è immediato.
   **Disinstalla** solo se vuoi toglierlo del tutto.

Generare uno Studio su fonti lunghe può richiedere qualche minuto.

## Voci e Privacy

- Le fonti e i risultati restano nel tuo workspace.
- Domande e generazioni passano da agy, con il tuo account Google.
- **Sintesi vocale**:
  - Di base le voci sono sintetizzate gratuitamente tramite Microsoft Edge.
  - Collegando la tua chiave **ElevenLabs**, l'audio di Overview Audio e Video narrato viene sintetizzato con i modelli neurali multilingua di ElevenLabs e le voci scelte dalla tua libreria.
  - La chiave ElevenLabs viene salvata nel tuo profilo utente (`~/.config/agycloud/notebook.json`), leggibile solo dal tuo utente e non nei file del notebook. Dalle API del plugin esce solo con le ultime 4 cifre.
  - Per documenti riservati anonimizzali prima con il plugin **PII**.

Per le immagini non serve un plugin: chiedile direttamente ad agy in chat, le
genera e le ritocca da solo con il tuo account Google.

## Disponibilità

Self-hosted e AgyCloud (dal piano Hobby in su).

## Licenza

MIT, come AgyCloud.
