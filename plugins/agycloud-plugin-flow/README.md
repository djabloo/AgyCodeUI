# agy-flow

Decisioni **tipizzate** con le probabilità reali del modello. Invece di una
risposta in testo libero, per ogni domanda ottieni la distribuzione di
probabilità sulle opzioni: sì/no, scelta tra più opzioni, punteggio o numero.

Il design (situazione da valutare + domande tipizzate → matrice decisionale, e
i preset) è ispirato a [Rizzo Flow](https://github.com/Rizzo-AI-Academy/rizzo-flow)
di **Rizzo AI Academy**. agy-flow usa un modello remoto via OpenRouter, quindi
non occupa memoria sul server.

## Cosa fa

- **Tipi di domanda**: sì/no, scelta, punteggio, numero.
- **Preset pronti**: triage, routing tra agenti, code review, moderazione.
- **Invio alla chat**: manda la decisione ad agy per proseguire il lavoro.
- **Veloce ed economico**: le domande partono in parallelo, una decisione
  completa richiede circa un secondo e costa circa 1 centesimo ogni 1000
  decisioni.

Se la probabilità finisce su risposte non valide, la risposta viene segnalata
come poco affidabile.

## Chiave OpenRouter

Serve una tua chiave [OpenRouter](https://openrouter.ai); i costi sono sul tuo
account. Consigliato impostare un **limite di spesa** sulla chiave.

- **AgyCloud**: Dashboard → Chiavi API → OpenRouter.
- **Self-hosted**: `OPENROUTER_API_KEY=...` nel `.env`, poi riavvio.

Senza chiave puoi far valutare la domanda ad agy, ma **senza probabilità**
(più lento).

## Come si usa

1. **Impostazioni → Plugin → agy-flow → Installa**.
2. Scegli un preset o scrivi le tue domande, poi **Decidi**.
3. Con l'interruttore puoi **spegnerlo** quando non ti serve: sparisce dal menu
   e non occupa memoria.

## Disponibilità

Self-hosted e AgyCloud (piani Growth e Team).

## Licenza

MIT, come AgyCloud.
