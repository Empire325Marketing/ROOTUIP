/**
 * ROOTUIP SRE System Launcher
 * Site Reliability Engineering platform
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import SRE components
const SLISLOManager = require('./sre-system/service-level/sli-slo-manager');
const IncidentManager = require('./sre-system/incident-response/incident-manager');
const OperationsAutomation = require('./sre-system/automation/operations-automation');
const ChaosFramework = require('./sre-system/chaos-engineering/chaos-framework');

const app = express();
const server = http.createServer(app);
const PORT = process.env.SRE_PORT || 8095;

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8096 });

// Initialize SRE components
let sliSloManager;
let incidentManager;
let opsAutomation;
let chaosFramework;

// Mock notification service
const mockNotificationService = {
    async sendNotification(notification) {
        console.log('Notification:', notification.title);
        
        // Broadcast to WebSocket clients
        broadcast({
            type: 'notification',
            data: notification
        });
        
        return { sent: true };
    }
};

async function initializeSRE() {
    try {
        // Initialize SLI/SLO Manager
        sliSloManager = new SLISLOManager();
        
        // Initialize Incident Manager
        incidentManager = new IncidentManager(mockNotificationService, sliSloManager);
        
        // Initialize Operations Automation
        opsAutomation = new OperationsAutomation();
        
        // Initialize Chaos Framework
        chaosFramework = new ChaosFramework();
        
        // Setup event listeners
        setupEventHandlers();
        
        console.log('SRE System initialized successfully');
    } catch (error) {
        console.error('Failed to initialize SRE System:', error);
        process.exit(1);
    }
}

function setupEventHandlers() {
    // SLO violations trigger incidents
    sliSloManager.on('slo:violation', (violation) => {
        broadcast({
            type: 'slo_violation',
            data: violation
        });
    });
    
    // Error budget warnings
    sliSloManager.on('error_budget:warning', (warning) => {
        broadcast({
            type: 'error_budget_warning',
            data: warning
        });
    });
    
    // Incident events
    incidentManager.on('incident:created', (incident) => {
        broadcast({
            type: 'incident_created',
            data: incident
        });
    });
    
    incidentManager.on('incident:updated', (incident) => {
        broadcast({
            type: 'incident_updated',
            data: incident
        });
    });
    
    incidentManager.on('incident:resolved', (incident) => {
        broadcast({
            type: 'incident_resolved',
            data: incident
        });
    });
    
    // Automation events
    opsAutomation.on('automation:scaled', (event) => {
        broadcast({
            type: 'auto_scaling',
            data: event
        });
    });
    
    opsAutomation.on('automation:remediation', (event) => {
        broadcast({
            type: 'auto_remediation',
            data: event
        });
    });
    
    // Chaos experiment events
    chaosFramework.on('chaos:experiment-completed', (result) => {
        broadcast({
            type: 'chaos_experiment',
            data: result
        });
    });
}

function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes

// SLI/SLO endpoints
app.get('/api/slo/status', async (req, res) => {
    try {
        const compliance = await sliSloManager.calculateSLOCompliance();
        res.json(compliance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/slo/error-budgets', async (req, res) => {
    try {
        const budgets = await sliSloManager.getErrorBudgetReport();
        res.json(budgets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sla/report/:customerId', async (req, res) => {
    try {
        const report = await sliSloManager.getSLAReport(
            req.params.customerId,
            req.query.period || '30d'
        );
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Incident endpoints
app.get('/api/incidents', (req, res) => {
    const incidents = Array.from(incidentManager.incidents.values());
    res.json(incidents);
});

app.post('/api/incidents', async (req, res) => {
    try {
        const incident = await incidentManager.createIncident(req.body);
        res.json(incident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/incidents/:id/acknowledge', async (req, res) => {
    try {
        const incident = await incidentManager.acknowledgeIncident(
            req.params.id,
            req.body.responderId
        );
        res.json(incident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/incidents/:id/state', async (req, res) => {
    try {
        const incident = await incidentManager.updateIncidentState(
            req.params.id,
            req.body.state,
            req.body.data
        );
        res.json(incident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/incidents/:id/postmortem', async (req, res) => {
    try {
        const report = await incidentManager.createPostMortemReport(
            req.params.id,
            req.body
        );
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Automation endpoints
app.post('/api/automation/deploy', async (req, res) => {
    try {
        const deployment = await opsAutomation.deployService(
            req.body.service,
            req.body.config
        );
        res.json(deployment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/automation/scale', async (req, res) => {
    try {
        const result = await opsAutomation.scaleService(
            req.body.service,
            req.body.instances
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/automation/infrastructure', async (req, res) => {
    try {
        const result = await opsAutomation.applyInfrastructureChanges(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Chaos engineering endpoints
app.post('/api/chaos/plan', async (req, res) => {
    try {
        const plan = await chaosFramework.planExperiment(req.body);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chaos/execute', async (req, res) => {
    try {
        const execution = await chaosFramework.executeExperiment(req.body);
        res.json(execution);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/chaos/experiments', (req, res) => {
    res.json({
        active: Array.from(chaosFramework.activeExperiments.values()),
        history: chaosFramework.experimentHistory
    });
});

// Dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP SRE Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #0a0e27;
            color: #fff;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            color: #fff;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .status-badge {
            background: #00ff41;
            color: #000;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: normal;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: #1a1f3a;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 1px solid #2a3050;
        }
        .card h2 {
            margin-top: 0;
            color: #00ff41;
            font-size: 18px;
        }
        .metric {
            font-size: 36px;
            font-weight: bold;
            color: #00ff41;
            margin: 10px 0;
        }
        .metric.warning {
            color: #ffbb00;
        }
        .metric.critical {
            color: #ff0040;
        }
        .label {
            color: #8892b0;
            font-size: 14px;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #2a3050;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: #00ff41;
            transition: width 0.3s;
        }
        .progress-fill.warning {
            background: #ffbb00;
        }
        .progress-fill.critical {
            background: #ff0040;
        }
        .incident-list {
            max-height: 300px;
            overflow-y: auto;
        }
        .incident-item {
            padding: 10px;
            margin: 5px 0;
            background: #2a3050;
            border-radius: 5px;
            border-left: 4px solid #ff0040;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .incident-item.resolved {
            border-left-color: #00ff41;
            opacity: 0.7;
        }
        .severity {
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
        .critical { background: #ff0040; }
        .high { background: #ff6b00; }
        .medium { background: #ffbb00; color: #000; }
        .low { background: #00b8ff; }
        button {
            background: #00ff41;
            color: #000;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            margin: 5px;
        }
        button:hover {
            background: #00cc33;
        }
        button.danger {
            background: #ff0040;
            color: #fff;
        }
        button.danger:hover {
            background: #cc0033;
        }
        .chaos-controls {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        .ws-status {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #ff0040;
            border-radius: 50%;
            margin-right: 5px;
        }
        .ws-status.connected {
            background: #00ff41;
        }
        .event-log {
            background: #0a0e27;
            padding: 10px;
            border-radius: 5px;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            color: #8892b0;
        }
        .event-log-item {
            margin: 2px 0;
            padding: 5px;
            background: #1a1f3a;
            border-radius: 3px;
        }
        .slo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .slo-item {
            text-align: center;
            padding: 15px;
            background: #2a3050;
            border-radius: 8px;
        }
        .slo-value {
            font-size: 24px;
            font-weight: bold;
            margin: 5px 0;
        }
        .slo-target {
            font-size: 12px;
            color: #8892b0;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        .pulse {
            animation: pulse 2s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            🛡️ ROOTUIP SRE Command Center
            <span class="status-badge">OPERATIONAL</span>
            <span class="ws-status" id="wsStatus"></span>
        </h1>
        
        <div class="grid">
            <!-- Service Level Status -->
            <div class="card">
                <h2>📊 Service Level Status</h2>
                <div class="slo-grid" id="sloGrid">
                    <div class="slo-item">
                        <div class="label">Availability</div>
                        <div class="slo-value metric" id="availability">99.99%</div>
                        <div class="slo-target">Target: 99.99%</div>
                    </div>
                    <div class="slo-item">
                        <div class="label">Latency</div>
                        <div class="slo-value metric" id="latency">95.2%</div>
                        <div class="slo-target">Target: 95%</div>
                    </div>
                    <div class="slo-item">
                        <div class="label">Error Rate</div>
                        <div class="slo-value metric" id="errorRate">99.7%</div>
                        <div class="slo-target">Target: 99.5%</div>
                    </div>
                </div>
            </div>
            
            <!-- Error Budget -->
            <div class="card">
                <h2>💰 Error Budget Status</h2>
                <div id="errorBudgets"></div>
            </div>
            
            <!-- Active Incidents -->
            <div class="card">
                <h2>🚨 Active Incidents</h2>
                <div class="incident-list" id="incidentList">
                    <div style="color: #8892b0; text-align: center; padding: 20px;">
                        No active incidents
                    </div>
                </div>
                <button onclick="testIncident()">Simulate Incident</button>
            </div>
        </div>
        
        <div class="grid">
            <!-- Automation Status -->
            <div class="card">
                <h2>🤖 Automation Status</h2>
                <div style="margin: 15px 0;">
                    <div class="label">Auto-Scaling</div>
                    <div style="color: #00ff41; font-weight: bold;">ENABLED</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Auto-Healing</div>
                    <div style="color: #00ff41; font-weight: bold;">ENABLED</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Recent Actions</div>
                    <div id="automationLog" class="event-log"></div>
                </div>
                <button onclick="testAutoScale()">Test Auto-Scale</button>
                <button onclick="testRemediation()">Test Remediation</button>
            </div>
            
            <!-- Chaos Engineering -->
            <div class="card">
                <h2>🌪️ Chaos Engineering</h2>
                <div style="margin: 15px 0;">
                    <div class="label">Last Experiment</div>
                    <div id="lastExperiment" style="color: #8892b0;">None</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Resilience Score</div>
                    <div class="metric" id="resilienceScore">95</div>
                </div>
                <div class="chaos-controls">
                    <button onclick="runChaosExperiment('network.latency')">Network Latency</button>
                    <button onclick="runChaosExperiment('resource.cpuStress')">CPU Stress</button>
                    <button onclick="runChaosExperiment('application.serviceFailure')" class="danger">
                        Kill Service
                    </button>
                </div>
            </div>
            
            <!-- System Metrics -->
            <div class="card">
                <h2>📈 System Metrics</h2>
                <div style="margin: 15px 0;">
                    <div class="label">MTTR (Last 30 days)</div>
                    <div class="metric" id="mttr">12m</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Incidents This Month</div>
                    <div class="metric" id="incidentCount">3</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Deployments Today</div>
                    <div class="metric" id="deploymentCount">7</div>
                </div>
            </div>
        </div>
        
        <!-- Event Stream -->
        <div class="card" style="margin-top: 20px;">
            <h2>📡 Real-time Event Stream</h2>
            <div id="eventStream" class="event-log" style="height: 150px;"></div>
        </div>
    </div>
    
    <script>
        let ws;
        const eventStream = document.getElementById('eventStream');
        const incidentList = document.getElementById('incidentList');
        const automationLog = document.getElementById('automationLog');
        
        // Connect to WebSocket
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:8096');
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                document.getElementById('wsStatus').classList.add('connected');
                addEvent('Connected to SRE system');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleRealtimeUpdate(data);
            };
            
            ws.onclose = () => {
                document.getElementById('wsStatus').classList.remove('connected');
                addEvent('Disconnected from SRE system');
                setTimeout(connectWebSocket, 5000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
        
        connectWebSocket();
        
        // Handle real-time updates
        function handleRealtimeUpdate(data) {
            addEvent(\`\${data.type}: \${JSON.stringify(data.data).substring(0, 100)}...\`);
            
            switch (data.type) {
                case 'slo_violation':
                    updateSLOStatus(data.data);
                    break;
                    
                case 'error_budget_warning':
                    updateErrorBudget(data.data);
                    break;
                    
                case 'incident_created':
                case 'incident_updated':
                case 'incident_resolved':
                    updateIncidents();
                    break;
                    
                case 'auto_scaling':
                case 'auto_remediation':
                    updateAutomation(data.data);
                    break;
                    
                case 'chaos_experiment':
                    updateChaosStatus(data.data);
                    break;
            }
        }
        
        // Add event to stream
        function addEvent(message) {
            const item = document.createElement('div');
            item.className = 'event-log-item';
            item.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            eventStream.insertBefore(item, eventStream.firstChild);
            
            // Keep only last 50 events
            while (eventStream.children.length > 50) {
                eventStream.removeChild(eventStream.lastChild);
            }
        }
        
        // Update functions
        async function updateSLOStatus() {
            try {
                const response = await fetch('/api/slo/status');
                const data = await response.json();
                
                // Update SLO displays
                for (const [service, slos] of Object.entries(data)) {
                    for (const [slo, status] of Object.entries(slos)) {
                        updateSLODisplay(slo, status);
                    }
                }
            } catch (error) {
                console.error('Failed to update SLO status:', error);
            }
        }
        
        function updateSLODisplay(slo, status) {
            const element = document.getElementById(slo);
            if (element) {
                element.textContent = status.rate.toFixed(2) + '%';
                element.className = 'slo-value metric';
                
                if (!status.withinSLO) {
                    element.classList.add('critical');
                } else if (status.rate < status.target + 0.5) {
                    element.classList.add('warning');
                }
            }
        }
        
        async function updateErrorBudget() {
            try {
                const response = await fetch('/api/slo/error-budgets');
                const budgets = await response.json();
                
                const container = document.getElementById('errorBudgets');
                container.innerHTML = '';
                
                for (const [slo, data] of Object.entries(budgets)) {
                    const budget = data.budget;
                    const remaining = budget.remaining || 100;
                    
                    const div = document.createElement('div');
                    div.style.marginBottom = '15px';
                    
                    div.innerHTML = \`
                        <div class="label">\${data.slo.name}</div>
                        <div class="progress-bar">
                            <div class="progress-fill \${remaining < 20 ? 'critical' : remaining < 50 ? 'warning' : ''}" 
                                 style="width: \${remaining}%"></div>
                        </div>
                        <div style="font-size: 12px; color: #8892b0;">
                            \${remaining.toFixed(1)}% remaining
                        </div>
                    \`;
                    
                    container.appendChild(div);
                }
            } catch (error) {
                console.error('Failed to update error budgets:', error);
            }
        }
        
        async function updateIncidents() {
            try {
                const response = await fetch('/api/incidents');
                const incidents = await response.json();
                
                const container = document.getElementById('incidentList');
                container.innerHTML = '';
                
                if (incidents.length === 0) {
                    container.innerHTML = '<div style="color: #8892b0; text-align: center; padding: 20px;">No active incidents</div>';
                    return;
                }
                
                incidents.forEach(incident => {
                    const div = document.createElement('div');
                    div.className = \`incident-item \${incident.state === 'resolved' ? 'resolved' : ''}\`;
                    
                    div.innerHTML = \`
                        <div>
                            <div style="font-weight: bold;">\${incident.title}</div>
                            <div style="font-size: 12px; color: #8892b0;">
                                \${incident.service} - \${incident.state}
                            </div>
                        </div>
                        <span class="severity \${incident.severity.toLowerCase()}">\${incident.severity}</span>
                    \`;
                    
                    container.appendChild(div);
                });
                
                // Update incident count
                const activeCount = incidents.filter(i => i.state !== 'resolved').length;
                document.getElementById('incidentCount').textContent = activeCount;
                
                if (activeCount > 0) {
                    document.querySelector('.status-badge').textContent = 'INCIDENT ACTIVE';
                    document.querySelector('.status-badge').style.background = '#ff0040';
                    document.querySelector('.status-badge').classList.add('pulse');
                } else {
                    document.querySelector('.status-badge').textContent = 'OPERATIONAL';
                    document.querySelector('.status-badge').style.background = '#00ff41';
                    document.querySelector('.status-badge').classList.remove('pulse');
                }
                
            } catch (error) {
                console.error('Failed to update incidents:', error);
            }
        }
        
        function updateAutomation(event) {
            const item = document.createElement('div');
            item.className = 'event-log-item';
            item.textContent = \`\${event.service}: \${event.action || event.type} - \${event.reason || 'Completed'}\`;
            automationLog.insertBefore(item, automationLog.firstChild);
            
            while (automationLog.children.length > 10) {
                automationLog.removeChild(automationLog.lastChild);
            }
        }
        
        function updateChaosStatus(result) {
            document.getElementById('lastExperiment').textContent = 
                result.experiment.name + ' - ' + result.experiment.status;
            
            if (result.report && result.report.result) {
                document.getElementById('resilienceScore').textContent = 
                    Math.round(result.report.result.resilience_score || 95);
            }
        }
        
        // Test functions
        async function testIncident() {
            const incident = {
                title: 'High API Latency Detected',
                description: 'API response time exceeding SLO threshold',
                severity: 'HIGH',
                service: 'api',
                metrics: {
                    latency: 500,
                    threshold: 200
                }
            };
            
            try {
                const response = await fetch('/api/incidents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(incident)
                });
                
                if (response.ok) {
                    addEvent('Test incident created');
                }
            } catch (error) {
                console.error('Failed to create test incident:', error);
            }
        }
        
        async function testAutoScale() {
            try {
                const response = await fetch('/api/automation/scale', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        service: 'api',
                        instances: 5
                    })
                });
                
                if (response.ok) {
                    addEvent('Auto-scaling test triggered');
                }
            } catch (error) {
                console.error('Failed to test auto-scale:', error);
            }
        }
        
        async function testRemediation() {
            addEvent('Testing auto-remediation for unhealthy service');
            updateAutomation({
                service: 'api',
                action: 'restart',
                reason: 'Health check failed'
            });
        }
        
        async function runChaosExperiment(type) {
            const experiment = {
                name: \`Test \${type} experiment\`,
                description: \`Testing resilience to \${type}\`,
                hypothesis: {
                    statement: 'System remains available during chaos',
                    conditions: [
                        { metric: 'availability', operator: '>', value: 99 }
                    ]
                },
                steadyState: {
                    metrics: {
                        availability: { min: 99.9 },
                        latency: { max: 200 },
                        errorRate: { max: 1 }
                    }
                },
                chaos: {
                    type: type,
                    duration: 60000, // 1 minute
                    params: getExperimentParams(type)
                }
            };
            
            try {
                const planResponse = await fetch('/api/chaos/plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(experiment)
                });
                
                if (planResponse.ok) {
                    const plan = await planResponse.json();
                    
                    if (confirm(\`Run chaos experiment: \${plan.name}?\\n\\nThis will inject \${type} into the system.\\n\\nBlast radius: \${plan.blast_radius.risk}\`)) {
                        const execResponse = await fetch('/api/chaos/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(plan)
                        });
                        
                        if (execResponse.ok) {
                            addEvent(\`Chaos experiment started: \${type}\`);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to run chaos experiment:', error);
            }
        }
        
        function getExperimentParams(type) {
            const params = {
                'network.latency': { target: 'api', delay: 200, jitter: 50 },
                'resource.cpuStress': { usage: 80, cores: 2, duration: 60 },
                'application.serviceFailure': { service: 'api', instances: 1 }
            };
            
            return params[type] || {};
        }
        
        // Initial load
        updateSLOStatus();
        updateErrorBudget();
        updateIncidents();
        
        // Periodic updates
        setInterval(updateSLOStatus, 30000);
        setInterval(updateErrorBudget, 60000);
    </script>
</body>
</html>
    `);
});

// Start the server
async function start() {
    await initializeSRE();
    
    server.listen(PORT, () => {
        console.log(`
🛡️ ROOTUIP SRE System Started!

✅ Services Running:
- SRE Dashboard: http://localhost:${PORT}
- WebSocket Server: ws://localhost:8096
- SLI/SLO Monitoring: Active
- Incident Management: Active
- Operations Automation: Active
- Chaos Engineering: Ready

📊 Service Level Objectives:
- Availability: 99.99% (4.32 minutes/month)
- Latency: 95% < 200ms
- Error Rate: < 0.5%
- Data Durability: 99.999%

🤖 Automation Features:
- Auto-scaling based on load
- Auto-remediation for common issues
- Blue-green deployments
- Infrastructure as Code

🚨 Incident Response:
- Automated detection and creation
- On-call paging and escalation
- Runbook automation
- Post-mortem tracking

🌪️ Chaos Engineering:
- Network chaos (latency, partition)
- Resource stress (CPU, memory, disk)
- Application failures
- Data corruption simulation

💡 Quick Actions:
1. View SRE Dashboard: http://localhost:${PORT}
2. Check SLO compliance
3. Review active incidents
4. Run chaos experiments
5. Monitor error budgets

🎯 Target: 99.99% uptime with MTTR < 15 minutes
`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down SRE System...');
    
    if (sliSloManager) await sliSloManager.cleanup();
    
    wss.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    // Create critical incident
    if (incidentManager) {
        incidentManager.createIncident({
            title: 'SRE System Critical Error',
            description: error.message,
            severity: 'CRITICAL',
            service: 'sre-platform'
        });
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

// Start the application
start().catch(error => {
    console.error('Failed to start SRE System:', error);
    process.exit(1);
});