/**
 * AGYUI - Automation Workflows API
 */

const express = require('express');

const WORKFLOW_TEMPLATES = [
    {
        id: 'git-review-commit',
        title: 'Git Review & Smart Commit',
        icon: 'git-commit',
        color: '#10b981',
        category: 'Git',
        description: 'Analizza git diff, revisiona le modifiche e propone un messaggio di commit convenzionale.',
        prompt: 'Controlla lo stato del repository git (`git status` e `git diff`), analizza le modifiche apportate e genera un commit semantico chiaro e ben formattato.'
    },
    {
        id: 'test-and-fix',
        title: 'Auto Test & Fix Loop',
        icon: 'play-circle',
        color: '#3b82f6',
        category: 'Testing',
        description: 'Esegue i test del progetto, analizza i log di errore e applica i fix necessari.',
        prompt: 'Esegui i test automatizzati del progetto. Se si verificano errori o fallimenti, analizza lo stack trace e applica subito le correzioni al codice per far passare tutti i test.'
    },
    {
        id: 'security-audit',
        title: 'Security & Secret Scan',
        icon: 'shield-alert',
        color: '#ef4444',
        category: 'Sicurezza',
        description: 'Scansiona il codice per individuare credenziali esposte, vulnerabilità e problemi di permessi.',
        prompt: 'Esegui un audit di sicurezza completo della codebase: verifica che non ci siano token, credenziali o dati personali salvati in chiaro, controlla le dipendenze e verifica la sanitizzazione degli input.'
    },
    {
        id: 'n8n-webhook-dispatch',
        title: 'Dispatcia Webhook n8n',
        icon: 'workflow',
        color: '#f59e0b',
        category: 'Automazione',
        description: 'Invia i dati o lo stato del progetto all\'istanza di automazione n8n locale.',
        prompt: 'Prepara un payload JSON riassuntivo dello stato del progetto e simula l\'invio di un webhook verso l\'hub n8n locale.'
    },
    {
        id: 'autonomous-goal',
        title: 'Autonomous Goal Execution',
        icon: 'target',
        color: '#8b5cf6',
        category: 'Agenti',
        description: 'Avvia una sessione autonoma approfondita (/goal) per completare un obiettivo complesso.',
        prompt: '/goal Analizza il task corrente e pianifica l\'esecuzione fino al completo raggiungimento dell\'obiettivo.'
    },
    {
        id: 'docs-generator',
        title: 'Generatore Documentazione API',
        icon: 'file-text',
        color: '#06b6d4',
        category: 'Docs',
        description: 'Ispeziona tutti gli endpoint REST e i modelli per generare documentazione Markdown aggiornata.',
        prompt: 'Ispeziona i router Express e i file di configurazione per generare una tabella documentale completa di tutti gli endpoint REST con parametri, metodi e risposte.'
    }
];

function createWorkflowsRouter(sessionManager, ptyManager, io) {
    const router = express.Router();

    /**
     * GET /api/workflows
     * List all available workflow templates
     */
    router.get('/', (req, res) => {
        res.json({
            success: true,
            workflows: WORKFLOW_TEMPLATES
        });
    });

    /**
     * POST /api/workflows/run
     * Trigger a workflow
     * Body: { workflowId, customPrompt }
     */
    router.post('/run', (req, res) => {
        const { workflowId, customPrompt } = req.body || {};
        const workflow = WORKFLOW_TEMPLATES.find(w => w.id === workflowId);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow non trovato' });
        }

        const promptToRun = customPrompt || workflow.prompt;

        if (ptyManager && promptToRun) {
            ptyManager.write(promptToRun + '\r');
        }

        res.json({
            success: true,
            workflow,
            dispatchedPrompt: promptToRun
        });
    });

    return router;
}

module.exports = createWorkflowsRouter;
