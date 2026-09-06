/**
 * AGYUI - Multi-language Internationalization (i18n) Engine
 * Supports Italian (IT), English (EN), and German (DE) with live DOM translation & persistence
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
        
        // Drawer & Sidebar Links
        drawerReportIssue: 'Segnala Problema',
        drawerCommunity: 'Community',
        drawerEnvironments: 'Pannello Ambienti',
        
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
        
        // Environments Dashboard View
        envDashboardTitle: 'Pannello Sviluppo Ambienti di Lavoro',
        envQuotaTemplate: '{used} di {total} ambienti',
        envUpgradeBtn: 'Aggiorna →',
        envNewBtn: 'Nuovo Ambiente',
        envSharedSetupTitle: 'Configurazione Condivisa',
        envTemplateLayer: 'Livello Template',
        envSharedSetupDesc: 'Configura skill e server MCP condivisi per gli ambienti o per l\'intera organizzazione.',
        envConfigureBtn: 'Configura',
        envSharedSkills: 'Skills',
        envSharedMcp: 'MCP',
        envStatusRunning: 'In esecuzione',
        envStatusStopped: 'Arrestato',
        envSessionsCount: 'sessioni',
        envActionOpen: 'Apri',
        envActionStop: 'Arresta',
        envActionStart: 'Avvia',
        envActionSsh: 'SSH',
        envActionPii: 'PII (Anonimizza)',
        envEmptyTitle: 'Nessun ambiente attivo',
        envEmptyDesc: 'Crea il tuo primo ambiente cloud con Google Antigravity in pochi secondi.',
        envDeleteConfirm: 'Vuoi davvero eliminare l\'ambiente "{name}"?',
        envModifyInSettings: 'Modifica in Impostazioni',

        // Create Environment Wizard
        envWizardTitle: 'Crea Nuovo Ambiente',
        envWizardStep: 'Passo {current} di {total}',
        envWizardStep1Title: 'Come desideri iniziare?',
        envWizardStep1Desc: 'Crea un nuovo progetto vuoto o importane uno esistente da GitHub',
        envWizardNewProject: 'Nuovo Progetto',
        envWizardNewProjectDesc: 'Inizia con un workspace vuoto',
        envWizardImportGithub: 'Importa da GitHub',
        envWizardImportGithubDesc: 'Clona un repository esistente',
        envWizardGitLabel: 'URL Repository GitHub *',
        envWizardStep2Title: 'Nome del Progetto',
        envWizardStep2Desc: 'Assegna un nome identificativo al tuo ambiente di sviluppo',
        envWizardProjectNameLabel: 'Nome del Progetto',
        envWizardProjectPlaceholder: 'es. Progetto E-commerce, Bot Telegram...',
        envWizardStep3Title: 'Impostazioni Ambiente',
        envWizardStep3Desc: 'Conferma l\'identificatore della cartella e configura eventuali strumenti specifici.',
        envWizardSlugLabel: 'Slug (identificativo cartella locale del progetto)',
        envWizardAvailable: 'Disponibile',
        envWizardSoftware: 'Software & Runtime',
        envWizardSoftwareDesc: 'Eseguito direttamente su questa macchina (modalità host): include i pacchetti installati e Google Antigravity CLI (agy).',
        envWizardAddTools: 'Aggiungi altri strumenti',
        envWizardBtnBack: 'Indietro',
        envWizardBtnNext: 'Avanti',
        envWizardBtnCreate: 'Crea Ambiente',
        envWizardBtnCreating: 'Creazione ambiente in corso...',

        // Modals: Tools, Onboarding, SSH, PII
        extraToolsTitle: 'Strumenti & Pacchetti Aggiuntivi',
        extraToolsSubtitle: 'Seleziona i pacchetti software da pre-installare nel tuo ambiente:',
        onboardGitTitle: 'Configurazione Git',
        onboardRequired: 'Obbligatorio',
        onboardConnectAgents: 'Connetti Agenti AI',
        onboardGitDesc: 'Configura la tua identità Git per attribuire correttamente i commit.',
        onboardGitName: 'Nome Git *',
        onboardGitEmail: 'Email Git *',
        onboardAgentsTitle: 'Connetti i Tuoi Agenti AI',
        onboardAgentsDesc: 'Accedi a uno o più assistenti AI di programmazione. Tutti opzionali.',
        onboardSettingsHint: 'Puoi configurarli in qualsiasi momento nelle Impostazioni.',
        sshModalTitle: 'Accesso SSH',
        sshModalDesc: 'Connettiti direttamente tramite il terminale dal tuo computer o apri la web console:',
        sshCopyCmd: 'Copia Comando',
        sshOpenWeb: 'Apri Web Terminal',
        piiModalTitle: 'Anonimizza Documenti (PII Shield)',
        piiModalDesc: 'Carica un PDF, un .txt o un .md: i dati personali (nomi, CF, IBAN, indirizzi...) vengono rilevati ed oscurati in locale prima dell\'invio all\'AI.',
        piiModalSubmit: 'Anonimizza e Salva',
        btnConfirm: 'Conferma',
        btnClose: 'Chiudi',
        btnPrevious: '< Indietro',
        btnNext: 'Avanti >',

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
        installPluginBtn: 'Installa Plugin',

        // Models & Usage
        settingsTabModelsUsage: 'Modelli & Consumi',
        modelsUsageTitle: 'Models & Usage',
        modelsUsageSubtitle: 'Manage your model quota and credits.',
        planSectionTitle: 'Plan',
        planCurrent: 'Your Plan: Google AI Pro',
        planUpgradeDesc: 'You can upgrade to a Google AI Ultra plan to receive higher rate limits.',
        upgradeBtn: 'Upgrade',
        modelCreditsTitle: 'Model Credits',
        enableOveragesTitle: 'Enable AI Credit Overages',
        enableOveragesDesc: 'When toggled on, Antigravity will use your AI credits to fulfill model requests once you\'re out of model quota. Antigravity will always use your model quota first before using AI credits.',
        geminiModelsTitle: 'Gemini Models',
        claudeGptModelsTitle: 'Claude and GPT models',
        weeklyLimitTitle: 'Weekly Limit Remaining',
        fiveHourLimitTitle: 'Five Hour Limit Remaining',

        // Appearance
        settingsTabAppearance: 'Aspetto',
        appearanceTitle: 'Aspetto & Tema Interfaccia',
        appearanceSubtitle: 'Personalizza la luminosità dell\'interfaccia tra versione Giorno (Chiaro con sfondo bianco) e Notte (Scuro).',
        themeChoiceTitle: 'Tema Interfaccia',
        themeDark: 'Notte (Scuro)',
        themeLight: 'Giorno (Chiaro)',
        themeSystem: 'Automatico (Sistema)',

        // Browser Settings
        settingsTabBrowser: 'Browser Subagent',
        browserSettingsTitle: 'Browser Settings',
        browserSettingsSubtitle: 'Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.',
        browserGeneralTitle: 'General',
        jsPolicyTitle: 'Browser Javascript Execution Policy',
        jsPolicyDesc: 'Controls whether the agent can run custom JavaScript to automate complex browser actions.',
        policyReview: 'Request Review',
        policyAllow: 'Allow Always',
        policyDisallow: 'Disallow',
        actuationPermissionsTitle: 'Actuation Permissions',
        actuationRulesTitle: 'Browser Actuation Rules',
        actuationRulesDesc: 'Configure allowed and denied URLs for browser actuation.',
        editBtn: 'Edit',
        actuationRulesModalTitle: 'Regole Attuazione Browser (URL Rules)',
        actuationRulesModalDesc: 'Definisci quali URL o domini il subagent browser è autorizzato a navigare o attuare.',
        modalClose: 'Chiudi'
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
        
        // Drawer & Sidebar Links
        drawerReportIssue: 'Report Issue',
        drawerCommunity: 'Community',
        drawerEnvironments: 'Environments Dashboard',
        
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
        
        // Environments Dashboard View
        envDashboardTitle: 'Environments Dashboard',
        envQuotaTemplate: '{used} of {total} env',
        envUpgradeBtn: 'Upgrade →',
        envNewBtn: 'New Environment',
        envSharedSetupTitle: 'Shared Setup',
        envTemplateLayer: 'Template layer',
        envSharedSetupDesc: 'Configure shared skills and MCP servers for users or the whole organization.',
        envConfigureBtn: 'Configure',
        envSharedSkills: 'Skills',
        envSharedMcp: 'MCP',
        envStatusRunning: 'Running',
        envStatusStopped: 'Stopped',
        envSessionsCount: 'sessions',
        envActionOpen: 'Open',
        envActionStop: 'Stop',
        envActionStart: 'Start',
        envActionSsh: 'SSH',
        envActionPii: 'PII Shield',
        envEmptyTitle: 'No active environments',
        envEmptyDesc: 'Create your first cloud environment with Google Antigravity in seconds.',
        envDeleteConfirm: 'Are you sure you want to delete environment "{name}"?',
        envModifyInSettings: 'Edit in Settings',

        // Create Environment Wizard
        envWizardTitle: 'Create Environment',
        envWizardStep: 'Step {current} of {total}',
        envWizardStep1Title: 'How would you like to start?',
        envWizardStep1Desc: 'Create a new blank project or import an existing one from GitHub',
        envWizardNewProject: 'New Project',
        envWizardNewProjectDesc: 'Start with a blank workspace',
        envWizardImportGithub: 'Import from GitHub',
        envWizardImportGithubDesc: 'Clone an existing repository',
        envWizardGitLabel: 'GitHub Repository URL *',
        envWizardStep2Title: 'Name Your Project',
        envWizardStep2Desc: 'Give your development environment a memorable name',
        envWizardProjectNameLabel: 'Project Name',
        envWizardProjectPlaceholder: 'e.g. E-commerce App, Telegram Bot...',
        envWizardStep3Title: 'Environment Settings',
        envWizardStep3Desc: 'Confirm the folder identifier and optionally note project-specific tools.',
        envWizardSlugLabel: 'Slug - used as the local project folder name',
        envWizardAvailable: 'Available',
        envWizardSoftware: 'Software & Runtime',
        envWizardSoftwareDesc: 'Runs directly on this machine (host mode): whatever is already installed here, plus Google Antigravity CLI (agy).',
        envWizardAddTools: 'Add extra tools',
        envWizardBtnBack: 'Back',
        envWizardBtnNext: 'Next',
        envWizardBtnCreate: 'Create Environment',
        envWizardBtnCreating: 'Creating environment...',

        // Modals: Tools, Onboarding, SSH, PII
        extraToolsTitle: 'Extra Tools & Packages',
        extraToolsSubtitle: 'Select software packages to pre-install in your environment:',
        onboardGitTitle: 'Git Configuration',
        onboardRequired: 'Required',
        onboardConnectAgents: 'Connect Agents',
        onboardGitDesc: 'Configure your git identity to ensure proper attribution for commits.',
        onboardGitName: 'Git Name *',
        onboardGitEmail: 'Git Email *',
        onboardAgentsTitle: 'Connect Your AI Agents',
        onboardAgentsDesc: 'Login to one or more AI coding assistants. All are optional.',
        onboardSettingsHint: 'You can configure these later in Settings.',
        sshModalTitle: 'SSH Access',
        sshModalDesc: 'Connect directly via your computer terminal or open the web console:',
        sshCopyCmd: 'Copy Command',
        sshOpenWeb: 'Open Web Terminal',
        piiModalTitle: 'Anonymize Documents (PII Shield)',
        piiModalDesc: 'Upload a PDF, .txt, or .md: personal data (names, tax IDs, IBANs, addresses...) are detected and masked locally before sending to AI.',
        piiModalSubmit: 'Anonymize & Save',
        btnConfirm: 'Confirm',
        btnClose: 'Close',
        btnPrevious: '< Previous',
        btnNext: 'Next >',
        
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
        installPluginBtn: 'Install Plugin',

        // Models & Usage
        settingsTabModelsUsage: 'Models & Usage',
        modelsUsageTitle: 'Models & Usage',
        modelsUsageSubtitle: 'Manage your model quota and credits.',
        planSectionTitle: 'Plan',
        planCurrent: 'Your Plan: Google AI Pro',
        planUpgradeDesc: 'You can upgrade to a Google AI Ultra plan to receive higher rate limits.',
        upgradeBtn: 'Upgrade',
        modelCreditsTitle: 'Model Credits',
        enableOveragesTitle: 'Enable AI Credit Overages',
        enableOveragesDesc: 'When toggled on, Antigravity will use your AI credits to fulfill model requests once you\'re out of model quota. Antigravity will always use your model quota first before using AI credits.',
        geminiModelsTitle: 'Gemini Models',
        claudeGptModelsTitle: 'Claude and GPT models',
        weeklyLimitTitle: 'Weekly Limit Remaining',
        fiveHourLimitTitle: 'Five Hour Limit Remaining',

        // Appearance
        settingsTabAppearance: 'Appearance',
        appearanceTitle: 'Appearance & Theme',
        appearanceSubtitle: 'Choose between Dark mode (Night) and Light mode with crisp white background (Day).',
        themeChoiceTitle: 'Interface Theme',
        themeDark: 'Dark (Night)',
        themeLight: 'Light (Day)',
        themeSystem: 'System Default',

        // Browser Settings
        settingsTabBrowser: 'Browser Subagent',
        browserSettingsTitle: 'Browser Settings',
        browserSettingsSubtitle: 'Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.',
        browserGeneralTitle: 'General',
        jsPolicyTitle: 'Browser Javascript Execution Policy',
        jsPolicyDesc: 'Controls whether the agent can run custom JavaScript to automate complex browser actions.',
        policyReview: 'Request Review',
        policyAllow: 'Allow Always',
        policyDisallow: 'Disallow',
        actuationPermissionsTitle: 'Actuation Permissions',
        actuationRulesTitle: 'Browser Actuation Rules',
        actuationRulesDesc: 'Configure allowed and denied URLs for browser actuation.',
        editBtn: 'Edit',
        actuationRulesModalTitle: 'Browser Actuation Rules',
        actuationRulesModalDesc: 'Configure allowed and denied URLs for browser actuation.',
        modalClose: 'Close'
    },

    de: {
        // App Header & Global
        appTitle: 'AGYUI — Antigravity Code UI',
        connected: 'Mit AGY verbunden',
        disconnected: 'Getrennt',
        authRequired: 'Authentifizierung erforderlich',
        authError: 'Falsche PIN. Bitte erneut versuchen.',
        authPinPlaceholder: 'PIN eingeben',
        loginBtn: 'Anmelden',
        restartBtnTitle: 'CLI-Sitzung neu starten',
        settingsBtnTitle: 'Einstellungen',
        langSwitchTitle: 'Sprache wechseln / Switch language',
        
        // Navigation Tabs
        navChat: 'Chat',
        navTerminal: 'Terminal',
        navFiles: 'Dateien',
        navPrompts: 'Prompts',
        navSettings: 'Einstellungen',
        
        // Drawer & Sidebar Links
        drawerReportIssue: 'Problem melden',
        drawerCommunity: 'Community',
        drawerEnvironments: 'Umgebungs-Dashboard',
        
        // Drawer Accordion Headers
        sectionProjects: 'Projekte & Workspaces',
        sectionAgents: 'Agenten & Personas',
        sectionWorkflows: 'Workflows & Automation',
        sectionSessions: 'Aktuelle Chats',
        
        // Projects / Workspaces
        currentWorkspace: 'Aktiver Workspace',
        switchWorkspaceBtn: 'Wechseln',
        addWorkspaceBtn: 'Ordner hinzufügen...',
        noGitBranch: 'Kein Git-Branch',
        
        // Environments Dashboard View
        envDashboardTitle: 'Arbeitsumgebungen-Entwicklungsdashboard',
        envQuotaTemplate: '{used} von {total} Umgebungen',
        envUpgradeBtn: 'Upgrade →',
        envNewBtn: 'Neue Umgebung',
        envSharedSetupTitle: 'Gemeinsame Konfiguration',
        envTemplateLayer: 'Template-Ebene',
        envSharedSetupDesc: 'Konfiguriere geteilte Skills und MCP-Server für Umgebungen oder die Organisation.',
        envConfigureBtn: 'Konfigurieren',
        envSharedSkills: 'Skills',
        envSharedMcp: 'MCP',
        envStatusRunning: 'In Ausführung',
        envStatusStopped: 'Gestoppt',
        envSessionsCount: 'Sitzungen',
        envActionOpen: 'Öffnen',
        envActionStop: 'Stoppen',
        envActionStart: 'Starten',
        envActionSsh: 'SSH',
        envActionPii: 'PII-Schutz',
        envEmptyTitle: 'Keine aktiven Umgebungen',
        envEmptyDesc: 'Erstelle deine erste Cloud-Umgebung mit Google Antigravity in Sekunden.',
        envDeleteConfirm: 'Möchtest du die Umgebung "{name}" wirklich löschen?',
        envModifyInSettings: 'In Einstellungen bearbeiten',

        // Create Environment Wizard
        envWizardTitle: 'Neue Umgebung erstellen',
        envWizardStep: 'Schritt {current} von {total}',
        envWizardStep1Title: 'Wie möchtest du starten?',
        envWizardStep1Desc: 'Erstelle ein leeres Projekt oder importiere ein bestehendes von GitHub',
        envWizardNewProject: 'Neues Projekt',
        envWizardNewProjectDesc: 'Mit einem leeren Workspace starten',
        envWizardImportGithub: 'Von GitHub importieren',
        envWizardImportGithubDesc: 'Bestehendes Repository klonen',
        envWizardGitLabel: 'GitHub-Repository-URL *',
        envWizardStep2Title: 'Projekt benennen',
        envWizardStep2Desc: 'Gib deiner Entwicklungsumgebung einen einprägsamen Namen',
        envWizardProjectNameLabel: 'Projektname',
        envWizardProjectPlaceholder: 'z.B. E-Commerce-App, Telegram-Bot...',
        envWizardStep3Title: 'Umgebungseinstellungen',
        envWizardStep3Desc: 'Bestätige den Ordnerbezeichner und konfiguriere optionale Tools.',
        envWizardSlugLabel: 'Slug - lokaler Ordnername des Projekts',
        envWizardAvailable: 'Verfügbar',
        envWizardSoftware: 'Software & Runtime',
        envWizardSoftwareDesc: 'Läuft direkt auf diesem Server (Host-Modus): installierte Pakete plus Google Antigravity CLI (agy).',
        envWizardAddTools: 'Zusätzliche Tools hinzufügen',
        envWizardBtnBack: 'Zurück',
        envWizardBtnNext: 'Weiter',
        envWizardBtnCreate: 'Umgebung erstellen',
        envWizardBtnCreating: 'Umgebung wird erstellt...',

        // Modals: Tools, Onboarding, SSH, PII
        extraToolsTitle: 'Zusätzliche Tools & Pakete',
        extraToolsSubtitle: 'Wähle Softwarepakete zur Vorinstallation in deiner Umgebung:',
        onboardGitTitle: 'Git-Konfiguration',
        onboardRequired: 'Erforderlich',
        onboardConnectAgents: 'KI-Agenten verbinden',
        onboardGitDesc: 'Konfiguriere deine Git-Identität für korrekte Commit-Zuordnung.',
        onboardGitName: 'Git-Name *',
        onboardGitEmail: 'Git-E-Mail *',
        onboardAgentsTitle: 'Verbinde deine KI-Agenten',
        onboardAgentsDesc: 'Melde dich bei einem oder mehreren KI-Assistenten an. Alle optional.',
        onboardSettingsHint: 'Du kannst diese später in den Einstellungen konfigurieren.',
        sshModalTitle: 'SSH-Zugang',
        sshModalDesc: 'Verbinde dich direkt über dein Computer-Terminal oder öffne die Web-Konsole:',
        sshCopyCmd: 'Befehl kopieren',
        sshOpenWeb: 'Web-Terminal öffnen',
        piiModalTitle: 'Dokumente anonymisieren (PII Shield)',
        piiModalDesc: 'PDF, .txt oder .md hochladen: persönliche Daten (Namen, Steuernummern, IBANs...) werden lokal maskiert, bevor sie an die KI gesendet werden.',
        piiModalSubmit: 'Anonymisieren & Speichern',
        btnConfirm: 'Bestätigen',
        btnClose: 'Schließen',
        btnPrevious: '< Zurück',
        btnNext: 'Weiter >',
        
        // Agents
        activeAgent: 'Aktiver Agent',
        invokeAgent: 'Aufrufen',
        selectPersona: 'Persona auswählen',
        
        // Workflows
        runWorkflow: 'Ausführen',
        workflowGit: 'Git Review & Commit',
        workflowTest: 'Auto Test & Fix',
        workflowAudit: 'Security & Secret Scan',
        workflowN8n: 'n8n-Webhook auslösen',
        workflowGoal: 'Autonomous Goal',
        workflowDocs: 'API-Dokumentation generieren',
        
        // Chat
        newChatBtn: 'Neuer Chat',
        searchSessionsPlaceholder: 'Chat suchen...',
        noSessionsFound: 'Keine Chats gefunden',
        switchToTerminal: 'Zum Terminal wechseln',
        newMessages: 'Neue Nachrichten',
        chatInputPlaceholder: 'Anweisung an Antigravity Agent senden... (z.B. /model, /plan, /goal)',
        voiceTitle: 'Spracheingabe (Voice-to-Text)',
        sendPromptTitle: 'Prompt senden',
        you: 'Du',
        agentName: 'Antigravity Agent',
        copyCode: 'Kopieren',
        codeCopied: 'Kopiert!',
        renameSessionPrompt: 'Neuer Titel für die Sitzung:',
        deleteSessionConfirm: 'Möchtest du diesen Chat wirklich löschen?',
        
        // Quick Action Chips
        chipGoal: '/goal (Autonom)',
        chipPlan: '/plan (Planung)',
        chipModel: '/model (Modell wählen)',
        chipBrowser: '/browser (Web)',
        chipGitStatus: 'Git-Status',
        chipHelp: '/help (Hilfe)',
        
        // Terminal Quick Actions
        btnYes: 'Ja (y)',
        btnNo: 'Nein (n)',
        btnEnter: 'Eingabe',
        btnCtrlC: 'Ctrl+C',
        terminalInputPlaceholder: 'An interaktives Terminal senden...',
        
        // Files Tab
        filesTitle: 'Dateimanager',
        refreshFilesTitle: 'Dateien aktualisieren',
        useInPrompt: 'Im Prompt verwenden',
        copyPath: 'Pfad kopieren',
        closeViewer: 'Schließen',
        
        // Quick Prompts Tab
        promptsHeader: 'Schnellvorlagen & Anweisungen',
        promptsSubtitle: 'Tippe auf eine Karte, um den Befehl direkt an Antigravity zu senden:',
        promptGitTitle: 'Git Status & History',
        promptGitDesc: 'Nicht committete Änderungen und Commit-Verlauf prüfen.',
        promptTestTitle: 'Run Tests & Fix',
        promptTestDesc: 'Unit-/Integrationstests starten und automatische Fixes anwenden.',
        promptGoalTitle: '/goal (Autonomer Modus)',
        promptGoalDesc: 'Autonome mehrschrittige Ausführung starten, bis das Ziel erreicht ist.',
        promptPlanTitle: '/plan (Schrittweise Planung)',
        promptPlanDesc: 'Komplexe Architektur durch detaillierten Plan vor der Ausführung strukturieren.',
        promptReviewTitle: 'Code Review',
        promptReviewDesc: 'Tiefgehende Codequalität-Prüfung und Refactoring-Vorschläge.',
        promptBrowserTitle: '/browser (Web-Interaktion)',
        promptBrowserDesc: 'Im Web suchen oder Informationen aus Online-Dokumentation abrufen.',
        
        // Settings Sections
        settingsAccount: 'Konto & Modelle',
        settingsMcp: 'MCP-Server',
        settingsPermissions: 'Berechtigungen & Sicherheit',
        settingsSkills: 'Skills',
        settingsPlugins: 'Plugins',
        settingsLanguage: 'Sprache / Language',
        
        // Settings: Account & Models
        settingsAccountTitle: '🤖 Antigravity Konto & Modelle',
        settingsAccountSubtitle: 'Wähle das aktive KI-Modell und die Denktiefe (Thinking Effort).',
        reasoningEffortTitle: 'Denktiefe (Reasoning Effort)',
        reasoningEffortDesc: 'Steuert die analytische Denktiefe bei komplexen Problemlösungen.',
        effortHigh: 'High (Maximale Genauigkeit & tiefes Nachdenken)',
        effortMedium: 'Medium (Ausgewogen für Standardaufgaben)',
        effortLow: 'Low (Schneller für einfache Aufgaben)',
        availableModelsTitle: 'Verfügbare Modelle',
        availableModelsDesc: 'Tippe auf ein Modell, um es als Standard für die CLI festzulegen:',
        activeBadge: 'Aktiv',
        
        // Settings: MCP
        mcpTitle: '🔌 MCP-Server (Model Context Protocol)',
        mcpSubtitle: 'Verbinde lokale oder Remote-MCP-Server, um Agenten-Funktionen zu erweitern.',
        addMcpBtn: 'MCP-Server hinzufügen',
        mcpTemplatesTitle: 'Beliebte MCP-Schnellvorlagen',
        
        // Settings: Permissions
        permTitle: '🛡️ Berechtigungen & Sicherheit',
        permSubtitle: 'Konfiguriere Ausführungsberechtigungen für Antigravity CLI und Web-Zugang.',
        permPinTitle: 'Web-UI Zugangs-PIN',
        permPinDesc: 'Schützt agycodeui vor unbefugtem Zugriff über Mobilgeräte oder Remote-Browser.',
        permWorkspaceTitle: 'Start-Arbeitsverzeichnis (WORKSPACE_DIR)',
        permWorkspaceDesc: 'Hauptverzeichnis, in dem Antigravity CLI und der Dateimanager arbeiten.',
        permCliTitle: 'Ausführungsmodus & CLI-Berechtigungen',
        permSkipLabel: 'Alle Werkzeugberechtigungen automatisch genehmigen (--dangerously-skip-permissions)',
        permSkipDesc: 'Erlaubt dem Agenten Bash-Befehle auszuführen und Dateien ohne Bestätigung (y/n) zu bearbeiten.',
        permSandboxLabel: 'Sandbox-Modus (--sandbox)',
        permSandboxDesc: 'Führt den Agenten in einer eingeschränkten Umgebung mit Terminal-Sandboxing aus.',
        saveSettingsBtn: 'Einstellungen speichern',
        
        // Settings: Skills & Plugins
        skillsTitle: '🧠 Antigravity Skills',
        skillsSubtitle: 'Skills erweitern den Agenten um Workflows, Richtlinien und Playbooks.',
        createSkillBtn: 'Neuen Skill erstellen',
        pluginsTitle: '🧩 Antigravity Plugins',
        pluginsSubtitle: 'Importiere oder installiere Plugins aus dem Marktplatz oder bestehenden Gemini/Claude-Setups.',
        importGeminiBtn: 'Aus Gemini importieren',
        installPluginBtn: 'Plugin installieren',

        // Models & Usage
        settingsTabModelsUsage: 'Modelle & Nutzung',
        modelsUsageTitle: 'Models & Usage',
        modelsUsageSubtitle: 'Verwalten Sie Ihr Modellkontingent und Guthaben.',
        planSectionTitle: 'Plan',
        planCurrent: 'Ihr Abonnement: Google AI Pro',
        planUpgradeDesc: 'Sie können auf einen Google AI Ultra-Plan upgraden, um höhere Limits zu erhalten.',
        upgradeBtn: 'Upgrade',
        modelCreditsTitle: 'Modellguthaben',
        enableOveragesTitle: 'AI-Guthaben-Überschreitung aktivieren',
        enableOveragesDesc: 'Wenn aktiviert, verwendet Antigravity Ihr KI-Guthaben, sobald Ihr Modellkontingent aufgebraucht ist. Antigravity verbraucht immer zuerst das Standardkontingent.',
        geminiModelsTitle: 'Gemini-Modelle',
        claudeGptModelsTitle: 'Claude- und GPT-Modelle',
        weeklyLimitTitle: 'Verbleibendes wöchentliches Limit',
        fiveHourLimitTitle: 'Verbleibendes 5-Stunden-Limit',

        // Appearance
        settingsTabAppearance: 'Erscheinungsbild',
        appearanceTitle: 'Erscheinungsbild & Theme',
        appearanceSubtitle: 'Wählen Sie zwischen Nachtmodus (Dunkel) und Tagmodus mit weißem Hintergrund (Hell).',
        themeChoiceTitle: 'Interface-Design',
        themeDark: 'Dunkel (Nacht)',
        themeLight: 'Hell (Tag)',
        themeSystem: 'Systemstandard',

        // Browser Settings
        settingsTabBrowser: 'Browser Subagent',
        browserSettingsTitle: 'Browser Settings',
        browserSettingsSubtitle: 'Konfigurieren Sie den Browser-Subagenten. Erfordert die Installation von Google Chrome. Kann mit /browser im Eingabefeld aufgerufen werden.',
        browserGeneralTitle: 'Allgemein',
        jsPolicyTitle: 'Browser JavaScript-Ausführungsrichtlinie',
        jsPolicyDesc: 'Steuert, ob der Agent benutzerdefiniertes JavaScript ausführen darf, um komplexe Browseraktionen zu automatisieren.',
        policyReview: 'Überprüfung anfordern',
        policyAllow: 'Immer erlauben',
        policyDisallow: 'Deaktivieren',
        actuationPermissionsTitle: 'Aktionsberechtigungen',
        actuationRulesTitle: 'Browser-Aktionsregeln',
        actuationRulesDesc: 'Konfigurieren Sie erlaubte und blockierte URLs für Browser-Aktionen.',
        editBtn: 'Bearbeiten',
        actuationRulesModalTitle: 'Browser-Aktionsregeln (URL Rules)',
        actuationRulesModalDesc: 'Legen Sie fest, welche URLs oder Domains der Browser-Subagent besuchen oder steuern darf.',
        modalClose: 'Schließen'
    }
};

class AgyI18n {
    constructor() {
        this.supportedLangs = ['it', 'en', 'de'];
        const saved = localStorage.getItem('agy_lang');
        this.currentLang = this.supportedLangs.includes(saved) ? saved : 'it';
    }

    /**
     * Get translation by key with optional fallback
     */
    t(key, fallback = '') {
        const dict = AGY_TRANSLATIONS[this.currentLang] || AGY_TRANSLATIONS.it;
        return dict[key] || AGY_TRANSLATIONS.it[key] || AGY_TRANSLATIONS.en[key] || fallback || key;
    }

    /**
     * Get current language code ('it', 'en', or 'de')
     */
    getLanguage() {
        return this.currentLang;
    }

    /**
     * Switch language and update DOM
     */
    setLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) lang = 'it';
        this.currentLang = lang;
        localStorage.setItem('agy_lang', lang);
        document.documentElement.lang = lang;
        this.applyTranslations();
        
        // Notify other components
        window.dispatchEvent(new CustomEvent('agy-lang-changed', { detail: { lang } }));
    }

    /**
     * Toggle between supported languages (it -> en -> de -> it)
     */
    toggleLanguage() {
        const idx = this.supportedLangs.indexOf(this.currentLang);
        const next = this.supportedLangs[(idx + 1) % this.supportedLangs.length];
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

        // Update Language Switcher UI badge if present
        const langBadge = document.getElementById('lang-switch-badge');
        if (langBadge) {
            if (this.currentLang === 'it') {
                langBadge.innerHTML = '🇮🇹 <b>IT</b>';
            } else if (this.currentLang === 'de') {
                langBadge.innerHTML = '🇩🇪 <b>DE</b>';
            } else {
                langBadge.innerHTML = '🇬🇧 <b>EN</b>';
            }
        }

        // Sync language dropdown in settings if present
        const langSelect = document.getElementById('language-select');
        if (langSelect && langSelect.value !== this.currentLang) {
            langSelect.value = this.currentLang;
        }
    }
}

window.agyI18n = new AgyI18n();
