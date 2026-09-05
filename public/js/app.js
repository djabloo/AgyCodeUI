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

        // Gestione parametri OAuth redirect (es. ?token=... o ?auth_error=...)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token') || urlParams.get('jwt');
        const authErrorParam = urlParams.get('auth_error');

        if (urlToken) {
            localStorage.setItem('agy_pin', urlToken);
            document.cookie = `agy_jwt=${encodeURIComponent(urlToken)}; path=/; max-age=604800; SameSite=Lax`;
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (authErrorParam) {
            const errorEl = document.getElementById('auth-error');
            if (errorEl) {
                errorEl.textContent = decodeURIComponent(authErrorParam);
                errorEl.classList.remove('hidden');
            }
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Inizializza stato autenticazione SaaS & PIN
        this.isSaasMode = false;
        this.isRegisterMode = false;
        const savedToken = localStorage.getItem('agy_pin') || '';
        this.checkAuth(savedToken);
    }

    async checkAuth(token) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/status', { headers });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                this.authModal.classList.add('hidden');
                if (token) {
                    localStorage.setItem('agy_pin', token);
                    document.cookie = `agy_jwt=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
                }

                // Carica dettagli profilo utente autenticato se disponibile
                this.loadUserProfile(token);

                this.connectSocket(token);
                if (window.agyFiles) window.agyFiles.loadDir('');
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            this.authModal.classList.remove('hidden');
            const saasSection = document.getElementById('saas-auth-section');
            const pinSection = document.getElementById('pin-auth-section');

            if (data.saas) {
                this.isSaasMode = true;
                if (saasSection) saasSection.classList.remove('hidden');
                if (pinSection) pinSection.classList.add('hidden');
                const titleEl = document.getElementById('auth-modal-title');
                if (titleEl) titleEl.textContent = 'Accedi ad AGYUI Cloud';
                const emailInput = document.getElementById('saas-email-input');
                if (emailInput) emailInput.focus();
            } else {
                this.isSaasMode = false;
                if (saasSection) saasSection.classList.add('hidden');
                if (pinSection) pinSection.classList.remove('hidden');
                if (this.pinInput) this.pinInput.focus();
            }
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error('[App] Errore verifica auth:', e);
            this.authModal.classList.remove('hidden');
        }
    }

    async loadUserProfile(token) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch('/api/auth/me', { headers });
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    localStorage.setItem('agy_user', JSON.stringify({
                        ...data.user,
                        subscription: data.subscription
                    }));
                    if (window.agySettings && typeof window.agySettings.renderUserProfile === 'function') {
                        window.agySettings.renderUserProfile(data.user, data.subscription);
                    }
                }
            }
        } catch (e) {
            console.warn('[App] Profilo utente non disponibile o modalità standalone:', e.message);
        }
    }

    loginWithGoogle() {
        fetch('/api/auth/providers').then(r => r.json()).then(data => {
            if (data.google && !data.google.enabled) {
                alert('Google OAuth non è ancora configurato. L\'amministratore deve impostare GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nel file .env.');
                return;
            }
            window.location.href = '/api/auth/google';
        }).catch(() => {
            window.location.href = '/api/auth/google';
        });
    }

    loginWithGithub() {
        fetch('/api/auth/providers').then(r => r.json()).then(data => {
            if (data.github && !data.github.enabled) {
                alert('GitHub OAuth non è ancora configurato. L\'amministratore deve impostare GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET nel file .env.');
                return;
            }
            window.location.href = '/api/auth/github';
        }).catch(() => {
            window.location.href = '/api/auth/github';
        });
    }

    logout() {
        if (!confirm('Sei sicuro di voler effettuare il logout?')) return;
        localStorage.removeItem('agy_pin');
        localStorage.removeItem('agy_user');
        document.cookie = 'agy_jwt=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        if (this.socket) {
            this.socket.disconnect();
        }
        window.location.reload();
    }

    toggleSaasMode() {
        this.isRegisterMode = !this.isRegisterMode;
        const nameGroup = document.getElementById('saas-name-group');
        const titleEl = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('saas-submit-btn');
        const toggleLabel = document.getElementById('saas-toggle-label');
        const toggleLink = document.getElementById('saas-toggle-link');
        const googleLabel = document.getElementById('google-btn-label');
        const githubLabel = document.getElementById('github-btn-label');
        const errorEl = document.getElementById('auth-error');
        if (errorEl) errorEl.classList.add('hidden');

        if (this.isRegisterMode) {
            if (nameGroup) nameGroup.classList.remove('hidden');
            if (titleEl) titleEl.textContent = 'Crea Account AGYUI';
            if (submitBtn) submitBtn.textContent = 'Registrati e Avvia';
            if (toggleLabel) toggleLabel.textContent = 'Hai già un account?';
            if (toggleLink) toggleLink.textContent = 'Accedi';
            if (googleLabel) googleLabel.textContent = 'Registrati con Google';
            if (githubLabel) githubLabel.textContent = 'Registrati con GitHub';
        } else {
            if (nameGroup) nameGroup.classList.add('hidden');
            if (titleEl) titleEl.textContent = 'Accedi ad AGYUI Cloud';
            if (submitBtn) submitBtn.textContent = 'Accedi';
            if (toggleLabel) toggleLabel.textContent = 'Non hai ancora un account?';
            if (toggleLink) toggleLink.textContent = 'Registrati';
            if (googleLabel) googleLabel.textContent = 'Continua con Google';
            if (githubLabel) githubLabel.textContent = 'Continua con GitHub';
        }
    }

    async handleSaasAuthSubmit() {
        const emailEl = document.getElementById('saas-email-input');
        const passEl = document.getElementById('saas-password-input');
        const nameEl = document.getElementById('saas-fullname-input');
        const errorEl = document.getElementById('auth-error');
        if (errorEl) errorEl.classList.add('hidden');

        const email = emailEl ? emailEl.value.trim() : '';
        const password = passEl ? passEl.value : '';
        const fullName = nameEl ? nameEl.value.trim() : '';

        const endpoint = this.isRegisterMode ? '/api/auth/register' : '/api/auth/login';
        const payload = this.isRegisterMode ? { email, password, full_name: fullName } : { email, password };

        try {
            const submitBtn = document.getElementById('saas-submit-btn');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Connessione in corso...'; }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.token) {
                const token = data.token;
                localStorage.setItem('agy_pin', token);
                if (data.user) localStorage.setItem('agy_user', JSON.stringify(data.user));
                document.cookie = `agy_jwt=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
                
                this.authModal.classList.add('hidden');
                this.loadUserProfile(token);
                this.connectSocket(token);
                if (window.agyFiles) window.agyFiles.loadDir('');
            } else {
                if (errorEl) {
                    errorEl.textContent = data.error || 'Credenziali non valide.';
                    errorEl.classList.remove('hidden');
                }
            }
        } catch (e) {
            if (errorEl) {
                errorEl.textContent = 'Errore di connessione al server.';
                errorEl.classList.remove('hidden');
            }
        } finally {
            const submitBtn = document.getElementById('saas-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = this.isRegisterMode ? 'Registrati e Avvia' : 'Accedi';
            }
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
                document.cookie = `agy_jwt=${encodeURIComponent(pin)}; path=/; max-age=604800; SameSite=Lax`;
                this.connectSocket(pin);
                if (window.agyFiles) window.agyFiles.loadDir('');
            } else {
                this.authError.textContent = 'PIN errato. Riprova.';
                this.authError.classList.remove('hidden');
            }
        }).catch(() => {
            this.authError.textContent = 'Errore di connessione.';
            this.authError.classList.remove('hidden');
        });
    }

    logout() {
        localStorage.removeItem('agy_pin');
        localStorage.removeItem('agy_user');
        document.cookie = 'agy_jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.reload();
    }

    connectSocket(pin) {
        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io({
            auth: { token: pin },
            query: { token: pin },
            transports: ['websocket', 'polling'],
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

        // Inizializza il terminale, la chat, le impostazioni, gli ambienti e la sidebar
        if (window.agyTerminal) window.agyTerminal.init(this.socket);
        if (window.agyChat) window.agyChat.init(this.socket);
        if (window.agySettings) window.agySettings.init();
        if (window.agyEnvironments) window.agyEnvironments.init();
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

        const targetPane = document.getElementById(tabId);
        const targetTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);

        if (targetPane) targetPane.classList.add('active');
        if (targetTab) targetTab.classList.add('active');

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
