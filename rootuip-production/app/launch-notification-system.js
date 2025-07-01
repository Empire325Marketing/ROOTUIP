/**
 * ROOTUIP Notification System Launcher
 * Comprehensive notification and alerting platform
 */

const express = require('express');
const http = require('http');
const NotificationService = require('./notification-system/notification-service');
const AlertManager = require('./notification-system/alert-manager');
const BusinessEventNotifier = require('./notification-system/business-event-notifier');
const NotificationAnalytics = require('./notification-system/notification-analytics');

const app = express();
const server = http.createServer(app);
const PORT = process.env.NOTIFICATION_PORT || 8092;

// Initialize services
let notificationService;
let alertManager;
let businessEventNotifier;
let analytics;

async function initializeServices() {
    try {
        // Initialize notification service
        notificationService = new NotificationService({
            email: {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: 587,
                auth: {
                    user: process.env.SMTP_USER || 'demo@rootuip.com',
                    pass: process.env.SMTP_PASS || 'demo-password'
                }
            }
        });
        
        // Initialize alert manager
        alertManager = new AlertManager(notificationService);
        
        // Initialize business event notifier
        businessEventNotifier = new BusinessEventNotifier(notificationService, alertManager);
        
        // Initialize analytics
        analytics = new NotificationAnalytics();
        
        // Connect services
        setupEventHandlers();
        
        console.log('All notification services initialized successfully');
    } catch (error) {
        console.error('Failed to initialize services:', error);
        process.exit(1);
    }
}

// Setup event handlers
function setupEventHandlers() {
    // Track notification events
    notificationService.on('notification:sent', async (data) => {
        await analytics.trackEvent('sent', data.notification);
    });
    
    notificationService.on('notification:failed', async (data) => {
        await analytics.trackEvent('failed', {
            ...data.notification,
            error: data.error
        });
    });
    
    // Track alert events
    alertManager.on('alert:created', async (alert) => {
        await businessEventNotifier.processEvent({
            type: alert.type,
            data: alert
        });
    });
    
    // Track delivery confirmations
    app.post('/webhooks/email/delivered', async (req, res) => {
        await analytics.trackEvent('delivered', {
            notificationId: req.body.notificationId,
            channel: 'email',
            deliveryTime: Date.now() - new Date(req.body.sentAt).getTime()
        });
        res.sendStatus(200);
    });
    
    app.post('/webhooks/sms/status', async (req, res) => {
        const status = req.body.MessageStatus;
        if (status === 'delivered') {
            await analytics.trackEvent('delivered', {
                notificationId: req.body.notificationId,
                channel: 'sms'
            });
        } else if (status === 'failed') {
            await analytics.trackEvent('failed', {
                notificationId: req.body.notificationId,
                channel: 'sms',
                error: req.body.ErrorMessage
            });
        }
        res.sendStatus(200);
    });
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Send notification
app.post('/api/notifications/send', async (req, res) => {
    try {
        const result = await notificationService.sendNotification(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create alert
app.post('/api/alerts/create', async (req, res) => {
    try {
        const alert = await alertManager.processAlert(req.body);
        res.json(alert);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger business event
app.post('/api/events/trigger', async (req, res) => {
    try {
        await businessEventNotifier.processEvent(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get analytics dashboard
app.get('/api/analytics/dashboard', async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const data = await analytics.getDashboardData(timeRange);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user preferences
app.get('/api/users/:userId/preferences', async (req, res) => {
    try {
        const preferences = await notificationService.getUserPreferences(req.params.userId);
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user preferences
app.put('/api/users/:userId/preferences', async (req, res) => {
    try {
        await notificationService.updateUserPreferences(req.params.userId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Track engagement
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

// Demo dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Notification System</title>
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
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .demo-section {
            margin: 20px 0;
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
        .alert-type {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            margin: 2px;
        }
        .critical { background: #ffebee; color: #c62828; }
        .high { background: #fff3e0; color: #e65100; }
        .medium { background: #fffde7; color: #f57f17; }
        .low { background: #e8f5e9; color: #2e7d32; }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #0066CC;
        }
        .metric-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        pre {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        #notifications {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        .notification-item {
            padding: 10px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 5px;
            border-left: 3px solid #0066CC;
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
    </style>
</head>
<body>
    <div class="container">
        <h1>🔔 ROOTUIP Notification System</h1>
        
        <div class="card">
            <h2>System Status</h2>
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
            <div>
                WebSocket Status: <span id="wsStatus" class="ws-status disconnected">Disconnected</span>
            </div>
        </div>
        
        <div class="card">
            <h2>Test Notifications</h2>
            <div class="demo-section">
                <h3>Business Events</h3>
                <button onclick="triggerDDRisk()">Trigger D&D Risk Alert</button>
                <button onclick="triggerContainerDelay()">Trigger Container Delay</button>
                <button onclick="triggerIntegrationFailure()">Trigger Integration Failure</button>
                <button onclick="triggerMilestone()">Trigger Customer Milestone</button>
            </div>
            
            <div class="demo-section">
                <h3>System Alerts</h3>
                <button onclick="createAlert('critical')">
                    <span class="alert-type critical">CRITICAL</span> System Down
                </button>
                <button onclick="createAlert('high')">
                    <span class="alert-type high">HIGH</span> Performance Issue
                </button>
                <button onclick="createAlert('medium')">
                    <span class="alert-type medium">MEDIUM</span> Threshold Warning
                </button>
                <button onclick="createAlert('low')">
                    <span class="alert-type low">LOW</span> Info Update
                </button>
            </div>
        </div>
        
        <div class="card">
            <h2>Real-time Notifications</h2>
            <div id="notifications">
                <div class="notification-item">Waiting for notifications...</div>
            </div>
        </div>
        
        <div class="card">
            <h2>Sample API Calls</h2>
            <h3>Send Custom Notification</h3>
            <pre>
POST /api/notifications/send
{
    "type": "custom_alert",
    "severity": "high",
    "userId": "user123",
    "title": "Important Update",
    "message": "Your shipment requires attention",
    "channels": ["email", "push", "sms"],
    "data": {
        "containerId": "MSKU1234567",
        "action": "review"
    }
}</pre>
            
            <h3>Create Business Alert</h3>
            <pre>
POST /api/alerts/create
{
    "type": "dd_risk",
    "severity": "critical",
    "entityType": "shipment",
    "entityId": "SHIP123",
    "message": "High D&D risk detected",
    "riskScore": 85,
    "businessImpact": ["Revenue at risk", "Customer impact"]
}</pre>
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
        }
        
        connectWebSocket();
        
        // Update metrics
        async function updateMetrics() {
            try {
                const response = await fetch('/api/analytics/dashboard?timeRange=1h');
                const data = await response.json();
                
                document.getElementById('totalSent').textContent = data.summary.totalSent || 0;
                document.getElementById('deliveryRate').textContent = 
                    ((data.summary.deliveryRate || 0) * 100).toFixed(1) + '%';
                document.getElementById('openRate').textContent = 
                    ((data.summary.openRate || 0) * 100).toFixed(1) + '%';
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
            item.innerHTML = \`
                <strong>\${notification.title || notification.type}</strong><br>
                <small>\${new Date().toLocaleTimeString()}</small> - 
                \${notification.message}<br>
                <small>Channel: \${notification.channel || 'N/A'} | 
                Severity: <span class="alert-type \${notification.severity}">\${notification.severity}</span></small>
            \`;
            
            container.insertBefore(item, container.firstChild);
            
            // Keep only last 20 notifications
            while (container.children.length > 20) {
                container.removeChild(container.lastChild);
            }
        }
        
        // Test functions
        async function triggerDDRisk() {
            const response = await fetch('/api/events/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'dd_risk_detected',
                    data: {
                        entity: {
                            type: 'shipment',
                            id: 'SHIP' + Math.random().toString(36).substr(2, 9),
                            name: 'Shanghai to LA Shipment',
                            containerCount: 50,
                            value: 2500000
                        },
                        riskScore: Math.floor(Math.random() * 30) + 70,
                        severity: 'high',
                        factors: [
                            { category: 'weather', description: 'Severe weather warning', score: 30 },
                            { category: 'port', description: 'Port congestion detected', score: 25 },
                            { category: 'compliance', description: 'Documentation incomplete', score: 20 }
                        ],
                        location: 'Pacific Ocean - 1500km from destination'
                    }
                })
            });
            
            if (response.ok) {
                alert('D&D Risk alert triggered successfully!');
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
                            destination: 'Los Angeles',
                            cargo: 'Electronics'
                        },
                        delayHours: Math.floor(Math.random() * 48) + 12,
                        reason: 'Port congestion',
                        newETA: new Date(Date.now() + 48 * 3600000).toISOString()
                    }
                })
            });
            
            if (response.ok) {
                alert('Container delay notification sent!');
            }
        }
        
        async function triggerIntegrationFailure() {
            const response = await fetch('/api/events/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'integration_failed',
                    data: {
                        integration: {
                            id: 'INT001',
                            name: 'Maersk API Integration',
                            provider: 'Maersk',
                            critical: true
                        },
                        error: 'Authentication failed: Invalid API credentials',
                        affectedSystems: ['Container Tracking', 'Status Updates', 'Document Sync'],
                        lastSuccessful: new Date(Date.now() - 3600000).toISOString()
                    }
                })
            });
            
            if (response.ok) {
                alert('Integration failure alert sent!');
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
                            name: 'Global Logistics Inc',
                            tier: 'enterprise'
                        },
                        milestone: {
                            name: '1000 Shipments',
                            message: 'Completed 1000 successful shipments!',
                            customerMessage: 'Congratulations on your 1000th shipment with ROOTUIP!',
                            notifyCustomer: true,
                            rewards: ['10% discount on next month', 'Priority support upgrade']
                        },
                        metrics: {
                            totalShipments: 1000,
                            onTimeDelivery: 96.5,
                            customerSince: '2020-01-15'
                        }
                    }
                })
            });
            
            if (response.ok) {
                alert('Milestone notification sent!');
            }
        }
        
        async function createAlert(severity) {
            const alerts = {
                critical: {
                    type: 'system_down',
                    message: 'Critical system component is down',
                    systemName: 'Payment Gateway'
                },
                high: {
                    type: 'performance_degradation',
                    message: 'API response time exceeding threshold',
                    component: 'Container Tracking API'
                },
                medium: {
                    type: 'threshold_exceeded',
                    message: 'Database connections approaching limit',
                    metric: 'DB Connections',
                    value: 850,
                    threshold: 1000
                },
                low: {
                    type: 'info',
                    message: 'Scheduled maintenance reminder',
                    details: 'System maintenance scheduled for this weekend'
                }
            };
            
            const response = await fetch('/api/alerts/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...alerts[severity],
                    severity: severity
                })
            });
            
            if (response.ok) {
                const alert = await response.json();
                console.log('Alert created:', alert);
            }
        }
    </script>
</body>
</html>
    `);
});

// Start server
async function start() {
    await initializeServices();
    
    server.listen(PORT, () => {
        console.log(`
🔔 ROOTUIP Notification System Started!

✅ Services Running:
- API Server: http://localhost:${PORT}
- WebSocket Server: ws://localhost:8091
- Email Service: ${notificationService.channels.has('email') ? 'Active' : 'Inactive'}
- SMS Service: ${notificationService.channels.has('sms') ? 'Active' : 'Inactive'}
- Push Service: ${notificationService.channels.has('push') ? 'Active' : 'Inactive'}
- Slack Integration: ${notificationService.channels.has('slack') ? 'Active' : 'Inactive'}
- Teams Integration: ${notificationService.channels.has('teams') ? 'Active' : 'Inactive'}

📊 Features:
- Multi-channel notification delivery
- Intelligent alert management
- Business event notifications
- Real-time WebSocket updates
- Analytics and optimization
- User preference management
- A/B testing support

🎯 Notification Types:
- D&D Risk Alerts (Critical/High/Medium)
- Container Status Updates
- Integration Failure Alerts
- System Performance Notifications
- Customer Milestone Celebrations
- SLA Violation Warnings

💡 Quick Test:
Visit http://localhost:${PORT} to access the demo dashboard

📈 Analytics Dashboard:
GET http://localhost:${PORT}/api/analytics/dashboard

🔧 Configuration:
- Email: ${process.env.SMTP_HOST || 'Demo mode'}
- SMS: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Demo mode'}
- Push: ${process.env.VAPID_PUBLIC_KEY ? 'Configured' : 'Demo mode'}
`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down notification system...');
    
    if (notificationService) await notificationService.cleanup();
    if (analytics) await analytics.cleanup();
    
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Start the application
start().catch(error => {
    console.error('Failed to start notification system:', error);
    process.exit(1);
});