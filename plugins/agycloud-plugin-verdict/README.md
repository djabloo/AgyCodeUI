# agy-verdict

**Verdetti e decisioni tipizzate ad alta precisione con probabilità reali (logprobs).**

Invece di far generare testo libero o spiegazioni verbose, `agy-verdict` valuta qualsiasi testo, log o stato non strutturato e calcola la **distribuzione di probabilità matematica reale** sulle opzioni previste. 

Una decisione tipizzata a **zero token generati** (1 token vincolato su scelta A, B, C...) con latenza sub-secondo (~400-600ms) e costo irrisorio (~1 centesimo ogni 1000 verdetti).

---

## 🚀 Caratteristiche Principali

- **Domande Tipizzate**:
  - `Boolean`: decisioni binarie (Sì / No) con certezza percentuale.
  - `Choice`: scelta categorica tra opzioni arbitrarie con matrice di probabilità.
  - `Score`: valutazione su scala discreta (es. 1-5, 1-10) con calcolo del valore atteso continuo.
  - `Numeric`: stima di valori numerici con ancore e distribuzione di probabilità.
- **Metriche di Incertezza**: calcolo automatico di margine di confidenza, entropia di Shannon e copertura della massa probabilistica.
- **Preset Operativi Inclusi**:
  - 🎫 *Assistenza Clienti & Ticket Triage*: classificazione priorità, coda e urgenza da messaggi utente.
  - ⚡ *Agent Workflow Router*: indirizzamento al volo dei prompt verso il subagent specializzato migliore.
  - 🔍 *Code Review & PR Verdict*: approvazione, richiesta modifiche o blocco per sicurezza di pull request.
  - 🛡️ *Content Safety & Moderation*: conformità, rilevamento spam e violazioni policy.
  - 🐍 *Snake AI Decision Engine*: verdetto di movimento istantaneo per gameplay strategico.
- **Bridge Diretto ad Antigravity**: invio con 1 click della matrice decisionale alla chat di agy per proseguire l'esecuzione con contesto completo.
- **Zero Lock-in**: le domande vengono eseguite in parallelo su modelli remoti con logprobs calibrati.

---

## 🧠 Modelli Supportati

I modelli sono verificati per supportare logprobs nativi con `require_parameters`:

1. **Mistral Nemo (12B)**: eccezionale calibrazione logprob per scelte categoriche complesse (default).
2. **Llama 3.1 (8B)**: latenza ridotta (~400ms) e risposte stabili.
3. **Qwen 2.5 (7B Instruct)**: state of the art per logica formale e ragionamento.
4. **DeepSeek V4 Flash**: rapidissimo con reasoning disattivato.
5. **Fallback agy (CLI)**: valutazione locale tramite CLI di Antigravity nel caso non sia presente una chiave remota.

---

## 🔑 Configurazione Chiave (BYOK)

`agy-verdict` utilizza la tua chiave OpenRouter personale (BYOK - Bring Your Own Key):

- **Da Impostazioni AgyCodeUI**: apri **Impostazioni** → scheda **Account** → sezione **Chiavi API personali (BYOK)**, seleziona **OpenRouter**, incolla la chiave (`sk-or-v1-...`) e premi **Aggiungi Chiave**.
- **Dal Plugin**: clicca sull'icona ⚙️ delle impostazioni o direttamente sul badge di stato in alto a destra, inserisci la chiave e premi **Salva**.
- **Self-hosted da terminale**: imposta `OPENROUTER_API_KEY=sk-or-v1-...` nel file `.env` di AgyCodeUI.

---

## 🛠️ Come si Usa

1. Accedi alla scheda **agy-verdict** dalla barra laterale di AgyCodeUI (icona a forma di bilancia ⚖️).
2. Seleziona uno dei preset pronti oppure incolla il tuo testo nello **Stato Non Strutturato**.
3. Configura le **Domande Tipizzate** che desideri sottoporre al modello.
4. Premi **Esegui Decisione** (o `Ctrl + Enter` / `Cmd + Enter`).
5. Visualizza i verdetti, la matrice di probabilità, la confidenza e clicca **Invia ad Antigravity** per procedere.

---

## 📜 Crediti & Licenza

- **Design concettuale**: ispirato all'architettura decisionale tipizzata di [Rizzo Flow](https://github.com/Rizzo-AI-Academy/rizzo-flow) di **Rizzo AI Academy**.
- **Licenza**: MIT, parte dell'ecosistema AgyCodeUI / AgyCloud.
