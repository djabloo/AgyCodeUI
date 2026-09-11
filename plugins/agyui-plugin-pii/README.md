# AGYUI PII

Tab di anonimizzazione documenti dentro l'interfaccia AGYUI.

Non reimplementa il rilevamento: usa il motore [Rizzo-PII](https://github.com/Rizzo-AI-Academy/rizzo-pii)
gia' installato sulla macchina (container condiviso su `127.0.0.1:5005`, offline).
Il plugin e' **solo frontend** — nessun processo da avviare, nessuna porta da aprire.

## Cosa fa

| | |
|---|---|
| **Testo / Documento** | incolla testo oppure trascina un PDF, TXT o Markdown |
| **Anteprima** | testo originale con i dati personali evidenziati |
| **Anonimizzato** | testo con i segnaposto (`[FULLNAME_1]`, `[CF_1]`, …), copiabile |
| **Entita'** | tabella per segnaposto: tipo, valore originale, fonte (modello o regex), occorrenze |
| **PDF** | anteprima pagina per pagina e download del PDF redatto — il contenuto viene **rimosso** dal file, non solo coperto |
| **Decodifica** | rilegge un testo anonimizzato usando il dizionario reversibile salvato nel browser |
| **Salva per l'agente** | scrive il risultato in `<workspace>/pii-clean/`, cosi' l'agente legge il documento censurato invece dell'originale |

Opzioni per richiesta: esclusione dei singoli tag (23 categorie, incluse quelle
legali italiane come `CF`, `PIVA`, `CATASTO`) e dizionario reversibile on/off.

## Come parla col motore

```
plugin  ──►  /api/pii/engine/<path>  ──►  rizzo-pii (127.0.0.1:5005)
```

Il bridge esiste identico nei due mondi, quindi il plugin non sa dove sta girando:

- **self-hosted** — `server/api/pii.js`
- **SaaS** — `gateway/index.js` (obbligatorio: nel container dell'utente
  `127.0.0.1:5005` non esiste, la rete `agyui-runners` ha `icc=false`)

La whitelist del bridge espone solo `health`, `settings` (lettura), `analyze`,
`preview`, `pdf`, `pdf/preview` e le pagine/PDF di un documento. `POST /settings`
e `/config` restano fuori di proposito: il motore e' condiviso fra tutti gli
utenti e cambierebbero le preferenze per chiunque. Le stesse opzioni viaggiano
per-richiesta (`exclude_tags`, `include_mapping`).

## Il dizionario reversibile

Con il dizionario attivo il motore restituisce anche la corrispondenza
segnaposto → valore originale, necessaria per la funzione **Decodifica**.
Quella mappa contiene dati personali in chiaro e viene tenuta **solo in
`localStorage` di questo browser** (chiave `agypii_map`), mai inviata altrove
e mai salvata nel workspace: "Salva per l'agente" scrive esclusivamente il
testo gia' censurato. Il pulsante *Cancella dizionario* la rimuove.

Per un'anonimizzazione definitiva basta spegnere l'interruttore *Dizionario
reversibile*: il motore non calcola nessuna mappa e la decodifica diventa
impossibile anche per noi.

## Licenza

MIT, come AGYUI. Il motore Rizzo-PII ha la propria licenza.
