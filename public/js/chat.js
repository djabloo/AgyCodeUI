class AgyChat {
    constructor() {
        this.socket = null;
        this.sessions = [];
        this.currentSession = null;
        this.isStreaming = false;
        this.autoScroll = true;
        this.activeModelName = 'Gemini 3.7 Flash Thinking';

        // DOM Elements
        this.chatMessagesEl = document.getElementById('chat-messages');
        this.chatInputEl = document.getElementById('chat-prompt-input');
        this.sessionsListEl = document.getElementById('sessions-list');
        this.sessionSearchEl = document.getElementById('session-search-input');
        this.activeSessionTitleEl = document.getElementById('active-session-title');
        this.sidebarEl = document.getElementById('sessions-sidebar');
        this.sidebarBackdropEl = document.getElementById('sidebar-backdrop');
        this.scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
        this.headerModelPillEl = document.getElementById('chat-header-model-pill');
        this.activeModelId = 'gemini-3.8-flash-high';
        this.activeEffort = 'high';
        this.modelsList = [];

        // Allegati chat (upload file / screenshot / PII)
        this.pendingAttachments = [];
        this.attachmentsBarEl = document.getElementById('chat-attachments-bar');
        this.attachInputEl = document.getElementById('chat-attach-input');
        this.piiInputEl = document.getElementById('chat-pii-input');
        this.attachBtnEl = document.getElementById('chat-attach-btn');
        this.piiBtnEl = document.getElementById('chat-pii-btn');
        this.screenshotBtnEl = document.getElementById('chat-screenshot-btn');

        // Menu Comandi Slash (/)
        this.slashPopupEl = document.getElementById('slash-commands-popup');
        this.slashSelectedIndex = 0;
        this.filteredSlashCommands = [];
        this.slashCommands = [
            { cmd: '/goal ', icon: '🎯', name: '/goal <task>', desc: 'Esegui un task a lungo termine fino al completamento' },
            { cmd: '/plan ', icon: '📋', name: '/plan <task>', desc: 'Pianifica step-by-step prima dell\'esecuzione' },
            { cmd: '/schedule ', icon: '⏱️', name: '/schedule <tempo>', desc: 'Imposta timer (es. 5m) o cron ricorrente' },
            { cmd: '/browser ', icon: '🌐', name: '/browser <url>', desc: 'Visita una pagina web o esegui web scraping' },
            { cmd: '/model ', icon: '🤖', name: '/model <id>', desc: 'Cambia modello AI attivo (Gemini, Claude, GPT)' },
            { cmd: '/learn ', icon: '🧠', name: '/learn <regola>', desc: 'Salva istruzioni e preferenze permanenti' },
            { cmd: '/agents', icon: '👥', name: '/agents', desc: 'Gestisci swarm di subagenti autonomi' },
            { cmd: '/mcp', icon: '🔌', name: '/mcp', desc: 'Visualizza e configura i server MCP' },
            { cmd: '/help', icon: '❓', name: '/help', desc: 'Mostra i comandi e la documentazione Antigravity' },
            { cmd: '/grill-me ', icon: '🔥', name: '/grill-me', desc: 'Intervista per chiarire requisiti architetturali' },
            { cmd: '/boost ', icon: '🚀', name: '/boost', desc: 'Attiva ragionamento profondo e multi-prospettiva' },
            { cmd: '/teamwork-preview ', icon: '🤝', name: '/teamwork-preview', desc: 'Collaborazione multi-agente avanzata' },
            { cmd: '/clear', icon: '🧹', name: '/clear', desc: 'Pulisci lo schermo della sessione' }
        ];

        this.configureMarkdown();
        this.setupEventDelegation();
        this.setupAttachments();
        this.setupGlobalClickHandlers();
    }

    configureMarkdown() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined') {
                        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                        try {
                            return hljs.highlight(code, { language }).value;
                        } catch (e) {
                            return code;
                        }
                    }
                    return code;
                },
                breaks: true,
                gfm: true
            });
        }
    }

    setupEventDelegation() {
        if (this.sessionsListEl) {
            this.sessionsListEl.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.btn-del');
                const renameBtn = e.target.closest('.btn-rename');
                const card = e.target.closest('.session-card');
                if (!card) return;
                const sessionId = card.dataset.sessionId;
                if (!sessionId) return;

                if (deleteBtn) {
                    e.stopPropagation();
                    this.deleteSession(sessionId);
                } else if (renameBtn) {
                    e.stopPropagation();
                    this.renameSession(sessionId);
                } else {
                    this.loadSession(sessionId);
                }
            });
        }

        if (this.chatMessagesEl) {
            this.chatMessagesEl.addEventListener('click', (e) => {
                const copyBtn = e.target.closest('.msg-copy-btn');
                if (copyBtn) {
                    const row = copyBtn.closest('.chat-message-row');
                    if (row) {
                        const body = row.querySelector('.message-body');
                        if (body) {
                            const text = body.innerText.replace(/\n*Copia.*$/i, '').trim();
                            navigator.clipboard.writeText(text).then(() => {
                                copyBtn.innerHTML = '<i data-lucide="check"></i> Copiato';
                                if (window.lucide) window.lucide.createIcons();
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<i data-lucide="copy"></i>';
                                    if (window.lucide) window.lucide.createIcons();
                                }, 2000);
                            }).catch(() => {});
                        }
                    }
                }
            });
        }
    }

    init(socket) {
        this.socket = socket;

        // Socket listeners
        this.socket.on('sessions-updated', (sessions) => {
            this.sessions = sessions;
            this.renderSessionsList();
        });

        this.socket.on('session-switched', (session) => {
            this.currentSession = session;
            this.updateActiveSessionHeader();
            this.renderMessages();
            this.renderSessionsList();
        });

        this.socket.on('chat-message', ({ sessionId, message }) => {
            if (this.currentSession && this.currentSession.id === sessionId) {
                const existingIdx = this.currentSession.messages.findIndex(m => m.id === message.id);
                if (existingIdx !== -1) {
                    this.currentSession.messages[existingIdx] = message;
                } else {
                    this.currentSession.messages.push(message);
                }
                if (message.role === 'assistant') {
                    this.isStreaming = false;
                    this.setStreamingUi(false);
                }
                this.appendOrUpdateMessage(message);
                if (this.autoScroll) this.scrollToBottom();
            }
        });

        this.socket.on('chat-stream', ({ sessionId, messageId, delta, fullContent, thinking, toolCalls, status }) => {
            if (this.currentSession && this.currentSession.id === sessionId) {
                let msg = this.currentSession.messages.find(m => m.id === messageId);
                if (!msg) {
                    msg = {
                        id: messageId,
                        role: 'assistant',
                        content: fullContent,
                        timestamp: new Date().toISOString(),
                        isStreaming: true
                    };
                    this.currentSession.messages.push(msg);
                } else {
                    msg.content = fullContent;
                    msg.isStreaming = true;
                }
                if (thinking !== undefined) msg.thinking = thinking;
                if (toolCalls !== undefined) msg.toolCalls = toolCalls;
                if (status !== undefined) msg.status = status;
                this.isStreaming = true;
                this.setStreamingUi(true);
                this.updateStreamingMessage(msg);
                if (this.autoScroll) this.scrollToBottom();
            }
        });

        this.socket.on('chat-error', ({ sessionId, error }) => {
            if (this.currentSession && this.currentSession.id === sessionId) {
                this.showTransientNotice(error || 'Errore sconosciuto');
            }
        });

        // Chat container scroll listener
        if (this.chatMessagesEl) {
            this.chatMessagesEl.addEventListener('scroll', () => {
                const threshold = 70;
                const atBottom = this.chatMessagesEl.scrollHeight - this.chatMessagesEl.scrollTop - this.chatMessagesEl.clientHeight <= threshold;
                this.autoScroll = atBottom;
                if (this.scrollToBottomBtn) {
                    if (atBottom) {
                        this.scrollToBottomBtn.classList.add('hidden');
                    } else {
                        this.scrollToBottomBtn.classList.remove('hidden');
                    }
                }
            });
        }

        // Search input
        if (this.sessionSearchEl) {
            this.sessionSearchEl.addEventListener('input', () => {
                this.renderSessionsList();
            });
        }

        // Auto-expand textarea and slash commands trigger
        if (this.chatInputEl) {
            this.chatInputEl.addEventListener('input', () => {
                this.chatInputEl.style.height = 'auto';
                this.chatInputEl.style.height = Math.min(this.chatInputEl.scrollHeight, 150) + 'px';
                this.handleInputChange();
            });
        }

        // Initialize sidebar draggable resizer
        this.setupSidebarResizer();

        // Chiudi il popover modello al click esterno
        document.addEventListener('click', (e) => {
            const popover = document.getElementById('chat-model-popover');
            const pill = document.getElementById('chat-toolbar-model-pill');
            if (popover && !popover.classList.contains('hidden')) {
                if (!popover.contains(e.target) && (!pill || !pill.contains(e.target))) {
                    this.closeModelPopover();
                }
            }
        });

        // Fetch initial sessions & model info
        this.fetchActiveModel();
        this.fetchSessions();
    }

    async fetchActiveModel() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/info', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.modelsList = data.models || [];
                const currentArgs = data.cliArgs || '';

                // Estrai model
                const modelMatch = currentArgs.match(/--model\s+([^\s]+)/);
                if (modelMatch) {
                    this.activeModelId = modelMatch[1];
                    const found = this.modelsList.find(m => m.id === this.activeModelId);
                    this.activeModelName = found ? found.name : this.activeModelId;
                } else {
                    this.activeModelId = 'gemini-3.8-flash-high';
                    this.activeModelName = 'Gemini 3.8 Flash (High)';
                }

                // Estrai effort
                const effortMatch = currentArgs.match(/--effort\s+([^\s]+)/);
                if (effortMatch) {
                    this.activeEffort = effortMatch[1];
                } else if (this.activeModelId.includes('high')) {
                    this.activeEffort = 'high';
                } else if (this.activeModelId.includes('medium')) {
                    this.activeEffort = 'medium';
                } else if (this.activeModelId.includes('low')) {
                    this.activeEffort = 'low';
                } else {
                    this.activeEffort = 'high';
                }

                this.updateModelPillUI();
                this.renderModelPopover();
            }
        } catch (e) {
            console.error('[Chat] Errore recupero modello:', e);
        }
    }

    updateModelPillUI() {
        if (this.headerModelPillEl) {
            this.headerModelPillEl.innerHTML = `
                <span class="model-pulse-dot"></span>
                <span class="model-pill-name">${this.escapeHtml(this.activeModelName)}</span>
            `;
        }

        const modelNameEl = document.getElementById('chat-toolbar-model-name');
        const modelEffortEl = document.getElementById('chat-toolbar-model-effort');
        const effortHintEl = document.getElementById('chat-popover-effort-hint');

        let cleanName = (this.activeModelName || 'Gemini Flash').replace(/\s*\([^)]*\)/g, '').trim();
        if (modelNameEl) modelNameEl.textContent = cleanName;
        if (modelEffortEl) modelEffortEl.textContent = this.activeEffort || 'high';
        if (effortHintEl) effortHintEl.textContent = this.activeEffort || 'high';

        // Aggiorna classi bottoni effort
        document.querySelectorAll('.effort-pill-btn').forEach(btn => {
            const eff = btn.getAttribute('data-effort');
            btn.classList.toggle('active', eff === this.activeEffort);
        });

        // Aggiorna selezione nella lista popover
        document.querySelectorAll('.chat-popover-model-item').forEach(item => {
            const mId = item.getAttribute('data-model-id');
            const isActive = mId === this.activeModelId;
            item.classList.toggle('active', isActive);
            const checkIcon = item.querySelector('.chat-popover-check-icon');
            if (checkIcon) checkIcon.style.display = isActive ? 'inline-block' : 'none';
        });

        this.updateToolbarBadges();
    }

    renderModelPopover() {
        const container = document.getElementById('chat-popover-model-list');
        if (!container || !this.modelsList || !this.modelsList.length) return;

        let html = '';
        for (const m of this.modelsList) {
            const isActive = m.id === this.activeModelId;
            const badge = m.id.startsWith('gemini') ? 'Google' : (m.id.startsWith('claude') ? 'Anthropic' : 'OSS');
            const cleanTitle = m.name.replace(/\s*\([^)]*\)/g, '').trim();

            html += `
                <div class="chat-popover-model-item ${isActive ? 'active' : ''}" data-model-id="${m.id}" onclick="window.agyChat.quickSelectModel('${m.id}')">
                    <div class="chat-popover-model-left">
                        <span class="chat-popover-model-title">${this.escapeHtml(cleanTitle)}</span>
                        <span class="chat-popover-model-id">${this.escapeHtml(m.id)}</span>
                    </div>
                    <div class="chat-popover-model-right">
                        <span class="chat-popover-provider-badge">${badge}</span>
                        <i data-lucide="check" class="chat-popover-check-icon" style="width: 13px; height: 13px; color: #60a5fa; display: ${isActive ? 'inline-block' : 'none'};"></i>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    toggleModelPopover(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const popover = document.getElementById('chat-model-popover');
        if (!popover) return;
        const isHidden = popover.classList.contains('hidden');
        if (isHidden) {
            popover.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();
        } else {
            popover.classList.add('hidden');
        }
    }

    closeModelPopover() {
        const popover = document.getElementById('chat-model-popover');
        if (popover) popover.classList.add('hidden');
    }

    async quickSelectModel(modelId) {
        this.activeModelId = modelId;
        const found = (this.modelsList || []).find(m => m.id === modelId);
        if (found) this.activeModelName = found.name;

        this.updateModelPillUI();
        this.closeModelPopover();

        const token = localStorage.getItem('agy_pin') || '';
        try {
            await fetch('/api/settings/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({
                    model: modelId,
                    effort: this.activeEffort
                })
            });
            if (window.agySettings && typeof window.agySettings.loadInfo === 'function') {
                window.agySettings.loadInfo();
            }
        } catch (e) {
            console.error('[Chat] Errore salvataggio modello:', e);
        }
    }

    async quickSetEffort(effort) {
        this.activeEffort = effort;
        this.updateModelPillUI();

        const token = localStorage.getItem('agy_pin') || '';
        try {
            await fetch('/api/settings/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({
                    model: this.activeModelId,
                    effort: effort
                })
            });
            if (window.agySettings && typeof window.agySettings.loadInfo === 'function') {
                window.agySettings.loadInfo();
            }
        } catch (e) {
            console.error('[Chat] Errore salvataggio effort:', e);
        }
    }

    updateToolbarBadges() {
        const countEl = document.getElementById('chat-msg-count-badge');
        const tokenBadgeEl = document.getElementById('chat-token-count-badge');

        if (countEl) {
            const count = (this.currentSession && this.currentSession.messages) ? this.currentSession.messages.length : 0;
            countEl.textContent = count;
        }
    }

    toggleAutonomousMode() {
        const toggleBtn = document.getElementById('btn-autonomous-toggle');
        const isAuto = toggleBtn && toggleBtn.classList.toggle('active-auto');
        if (toggleBtn) {
            toggleBtn.title = isAuto ? 'Modalità Autonoma (Auto-approvazione attiva)' : 'Modalità Sicura (Richiede conferma)';
            toggleBtn.innerHTML = isAuto ? '<span>🤖</span>' : '<span>✋</span>';
        }
    }

    async fetchSessions(autoLoadActive = true) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/sessions', {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (res.ok) {
                const data = await res.json();
                this.sessions = data.sessions || [];
                this.renderSessionsList();
                if (window.agySidebar) {
                    window.agySidebar.renderActiveDrawerTab();
                }

                if (this.currentSession) {
                    // Aggiorna lo stato/titolo della sessione corrente se presente nell'elenco
                    const matched = this.sessions.find(s => s.id === this.currentSession.id);
                    if (matched) {
                        this.currentSession.title = matched.title;
                        this.currentSession.updatedAt = matched.updatedAt;
                        this.updateActiveSessionHeader();
                    }
                } else if (autoLoadActive) {
                    const active = this.sessions.find(s => s.isActive);
                    if (active) {
                        this.loadSession(active.id);
                    } else if (this.sessions.length > 0) {
                        this.loadSession(this.sessions[0].id);
                    }
                }
            }
        } catch (e) {
            console.error('[Chat] Errore caricamento sessioni:', e);
        }
    }

    async loadSession(sessionId) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            // Rende la sessione ATTIVA anche lato server (prima veniva solo letta: i nuovi
            // messaggi finivano nell'ultima sessione usata e il terminale non seguiva)
            const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/switch`, {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (res.ok) {
                const data = await res.json();
                this.currentSession = data.session;
                this.updateActiveSessionHeader();
                this.renderMessages();
                this.renderSessionsList();
                if (window.agySidebar) {
                    window.agySidebar.renderActiveDrawerTab();
                }
                this.scrollToBottom();
                if (window.innerWidth <= 768) {
                    this.closeSidebar();
                }
            }
        } catch (e) {
            console.error('[Chat] Errore caricamento sessione:', e);
        }
    }

    /**
     * "Nuova Chat": reset solo locale, nessuna sessione salvata finché non parte
     * il primo messaggio (vedi persistDraftSession, chiamato da sendPrompt).
     * Prima creava subito una riga vuota in cronologia ad ogni apertura.
     */
    createNewSession() {
        this.currentSession = null;
        this.renderMessages();
        this.updateActiveSessionHeader();
        this.renderSessionsList();
        if (this.chatInputEl) {
            this.chatInputEl.value = '';
            this.chatInputEl.style.height = 'auto';
            this.chatInputEl.focus();
        }
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }

    /**
     * Crea davvero la sessione sul server. Chiamato solo al primo messaggio inviato
     * mentre non c'è una sessione corrente (draft), mai alla semplice apertura di "Nuova Chat".
     */
    async persistDraftSession() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const currentWs = window.agySidebar?.currentWorkspace?.path || '';
            const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    title: 'Nuova Sessione AGY',
                    workspace: currentWs
                })
            });
            if (res.ok) {
                const data = await res.json();
                this.currentSession = data.session;
                await this.fetchSessions();
                this.updateActiveSessionHeader();
                return true;
            }
        } catch (e) {
            alert('Errore creazione sessione: ' + e.message);
        }
        return false;
    }

    async renameSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        const currentTitle = session ? session.title : '';
        const newTitle = prompt('Inserisci il nuovo titolo della sessione:', currentTitle);
        if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
            const token = localStorage.getItem('agy_pin') || '';
            try {
                const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/title`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ title: newTitle.trim() })
                });
                if (res.ok) {
                    if (this.currentSession && this.currentSession.id === sessionId) {
                        this.currentSession.title = newTitle.trim();
                        this.updateActiveSessionHeader();
                    }
                    await this.fetchSessions();
                }
            } catch (err) {
                alert('Errore rinomina: ' + err.message);
            }
        }
    }

    async deleteSession(sessionId) {
        const confirmMsg = window.agyI18n ? window.agyI18n.t('deleteSessionConfirm') : 'Vuoi davvero eliminare questa sessione?';
        if (!confirm(confirmMsg)) return;
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (res.ok) {
                if (this.currentSession && this.currentSession.id === sessionId) {
                    this.currentSession = null;
                }
                await this.fetchSessions();
                if (!this.currentSession && this.sessions.length > 0) {
                    this.loadSession(this.sessions[0].id);
                } else if (this.sessions.length === 0) {
                    this.createNewSession();
                }
            }
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    }

    updateActiveSessionHeader() {
        if (!this.activeSessionTitleEl) return;
        const fallback = window.agyI18n ? window.agyI18n.t('activeSessionTitle') : 'Nuova Sessione';
        this.activeSessionTitleEl.textContent = this.currentSession ? (this.currentSession.title || fallback) : fallback;
    }

    // ── Menu modello nella schermata "nuova chat" (dropdown, non naviga alle Impostazioni) ──

    async toggleModelMenu(event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById('welcome-model-menu');
        if (!menu) return;
        if (!menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            return;
        }
        menu.innerHTML = '<div class="welcome-model-menu-loading">Caricamento modelli…</div>';
        menu.classList.remove('hidden');
        try {
            const token = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/settings/info', { headers: { 'Authorization': token } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const models = data.models || [];
            menu.innerHTML = models.map(m => `
                <button type="button" class="welcome-model-menu-item ${m.name === this.activeModelName ? 'is-active' : ''}" onclick="window.agyChat.selectWelcomeModel('${this.escapeHtml(m.id)}', '${this.escapeHtml(m.name)}')">
                    <span>${this.escapeHtml(m.name)}</span>
                    ${m.name === this.activeModelName ? '<i data-lucide="check"></i>' : ''}
                </button>
            `).join('') || '<div class="welcome-model-menu-loading">Nessun modello disponibile</div>';
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            menu.innerHTML = '<div class="welcome-model-menu-loading">Errore caricamento modelli</div>';
        }
        // Chiude il menu se si clicca fuori (un solo listener attivo alla volta)
        setTimeout(() => {
            document.addEventListener('click', function onDocClick(ev) {
                if (!menu.contains(ev.target)) {
                    menu.classList.add('hidden');
                    document.removeEventListener('click', onDocClick);
                }
            });
        }, 0);
    }

    async selectWelcomeModel(modelId, modelName) {
        const menu = document.getElementById('welcome-model-menu');
        if (menu) menu.classList.add('hidden');
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ model: modelId })
            });
            if (res.ok) {
                this.activeModelName = modelName;
                this.updateModelPillUI();
                const heroName = document.getElementById('hero-selected-model-name');
                if (heroName) heroName.textContent = modelName;
            }
        } catch (e) {
            console.error('[Chat] Errore cambio modello:', e);
        }
    }

    renderSessionsList() {
        if (!this.sessionsListEl) return;

        const query = this.sessionSearchEl ? this.sessionSearchEl.value.trim().toLowerCase() : '';
        const filtered = this.sessions.filter(s => {
            if (!query) return true;
            return (s.title && s.title.toLowerCase().includes(query)) ||
                   (s.lastMessagePreview && s.lastMessagePreview.toLowerCase().includes(query));
        });

        if (filtered.length === 0) {
            const noSessionsText = window.agyI18n ? window.agyI18n.t('noSessionsFound') : 'Nessuna sessione trovata';
            this.sessionsListEl.innerHTML = `
                <div class="empty-sessions">
                    <i data-lucide="message-square-dashed"></i>
                    <p>${noSessionsText}</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        for (const s of filtered) {
            const isActive = this.currentSession && this.currentSession.id === s.id;
            const dateStr = this.formatRelativeDate(s.updatedAt || s.createdAt);
            const safeId = this.escapeHtml(s.id);
            const safeTitle = this.escapeHtml(s.title || 'Sessione senza titolo');
            const safePreview = this.escapeHtml(s.lastMessagePreview || 'Nuova conversazione');

            html += `
                <div class="session-card ${isActive ? 'active' : ''}" data-session-id="${safeId}">
                    <div class="session-card-main">
                        <div class="session-title-row">
                            <span class="session-title" title="${safeTitle}">${safeTitle}</span>
                            <span class="session-date">${dateStr}</span>
                        </div>
                        <div class="session-preview-row">
                            <span class="session-preview">${safePreview}</span>
                            ${s.messageCount > 0 ? `<span class="session-msg-badge">${s.messageCount} msg</span>` : ''}
                        </div>
                    </div>
                    <div class="session-actions">
                        <button class="session-action-btn btn-rename" title="Rinomina">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="session-action-btn btn-del" title="Elimina">
                            <i data-lucide="trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        this.sessionsListEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    renderMessages() {
        if (!this.chatMessagesEl) return;

        this.updateToolbarBadges();

        if (!this.currentSession || !this.currentSession.messages || this.currentSession.messages.length === 0) {
            this.chatMessagesEl.innerHTML = `
                <div class="chat-welcome">
                    <div class="choose-assistant-hero">
                        <h2 class="choose-assistant-title font-display">Choose Your AI Assistant</h2>
                        <p class="choose-assistant-sub">Select a provider to start a new conversation</p>

                        <div class="assistant-selector-wrap">
                            <div class="assistant-selector-pill" onclick="window.agyChat.toggleModelMenu(event)" title="Clicca per cambiare modello">
                                <div class="assistant-pill-left">
                                    <span class="assistant-logo-icon">🪐</span>
                                    <div class="assistant-name-group">
                                        <span class="assistant-name" id="hero-selected-model-name">${this.escapeHtml(this.activeModelName)}</span>
                                        <span class="assistant-sublabel font-mono text-[11px] text-muted">Click to change model</span>
                                    </div>
                                </div>
                                <i data-lucide="chevron-down" class="assistant-chevron"></i>
                            </div>
                            <div id="welcome-model-menu" class="welcome-model-menu hidden"></div>
                        </div>

                        <p class="assistant-ready-note font-mono text-xs text-muted">
                            Ready to use <span class="text-white font-bold">${this.escapeHtml(this.activeModelName.split(' ')[0])}</span> with default. Start typing your message below.
                        </p>

                        <div class="shortcut-pill font-mono text-xs text-muted">
                            Press <kbd class="kbd-badge">Ctrl+K</kbd> to search sessions, files, and commits
                        </div>
                    </div>

                    <div class="welcome-suggestions">
                        <button class="suggestion-chip" onclick="window.agyChat.sendPrompt('Ottimizza le performance del backend e implementa un layer di cache Redis distribuita con TTL di 5 minuti.')">
                            <span style="font-size: 1.1rem;">⚡</span>
                            <div>
                                <strong style="display:block; font-size:0.82rem; color:#fff;">Refactoring Redis</strong>
                                <span style="font-size:0.72rem; color:var(--text-muted);">Cache distribuita & resolver async</span>
                            </div>
                        </button>
                        <button class="suggestion-chip" onclick="window.agyChat.sendPrompt('Esegui una verifica di sicurezza completa contro Path Traversal, Injection e blocco CSWSH sui WebSockets.')">
                            <span style="font-size: 1.1rem;">🛡️</span>
                            <div>
                                <strong style="display:block; font-size:0.82rem; color:#fff;">Security Audit</strong>
                                <span style="font-size:0.72rem; color:var(--text-muted);">Hardening symlink & rate limiting</span>
                            </div>
                        </button>
                        <button class="suggestion-chip" onclick="window.agyChat.sendPrompt('Spawna 3 subagenti paralleli: (1) Ricerca API, (2) Schema database Postgres, (3) Frontend UI.')">
                            <span style="font-size: 1.1rem;">🤖</span>
                            <div>
                                <strong style="display:block; font-size:0.82rem; color:#fff;">Multi-Agent Swarm</strong>
                                <span style="font-size:0.72rem; color:var(--text-muted);">Esecuzione task paralleli</span>
                            </div>
                        </button>
                        <button class="suggestion-chip" onclick="window.agyChat.sendPrompt('Crea uno stack Docker Compose con PostgreSQL, Redis, Node.js runner e reverse proxy Caddy.')">
                            <span style="font-size: 1.1rem;">🐳</span>
                            <div>
                                <strong style="display:block; font-size:0.82rem; color:#fff;">Docker Cloud Stack</strong>
                                <span style="font-size:0.72rem; color:var(--text-muted);">Sandbox effimera isolata</span>
                            </div>
                        </button>
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        for (const msg of this.currentSession.messages) {
            html += this.buildMessageHtml(msg);
        }

        this.chatMessagesEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
        this.attachCodeCopyListeners();
    }

    appendOrUpdateMessage(msg) {
        if (!this.chatMessagesEl) return;

        const welcome = this.chatMessagesEl.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const existingEl = document.getElementById(`msg-el-${msg.id}`);
        if (existingEl) {
            existingEl.outerHTML = this.buildMessageHtml(msg);
        } else {
            const temp = document.createElement('div');
            temp.innerHTML = this.buildMessageHtml(msg);
            while (temp.firstChild) {
                this.chatMessagesEl.appendChild(temp.firstChild);
            }
        }

        if (window.lucide) window.lucide.createIcons();
        this.attachCodeCopyListeners();
    }

    updateStreamingMessage(msg) {
        if (!this.chatMessagesEl) return;

        const welcome = this.chatMessagesEl.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        let msgEl = document.getElementById(`msg-el-${msg.id}`);
        if (!msgEl) {
            const temp = document.createElement('div');
            temp.innerHTML = this.buildMessageHtml(msg, true);
            msgEl = temp.firstElementChild;
            this.chatMessagesEl.appendChild(msgEl);
            if (window.lucide) window.lucide.createIcons();
        } else {
            const parsed = this.parseMessageContent(msg.content);
            const bubbleEl = msgEl.querySelector('.message-bubble');
            if (bubbleEl) {
                bubbleEl.innerHTML = this.buildBubbleInnerHtml(parsed, msg, true);
            }
        }

        this.attachCodeCopyListeners();
    }

    /**
     * Smart Content Parser: Extracts Chain of Thought (Thinking) and Tool Execution from LLM stream
     */
    parseMessageContent(rawContent) {
        let thinking = '';
        let tools = [];
        let mainContent = rawContent || '';

        // 1. Tag explicit <thought> or <thinking>
        const thoughtMatch = mainContent.match(/<(?:thought|thinking)>([\s\S]*?)<\/(?:thought|thinking)>/i);
        if (thoughtMatch) {
            thinking = thoughtMatch[1].trim();
            mainContent = mainContent.replace(thoughtMatch[0], '').trim();
        } else {
            // Unclosed thought during active streaming
            const unclosedMatch = mainContent.match(/<(?:thought|thinking)>([\s\S]*)$/i);
            if (unclosedMatch) {
                thinking = unclosedMatch[1].trim();
                mainContent = mainContent.replace(unclosedMatch[0], '').trim();
            }
        }

        // 2. Structured "Thinking Process:" or "Reasoning Process:" block
        if (!thinking) {
            const thinkingPrefixMatch = mainContent.match(/^(?:Thinking Process|Reasoning Process|🧠 Thinking|Chain of Thought):\s*([\s\S]*?)(?=\n\n(?:[A-Z#*\-`]|Ho analizzato|Esecuzione|Executing|Running|$))/i);
            if (thinkingPrefixMatch) {
                thinking = thinkingPrefixMatch[1].trim();
                mainContent = mainContent.replace(thinkingPrefixMatch[0], '').trim();
            }
        }

        return { thinking, tools, mainContent };
    }

    /**
     * Mostra/nasconde il pulsante "Annulla" e blocca l'invio mentre AGY risponde
     */
    setStreamingUi(active) {
        const sendBtn = document.getElementById('chat-send-btn');
        const cancelBtn = document.getElementById('chat-cancel-btn');
        if (sendBtn) sendBtn.classList.toggle('hidden', !!active);
        if (cancelBtn) cancelBtn.classList.toggle('hidden', !active);
    }

    cancelPrompt() {
        if (this.socket && this.socket.connected) this.socket.emit('chat-cancel');
    }

    showTransientNotice(text) {
        if (!this.chatMessagesEl) return;
        const el = document.createElement('div');
        el.className = 'chat-notice';
        el.textContent = text;
        this.chatMessagesEl.appendChild(el);
        this.scrollToBottom();
        setTimeout(() => el.remove(), 6000);
    }

    /**
     * Riassunto leggibile dei parametri di una tool call (primo valore significativo)
     */
    describeToolParams(params) {
        if (!params || typeof params !== 'object') return '';
        const preferred = ['DirectoryPath', 'AbsolutePath', 'File', 'FilePath', 'TargetFile', 'Path', 'CommandLine', 'Command', 'Query', 'Url', 'SearchPath', 'Pattern'];
        for (const k of preferred) {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') return String(params[k]);
        }
        const firstKey = Object.keys(params)[0];
        if (!firstKey) return '';
        const v = params[firstKey];
        return typeof v === 'string' ? v : JSON.stringify(v);
    }

    buildToolCallsHtml(toolCalls) {
        if (!toolCalls || !toolCalls.length) return '';
        const items = toolCalls.map(t => {
            const state = (t.state || 'ACTIVE').toUpperCase();
            const icon = state === 'DONE' ? 'check' : (state === 'ERROR' ? 'x' : 'loader-circle');
            const cls = state === 'DONE' ? 'is-done' : (state === 'ERROR' ? 'is-error' : 'is-active');
            const detail = this.escapeHtml(this.describeToolParams(t.params)).slice(0, 160);
            const err = t.error ? `<div class="tool-call-error">${this.escapeHtml(String(t.error)).slice(0, 300)}</div>` : '';
            const dur = t.durationSeconds ? `<span class="tool-call-duration">${Number(t.durationSeconds).toFixed(1)}s</span>` : '';
            return `
                <div class="tool-call ${cls}">
                    <i data-lucide="${icon}" class="${state === 'ACTIVE' ? 'spin' : ''}"></i>
                    <span class="tool-call-name">${this.escapeHtml(t.name || 'tool')}</span>
                    <span class="tool-call-detail" title="${detail}">${detail}</span>
                    ${dur}
                    ${err}
                </div>`;
        }).join('');
        return `<div class="tool-calls">${items}</div>`;
    }

    buildMessageHtml(msg, isStreaming = false) {
        const isUser = msg.role === 'user';
        const parsed = isUser ? { thinking: '', tools: [], mainContent: msg.content } : this.parseMessageContent(msg.content);

        return `
            <div class="chat-message-row ${isUser ? 'is-user' : 'is-assistant'}" id="msg-el-${this.escapeHtml(msg.id)}">
                <div class="message-avatar ${isUser ? 'user-avatar-badge' : 'assistant-avatar-badge'}" title="${isUser ? 'Tu' : 'Antigravity'}">
                    ${isUser ? '<span>U</span>' : '<span>🪐</span>'}
                </div>
                <div class="message-bubble">
                    ${this.buildBubbleInnerHtml(parsed, msg, isStreaming)}
                </div>
            </div>
        `;
    }

    buildBubbleInnerHtml(parsed, msg, isStreaming = false) {
        const isUser = msg.role === 'user';
        const formattedTime = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (isUser) {
            return `
                <div class="message-meta">
                    <span class="message-author">Tu</span>
                    <span class="message-time">${formattedTime}</span>
                    <button class="msg-copy-btn" title="Copia messaggio">
                        <i data-lucide="copy"></i>
                    </button>
                </div>
                <div class="message-body user-text">
                    ${this.escapeHtml(msg.content)}
                </div>
            `;
        }

        // Assistant Message rendering
        let thinkingHtml = '';
        if (!parsed.thinking && msg.thinking) parsed.thinking = msg.thinking;
        if (parsed.thinking) {
            thinkingHtml = `
                <details class="thinking-details" ${isStreaming ? 'open' : ''}>
                    <summary class="thinking-summary">
                        <div class="thinking-summary-left">
                            <span class="thinking-brain-icon">🧠</span>
                            <span class="thinking-label">Chain of Thought (Thinking)</span>
                            ${isStreaming ? '<span class="thinking-pulse-dot"></span>' : ''}
                        </div>
                        <span class="thinking-badge">Reasoning: HIGH</span>
                    </summary>
                    <div class="thinking-body">
                        ${this.escapeHtml(parsed.thinking)}
                    </div>
                </details>
            `;
        }

        const hasTools = msg.toolCalls && msg.toolCalls.length > 0;
        const placeholder = isStreaming ? (hasTools ? '' : '...') : '';
        const renderedMarkdown = this.renderMarkdown(parsed.mainContent || placeholder);
        const toolsHtml = this.buildToolCallsHtml(msg.toolCalls);
        const isError = msg.status === 'error';
        const errorHtml = isError && msg.error ? `<div class="msg-error-box">${this.escapeHtml(String(msg.error)).slice(0, 800)}</div>` : '';
        const statusHtml = isStreaming
            ? '<span class="msg-status-live">● In elaborazione...</span>'
            : (isError ? '<span class="msg-status-error">✕ Errore</span>' : '<span class="msg-status-done">✓ Completato</span>');

        return `
            <div class="message-meta">
                <div class="message-meta-left">
                    <span class="message-author">Antigravity</span>
                    <span class="model-tag-pill">${this.escapeHtml(this.activeModelName)}</span>
                    ${statusHtml}
                </div>
                <div class="message-meta-right">
                    <span class="message-time">${formattedTime}</span>
                    <button class="msg-copy-btn" title="Copia risposta">
                        <i data-lucide="copy"></i>
                    </button>
                </div>
            </div>
            <div class="message-body markdown-body">
                ${thinkingHtml}
                ${toolsHtml}
                <div class="markdown-content">
                    ${renderedMarkdown}
                </div>
                ${errorHtml}
                ${isStreaming ? '<span class="typing-cursor"></span>' : ''}
                <div class="message-footer-bar">
                    <div class="msg-footer-left">
                        <span class="msg-runner-dot">●</span>
                        <span>AGY Agentic Runner</span>
                    </div>
                    <span class="msg-footer-tokens">${msg.tokens_used ? msg.tokens_used + ' tokens' : 'Cloud Session'}</span>
                </div>
            </div>
        `;
    }

    renderMarkdown(rawText) {
        if (!rawText) return '';
        if (typeof marked !== 'undefined') {
            try {
                let html = marked.parse(rawText);
                if (typeof DOMPurify !== 'undefined') {
                    html = DOMPurify.sanitize(html);
                }
                return html;
            } catch (e) {
                return this.escapeHtml(rawText);
            }
        }
        return this.escapeHtml(rawText);
    }

    attachCodeCopyListeners() {
        if (!this.chatMessagesEl) return;
        const codeBlocks = this.chatMessagesEl.querySelectorAll('pre:not(.has-copy-btn)');
        codeBlocks.forEach(pre => {
            pre.classList.add('has-copy-btn');
            
            // Language tag detection
            const code = pre.querySelector('code');
            let lang = 'code';
            if (code && code.className) {
                const langMatch = code.className.match(/language-(\w+)/);
                if (langMatch) lang = langMatch[1];
            }

            // Create toolbar inside pre
            const headerDiv = document.createElement('div');
            headerDiv.className = 'code-block-header';
            headerDiv.innerHTML = `
                <span class="code-lang-label">${lang}</span>
                <button class="code-copy-btn" title="Copia codice">
                    <i data-lucide="copy"></i> Copia
                </button>
            `;

            const copyBtn = headerDiv.querySelector('.code-copy-btn');
            copyBtn.onclick = () => {
                const text = code ? code.innerText : pre.innerText;
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = `<i data-lucide="check"></i> Copiato!`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<i data-lucide="copy"></i> Copia`;
                        if (window.lucide) window.lucide.createIcons();
                    }, 2000);
                });
            };

            pre.insertBefore(headerDiv, pre.firstChild);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    setupGlobalClickHandlers() {
        document.addEventListener('click', (e) => {
            if (this.slashPopupEl && !this.slashPopupEl.contains(e.target) && e.target !== this.chatInputEl && !e.target.closest('#chat-slash-menu-btn')) {
                this.closeSlashMenu();
            }
        });
    }

    handleInputChange() {
        if (!this.chatInputEl) return;
        const val = this.chatInputEl.value;
        if (val.startsWith('/')) {
            const query = val.slice(1).toLowerCase().trim();
            this.openSlashMenu(query);
        } else {
            this.closeSlashMenu();
        }
    }

    toggleSlashMenu() {
        if (this.slashPopupEl && !this.slashPopupEl.classList.contains('hidden')) {
            this.closeSlashMenu();
        } else {
            this.openSlashMenu('');
            if (this.chatInputEl) this.chatInputEl.focus();
        }
    }

    openSlashMenu(filterQuery = '') {
        if (!this.slashPopupEl) {
            this.slashPopupEl = document.getElementById('slash-commands-popup');
        }
        if (!this.slashPopupEl) return;

        this.filteredSlashCommands = this.slashCommands.filter(c => 
            !filterQuery || 
            c.cmd.toLowerCase().includes(filterQuery) || 
            c.name.toLowerCase().includes(filterQuery) ||
            c.desc.toLowerCase().includes(filterQuery)
        );

        if (this.filteredSlashCommands.length === 0) {
            this.closeSlashMenu();
            return;
        }

        this.slashSelectedIndex = 0;
        this.renderSlashMenu();
        this.slashPopupEl.classList.remove('hidden');
    }

    closeSlashMenu() {
        if (this.slashPopupEl) {
            this.slashPopupEl.classList.add('hidden');
        }
    }

    renderSlashMenu() {
        if (!this.slashPopupEl) return;
        let html = '';
        this.filteredSlashCommands.forEach((cmd, idx) => {
            const isSelected = idx === this.slashSelectedIndex;
            html += `
                <div class="slash-command-item ${isSelected ? 'selected' : ''}" onclick="window.agyChat.selectSlashCommand('${cmd.cmd}')">
                    <span class="slash-cmd-icon">${cmd.icon}</span>
                    <div class="slash-cmd-details">
                        <span class="slash-cmd-name">${this.escapeHtml(cmd.name)}</span>
                        <span class="slash-cmd-desc">${this.escapeHtml(cmd.desc)}</span>
                    </div>
                </div>
            `;
        });
        this.slashPopupEl.innerHTML = html;
    }

    selectSlashCommand(cmd) {
        if (this.chatInputEl) {
            this.chatInputEl.value = cmd;
            this.chatInputEl.focus();
            this.chatInputEl.style.height = 'auto';
            this.chatInputEl.style.height = Math.min(this.chatInputEl.scrollHeight, 150) + 'px';
        }
        this.closeSlashMenu();
    }

    handleChatKeydown(event) {
        const isPopupOpen = this.slashPopupEl && !this.slashPopupEl.classList.contains('hidden');

        if (isPopupOpen) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.slashSelectedIndex = (this.slashSelectedIndex + 1) % this.filteredSlashCommands.length;
                this.renderSlashMenu();
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.slashSelectedIndex = (this.slashSelectedIndex - 1 + this.filteredSlashCommands.length) % this.filteredSlashCommands.length;
                this.renderSlashMenu();
                return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                const selected = this.filteredSlashCommands[this.slashSelectedIndex];
                if (selected) {
                    this.selectSlashCommand(selected.cmd);
                }
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeSlashMenu();
                return;
            }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.submitPrompt();
        }
    }

    submitPrompt() {
        if (!this.chatInputEl) return;
        const text = this.chatInputEl.value.trim();
        if (text || this.pendingAttachments.length) {
            this.sendPrompt(this.buildPromptWithAttachments(text));
            this.chatInputEl.value = '';
            this.chatInputEl.style.height = 'auto';
            this.clearAttachments();
            this.closeSlashMenu();
        }
    }

    // ── Allegati (file / screenshot) ──────────────────────────────────

    setupAttachments() {
        if (!this.screenshotBtnEl) {
            this.screenshotBtnEl = document.getElementById('chat-screenshot-btn');
        }
        if (!this.attachBtnEl) {
            this.attachBtnEl = document.getElementById('chat-attach-btn');
        }
        if (!this.piiBtnEl) {
            this.piiBtnEl = document.getElementById('chat-pii-btn');
        }
        if (!this.attachInputEl) {
            this.attachInputEl = document.getElementById('chat-attach-input');
        }
        if (!this.piiInputEl) {
            this.piiInputEl = document.getElementById('chat-pii-input');
        }
        if (!this.attachmentsBarEl) {
            this.attachmentsBarEl = document.getElementById('chat-attachments-bar');
        }

        if (this.attachInputEl) {
            this.attachInputEl.addEventListener('change', (e) => {
                Array.from(e.target.files || []).forEach(f => this.uploadAndAttach(f));
                this.attachInputEl.value = '';
            });
        }

        if (this.piiInputEl) {
            this.piiInputEl.addEventListener('change', (e) => {
                Array.from(e.target.files || []).forEach(f => this.uploadPiiAndAttach(f));
                this.piiInputEl.value = '';
            });
        }

        if (this.screenshotBtnEl) {
            this.screenshotBtnEl.addEventListener('click', (e) => {
                e.preventDefault();
                this.captureScreenshot();
            });
        }

        // Incolla screenshot da clipboard (Ctrl+V / Cmd+V)
        const handlePaste = (e) => {
            const items = (e.clipboardData || window.clipboardData)?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type && item.type.startsWith('image/')) {
                    const blob = item.getAsFile();
                    if (blob) {
                        e.preventDefault();
                        const ext = item.type.split('/')[1] || 'png';
                        const file = new File([blob], `screenshot-${Date.now()}.${ext}`, { type: item.type });
                        this.uploadAndAttach(file);
                        return;
                    }
                }
            }
        };

        if (this.chatInputEl) {
            this.chatInputEl.addEventListener('paste', handlePaste);
        }

        // Drag & Drop su composer
        const dropZone = document.querySelector('.input-panel-modern') || this.chatInputEl;
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });
            ['dragleave', 'drop'].forEach(name => {
                dropZone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });
            dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    Array.from(files).forEach(f => this.uploadAndAttach(f));
                }
            });
        }
    }

    async uploadAndAttach(file) {
        if (!file) return;
        const chipId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.renderAttachmentChip(chipId, file.name, true);

        try {
            const pin = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': pin,
                    'Content-Type': file.type || 'application/octet-stream',
                    'X-File-Name': encodeURIComponent(file.name)
                },
                body: file
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload fallito');

            this.pendingAttachments.push({ path: data.path, name: file.name });
            this.renderAttachmentChip(chipId, file.name, false, data.path);
        } catch (err) {
            console.error('[Chat] Errore upload allegato:', err);
            this.removeAttachmentChip(chipId);
            alert('Errore caricamento allegato: ' + err.message);
        }
    }

    async uploadPiiAndAttach(file) {
        if (!file) return;
        const chipId = `pii-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.renderAttachmentChip(chipId, file.name, true, null, true);

        try {
            const pin = localStorage.getItem('agy_pin') || '';
            const buffer = await file.arrayBuffer();
            const headers = {
                'Authorization': pin,
                'Content-Type': 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name)
            };

            const res = await fetch('/api/pii/redact', {
                method: 'POST',
                headers,
                body: buffer
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Anonimizzazione fallita');

            this.pendingAttachments.push({ path: data.path, name: data.name, isPii: true });
            this.renderAttachmentChip(chipId, data.name, false, data.path, true);
        } catch (err) {
            console.error('[Chat] Errore PII:', err);
            this.removeAttachmentChip(chipId);
            alert('Errore anonimizzazione PII: ' + err.message);
        }
    }

    async captureScreenshot() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert('La cattura schermo diretta dal browser richiede HTTPS o localhost.\n\nSuggerimento: puoi fare uno screenshot con il sistema operativo (Stamp / Win+Shift+S / Cmd+Shift+4) e incollarlo direttamente qui con Ctrl+V!');
            return;
        }
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            // Attende che arrivi un frame valido prima di catturare
            await new Promise(resolve => setTimeout(resolve, 250));

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1920;
            canvas.height = video.videoHeight || 1080;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Interrompe lo stream video subito dopo lo scatto
            stream.getTracks().forEach(t => t.stop());
            stream = null;

            canvas.toBlob((blob) => {
                if (!blob) return;
                const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
                this.uploadAndAttach(file);
            }, 'image/png');
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                console.error('[Chat] Errore screenshot:', err);
                alert('Impossibile catturare lo screenshot: ' + err.message);
            }
        } finally {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        }
    }

    renderAttachmentChip(id, name, isLoading, filePath, isPii = false) {
        if (!this.attachmentsBarEl) return;
        this.attachmentsBarEl.classList.remove('hidden');

        let chip = document.getElementById(id);
        if (!chip) {
            chip = document.createElement('div');
            chip.className = `attachment-chip ${isPii ? 'pii-chip' : ''}`;
            chip.id = id;
            this.attachmentsBarEl.appendChild(chip);
        } else if (isPii) {
            chip.classList.add('pii-chip');
        }

        const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
        const iconName = isLoading ? 'loader-circle' : (isPii ? 'shield-check' : (isImage ? 'image' : 'paperclip'));
        const displayTitle = isPii ? `${name} (Anonimizzato con Rizzo-PII)` : name;

        chip.innerHTML = `
            <i data-lucide="${iconName}" class="${isLoading ? 'spin' : ''}"></i>
            <span class="attachment-name" title="${this.escapeHtml(displayTitle)}">${this.escapeHtml(name)}</span>
            ${isLoading ? '' : '<button type="button" class="attachment-remove" title="Rimuovi">&times;</button>'}
        `;
        if (!isLoading) {
            chip.querySelector('.attachment-remove').onclick = () => this.removeAttachmentChip(id, filePath);
        }
        if (window.lucide) window.lucide.createIcons();
    }

    removeAttachmentChip(id, filePath) {
        const chip = document.getElementById(id);
        if (chip) chip.remove();
        if (filePath) {
            this.pendingAttachments = this.pendingAttachments.filter(a => a.path !== filePath);
        }
        if (this.attachmentsBarEl && !this.attachmentsBarEl.children.length) {
            this.attachmentsBarEl.classList.add('hidden');
        }
    }

    clearAttachments() {
        this.pendingAttachments = [];
        if (this.attachmentsBarEl) {
            this.attachmentsBarEl.innerHTML = '';
            this.attachmentsBarEl.classList.add('hidden');
        }
    }

    buildPromptWithAttachments(text) {
        if (!this.pendingAttachments.length) return text;
        const list = this.pendingAttachments.map(a => `- ${a.path}${a.isPii ? ' (anonimizzato con Rizzo-PII)' : ''}`).join('\n');
        const header = `📎 File allegati:\n${list}`;
        return text ? `${header}\n\n${text}` : header;
    }

    async sendPrompt(promptText) {
        if (!promptText || !promptText.trim()) return;

        // Prima chat scritta davvero: la sessione va creata ORA, non quando si è
        // aperta la schermata "Nuova Chat" (altrimenti restano righe vuote in cronologia).
        if (!this.currentSession) {
            const ok = await this.persistDraftSession();
            if (!ok) return;
        }

        // Remove welcome screen
        const welcome = this.chatMessagesEl ? this.chatMessagesEl.querySelector('.chat-welcome') : null;
        if (welcome) welcome.remove();

        if (this.socket && this.socket.connected) {
            this.socket.emit('chat-prompt', promptText, {
                model: this.activeModelId,
                effort: this.activeEffort
            });
        } else if (window.agyTerminal) {
            window.agyTerminal.send(promptText + '\r');
        }

        this.autoScroll = true;
        this.scrollToBottom();
    }

    insertPrompt(text) {
        if (this.chatInputEl) {
            this.chatInputEl.value = text;
            this.chatInputEl.focus();
            this.chatInputEl.style.height = 'auto';
            this.chatInputEl.style.height = Math.min(this.chatInputEl.scrollHeight, 150) + 'px';
        }
    }

    scrollToBottom() {
        if (this.chatMessagesEl) {
            this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
        }
    }

    setupSidebarResizer() {
        const resizer = document.getElementById('sidebar-resizer');
        const sidebar = document.getElementById('sessions-sidebar');
        if (!resizer || !sidebar) return;

        // Restore saved width from localStorage
        const savedWidth = localStorage.getItem('agy_sidebar_width');
        if (savedWidth && window.innerWidth > 768) {
            const widthNum = parseInt(savedWidth, 10);
            if (widthNum >= 200 && widthNum <= 600) {
                document.documentElement.style.setProperty('--sidebar-width', `${widthNum}px`);
            }
        }

        // Restore collapsed state if saved
        const isCollapsed = localStorage.getItem('agy_sidebar_collapsed') === 'true';
        if (isCollapsed && window.innerWidth > 768) {
            sidebar.classList.add('collapsed');
        }

        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        const onMouseDown = (e) => {
            if (window.innerWidth <= 768) return;
            isDragging = true;
            startX = e.clientX;
            startWidth = sidebar.getBoundingClientRect().width;
            sidebar.classList.add('resizing');
            resizer.classList.add('is-dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const delta = e.clientX - startX;
            let newWidth = startWidth + delta;
            if (newWidth < 200) {
                newWidth = 200;
            } else if (newWidth > 600) {
                newWidth = 600;
            }
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
            localStorage.setItem('agy_sidebar_width', String(Math.round(newWidth)));
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                localStorage.setItem('agy_sidebar_collapsed', 'false');
            }
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            sidebar.classList.remove('resizing');
            resizer.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        resizer.addEventListener('mousedown', onMouseDown);

        // Double-click resizer to reset to default 290px
        resizer.addEventListener('dblclick', () => {
            document.documentElement.style.setProperty('--sidebar-width', '290px');
            localStorage.setItem('agy_sidebar_width', '290');
        });
    }

    toggleSidebar() {
        const isMobile = window.innerWidth <= 768;
        if (!this.sidebarBackdropEl) {
            this.sidebarBackdropEl = document.getElementById('sidebar-backdrop');
        }
        if (!this.sidebarEl) {
            this.sidebarEl = document.getElementById('sessions-sidebar');
        }

        if (isMobile) {
            if (this.sidebarEl) {
                this.sidebarEl.classList.remove('collapsed');
                const isOpen = this.sidebarEl.classList.toggle('open');
                if (this.sidebarBackdropEl) {
                    if (isOpen) {
                        this.sidebarBackdropEl.classList.add('visible');
                    } else {
                        this.sidebarBackdropEl.classList.remove('visible');
                    }
                }
            }
        } else {
            if (this.sidebarEl) {
                this.sidebarEl.classList.remove('open');
                const isCollapsed = this.sidebarEl.classList.toggle('collapsed');
                localStorage.setItem('agy_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            }
            if (this.sidebarBackdropEl) {
                this.sidebarBackdropEl.classList.remove('visible');
            }
        }
    }

    closeSidebar() {
        if (!this.sidebarBackdropEl) {
            this.sidebarBackdropEl = document.getElementById('sidebar-backdrop');
        }
        if (!this.sidebarEl) {
            this.sidebarEl = document.getElementById('sessions-sidebar');
        }
        if (this.sidebarEl) {
            this.sidebarEl.classList.remove('open');
        }
        if (this.sidebarBackdropEl) {
            this.sidebarBackdropEl.classList.remove('visible');
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    formatRelativeDate(isoDate) {
        if (!isoDate) return '';
        const d = new Date(isoDate);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMin < 1) return 'Adesso';
        if (diffMin < 60) return `${diffMin}m fa`;
        if (diffHours < 24) return `${diffHours}h fa`;
        if (diffDays === 1) return 'Ieri';
        if (diffDays < 7) return `${diffDays}gg fa`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

window.agyChat = new AgyChat();
