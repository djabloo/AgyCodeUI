/**
 * AGYUI - Sidebar Modules (Projects Switcher, Agents & Personas, Workflows & Pipelines)
 */

class AgySidebarModules {
    constructor() {
        this.workspaces = [];
        this.currentWorkspace = null;
        this.agents = [];
        this.activeAgentId = 'master';
        this.workflows = [];

        // DOM elements
        this.workspacesContainerEl = document.getElementById('sidebar-projects-list');
        this.agentsContainerEl = document.getElementById('sidebar-agents-list');
        this.workflowsContainerEl = document.getElementById('sidebar-workflows-list');
        this.activeWorkspacePillEl = document.getElementById('active-workspace-pill');
        this.activeAgentPillEl = document.getElementById('active-agent-pill');
    }

    async init() {
        this.setupAccordionToggles();
        await Promise.all([
            this.loadWorkspaces(),
            this.loadAgents(),
            this.loadWorkflows()
        ]);

        // Listen for language changes
        window.addEventListener('agy-lang-changed', () => {
            this.renderWorkspaces();
            this.renderAgents();
            this.renderWorkflows();
        });
    }

    /**
     * Setup accordion expand/collapse behavior
     */
    setupAccordionToggles() {
        document.querySelectorAll('.sidebar-accordion-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const section = header.closest('.sidebar-accordion-section');
                if (section) {
                    const isExpanded = section.classList.toggle('expanded');
                    const chevron = header.querySelector('.accordion-chevron');
                    if (chevron) {
                        chevron.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                }
            });
        });
    }

    // ==========================================
    // 📁 1. WORKSPACES & PROJECTS
    // ==========================================

    async loadWorkspaces() {
        try {
            const token = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/workspaces', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.workspaces = data.workspaces || [];
                this.currentWorkspace = data.current || null;
                this.renderWorkspaces();
            }
        } catch (e) {
            console.error('[Sidebar] Error loading workspaces:', e.message);
        }
    }

    renderWorkspaces() {
        if (!this.workspacesContainerEl) return;
        const i18n = window.agyI18n;

        if (this.activeWorkspacePillEl && this.currentWorkspace) {
            this.activeWorkspacePillEl.textContent = this.currentWorkspace.name;
        }

        let html = `
            <div class="projects-list-wrapper">
                <div class="current-project-banner">
                    <div class="project-info">
                        <i data-lucide="folder-git-2" class="project-icon"></i>
                        <div class="project-meta">
                            <span class="project-label">${i18n ? i18n.t('currentWorkspace') : 'Workspace Attivo'}</span>
                            <span class="project-name">${this.currentWorkspace ? this.currentWorkspace.name : '~'}</span>
                            <span class="project-path" title="${this.currentWorkspace ? this.currentWorkspace.path : ''}">${this.currentWorkspace ? this.currentWorkspace.path : ''}</span>
                        </div>
                    </div>
                    ${this.currentWorkspace?.gitBranch ? `<span class="git-badge"><i data-lucide="git-branch"></i> ${this.currentWorkspace.gitBranch}</span>` : ''}
                </div>

                <div class="projects-select-group">
                    <label class="projects-group-label">Disponibili sul Server (${this.workspaces.length}):</label>
                    <div class="projects-chips-grid">
        `;

        this.workspaces.forEach(ws => {
            const isCurrent = ws.isCurrent;
            html += `
                <button class="project-chip ${isCurrent ? 'active' : ''}" onclick="window.agySidebar.switchWorkspace('${encodeURIComponent(ws.path)}')">
                    <div class="project-chip-left">
                        <span class="project-dot ${isCurrent ? 'active' : ''}"></span>
                        <span class="project-chip-name">${ws.name}</span>
                    </div>
                    ${ws.gitBranch ? `<span class="project-chip-git">${ws.gitBranch}</span>` : ''}
                </button>
            `;
        });

        html += `
                    </div>
                    <button class="btn btn-sm btn-outline btn-block add-ws-btn" onclick="window.agySidebar.promptAddWorkspace()">
                        <i data-lucide="folder-plus"></i> ${i18n ? i18n.t('addWorkspaceBtn') : 'Aggiungi Cartella...'}
                    </button>
                </div>
            </div>
        `;

        this.workspacesContainerEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    async switchWorkspace(encodedPath) {
        const targetPath = decodeURIComponent(encodedPath);
        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/workspaces/switch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ path: targetPath })
            });

            if (res.ok) {
                await this.loadWorkspaces();
                if (window.agyFiles) window.agyFiles.refresh();
                if (window.agyChat) {
                    window.agyChat.insertPrompt(`Switched workspace to: ${targetPath}`);
                }
            } else {
                const err = await res.json();
                alert('Errore cambio workspace: ' + (err.error || 'Cartella non valida'));
            }
        } catch (e) {
            console.error('[Sidebar] Error switching workspace:', e.message);
        }
    }

    async promptAddWorkspace() {
        const customPath = prompt('Inserisci il percorso assoluto della cartella del progetto da aggiungere (es. /opt/nuovo-progetto):');
        if (!customPath) return;

        const token = localStorage.getItem('agy_pin') || '';
        try {
            const res = await fetch('/api/workspaces/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({ path: customPath.trim() })
            });

            if (res.ok) {
                await this.loadWorkspaces();
                await this.switchWorkspace(encodeURIComponent(customPath.trim()));
            } else {
                const err = await res.json();
                alert('Errore: ' + (err.error || 'Impossibile aggiungere la cartella'));
            }
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    // ==========================================
    // 🤖 2. AGENTS & PERSONAS
    // ==========================================

    async loadAgents() {
        try {
            const token = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/agents', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.agents = data.agents || [];
                this.activeAgentId = data.activeAgentId || 'master';
                this.renderAgents();
            }
        } catch (e) {
            console.error('[Sidebar] Error loading agents:', e.message);
        }
    }

    renderAgents() {
        if (!this.agentsContainerEl) return;
        const i18n = window.agyI18n;

        let html = `
            <div class="agents-grid">
        `;

        this.agents.forEach(agent => {
            const isActive = agent.id === this.activeAgentId;
            html += `
                <div class="agent-card ${isActive ? 'active' : ''}" onclick="window.agySidebar.selectAgent('${agent.id}')">
                    <div class="agent-card-header">
                        <div class="agent-avatar" style="background-color: ${agent.color}20; color: ${agent.color}; border-color: ${agent.color}40;">
                            <i data-lucide="${agent.icon || 'bot'}"></i>
                        </div>
                        <div class="agent-title-info">
                            <span class="agent-name">${agent.name}</span>
                            <span class="agent-role">${agent.role}</span>
                        </div>
                    </div>
                    <p class="agent-desc">${agent.description}</p>
                    <div class="agent-footer">
                        <span class="agent-status-badge ${isActive ? 'active' : ''}">
                            ${isActive ? (i18n ? i18n.t('activeBadge') : 'Attivo') : (i18n ? i18n.t('invokeAgent') : 'Seleziona')}
                        </span>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
        `;

        this.agentsContainerEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    selectAgent(agentId) {
        this.activeAgentId = agentId;
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;

        this.renderAgents();

        if (this.activeAgentPillEl) {
            this.activeAgentPillEl.textContent = agent.name;
        }

        // Send persona prompt context to chat
        if (window.agyChat) {
            if (agent.promptPrefix) {
                window.agyChat.insertPrompt(agent.promptPrefix);
            } else {
                window.agyChat.insertPrompt('');
            }
            window.agyApp.switchTab('chat-tab');
        }
    }

    // ==========================================
    // ⚡ 3. WORKFLOWS & AUTOMATIONS
    // ==========================================

    async loadWorkflows() {
        try {
            const token = localStorage.getItem('agy_pin') || '';
            const res = await fetch('/api/workflows', {
                headers: { 'Authorization': token }
            });
            if (res.ok) {
                const data = await res.json();
                this.workflows = data.workflows || [];
                this.renderWorkflows();
            }
        } catch (e) {
            console.error('[Sidebar] Error loading workflows:', e.message);
        }
    }

    renderWorkflows() {
        if (!this.workflowsContainerEl) return;
        const i18n = window.agyI18n;

        let html = `
            <div class="workflows-list">
        `;

        this.workflows.forEach(wf => {
            html += `
                <div class="workflow-card" onclick="window.agySidebar.runWorkflow('${wf.id}')">
                    <div class="workflow-card-top">
                        <div class="workflow-icon" style="background-color: ${wf.color}20; color: ${wf.color};">
                            <i data-lucide="${wf.icon || 'play'}"></i>
                        </div>
                        <div class="workflow-info">
                            <span class="workflow-title">${wf.title}</span>
                            <span class="workflow-category">${wf.category}</span>
                        </div>
                        <button class="workflow-run-btn" title="Esegui Workflow">
                            <i data-lucide="play"></i>
                        </button>
                    </div>
                    <p class="workflow-desc">${wf.description}</p>
                </div>
            `;
        });

        html += `
            </div>
        `;

        this.workflowsContainerEl.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    runWorkflow(workflowId) {
        const wf = this.workflows.find(w => w.id === workflowId);
        if (!wf) return;

        if (window.agyChat) {
            window.agyChat.sendPrompt(wf.prompt);
            window.agyApp.switchTab('chat-tab');
            window.agyChat.closeSidebar();
        }
    }
}

window.agySidebar = new AgySidebarModules();
