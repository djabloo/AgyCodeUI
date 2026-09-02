class AgyApp {
    constructor() {
        this.socket = null;
        this.statusBadge = document.getElementById('status-badge');
        this.authModal = document.getElementById('auth-modal');
        this.authError = document.getElementById('auth-error');
        this.pinInput = document.getElementById('pin-input');
        this.promptInput = document.getElementById('prompt-input');
        this.activeTab = 'chat-tab';
    }

    async init() {
        if (window.agyI18n) {
            window.agyI18n.applyTranslations();
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }

        if (this.promptInput) {
            this.promptInput.addEventListener('input', () => {
                this.promptInput.style.height = 'auto';
                this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 120) + 'px';
            });
        }

        // Verifica autenticazione o chiedi PIN
        const savedPin = localStorage.getItem('agy_pin') || '';
        this.checkAuth(savedPin);
    }

    async checkAuth(pin) {
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });

            if (res.ok) {
                this.authModal.classList.add('hidden');
                localStorage.setItem('agy_pin', pin);
                this.connectSocket(pin);
                if (window.agyFiles) window.agyFiles.loadDir('');
            } else {
                this.authModal.classList.remove('hidden');
                this.pinInput.focus();
            }
        } catch (e) {
            console.error('[App] Errore verifica auth:', e);
            this.authModal.classList.remove('hidden');
        }
    }

    handleAuthSubmit() {
        const pin = this.pinInput.value.trim();
        this.authError.classList.add('hidden');
        fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        }).then(res => {
            if (res.ok) {
                this.authModal.classList.add('hidden');
                localStorage.setItem('agy_pin', pin);
                this.connectSocket(pin);
                if (window.agyFiles) window.agyFiles.loadDir('');
            } else {
                this.authError.classList.remove('hidden');
            }
        }).catch(() => {
            this.authError.classList.remove('hidden');
        });
    }

    connectSocket(pin) {
        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io({
            auth: { token: pin },
            reconnectionAttempts: 10,
            reconnectionDelay: 1500
        });

        this.socket.on('connect', () => {
            this.updateStatus(true, 'Connesso ad AGY');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus(false, 'Disconnesso');
        });

        this.socket.on('connect_error', (err) => {
            console.warn('[Socket] Errore connessione:', err.message);
            this.updateStatus(false, 'Errore Auth');
            if (err.message.includes('Autenticazione')) {
                localStorage.removeItem('agy_pin');
                this.authModal.classList.remove('hidden');
            }
        });

        // Inizializza il terminale, la chat, le impostazioni e la sidebar
        if (window.agyTerminal) window.agyTerminal.init(this.socket);
        if (window.agyChat) window.agyChat.init(this.socket);
        if (window.agySettings) window.agySettings.init();
        if (window.agySidebar) window.agySidebar.init();
    }

    updateStatus(connected, text) {
        if (!this.statusBadge) return;
        const defaultText = connected 
            ? (window.agyI18n ? window.agyI18n.t('connected') : 'Connesso ad AGY')
            : (window.agyI18n ? window.agyI18n.t('disconnected') : 'Disconnesso');
        const displayText = text || defaultText;
        this.statusBadge.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
        this.statusBadge.querySelector('.status-text').textContent = displayText;
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.mobile-nav-tab').forEach(el => el.classList.remove('active'));

        const targetPane = document.getElementById(tabId);
        const targetTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
        const targetMobileTab = document.querySelector(`.mobile-nav-tab[data-tab="${tabId}"]`);

        if (targetPane) targetPane.classList.add('active');
        if (targetTab) targetTab.classList.add('active');
        if (targetMobileTab) targetMobileTab.classList.add('active');

        if (window.lucide) window.lucide.createIcons();

        if (tabId === 'terminal-tab') {
            setTimeout(() => {
                if (window.agyTerminal) window.agyTerminal.fit();
            }, 50);
            setTimeout(() => {
                if (window.agyTerminal) window.agyTerminal.fit();
            }, 200);
        } else if (tabId === 'files-tab') {
            if (window.agyFiles) window.agyFiles.refresh();
        } else if (tabId === 'chat-tab') {
            if (window.agyChat) window.agyChat.scrollToBottom();
        } else if (tabId === 'settings-tab') {
            if (window.agySettings) window.agySettings.loadAll();
        }
    }

    handleInputKeydown(event) {
        // Se si preme Invio senza Shift nel prompt terminale, invia il prompt
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.submitPrompt();
        } else if (event.key === 'ArrowUp' && !this.promptInput.value) {
            event.preventDefault();
            if (window.agyTerminal) window.agyTerminal.send('\x1b[A');
        } else if (event.key === 'ArrowDown' && !this.promptInput.value) {
            event.preventDefault();
            if (window.agyTerminal) window.agyTerminal.send('\x1b[B');
        }
    }

    submitPrompt() {
        const text = this.promptInput.value.trim();
        if (text) {
            if (window.agyTerminal) window.agyTerminal.send(text + '\r');
            this.promptInput.value = '';
            this.promptInput.style.height = 'auto';
            if (this.activeTab !== 'terminal-tab') {
                this.switchTab('terminal-tab');
            }
        }
    }

    insertPrompt(text) {
        if (this.activeTab === 'chat-tab' && window.agyChat) {
            window.agyChat.insertPrompt(text);
        } else {
            this.promptInput.value = text;
            this.promptInput.style.height = 'auto';
            this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 120) + 'px';
            this.promptInput.focus();
        }
    }

    runQuickCommand(cmd) {
        if (window.agyChat) {
            window.agyChat.sendPrompt(cmd);
            this.switchTab('chat-tab');
        } else if (window.agyTerminal) {
            this.switchTab('terminal-tab');
            window.agyTerminal.send(cmd + '\r');
        }
    }

    async restartSession() {
        if (confirm('Vuoi davvero riavviare la sessione Antigravity CLI?')) {
            const token = localStorage.getItem('agy_pin') || '';
            try {
                await fetch('/api/restart', {
                    method: 'POST',
                    headers: { 'Authorization': token }
                });
            } catch (e) {
                alert('Errore riavvio: ' + e.message);
            }
        }
    }

    clearTerminal() {
        if (window.agyTerminal) window.agyTerminal.clear();
    }

    openSettings() {
        const currentPin = localStorage.getItem('agy_pin') || '';
        const newPin = prompt('Inserisci o modifica il PIN di accesso salvato su questo dispositivo:', currentPin);
        if (newPin !== null) {
            localStorage.setItem('agy_pin', newPin);
            window.location.reload();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.agyApp = new AgyApp();
    window.agyApp.init();
});
