#!/usr/bin/env node
/**
 * ROOTUIP Enterprise Monitoring Service Starter
 * Launches health monitoring with alert management
 */

const HealthMonitor = require('./health-monitor');
const express = require('express');
const cors = require('cors');

// Configuration
const config = {
    interval: 30000, // 30 seconds
    services: [
        { name: 'ML Server', url: 'http://localhost:3004/ml/health', critical: true },
        { name: 'Python API', url: 'http://localhost:8000/health', critical: true },
        { name: 'Auth Service', url: 'http://localhost:3003/health', critical: false }
    ],
    alertConfig: {
        email: {
            enabled: false, // Enable when SMTP is configured
            smtp: {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER || '',
                    pass: process.env.SMTP_PASS || ''
                }
            },
            from: 'alerts@rootuip.com',
            recipients: process.env.ALERT_EMAILS?.split(',') || []
        },
        slack: {
            enabled: false, // Enable when Slack token is provided
            token: process.env.SLACK_TOKEN || '',
            channel: '#rootuip-alerts',
            criticalChannel: '#rootuip-critical'
        },
        sms: {
            enabled: false, // Enable when Twilio is configured
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            from: process.env.TWILIO_PHONE || '',
            recipients: process.env.ALERT_PHONES?.split(',') || []
        },
        webhook: {
            enabled: false,
            urls: process.env.WEBHOOK_URLS?.split(',') || []
        },
        thresholds: {
            responseTime: { warning: 100, critical: 200 },
            errorRate: { warning: 1, critical: 5 },
            cpuUsage: { warning: 70, critical: 90 },
            memoryUsage: { warning: 80, critical: 95 },
            diskUsage: { warning: 80, critical: 90 },
            cacheHitRate: { warning: 85, critical: 70 }
        }
    }
};

// Initialize monitor
const monitor = new HealthMonitor(config);

// Create API server for monitoring data
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'monitoring',
        uptime: process.uptime()
    });
});

// Get current metrics
app.get('/metrics', (req, res) => {
    res.json(monitor.getMetrics());
});

// Get metrics history
app.get('/metrics/history', (req, res) => {
    res.json(monitor.getHistory());
});

// Get alert statistics
app.get('/alerts/stats', (req, res) => {
    res.json(monitor.getAlertStats());
});

// Get active alerts
app.get('/alerts/active', (req, res) => {
    const alerts = Array.from(monitor.alertManager.activeAlerts.values());
    res.json(alerts);
});

// Resolve an alert
app.post('/alerts/:alertId/resolve', (req, res) => {
    const { alertId } = req.params;
    const { resolution } = req.body;
    
    monitor.alertManager.resolveAlert(alertId, resolution)
        .then(result => {
            res.json({ success: result });
        })
        .catch(error => {
            res.status(500).json({ error: error.message });
        });
});

// Test alert endpoint
app.post('/alerts/test', async (req, res) => {
    const { severity = 'info', type = 'test', message = 'Test alert' } = req.body;
    
    try {
        await monitor.alertManager.sendAlert({
            severity,
            type,
            metric: 'test_alert',
            value: 'test',
            threshold: 'N/A',
            title: 'Test Alert',
            description: message,
            recommendation: 'This is a test alert'
        });
        
        res.json({ success: true, message: 'Test alert sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start monitoring service
const PORT = process.env.MONITORING_PORT || 3006;

app.listen(PORT, async () => {
    console.log(`Monitoring API running on port ${PORT}`);
    
    // Start health monitoring
    await monitor.start();
    
    console.log('Enterprise monitoring system active');
    console.log('Alert channels configured:', {
        email: config.alertConfig.email.enabled,
        slack: config.alertConfig.slack.enabled,
        sms: config.alertConfig.sms.enabled,
        webhook: config.alertConfig.webhook.enabled
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down monitoring service...');
    await monitor.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down monitoring service...');
    await monitor.stop();
    process.exit(0);
});