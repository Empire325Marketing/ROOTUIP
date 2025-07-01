/**
 * ROOTUIP SRE System Demo
 * Site Reliability Engineering platform demonstration
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const EventEmitter = require('events');

const app = express();
const server = http.createServer(app);
const PORT = process.env.SRE_PORT || 8095;

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8096 });

// Mock SRE System
class MockSRESystem extends EventEmitter {
    constructor() {
        super();
        
        // System state
        this.slos = {
            availability: { current: 99.99, target: 99.99, status: 'MET' },
            latency: { current: 95.2, target: 95, status: 'MET' },
            errorRate: { current: 99.7, target: 99.5, status: 'MET' }
        };
        
        this.errorBudgets = {
            availability: { remaining: 85, consumed: 15, status: 'GREEN' },
            latency: { remaining: 72, consumed: 28, status: 'GREEN' },
            errorRate: { remaining: 91, consumed: 9, status: 'GREEN' }
        };
        
        this.incidents = [];
        this.experiments = [];
        this.automationEvents = [];
        
        this.initialize();
    }
    
    initialize() {
        // Simulate real-time metric updates
        setInterval(() => {
            this.updateMetrics();
        }, 10000); // Every 10 seconds
        
        // Simulate random events
        setInterval(() => {
            this.simulateRandomEvents();
        }, 30000); // Every 30 seconds
        
        console.log('Mock SRE System initialized');
    }
    
    updateMetrics() {
        // Simulate metric fluctuations
        this.slos.availability.current = 99.95 + Math.random() * 0.05;
        this.slos.latency.current = 94 + Math.random() * 3;
        this.slos.errorRate.current = 99.3 + Math.random() * 0.7;
        
        // Update error budgets
        for (const [key, budget] of Object.entries(this.errorBudgets)) {
            budget.remaining = Math.max(0, budget.remaining - Math.random() * 0.5);
            budget.consumed = 100 - budget.remaining;
            
            if (budget.remaining < 20) {
                budget.status = 'RED';
            } else if (budget.remaining < 50) {
                budget.status = 'YELLOW';
            } else {
                budget.status = 'GREEN';
            }
        }
        
        this.emit('metrics:updated', { slos: this.slos, errorBudgets: this.errorBudgets });
    }
    
    simulateRandomEvents() {
        const events = [
            () => this.simulateAutoScale(),
            () => this.simulateRemediation(),
            () => this.simulateSLOViolation(),
            () => this.simulateDeployment()
        ];
        
        // Randomly trigger an event
        if (Math.random() < 0.3) { // 30% chance
            const event = events[Math.floor(Math.random() * events.length)];
            event();
        }
    }
    
    simulateAutoScale() {
        const services = ['api', 'ml-pipeline', 'worker'];
        const service = services[Math.floor(Math.random() * services.length)];
        const action = Math.random() > 0.5 ? 'scale-up' : 'scale-down';
        const instances = Math.floor(Math.random() * 5) + 1;
        
        const event = {
            type: 'auto_scaling',
            service,
            action,
            instances,
            reason: action === 'scale-up' ? 'High CPU usage' : 'Low resource utilization',
            timestamp: new Date()
        };
        
        this.automationEvents.unshift(event);
        this.emit('automation:scaled', event);
        
        console.log(`Auto-scaled ${service}: ${action} to ${instances} instances`);
    }
    
    simulateRemediation() {
        const services = ['api', 'database', 'cache'];
        const service = services[Math.floor(Math.random() * services.length)];
        const actions = ['restart', 'clear_cache', 'reset_connections', 'failover'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        const event = {
            type: 'auto_remediation',
            service,
            action,
            reason: 'Health check failed',
            success: Math.random() > 0.1, // 90% success rate
            timestamp: new Date()
        };
        
        this.automationEvents.unshift(event);
        this.emit('automation:remediation', event);
        
        console.log(`Auto-remediation for ${service}: ${action}`);
    }
    
    simulateSLOViolation() {
        if (Math.random() < 0.2) { // 20% chance of SLO violation
            const sloTypes = ['availability', 'latency', 'errorRate'];
            const sloType = sloTypes[Math.floor(Math.random() * sloTypes.length)];
            
            const violation = {
                type: 'slo_violation',
                slo: sloType,
                service: 'api',
                current: this.slos[sloType].current,
                target: this.slos[sloType].target,
                severity: 'HIGH',
                timestamp: new Date()
            };
            
            this.emit('slo:violation', violation);
            console.log(`SLO violation: ${sloType}`);
        }
    }
    
    simulateDeployment() {
        const services = ['api', 'frontend', 'worker'];
        const service = services[Math.floor(Math.random() * services.length)];
        
        const deployment = {
            type: 'deployment',
            service,
            version: `v1.${Math.floor(Math.random() * 100)}.0`,
            strategy: 'blue-green',
            status: 'completed',
            timestamp: new Date()
        };
        
        this.emit('deployment:completed', deployment);
        console.log(`Deployment completed: ${service} ${deployment.version}`);
    }
    
    createIncident(data) {
        const incident = {
            id: `INC-${Date.now()}`,
            title: data.title,
            description: data.description,
            severity: data.severity,
            service: data.service,
            status: 'DETECTED',
            createdAt: new Date(),
            mttr: null
        };
        
        this.incidents.unshift(incident);
        this.emit('incident:created', incident);
        
        // Auto-resolve after random time for demo
        setTimeout(() => {
            incident.status = 'RESOLVED';
            incident.mttr = Math.floor(Math.random() * 20) + 5; // 5-25 minutes
            this.emit('incident:resolved', incident);
        }, Math.random() * 60000 + 30000); // 30s - 90s for demo
        
        return incident;
    }
    
    runChaosExperiment(type, params) {
        const experiment = {
            id: `CHAOS-${Date.now()}`,
            type,
            params,
            status: 'RUNNING',
            startedAt: new Date(),
            hypothesis: `System remains stable during ${type}`,
            resilienceScore: null
        };
        
        this.experiments.unshift(experiment);
        
        // Simulate experiment completion
        setTimeout(() => {
            experiment.status = 'COMPLETED';
            experiment.completedAt = new Date();
            experiment.resilienceScore = Math.floor(Math.random() * 20) + 80; // 80-100
            experiment.result = experiment.resilienceScore > 90 ? 'PASSED' : 'FAILED';
            
            this.emit('chaos:experiment-completed', experiment);
        }, Math.random() * 30000 + 10000); // 10-40s for demo
        
        return experiment;
    }
}

// Initialize mock SRE system
const sreSystem = new MockSRESystem();

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Client connected to SRE WebSocket');
    
    ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date()
    }));
    
    // Send initial state
    ws.send(JSON.stringify({
        type: 'initial_state',
        data: {
            slos: sreSystem.slos,
            errorBudgets: sreSystem.errorBudgets,
            incidents: sreSystem.incidents.slice(0, 10),
            automationEvents: sreSystem.automationEvents.slice(0, 10)
        }
    }));
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Event listeners
sreSystem.on('metrics:updated', (data) => {
    broadcast({ type: 'metrics_updated', data });
});

sreSystem.on('slo:violation', (violation) => {
    broadcast({ type: 'slo_violation', data: violation });
});

sreSystem.on('incident:created', (incident) => {
    broadcast({ type: 'incident_created', data: incident });
});

sreSystem.on('incident:resolved', (incident) => {
    broadcast({ type: 'incident_resolved', data: incident });
});

sreSystem.on('automation:scaled', (event) => {
    broadcast({ type: 'auto_scaling', data: event });
});

sreSystem.on('automation:remediation', (event) => {
    broadcast({ type: 'auto_remediation', data: event });
});

sreSystem.on('chaos:experiment-completed', (experiment) => {
    broadcast({ type: 'chaos_experiment', data: experiment });
});

// Middleware
app.use(express.json());

// API Routes
app.get('/api/slo/status', (req, res) => {
    res.json({
        api: sreSystem.slos,
        timestamp: new Date()
    });
});

app.get('/api/slo/error-budgets', (req, res) => {
    res.json(sreSystem.errorBudgets);
});

app.get('/api/incidents', (req, res) => {
    res.json(sreSystem.incidents);
});

app.post('/api/incidents', (req, res) => {
    const incident = sreSystem.createIncident(req.body);
    res.json(incident);
});

app.post('/api/chaos/execute', (req, res) => {
    const { type, params } = req.body;
    const experiment = sreSystem.runChaosExperiment(type, params);
    res.json(experiment);
});

app.get('/api/experiments', (req, res) => {
    res.json(sreSystem.experiments);
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
        .uptime-display {
            font-size: 48px;
            font-weight: bold;
            color: #00ff41;
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            🛡️ ROOTUIP SRE Command Center
            <span class="status-badge" id="statusBadge">OPERATIONAL</span>
            <span class="ws-status" id="wsStatus"></span>
        </h1>
        
        <div class="card" style="margin-bottom: 20px;">
            <h2>🎯 Target: 99.99% Uptime | MTTR < 15 minutes</h2>
            <div class="uptime-display" id="uptimeDisplay">99.99%</div>
            <div style="text-align: center; color: #8892b0;">
                Current Uptime | Error Budget: <span id="errorBudgetSummary">72% remaining</span>
            </div>
        </div>
        
        <div class="grid">
            <!-- Service Level Status -->
            <div class="card">
                <h2>📊 Service Level Objectives</h2>
                <div class="slo-grid" id="sloGrid">
                    <div class="slo-item">
                        <div class="label">Availability</div>
                        <div class="slo-value metric" id="availability">99.99%</div>
                        <div class="slo-target">Target: ≥99.99%</div>
                    </div>
                    <div class="slo-item">
                        <div class="label">Latency (95th)</div>
                        <div class="slo-value metric" id="latency">95.2%</div>
                        <div class="slo-target">Target: ≥95% <200ms</div>
                    </div>
                    <div class="slo-item">
                        <div class="label">Success Rate</div>
                        <div class="slo-value metric" id="errorRate">99.7%</div>
                        <div class="slo-target">Target: ≥99.5%</div>
                    </div>
                </div>
            </div>
            
            <!-- Error Budget -->
            <div class="card">
                <h2>💰 Error Budget Status</h2>
                <div id="errorBudgets">
                    <div style="margin-bottom: 15px;">
                        <div class="label">Availability Budget</div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="availabilityBudget" style="width: 85%"></div>
                        </div>
                        <div style="font-size: 12px; color: #8892b0;">85% remaining (3.6 min left this month)</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <div class="label">Latency Budget</div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="latencyBudget" style="width: 72%"></div>
                        </div>
                        <div style="font-size: 12px; color: #8892b0;">72% remaining</div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <div class="label">Error Rate Budget</div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="errorRateBudget" style="width: 91%"></div>
                        </div>
                        <div style="font-size: 12px; color: #8892b0;">91% remaining</div>
                    </div>
                </div>
            </div>
            
            <!-- Active Incidents -->
            <div class="card">
                <h2>🚨 Incident Management</h2>
                <div style="margin: 15px 0;">
                    <div class="label">MTTR (30 days)</div>
                    <div class="metric" id="mttr">12m</div>
                </div>
                <div class="incident-list" id="incidentList">
                    <div style="color: #8892b0; text-align: center; padding: 20px;">
                        No active incidents
                    </div>
                </div>
                <button onclick="simulateIncident()">🚨 Simulate Incident</button>
                <button onclick="simulateSLOViolation()">⚠️ SLO Violation</button>
            </div>
        </div>
        
        <div class="grid">
            <!-- Automation Status -->
            <div class="card">
                <h2>🤖 Operations Automation</h2>
                <div style="margin: 15px 0;">
                    <div class="label">Auto-Scaling Status</div>
                    <div style="color: #00ff41; font-weight: bold;">✅ ENABLED</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Auto-Healing Status</div>
                    <div style="color: #00ff41; font-weight: bold;">✅ ENABLED</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Recent Automation</div>
                    <div id="automationLog" class="event-log"></div>
                </div>
                <button onclick="simulateAutoScale()">📈 Test Auto-Scale</button>
                <button onclick="simulateRemediation()">🔧 Test Remediation</button>
            </div>
            
            <!-- Chaos Engineering -->
            <div class="card">
                <h2>🌪️ Chaos Engineering</h2>
                <div style="margin: 15px 0;">
                    <div class="label">Last Experiment</div>
                    <div id="lastExperiment" style="color: #8892b0;">Ready to run</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">System Resilience Score</div>
                    <div class="metric" id="resilienceScore">95</div>
                </div>
                <div class="chaos-controls">
                    <button onclick="runChaosExperiment('network-latency')">🌐 Network Latency</button>
                    <button onclick="runChaosExperiment('cpu-stress')">💻 CPU Stress</button>
                    <button onclick="runChaosExperiment('service-failure')" class="danger">
                        💥 Kill Service
                    </button>
                </div>
            </div>
            
            <!-- System Health -->
            <div class="card">
                <h2>📈 System Health</h2>
                <div style="margin: 15px 0;">
                    <div class="label">Deployments Today</div>
                    <div class="metric" id="deploymentCount">7</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Success Rate</div>
                    <div class="metric">100%</div>
                </div>
                <div style="margin: 15px 0;">
                    <div class="label">Auto-Recovery Events</div>
                    <div class="metric" id="recoveryCount">3</div>
                </div>
                <button onclick="simulateDeployment()">🚀 Test Deployment</button>
            </div>
        </div>
        
        <!-- Real-time Event Stream -->
        <div class="card" style="margin-top: 20px;">
            <h2>📡 Real-time SRE Event Stream</h2>
            <div id="eventStream" class="event-log" style="height: 150px;"></div>
        </div>
    </div>
    
    <script>
        let ws;
        let eventStream = document.getElementById('eventStream');
        let incidentCount = 0;
        let deploymentCount = 7;
        let recoveryCount = 3;
        
        // Connect to WebSocket
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:8096');
            
            ws.onopen = () => {
                console.log('Connected to SRE WebSocket');
                document.getElementById('wsStatus').classList.add('connected');
                addEvent('🔗 Connected to SRE monitoring system');
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleRealtimeUpdate(data);
            };
            
            ws.onclose = () => {
                document.getElementById('wsStatus').classList.remove('connected');
                addEvent('❌ Disconnected from SRE system');
                setTimeout(connectWebSocket, 5000);
            };
        }
        
        connectWebSocket();
        
        // Handle real-time updates
        function handleRealtimeUpdate(data) {
            switch (data.type) {
                case 'connected':
                    break;
                    
                case 'initial_state':
                    updateSLODisplay(data.data.slos);
                    updateErrorBudgets(data.data.errorBudgets);
                    updateIncidentsList(data.data.incidents);
                    updateAutomationLog(data.data.automationEvents);
                    break;
                    
                case 'metrics_updated':
                    updateSLODisplay(data.data.slos);
                    updateErrorBudgets(data.data.errorBudgets);
                    break;
                    
                case 'slo_violation':
                    addEvent(\`⚠️ SLO Violation: \${data.data.slo} (\${data.data.current.toFixed(2)}% vs \${data.data.target}%)\`);
                    break;
                    
                case 'incident_created':
                    incidentCount++;
                    addEvent(\`🚨 Incident Created: \${data.data.title} [ID: \${data.data.id}]\`);
                    updateIncidentsCount();
                    break;
                    
                case 'incident_resolved':
                    addEvent(\`✅ Incident Resolved: \${data.data.title} (MTTR: \${data.data.mttr}m)\`);
                    updateMTTR(data.data.mttr);
                    break;
                    
                case 'auto_scaling':
                    addEvent(\`📈 Auto-scaling: \${data.data.service} \${data.data.action} to \${data.data.instances} instances\`);
                    break;
                    
                case 'auto_remediation':
                    recoveryCount++;
                    addEvent(\`🔧 Auto-remediation: \${data.data.action} on \${data.data.service} - \${data.data.success ? 'SUCCESS' : 'FAILED'}\`);
                    document.getElementById('recoveryCount').textContent = recoveryCount;
                    break;
                    
                case 'chaos_experiment':
                    const exp = data.data;
                    addEvent(\`🌪️ Chaos Experiment: \${exp.type} - \${exp.result} (Score: \${exp.resilienceScore})\`);
                    document.getElementById('lastExperiment').textContent = \`\${exp.type} - \${exp.result}\`;
                    document.getElementById('resilienceScore').textContent = exp.resilienceScore;
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
        function updateSLODisplay(slos) {
            document.getElementById('availability').textContent = slos.availability.current.toFixed(2) + '%';
            document.getElementById('latency').textContent = slos.latency.current.toFixed(1) + '%';
            document.getElementById('errorRate').textContent = slos.errorRate.current.toFixed(1) + '%';
            
            // Update main uptime display
            document.getElementById('uptimeDisplay').textContent = slos.availability.current.toFixed(2) + '%';
            
            // Update status badges based on SLO compliance
            updateStatusBadge(slos);
        }
        
        function updateStatusBadge(slos) {
            const badge = document.getElementById('statusBadge');
            const allMet = Object.values(slos).every(slo => slo.status === 'MET');
            
            if (allMet) {
                badge.textContent = 'OPERATIONAL';
                badge.style.background = '#00ff41';
                badge.style.color = '#000';
                badge.classList.remove('pulse');
            } else {
                badge.textContent = 'SLO BREACH';
                badge.style.background = '#ff0040';
                badge.style.color = '#fff';
                badge.classList.add('pulse');
            }
        }
        
        function updateErrorBudgets(budgets) {
            for (const [key, budget] of Object.entries(budgets)) {
                const element = document.getElementById(key + 'Budget');
                if (element) {
                    element.style.width = budget.remaining + '%';
                    element.className = 'progress-fill';
                    
                    if (budget.remaining < 20) {
                        element.classList.add('critical');
                    } else if (budget.remaining < 50) {
                        element.classList.add('warning');
                    }
                }
            }
            
            // Update summary
            const avgRemaining = Object.values(budgets).reduce((sum, b) => sum + b.remaining, 0) / Object.keys(budgets).length;
            document.getElementById('errorBudgetSummary').textContent = \`\${avgRemaining.toFixed(0)}% remaining\`;
        }
        
        function updateIncidentsList(incidents) {
            const container = document.getElementById('incidentList');
            container.innerHTML = '';
            
            if (incidents.length === 0) {
                container.innerHTML = '<div style="color: #8892b0; text-align: center; padding: 20px;">No active incidents - System healthy ✅</div>';
                return;
            }
            
            incidents.slice(0, 5).forEach(incident => {
                const div = document.createElement('div');
                div.className = \`incident-item \${incident.status === 'RESOLVED' ? 'resolved' : ''}\`;
                
                div.innerHTML = \`
                    <div>
                        <div style="font-weight: bold;">\${incident.title}</div>
                        <div style="font-size: 12px; color: #8892b0;">
                            \${incident.service} - \${incident.status} - \${new Date(incident.createdAt).toLocaleTimeString()}
                        </div>
                    </div>
                    <span class="severity \${incident.severity.toLowerCase()}">\${incident.severity}</span>
                \`;
                
                container.appendChild(div);
            });
        }
        
        function updateAutomationLog(events) {
            const container = document.getElementById('automationLog');
            container.innerHTML = '';
            
            events.slice(0, 8).forEach(event => {
                const div = document.createElement('div');
                div.className = 'event-log-item';
                div.textContent = \`\${event.service}: \${event.action} - \${event.reason}\`;
                container.appendChild(div);
            });
        }
        
        function updateIncidentsCount() {
            // Update status if incidents are active
            if (incidentCount > 0) {
                const badge = document.getElementById('statusBadge');
                badge.textContent = 'INCIDENT ACTIVE';
                badge.style.background = '#ff0040';
                badge.classList.add('pulse');
            }
        }
        
        function updateMTTR(mttr) {
            document.getElementById('mttr').textContent = mttr + 'm';
        }
        
        // Test functions
        async function simulateIncident() {
            const incidents = [
                { title: 'API Latency Spike', description: 'Response time exceeding 500ms', severity: 'HIGH', service: 'api' },
                { title: 'Database Connection Pool Exhausted', description: 'Cannot acquire new connections', severity: 'CRITICAL', service: 'database' },
                { title: 'High Error Rate', description: '5xx errors above threshold', severity: 'HIGH', service: 'api' },
                { title: 'Memory Leak Detected', description: 'Memory usage growing continuously', severity: 'MEDIUM', service: 'worker' }
            ];
            
            const incident = incidents[Math.floor(Math.random() * incidents.length)];
            
            try {
                const response = await fetch('/api/incidents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(incident)
                });
                
                if (response.ok) {
                    addEvent(\`🎭 Simulated incident: \${incident.title}\`);
                }
            } catch (error) {
                console.error('Failed to create incident:', error);
            }
        }
        
        function simulateSLOViolation() {
            const violations = ['availability', 'latency', 'errorRate'];
            const violation = violations[Math.floor(Math.random() * violations.length)];
            addEvent(\`⚠️ Simulated SLO violation: \${violation}\`);
        }
        
        function simulateAutoScale() {
            addEvent('📈 Triggered auto-scaling test');
        }
        
        function simulateRemediation() {
            addEvent('🔧 Triggered auto-remediation test');
        }
        
        function simulateDeployment() {
            deploymentCount++;
            document.getElementById('deploymentCount').textContent = deploymentCount;
            addEvent('🚀 Simulated deployment completed');
        }
        
        async function runChaosExperiment(type) {
            if (confirm(\`Run chaos experiment: \${type}?\\n\\nThis will test system resilience by injecting controlled failures.\`)) {
                try {
                    const response = await fetch('/api/chaos/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, params: {} })
                    });
                    
                    if (response.ok) {
                        addEvent(\`🌪️ Started chaos experiment: \${type}\`);
                        document.getElementById('lastExperiment').textContent = \`\${type} - RUNNING\`;
                    }
                } catch (error) {
                    console.error('Failed to run chaos experiment:', error);
                }
            }
        }
        
        // Initial load
        addEvent('🛡️ SRE System initialized - Target: 99.99% uptime, MTTR < 15min');
        addEvent('📊 Monitoring SLOs: Availability, Latency, Error Rate');
        addEvent('🤖 Automation enabled: Auto-scaling, Auto-healing, Auto-remediation');
        addEvent('🌪️ Chaos engineering ready for resilience testing');
    </script>
</body>
</html>
    `);
});

// Start server
server.listen(PORT, () => {
    console.log(`
🛡️ ROOTUIP SRE System Demo Started!

✅ Services Running:
- SRE Dashboard: http://localhost:${PORT}
- WebSocket Stream: ws://localhost:8096
- Demo Mode: Fully functional without external dependencies

📊 Service Level Objectives:
- Availability: 99.99% uptime (4.32 minutes/month error budget)
- Latency: 95% of requests under 200ms
- Error Rate: 99.5% success rate
- Target MTTR: Under 15 minutes

🚨 Incident Response Features:
- Automated detection and creation
- Real-time escalation procedures
- Runbook automation
- Post-incident review process

🤖 Operations Automation:
- Auto-scaling based on load patterns
- Auto-healing for service failures
- Blue-green deployment strategies
- Infrastructure as code management

🌪️ Chaos Engineering:
- Network latency injection
- Resource stress testing
- Service failure simulation
- Resilience scoring and reporting

💡 Try It Out:
1. Open http://localhost:${PORT} for the SRE dashboard
2. Click buttons to simulate incidents, scaling, chaos experiments
3. Watch real-time updates via WebSocket
4. Monitor SLO compliance and error budgets

🎯 Demonstrating: 99.99% uptime target with MTTR under 15 minutes
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down SRE demo...');
    
    wss.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});