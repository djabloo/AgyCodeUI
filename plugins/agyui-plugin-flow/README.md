# AGYUI Flow Plugin — Rizzo Flow (System One Decision Engine)

Integrazione nativa di [Rizzo Flow](https://github.com/Rizzo-AI-Academy/rizzo-flow.git) (sviluppato da **Rizzo AI Academy**) nell'interfaccia AGYUI.

Rizzo Flow è un'implementazione open-source e locale ispirata a **Jev** (TypeSafe): un motore decisionale *"System One"* basato su logprobs che prende uno stato non strutturato in ingresso e restituisce **decisioni tipizzate con distribuzioni probabilistiche (senza generare un singolo token di testo)**.

---

## 🌟 Caratteristiche

1. **Decisioni Probabilistiche Typed**:
   - **Boolean**: decisioni binarie Sì/No con probabilità $p(\text{true})$.
   - **Choice**: scelte categoriche con barre di probabilità per ogni opzione (soft-max sui logit).
   - **Score**: rubric e scale a livelli con distribuzione di certezza.
   - **Numeric**: stime e intervalli numerici ancorati.
2. **Zero Token Generati**:
   - Latenza ultra-bassa (~40-60 ms su GPU/CPU locale).
   - Nessun rischio di allucinazione del testo o output fuori schema.
3. **Bridge diretto con la Chat di Antigravity (AGY)**:
   - Pulsante *"Invia alla Chat di AGY"* per trasformare istantaneamente la matrice decisionale in un prompt operativo strutturato per l'agente.
4. **Preset Integrati**:
   - 🎫 **Assistenza Clienti & Triage Ticket**: priorità, reparto e urgenza da messaggi complessi.
   - ⚡ **Agent Workflow Router**: routing verso subagenti specifici (Security, DevOps, Coder, Reviewer).
   - 🔍 **Code Review & PR Verdict**: approvazione, modifiche richieste o blocco sicurezza.
   - 🛡️ **Moderazione Contenuti**: conformità, rilevamento spam e phishing.
   - 🐍 **Snake AI Move**: la celebre demo di gioco autonomo a 150 ms/decisione.
5. **Modalità Fallback & Simulatore**:
   - Quando il daemon locale `uv run rizzo serve` non è attivo sulla porta 8017, il plugin fornisce una valutazione euristica locale immediata per consentire test istantanei della UI.

---

## 🚀 Avvio del Daemon Locale Rizzo Flow (Spark-X2.5)

Per eseguire l'inferenza con il modello neurale open weight **Spark-X2.5-4B** (o 1.7B) su llama.cpp:

```bash
cd /tmp/rizzo-flow   # oppure clonalo nella tua cartella progetti
uv sync --locked
uv run rizzo download --size 1.7b   # scarica Spark-X2.5-1.7B e runtime llama.cpp
uv run rizzo serve                  # avvia il daemon su http://127.0.0.1:8017
```

Il plugin rileverà automaticamente la connessione e commuterà lo stato su **Spark-X2.5 (Attivo)**.
