/**
 * AGYUI - Multi-language Internationalization (i18n) Engine
 * Supports Italian (IT) and English (EN) with live DOM translation & persistence
 */

const AGY_TRANSLATIONS = {
    it: {
        // App Header & Global
        appTitle: 'AGYUI — Antigravity Code UI',
        connected: 'Connesso ad AGY',
        disconnected: 'Disconnesso',
        authRequired: 'Autenticazione Richiesta',
        authError: 'PIN errato. Riprova.',
        authPinPlaceholder: 'Inserisci PIN',
        loginBtn: 'Accedi',
        restartBtnTitle: 'Riavvia Sessione CLI',
        settingsBtnTitle: 'Impostazioni',
        langSwitchTitle: 'Cambia lingua / Switch language',
        
        // Navigation Tabs
        navChat: 'Chat',
        navTerminal: 'Terminale',
        navFiles: 'File',
        navPrompts: 'Prompt',
        navSettings: 'Impostazioni',
        
        // Drawer Accordion Headers
        sectionProjects: 'Progetti & Workspace',
        sectionAgents: 'Agenti & Subagenti',
        sectionWorkflows: 'Flussi di Lavoro',
        sectionSessions: 'Sessioni Recenti',
        
        // Projects / Workspaces
        currentWorkspace: 'Workspace Attivo',
        switchWorkspaceBtn: 'Cambia',
        addWorkspaceBtn: 'Aggiungi Cartella...',
        noGitBranch: 'Nessun branch git',
        
        // Agents
        activeAgent: 'Agente Attivo',
        invokeAgent: 'Invoca',
        selectPersona: 'Seleziona Persona',
        
        // Workflows
        runWorkflow: 'Esegui',
        workflowGit: 'Git Review & Commit',
        workflowTest: 'Auto Test & Fix',
        workflowAudit: 'Security & Secret Scan',
        workflowN8n: 'Dispatcia Webhook n8n',
        workflowGoal: 'Autonomous Goal',
        workflowDocs: 'Generatore Documentazione API',
        
        // Chat
        newChatBtn: 'Nuova Chat',
        searchSessionsPlaceholder: 'Cerca sessione...',
        noSessionsFound: 'Nessuna sessione trovata',
        switchToTerminal: 'Passa a Terminale',
        newMessages: 'Nuovi messaggi',
        chatInputPlaceholder: 'Invia istruzione ad Antigravity Agent... (es. /model, /plan, /goal)',
        voiceTitle: 'Dettatura vocale (Voice-to-Text)',
        sendPromptTitle: 'Invia Prompt',
        you: 'Tu',
        agentName: 'Antigravity Agent',
        copyCode: 'Copia',
        codeCopied: 'Copiato!',
        renameSessionPrompt: 'Nuovo titolo per la sessione:',
        deleteSessionConfirm: 'Vuoi davvero eliminare questa sessione?',
        
        // Quick Action Chips
        chipGoal: '/goal (Autonomo)',
        chipPlan: '/plan (Pianifica)',
        chipModel: '/model (Scegli Modello)',
        chipBrowser: '/browser (Web)',
        chipGitStatus: 'Git Status',
        chipHelp: '/help (Aiuto)',
        
        // Terminal Quick Actions
        btnYes: 'Sì (y)',
        btnNo: 'No (n)',
        btnEnter: 'Invio',
        btnCtrlC: 'Ctrl+C',
        terminalInputPlaceholder: 'Invia al terminale interattivo...',
        
        // Files Tab
        filesTitle: 'File Explorer',
        refreshFilesTitle: 'Aggiorna File',
        useInPrompt: 'Usa nel Prompt',
        copyPath: 'Copia Percorso',
        closeViewer: 'Chiudi',
        
        // Quick Prompts Tab
        promptsHeader: 'Template e Istruzioni Rapide',
        promptsSubtitle: 'Tocca una card per inviare subito il comando ad Antigravity:',
        promptGitTitle: 'Git Status & History',
        promptGitDesc: 'Verifica le modifiche non committate e il log dei commit recenti.',
        promptTestTitle: 'Run Tests & Fix',
        promptTestDesc: 'Lancia i test di unità/integrazione e propone i fix.',
        promptGoalTitle: '/goal (Modalità Autonoma)',
        promptGoalDesc: 'Avvia la modalità autonoma approfondita senza fermarsi fino al completamento.',
        promptPlanTitle: '/plan (Pianificazione Step-by-Step)',
        promptPlanDesc: 'Pianifica un\'attività complessa creando uno schema dettagliato prima dell\'esecuzione.',
        promptReviewTitle: 'Code Review',
        promptReviewDesc: 'Analisi approfondita della qualità del codice e suggerimenti di refactoring.',
        promptBrowserTitle: '/browser (Interazione Web)',
        promptBrowserDesc: 'Cerca informazioni online o interagisci con pagine web e documentazione.',
        
        // Settings Sections
        settingsAccount: 'Account & Modelli',
        settingsMcp: 'Server MCP',
        settingsPermissions: 'Permessi & Sicurezza',
        settingsSkills: 'Skills',
        settingsPlugins: 'Plugin',
        settingsLanguage: 'Lingua / Language',
        
        // Settings: Account & Models
        settingsAccountTitle: '🤖 Account & Modelli Antigravity',
        settingsAccountSubtitle: 'Scegli il modello di intelligenza artificiale attivo e il livello di ragionamento (Thinking Effort).',
        reasoningEffortTitle: 'Livello di Ragionamento (Reasoning Effort)',
        reasoningEffortDesc: 'Controlla la profondità del pensiero analitico per la risoluzione dei problemi complessi.',
        effortHigh: 'High (Massima accuratezza e ragionamento profondo)',
        effortMedium: 'Medium (Bilanciato per task ordinari)',
        effortLow: 'Low (Più veloce per operazioni semplici)',
        availableModelsTitle: 'Modelli Disponibili',
        availableModelsDesc: 'Tocca un modello per impostarlo come predefinito per la CLI:',
        activeBadge: 'Attivo',
        
        // Settings: MCP
        mcpTitle: '🔌 Server MCP (Model Context Protocol)',
        mcpSubtitle: 'Connetti server MCP locali o remoti per estendere le capacità dell\'agente con tool dedicati.',
        addMcpBtn: 'Aggiungi Server MCP',
        mcpTemplatesTitle: 'Template Rapidi MCP Popolari',
        
        // Settings: Permissions
        permTitle: '🛡️ Permessi & Sicurezza',
        permSubtitle: 'Configura i permessi di esecuzione per la CLI Antigravity e l\'autenticazione dell\'interfaccia web.',
        permPinTitle: 'PIN di Accesso Web UI',
        permPinDesc: 'Protegge agycodeui dall\'accesso non autorizzato da smartphone o browser remoto.',
        permWorkspaceTitle: 'Cartella di Lavoro Iniziale (WORKSPACE_DIR)',
        permWorkspaceDesc: 'Directory root in cui Antigravity CLI e il file explorer operano.',
        permCliTitle: 'Modalità Esecuzione e Permessi CLI',
        permSkipLabel: 'Auto-approva tutti i permessi degli strumenti (--dangerously-skip-permissions)',
        permSkipDesc: 'Consente all\'agente di eseguire comandi bash, creare ed editare file senza chiedere conferma interattiva (y/n).',
        permSandboxLabel: 'Modalità Sandbox (--sandbox)',
        permSandboxDesc: 'Esegue l\'agente all\'interno di un ambiente ristretto con limitazioni sul terminale.',
        saveSettingsBtn: 'Salva Impostazioni',
        
        // Settings: Skills & Plugins
        skillsTitle: '🧠 Skills Antigravity',
        skillsSubtitle: 'Le skill estendono le capacità dell\'agente con procedure, linee guida e playbook di sviluppo specializzati.',
        createSkillBtn: 'Crea Nuova Skill',
        pluginsTitle: '🧩 Plugin Antigravity',
        pluginsSubtitle: 'Importa o installa plugin da marketplace o da configurazioni Gemini/Claude esistenti.',
        importGeminiBtn: 'Importa da Gemini',
        installPluginBtn: 'Installa Plugin'
    },
    
    en: {
        // App Header & Global
        appTitle: 'AGYUI — Antigravity Code UI',
        connected: 'Connected to AGY',
        disconnected: 'Disconnected',
        authRequired: 'Authentication Required',
        authError: 'Incorrect PIN. Please try again.',
        authPinPlaceholder: 'Enter PIN',
        loginBtn: 'Sign In',
        restartBtnTitle: 'Restart CLI Session',
        settingsBtnTitle: 'Settings',
        langSwitchTitle: 'Switch language / Cambia lingua',
        
        // Navigation Tabs
        navChat: 'Chat',
        navTerminal: 'Terminal',
        navFiles: 'Files',
        navPrompts: 'Prompts',
        navSettings: 'Settings',
        
        // Drawer Accordion Headers
        sectionProjects: 'Projects & Workspaces',
        sectionAgents: 'Agents & Personas',
        sectionWorkflows: 'Workflows & Automation',
        sectionSessions: 'Recent Chats',
        
        // Projects / Workspaces
        currentWorkspace: 'Active Workspace',
        switchWorkspaceBtn: 'Switch',
        addWorkspaceBtn: 'Add Folder...',
        noGitBranch: 'No git branch',
        
        // Agents
        activeAgent: 'Active Agent',
        invokeAgent: 'Invoke',
        selectPersona: 'Select Persona',
        
        // Workflows
        runWorkflow: 'Run',
        workflowGit: 'Git Review & Commit',
        workflowTest: 'Auto Test & Fix',
        workflowAudit: 'Security & Secret Scan',
        workflowN8n: 'Dispatch n8n Webhook',
        workflowGoal: 'Autonomous Goal',
        workflowDocs: 'API Docs Generator',
        
        // Chat
        newChatBtn: 'New Chat',
        searchSessionsPlaceholder: 'Search session...',
        noSessionsFound: 'No sessions found',
        switchToTerminal: 'Switch to Terminal',
        newMessages: 'New messages',
        chatInputPlaceholder: 'Send instruction to Antigravity Agent... (e.g. /model, /plan, /goal)',
        voiceTitle: 'Voice Dictation (Voice-to-Text)',
        sendPromptTitle: 'Send Prompt',
        you: 'You',
        agentName: 'Antigravity Agent',
        copyCode: 'Copy',
        codeCopied: 'Copied!',
        renameSessionPrompt: 'New title for session:',
        deleteSessionConfirm: 'Are you sure you want to delete this session?',
        
        // Quick Action Chips
        chipGoal: '/goal (Autonomous)',
        chipPlan: '/plan (Planning)',
        chipModel: '/model (Select Model)',
        chipBrowser: '/browser (Web)',
        chipGitStatus: 'Git Status',
        chipHelp: '/help (Help)',
        
        // Terminal Quick Actions
        btnYes: 'Yes (y)',
        btnNo: 'No (n)',
        btnEnter: 'Enter',
        btnCtrlC: 'Ctrl+C',
        terminalInputPlaceholder: 'Send to interactive terminal...',
        
        // Files Tab
        filesTitle: 'File Explorer',
        refreshFilesTitle: 'Refresh Files',
        useInPrompt: 'Use in Prompt',
        copyPath: 'Copy Path',
        closeViewer: 'Close',
        
        // Quick Prompts Tab
        promptsHeader: 'Quick Templates & Instructions',
        promptsSubtitle: 'Tap a card to send command to Antigravity immediately:',
        promptGitTitle: 'Git Status & History',
        promptGitDesc: 'Check uncommitted changes and recent commit log.',
        promptTestTitle: 'Run Tests & Fix',
        promptTestDesc: 'Launch unit/integration tests and apply automatic fixes.',
        promptGoalTitle: '/goal (Autonomous Mode)',
        promptGoalDesc: 'Launch autonomous multi-step execution until the goal is fully achieved.',
        promptPlanTitle: '/plan (Step-by-step Planning)',
        promptPlanDesc: 'Plan complex architecture by creating a structured plan before execution.',
        promptReviewTitle: 'Code Review',
        promptReviewDesc: 'Deep code quality inspection and refactoring recommendations.',
        promptBrowserTitle: '/browser (Web Interaction)',
        promptBrowserDesc: 'Search the web or extract information from online documentation.',
        
        // Settings Sections
        settingsAccount: 'Account & Models',
        settingsMcp: 'MCP Servers',
        settingsPermissions: 'Permissions & Security',
        settingsSkills: 'Skills',
        settingsPlugins: 'Plugins',
        settingsLanguage: 'Language / Lingua',
        
        // Settings: Account & Models
        settingsAccountTitle: '🤖 Antigravity Account & Models',
        settingsAccountSubtitle: 'Select active AI model and reasoning depth (Thinking Effort).',
        reasoningEffortTitle: 'Reasoning Effort',
        reasoningEffortDesc: 'Controls depth of analytical reasoning for complex problem solving.',
        effortHigh: 'High (Maximum accuracy and deep reasoning)',
        effortMedium: 'Medium (Balanced for standard tasks)',
        effortLow: 'Low (Faster for lightweight tasks)',
        availableModelsTitle: 'Available Models',
        availableModelsDesc: 'Tap a model to set it as active default for the CLI:',
        activeBadge: 'Active',
        
        // Settings: MCP
        mcpTitle: '🔌 MCP Servers (Model Context Protocol)',
        mcpSubtitle: 'Connect local or remote MCP servers to extend agent capabilities with specialized tools.',
        addMcpBtn: 'Add MCP Server',
        mcpTemplatesTitle: 'Popular MCP Quick Templates',
        
        // Settings: Permissions
        permTitle: '🛡️ Permissions & Security',
        permSubtitle: 'Configure execution permissions for Antigravity CLI and web access authentication.',
        permPinTitle: 'Web UI Access PIN',
        permPinDesc: 'Protects agycodeui from unauthorized access from mobile or remote browsers.',
        permWorkspaceTitle: 'Initial Working Directory (WORKSPACE_DIR)',
        permWorkspaceDesc: 'Root directory where Antigravity CLI and file explorer operate.',
        permCliTitle: 'Execution Modes & CLI Permissions',
        permSkipLabel: 'Auto-approve all tool permissions (--dangerously-skip-permissions)',
        permSkipDesc: 'Allows the agent to execute bash commands, create and edit files without asking interactive confirmation (y/n).',
        permSandboxLabel: 'Sandbox Mode (--sandbox)',
        permSandboxDesc: 'Executes the agent in a restricted environment with terminal sandboxing.',
        saveSettingsBtn: 'Save Settings',
        
        // Settings: Skills & Plugins
        skillsTitle: '🧠 Antigravity Skills',
        skillsSubtitle: 'Skills extend agent capabilities with specialized workflows, guidelines, and playbooks.',
        createSkillBtn: 'Create New Skill',
        pluginsTitle: '🧩 Antigravity Plugins',
        pluginsSubtitle: 'Import or install plugins from marketplace or existing Gemini/Claude setups.',
        importGeminiBtn: 'Import from Gemini',
        installPluginBtn: 'Install Plugin'
    }
};

class AgyI18n {
    constructor() {
        this.currentLang = localStorage.getItem('agy_lang') || 'it';
    }

    /**
     * Get translation by key with optional fallback
     */
    t(key, fallback = '') {
        const dict = AGY_TRANSLATIONS[this.currentLang] || AGY_TRANSLATIONS.it;
        return dict[key] || AGY_TRANSLATIONS.it[key] || fallback || key;
    }

    /**
     * Get current language code ('it' or 'en')
     */
    getLanguage() {
        return this.currentLang;
    }

    /**
     * Switch language and update DOM
     */
    setLanguage(lang) {
        if (lang !== 'it' && lang !== 'en') lang = 'it';
        this.currentLang = lang;
        localStorage.setItem('agy_lang', lang);
        document.documentElement.lang = lang;
        this.applyTranslations();
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('agy-lang-changed', { detail: { lang } }));
    }

    /**
     * Toggle between IT and EN
     */
    toggleLanguage() {
        const next = this.currentLang === 'it' ? 'en' : 'it';
        this.setLanguage(next);
        return next;
    }

    /**
     * Scan and translate all DOM elements with data-i18n attributes
     */
    applyTranslations() {
        // Text Content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) el.textContent = translation;
        });

        // HTML Content
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const translation = this.t(key);
            if (translation) el.innerHTML = translation;
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation) el.setAttribute('placeholder', translation);
        });

        // Titles / Tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation) el.setAttribute('title', translation);
        });

        // Update Language Switcher UI if present
        const langBadge = document.getElementById('lang-switch-badge');
        if (langBadge) {
            langBadge.innerHTML = this.currentLang === 'it' ? '🇮🇹 <b>IT</b>' : '🇬🇧 <b>EN</b>';
        }
    }
}

window.agyI18n = new AgyI18n();
