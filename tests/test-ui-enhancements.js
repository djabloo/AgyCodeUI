/**
 * Test Suite: UI Enhancements & Left Drawer APIs
 * - Workspaces & Projects Switcher API
 * - Agents & Personas API
 * - Workflows & Automations API
 */

const assert = require('assert');
const express = require('express');
const http = require('http');
const path = require('path');

const createWorkspacesRouter = require('../server/api/workspaces');
const createAgentsRouter = require('../server/api/agents');
const createWorkflowsRouter = require('../server/api/workflows');

async function runTests() {
    console.log('🧪 Starting AGYUI UI Enhancements & API Test Suite...\n');
    let passed = 0;

    // Setup mock server
    const app = express();
    app.use(express.json());

    const projectDir = path.resolve(__dirname, '..');
    const mockPty = {
        currentWorkspaceDir: projectDir,
        spawnPty: () => {},
        write: () => {}
    };

    const mockSession = {
        currentWorkspaceDir: projectDir
    };

    const mockIo = {
        emit: () => {}
    };

    app.use('/api/workspaces', createWorkspacesRouter(mockSession, mockPty, mockIo));
    app.use('/api/agents', createAgentsRouter(mockSession, mockPty, mockIo));
    app.use('/api/workflows', createWorkflowsRouter(mockSession, mockPty, mockIo));

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(3999, '127.0.0.1', resolve));

    const BASE_URL = 'http://127.0.0.1:3999';

    try {
        // Test 1: GET /api/workspaces
        const resWs = await fetch(`${BASE_URL}/api/workspaces`);
        const dataWs = await resWs.json();
        assert.strictEqual(dataWs.success, true);
        assert.ok(Array.isArray(dataWs.workspaces));
        assert.ok(dataWs.workspaces.length > 0);
        console.log(`✅ Test 1: Workspaces API returned ${dataWs.workspaces.length} discovered projects (Current: ${dataWs.current?.name})`);
        passed++;

        // Test 2: POST /api/workspaces/switch to existing dir
        const resSwitch = await fetch(`${BASE_URL}/api/workspaces/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: projectDir })
        });
        const dataSwitch = await resSwitch.json();
        assert.strictEqual(dataSwitch.success, true);
        assert.strictEqual(mockPty.currentWorkspaceDir, projectDir);
        console.log('✅ Test 2: Workspace switch succeeded and updated PTY working directory');
        passed++;

        // Test 3: POST /api/workspaces/switch to invalid dir returns 404
        const resBadSwitch = await fetch(`${BASE_URL}/api/workspaces/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/path/non/existent/12345' })
        });
        assert.strictEqual(resBadSwitch.status, 404);
        console.log('✅ Test 3: Workspace switch to non-existent directory correctly returned 404');
        passed++;

        // Test 4: GET /api/agents
        const resAgents = await fetch(`${BASE_URL}/api/agents`);
        const dataAgents = await resAgents.json();
        assert.strictEqual(dataAgents.success, true);
        assert.ok(dataAgents.agents.length >= 5);
        assert.ok(dataAgents.agents.some(a => a.id === 'master'));
        assert.ok(dataAgents.agents.some(a => a.id === 'researcher'));
        assert.ok(dataAgents.agents.some(a => a.id === 'designer'));
        console.log(`✅ Test 4: Agents API returned ${dataAgents.agents.length} persona profiles`);
        passed++;

        // Test 5: GET /api/workflows
        const resWf = await fetch(`${BASE_URL}/api/workflows`);
        const dataWf = await resWf.json();
        assert.strictEqual(dataWf.success, true);
        assert.ok(dataWf.workflows.length >= 5);
        assert.ok(dataWf.workflows.some(w => w.id === 'git-review-commit'));
        assert.ok(dataWf.workflows.some(w => w.id === 'test-and-fix'));
        assert.ok(dataWf.workflows.some(w => w.id === 'autonomous-goal'));
        console.log(`✅ Test 5: Workflows API returned ${dataWf.workflows.length} workflow templates`);
        passed++;

        // Test 6: POST /api/workflows/run
        const resRunWf = await fetch(`${BASE_URL}/api/workflows/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workflowId: 'git-review-commit' })
        });
        const dataRunWf = await resRunWf.json();
        assert.strictEqual(dataRunWf.success, true);
        assert.strictEqual(dataRunWf.workflow.id, 'git-review-commit');
        console.log('✅ Test 6: Workflow execution trigger dispatched successfully');
        passed++;

    } finally {
        server.close();
    }

    console.log(`\n🏁 Results: ${passed} passed, 0 failed\n`);
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
