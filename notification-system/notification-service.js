/**
 * ROOTUIP Notification Service
 * Multi-channel notification orchestration and delivery
 */

const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const webpush = require('web-push');
const { WebClient } = require('@slack/web-api');
const { Client } = require('@microsoft/microsoft-graph-client');
const WebSocket = require('ws');
const Bull = require('bull');
const Redis = require('redis');
const { PrismaClient } = require('@prisma/client');

class NotificationService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            email: {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            },
            sms: {
                accountSid: process.env.TWILIO_ACCOUNT_SID,
                authToken: process.env.TWILIO_AUTH_TOKEN,
                fromNumber: process.env.TWILIO_FROM_NUMBER
            },
            push: {
                vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
                vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
                vapidEmail: process.env.VAPID_EMAIL
            },
            slack: {
                token: process.env.SLACK_BOT_TOKEN,
                defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#alerts'
            },
            teams: {
                tenantId: process.env.TEAMS_TENANT_ID,
                clientId: process.env.TEAMS_CLIENT_ID,
                clientSecret: process.env.TEAMS_CLIENT_SECRET
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            },
            ...config
        };
        
        this.prisma = new PrismaClient();
        this.queues = new Map();
        this.channels = new Map();
        this.wsClients = new Set();
        this.alertGroups = new Map();
        this.rateLimiters = new Map();
        
        this.initialize();
    }
    
    async initialize() {
        try {
            // Initialize channels
            await this.initializeEmailChannel();
            await this.initializeSMSChannel();
            await this.initializePushChannel();
            await this.initializeSlackChannel();
            await this.initializeTeamsChannel();
            await this.initializeWebSocketChannel();
            
            // Initialize queues
            await this.initializeQueues();
            
            // Load notification templates
            await this.loadTemplates();
            
            // Start background workers
            this.startWorkers();
            
            console.log('Notification service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize notification service:', error);
            throw error;
        }
    }
    
    // Channel Initialization
    async initializeEmailChannel() {
        this.emailTransporter = nodemailer.createTransport(this.config.email);
        
        await this.emailTransporter.verify();
        this.channels.set('email', {
            send: this.sendEmail.bind(this),
            priority: 2
        });
        
        console.log('Email channel initialized');
    }
    
    async initializeSMSChannel() {
        if (this.config.sms.accountSid && this.config.sms.authToken) {
            this.twilioClient = twilio(
                this.config.sms.accountSid,
                this.config.sms.authToken
            );
            
            this.channels.set('sms', {
                send: this.sendSMS.bind(this),
                priority: 1
            });
            
            console.log('SMS channel initialized');
        }
    }
    
    async initializePushChannel() {
        if (this.config.push.vapidPublicKey && this.config.push.vapidPrivateKey) {
            webpush.setVapidDetails(
                `mailto:${this.config.push.vapidEmail}`,
                this.config.push.vapidPublicKey,
                this.config.push.vapidPrivateKey
            );
            
            this.channels.set('push', {
                send: this.sendPushNotification.bind(this),
                priority: 1
            });
            
            console.log('Push notification channel initialized');
        }
    }
    
    async initializeSlackChannel() {
        if (this.config.slack.token) {
            this.slackClient = new WebClient(this.config.slack.token);
            
            this.channels.set('slack', {
                send: this.sendSlackMessage.bind(this),
                priority: 3
            });
            
            console.log('Slack channel initialized');
        }
    }
    
    async initializeTeamsChannel() {
        if (this.config.teams.clientId && this.config.teams.clientSecret) {
            // Initialize Microsoft Graph client
            this.teamsClient = Client.init({
                authProvider: async (done) => {
                    // Implement OAuth2 flow for Teams
                    const token = await this.getTeamsAccessToken();
                    done(null, token);
                }
            });
            
            this.channels.set('teams', {
                send: this.sendTeamsMessage.bind(this),
                priority: 3
            });
            
            console.log('Teams channel initialized');
        }
    }
    
    async initializeWebSocketChannel() {
        this.wss = new WebSocket.Server({ port: 8091 });
        
        this.wss.on('connection', (ws, req) => {
            const clientId = req.headers['x-client-id'] || this.generateClientId();
            
            ws.clientId = clientId;
            ws.userId = req.headers['x-user-id'];
            ws.isAlive = true;
            
            this.wsClients.add(ws);
            
            ws.on('message', (message) => {
                this.handleWebSocketMessage(ws, message);
            });
            
            ws.on('close', () => {
                this.wsClients.delete(ws);
            });
            
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            
            // Send connection confirmation
            ws.send(JSON.stringify({
                type: 'connected',
                clientId: clientId,
                timestamp: new Date()
            }));
        });
        
        // Heartbeat to keep connections alive
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    ws.terminate();
                    return;
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
        
        this.channels.set('websocket', {
            send: this.sendWebSocketNotification.bind(this),
            priority: 0 // Highest priority for real-time
        });
        
        console.log('WebSocket channel initialized on port 8091');
    }
    
    // Queue Management
    async initializeQueues() {
        const redisClient = Redis.createClient(this.config.redis);
        
        // Priority queues for different notification types
        const queueTypes = [
            { name: 'critical', concurrency: 50, priority: 1 },
            { name: 'high', concurrency: 30, priority: 2 },
            { name: 'normal', concurrency: 20, priority: 3 },
            { name: 'low', concurrency: 10, priority: 4 },
            { name: 'bulk', concurrency: 5, priority: 5 }
        ];
        
        for (const queueType of queueTypes) {
            const queue = new Bull(`notifications-${queueType.name}`, {
                redis: this.config.redis,
                defaultJobOptions: {
                    removeOnComplete: true,
                    removeOnFail: false,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    }
                }
            });
            
            this.queues.set(queueType.name, queue);
            
            // Process jobs
            queue.process(queueType.concurrency, async (job) => {
                return await this.processNotification(job.data);
            });
            
            // Event handlers
            queue.on('completed', (job, result) => {
                this.emit('notification:sent', {
                    jobId: job.id,
                    notification: job.data,
                    result
                });
            });
            
            queue.on('failed', (job, err) => {
                this.emit('notification:failed', {
                    jobId: job.id,
                    notification: job.data,
                    error: err.message
                });
            });
        }
    }
    
    // Send Notification - Main Entry Point
    async sendNotification(notification) {
        try {
            // Validate notification
            this.validateNotification(notification);
            
            // Enrich notification with context
            const enrichedNotification = await this.enrichNotification(notification);
            
            // Check rate limits
            if (await this.isRateLimited(enrichedNotification)) {
                throw new Error('Rate limit exceeded');
            }
            
            // Check if notification should be grouped
            if (this.shouldGroupNotification(enrichedNotification)) {
                return await this.addToGroup(enrichedNotification);
            }
            
            // Determine priority
            const priority = this.calculatePriority(enrichedNotification);
            
            // Add to appropriate queue
            const queueName = this.getQueueName(priority);
            const queue = this.queues.get(queueName);
            
            const job = await queue.add(enrichedNotification, {
                priority: priority,
                delay: enrichedNotification.delay || 0
            });
            
            // Track notification
            await this.trackNotification(enrichedNotification, job.id);
            
            return {
                id: job.id,
                status: 'queued',
                priority: priority,
                estimatedDelivery: this.estimateDeliveryTime(priority)
            };
            
        } catch (error) {
            console.error('Failed to send notification:', error);
            throw error;
        }
    }
    
    // Process notification from queue
    async processNotification(notification) {
        const results = [];
        
        try {
            // Get user preferences
            const preferences = await this.getUserPreferences(notification.userId);
            
            // Determine which channels to use
            const channels = this.selectChannels(notification, preferences);
            
            // Send through each channel
            for (const channelName of channels) {
                const channel = this.channels.get(channelName);
                if (channel) {
                    try {
                        const result = await channel.send(notification);
                        results.push({
                            channel: channelName,
                            success: true,
                            result
                        });
                    } catch (error) {
                        results.push({
                            channel: channelName,
                            success: false,
                            error: error.message
                        });
                    }
                }
            }
            
            // Update notification status
            await this.updateNotificationStatus(notification.id, 'delivered', results);
            
            // Track analytics
            await this.trackDelivery(notification, results);
            
            return results;
            
        } catch (error) {
            await this.updateNotificationStatus(notification.id, 'failed', error);
            throw error;
        }
    }
    
    // Channel Implementation - Email
    async sendEmail(notification) {
        const template = await this.getTemplate('email', notification.type);
        const html = await this.renderTemplate(template, notification);
        
        const mailOptions = {
            from: this.config.email.from || 'ROOTUIP <noreply@rootuip.com>',
            to: notification.recipient.email,
            subject: notification.subject || this.generateSubject(notification),
            html: html,
            attachments: notification.attachments || []
        };
        
        const result = await this.emailTransporter.sendMail(mailOptions);
        return result;
    }
    
    // Channel Implementation - SMS
    async sendSMS(notification) {
        if (!notification.recipient.phone) {
            throw new Error('Phone number required for SMS');
        }
        
        const message = await this.renderTemplate('sms', notification);
        
        const result = await this.twilioClient.messages.create({
            body: message,
            from: this.config.sms.fromNumber,
            to: notification.recipient.phone
        });
        
        return result;
    }
    
    // Channel Implementation - Push
    async sendPushNotification(notification) {
        const subscriptions = await this.getPushSubscriptions(notification.userId);
        const payload = {
            title: notification.title,
            body: notification.message,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            data: {
                id: notification.id,
                type: notification.type,
                url: notification.url,
                actions: notification.actions
            }
        };
        
        const results = await Promise.all(
            subscriptions.map(subscription =>
                webpush.sendNotification(subscription, JSON.stringify(payload))
                    .catch(err => ({ error: err.message }))
            )
        );
        
        return results;
    }
    
    // Channel Implementation - Slack
    async sendSlackMessage(notification) {
        const blocks = this.buildSlackBlocks(notification);
        
        const result = await this.slackClient.chat.postMessage({
            channel: notification.channel || this.config.slack.defaultChannel,
            text: notification.message,
            blocks: blocks,
            attachments: notification.attachments
        });
        
        return result;
    }
    
    // Channel Implementation - Teams
    async sendTeamsMessage(notification) {
        const card = this.buildTeamsCard(notification);
        
        const result = await this.teamsClient.api('/teams/{team-id}/channels/{channel-id}/messages')
            .post({
                body: {
                    contentType: 'html',
                    content: card
                }
            });
        
        return result;
    }
    
    // Channel Implementation - WebSocket
    async sendWebSocketNotification(notification) {
        const message = JSON.stringify({
            type: 'notification',
            data: notification,
            timestamp: new Date()
        });
        
        let sent = 0;
        
        this.wsClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                // Check if notification is for this user
                if (!notification.userId || client.userId === notification.userId) {
                    client.send(message);
                    sent++;
                }
            }
        });
        
        return { sent };
    }
    
    // Intelligent Alert Management
    calculatePriority(notification) {
        let priority = 3; // Default normal priority
        
        // Type-based priority
        const typePriorities = {
            'critical_alert': 1,
            'system_down': 1,
            'security_breach': 1,
            'dd_risk_high': 1,
            'container_delayed': 2,
            'integration_failure': 2,
            'performance_warning': 3,
            'status_update': 4,
            'info': 5
        };
        
        if (typePriorities[notification.type]) {
            priority = typePriorities[notification.type];
        }
        
        // Adjust based on user role
        if (notification.recipient?.role === 'executive') {
            priority = Math.max(1, priority - 1);
        }
        
        // Adjust based on severity
        if (notification.severity === 'critical') {
            priority = 1;
        } else if (notification.severity === 'high') {
            priority = Math.min(2, priority);
        }
        
        // Time-based adjustments
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 6) {
            // During night hours, only send critical
            priority = Math.max(priority, 2);
        }
        
        return priority;
    }
    
    // Alert Grouping
    shouldGroupNotification(notification) {
        const groupableTypes = [
            'container_status_update',
            'performance_metric',
            'minor_alert',
            'info'
        ];
        
        return groupableTypes.includes(notification.type) &&
               notification.severity !== 'critical';
    }
    
    async addToGroup(notification) {
        const groupKey = this.getGroupKey(notification);
        
        if (!this.alertGroups.has(groupKey)) {
            this.alertGroups.set(groupKey, {
                notifications: [],
                timer: null
            });
        }
        
        const group = this.alertGroups.get(groupKey);
        group.notifications.push(notification);
        
        // Clear existing timer
        if (group.timer) {
            clearTimeout(group.timer);
        }
        
        // Set timer to send grouped notifications
        group.timer = setTimeout(() => {
            this.sendGroupedNotification(groupKey);
        }, 300000); // 5 minutes
        
        // If group size exceeds threshold, send immediately
        if (group.notifications.length >= 10) {
            clearTimeout(group.timer);
            this.sendGroupedNotification(groupKey);
        }
        
        return {
            id: notification.id,
            status: 'grouped',
            groupKey: groupKey
        };
    }
    
    async sendGroupedNotification(groupKey) {
        const group = this.alertGroups.get(groupKey);
        if (!group || group.notifications.length === 0) return;
        
        // Create summary notification
        const summary = {
            id: this.generateId(),
            type: 'grouped_notification',
            title: `${group.notifications.length} notifications`,
            message: this.generateGroupSummary(group.notifications),
            notifications: group.notifications,
            priority: this.calculateGroupPriority(group.notifications),
            userId: group.notifications[0].userId
        };
        
        // Send summary
        await this.sendNotification(summary);
        
        // Clear group
        this.alertGroups.delete(groupKey);
    }
    
    // Rate Limiting
    async isRateLimited(notification) {
        const key = `${notification.userId}:${notification.type}`;
        const limit = this.getRateLimit(notification.type);
        
        if (!this.rateLimiters.has(key)) {
            this.rateLimiters.set(key, {
                count: 0,
                resetTime: Date.now() + 3600000 // 1 hour
            });
        }
        
        const limiter = this.rateLimiters.get(key);
        
        // Reset if time window passed
        if (Date.now() > limiter.resetTime) {
            limiter.count = 0;
            limiter.resetTime = Date.now() + 3600000;
        }
        
        limiter.count++;
        
        return limiter.count > limit;
    }
    
    getRateLimit(type) {
        const limits = {
            'critical_alert': 100,
            'high_priority': 50,
            'normal': 20,
            'low_priority': 10,
            'info': 5
        };
        
        return limits[type] || 20;
    }
    
    // Template Management
    async loadTemplates() {
        this.templates = {
            email: {
                dd_risk_alert: require('./templates/email/dd-risk-alert'),
                container_status: require('./templates/email/container-status'),
                system_alert: require('./templates/email/system-alert'),
                performance_report: require('./templates/email/performance-report')
            },
            sms: {
                critical_alert: 'ROOTUIP Alert: {{title}} - {{message}}',
                status_update: '{{containerI}}: {{status}} - {{eta}}'
            },
            slack: {
                alert: require('./templates/slack/alert-blocks'),
                report: require('./templates/slack/report-blocks')
            }
        };
    }
    
    async renderTemplate(template, data) {
        if (typeof template === 'function') {
            return await template(data);
        }
        
        // Simple template replacement
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || '';
        });
    }
    
    // Analytics and Tracking
    async trackNotification(notification, jobId) {
        await this.prisma.notificationLog.create({
            data: {
                id: notification.id,
                jobId: jobId,
                type: notification.type,
                channel: notification.channel,
                userId: notification.userId,
                priority: notification.priority,
                status: 'queued',
                metadata: notification,
                createdAt: new Date()
            }
        });
    }
    
    async trackDelivery(notification, results) {
        const successChannels = results.filter(r => r.success).map(r => r.channel);
        const failedChannels = results.filter(r => !r.success).map(r => r.channel);
        
        await this.prisma.notificationDelivery.create({
            data: {
                notificationId: notification.id,
                userId: notification.userId,
                successChannels: successChannels,
                failedChannels: failedChannels,
                deliveredAt: new Date(),
                opened: false,
                clicked: false
            }
        });
        
        // Track metrics
        this.emit('metrics:delivery', {
            type: notification.type,
            channels: successChannels,
            userId: notification.userId
        });
    }
    
    // Helper Methods
    generateId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getGroupKey(notification) {
        return `${notification.userId}:${notification.type}:${Math.floor(Date.now() / 300000)}`;
    }
    
    generateSubject(notification) {
        const subjects = {
            dd_risk_alert: '[URGENT] D&D Risk Alert - {{severity}} Risk Detected',
            container_status: 'Container {{containerId}} Status Update',
            system_alert: '[ROOTUIP] System Alert - {{title}}',
            performance_report: 'ROOTUIP Performance Report - {{period}}'
        };
        
        const template = subjects[notification.type] || 'ROOTUIP Notification';
        return this.renderTemplate(template, notification);
    }
    
    // Cleanup
    async cleanup() {
        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }
        
        // Close queue connections
        for (const [name, queue] of this.queues) {
            await queue.close();
        }
        
        // Close database connection
        await this.prisma.$disconnect();
    }
}

module.exports = NotificationService;