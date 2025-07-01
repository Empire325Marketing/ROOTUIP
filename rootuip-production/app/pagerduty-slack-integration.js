/**
 * ROOTUIP PagerDuty and Slack Integration Service
 * Enterprise incident management and team notifications
 */

const EventEmitter = require('events');
const https = require('https');
const crypto = require('crypto');

// PagerDuty Integration
class PagerDutyIntegration extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            integrationKey: config.integrationKey,
            routingKey: config.routingKey,
            apiToken: config.apiToken,
            serviceId: config.serviceId,
            escalationPolicyId: config.escalationPolicyId,
            ...config
        };
        
        this.incidents = new Map();
        this.suppressionRules = new Map();
        
        this.setupSuppressionRules();
    }
    
    setupSuppressionRules() {
        // Prevent alert spam
        this.suppressionRules.set('duplicate_alert', {
            window: 300000, // 5 minutes
            maxOccurrences: 1
        });
        
        this.suppressionRules.set('flapping_service', {
            window: 600000, // 10 minutes
            maxOccurrences: 3
        });
    }
    
    // Create incident in PagerDuty
    async createIncident(alert) {
        const incident = this.buildIncidentPayload(alert);
        
        if (this.shouldSuppress(alert)) {
            this.emit('incident_suppressed', { alert, reason: 'suppression_rule' });
            return null;
        }
        
        try {
            const response = await this.sendToPagerDuty(incident);
            
            if (response.status === 'success') {
                const incidentKey = response.incident_key || response.dedup_key;
                this.incidents.set(incidentKey, {
                    ...alert,
                    pagerDutyKey: incidentKey,
                    status: 'triggered',
                    createdAt: Date.now()
                });
                
                this.emit('incident_created', {
                    incidentKey,
                    alert,
                    pagerDutyResponse: response
                });
                
                return incidentKey;
            }
        } catch (error) {
            this.emit('incident_creation_failed', { alert, error });
            throw error;
        }
    }
    
    // Resolve incident in PagerDuty
    async resolveIncident(incidentKey, resolution = {}) {
        const incident = this.incidents.get(incidentKey);
        if (!incident) return false;
        
        const resolvePayload = {
            routing_key: this.config.routingKey,
            event_action: 'resolve',
            dedup_key: incidentKey,
            payload: {
                summary: `Incident resolved: ${incident.message}`,
                source: 'ROOTUIP Monitoring',
                severity: 'info',
                custom_details: {
                    resolution_reason: resolution.reason || 'Auto-resolved',
                    resolved_by: resolution.resolvedBy || 'System',
                    resolution_time: new Date().toISOString()
                }
            }
        };
        
        try {
            const response = await this.sendToPagerDuty(resolvePayload);
            
            if (response.status === 'success') {
                incident.status = 'resolved';
                incident.resolvedAt = Date.now();
                incident.resolution = resolution;
                
                this.emit('incident_resolved', {
                    incidentKey,
                    incident,
                    resolution
                });
                
                return true;
            }
        } catch (error) {
            this.emit('incident_resolution_failed', { incidentKey, error });
            throw error;
        }
        
        return false;
    }
    
    // Acknowledge incident
    async acknowledgeIncident(incidentKey, acknowledgedBy) {
        const incident = this.incidents.get(incidentKey);
        if (!incident) return false;
        
        const ackPayload = {
            routing_key: this.config.routingKey,
            event_action: 'acknowledge',
            dedup_key: incidentKey,
            payload: {
                summary: `Incident acknowledged: ${incident.message}`,
                source: 'ROOTUIP Monitoring',
                custom_details: {
                    acknowledged_by: acknowledgedBy,
                    acknowledgment_time: new Date().toISOString()
                }
            }
        };
        
        try {
            const response = await this.sendToPagerDuty(ackPayload);
            
            if (response.status === 'success') {
                incident.status = 'acknowledged';
                incident.acknowledgedAt = Date.now();
                incident.acknowledgedBy = acknowledgedBy;
                
                this.emit('incident_acknowledged', {
                    incidentKey,
                    incident,
                    acknowledgedBy
                });
                
                return true;
            }
        } catch (error) {
            this.emit('incident_acknowledgment_failed', { incidentKey, error });
            throw error;
        }
        
        return false;
    }
    
    buildIncidentPayload(alert) {
        const severity = this.mapSeverity(alert.severity);
        const dedupKey = this.generateDedupKey(alert);
        
        return {
            routing_key: this.config.routingKey,
            event_action: 'trigger',
            dedup_key: dedupKey,
            payload: {
                summary: alert.message || 'ROOTUIP System Alert',
                source: alert.source || 'ROOTUIP Monitoring',
                severity: severity,
                timestamp: new Date().toISOString(),
                component: alert.component,
                group: alert.group || 'Infrastructure',
                class: alert.type || 'System',
                custom_details: {
                    alert_id: alert.id,
                    service: alert.service,
                    environment: alert.environment || 'production',
                    trace_id: alert.traceId,
                    user_id: alert.userId,
                    threshold: alert.threshold,
                    current_value: alert.currentValue,
                    dashboard_url: this.buildDashboardUrl(alert),
                    runbook_url: this.buildRunbookUrl(alert),
                    metrics: alert.metrics
                }
            },
            client: 'ROOTUIP Monitoring System',
            client_url: this.config.dashboardUrl
        };
    }
    
    mapSeverity(severity) {
        const severityMap = {
            'critical': 'critical',
            'high': 'error',
            'medium': 'warning',
            'low': 'info',
            'info': 'info'
        };
        
        return severityMap[severity] || 'warning';
    }
    
    generateDedupKey(alert) {
        const components = [
            alert.service || 'unknown',
            alert.component || 'unknown',
            alert.type || 'unknown',
            alert.fingerprint || crypto.createHash('md5').update(alert.message).digest('hex')
        ];
        
        return components.join('::');
    }
    
    buildDashboardUrl(alert) {
        const baseUrl = this.config.dashboardUrl || 'https://monitor.rootuip.com';
        return `${baseUrl}/alerts/${alert.id}`;
    }
    
    buildRunbookUrl(alert) {
        const baseUrl = this.config.runbookUrl || 'https://docs.rootuip.com/runbooks';
        return `${baseUrl}/${alert.type || 'general'}`;
    }
    
    shouldSuppress(alert) {
        const key = `${alert.service}:${alert.type}:${alert.fingerprint}`;
        const rule = this.suppressionRules.get('duplicate_alert');
        
        if (!rule) return false;
        
        const now = Date.now();
        const recentAlerts = Array.from(this.incidents.values())
            .filter(incident => 
                incident.fingerprint === alert.fingerprint &&
                (now - incident.createdAt) < rule.window
            );
            
        return recentAlerts.length >= rule.maxOccurrences;
    }
    
    async sendToPagerDuty(payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            
            const options = {
                hostname: 'events.pagerduty.com',
                port: 443,
                path: '/v2/enqueue',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };
            
            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`PagerDuty API error: ${res.statusCode} ${responseData}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse PagerDuty response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`PagerDuty request failed: ${error.message}`));
            });
            
            req.write(data);
            req.end();
        });
    }
    
    // Get incident status from PagerDuty API
    async getIncidentStatus(incidentId) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.pagerduty.com',
                port: 443,
                path: `/incidents/${incidentId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Token token=${this.config.apiToken}`,
                    'Accept': 'application/vnd.pagerduty+json;version=2'
                }
            };
            
            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
    }
}

// Slack Integration
class SlackIntegration extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            webhookUrls: config.webhookUrls || {},
            botToken: config.botToken,
            channels: config.channels || {},
            userMentions: config.userMentions || {},
            ...config
        };
        
        this.messageQueue = [];
        this.rateLimiter = new Map();
        
        this.setupDefaultChannels();
    }
    
    setupDefaultChannels() {
        // Default channel mappings
        if (!this.config.channels.critical) {
            this.config.channels.critical = '#alerts-critical';
        }
        if (!this.config.channels.alerts) {
            this.config.channels.alerts = '#alerts';
        }
        if (!this.config.channels.monitoring) {
            this.config.channels.monitoring = '#monitoring';
        }
        if (!this.config.channels.deployments) {
            this.config.channels.deployments = '#deployments';
        }
    }
    
    // Send alert to appropriate Slack channel
    async sendAlert(alert, options = {}) {
        const channel = this.determineChannel(alert);
        const message = this.buildAlertMessage(alert, options);
        
        if (this.isRateLimited(channel)) {
            this.queueMessage(channel, message);
            return;
        }
        
        try {
            const response = await this.sendToSlack(channel, message);
            
            this.emit('alert_sent', {
                alert,
                channel,
                messageTs: response.ts
            });
            
            this.updateRateLimit(channel);
            return response;
        } catch (error) {
            this.emit('alert_send_failed', { alert, channel, error });
            throw error;
        }
    }
    
    // Send incident update
    async sendIncidentUpdate(incident, update, options = {}) {
        const channel = this.determineChannel(incident);
        const message = this.buildIncidentUpdateMessage(incident, update, options);
        
        try {
            const response = await this.sendToSlack(channel, message);
            
            this.emit('incident_update_sent', {
                incident,
                update,
                channel,
                messageTs: response.ts
            });
            
            return response;
        } catch (error) {
            this.emit('incident_update_failed', { incident, update, error });
            throw error;
        }
    }
    
    // Send system notification
    async sendSystemNotification(notification, channel = null) {
        const targetChannel = channel || this.config.channels.monitoring;
        const message = this.buildSystemNotificationMessage(notification);
        
        try {
            const response = await this.sendToSlack(targetChannel, message);
            
            this.emit('system_notification_sent', {
                notification,
                channel: targetChannel,
                messageTs: response.ts
            });
            
            return response;
        } catch (error) {
            this.emit('system_notification_failed', { notification, error });
            throw error;
        }
    }
    
    buildAlertMessage(alert, options = {}) {
        const severity = alert.severity || 'medium';
        const color = this.getSeverityColor(severity);
        const emoji = this.getSeverityEmoji(severity);
        
        const fields = [
            {
                title: 'Service',
                value: alert.service || 'Unknown',
                short: true
            },
            {
                title: 'Component',
                value: alert.component || 'Unknown',
                short: true
            },
            {
                title: 'Environment',
                value: alert.environment || 'production',
                short: true
            },
            {
                title: 'Time',
                value: new Date(alert.timestamp).toLocaleString(),
                short: true
            }
        ];
        
        if (alert.threshold && alert.currentValue) {
            fields.push({
                title: 'Threshold Exceeded',
                value: `${alert.currentValue} > ${alert.threshold}`,
                short: true
            });
        }
        
        const actions = [];
        
        if (alert.dashboardUrl) {
            actions.push({
                type: 'button',
                text: 'View Dashboard',
                url: alert.dashboardUrl,
                style: 'primary'
            });
        }
        
        if (alert.runbookUrl) {
            actions.push({
                type: 'button',
                text: 'View Runbook',
                url: alert.runbookUrl
            });
        }
        
        const mentions = this.getMentionsForAlert(alert);
        const text = mentions.length > 0 ? mentions.join(' ') + '\n' : '';
        
        return {
            text: `${text}${emoji} *${severity.toUpperCase()} Alert*`,
            attachments: [{
                color: color,
                title: alert.message || 'System Alert',
                fields: fields,
                actions: actions,
                footer: 'ROOTUIP Monitoring',
                footer_icon: 'https://rootuip.com/favicon.ico',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }
    
    buildIncidentUpdateMessage(incident, update, options = {}) {
        const status = update.status || incident.status;
        const color = this.getStatusColor(status);
        const emoji = this.getStatusEmoji(status);
        
        let title = '';
        let description = '';
        
        switch (update.action) {
            case 'created':
                title = 'New Incident Created';
                description = `Incident **${incident.id}** has been created`;
                break;
            case 'acknowledged':
                title = 'Incident Acknowledged';
                description = `Incident **${incident.id}** acknowledged by ${update.acknowledgedBy}`;
                break;
            case 'resolved':
                title = 'Incident Resolved';
                description = `Incident **${incident.id}** has been resolved`;
                break;
            case 'escalated':
                title = 'Incident Escalated';
                description = `Incident **${incident.id}** has been escalated`;
                break;
            default:
                title = 'Incident Updated';
                description = `Incident **${incident.id}** has been updated`;
        }
        
        const fields = [
            {
                title: 'Incident ID',
                value: incident.id,
                short: true
            },
            {
                title: 'Status',
                value: status,
                short: true
            },
            {
                title: 'Duration',
                value: this.formatDuration(incident.createdAt),
                short: true
            }
        ];
        
        if (update.notes) {
            fields.push({
                title: 'Notes',
                value: update.notes,
                short: false
            });
        }
        
        return {
            text: `${emoji} *${title}*`,
            attachments: [{
                color: color,
                title: incident.title || incident.message,
                text: description,
                fields: fields,
                footer: 'ROOTUIP Incident Management',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }
    
    buildSystemNotificationMessage(notification) {
        const type = notification.type || 'info';
        const emoji = this.getNotificationEmoji(type);
        const color = this.getNotificationColor(type);
        
        return {
            text: `${emoji} *${notification.title}*`,
            attachments: [{
                color: color,
                text: notification.message,
                fields: notification.fields || [],
                footer: 'ROOTUIP System',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }
    
    determineChannel(alert) {
        if (alert.severity === 'critical') {
            return this.config.channels.critical;
        }
        
        if (alert.type === 'deployment') {
            return this.config.channels.deployments;
        }
        
        return this.config.channels.alerts;
    }
    
    getMentionsForAlert(alert) {
        const mentions = [];
        
        if (alert.severity === 'critical') {
            if (this.config.userMentions.oncall) {
                mentions.push(`<@${this.config.userMentions.oncall}>`);
            }
            if (this.config.userMentions.team) {
                mentions.push(`<!subteam^${this.config.userMentions.team}>`);
            }
        }
        
        if (alert.service && this.config.userMentions.services) {
            const serviceOwner = this.config.userMentions.services[alert.service];
            if (serviceOwner) {
                mentions.push(`<@${serviceOwner}>`);
            }
        }
        
        return mentions;
    }
    
    getSeverityColor(severity) {
        const colors = {
            'critical': '#ff0000',
            'high': '#ff8c00',
            'medium': '#ffd700',
            'low': '#32cd32',
            'info': '#1e90ff'
        };
        
        return colors[severity] || colors['medium'];
    }
    
    getSeverityEmoji(severity) {
        const emojis = {
            'critical': '🚨',
            'high': '⚠️',
            'medium': '⚡',
            'low': 'ℹ️',
            'info': '📋'
        };
        
        return emojis[severity] || emojis['medium'];
    }
    
    getStatusColor(status) {
        const colors = {
            'triggered': '#ff0000',
            'acknowledged': '#ffd700',
            'resolved': '#32cd32',
            'escalated': '#ff8c00'
        };
        
        return colors[status] || '#808080';
    }
    
    getStatusEmoji(status) {
        const emojis = {
            'triggered': '🔥',
            'acknowledged': '👀',
            'resolved': '✅',
            'escalated': '⬆️'
        };
        
        return emojis[status] || '📌';
    }
    
    getNotificationEmoji(type) {
        const emojis = {
            'deployment': '🚀',
            'maintenance': '🔧',
            'success': '✅',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        
        return emojis[type] || 'ℹ️';
    }
    
    getNotificationColor(type) {
        const colors = {
            'deployment': '#9932cc',
            'maintenance': '#ff8c00',
            'success': '#32cd32',
            'warning': '#ffd700',
            'info': '#1e90ff'
        };
        
        return colors[type] || '#1e90ff';
    }
    
    formatDuration(startTime) {
        const duration = Date.now() - startTime;
        const minutes = Math.floor(duration / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }
    
    isRateLimited(channel) {
        const limit = this.rateLimiter.get(channel);
        if (!limit) return false;
        
        const now = Date.now();
        return (now - limit.lastMessage) < limit.interval;
    }
    
    updateRateLimit(channel) {
        this.rateLimiter.set(channel, {
            lastMessage: Date.now(),
            interval: 60000 // 1 minute between messages
        });
    }
    
    queueMessage(channel, message) {
        this.messageQueue.push({ channel, message, queuedAt: Date.now() });
        
        // Process queue after rate limit expires
        setTimeout(() => {
            this.processMessageQueue();
        }, 60000);
    }
    
    async processMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        const message = this.messageQueue.shift();
        
        try {
            await this.sendToSlack(message.channel, message.message);
        } catch (error) {
            this.emit('queued_message_failed', { message, error });
        }
        
        // Continue processing if more messages
        if (this.messageQueue.length > 0) {
            setTimeout(() => this.processMessageQueue(), 1000);
        }
    }
    
    async sendToSlack(channel, message) {
        const webhookUrl = this.config.webhookUrls[channel] || this.config.webhookUrls.default;
        
        if (!webhookUrl) {
            throw new Error(`No webhook URL configured for channel: ${channel}`);
        }
        
        const payload = {
            channel: channel,
            username: 'ROOTUIP Monitor',
            icon_emoji: ':robot_face:',
            ...message
        };
        
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const url = new URL(webhookUrl);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };
            
            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ 
                            status: 'success',
                            response: responseData,
                            ts: Date.now()
                        });
                    } else {
                        reject(new Error(`Slack webhook error: ${res.statusCode} ${responseData}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(new Error(`Slack request failed: ${error.message}`));
            });
            
            req.write(data);
            req.end();
        });
    }
}

// Unified Notification Service
class NotificationService extends EventEmitter {
    constructor(config) {
        super();
        
        this.pagerDuty = new PagerDutyIntegration(config.pagerduty);
        this.slack = new SlackIntegration(config.slack);
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // Forward PagerDuty events
        this.pagerDuty.on('incident_created', (data) => {
            this.emit('incident_created', data);
            this.notifySlackOfIncident(data, 'created');
        });
        
        this.pagerDuty.on('incident_resolved', (data) => {
            this.emit('incident_resolved', data);
            this.notifySlackOfIncident(data, 'resolved');
        });
        
        this.pagerDuty.on('incident_acknowledged', (data) => {
            this.emit('incident_acknowledged', data);
            this.notifySlackOfIncident(data, 'acknowledged');
        });
        
        // Forward Slack events
        this.slack.on('alert_sent', (data) => {
            this.emit('alert_sent', data);
        });
    }
    
    async processAlert(alert) {
        try {
            // Send to Slack first (faster)
            const slackPromise = this.slack.sendAlert(alert);
            
            // Create PagerDuty incident for critical alerts
            let pagerDutyPromise = null;
            if (alert.severity === 'critical' || alert.severity === 'high') {
                pagerDutyPromise = this.pagerDuty.createIncident(alert);
            }
            
            const results = await Promise.allSettled([
                slackPromise,
                pagerDutyPromise
            ].filter(Boolean));
            
            return {
                slack: results[0],
                pagerDuty: results[1] || null
            };
        } catch (error) {
            this.emit('alert_processing_failed', { alert, error });
            throw error;
        }
    }
    
    async notifySlackOfIncident(incidentData, action) {
        try {
            await this.slack.sendIncidentUpdate(incidentData.incident, {
                action,
                status: incidentData.incident.status,
                acknowledgedBy: incidentData.acknowledgedBy,
                notes: incidentData.resolution?.reason
            });
        } catch (error) {
            this.emit('slack_incident_notification_failed', { incidentData, error });
        }
    }
    
    async sendSystemNotification(notification) {
        return await this.slack.sendSystemNotification(notification);
    }
    
    async resolveIncident(incidentKey, resolution) {
        return await this.pagerDuty.resolveIncident(incidentKey, resolution);
    }
    
    async acknowledgeIncident(incidentKey, acknowledgedBy) {
        return await this.pagerDuty.acknowledgeIncident(incidentKey, acknowledgedBy);
    }
}

module.exports = {
    PagerDutyIntegration,
    SlackIntegration,
    NotificationService
};