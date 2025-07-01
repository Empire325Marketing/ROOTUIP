/**
 * ROOTUIP Alert Manager
 * Intelligent alert processing, prioritization, and escalation
 */

const EventEmitter = require('events');
const { PrismaClient } = require('@prisma/client');
const Bull = require('bull');
const ml = require('ml-regression');

class AlertManager extends EventEmitter {
    constructor(notificationService) {
        super();
        
        this.notificationService = notificationService;
        this.prisma = new PrismaClient();
        
        this.alertRules = new Map();
        this.escalationPolicies = new Map();
        this.alertCache = new Map();
        this.correlationEngine = new AlertCorrelationEngine();
        this.fatiguePreventor = new AlertFatiguePreventor();
        
        this.initialize();
    }
    
    async initialize() {
        // Load alert rules from database
        await this.loadAlertRules();
        
        // Load escalation policies
        await this.loadEscalationPolicies();
        
        // Initialize ML models for prediction
        await this.initializeMLModels();
        
        // Start monitoring
        this.startAlertMonitoring();
        
        console.log('Alert Manager initialized');
    }
    
    // Process incoming alert
    async processAlert(alert) {
        try {
            // Validate alert
            this.validateAlert(alert);
            
            // Enrich alert with context
            const enrichedAlert = await this.enrichAlert(alert);
            
            // Calculate risk score
            enrichedAlert.riskScore = await this.calculateRiskScore(enrichedAlert);
            
            // Check for correlations
            const correlations = await this.correlationEngine.findCorrelations(enrichedAlert);
            if (correlations.length > 0) {
                enrichedAlert.correlatedAlerts = correlations;
            }
            
            // Apply fatigue prevention
            if (this.fatiguePreventor.shouldSuppress(enrichedAlert)) {
                return await this.suppressAlert(enrichedAlert);
            }
            
            // Determine priority
            enrichedAlert.priority = this.calculatePriority(enrichedAlert);
            
            // Check escalation rules
            const escalation = await this.checkEscalation(enrichedAlert);
            if (escalation) {
                enrichedAlert.escalation = escalation;
            }
            
            // Store alert
            const storedAlert = await this.storeAlert(enrichedAlert);
            
            // Send notifications
            await this.sendAlertNotifications(storedAlert);
            
            // Track metrics
            this.trackAlertMetrics(storedAlert);
            
            return storedAlert;
            
        } catch (error) {
            console.error('Failed to process alert:', error);
            throw error;
        }
    }
    
    // Risk Scoring
    async calculateRiskScore(alert) {
        let score = 0;
        
        // Base score from severity
        const severityScores = {
            critical: 100,
            high: 75,
            medium: 50,
            low: 25,
            info: 10
        };
        score += severityScores[alert.severity] || 50;
        
        // Business impact
        if (alert.businessImpact) {
            const impactScores = {
                revenue_loss: 30,
                customer_impact: 25,
                compliance_violation: 40,
                operational_disruption: 20,
                reputation_risk: 25
            };
            
            alert.businessImpact.forEach(impact => {
                score += impactScores[impact] || 10;
            });
        }
        
        // Time sensitivity
        if (alert.timeToResolve) {
            if (alert.timeToResolve < 3600) { // Less than 1 hour
                score += 20;
            } else if (alert.timeToResolve < 86400) { // Less than 1 day
                score += 10;
            }
        }
        
        // Historical context
        const historicalScore = await this.getHistoricalScore(alert);
        score += historicalScore;
        
        // ML prediction
        const predictedImpact = await this.predictImpact(alert);
        score += predictedImpact * 20;
        
        // Normalize score (0-100)
        return Math.min(100, Math.max(0, score));
    }
    
    // Priority Calculation
    calculatePriority(alert) {
        const riskScore = alert.riskScore || 50;
        
        if (riskScore >= 80) return 1; // Critical
        if (riskScore >= 60) return 2; // High
        if (riskScore >= 40) return 3; // Medium
        if (riskScore >= 20) return 4; // Low
        return 5; // Info
    }
    
    // Escalation Management
    async checkEscalation(alert) {
        const policy = this.escalationPolicies.get(alert.type) || 
                      this.escalationPolicies.get('default');
        
        if (!policy) return null;
        
        const escalation = {
            level: 0,
            contacts: [],
            actions: []
        };
        
        // Check time-based escalation
        const alertAge = Date.now() - new Date(alert.createdAt).getTime();
        
        for (const rule of policy.rules) {
            if (this.matchesEscalationRule(alert, rule, alertAge)) {
                escalation.level = rule.level;
                escalation.contacts = await this.getEscalationContacts(rule.level, alert);
                escalation.actions = rule.actions;
                break;
            }
        }
        
        return escalation.level > 0 ? escalation : null;
    }
    
    matchesEscalationRule(alert, rule, alertAge) {
        // Time-based
        if (rule.afterMinutes && alertAge < rule.afterMinutes * 60000) {
            return false;
        }
        
        // Severity-based
        if (rule.minSeverity && this.getSeverityLevel(alert.severity) < this.getSeverityLevel(rule.minSeverity)) {
            return false;
        }
        
        // Risk score-based
        if (rule.minRiskScore && alert.riskScore < rule.minRiskScore) {
            return false;
        }
        
        // Unacknowledged
        if (rule.requiresUnacknowledged && alert.acknowledged) {
            return false;
        }
        
        return true;
    }
    
    // Send Alert Notifications
    async sendAlertNotifications(alert) {
        const notifications = [];
        
        // Get notification recipients
        const recipients = await this.getAlertRecipients(alert);
        
        for (const recipient of recipients) {
            const notification = {
                id: this.generateId(),
                type: 'alert',
                alertId: alert.id,
                userId: recipient.userId,
                recipient: recipient,
                severity: alert.severity,
                priority: alert.priority,
                title: this.generateAlertTitle(alert),
                message: this.generateAlertMessage(alert),
                data: {
                    alert: alert,
                    actions: this.getAlertActions(alert)
                },
                channels: this.selectChannels(alert, recipient)
            };
            
            // Add to notification queue
            const result = await this.notificationService.sendNotification(notification);
            notifications.push(result);
        }
        
        return notifications;
    }
    
    // Get alert recipients based on rules and preferences
    async getAlertRecipients(alert) {
        const recipients = new Set();
        
        // Direct assignments
        if (alert.assignedTo) {
            const user = await this.prisma.user.findUnique({
                where: { id: alert.assignedTo }
            });
            if (user) recipients.add(user);
        }
        
        // Role-based recipients
        const rules = this.alertRules.get(alert.type) || [];
        for (const rule of rules) {
            if (this.matchesAlertRule(alert, rule)) {
                const users = await this.getUsersByRule(rule);
                users.forEach(user => recipients.add(user));
            }
        }
        
        // Escalation recipients
        if (alert.escalation) {
            alert.escalation.contacts.forEach(contact => recipients.add(contact));
        }
        
        // Filter by preferences
        const filteredRecipients = [];
        for (const recipient of recipients) {
            const preferences = await this.getUserAlertPreferences(recipient.id);
            if (this.shouldNotifyUser(alert, preferences)) {
                filteredRecipients.push({
                    userId: recipient.id,
                    email: recipient.email,
                    phone: recipient.phone,
                    preferences: preferences
                });
            }
        }
        
        return filteredRecipients;
    }
    
    // Channel Selection
    selectChannels(alert, recipient) {
        const channels = [];
        const preferences = recipient.preferences || {};
        
        // Critical alerts use all available channels
        if (alert.severity === 'critical' || alert.priority === 1) {
            if (recipient.phone && preferences.sms !== false) channels.push('sms');
            if (preferences.push !== false) channels.push('push');
            channels.push('email');
            channels.push('websocket');
        } else {
            // Use preferred channels
            const preferredChannels = preferences.channels || ['email'];
            channels.push(...preferredChannels);
            
            // Always include websocket for real-time
            if (!channels.includes('websocket')) {
                channels.push('websocket');
            }
        }
        
        // Add team channels if configured
        if (preferences.slackEnabled && alert.priority <= 2) {
            channels.push('slack');
        }
        if (preferences.teamsEnabled && alert.priority <= 2) {
            channels.push('teams');
        }
        
        return [...new Set(channels)];
    }
    
    // Alert Templates
    generateAlertTitle(alert) {
        const templates = {
            dd_risk: '[D&D Risk] {{severity}} risk detected for {{entityName}}',
            container_delayed: 'Container {{containerId}} delayed by {{delayHours}} hours',
            system_down: '[CRITICAL] System {{systemName}} is down',
            integration_failure: 'Integration failure: {{integrationName}}',
            performance_degradation: 'Performance degradation in {{component}}',
            threshold_exceeded: '{{metric}} exceeded threshold: {{value}} > {{threshold}}'
        };
        
        const template = templates[alert.type] || 'Alert: {{message}}';
        return this.renderTemplate(template, alert);
    }
    
    generateAlertMessage(alert) {
        let message = alert.message || alert.description;
        
        // Add context
        if (alert.context) {
            message += '\n\nContext:\n';
            Object.entries(alert.context).forEach(([key, value]) => {
                message += `• ${this.humanize(key)}: ${value}\n`;
            });
        }
        
        // Add impact
        if (alert.businessImpact) {
            message += '\n\nBusiness Impact:\n';
            alert.businessImpact.forEach(impact => {
                message += `• ${this.humanize(impact)}\n`;
            });
        }
        
        // Add correlated alerts
        if (alert.correlatedAlerts && alert.correlatedAlerts.length > 0) {
            message += `\n\nRelated Alerts: ${alert.correlatedAlerts.length} similar alerts detected`;
        }
        
        return message;
    }
    
    getAlertActions(alert) {
        const actions = [];
        
        // Standard actions
        actions.push({
            id: 'acknowledge',
            label: 'Acknowledge',
            type: 'primary',
            url: `/alerts/${alert.id}/acknowledge`
        });
        
        actions.push({
            id: 'view_details',
            label: 'View Details',
            type: 'secondary',
            url: `/alerts/${alert.id}`
        });
        
        // Type-specific actions
        switch (alert.type) {
            case 'container_delayed':
                actions.push({
                    id: 'track_container',
                    label: 'Track Container',
                    type: 'secondary',
                    url: `/containers/${alert.entityId}`
                });
                actions.push({
                    id: 'contact_carrier',
                    label: 'Contact Carrier',
                    type: 'secondary',
                    action: 'contact_carrier'
                });
                break;
                
            case 'dd_risk':
                actions.push({
                    id: 'view_assessment',
                    label: 'View Risk Assessment',
                    type: 'primary',
                    url: `/risk-assessment/${alert.entityId}`
                });
                break;
                
            case 'system_down':
                actions.push({
                    id: 'restart_system',
                    label: 'Restart System',
                    type: 'danger',
                    action: 'restart_system',
                    requiresConfirmation: true
                });
                break;
        }
        
        return actions;
    }
    
    // Helper methods
    validateAlert(alert) {
        const required = ['type', 'severity', 'message'];
        for (const field of required) {
            if (!alert[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
        if (!validSeverities.includes(alert.severity)) {
            throw new Error(`Invalid severity: ${alert.severity}`);
        }
    }
    
    async enrichAlert(alert) {
        const enriched = { ...alert };
        
        // Add timestamp
        enriched.createdAt = enriched.createdAt || new Date();
        
        // Add unique ID
        enriched.id = enriched.id || this.generateId();
        
        // Fetch entity details
        if (alert.entityType && alert.entityId) {
            enriched.entity = await this.fetchEntity(alert.entityType, alert.entityId);
        }
        
        // Add system context
        enriched.system = {
            hostname: require('os').hostname(),
            environment: process.env.NODE_ENV || 'production',
            version: process.env.APP_VERSION || '1.0.0'
        };
        
        return enriched;
    }
    
    getSeverityLevel(severity) {
        const levels = {
            critical: 5,
            high: 4,
            medium: 3,
            low: 2,
            info: 1
        };
        return levels[severity] || 3;
    }
    
    renderTemplate(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || data.context?.[key] || '';
        });
    }
    
    humanize(str) {
        return str
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .replace(/^./, str => str.toUpperCase());
    }
    
    generateId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Alert Correlation Engine
class AlertCorrelationEngine {
    constructor() {
        this.correlationWindow = 300000; // 5 minutes
        this.correlationRules = new Map();
        this.recentAlerts = [];
    }
    
    async findCorrelations(alert) {
        const correlations = [];
        
        // Time-based correlation
        const timeCorrelations = this.recentAlerts.filter(a => {
            const timeDiff = Math.abs(alert.createdAt - a.createdAt);
            return timeDiff < this.correlationWindow &&
                   a.id !== alert.id;
        });
        
        // Entity-based correlation
        const entityCorrelations = timeCorrelations.filter(a => {
            return a.entityId === alert.entityId ||
                   a.entityType === alert.entityType;
        });
        
        // Pattern-based correlation
        const patternCorrelations = await this.findPatternCorrelations(alert, timeCorrelations);
        
        // Combine and deduplicate
        const allCorrelations = [...entityCorrelations, ...patternCorrelations];
        const uniqueCorrelations = Array.from(new Set(allCorrelations.map(a => a.id)))
            .map(id => allCorrelations.find(a => a.id === id));
        
        // Add alert to recent alerts
        this.recentAlerts.push(alert);
        
        // Cleanup old alerts
        const cutoff = Date.now() - this.correlationWindow * 2;
        this.recentAlerts = this.recentAlerts.filter(a => a.createdAt > cutoff);
        
        return uniqueCorrelations;
    }
    
    async findPatternCorrelations(alert, candidates) {
        const correlations = [];
        
        // Similar message patterns
        const messagePattern = this.extractPattern(alert.message);
        
        for (const candidate of candidates) {
            const candidatePattern = this.extractPattern(candidate.message);
            const similarity = this.calculateSimilarity(messagePattern, candidatePattern);
            
            if (similarity > 0.8) {
                correlations.push(candidate);
            }
        }
        
        return correlations;
    }
    
    extractPattern(message) {
        // Remove numbers and specific identifiers
        return message
            .toLowerCase()
            .replace(/\b\d+\b/g, 'NUM')
            .replace(/\b[A-Z]{4}\d{7}\b/g, 'CONTAINER_ID')
            .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP_ADDR');
    }
    
    calculateSimilarity(pattern1, pattern2) {
        // Simple Jaccard similarity
        const words1 = new Set(pattern1.split(/\s+/));
        const words2 = new Set(pattern2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }
}

// Alert Fatigue Prevention
class AlertFatiguePreventor {
    constructor() {
        this.suppressionRules = new Map();
        this.alertHistory = new Map();
        this.suppressionWindow = 3600000; // 1 hour
    }
    
    shouldSuppress(alert) {
        // Don't suppress critical alerts
        if (alert.severity === 'critical') {
            return false;
        }
        
        const key = this.getSuppressionKey(alert);
        const history = this.alertHistory.get(key) || [];
        
        // Clean old entries
        const cutoff = Date.now() - this.suppressionWindow;
        const recentHistory = history.filter(timestamp => timestamp > cutoff);
        
        // Update history
        recentHistory.push(Date.now());
        this.alertHistory.set(key, recentHistory);
        
        // Check suppression rules
        const rule = this.suppressionRules.get(alert.type) || {
            maxCount: 5,
            window: 3600000
        };
        
        return recentHistory.length > rule.maxCount;
    }
    
    getSuppressionKey(alert) {
        return `${alert.type}:${alert.entityId || 'global'}:${alert.severity}`;
    }
    
    addSuppressionRule(type, rule) {
        this.suppressionRules.set(type, rule);
    }
}

module.exports = AlertManager;