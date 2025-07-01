/**
 * ROOTUIP Notification System Demo
 * Demonstration without external dependencies
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const EventEmitter = require('events');

const app = express();
const server = http.createServer(app);
const PORT = process.env.NOTIFICATION_PORT || 8092;

// Mock Notification Service
class MockNotificationService extends EventEmitter {
    constructor() {
        super();
        this.channels = new Map();
        this.notificationQueue = [];
        this.setupChannels();
    }
    
    setupChannels() {
        // Mock channels
        this.channels.set('email', { name: 'Email', active: true });
        this.channels.set('sms', { name: 'SMS', active: true });
        this.channels.set('push', { name: 'Push', active: true });
        this.channels.set('slack', { name: 'Slack', active: true });
        this.channels.set('websocket', { name: 'WebSocket', active: true });
    }
    
    async sendNotification(notification) {
        const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const enrichedNotification = {
            id,
            ...notification,
            timestamp: new Date(),
            status: 'queued'
        };
        
        this.notificationQueue.push(enrichedNotification);
        
        // Simulate processing
        setTimeout(() => {
            this.processNotification(enrichedNotification);
        }, Math.random() * 2000 + 500);
        
        return { id, status: 'queued' };
    }
    
    processNotification(notification) {
        // Simulate channel delivery
        const channels = notification.channels || ['email'];
        const results = [];
        
        channels.forEach(channel => {
            const success = Math.random() > 0.1; // 90% success rate
            results.push({
                channel,
                success,
                timestamp: new Date()
            });
            
            if (channel === 'websocket' && wsServer) {
                // Send via WebSocket
                wsServer.broadcast(JSON.stringify({
                    type: 'notification',
                    data: notification
                }));
            }
        });
        
        notification.status = 'delivered';
        notification.results = results;
        
        this.emit('notification:sent', { notification, results });
    }
}

// Mock Alert Manager
class MockAlertManager extends EventEmitter {
    constructor() {
        super();
        this.alerts = [];
    }
    
    async processAlert(alert) {
        const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const processedAlert = {
            id,
            ...alert,
            timestamp: new Date(),
            status: 'active',
            acknowledged: false,
            riskScore: this.calculateRiskScore(alert)
        };
        
        this.alerts.push(processedAlert);
        this.emit('alert:created', processedAlert);
        
        return processedAlert;
    }
    
    calculateRiskScore(alert) {
        const severityScores = {
            critical: 100,
            high: 75,
            medium: 50,
            low: 25,
            info: 10
        };
        return severityScores[alert.severity] || 50;
    }
}

// Mock Analytics
class MockAnalytics {
    constructor() {
        this.metrics = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            failed: 0
        };
        
        this.channelMetrics = {};
    }
    
    async trackEvent(event, data) {
        this.metrics[event] = (this.metrics[event] || 0) + 1;
        
        if (data.channel) {
            if (!this.channelMetrics[data.channel]) {
                this.channelMetrics[data.channel] = {
                    sent: 0,
                    delivered: 0,
                    opened: 0,
                    failed: 0
                };
            }
            this.channelMetrics[data.channel][event]++;
        }
    }
    
    async getDashboardData() {
        const totalSent = this.metrics.sent || 1;
        
        return {
            summary: {
                totalSent: this.metrics.sent,
                deliveryRate: this.metrics.delivered / totalSent,
                openRate: this.metrics.opened / this.metrics.delivered || 0,
                clickRate: this.metrics.clicked / this.metrics.opened || 0,
                failureRate: this.metrics.failed / totalSent
            },
            byChannel: this.channelMetrics,
            trends: this.generateTrends(),
            recommendations: this.generateRecommendations()
        };
    }
    
    generateTrends() {
        // Generate mock trend data
        const hours = [];
        const now = new Date();
        
        for (let i = 23; i >= 0; i--) {
            const hour = new Date(now.getTime() - i * 3600000);
            hours.push({
                hour: hour.getHours(),
                sent: Math.floor(Math.random() * 100) + 50,
                delivered: Math.floor(Math.random() * 90) + 45,
                opened: Math.floor(Math.random() * 50) + 20
            });
        }
        
        return hours;
    }
    
    generateRecommendations() {
        return [
            {
                type: 'timing',
                message: 'Best engagement observed between 9-11 AM',
                severity: 'info'
            },
            {
                type: 'channel',
                message: 'Push notifications have 23% higher open rate than email',
                severity: 'info'
            },
            {
                type: 'content',
                message: 'Shorter subject lines (< 50 chars) perform better',
                severity: 'info'
            }
        ];
    }
}

// Initialize services
const notificationService = new MockNotificationService();
const alertManager = new MockAlertManager();
const analytics = new MockAnalytics();

// WebSocket server
const wsServer = new WebSocket.Server({ port: 8091 });

wsServer.broadcast = function(data) {
    wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

wsServer.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date()
    }));
    
    ws.on('message', (message) => {
        console.log('Received:', message.toString());
    });
});

// Track notification events
notificationService.on('notification:sent', async (data) => {
    await analytics.trackEvent('sent', data.notification);
    data.results.forEach(result => {
        if (result.success) {
            analytics.trackEvent('delivered', {
                ...data.notification,
                channel: result.channel
            });
        } else {
            analytics.trackEvent('failed', {
                ...data.notification,
                channel: result.channel
            });
        }
    });
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.post('/api/notifications/send', async (req, res) => {
    try {
        const result = await notificationService.sendNotification(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/alerts/create', async (req, res) => {
    try {
        const alert = await alertManager.processAlert(req.body);
        
        // Send notification for alert
        await notificationService.sendNotification({
            type: 'alert',
            severity: alert.severity,
            title: `${alert.severity.toUpperCase()} Alert: ${alert.type}`,
            message: alert.message,
            channels: alert.severity === 'critical' ? 
                ['email', 'sms', 'push', 'websocket'] : 
                ['email', 'websocket'],
            data: alert
        });
        
        res.json(alert);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/events/trigger', async (req, res) => {
    try {
        const event = req.body;
        
        // Process different event types
        switch (event.type) {
            case 'dd_risk_detected':
                await handleDDRiskEvent(event.data);
                break;
            case 'container_delayed':
                await handleContainerDelayEvent(event.data);
                break;
            case 'milestone_achieved':
                await handleMilestoneEvent(event.data);
                break;
            default:
                console.log('Unknown event type:', event.type);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/analytics/dashboard', async (req, res) => {
    try {
        const data = await analytics.getDashboardData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notifications/:id/track', async (req, res) => {
    try {
        const { event, data } = req.body;
        await analytics.trackEvent(event, {
            notificationId: req.params.id,
            ...data
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Event Handlers
async function handleDDRiskEvent(data) {
    const alert = await alertManager.processAlert({
        type: 'dd_risk',
        severity: data.severity,
        message: `D&D risk detected for ${data.entity.name}: ${data.severity} severity (score: ${data.riskScore})`,
        entityType: data.entity.type,
        entityId: data.entity.id,
        riskScore: data.riskScore,
        context: data
    });
    
    // Send executive notification if critical
    if (data.severity === 'critical' || data.riskScore >= 80) {
        await notificationService.sendNotification({
            type: 'dd_risk_critical',
            severity: 'critical',
            title: `🚨 Critical D&D Risk: ${data.entity.name}`,
            message: `Immediate attention required. Risk score: ${data.riskScore}/100`,
            channels: ['email', 'sms', 'push', 'slack', 'websocket'],
            priority: 1,
            data: alert
        });
    }
}

async function handleContainerDelayEvent(data) {
    await alertManager.processAlert({
        type: 'container_delayed',
        severity: data.delayHours > 24 ? 'high' : 'medium',
        message: `Container ${data.container.id} delayed by ${data.delayHours} hours`,
        containerId: data.container.id,
        context: data
    });
}

async function handleMilestoneEvent(data) {
    await notificationService.sendNotification({
        type: 'milestone',
        severity: 'info',
        title: `🎉 ${data.customer.name} Achievement!`,
        message: data.milestone.message,
        channels: ['email', 'websocket'],
        data: data
    });
}

// Demo Dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Notification System Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #333;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status-badge {
            background: #4CAF50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: normal;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .channels {
            display: flex;
            gap: 10px;
            margin: 20px 0;
        }
        .channel {
            padding: 10px 20px;
            border-radius: 5px;
            background: #e3f2fd;
            color: #1976d2;
            font-weight: 500;
        }
        .channel.active {
            background: #1976d2;
            color: white;
        }
        button {
            background: #0066CC;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background: #0052A3;
        }
        .severity {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 5px;
        }
        .critical { background: #ffebee; color: #c62828; }
        .high { background: #fff3e0; color: #e65100; }
        .medium { background: #fffde7; color: #f57f17; }
        .low { background: #e8f5e9; color: #2e7d32; }
        .info { background: #e3f2fd; color: #1976d2; }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .metric-value {
            font-size: 36px;
            font-weight: bold;
            color: #0066CC;
        }
        .metric-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        #notifications {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
            background: #fafafa;
        }
        .notification-item {
            padding: 15px;
            margin: 5px 0;
            background: white;
            border-radius: 5px;
            border-left: 4px solid #0066CC;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        .notification-time {
            font-size: 12px;
            color: #999;
        }
        .ws-status {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }
        .connected { background: #e8f5e9; color: #2e7d32; }
        .disconnected { background: #ffebee; color: #c62828; }
        .demo-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        @media (max-width: 768px) {
            .demo-grid {
                grid-template-columns: 1fr;
            }
        }
        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 13px;
        }
        .feature-list {
            list-style: none;
            padding: 0;
        }
        .feature-list li {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
        }
        .feature-list li:before {
            content: "✓";
            color: #4CAF50;
            font-weight: bold;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>
            🔔 ROOTUIP Notification System
            <span class="status-badge">DEMO MODE</span>
        </h1>
        
        <div class="card">
            <h2>Active Channels</h2>
            <div class="channels">
                <div class="channel active">📧 Email</div>
                <div class="channel active">📱 SMS</div>
                <div class="channel active">🔔 Push</div>
                <div class="channel active">💬 Slack</div>
                <div class="channel active">🔌 WebSocket</div>
            </div>
            <p>WebSocket Status: <span id="wsStatus" class="ws-status disconnected">Disconnected</span></p>
        </div>
        
        <div class="demo-grid">
            <div class="card">
                <h2>System Metrics</h2>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value" id="totalSent">0</div>
                        <div class="metric-label">Notifications Sent</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="deliveryRate">0%</div>
                        <div class="metric-label">Delivery Rate</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="openRate">0%</div>
                        <div class="metric-label">Open Rate</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value" id="activeAlerts">0</div>
                        <div class="metric-label">Active Alerts</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>Key Features</h2>
                <ul class="feature-list">
                    <li>Multi-channel notification delivery</li>
                    <li>Risk-based alert prioritization</li>
                    <li>Smart alert grouping & fatigue prevention</li>
                    <li>Real-time WebSocket updates</li>
                    <li>Business event notifications</li>
                    <li>Analytics & engagement tracking</li>
                </ul>
            </div>
        </div>
        
        <div class="card">
            <h2>Test Notifications</h2>
            <div class="demo-section">
                <h3>Business Events</h3>
                <button onclick="triggerDDRisk('critical')">
                    <span class="severity critical">CRITICAL</span> D&D Risk Alert
                </button>
                <button onclick="triggerDDRisk('high')">
                    <span class="severity high">HIGH</span> D&D Risk Alert
                </button>
                <button onclick="triggerContainerDelay()">Container Delay Notification</button>
                <button onclick="triggerIntegrationFailure()">Integration Failure</button>
                <button onclick="triggerMilestone()">Customer Milestone</button>
            </div>
            
            <div class="demo-section">
                <h3>System Alerts</h3>
                <button onclick="createAlert('critical', 'system_down')">System Outage</button>
                <button onclick="createAlert('high', 'performance')">Performance Issue</button>
                <button onclick="createAlert('medium', 'threshold')">Threshold Warning</button>
                <button onclick="createAlert('info', 'update')">System Update</button>
            </div>
        </div>
        
        <div class="card">
            <h2>Live Notifications</h2>
            <div id="notifications">
                <div class="notification-item">
                    <div class="notification-header">
                        <strong>Waiting for notifications...</strong>
                        <span class="notification-time">--:--:--</span>
                    </div>
                    <div>Connect to WebSocket to receive real-time updates</div>
                </div>
            </div>
        </div>
        
        <div class="demo-grid">
            <div class="card">
                <h3>Sample: Send Notification</h3>
                <pre>POST /api/notifications/send
{
  "type": "container_update",
  "severity": "high",
  "title": "Container MSKU1234567 Status",
  "message": "Container delayed by 12 hours",
  "channels": ["email", "push", "sms"],
  "userId": "user123"
}</pre>
            </div>
            
            <div class="card">
                <h3>Sample: Create Alert</h3>
                <pre>POST /api/alerts/create
{
  "type": "dd_risk",
  "severity": "critical",
  "message": "High D&D risk detected",
  "riskScore": 85,
  "entityId": "SHIP123"
}</pre>
            </div>
        </div>
    </div>
    
    <script>
        let ws;
        let notificationCount = 0;
        
        // Connect to WebSocket
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:8091');
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                document.getElementById('wsStatus').textContent = 'Connected';
                document.getElementById('wsStatus').className = 'ws-status connected';
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'notification') {
                    displayNotification(data.data);
                }
            };
            
            ws.onclose = () => {
                document.getElementById('wsStatus').textContent = 'Disconnected';
                document.getElementById('wsStatus').className = 'ws-status disconnected';
                setTimeout(connectWebSocket, 5000); // Reconnect
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
        
        connectWebSocket();
        
        // Update metrics
        async function updateMetrics() {
            try {
                const response = await fetch('/api/analytics/dashboard');
                const data = await response.json();
                
                document.getElementById('totalSent').textContent = data.summary.totalSent || 0;
                document.getElementById('deliveryRate').textContent = 
                    ((data.summary.deliveryRate || 0) * 100).toFixed(1) + '%';
                document.getElementById('openRate').textContent = 
                    ((data.summary.openRate || 0) * 100).toFixed(1) + '%';
                document.getElementById('activeAlerts').textContent = 
                    window.activeAlerts || 0;
            } catch (error) {
                console.error('Failed to update metrics:', error);
            }
        }
        
        setInterval(updateMetrics, 5000);
        updateMetrics();
        
        // Display notification
        function displayNotification(notification) {
            notificationCount++;
            const container = document.getElementById('notifications');
            
            if (notificationCount === 1) {
                container.innerHTML = ''; // Clear placeholder
            }
            
            const item = document.createElement('div');
            item.className = 'notification-item';
            
            const time = new Date().toLocaleTimeString();
            const severity = notification.severity || 'info';
            
            item.innerHTML = \`
                <div class="notification-header">
                    <strong>\${notification.title || notification.type}</strong>
                    <span class="notification-time">\${time}</span>
                </div>
                <div>\${notification.message}</div>
                <div style="margin-top: 5px;">
                    <small>
                        <span class="severity \${severity}">\${severity.toUpperCase()}</span>
                        | Channels: \${(notification.channels || ['email']).join(', ')}
                    </small>
                </div>
            \`;
            
            container.insertBefore(item, container.firstChild);
            
            // Keep only last 20 notifications
            while (container.children.length > 20) {
                container.removeChild(container.lastChild);
            }
            
            // Update active alerts counter
            if (notification.type === 'alert') {
                window.activeAlerts = (window.activeAlerts || 0) + 1;
                updateMetrics();
            }
        }
        
        // Test functions
        async function triggerDDRisk(severity) {
            const response = await fetch('/api/events/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'dd_risk_detected',
                    data: {
                        entity: {
                            type: 'shipment',
                            id: 'SHIP' + Math.random().toString(36).substr(2, 9),
                            name: 'Container Group Shanghai-LA',
                            containerCount: 50,
                            value: 2500000
                        },
                        riskScore: severity === 'critical' ? 85 : 65,
                        severity: severity,
                        factors: [
                            { category: 'weather', description: 'Storm warning', score: 30 },
                            { category: 'port', description: 'Port congestion', score: 25 }
                        ],
                        location: 'Pacific Ocean'
                    }
                })
            });
            
            if (response.ok) {
                console.log('D&D Risk alert triggered');
            }
        }
        
        async function triggerContainerDelay() {
            const response = await fetch('/api/events/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'container_delayed',
                    data: {
                        container: {
                            id: 'CONT' + Math.random().toString(36).substr(2, 9),
                            customer: 'Acme Corp',
                            origin: 'Shanghai',
                            destination: 'Los Angeles'
                        },
                        delayHours: Math.floor(Math.random() * 24) + 12,
                        reason: 'Port congestion',
                        newETA: new Date(Date.now() + 48 * 3600000).toISOString()
                    }
                })
            });
            
            if (response.ok) {
                console.log('Container delay notification sent');
            }
        }
        
        async function triggerIntegrationFailure() {
            const response = await fetch('/api/alerts/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'integration_failure',
                    severity: 'high',
                    message: 'Maersk API integration failed',
                    context: {
                        integration: 'Maersk API',
                        error: 'Authentication failed',
                        lastSuccess: new Date(Date.now() - 3600000)
                    }
                })
            });
            
            if (response.ok) {
                console.log('Integration failure alert sent');
            }
        }
        
        async function triggerMilestone() {
            const response = await fetch('/api/events/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'milestone_achieved',
                    data: {
                        customer: {
                            id: 'CUST123',
                            name: 'Global Logistics Inc'
                        },
                        milestone: {
                            name: '1000 Shipments',
                            message: 'Congratulations on 1000 successful shipments!'
                        }
                    }
                })
            });
            
            if (response.ok) {
                console.log('Milestone notification sent');
            }
        }
        
        async function createAlert(severity, type) {
            const alerts = {
                system_down: {
                    message: 'Critical system component is down',
                    component: 'Payment Gateway'
                },
                performance: {
                    message: 'API response time exceeding threshold',
                    component: 'Container Tracking API'
                },
                threshold: {
                    message: 'Database connections approaching limit',
                    metric: 'connections',
                    value: 850,
                    threshold: 1000
                },
                update: {
                    message: 'System maintenance scheduled',
                    details: 'Maintenance window: Saturday 2 AM - 4 AM PST'
                }
            };
            
            const response = await fetch('/api/alerts/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: type,
                    severity: severity,
                    ...alerts[type]
                })
            });
            
            if (response.ok) {
                console.log(\`\${severity} alert created\`);
            }
        }
        
        // Initialize
        window.activeAlerts = 0;
    </script>
</body>
</html>
    `);
});

// Start server
server.listen(PORT, () => {
    console.log(`
🔔 ROOTUIP Notification System Demo Started!

✅ Services Running:
- API Server: http://localhost:${PORT}
- WebSocket Server: ws://localhost:8091
- Demo Dashboard: http://localhost:${PORT}

📊 Features Demonstrated:
- Multi-channel notifications (Email, SMS, Push, Slack, WebSocket)
- Risk-based alert prioritization
- Business event notifications
- Real-time WebSocket updates
- Analytics dashboard
- Alert management

🎯 Notification Types:
- D&D Risk Alerts
- Container Status Updates
- System Performance Alerts
- Integration Failures
- Customer Milestones

💡 Try It Out:
1. Open http://localhost:${PORT} in your browser
2. Click the test buttons to trigger notifications
3. Watch real-time updates via WebSocket
4. Check metrics dashboard

📝 API Endpoints:
- POST /api/notifications/send - Send notification
- POST /api/alerts/create - Create alert
- POST /api/events/trigger - Trigger business event
- GET /api/analytics/dashboard - View analytics

🔧 Note: This is a demo version without external dependencies.
For production use, configure real email, SMS, and push services.
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down notification demo...');
    
    wsServer.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});