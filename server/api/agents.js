/**
 * AGYUI - Agents & Personas Management API
 */

const express = require('express');

const AGENT_PROFILES = [
    {
        id: 'master',
        name: 'Antigravity Master',
        role: 'General Lead Assistant',
        icon: 'bot',
        color: '#10b981',
        description: 'Assistente principale completo per coding, debug, architettura e comandi terminale.',
        promptPrefix: ''
    },
    {
        id: 'researcher',
        name: 'Research Analyst',
        role: 'Codebase & Web Explorer',
        icon: 'search',
        color: '#3b82f6',
        description: 'Esplora il repository, analizza documentazione esterna e cerca soluzioni tecniche ottimali.',
        promptPrefix: '[Persona: Research Analyst] Focalizzati sulla ricerca approfondita, lettura documentazione e analisi dell\'architettura esistente. '
    },
    {
        id: 'architect',
        name: 'System Architect',
        role: 'Design & Refactoring',
        icon: 'boxes',
        color: '#8b5cf6',
        description: 'Progetta schemi modulari, diagrammi mermaid e strategie di refactoring pulito.',
        promptPrefix: '[Persona: System Architect] Struttura la soluzione con approccio modulare, diagrammi mermaid e criteri di scalabilità. '
    },
    {
        id: 'designer',
        name: 'Frontend Designer',
        role: 'UI/UX & Aesthetics',
        icon: 'palette',
        color: '#ec4899',
        description: 'Crea interfacce web accattivanti, responsive, con animazioni fluide e stile non generico.',
        promptPrefix: '[Persona: Frontend Designer] Cura l\'aspetto visivo con design moderno, micro-interazioni, tipografia raffinata e layout responsive. '
    },
    {
        id: 'security',
        name: 'Security Auditor',
        role: 'Hardening & Pen-Testing',
        icon: 'shield-check',
        color: '#ef4444',
        description: 'Analizza vulnerabilità, convalida input, previene injection e controlla permessi.',
        promptPrefix: '[Persona: Security Auditor] Ispeziona il codice per vulnerabilità di sicurezza, timing attack, injection e sanitizzazione input. '
    },
    {
        id: 'devops',
        name: 'DevOps Engineer',
        role: 'Docker, Caddy & CI/CD',
        icon: 'server',
        color: '#f59e0b',
        description: 'Configura container Docker, proxy Caddy, systemd, PM2 e pipeline di automazione.',
        promptPrefix: '[Persona: DevOps Engineer] Ottimizza container, configurazioni di rete, certificati SSL e automazioni server. '
    }
];

function createAgentsRouter(sessionManager, ptyManager, io) {
    const router = express.Router();

    /**
     * GET /api/agents
     * List all available agent profiles
     */
    router.get('/', (req, res) => {
        res.json({
            success: true,
            agents: AGENT_PROFILES,
            activeAgentId: 'master'
        });
    });

    /**
     * POST /api/agents/invoke
     * Invoke an agent persona with a specific prompt
     * Body: { agentId, prompt }
     */
    router.post('/invoke', (req, res) => {
        const { agentId, prompt } = req.body || {};
        const profile = AGENT_PROFILES.find(a => a.id === agentId) || AGENT_PROFILES[0];
        const fullPrompt = `${profile.promptPrefix}${prompt || ''}`.trim();

        if (ptyManager && fullPrompt) {
            ptyManager.write(fullPrompt + '\r');
        }

        res.json({
            success: true,
            agent: profile,
            dispatchedPrompt: fullPrompt
        });
    });

    return router;
}

module.exports = createAgentsRouter;
