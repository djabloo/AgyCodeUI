// Tab "Browser" nella barra in alto: non e' un plugin (nessun manifest.json,
// nessun processo server dedicato), e' solo una scorciatoia verso il subagent
// /browser gia' esistente in chat. Visibile/nascosta tramite il toggle in
// Impostazioni > Browser Settings (persistito server-side in
// data/browser-settings.json, campo "enabled"). Usa classi CSS proprie
// (non "plugin-nav-tab") perche' AgyPlugins.renderNavTabs() ripulisce quella
// classe ad ogni suo render: condividerla avrebbe fatto sparire anche questo
// tab ogni volta che un plugin viene abilitato/disabilitato.
class AgyBrowserTab {
    constructor() {
        this.enabled = false;
    }

    async init() {
        await this.refresh();
    }

    async refresh() {
        try {
            const token = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/settings/browser/status', {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (res.ok) {
                const data = await res.json();
                this.enabled = !!data.enabled;
            }
        } catch (e) {
            console.error('[BrowserTab] Errore verifica stato:', e);
        }
        this.render();
    }

    render() {
        const nav = document.querySelector('.nav-tabs');
        if (!nav) return;

        document.getElementById('browser-nav-tab')?.remove();
        document.getElementById('browser-nav-divider')?.remove();
        if (!this.enabled) return;

        if (!nav.querySelector('.nav-tab-divider')) {
            const divider = document.createElement('div');
            divider.id = 'browser-nav-divider';
            divider.className = 'nav-tab-divider';
            nav.appendChild(divider);
        }

        const tabBtn = document.createElement('button');
        tabBtn.id = 'browser-nav-tab';
        tabBtn.className = 'nav-tab';
        tabBtn.title = 'Browser (/browser)';
        tabBtn.setAttribute('aria-label', 'Browser');
        tabBtn.onclick = () => this.open();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<i><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></i>';
        const iconEl = tempDiv.firstElementChild;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = 'Browser';

        const closeBtn = document.createElement('span');
        closeBtn.className = 'nav-tab-close';
        closeBtn.title = 'Disattiva Browser';
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.onclick = (ev) => {
            ev.stopPropagation();
            this.disable();
        };

        tabBtn.appendChild(iconEl);
        tabBtn.appendChild(labelSpan);
        tabBtn.appendChild(closeBtn);
        nav.appendChild(tabBtn);

        if (window.lucide) window.lucide.createIcons();
    }

    open() {
        if (window.agyApp) window.agyApp.switchTab('chat-tab');
        if (window.agyChat && typeof window.agyChat.sendPrompt === 'function') {
            window.agyChat.sendPrompt('/browser ');
        }
    }

    async disable() {
        this.enabled = false;
        this.render();
        const toggle = document.getElementById('browser-enabled-toggle');
        if (toggle) toggle.checked = false;
        try {
            const token = localStorage.getItem('agy_pin') || '';
            await fetch('/api/settings/browser/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
                body: JSON.stringify({ enabled: false })
            });
        } catch (e) {
            console.error('[BrowserTab] Errore disattivazione:', e);
        }
    }
}

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
        this.initTheme();

        if (window.agyI18n) {
            window.agyI18n.applyTranslations();
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }

        if (window.agyPlugins) {
            window.agyPlugins.init();
        }

        if (window.agyBrowserTab) {
            window.agyBrowserTab.init();
        }

        const navTabs = document.querySelector('.nav-tabs');
        if (navTabs) {
            navTabs.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    navTabs.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }

        if (this.promptInput) {
            this.promptInput.addEventListener('input', () => {
                this.promptInput.style.height = 'auto';
                this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 120) + 'px';
            });
        }

        // Gestione parametri OAuth redirect (?provider=... o ?auth_error=...).
        // In modalità SaaS la sessione è nel cookie httpOnly impostato dal gateway: nessun token nell'URL.
        const urlParams = new URLSearchParams(window.location.search);
        const authErrorParam = urlParams.get('auth_error');

        if (urlParams.get('provider')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Deep-link da Dashboard SaaS: /app/?tab=terminal apre subito il terminale
        // (bottone "SSH" nella Dashboard, non c'e' un vero accesso SSH multi-tenant).
        const tabParam = urlParams.get('tab');
        if (tabParam === 'terminal') {
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => this.switchTab('terminal-tab'), 400);
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

            // AgyCloud: account senza piano attivo o scaduto. Il PIN qui non
            // c'entra, si va alla scelta del piano.
            // ...o ambiente fermato perche' lo spazio supera di molto la quota:
            // la dashboard spiega cosa fare.
            if (res.status === 402 || res.status === 507) {
                window.location.href = '/dashboard#subscription';
                return;
            }

            if (res.ok) {
                this.authModal.classList.add('hidden');
                if (token) {
                    localStorage.setItem('agy_pin', token);
                }

                // Carica dettagli profilo utente autenticato se disponibile
                this.loadUserProfile(token);

                this.connectSocket(token);
                if (window.agyFiles) window.agyFiles.loadDir('');
                if (window.agyPlugins) window.agyPlugins.init();
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
                if (titleEl) titleEl.textContent = 'Accedi ad AgyCloud';
                const emailInput = document.getElementById('saas-email-input');
                if (emailInput) emailInput.focus();
            } else {
                this.isSaasMode = false;
                if (saasSection) saasSection.classList.add('hidden');
                const modeInfo = await fetch('/api/auth/mode').then(r => (r.ok ? r.json() : null)).catch(() => null);
                if (modeInfo && modeInfo.mode === 'account') {
                    if (pinSection) pinSection.classList.add('hidden');
                    this.showAccountAuth(modeInfo.setupRequired);
                } else {
                    if (pinSection) pinSection.classList.remove('hidden');
                    if (this.pinInput) this.pinInput.focus();
                }
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
                // In self-hosted /api/auth/me risponde comunque con uno user fittizio
                // ('local-admin', solo per popolare Impostazioni): non e' SaaS reale.
                if (data.user && data.user.id !== 'local-admin') {
                    this.isSaasMode = true;
                    localStorage.setItem('agy_user', JSON.stringify({
                        ...data.user,
                        subscription: data.subscription
                    }));
                    if (window.agySettings && typeof window.agySettings.renderUserProfile === 'function') {
                        window.agySettings.renderUserProfile(data.user, data.subscription);
                    }
                    const dashLink = document.getElementById('back-to-dashboard-link');
                    if (dashLink) dashLink.classList.remove('hidden');
                    this.showSaasOnboarding();

                    // In modalità SaaS la gestione ambienti vive solo nella Dashboard
                    // (fuori dalla IDE): i tre ingressi storici al pannello interno
                    // (cloud in sidebar, "Pannello Ambienti" nel drawer, icona nuvola
                    // in header) rimandano tutti li', invece di aprire la vista locale.
                    if (window.agyEnvironments && typeof window.agyEnvironments.switchView === 'function') {
                        const originalSwitchView = window.agyEnvironments.switchView.bind(window.agyEnvironments);
                        window.agyEnvironments.switchView = (viewName) => {
                            if (viewName === 'environments') {
                                window.location.href = '/dashboard';
                                return;
                            }
                            return originalSwitchView(viewName);
                        };
                        // Anche "Crea Nuovo Ambiente" (folder-plus in sidebar) va in Dashboard
                        window.agyEnvironments.openCreateModal = () => {
                            window.location.href = '/dashboard';
                        };
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

    /**
     * Avviso una tantum in modalità SaaS: agy nel container richiede il login Antigravity dal terminale.
     */
    showSaasOnboarding() {
        const banner = document.getElementById('saas-onboarding-banner');
        if (!banner) return;
        if (localStorage.getItem('agy_onboarding_seen') === '1') return;
        banner.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    dismissSaasOnboarding(openTerminal) {
        const banner = document.getElementById('saas-onboarding-banner');
        if (banner) banner.classList.add('hidden');
        localStorage.setItem('agy_onboarding_seen', '1');
        if (openTerminal) this.switchTab('terminal-tab');
    }

    async logout() {
        if (!confirm('Sei sicuro di voler effettuare il logout?')) return;
        localStorage.removeItem('agy_pin');
        localStorage.removeItem('agy_user');
        localStorage.removeItem('agy_onboarding_seen');
        if (this.isSaasMode) {
            try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
        }
        if (this.socket) {
            this.socket.disconnect();
        }
        window.location.href = this.isSaasMode ? '/' : window.location.pathname;
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
            if (titleEl) titleEl.textContent = 'Crea Account AgyCloud';
            if (submitBtn) submitBtn.textContent = 'Registrati e Avvia';
            if (toggleLabel) toggleLabel.textContent = 'Hai già un account?';
            if (toggleLink) toggleLink.textContent = 'Accedi';
            if (googleLabel) googleLabel.textContent = 'Registrati con Google';
            if (githubLabel) githubLabel.textContent = 'Registrati con GitHub';
        } else {
            if (nameGroup) nameGroup.classList.add('hidden');
            if (titleEl) titleEl.textContent = 'Accedi ad AgyCloud';
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

                this.authModal.classList.add('hidden');
                this.loadUserProfile(token);
                this.connectSocket(token);
                if (window.agyFiles) window.agyFiles.loadDir('');
            } else if (res.ok && data.requiresVerification) {
                // Registrazione riuscita: serve la conferma via email
                if (errorEl) {
                    errorEl.textContent = data.message || 'Controlla la tua email per confermare l\'account.';
                    errorEl.style.color = '#7ce38b';
                    errorEl.classList.remove('hidden');
                }
                if (this.isRegisterMode) this.toggleSaasMode();
            } else {
                if (errorEl) {
                    errorEl.style.color = '';
                    errorEl.textContent = data.error || 'Credenziali non valide.';
                    if (data.code === 'EMAIL_NOT_VERIFIED') {
                        errorEl.textContent += ' Per un nuovo link vai alla pagina principale: ';
                        const a = document.createElement('a');
                        a.href = '/?forgot=1';
                        a.textContent = 'agycloud.ai';
                        a.style.color = '#58a6ff';
                        errorEl.appendChild(a);
                    }
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

    // Nodo AgyCloud dedicato: prima registrazione (col link di attivazione della
    // dashboard, parametro ?setup=) oppure login con l'account gia' creato.
    showAccountAuth(setupRequired) {
        const params = new URLSearchParams(window.location.search);
        if (params.has('setup')) {
            this.setupToken = params.get('setup');
            // Il token non deve restare nella cronologia del browser
            params.delete('setup');
            const qs = params.toString();
            window.history.replaceState({}, document.title, window.location.pathname + (qs ? '?' + qs : ''));
        }
        this.accountSetupMode = !!setupRequired;

        const section = document.getElementById('account-auth-section');
        const form = document.getElementById('account-auth-form');
        const desc = document.getElementById('account-auth-desc');
        const confirmGroup = document.getElementById('account-confirm-group');
        const passwordInput = document.getElementById('account-password-input');
        const submitBtn = document.getElementById('account-submit-btn');
        const titleEl = document.getElementById('auth-modal-title');
        if (section) section.classList.remove('hidden');

        if (setupRequired) {
            if (titleEl) titleEl.textContent = 'Attiva il tuo spazio AgyCloud';
            if (!this.setupToken) {
                if (desc) desc.textContent = 'Per creare il tuo account apri il link di attivazione dalla dashboard AgyCloud.';
                if (form) form.classList.add('hidden');
                return;
            }
            if (desc) desc.textContent = 'Scegli username e password: saranno le credenziali per accedere a questo spazio.';
            if (confirmGroup) confirmGroup.classList.remove('hidden');
            if (passwordInput) passwordInput.setAttribute('autocomplete', 'new-password');
            if (submitBtn) submitBtn.textContent = 'Crea account';
        } else {
            if (titleEl) titleEl.textContent = 'Accedi ad AgyCloud';
            if (desc) desc.textContent = 'Accedi al tuo spazio AgyCloud.';
            if (confirmGroup) confirmGroup.classList.add('hidden');
            if (submitBtn) submitBtn.textContent = 'Accedi';
        }
        if (form) form.classList.remove('hidden');
        const usernameInput = document.getElementById('account-username-input');
        if (usernameInput) usernameInput.focus();
    }

    async handleAccountAuthSubmit() {
        const username = document.getElementById('account-username-input').value.trim();
        const password = document.getElementById('account-password-input').value;
        this.authError.classList.add('hidden');

        const showError = (msg) => {
            this.authError.textContent = msg;
            this.authError.classList.remove('hidden');
        };

        let url = '/api/auth/account/login';
        const body = { username, password };
        if (this.accountSetupMode) {
            const confirm = document.getElementById('account-confirm-input').value;
            if (password !== confirm) return showError('Le password non coincidono.');
            url = '/api/auth/account/setup';
            body.setupToken = this.setupToken || '';
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.token) {
                this.setupToken = null;
                document.getElementById('account-auth-section').classList.add('hidden');
                return this.checkAuth(data.token);
            }
            // Account creato nel frattempo (es. altra scheda): si passa al login
            if (res.status === 409 && this.accountSetupMode) this.showAccountAuth(false);
            showError(data.error || 'Accesso non riuscito.');
        } catch (_) {
            showError('Errore di connessione.');
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
                if (window.agyPlugins) window.agyPlugins.init();
            } else {
                this.authError.textContent = 'PIN errato. Riprova.';
                this.authError.classList.remove('hidden');
            }
        }).catch(() => {
            this.authError.textContent = 'Errore di connessione.';
            this.authError.classList.remove('hidden');
        });
    }

    connectSocket(pin) {
        if (this.socket) {
            this.socket.disconnect();
        }

        // In SaaS il gateway autentica via cookie httpOnly; in standalone il PIN viaggia nel payload auth.
        this.socket = io({
            auth: { token: pin },
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
        // Normalizza alias comuni per prevenire schermata vuota (es. 'chat' -> 'chat-tab')
        if (tabId === 'chat') tabId = 'chat-tab';
        else if (tabId === 'terminal') tabId = 'terminal-tab';
        else if (tabId === 'files') tabId = 'files-tab';
        else if (tabId === 'settings') tabId = 'settings-tab';
        else if (tabId === 'prompts') tabId = 'prompts-tab';

        const targetPane = document.getElementById(tabId);
        const targetTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);

        // Se il tab non esiste, non disattivare il tab corrente per evitare schermata nera
        if (!targetPane) {
            console.warn(`[switchTab] Tab pane non trovato: "${tabId}"`);
            return;
        }

        this.activeTab = tabId;
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

        targetPane.classList.add('active');
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

    initTheme() {
        const savedTheme = localStorage.getItem('agy_theme') || 'dark';
        this.setTheme(savedTheme, false);

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (localStorage.getItem('agy_theme') === 'system') {
                    this.applyEffectiveTheme('system');
                }
            });
        }
    }

    setTheme(theme, persist = true) {
        if (persist) {
            localStorage.setItem('agy_theme', theme);
        }
        this.applyEffectiveTheme(theme);
    }

    applyEffectiveTheme(theme) {
        let effective = theme;
        if (theme === 'system') {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            effective = prefersDark ? 'dark' : 'light';
        }

        document.documentElement.setAttribute('data-theme', effective);
        if (effective === 'light') {
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
        } else {
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
        }

        const iconEl = document.getElementById('theme-toggle-icon');
        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (iconEl) {
            iconEl.setAttribute('data-lucide', effective === 'light' ? 'moon' : 'sun');
            if (window.lucide) window.lucide.createIcons();
        }
        if (toggleBtn) {
            toggleBtn.setAttribute('title', effective === 'light' ? 'Passa a Notte (Scuro)' : 'Passa a Giorno (Chiaro)');
        }

        ['dark', 'light', 'system'].forEach(t => {
            const card = document.getElementById(`theme-card-${t}`);
            if (card) {
                if (t === (localStorage.getItem('agy_theme') || 'dark')) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            }
        });
    }

    toggleTheme() {
        const current = localStorage.getItem('agy_theme') || 'dark';
        let next = 'light';
        if (current === 'light') {
            next = 'dark';
        } else if (current === 'dark') {
            next = 'light';
        } else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            next = prefersDark ? 'light' : 'dark';
        }
        this.setTheme(next);
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

function agyBootApp() {
    if (window.agyApp) return; // idempotente: evita doppia inizializzazione
    window.agyBrowserTab = new AgyBrowserTab();
    window.agyApp = new AgyApp();
    window.agyApp.init();
}

// Cloudflare Rocket Loader (se attivo sul dominio) riscrive gli attributi "type"
// dei tag <script> e li esegue col proprio motore in un momento imprecisato,
// dove fidarsi di document.readyState o di un solo listener "DOMContentLoaded"
// si è rivelato inaffidabile (l'evento risulta già passato, o readyState mente):
// l'inizializzazione non partiva mai, senza errori in console (icone/menu
// invisibili). Fix a prova di tutto: si prova subito, e comunque ci si mette
// in ascolto sia di DOMContentLoaded sia di load come rete di sicurezza;
// agyBootApp() è idempotente quindi le chiamate multiple sono innocue.
agyBootApp();
window.addEventListener('DOMContentLoaded', agyBootApp);
window.addEventListener('load', agyBootApp);
