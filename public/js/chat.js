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

        this.configureMarkdown();
        this.setupEventDelegation();
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
                this.appendOrUpdateMessage(message);
                if (this.autoScroll) this.scrollToBottom();
            }
        });

        this.socket.on('chat-stream', ({ sessionId, messageId, delta, fullContent }) => {
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
                this.updateStreamingMessage(msg);
                if (this.autoScroll) this.scrollToBottom();
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

        // Auto-expand textarea
        if (this.chatInputEl) {
            this.chatInputEl.addEventListener('input', () => {
                this.chatInputEl.style.height = 'auto';
                this.chatInputEl.style.height = Math.min(this.chatInputEl.scrollHeight, 150) + 'px';
            });
        }

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
                const currentArgs = data.cliArgs || '';
                const match = currentArgs.match(/--model\s+([^\s]+)/);
                if (match) {
                    const modelId = match[1];
                    const found = (data.models || []).find(m => m.id === modelId);
                    this.activeModelName = found ? found.name : modelId;
                } else {
                    this.activeModelName = 'Gemini 3.7 Flash Thinking';
                }
                this.updateModelPillUI();
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
    }

    async fetchSessions() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/sessions', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.sessions = data.sessions || [];
                this.renderSessionsList();
                const active = this.sessions.find(s => s.isActive);
                if (active) {
                    this.loadSession(active.id);
                }
            }
        } catch (e) {
            console.error('[Chat] Errore caricamento sessioni:', e);
        }
    }

    async loadSession(sessionId) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.currentSession = data.session;
                this.updateActiveSessionHeader();
                this.renderMessages();
                this.renderSessionsList();
                this.scrollToBottom();
                if (window.innerWidth <= 768) {
                    this.closeSidebar();
                }
            }
        } catch (e) {
            console.error('[Chat] Errore caricamento sessione:', e);
        }
    }

    async createNewSession() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token 
                },
                body: JSON.stringify({ title: 'Nuova Sessione AGY' })
            });
            if (res.ok) {
                const data = await res.json();
                this.currentSession = data.session;
                this.renderSessionsList();
                this.renderMessages();
                if (this.chatInputEl) {
                    this.chatInputEl.value = '';
                    this.chatInputEl.focus();
                }
                if (window.innerWidth <= 768) {
                    this.closeSidebar();
                }
            }
        } catch (e) {
            alert('Errore creazione sessione: ' + e.message);
        }
    }

    async renameSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        const currentTitle = session ? session.title : '';
        const newTitle = prompt('Inserisci il nuovo titolo della sessione:', currentTitle);
        if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
            const token = localStorage.getItem('agy_pin') || '';
            try {
                const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/title`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify({ title: newTitle.trim() })
                });
                if (res.ok) {
                    if (this.currentSession && this.currentSession.id === sessionId) {
                        this.currentSession.title = newTitle.trim();
                        this.updateActiveSessionHeader();
                    }
                    this.fetchSessions();
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
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                this.fetchSessions();
            }
        } catch (err) {
            alert('Errore eliminazione: ' + err.message);
        }
    }

    updateActiveSessionHeader() {
        if (this.activeSessionTitleEl && this.currentSession) {
            this.activeSessionTitleEl.textContent = this.currentSession.title || (window.agyI18n ? window.agyI18n.t('activeSessionTitle') : 'Nuova Sessione');
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

        if (!this.currentSession || !this.currentSession.messages || this.currentSession.messages.length === 0) {
            this.chatMessagesEl.innerHTML = `
                <div class="chat-welcome">
                    <div class="brand-logo-box" style="width: 54px; height: 54px; border-radius: 16px; margin-bottom: 4px; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">
                        <div class="brand-logo-box-inner" style="border-radius: 14.5px;">
                            <span style="font-size: 1.8rem;">🪐</span>
                        </div>
                    </div>
                    <h2 class="font-display font-bold text-white text-xl">AGY<span class="gradient-brand-text">UI</span> Studio & Agentic Chat</h2>
                    <p class="text-xs text-slate-400">Orchestra agenti autonomi, esegui refactorings complessi e controlla il tuo workspace direttamente dal browser.</p>
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

        const renderedMarkdown = this.renderMarkdown(parsed.mainContent || (isStreaming ? '...' : ''));

        return `
            <div class="message-meta">
                <div class="message-meta-left">
                    <span class="message-author">Antigravity</span>
                    <span class="model-tag-pill">${this.escapeHtml(this.activeModelName)}</span>
                    ${isStreaming ? '<span class="msg-status-live">● In elaborazione...</span>' : '<span class="msg-status-done">✓ Completato</span>'}
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
                <div class="markdown-content">
                    ${renderedMarkdown}
                </div>
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

    handleChatKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.submitPrompt();
        }
    }

    submitPrompt() {
        if (!this.chatInputEl) return;
        const text = this.chatInputEl.value.trim();
        if (text) {
            this.sendPrompt(text);
            this.chatInputEl.value = '';
            this.chatInputEl.style.height = 'auto';
        }
    }

    sendPrompt(promptText) {
        if (!promptText || !promptText.trim()) return;
        
        // Remove welcome screen
        const welcome = this.chatMessagesEl ? this.chatMessagesEl.querySelector('.chat-welcome') : null;
        if (welcome) welcome.remove();

        if (this.socket && this.socket.connected) {
            this.socket.emit('chat-prompt', promptText);
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
                this.sidebarEl.classList.toggle('collapsed');
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
