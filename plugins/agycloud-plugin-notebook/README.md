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
| Overview Audio | podcast a due voci (Diego ed Elsa) con player interattivo |
| Report | documento di sintesi |
| Presentazione | slide HTML a schermo intero, navigabili da tastiera, stampabili in PDF |
| Infografica | pagina visiva stampabile in PDF |
| Quiz | domande a risposta multipla |
| Flashcard | carte domanda/risposta |
| Mappa mentale | schema dei concetti |
| Tabella dati | dati estratti dalle fonti, in tabella |

Tutto quello che crei resta nel tuo workspace, nella cartella `.agy-notebook/`.

## Come si usa

1. **Impostazioni → Plugin → Notebook → Installa**: compare la scheda in alto.
2. Crea un notebook, aggiungi le fonti, poi usa Chat o Studio.
3. Non ti serve per un po'? **Spegnilo** con l'interruttore: la scheda sparisce
   dal menu e il plugin non occupa memoria. Riaccenderlo è immediato.
   **Disinstalla** solo se vuoi toglierlo del tutto.

Generare uno Studio su fonti lunghe può richiedere qualche minuto.

## Privacy

- Le fonti e i risultati restano nel tuo workspace.
- Domande e generazioni passano da agy, con il tuo account Google.
- **Overview Audio**: le voci sono sintetizzate dal servizio vocale online di
  Microsoft Edge, quindi il testo del podcast viene inviato a quel servizio.
  Per documenti riservati anonimizzali prima con il plugin **PII**.

## In arrivo

- Voci **ElevenLabs** per l'Overview Audio e le presentazioni, con la tua
  chiave ElevenLabs: qualità molto più alta delle voci attuali.

Per le immagini non serve un plugin: chiedile direttamente ad agy in chat, le
genera e le ritocca da solo con il tuo account Google.

## Disponibilità

Self-hosted e AgyCloud (dal piano Hobby in su).

## Licenza

MIT, come AgyCloud.
