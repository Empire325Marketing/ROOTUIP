#!/usr/bin/env node

/**
 * ROOTUIP Real-Time Alert and Notification System
 * Enterprise-grade alert management and notification delivery
 */

const express = require('express');
const redis = require('redis');
const nodemailer = require('nodemailer');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.ALERT_SYSTEM_PORT || 3022;

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());

// Alert storage and configuration
const activeAlerts = new Map();
const alertRules = new Map();
const notificationChannels = new Map();
const alertHistory = [];

// Email transporter
const emailTransporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'alerts@rootuip.com',
        pass: process.env.SMTP_PASS || 'demo_password'
    }
});

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for alert system');
        setupAlertSubscriptions();
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Alert rule definitions
function initializeAlertRules() {
    // Demurrage risk alerts
    alertRules.set('demurrage-critical', {
        id: 'demurrage-critical',
        name: 'Critical Demurrage Risk',
        condition: (data) => data.demurrageRisk >= 0.7,
        severity: 'critical',
        channels: ['email', 'sms', 'push', 'webhook'],
        cooldown: 3600, // 1 hour
        template: 'Container {containerId} has critical demurrage risk ({riskPercent}%). Immediate action required.'
    });
    
    alertRules.set('demurrage-warning', {
        id: 'demurrage-warning',
        name: 'Demurrage Warning',
        condition: (data) => data.demurrageRisk >= 0.4 && data.demurrageRisk < 0.7,
        severity: 'warning',
        channels: ['email', 'push'],
        cooldown: 7200, // 2 hours
        template: 'Container {containerId} approaching demurrage threshold ({riskPercent}%). Review recommended.'
    });
    
    // System performance alerts
    alertRules.set('high-cpu', {
        id: 'high-cpu',
        name: 'High CPU Usage',
        condition: (data) => data.cpuUsage >= 85,
        severity: 'warning',
        channels: ['email', 'webhook'],
        cooldown: 1800, // 30 minutes
        template: 'High CPU usage detected: {cpuUsage}%. System performance may be affected.'
    });
    
    alertRules.set('high-memory', {
        id: 'high-memory',
        name: 'High Memory Usage',
        condition: (data) => data.memoryUsage >= 90,
        severity: 'critical',
        channels: ['email', 'sms', 'webhook'],
        cooldown: 1800,
        template: 'Critical memory usage: {memoryUsage}%. Immediate attention required.'
    });
    
    // Business alerts
    alertRules.set('low-customer-satisfaction', {
        id: 'low-customer-satisfaction',
        name: 'Low Customer Satisfaction',
        condition: (data) => data.customerSatisfaction < 90,
        severity: 'warning',
        channels: ['email'],
        cooldown: 86400, // 24 hours
        template: 'Customer satisfaction dropped to {customerSatisfaction}%. Review service quality.'
    });
    
    alertRules.set('api-error-rate', {
        id: 'api-error-rate',
        name: 'High API Error Rate',
        condition: (data) => data.errorRate >= 5,
        severity: 'critical',
        channels: ['email', 'webhook'],
        cooldown: 900, // 15 minutes
        template: 'API error rate elevated: {errorRate}%. System stability at risk.'
    });
    
    // Container-specific alerts
    alertRules.set('temperature-violation', {
        id: 'temperature-violation',
        name: 'Temperature Violation',
        condition: (data) => data.temperature && (parseFloat(data.temperature) > 25 || parseFloat(data.temperature) < -10),
        severity: 'critical',
        channels: ['email', 'sms', 'push'],
        cooldown: 1800,
        template: 'Container {containerId} temperature violation: {temperature}°C. Cargo integrity at risk.'
    });
    
    alertRules.set('customs-delay', {
        id: 'customs-delay',
        name: 'Customs Processing Delay',
        condition: (data) => data.customsProcessingHours >= 48,
        severity: 'warning',
        channels: ['email', 'push'],
        cooldown: 14400, // 4 hours
        template: 'Container {containerId} customs processing delayed: {customsProcessingHours} hours.'
    });
}

// Initialize notification channels
function initializeNotificationChannels() {
    notificationChannels.set('email', {
        id: 'email',
        name: 'Email Notifications',
        enabled: true,
        handler: sendEmailNotification
    });
    
    notificationChannels.set('sms', {
        id: 'sms',
        name: 'SMS Notifications',
        enabled: true,
        handler: sendSMSNotification
    });
    
    notificationChannels.set('push', {
        id: 'push',
        name: 'Push Notifications',
        enabled: true,
        handler: sendPushNotification
    });
    
    notificationChannels.set('webhook', {
        id: 'webhook',
        name: 'Webhook Notifications',
        enabled: true,
        handler: sendWebhookNotification
    });
}

// Alert evaluation engine
async function evaluateAlerts(data, source = 'system') {
    const triggeredAlerts = [];
    
    for (const [ruleId, rule] of alertRules) {
        try {
            if (rule.condition(data)) {
                const alertKey = `${ruleId}-${data.containerId || source}`;
                const lastTriggered = activeAlerts.get(alertKey);
                
                // Check cooldown
                if (lastTriggered && (Date.now() - lastTriggered.timestamp) < (rule.cooldown * 1000)) {
                    continue;
                }
                
                const alert = {
                    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    ruleId,
                    name: rule.name,
                    severity: rule.severity,
                    message: formatAlertMessage(rule.template, data),
                    data,
                    source,
                    timestamp: Date.now(),
                    acknowledged: false,
                    resolved: false
                };
                
                activeAlerts.set(alertKey, alert);
                alertHistory.unshift(alert);
                if (alertHistory.length > 1000) alertHistory.pop();
                
                triggeredAlerts.push(alert);
                
                // Send notifications
                await sendAlertNotifications(alert, rule.channels);
                
                // Publish to Redis
                await redisClient.publish('alerts', JSON.stringify(alert));
                
                console.log(`🚨 Alert triggered: ${alert.name} - ${alert.message}`);
            }
        } catch (error) {
            console.error(`Error evaluating rule ${ruleId}:`, error);
        }
    }
    
    return triggeredAlerts;
}

// Message formatting
function formatAlertMessage(template, data) {
    let message = template;
    
    // Replace placeholders
    Object.keys(data).forEach(key => {
        const placeholder = `{${key}}`;
        let value = data[key];
        
        // Special formatting for specific fields
        if (key === 'riskPercent' && data.demurrageRisk) {
            value = (data.demurrageRisk * 100).toFixed(1) + '%';
        } else if (key.includes('Percent') || key.includes('Usage')) {
            value = typeof value === 'number' ? value.toFixed(1) + '%' : value;
        }
        
        message = message.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return message;
}

// Notification handlers
async function sendEmailNotification(alert, recipients = ['alerts@rootuip.com']) {
    try {
        const mailOptions = {
            from: 'ROOTUIP Alerts <alerts@rootuip.com>',
            to: recipients.join(', '),
            subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
            html: `
                <h2>🚨 ROOTUIP Alert</h2>
                <p><strong>Alert:</strong> ${alert.name}</p>
                <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                <p><strong>Message:</strong> ${alert.message}</p>
                <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
                <p><strong>Source:</strong> ${alert.source}</p>
                <hr>
                <p>Please log into the ROOTUIP platform to review and acknowledge this alert.</p>
                <p><a href="https://app.rootuip.com/alerts">View Alerts Dashboard</a></p>
            `
        };
        
        await emailTransporter.sendMail(mailOptions);
        console.log(`📧 Email notification sent for alert: ${alert.id}`);
    } catch (error) {
        console.error('Email notification failed:', error);
    }
}

async function sendSMSNotification(alert, phoneNumbers = ['+1234567890']) {
    try {
        // Mock SMS implementation - replace with actual SMS service
        console.log(`📱 SMS would be sent to ${phoneNumbers.join(', ')}: ${alert.message}`);
        
        // Example with Twilio
        // await twilioClient.messages.create({
        //     body: `ROOTUIP Alert: ${alert.message}`,
        //     from: '+1234567890',
        //     to: phoneNumber
        // });
    } catch (error) {
        console.error('SMS notification failed:', error);
    }
}

async function sendPushNotification(alert, userIds = []) {
    try {
        const pushPayload = {
            id: alert.id,
            title: `ROOTUIP Alert: ${alert.name}`,
            message: alert.message,
            severity: alert.severity,
            timestamp: alert.timestamp,
            data: alert.data
        };
        
        // Publish to Redis for WebSocket delivery
        await redisClient.publish('notifications', JSON.stringify({
            type: 'push',
            alert: pushPayload,
            userIds
        }));
        
        console.log(`🔔 Push notification sent for alert: ${alert.id}`);
    } catch (error) {
        console.error('Push notification failed:', error);
    }
}

async function sendWebhookNotification(alert, webhookUrls = []) {
    try {
        const payload = {
            alert: alert,
            timestamp: new Date().toISOString(),
            source: 'ROOTUIP'
        };
        
        // Mock webhook - replace with actual webhook URLs
        console.log(`🔗 Webhook notification would be sent:`, payload);
        
        // Example webhook implementation
        // for (const url of webhookUrls) {
        //     await axios.post(url, payload, {
        //         headers: { 'Content-Type': 'application/json' }
        //     });
        // }
    } catch (error) {
        console.error('Webhook notification failed:', error);
    }
}

async function sendAlertNotifications(alert, channels) {
    for (const channelId of channels) {
        const channel = notificationChannels.get(channelId);
        if (channel && channel.enabled) {
            try {
                await channel.handler(alert);
            } catch (error) {
                console.error(`Failed to send ${channelId} notification:`, error);
            }
        }
    }
}

// Redis subscriptions
function setupAlertSubscriptions() {
    const subscriber = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    subscriber.connect().then(() => {
        // Subscribe to container updates
        subscriber.subscribe('container-updates', async (message) => {
            try {
                const containerData = JSON.parse(message);
                await evaluateAlerts(containerData, 'container-tracking');
            } catch (error) {
                console.error('Error processing container update for alerts:', error);
            }
        });
        
        // Subscribe to metrics updates
        subscriber.subscribe('metrics-update', async (message) => {
            try {
                const metrics = JSON.parse(message);
                await evaluateAlerts(metrics.performance, 'performance-monitoring');
                await evaluateAlerts(metrics.business, 'business-intelligence');
                await evaluateAlerts(metrics.system, 'system-monitoring');
            } catch (error) {
                console.error('Error processing metrics update for alerts:', error);
            }
        });
    });
}

// API Endpoints
app.get('/api/alerts', (req, res) => {
    const { severity, status, limit = 50 } = req.query;
    let alerts = alertHistory.slice(0, parseInt(limit));
    
    if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    if (status === 'active') {
        alerts = alerts.filter(alert => !alert.resolved);
    } else if (status === 'resolved') {
        alerts = alerts.filter(alert => alert.resolved);
    }
    
    res.json({
        success: true,
        alerts,
        total: alerts.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/alerts/:id', (req, res) => {
    const alert = alertHistory.find(a => a.id === req.params.id);
    if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ success: true, alert });
});

app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const alert = alertHistory.find(a => a.id === req.params.id);
    if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
    }
    
    alert.acknowledged = true;
    alert.acknowledgedBy = req.body.userId || 'system';
    alert.acknowledgedAt = Date.now();
    
    res.json({ success: true, alert });
});

app.post('/api/alerts/:id/resolve', (req, res) => {
    const alert = alertHistory.find(a => a.id === req.params.id);
    if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
    }
    
    alert.resolved = true;
    alert.resolvedBy = req.body.userId || 'system';
    alert.resolvedAt = Date.now();
    alert.resolution = req.body.resolution || 'Resolved';
    
    res.json({ success: true, alert });
});

app.post('/api/alerts/test', async (req, res) => {
    try {
        const testData = {
            containerId: 'TEST123',
            demurrageRisk: 0.8,
            temperature: 30,
            cpuUsage: 90,
            ...req.body
        };
        
        const alerts = await evaluateAlerts(testData, 'test');
        res.json({ success: true, triggeredAlerts: alerts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/alert-rules', (req, res) => {
    const rules = Array.from(alertRules.values());
    res.json({ success: true, rules });
});

app.get('/api/notification-channels', (req, res) => {
    const channels = Array.from(notificationChannels.values());
    res.json({ success: true, channels });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'real-time-alert-system',
        activeAlerts: Array.from(activeAlerts.values()).length,
        alertHistory: alertHistory.length,
        alertRules: alertRules.size,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Initialize systems
initializeAlertRules();
initializeNotificationChannels();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Real-Time Alert System running on port ${PORT}`);
    console.log(`🚨 Alerts API: http://localhost:${PORT}/api/alerts`);
    console.log(`📧 Email notifications: ${process.env.SMTP_USER || 'alerts@rootuip.com'}`);
    console.log(`⚡ Real-time alert monitoring active`);
});

module.exports = app;