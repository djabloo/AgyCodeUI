## 📌 Tipo di Modifica
- [ ] 🐛 Bug fix (modifica retrocompatibile che risolve un problema)
- [ ] ✨ Nuova feature (modifica retrocompatibile che aggiunge funzionalità)
- [ ] ⚠️ Breaking change (modifica che potrebbe richiedere cambiamenti di configurazione)
- [ ] 📝 Documentazione / Community
- [ ] 🛡️ Sicurezza / Hardening

---

## 📝 Descrizione delle Modifiche
Descrivi brevemente cosa fa questa Pull Request e perché è necessaria.

Issue collegata: Fixes #

---

## 🛡️ Checklist di Sicurezza & Qualità
- [ ] **Nessun `exec()` non sicuro**: Non sono state introdotte concatenazioni arbitrarie di stringhe da input utente in comandi shell.
- [ ] **Validazione Input**: I parametri utente (nomi file, skill, MCP) sono validati contro path traversal (`../`).
- [ ] **Mobile & Responsive**: La modifica non rompe il layout su schermi touch o dispositivi mobili (`100dvh`).
- [ ] **Test Eseguiti**: Ho testato le modifiche localmente e `npm test` passa senza errori.
