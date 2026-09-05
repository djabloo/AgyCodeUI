class AgySettings {
    constructor() {
        this.currentSubTab = 'account';
        this.config = {};
        this.models = [];
        this.mcpServers = [];
        this.skills = [];
        this.plugins = [];
    }

    async init() {
        await this.loadAll();
    }

    async loadAll() {
        await Promise.all([
            this.loadInfo(),
            this.loadMcp(),
            this.loadSkills(),
            this.loadPlugins()
        ]);
    }

    switchSubTab(tabName) {
        this.currentSubTab = tabName;
        document.querySelectorAll('.settings-sub-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

        const targetBtn = document.querySelector(`.settings-sub-tab[data-subtab="${tabName}"]`);
        const targetSection = document.getElementById(`settings-section-${tabName}`);

        if (targetBtn) targetBtn.classList.add('active');
        if (targetSection) targetSection.classList.add('active');

        if (tabName === 'mcp') this.loadMcp();
        if (tabName === 'skills') this.loadSkills();
        if (tabName === 'plugins') this.loadPlugins();
        if (tabName === 'account' || tabName === 'permissions') this.loadInfo();
    }

    // 1. Account & Models
    async loadInfo() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/info', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                this.config = await res.json();
                this.models = this.config.models || [];
                this.renderUserProfile();
                this.loadAgyAuthStatus();
                this.renderAccountSection();
                this.renderPermissionsSection();
                this.loadAgyPermissions();
            }
        } catch (e) {
            console.error('[Settings] Errore caricamento info:', e);
        }
    }

    renderUserProfile(userOverride, subOverride) {
        let user = userOverride;
        let sub = subOverride;

        if (!user) {
            try {
                const stored = localStorage.getItem('agy_user');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    user = parsed;
                    sub = parsed.subscription || null;
                }
            } catch (e) {}
        }

        const nameEl = document.getElementById('user-display-name');
        const emailEl = document.getElementById('user-display-email');
        const roleEl = document.getElementById('user-role-badge');
        const providerEl = document.getElementById('user-provider-badge');
        const planEl = document.getElementById('user-plan-tag');
        const creditsEl = document.getElementById('user-credits-tag');
        const avatarImg = document.getElementById('user-avatar-img');
        const avatarFallback = document.getElementById('user-avatar-fallback');
        const permsChipsContainer = document.getElementById('user-perms-chips');

        if (!user) {
            if (nameEl) nameEl.textContent = 'Admin Locale / Self-Hosted';
            if (emailEl) emailEl.textContent = 'Autenticato tramite PIN di sicurezza';
            if (roleEl) {
                roleEl.textContent = 'Admin';
                roleEl.className = 'badge-role badge-admin';
            }
            if (providerEl) {
                providerEl.textContent = 'Local Host';
                providerEl.className = 'badge-provider';
            }
            if (planEl) planEl.textContent = 'Self-Hosted';
            if (creditsEl) creditsEl.textContent = 'Illimitati';
            if (avatarFallback) avatarFallback.textContent = 'A';
            return;
        }

        const displayName = user.full_name || user.email.split('@')[0];
        if (nameEl) nameEl.textContent = displayName;
        if (emailEl) emailEl.textContent = user.email || '';

        // Avatar
        if (user.avatar_url && avatarImg) {
            avatarImg.src = user.avatar_url;
            avatarImg.classList.remove('hidden');
            if (avatarFallback) avatarFallback.classList.add('hidden');
        } else if (avatarFallback) {
            avatarFallback.textContent = displayName.charAt(0).toUpperCase() || 'U';
            avatarFallback.classList.remove('hidden');
            if (avatarImg) avatarImg.classList.add('hidden');
        }

        // Role Badge
        if (roleEl) {
            const role = (user.role || 'developer').toLowerCase();
            roleEl.textContent = role.toUpperCase();
            roleEl.className = `badge-role badge-${role}`;
        }

        // Provider Badge
        if (providerEl) {
            const provider = (user.auth_provider || 'email').toLowerCase();
            if (provider === 'google') {
                providerEl.innerHTML = '🔵 Google';
            } else if (provider === 'github') {
                providerEl.innerHTML = '⚫ GitHub';
            } else {
                providerEl.innerHTML = '✉️ Email';
            }
        }

        // Subscription & Credits
        const userSub = sub || user.subscription;
        if (userSub) {
            if (planEl) planEl.textContent = `Piano ${(userSub.plan_tier || 'starter').toUpperCase()}`;
            if (creditsEl) creditsEl.textContent = `${userSub.credits_remaining ?? 100} Crediti Residui`;
        }

        // Permissions List
        if (permsChipsContainer) {
            const role = (user.role || 'developer').toLowerCase();
            const isAdmin = role === 'admin';
            const isViewer = role === 'viewer';

            let chipsHtml = '';
            if (isAdmin) {
                chipsHtml = `
                    <span class="perm-chip active"><i data-lucide="shield-check"></i> Controllo Amministrativo Completo</span>
                    <span class="perm-chip active"><i data-lucide="terminal"></i> Shell & Terminale Illimitato</span>
                    <span class="perm-chip active"><i data-lucide="file-code"></i> Modifica & Scrittura File</span>
                    <span class="perm-chip active"><i data-lucide="server"></i> Gestione Server MCP & Skills</span>
                    <span class="perm-chip active"><i data-lucide="users"></i> Gestione Permessi & Utenti</span>
                `;
            } else if (isViewer) {
                chipsHtml = `
                    <span class="perm-chip active"><i data-lucide="eye"></i> Sola Lettura Conversazioni</span>
                    <span class="perm-chip active"><i data-lucide="file-search"></i> Visualizzazione File Progetto</span>
                    <span class="perm-chip disabled"><i data-lucide="lock"></i> Shell & Terminale Bloccato</span>
                    <span class="perm-chip disabled"><i data-lucide="lock"></i> Modifica File Non Autorizzata</span>
                `;
            } else {
                chipsHtml = `
                    <span class="perm-chip active"><i data-lucide="terminal"></i> Shell & Terminale di Progetto</span>
                    <span class="perm-chip active"><i data-lucide="file-code"></i> Modifica & Scrittura File Workspace</span>
                    <span class="perm-chip active"><i data-lucide="server"></i> Server MCP & Skills</span>
                    <span class="perm-chip active"><i data-lucide="folder-check"></i> Workspace Isolato</span>
                `;
            }
            permsChipsContainer.innerHTML = chipsHtml;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    // Gestione Autenticazione Antigravity CLI (agy)
    async loadAgyAuthStatus() {
        const token = localStorage.getItem('agy_pin') || '';
        const badgeEl = document.getElementById('agy-conn-badge');
        const methodEl = document.getElementById('agy-method-val');
        const fileEl = document.getElementById('agy-token-file-val');
        const execEl = document.getElementById('agy-cli-exec-val');
        const logoutBtn = document.getElementById('btn-agy-logout');

        if (badgeEl) {
            badgeEl.className = 'badge-status-pill status-checking';
            badgeEl.innerHTML = '<span class="pulse-indicator"></span> Verifica in corso...';
        }

        try {
            const res = await fetch('/api/settings/agy-auth/status', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();

                if (data.cliConnected) {
                    if (badgeEl) {
                        badgeEl.className = 'badge-status-pill status-connected';
                        badgeEl.innerHTML = '<span class="pulse-indicator"></span> 🟢 Connesso ad agy';
                    }
                    if (execEl) execEl.innerHTML = '<span style="color:#3fb950; font-weight:600;">Funzionante (Modelli disponibili)</span>';
                    if (logoutBtn) logoutBtn.classList.remove('hidden');
                } else if (data.hasTokenFile) {
                    if (badgeEl) {
                        badgeEl.className = 'badge-status-pill status-warning';
                        badgeEl.innerHTML = '<span class="pulse-indicator"></span> 🟡 Token Presente (Verifica CLI...)';
                    }
                    if (execEl) execEl.innerHTML = '<span style="color:#d29922;">Token trovato, verifica CLI in attesa</span>';
                    if (logoutBtn) logoutBtn.classList.remove('hidden');
                } else {
                    if (badgeEl) {
                        badgeEl.className = 'badge-status-pill status-disconnected';
                        badgeEl.innerHTML = '<span class="pulse-indicator"></span> 🔴 Non Autenticato';
                    }
                    if (execEl) execEl.innerHTML = '<span style="color:#f85149;">Autenticazione richiesta</span>';
                    if (logoutBtn) logoutBtn.classList.add('hidden');
                }

                if (methodEl) {
                    methodEl.textContent = data.authMethod === 'consumer' ? 'Google Account Consumer (OAuth)' : (data.authMethod || 'Non configurato');
                }
                if (fileEl) {
                    fileEl.textContent = data.hasTokenFile ? `Presente (${data.tokenPreview || 'attivo'})` : 'Non trovato (antigravity-oauth-token)';
                }
            }
        } catch (e) {
            if (badgeEl) {
                badgeEl.className = 'badge-status-pill status-disconnected';
                badgeEl.innerHTML = 'Errore verifica';
            }
        }
    }

    async startAgyLogin() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/agy-auth/start-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token }
            });
            const data = await res.json();
            alert(data.message || 'Comando agy inviato al terminale.');
            if (window.agyApp && typeof window.agyApp.switchTab === 'function') {
                window.agyApp.switchTab('chat-tab');
            }
        } catch (e) {
            alert('Errore avvio login: ' + e.message);
        }
    }

    openManualTokenModal() {
        const modal = document.getElementById('manual-agy-token-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeManualTokenModal() {
        const modal = document.getElementById('manual-agy-token-modal');
        if (modal) modal.classList.add('hidden');
    }

    async saveManualAgyToken() {
        const tokenInput = document.getElementById('manual-agy-token-input');
        const methodSelect = document.getElementById('manual-agy-method-select');
        const token = tokenInput ? tokenInput.value.trim() : '';
        const authMethod = methodSelect ? methodSelect.value : 'consumer';

        if (!token) {
            alert('Inserisci un token valido prima di salvare.');
            return;
        }

        const authToken = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/agy-auth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': authToken },
                body: JSON.stringify({ token, authMethod })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Token Antigravity salvato!');
                this.closeManualTokenModal();
                if (tokenInput) tokenInput.value = '';
                this.loadAgyAuthStatus();
            } else {
                alert(data.error || 'Errore salvataggio token');
            }
        } catch (e) {
            alert('Errore salvataggio token: ' + e.message);
        }
    }

    async logoutAgy() {
        if (!confirm('Sei sicuro di voler disconnettere Antigravity CLI? Il file del token verrà archiviato.')) return;
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/agy-auth/logout', {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                alert('Sessione Antigravity disconnessa con successo.');
                this.loadAgyAuthStatus();
            }
        } catch (e) {
            alert('Errore disconnessione: ' + e.message);
        }
    }

    renderAccountSection() {
        const container = document.getElementById('models-list-container');
        if (!container) return;

        const currentArgs = this.config.cliArgs || '';
        let currentModel = 'gemini-3.7-flash-high';
        const modelMatch = currentArgs.match(/--model\s+([^\s]+)/);
        if (modelMatch) currentModel = modelMatch[1];

        let currentEffort = 'high';
        const effortMatch = currentArgs.match(/--effort\s+([^\s]+)/);
        if (effortMatch) currentEffort = effortMatch[1];

        let html = '';
        for (const m of this.models) {
            const isSelected = m.id === currentModel || (currentModel.startsWith('gemini-3.7') && m.id === 'gemini-3.7-flash-high' && !modelMatch);
            const isThinking = m.name.toLowerCase().includes('thinking') || m.id.includes('high');
            const badge = m.id.startsWith('gemini') ? 'Google AI' : (m.id.startsWith('claude') ? 'Anthropic' : 'Open Source');

            html += `
                <div class="model-select-card ${isSelected ? 'selected' : ''}" onclick="window.agySettings.selectModel('${m.id}')">
                    <div class="model-radio">
                        <input type="radio" name="active_model" value="${m.id}" ${isSelected ? 'checked' : ''} />
                    </div>
                    <div class="model-info">
                        <div class="model-title-row">
                            <span class="model-name">${m.name}</span>
                            <span class="model-provider-badge">${badge}</span>
                            ${isThinking ? '<span class="model-tag-badge">🧠 Reasoning</span>' : ''}
                        </div>
                        <span class="model-id">${m.id}</span>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;

        const effortSelect = document.getElementById('effort-select');
        if (effortSelect) effortSelect.value = currentEffort;

        const langSelect = document.getElementById('language-select');
        if (langSelect && window.agyI18n) langSelect.value = window.agyI18n.getLanguage();
    }

    async selectModel(modelId) {
        const token = localStorage.getItem('agy_pin') || '';
        const effortSelect = document.getElementById('effort-select');
        const effort = effortSelect ? effortSelect.value : 'high';

        try {
            const res = await fetch('/api/settings/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({
                    model: modelId,
                    effort: effort
                })
            });
            if (res.ok) {
                await this.loadInfo();
                alert(`Modello aggiornato a: ${modelId} (${effort} effort)`);
            }
        } catch (e) {
            alert('Errore aggiornamento modello: ' + e.message);
        }
    }

    async saveEffort() {
        const effortSelect = document.getElementById('effort-select');
        const effort = effortSelect ? effortSelect.value : 'high';
        const token = localStorage.getItem('agy_pin') || '';
        try {
            await fetch('/api/settings/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ effort })
            });
            alert('Livello di ragionamento (Effort) salvato: ' + effort);
        } catch (e) {
            alert('Errore salvataggio effort: ' + e.message);
        }
    }

    // 2. Server MCP
    async loadMcp() {
        const token = localStorage.getItem('agy_pin') || '';
        const listEl = document.getElementById('mcp-list');
        if (!listEl) return;

        listEl.innerHTML = '<p style="padding:12px; color:var(--text-muted);">Caricamento server MCP in corso...</p>';
        try {
            const res = await fetch('/api/settings/mcp', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.mcpServers = data.servers || [];
                this.renderMcpSection();
            }
        } catch (e) {
            listEl.innerHTML = `<p class="error-text">Errore MCP: ${e.message}</p>`;
        }
    }

    renderMcpSection() {
        const listEl = document.getElementById('mcp-list');
        if (!listEl) return;

        if (this.mcpServers.length === 0) {
            listEl.innerHTML = `
                <div class="empty-placeholder">
                    <i data-lucide="server-off"></i>
                    <p>Nessun server MCP configurato.</p>
                    <p class="subtext">Aggiungi un server MCP personalizzato o usa uno dei template rapidi sottostanti.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        for (const s of this.mcpServers) {
            const isEnabled = s.status === 'enabled';
            html += `
                <div class="mcp-card ${isEnabled ? 'enabled' : 'disabled'}">
                    <div class="mcp-card-header">
                        <div class="mcp-card-title">
                            <span class="mcp-name">${this.escapeHtml(s.name)}</span>
                            <span class="mcp-type-badge">${s.type}</span>
                            <span class="mcp-status-badge ${isEnabled ? 'active' : 'inactive'}">${isEnabled ? 'Abilitato' : 'Disabilitato'}</span>
                        </div>
                        <div class="mcp-card-actions">
                            <button class="btn btn-sm ${isEnabled ? 'btn-outline' : 'btn-action'}" onclick="window.agySettings.toggleMcp('${s.name}', ${!isEnabled})">
                                ${isEnabled ? '<i data-lucide="power-off"></i> Disattiva' : '<i data-lucide="power"></i> Attiva'}
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="window.agySettings.removeMcp('${s.name}')" title="Rimuovi">
                                <i data-lucide="trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mcp-card-body">
                        <div class="mcp-command-box">
                            <code>${this.escapeHtml(s.command)}</code>
                        </div>
                    </div>
                </div>
            `;
        }

        listEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    async toggleMcp(name, enable) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/settings/mcp/${encodeURIComponent(name)}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ enable })
            });
            if (res.ok) {
                this.loadMcp();
            } else {
                const err = await res.json();
                alert(err.error || 'Errore toggle MCP');
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    async removeMcp(name) {
        if (!confirm(`Vuoi rimuovere il server MCP "${name}"?`)) return;
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/settings/mcp/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                this.loadMcp();
            } else {
                const err = await res.json();
                alert(err.error || 'Errore rimozione MCP');
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    openAddMcpModal() {
        const modal = document.getElementById('add-mcp-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeAddMcpModal() {
        const modal = document.getElementById('add-mcp-modal');
        if (modal) modal.classList.add('hidden');
    }

    applyMcpTemplate(name, command, args, type = 'stdio') {
        const nameInput = document.getElementById('mcp-name-input');
        const cmdInput = document.getElementById('mcp-cmd-input');
        const argsInput = document.getElementById('mcp-args-input');
        const typeSelect = document.getElementById('mcp-type-select');

        if (nameInput) nameInput.value = name;
        if (cmdInput) cmdInput.value = command;
        if (argsInput) argsInput.value = args || '';
        if (typeSelect) typeSelect.value = type;

        this.openAddMcpModal();
    }

    async submitAddMcp() {
        const name = document.getElementById('mcp-name-input').value.trim();
        const commandOrUrl = document.getElementById('mcp-cmd-input').value.trim();
        const args = document.getElementById('mcp-args-input').value.trim();
        const type = document.getElementById('mcp-type-select').value;
        const envsStr = document.getElementById('mcp-envs-input').value.trim();
        const headersStr = document.getElementById('mcp-headers-input').value.trim();

        if (!name || !commandOrUrl) {
            alert('Inserisci il nome e il comando o URL del server MCP.');
            return;
        }

        const envs = envsStr ? envsStr.split('\n').map(s => s.trim()).filter(Boolean) : [];
        const headers = headersStr ? headersStr.split('\n').map(s => s.trim()).filter(Boolean) : [];

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({
                    name,
                    commandOrUrl,
                    type,
                    args,
                    envs,
                    headers
                })
            });
            if (res.ok) {
                this.closeAddMcpModal();
                this.loadMcp();
                alert(`Server MCP "${name}" aggiunto con successo!`);
            } else {
                const err = await res.json();
                alert(err.error || 'Errore aggiunta MCP');
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    // 3. Permessi & Sicurezza
    renderPermissionsSection() {
        const pinInput = document.getElementById('perm-pin-input');
        const workspaceInput = document.getElementById('perm-workspace-input');
        const skipPermsCheck = document.getElementById('perm-skip-permissions-toggle');
        const sandboxCheck = document.getElementById('perm-sandbox-toggle');

        if (pinInput) {
            pinInput.value = '';
            pinInput.placeholder = this.config.authPinSet ? 'PIN impostato (lascia vuoto per non modificare)' : 'Nessun PIN (imposta nuovo PIN)';
        }
        if (workspaceInput) workspaceInput.value = this.config.workspaceDir || '';

        const currentArgs = this.config.cliArgs || '';
        if (skipPermsCheck) skipPermsCheck.checked = currentArgs.includes('--dangerously-skip-permissions');
        if (sandboxCheck) sandboxCheck.checked = currentArgs.includes('--sandbox');
    }

    async loadAgyPermissions() {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/agy-permissions', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                const nonWsCheck = document.getElementById('perm-non-workspace-toggle');
                if (nonWsCheck) nonWsCheck.checked = !!data.allowNonWorkspaceAccess;

                const skipPermsCheck = document.getElementById('perm-skip-permissions-toggle');
                if (skipPermsCheck && typeof data.dangerouslySkipPermissions === 'boolean') {
                    skipPermsCheck.checked = data.dangerouslySkipPermissions;
                }

                const sandboxCheck = document.getElementById('perm-sandbox-toggle');
                if (sandboxCheck && typeof data.sandboxMode === 'boolean') {
                    sandboxCheck.checked = data.sandboxMode;
                }

                this.renderWhitelistChips(data.allowedCommands || []);
            }
        } catch (e) {
            console.error('[Settings] Errore caricamento permessi agy:', e);
        }
    }

    renderWhitelistChips(commands) {
        const container = document.getElementById('whitelist-chips-container');
        if (!container) return;

        if (!commands || commands.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:8px 0;">Nessun comando in whitelist. Aggiungine uno con il form sopra.</p>';
            return;
        }

        let html = '';
        for (const cmd of commands) {
            html += `
                <div class="whitelist-chip">
                    <span class="cmd-text"><code>${this.escapeHtml(cmd)}</code></span>
                    <button type="button" class="btn-remove-cmd" onclick="window.agySettings.removeWhitelistCommand('${this.escapeHtml(cmd)}')" title="Rimuovi comando">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            `;
        }
        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    async addWhitelistCommand() {
        const input = document.getElementById('whitelist-cmd-input');
        const cmd = input ? input.value.trim() : '';
        if (!cmd) {
            alert('Inserisci un comando bash (es. git, npm test)');
            return;
        }

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/agy-permissions/whitelist/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ command: cmd })
            });
            const data = await res.json();
            if (res.ok) {
                if (input) input.value = '';
                this.loadAgyPermissions();
            } else {
                alert(data.error || 'Errore aggiunta comando');
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    async removeWhitelistCommand(cmd) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/agy-permissions/whitelist/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ command: cmd })
            });
            if (res.ok) {
                this.loadAgyPermissions();
            }
        } catch (e) {
            alert('Errore rimozione comando: ' + e.message);
        }
    }

    async savePermissions() {
        const pin = document.getElementById('perm-pin-input').value.trim();
        const workspace = document.getElementById('perm-workspace-input').value.trim();
        const skipPerms = document.getElementById('perm-skip-permissions-toggle').checked;
        const sandbox = document.getElementById('perm-sandbox-toggle').checked;
        const nonWsCheck = document.getElementById('perm-non-workspace-toggle');
        const allowNonWorkspace = nonWsCheck ? nonWsCheck.checked : false;

        const token = localStorage.getItem('agy_pin') || '';
        const bodyPayload = {
            workspaceDir: workspace,
            dangerouslySkipPermissions: skipPerms,
            sandboxMode: sandbox,
            updateArgs: true
        };
        if (pin) {
            bodyPayload.authPin = pin;
        }

        try {
            const [res1, res2] = await Promise.all([
                fetch('/api/settings/permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(bodyPayload)
                }),
                fetch('/api/settings/agy-permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify({
                        allowNonWorkspaceAccess: allowNonWorkspace,
                        dangerouslySkipPermissions: skipPerms,
                        sandboxMode: sandbox
                    })
                })
            ]);

            if (res1.ok && res2.ok) {
                if (pin) localStorage.setItem('agy_pin', pin);
                alert('Impostazioni di sicurezza e permessi Antigravity salvate con successo.');
                this.loadInfo();
            } else {
                const err = await res1.json().catch(() => ({}));
                alert(err.error || 'Errore salvataggio permessi');
            }
        } catch (e) {
            alert('Errore salvataggio permessi: ' + e.message);
        }
    }

    // 4. Skills
    async loadSkills() {
        const token = localStorage.getItem('agy_pin') || '';
        const listEl = document.getElementById('skills-list');
        if (!listEl) return;

        listEl.innerHTML = '<p style="padding:12px; color:var(--text-muted);">Caricamento skills in corso...</p>';
        try {
            const res = await fetch('/api/settings/skills', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.skills = data.skills || [];
                this.renderSkillsSection();
            }
        } catch (e) {
            listEl.innerHTML = `<p class="error-text">Errore skills: ${e.message}</p>`;
        }
    }

    renderSkillsSection() {
        const listEl = document.getElementById('skills-list');
        if (!listEl) return;

        if (this.skills.length === 0) {
            listEl.innerHTML = `
                <div class="empty-placeholder">
                    <i data-lucide="sparkles"></i>
                    <p>Nessuna skill personalizzata trovata.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        for (const s of this.skills) {
            html += `
                <div class="skill-card">
                    <div class="skill-card-header">
                        <div class="skill-card-title">
                            <span class="skill-name">${this.escapeHtml(s.name)}</span>
                            <span class="skill-source-badge">${s.source}</span>
                        </div>
                        <div class="skill-card-actions">
                            <button class="btn btn-sm btn-outline" onclick="window.agySettings.viewSkillContent('${s.folder}')">
                                <i data-lucide="eye"></i> Istruzioni
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="window.agySettings.deleteSkill('${s.folder}')" title="Elimina">
                                <i data-lucide="trash"></i>
                            </button>
                        </div>
                    </div>
                    <p class="skill-description">${this.escapeHtml(s.description || 'Nessuna descrizione specificata.')}</p>
                    <div class="skill-card-footer">
                        <span class="skill-path"><i data-lucide="file-code"></i> ${this.escapeHtml(s.path)}</span>
                    </div>
                </div>
            `;
        }

        listEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    async viewSkillContent(name) {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/settings/skills/${encodeURIComponent(name)}/content`, {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                const modal = document.getElementById('skill-content-modal');
                const titleEl = document.getElementById('skill-modal-title');
                const codeEl = document.getElementById('skill-modal-code');
                if (titleEl) titleEl.textContent = `SKILL.md (${name})`;
                if (codeEl) codeEl.textContent = data.content;
                if (modal) modal.classList.remove('hidden');
            }
        } catch (e) {
            alert('Errore visualizzazione skill: ' + e.message);
        }
    }

    closeSkillModal() {
        const modal = document.getElementById('skill-content-modal');
        if (modal) modal.classList.add('hidden');
    }

    openCreateSkillModal() {
        const modal = document.getElementById('create-skill-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeCreateSkillModal() {
        const modal = document.getElementById('create-skill-modal');
        if (modal) modal.classList.add('hidden');
    }

    async submitCreateSkill() {
        const name = document.getElementById('new-skill-name-input').value.trim();
        const description = document.getElementById('new-skill-desc-input').value.trim();
        const content = document.getElementById('new-skill-content-input').value;

        if (!name) {
            alert('Inserisci il nome della skill.');
            return;
        }

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/skills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ name, description, content })
            });
            if (res.ok) {
                this.closeCreateSkillModal();
                this.loadSkills();
                alert(`Skill "${name}" creata con successo!`);
            } else {
                const err = await res.json();
                alert(err.error || 'Errore creazione skill');
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    async deleteSkill(name) {
        if (!confirm(`Vuoi davvero eliminare la skill "${name}"?`)) return;
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/settings/skills/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                this.loadSkills();
            } else {
                const err = await res.json();
                alert(err.error || 'Errore eliminazione skill');
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    // 5. Plugins
    async loadPlugins() {
        const token = localStorage.getItem('agy_pin') || '';
        const listEl = document.getElementById('plugins-list');
        if (!listEl) return;

        listEl.innerHTML = '<p style="padding:12px; color:var(--text-muted);">Caricamento plugin in corso...</p>';
        try {
            const res = await fetch('/api/settings/plugins', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.plugins = data.plugins || [];
                this.renderPluginsSection();
            }
        } catch (e) {
            listEl.innerHTML = `<p class="error-text">Errore plugin: ${e.message}</p>`;
        }
    }

    renderPluginsSection() {
        const listEl = document.getElementById('plugins-list');
        if (!listEl) return;

        if (this.plugins.length === 0) {
            listEl.innerHTML = `
                <div class="empty-placeholder">
                    <i data-lucide="package"></i>
                    <p>Nessun plugin importato o installato.</p>
                    <p class="subtext">Usa il pulsante sottostante per importare plugin o installarne di nuovi.</p>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        for (const p of this.plugins) {
            html += `
                <div class="plugin-card">
                    <div class="plugin-card-header">
                        <span class="plugin-name">${this.escapeHtml(p.name)}</span>
                        <div class="plugin-card-actions">
                            <button class="btn btn-sm btn-danger" onclick="window.agySettings.uninstallPlugin('${p.name}')">
                                <i data-lucide="trash"></i> Disinstalla
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        listEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    async importPlugins(source = 'gemini') {
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/plugins/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ source })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Importazione completata: ${data.message}`);
                this.loadPlugins();
            } else {
                alert(`Errore importazione: ${data.error}`);
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    async installPluginPrompt() {
        const target = prompt('Inserisci il nome o il pacchetto del plugin (es. plugin@marketplace o url git):');
        if (!target || !target.trim()) return;

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/settings/plugins/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ target: target.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Plugin installato: ${data.message}`);
                this.loadPlugins();
            } else {
                alert(`Errore installazione: ${data.error}`);
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    async uninstallPlugin(name) {
        if (!confirm(`Vuoi disinstallare il plugin "${name}"?`)) return;
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch(`/api/settings/plugins/${encodeURIComponent(name)}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });
            const data = await res.json();
            if (res.ok) {
                this.loadPlugins();
            } else {
                alert(`Errore: ${data.error}`);
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

window.agySettings = new AgySettings();
