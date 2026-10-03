# PII

Anonimizza testi e documenti prima di darli all'agente: nomi, codici fiscali,
IBAN, email, indirizzi e gli altri dati personali vengono sostituiti da
segnaposto. Il riconoscimento usa il motore
[Rizzo-PII](https://github.com/Rizzo-AI-Academy/rizzo-pii) di Rizzo AI Academy,
che gira sul server AgyCloud (o sul tuo, se usi il self-hosted): i documenti non
vengono inviati a servizi esterni.

## Cosa fa

| Funzione | |
|---|---|
| **Testo / Documento** | incolla un testo oppure trascina un PDF, TXT o Markdown |
| **Anteprima** | il testo originale con i dati personali evidenziati |
| **Anonimizzato** | il testo con i segnaposto (`[FULLNAME_1]`, `[CF_1]`, …), da copiare |
| **Entità** | elenco dei dati trovati: tipo, valore, occorrenze |
| **PDF** | anteprima pagina per pagina e download del PDF redatto: i dati vengono **rimossi** dal file, non solo coperti |
| **Decodifica** | rimette i valori originali in un testo anonimizzato |
| **Salva per l'agente** | salva il risultato in `pii-clean/` nel workspace, così l'agente lavora sul documento anonimizzato |

Puoi escludere singole categorie (sono 23, comprese quelle italiane come
codice fiscale, partita IVA e dati catastali).

## Il dizionario reversibile

Con il **dizionario reversibile** attivo il plugin ricorda la corrispondenza
segnaposto → valore originale, che serve per la Decodifica. Il dizionario resta
**solo nel tuo browser**: non viene salvato nel workspace né inviato altrove, e
"Salva per l'agente" scrive sempre e solo il testo anonimizzato. Il pulsante
*Cancella dizionario* lo elimina.

Per un'anonimizzazione definitiva spegni il dizionario: la corrispondenza non
viene nemmeno calcolata e la decodifica diventa impossibile.

## Come si usa

1. **Impostazioni → Plugin → PII → Installa**. Su una VPS dedicata, alla prima
   installazione viene scaricato il motore di riconoscimento (alcuni GB): può
   richiedere qualche minuto. Il motore si spegne da solo quando non lo usi e
   si riaccende alla prima richiesta.
2. Con l'interruttore puoi **spegnere** il plugin: sparisce dal menu e il
   motore si ferma, ma resta scaricato. **Disinstalla** libera anche lo spazio
   su disco.

## Disponibilità

Self-hosted e AgyCloud, compreso il piano **PII**.

## Licenza

MIT, come AgyCloud. Il motore Rizzo-PII ha la propria licenza.
