/**
 * AGYUI - Environments, Wizards & Shared Setup Controller
 * - Environments Dashboard & Quota
 * - 3-Step Create Environment Wizard (Blank / GitHub Clone, Slug, Tools)
 * - 2-Step Onboarding Setup Wizard (Git config, Agent connections)
 * - Shared Setup (Template Layer: Skills & MCP)
 * - SSH Helper Modal
 */

class AgyEnvironments {
    constructor() {
        this.environments = [];
        this.currentEnv = null;
        this.quota = { used: 0, total: 10, text: '0 of 10 env' };
        this.currentWizardStep = 1;
        this.selectedStartMode = 'blank'; // 'blank' | 'github'
        this.selectedTools = ['Node.js 22', 'Python 3', 'Git + SSH', 'Build tools', 'Antigravity CLI'];
        // Nota: questa lista è solo un'etichetta salvata col workspace (README), non installa nulla:
        // l'ambiente self-hosted gira in modalità "host", usa quello che è già presente sulla macchina.
        this.availableTools = [
            'Node.js 22', 'Python 3', 'Git + SSH', 'Build tools', 'Google Antigravity CLI',
            'Docker & Compose', 'PostgreSQL 16', 'Redis 7', 'Rust & Cargo', 'Go 1.22', 'Bun'
        ];
        this.currentOnboardingStep = 1;
        this.activeView = 'workspace'; // 'workspace' | 'environments'
    }

    async init() {
        this.injectModalsHtml();
        this.setupGlobalShortcuts();
        await this.loadEnvironments();
        await this.checkOnboarding();
    }

    getAuthHeaders() {
        const pin = localStorage.getItem('agy_pin') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': pin ? `Bearer ${pin}` : ''
        };
    }

    async loadEnvironments() {
        try {
            const res = await fetch('/api/workspaces', { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                this.environments = data.workspaces || [];
                this.currentEnv = data.current || this.environments[0] || null;
                this.quota = data.quota || { used: this.environments.length, total: 10, text: `${this.environments.length} of 10 env` };
                this.renderEnvironmentsDashboard();
                if (window.agySidebar) {
                    window.agySidebar.loadWorkspaces();
                }
            }
        } catch (e) {
            console.error('[Environments] Error loading environments:', e.message);
        }
    }

    /**
     * Switch view between Workspace and Environments Dashboard
     */
    switchView(viewName) {
        this.activeView = viewName;
        const wsView = document.getElementById('view-workspace');
        const envView = document.getElementById('view-environments');
        const navPill = document.getElementById('nav-view-environments-btn');

        if (viewName === 'environments') {
            if (wsView) wsView.classList.add('hidden');
            if (envView) envView.classList.remove('hidden');
            if (navPill) navPill.classList.add('active');
            this.loadEnvironments();
        } else {
            if (envView) envView.classList.add('hidden');
            if (wsView) wsView.classList.remove('hidden');
            if (navPill) navPill.classList.remove('active');
        }

        if (window.lucide) window.lucide.createIcons();
    }

    renderEnvironmentsDashboard() {
        const listEl = document.getElementById('environments-cards-list');
        const quotaEl = document.getElementById('dashboard-quota-text');
        if (quotaEl) {
            quotaEl.textContent = this.quota.text;
        }

        if (!listEl) return;

        if (this.environments.length === 0) {
            listEl.innerHTML = `
                <div class="empty-env-state">
                    <i data-lucide="cloud-off" class="empty-icon"></i>
                    <h3>Nessun ambiente attivo</h3>
                    <p>Crea il tuo primo ambiente cloud con Google Antigravity in pochi secondi.</p>
                    <button class="btn btn-primary" onclick="window.agyEnvironments.openCreateModal()">
                        <i data-lucide="plus"></i> Crea Nuovo Ambiente
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = '';
        this.environments.forEach(env => {
            const isRunning = env.status !== 'stopped';
            const statusClass = isRunning ? 'status-running' : 'status-stopped';
            const statusText = isRunning ? 'Running' : 'Stopped';
            const isCurrent = env.isCurrent;

            html += `
                <div class="env-card ${isCurrent ? 'current-env-card' : ''}" data-env-id="${env.id}">
                    <div class="env-card-header">
                        <div class="env-card-title-group">
                            <h3 class="env-title">${this.escapeHtml(env.name)}</h3>
                            <span class="env-slug">${this.escapeHtml(env.slug || env.url || 'workspace')}</span>
                        </div>
                        <div class="env-card-header-actions">
                            <button class="icon-btn-subtle" title="Elimina Ambiente" onclick="window.agyEnvironments.confirmDelete('${env.id}', '${this.escapeHtml(env.name)}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>

                    <div class="env-status-row">
                        <span class="env-status-indicator ${statusClass}">
                            <span class="status-pulse-dot"></span>
                            <span class="status-label">${statusText}</span>
                        </span>
                        <span class="env-sessions-tag font-mono text-xs">
                            <i data-lucide="message-square" class="inline-icon"></i> ${env.sessionCount || 0} sessioni
                        </span>
                    </div>

                    <div class="env-actions-row">
                        <button class="btn btn-primary env-open-btn" onclick="window.agyEnvironments.openEnvironment('${env.path}')" title="Apri workspace e chat live">
                            <i data-lucide="external-link"></i> Open
                        </button>
                        <button class="btn btn-dark env-action-btn" onclick="window.agyEnvironments.toggleEnvAction('${env.id}', '${env.path}', '${isRunning ? 'stop' : 'start'}')">
                            <i data-lucide="${isRunning ? 'square' : 'play'}"></i> ${isRunning ? 'Stop' : 'Start'}
                        </button>
                        <button class="btn btn-dark env-ssh-btn" onclick="window.agyEnvironments.openSshModal('${env.id}', '${this.escapeHtml(env.name)}')" title="Accesso SSH diretto">
                            <i data-lucide="terminal"></i> SSH
                        </button>
                        <button class="btn btn-dark env-pii-btn" onclick="window.agyEnvironments.openPiiModal('${env.id}', '${this.escapeHtml(env.name)}', '${env.path}')" title="Anonimizza documenti (PII) per questo ambiente">
                            <i data-lucide="shield-check"></i> PII
                        </button>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    async openEnvironment(targetPath) {
        try {
            const res = await fetch('/api/workspaces/switch', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ path: targetPath, runnerMode: 'host' })
            });

            if (res.ok) {
                this.switchView('workspace');
                if (window.agyChat) {
                    window.agyChat.createNewSession();
                }
            }
        } catch (e) {
            console.error('[Environments] Error opening environment:', e);
        }
    }

    async toggleEnvAction(id, envPath, action) {
        try {
            const res = await fetch('/api/workspaces/action', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ id, path: envPath, action })
            });

            if (res.ok) {
                await this.loadEnvironments();
            }
        } catch (e) {
            console.error('[Environments] Error toggling env action:', e);
        }
    }

    async confirmDelete(id, name) {
        if (confirm(`Sei sicuro di voler eliminare l'ambiente "${name}"?`)) {
            try {
                const res = await fetch(`/api/workspaces/${id}`, {
                    method: 'DELETE',
                    headers: this.getAuthHeaders()
                });
                if (res.ok) {
                    await this.loadEnvironments();
                }
            } catch (e) {
                console.error('[Environments] Error deleting env:', e);
            }
        }
    }

    // ==========================================
    // 🪄 3-STEP CREATE ENVIRONMENT WIZARD
    // ==========================================

    openCreateModal() {
        this.currentWizardStep = 1;
        this.selectedStartMode = 'blank';
        const modal = document.getElementById('create-env-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateWizardUi();
            const nameInput = document.getElementById('wizard-project-name');
            if (nameInput) nameInput.value = '';
            const gitInput = document.getElementById('wizard-git-url');
            if (gitInput) gitInput.value = '';
        }
        if (window.lucide) window.lucide.createIcons();
    }

    closeCreateModal() {
        const modal = document.getElementById('create-env-modal');
        if (modal) modal.classList.add('hidden');
    }

    selectStartMode(mode) {
        this.selectedStartMode = mode;
        const blankCard = document.getElementById('wizard-mode-blank');
        const gitCard = document.getElementById('wizard-mode-github');
        const gitInputGroup = document.getElementById('wizard-git-input-group');

        if (mode === 'blank') {
            blankCard?.classList.add('selected');
            gitCard?.classList.remove('selected');
            gitInputGroup?.classList.add('hidden');
        } else {
            gitCard?.classList.add('selected');
            blankCard?.classList.remove('selected');
            gitInputGroup?.classList.remove('hidden');
        }
    }

    wizardNext() {
        if (this.currentWizardStep === 1) {
            if (this.selectedStartMode === 'github') {
                const repoUrl = document.getElementById('wizard-git-url')?.value.trim();
                if (!repoUrl) {
                    alert('Inserisci l\'URL del repository GitHub (es. https://github.com/owner/repo)');
                    return;
                }
            }
            this.currentWizardStep = 2;
            this.updateWizardUi();
            setTimeout(() => document.getElementById('wizard-project-name')?.focus(), 100);
        } else if (this.currentWizardStep === 2) {
            const name = document.getElementById('wizard-project-name')?.value.trim();
            if (!name) {
                alert('Inserisci un nome memorabile per il tuo ambiente');
                return;
            }
            // Auto generate slug
            const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const slug = `${baseSlug || 'project'}-${randomSuffix}`;
            const slugInput = document.getElementById('wizard-slug-input');
            if (slugInput) slugInput.value = slug;

            this.currentWizardStep = 3;
            this.updateWizardUi();
        } else if (this.currentWizardStep === 3) {
            this.submitCreateEnvironment();
        }
    }

    wizardBack() {
        if (this.currentWizardStep > 1) {
            this.currentWizardStep--;
            this.updateWizardUi();
        }
    }

    updateWizardUi() {
        const step1 = document.getElementById('wizard-step-1');
        const step2 = document.getElementById('wizard-step-2');
        const step3 = document.getElementById('wizard-step-3');
        const stepTitle = document.getElementById('wizard-step-indicator');
        const bar1 = document.getElementById('progress-bar-1');
        const bar2 = document.getElementById('progress-bar-2');
        const bar3 = document.getElementById('progress-bar-3');
        const backBtn = document.getElementById('wizard-back-btn');
        const nextBtn = document.getElementById('wizard-next-btn');

        if (stepTitle) stepTitle.textContent = `Step ${this.currentWizardStep} of 3`;

        step1?.classList.toggle('hidden', this.currentWizardStep !== 1);
        step2?.classList.toggle('hidden', this.currentWizardStep !== 2);
        step3?.classList.toggle('hidden', this.currentWizardStep !== 3);

        bar1?.classList.toggle('active', this.currentWizardStep >= 1);
        bar2?.classList.toggle('active', this.currentWizardStep >= 2);
        bar3?.classList.toggle('active', this.currentWizardStep >= 3);

        if (backBtn) {
            backBtn.style.visibility = this.currentWizardStep === 1 ? 'hidden' : 'visible';
        }

        if (nextBtn) {
            if (this.currentWizardStep === 3) {
                nextBtn.innerHTML = '<span>Create Environment</span>';
                nextBtn.className = 'btn btn-primary wizard-submit-btn';
            } else {
                nextBtn.innerHTML = '<span>Next</span>';
                nextBtn.className = 'btn btn-primary';
            }
        }
        if (window.lucide) window.lucide.createIcons();
    }

    async submitCreateEnvironment() {
        const name = document.getElementById('wizard-project-name')?.value.trim();
        const slug = document.getElementById('wizard-slug-input')?.value.trim();
        const repoUrl = document.getElementById('wizard-git-url')?.value.trim();
        const nextBtn = document.getElementById('wizard-next-btn');

        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.innerHTML = '<span class="spinner-inline"></span> Creating environment...';
        }

        try {
            const res = await fetch('/api/workspaces/create', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    name,
                    slug,
                    type: this.selectedStartMode,
                    repoUrl: this.selectedStartMode === 'github' ? repoUrl : null,
                    tools: this.selectedTools,
                    runnerMode: 'host',
                    model: 'gemini-3.7-flash'
                })
            });

            if (res.ok) {
                const data = await res.json();
                this.closeCreateModal();
                await this.loadEnvironments();
                this.switchView('workspace');
                if (window.agyChat) {
                    window.agyChat.createNewSession();
                }
            } else {
                const err = await res.json();
                alert(`Errore nella creazione dell'ambiente: ${err.error || 'Riprova'}`);
            }
        } catch (e) {
            alert(`Errore di rete: ${e.message}`);
        } finally {
            if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.innerHTML = '<span>Create Environment</span>';
            }
        }
    }

    // ==========================================
    // 🛠️ EXTRA TOOLS MODAL
    // ==========================================

    openExtraToolsModal() {
        const modal = document.getElementById('extra-tools-modal');
        const container = document.getElementById('extra-tools-checkboxes');
        if (!modal || !container) return;

        let html = '';
        this.availableTools.forEach(tool => {
            const checked = this.selectedTools.includes(tool);
            html += `
                <label class="tool-checkbox-item">
                    <input type="checkbox" value="${tool}" ${checked ? 'checked' : ''} onchange="window.agyEnvironments.toggleToolSelection('${tool}', this.checked)">
                    <span class="tool-checkbox-label">${tool}</span>
                </label>
            `;
        });
        container.innerHTML = html;
        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    closeExtraToolsModal() {
        const modal = document.getElementById('extra-tools-modal');
        if (modal) modal.classList.add('hidden');
    }

    toggleToolSelection(tool, isChecked) {
        if (isChecked && !this.selectedTools.includes(tool)) {
            this.selectedTools.push(tool);
        } else if (!isChecked) {
            this.selectedTools = this.selectedTools.filter(t => t !== tool);
        }
    }

    // ==========================================
    // 🚀 ONBOARDING SETUP WIZARD (Git + Agents)
    // ==========================================

    async checkOnboarding() {
        try {
            const res = await fetch('/api/settings/onboarding', { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (!data.completed && !localStorage.getItem('agy_onboarding_skipped')) {
                    this.openOnboardingModal();
                }
            }
        } catch (e) {}
    }

    async openOnboardingModal() {
        this.currentOnboardingStep = 1;
        const modal = document.getElementById('onboarding-setup-modal');
        if (!modal) return;

        // Load current git config
        try {
            const res = await fetch('/api/settings/git', { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const nameInput = document.getElementById('onboard-git-name');
                const emailInput = document.getElementById('onboard-git-email');
                if (nameInput) nameInput.value = data.name || 'Proseo';
                if (emailInput) emailInput.value = data.email || 'djabloo@gmail.com';
            }
        } catch (e) {}

        // Load agents status
        await this.loadOnboardingAgents();

        this.updateOnboardingUi();
        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    closeOnboardingModal() {
        const modal = document.getElementById('onboarding-setup-modal');
        if (modal) modal.classList.add('hidden');
        localStorage.setItem('agy_onboarding_skipped', 'true');
    }

    async loadOnboardingAgents() {
        const container = document.getElementById('onboard-agents-list');
        if (!container) return;

        try {
            const res = await fetch('/api/settings/agents', { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                let html = '';
                (data.agents || []).forEach(agent => {
                    const isConnected = agent.status === 'connected';
                    const btnText = isConnected ? 'Configurato ✓' : 'Login';
                    const btnClass = isConnected ? 'btn-connected' : 'btn-login';
                    const agentIcon = agent.id === 'claude-code' ? '✳️' : (agent.id === 'cursor' ? '⬡' : (agent.id === 'antigravity' ? '🪐' : '🌀'));

                    html += `
                        <div class="agent-connect-card">
                            <div class="agent-connect-icon-box">
                                <span class="agent-emoji">${agentIcon}</span>
                            </div>
                            <div class="agent-connect-info">
                                <span class="agent-connect-name">${this.escapeHtml(agent.name)}</span>
                                <span class="agent-connect-sub font-mono text-xs">${this.escapeHtml(agent.statusText)}</span>
                            </div>
                            <button class="btn btn-sm ${btnClass}" onclick="window.agyEnvironments.handleAgentLogin('${agent.id}', '${this.escapeHtml(agent.name)}')">
                                ${btnText}
                            </button>
                        </div>
                    `;
                });
                container.innerHTML = html;
            }
        } catch (e) {
            console.error('[Onboarding] Error loading agents:', e);
        }
    }

    async handleAgentLogin(agentId, agentName) {
        if (agentId === 'antigravity') {
            alert('Google Antigravity CLI è già connesso ed attivo nel sistema.');
            return;
        }

        const token = prompt(`Inserisci la chiave API o il token di autenticazione per ${agentName}:`);
        if (token && token.trim()) {
            try {
                const res = await fetch('/api/settings/agents/login', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ agentId, token: token.trim(), apiKey: token.trim() })
                });
                if (res.ok) {
                    alert(`${agentName} connesso con successo!`);
                    await this.loadOnboardingAgents();
                }
            } catch (e) {
                alert(`Errore durante il login: ${e.message}`);
            }
        }
    }

    onboardingNext() {
        if (this.currentOnboardingStep === 1) {
            // Save git config
            const name = document.getElementById('onboard-git-name')?.value.trim();
            const email = document.getElementById('onboard-git-email')?.value.trim();
            if (!name || !email) {
                alert('Nome ed email sono richiesti per la configurazione Git.');
                return;
            }

            fetch('/api/settings/git', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ name, email })
            });

            this.currentOnboardingStep = 2;
            this.updateOnboardingUi();
        } else if (this.currentOnboardingStep === 2) {
            this.completeOnboarding();
        }
    }

    onboardingPrevious() {
        if (this.currentOnboardingStep > 1) {
            this.currentOnboardingStep--;
            this.updateOnboardingUi();
        }
    }

    updateOnboardingUi() {
        const step1 = document.getElementById('onboard-step-1');
        const step2 = document.getElementById('onboard-step-2');
        const badge1 = document.getElementById('onboard-badge-1');
        const badge2 = document.getElementById('onboard-badge-2');
        const prevBtn = document.getElementById('onboard-prev-btn');
        const nextBtn = document.getElementById('onboard-next-btn');

        step1?.classList.toggle('hidden', this.currentOnboardingStep !== 1);
        step2?.classList.toggle('hidden', this.currentOnboardingStep !== 2);

        if (this.currentOnboardingStep === 1) {
            badge1?.classList.add('active');
            badge1?.classList.remove('completed');
            badge2?.classList.remove('active');
            if (prevBtn) prevBtn.style.visibility = 'hidden';
            if (nextBtn) {
                nextBtn.innerHTML = '<span>Next &gt;</span>';
                nextBtn.className = 'btn btn-primary';
            }
        } else {
            badge1?.classList.remove('active');
            badge1?.classList.add('completed');
            badge2?.classList.add('active');
            if (prevBtn) prevBtn.style.visibility = 'visible';
            if (nextBtn) {
                nextBtn.innerHTML = '<i data-lucide="check"></i> <span>Complete Setup</span>';
                nextBtn.className = 'btn btn-complete-setup';
            }
        }
        if (window.lucide) window.lucide.createIcons();
    }

    async completeOnboarding() {
        try {
            await fetch('/api/settings/onboarding/complete', {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
        } catch (e) {}

        this.closeOnboardingModal();
        this.switchView('workspace');
    }

    // ==========================================
    // ⚙️ SHARED SETUP (TEMPLATE LAYER) MODAL
    // ==========================================

    async openSharedSetupModal() {
        const modal = document.getElementById('shared-setup-modal');
        if (!modal) return;

        try {
            const res = await fetch('/api/settings/shared-setup', { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const setup = data.sharedSetup || {};
                const skillsList = document.getElementById('shared-skills-list');
                const mcpList = document.getElementById('shared-mcp-list');

                if (skillsList) {
                    skillsList.innerHTML = (setup.skills || []).map(s => `
                        <div class="shared-chip-item">
                            <span class="chip-name">✨ ${this.escapeHtml(s.name)}</span>
                            <span class="chip-desc font-mono text-xs">${this.escapeHtml(s.description || '')}</span>
                        </div>
                    `).join('');
                }

                if (mcpList) {
                    mcpList.innerHTML = (setup.mcpServers || []).map(m => `
                        <div class="shared-chip-item">
                            <span class="chip-name">🔌 ${this.escapeHtml(m.name)}</span>
                            <span class="chip-desc font-mono text-xs">${this.escapeHtml(m.command || '')}</span>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            console.error('[SharedSetup] Error:', e);
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    closeSharedSetupModal() {
        const modal = document.getElementById('shared-setup-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ==========================================
    // 💻 SSH CONNECTION MODAL
    // ==========================================

    async openSshModal(envId, envName) {
        const modal = document.getElementById('ssh-connect-modal');
        if (!modal) return;

        try {
            const res = await fetch('/api/workspaces/ssh-info', { headers: this.getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                const cmdEl = document.getElementById('ssh-command-code');
                const titleEl = document.getElementById('ssh-modal-env-title');
                if (titleEl) titleEl.textContent = `SSH: ${envName}`;
                if (cmdEl) cmdEl.textContent = data.command || 'ssh tino@agy.proseo.it';
            }
        } catch (e) {
            console.error('[SSH] Error:', e);
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    closeSshModal() {
        const modal = document.getElementById('ssh-connect-modal');
        if (modal) modal.classList.add('hidden');
    }

    copySshCommand() {
        const codeEl = document.getElementById('ssh-command-code');
        if (codeEl) {
            navigator.clipboard.writeText(codeEl.textContent.trim()).then(() => {
                const btn = document.getElementById('ssh-copy-btn');
                if (btn) {
                    btn.innerHTML = '<i data-lucide="check"></i> Copiato!';
                    if (window.lucide) window.lucide.createIcons();
                    setTimeout(() => {
                        btn.innerHTML = '<i data-lucide="copy"></i> Copia Comando';
                        if (window.lucide) window.lucide.createIcons();
                    }, 2000);
                }
            });
        }
    }

    launchWebSsh() {
        this.closeSshModal();
        if (window.agyApp) {
            window.agyApp.switchTab('terminal-tab');
        }
    }

    // ==========================================
    // 🛡️ PII REDACTION MODAL (rizzo-pii)
    // ==========================================

    async openPiiModal(envId, envName, envPath) {
        const modal = document.getElementById('pii-redact-modal');
        if (!modal) return;

        this.piiTargetPath = envPath;

        const titleEl = document.getElementById('pii-modal-env-title');
        if (titleEl) titleEl.textContent = `Anonimizza Documenti — ${envName}`;

        const fileInput = document.getElementById('pii-file-input');
        if (fileInput) fileInput.value = '';
        document.getElementById('pii-result-box')?.classList.add('hidden');
        document.getElementById('pii-error-box')?.classList.add('hidden');
        document.getElementById('pii-unavailable-notice')?.classList.add('hidden');

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();

        try {
            const res = await fetch('/api/pii/health', { headers: this.getAuthHeaders() });
            if (!res.ok) {
                document.getElementById('pii-unavailable-notice')?.classList.remove('hidden');
            }
        } catch (e) {
            document.getElementById('pii-unavailable-notice')?.classList.remove('hidden');
        }
    }

    closePiiModal() {
        const modal = document.getElementById('pii-redact-modal');
        if (modal) modal.classList.add('hidden');
        this.piiTargetPath = null;
    }

    async submitPiiRedact() {
        const fileInput = document.getElementById('pii-file-input');
        const resultBox = document.getElementById('pii-result-box');
        const errorBox = document.getElementById('pii-error-box');
        const submitBtn = document.getElementById('pii-submit-btn');

        resultBox?.classList.add('hidden');
        errorBox?.classList.add('hidden');

        const file = fileInput?.files?.[0];
        if (!file) {
            if (errorBox) {
                errorBox.textContent = 'Seleziona prima un file (.pdf, .txt o .md).';
                errorBox.classList.remove('hidden');
            }
            return;
        }
        if (!this.piiTargetPath) {
            if (errorBox) {
                errorBox.textContent = 'Ambiente non valido.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader"></i> Anonimizzazione in corso...';
            if (window.lucide) window.lucide.createIcons();
        }

        try {
            const buffer = await file.arrayBuffer();
            const headers = this.getAuthHeaders();
            headers['X-File-Name'] = encodeURIComponent(file.name);
            headers['X-Workspace-Path'] = encodeURIComponent(this.piiTargetPath);
            headers['Content-Type'] = 'application/octet-stream';

            const res = await fetch('/api/pii/redact', {
                method: 'POST',
                headers,
                body: buffer
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Errore ${res.status}`);
            }

            if (resultBox) {
                resultBox.textContent = `Fatto: salvato come "${data.path}" (${(data.size / 1024).toFixed(1)} KB), pronto per l'agente.`;
                resultBox.classList.remove('hidden');
            }
            if (fileInput) fileInput.value = '';
        } catch (e) {
            if (errorBox) {
                errorBox.textContent = e.message || 'Errore durante l\'anonimizzazione.';
                errorBox.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="shield-check"></i> Anonimizza e Salva';
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }

    // ==========================================
    // SHORTCUTS & HELPERS
    // ==========================================

    setupGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K / Cmd+K Quick search
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('session-search-input') || document.getElementById('chat-prompt-input');
                if (searchInput) {
                    searchInput.focus();
                    if (searchInput.select) searchInput.select();
                }
            }
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    injectModalsHtml() {
        // Only inject if not already present
        if (document.getElementById('create-env-modal')) return;

        const container = document.createElement('div');
        container.id = 'environments-modals-container';
        container.innerHTML = `
            <!-- 3-STEP CREATE ENVIRONMENT WIZARD MODAL -->
            <div id="create-env-modal" class="modal hidden">
                <div class="modal-card modal-env-wizard">
                    <div class="wizard-header">
                        <div class="wizard-header-top">
                            <h2 class="wizard-main-title font-display">Create Environment</h2>
                            <button class="icon-btn close-modal-btn" onclick="window.agyEnvironments.closeCreateModal()">
                                <i data-lucide="x"></i>
                            </button>
                        </div>
                        <div class="wizard-progress-bar-container">
                            <div class="wizard-progress-segments">
                                <div id="progress-bar-1" class="progress-segment active"></div>
                                <div id="progress-bar-2" class="progress-segment"></div>
                                <div id="progress-bar-3" class="progress-segment"></div>
                            </div>
                            <span id="wizard-step-indicator" class="wizard-step-text font-mono">Step 1 of 3</span>
                        </div>
                    </div>

                    <div class="wizard-body">
                        <!-- STEP 1: How would you like to start? -->
                        <div id="wizard-step-1" class="wizard-step-content">
                            <h3 class="wizard-section-title font-display">How would you like to start?</h3>
                            <p class="wizard-section-desc">Create a new blank project or import an existing one from GitHub</p>

                            <div class="wizard-cards-grid">
                                <div id="wizard-mode-blank" class="wizard-choice-card selected" onclick="window.agyEnvironments.selectStartMode('blank')">
                                    <div class="choice-icon-box">
                                        <i data-lucide="plus"></i>
                                    </div>
                                    <div class="choice-info">
                                        <h4 class="choice-title">New Project</h4>
                                        <p class="choice-desc">Start with a blank workspace</p>
                                    </div>
                                </div>

                                <div id="wizard-mode-github" class="wizard-choice-card" onclick="window.agyEnvironments.selectStartMode('github')">
                                    <div class="choice-icon-box">
                                        <i data-lucide="download"></i>
                                    </div>
                                    <div class="choice-info">
                                        <h4 class="choice-title">Import from GitHub</h4>
                                        <p class="choice-desc">Clone an existing repository</p>
                                    </div>
                                </div>
                            </div>

                            <div id="wizard-git-input-group" class="form-group hidden" style="margin-top: 16px;">
                                <label class="form-label font-mono text-xs">URL Repository GitHub *</label>
                                <input type="text" id="wizard-git-url" placeholder="https://github.com/username/my-project" class="form-input">
                            </div>
                        </div>

                        <!-- STEP 2: Name Your Project -->
                        <div id="wizard-step-2" class="wizard-step-content hidden">
                            <h3 class="wizard-section-title font-display">Name Your Project</h3>
                            <p class="wizard-section-desc">Give your development environment a memorable name</p>

                            <div class="form-group" style="margin-top: 18px;">
                                <label class="form-label font-mono text-xs">Project Name</label>
                                <input type="text" id="wizard-project-name" placeholder="es. Prova ino, E-commerce Bot" class="form-input font-display text-lg" autofocus>
                            </div>
                        </div>

                        <!-- STEP 3: Environment Settings -->
                        <div id="wizard-step-3" class="wizard-step-content hidden">
                            <h3 class="wizard-section-title font-display">Environment Settings</h3>
                            <p class="wizard-section-desc">Confirm the folder identifier and optionally note project-specific tools.</p>

                            <div class="form-group" style="margin-top: 16px;">
                                <label class="form-label font-mono text-xs">Slug - used as the local project folder name.</label>
                                <div class="url-input-wrapper">
                                    <input type="text" id="wizard-slug-input" placeholder="project-slug" class="form-input font-mono">
                                </div>
                                <div class="url-status-badge">
                                    <i data-lucide="check-circle-2" class="text-success"></i>
                                    <span class="text-success font-mono text-xs">Available</span>
                                </div>
                            </div>

                            <div class="software-summary-box">
                                <label class="form-label font-mono text-xs">Software</label>
                                <p class="software-desc-text font-mono text-xs text-muted">
                                    Runs directly on this machine (host mode): whatever is already installed here, plus Google Antigravity CLI (agy).
                                </p>
                                <button type="button" class="add-tools-link-btn" onclick="window.agyEnvironments.openExtraToolsModal()">
                                    <i data-lucide="plus"></i> Add extra tools
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="wizard-footer">
                        <button id="wizard-back-btn" class="btn btn-outline" onclick="window.agyEnvironments.wizardBack()" style="visibility: hidden;">
                            Back
                        </button>
                        <button id="wizard-next-btn" class="btn btn-primary" onclick="window.agyEnvironments.wizardNext()">
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <!-- EXTRA TOOLS MODAL -->
            <div id="extra-tools-modal" class="modal hidden">
                <div class="modal-card">
                    <div class="modal-header">
                        <i data-lucide="wrench"></i>
                        <h2>Strumenti & Pacchetti Aggiuntivi</h2>
                        <button class="icon-btn close-modal-btn" onclick="window.agyEnvironments.closeExtraToolsModal()">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <p class="text-muted text-xs">Seleziona i pacchetti software da pre-installare nel tuo ambiente:</p>
                    <div id="extra-tools-checkboxes" class="tools-grid-list"></div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="window.agyEnvironments.closeExtraToolsModal()">Conferma</button>
                    </div>
                </div>
            </div>

            <!-- ONBOARDING SETUP MODAL (Git Config + Connect Agents) -->
            <div id="onboarding-setup-modal" class="modal hidden">
                <div class="modal-card modal-onboarding">
                    <div class="onboarding-top-bar">
                        <span class="onboarding-brand font-display">AGY UI</span>
                        <button class="icon-btn close-modal-btn" onclick="window.agyEnvironments.closeOnboardingModal()">
                            <i data-lucide="x"></i>
                        </button>
                    </div>

                    <div class="onboarding-stepper-row">
                        <div id="onboard-badge-1" class="onboard-step-badge active">
                            <div class="badge-icon-circle"><i data-lucide="git-branch"></i></div>
                            <div class="badge-text-group">
                                <span class="badge-step-title">Git Configuration</span>
                                <span class="badge-step-sub text-danger font-mono text-[10px]">Required</span>
                            </div>
                        </div>
                        <div class="onboard-stepper-line"></div>
                        <div id="onboard-badge-2" class="onboard-step-badge">
                            <div class="badge-icon-circle"><i data-lucide="log-in"></i></div>
                            <div class="badge-text-group">
                                <span class="badge-step-title">Connect Agents</span>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 1: Git Configuration -->
                    <div id="onboard-step-1" class="onboard-card-inner">
                        <div class="step-hero-icon">
                            <i data-lucide="git-branch"></i>
                        </div>
                        <h2 class="onboard-title font-display">Git Configuration</h2>
                        <p class="onboard-desc">Configure your git identity to ensure proper attribution for commits.</p>

                        <div class="form-group">
                            <label class="form-label font-mono text-xs"><i data-lucide="user"></i> Git Name *</label>
                            <input type="text" id="onboard-git-name" placeholder="Proseo" class="form-input">
                            <span class="input-hint font-mono text-[11px] text-muted">Saved as 'git config --global user.name'</span>
                        </div>

                        <div class="form-group" style="margin-top: 14px;">
                            <label class="form-label font-mono text-xs"><i data-lucide="mail"></i> Git Email *</label>
                            <input type="email" id="onboard-git-email" placeholder="djabloo@gmail.com" class="form-input">
                            <span class="input-hint font-mono text-[11px] text-muted">Saved as 'git config --global user.email'</span>
                        </div>
                    </div>

                    <!-- STEP 2: Connect AI Agents -->
                    <div id="onboard-step-2" class="onboard-card-inner hidden">
                        <h2 class="onboard-title font-display">Connect Your AI Agents</h2>
                        <p class="onboard-desc">Login to one or more AI coding assistants. All are optional.</p>

                        <div id="onboard-agents-list" class="onboard-agents-list"></div>

                        <p class="text-center font-mono text-xs text-muted" style="margin-top: 12px;">
                            You can configure these later in Settings.
                        </p>
                    </div>

                    <div class="onboard-footer">
                        <button id="onboard-prev-btn" class="btn btn-outline" onclick="window.agyEnvironments.onboardingPrevious()" style="visibility: hidden;">
                            &lt; Previous
                        </button>
                        <button id="onboard-next-btn" class="btn btn-primary" onclick="window.agyEnvironments.onboardingNext()">
                            Next &gt;
                        </button>
                    </div>
                </div>
            </div>

            <!-- SHARED SETUP MODAL (Template Layer) -->
            <div id="shared-setup-modal" class="modal hidden">
                <div class="modal-card modal-lg">
                    <div class="modal-header">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i data-lucide="layers" class="text-accent"></i>
                            <h2>Shared Setup <span class="badge-template font-mono text-[10px]">Template layer</span></h2>
                        </div>
                        <button class="icon-btn close-modal-btn" onclick="window.agyEnvironments.closeSharedSetupModal()">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <p class="text-muted text-xs">Configure shared skills and MCP servers for users or the whole organization.</p>

                    <div class="shared-section-block">
                        <h4 class="font-display font-bold text-sm" style="margin-bottom: 8px;">🪄 Shared Skills</h4>
                        <div id="shared-skills-list" class="shared-chips-container"></div>
                    </div>

                    <div class="shared-section-block" style="margin-top: 16px;">
                        <h4 class="font-display font-bold text-sm" style="margin-bottom: 8px;">🔌 Shared MCP Servers</h4>
                        <div id="shared-mcp-list" class="shared-chips-container"></div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="window.agyEnvironments.closeSharedSetupModal()">Chiudi</button>
                        <button class="btn btn-primary" onclick="window.agyApp.switchTab('settings-tab'); window.agyEnvironments.closeSharedSetupModal();">Modifica in Impostazioni</button>
                    </div>
                </div>
            </div>

            <!-- SSH CONNECT MODAL -->
            <div id="ssh-connect-modal" class="modal hidden">
                <div class="modal-card">
                    <div class="modal-header">
                        <i data-lucide="terminal" class="text-accent"></i>
                        <h2 id="ssh-modal-env-title">Accesso SSH</h2>
                        <button class="icon-btn close-modal-btn" onclick="window.agyEnvironments.closeSshModal()">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <p class="text-muted text-xs">Connettiti direttamente tramite il terminale dal tuo computer o apri la web console:</p>

                    <div class="ssh-code-box">
                        <pre><code id="ssh-command-code">ssh tino@agy.proseo.it -p 22</code></pre>
                    </div>

                    <div class="modal-footer" style="display:flex; justify-content:space-between; width:100%;">
                        <button id="ssh-copy-btn" class="btn btn-outline" onclick="window.agyEnvironments.copySshCommand()">
                            <i data-lucide="copy"></i> Copia Comando
                        </button>
                        <button class="btn btn-primary" onclick="window.agyEnvironments.launchWebSsh()">
                            <i data-lucide="external-link"></i> Apri Web Terminal
                        </button>
                    </div>
                </div>
            </div>

            <!-- PII REDACTION MODAL (rizzo-pii) -->
            <div id="pii-redact-modal" class="modal hidden">
                <div class="modal-card">
                    <div class="modal-header">
                        <i data-lucide="shield-check" class="text-accent"></i>
                        <h2 id="pii-modal-env-title">Anonimizza Documenti</h2>
                        <button class="icon-btn close-modal-btn" onclick="window.agyEnvironments.closePiiModal()">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <p class="text-muted text-xs">
                        Carica un PDF, un .txt o un .md: i dati personali (nomi, CF, IBAN, indirizzi...)
                        vengono rilevati ed oscurati in locale, senza uscire da questa macchina.
                        Il file censurato viene salvato in <code>pii-clean/</code> nell'ambiente, pronto per l'agente.
                    </p>

                    <div id="pii-unavailable-notice" class="hidden" style="margin:10px 0; padding:10px; border-radius:8px; background:rgba(220,38,38,0.1); color:#dc2626; font-size:12px;">
                        Servizio di anonimizzazione non raggiungibile al momento.
                    </div>

                    <div class="form-group" style="margin-top:10px;">
                        <input type="file" id="pii-file-input" accept=".pdf,.txt,.md" class="form-input">
                    </div>

                    <div id="pii-result-box" class="hidden" style="margin-top:10px; padding:10px; border-radius:8px; background:rgba(16,185,129,0.1); color:#059669; font-size:12px;"></div>
                    <div id="pii-error-box" class="hidden" style="margin-top:10px; padding:10px; border-radius:8px; background:rgba(220,38,38,0.1); color:#dc2626; font-size:12px;"></div>

                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="window.agyEnvironments.closePiiModal()">Chiudi</button>
                        <button id="pii-submit-btn" class="btn btn-primary" onclick="window.agyEnvironments.submitPiiRedact()">
                            <i data-lucide="shield-check"></i> Anonimizza e Salva
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);
    }
}

window.agyEnvironments = new AgyEnvironments();
