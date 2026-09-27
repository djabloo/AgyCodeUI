# agy-flow — decisioni tipizzate con probabilità reali

Plugin AgyCloud per decisioni **tipizzate** (`boolean`, `choice`, `score`, `numeric`)
che restituisce, per ogni domanda, la **distribuzione di probabilità reale** del modello
sulle opzioni, invece di testo libero.

Il design (stato non strutturato + domande tipizzate → matrice decisionale, e i preset)
è ispirato a [Rizzo Flow](https://github.com/Rizzo-AI-Academy/rizzo-flow) di
**Rizzo AI Academy**, che usa un modello locale. agy-flow usa invece un modello remoto
via OpenRouter: niente modello locale e niente RAM occupata sul server.

## Come funziona

1. Ogni domanda diventa una scelta a lettere: sì/no → A/B, scelta → A/B/C…,
   punteggio → un livello per lettera, numero → le `anchors` diventano le opzioni.
2. Il modello genera **un solo token** (la lettera) con `logprobs` attivi.
3. Le probabilità delle lettere, normalizzate, sono la distribuzione mostrata.
   `coverage` indica quanta probabilità è finita su lettere valide: se è bassa,
   la risposta è marcata `low_coverage`.
4. Le domande partono in parallelo: una decisione completa richiede ~0,5–1 s.

Modelli (in cascata, se uno non risponde si passa al successivo), verificati con
logprobs + `provider.require_parameters`:

| Modello | Note |
|---|---|
| `mistralai/mistral-nemo` | default, ~0,7 s |
| `meta-llama/llama-3.1-8b-instruct` | ~0,8 s |
| `deepseek/deepseek-v4-flash` | ~1,5–2 s, ragionamento disattivato |

Costo indicativo: ~1 centesimo ogni 1000 decisioni.

## Chiave OpenRouter (BYOK)

La chiave è dell'utente e i costi sono sul suo account:

- **AgyCloud**: Dashboard → Chiavi API → OpenRouter (arriva nel container come `OPENROUTER_API_KEY`).
- **Self-hosted**: `OPENROUTER_API_KEY=...` nel `.env` di agycodeui, poi riavvio.

Consigliato impostare un **limite di spesa** sulla chiave, da openrouter.ai.

Senza chiave il plugin lo segnala e offre di valutare con `agy -p`, **senza probabilità**
(più lento, risposte marcate come tali).

## API del plugin

- `GET /health` → stato chiave (configurata, valida, spesa/limite), modelli disponibili
- `GET /presets` → preset preconfigurati
- `POST /decide` `{ state, questions, model?, engine?: "agy" }` → `{ answers, model, timing, generated_tokens }`
