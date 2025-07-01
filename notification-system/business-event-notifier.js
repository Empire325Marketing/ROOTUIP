/**
 * ROOTUIP Business Event Notifier
 * Handles business-specific notifications and alerts
 */

const EventEmitter = require('events');

class BusinessEventNotifier extends EventEmitter {
    constructor(notificationService, alertManager) {
        super();
        
        this.notificationService = notificationService;
        this.alertManager = alertManager;
        
        this.eventHandlers = new Map();
        this.milestoneTrackers = new Map();
        
        this.initialize();
    }
    
    initialize() {
        // Register event handlers
        this.registerEventHandlers();
        
        // Start milestone tracking
        this.startMilestoneTracking();
        
        console.log('Business Event Notifier initialized');
    }
    
    registerEventHandlers() {
        // D&D Risk Events
        this.registerHandler('dd_risk_detected', this.handleDDRiskDetected.bind(this));
        this.registerHandler('dd_risk_resolved', this.handleDDRiskResolved.bind(this));
        this.registerHandler('dd_risk_escalated', this.handleDDRiskEscalated.bind(this));
        
        // Container Status Events
        this.registerHandler('container_status_changed', this.handleContainerStatusChange.bind(this));
        this.registerHandler('container_delayed', this.handleContainerDelayed.bind(this));
        this.registerHandler('container_arrived', this.handleContainerArrived.bind(this));
        this.registerHandler('container_diverted', this.handleContainerDiverted.bind(this));
        
        // Integration Events
        this.registerHandler('integration_failed', this.handleIntegrationFailure.bind(this));
        this.registerHandler('integration_restored', this.handleIntegrationRestored.bind(this));
        this.registerHandler('data_sync_failed', this.handleDataSyncFailure.bind(this));
        
        // System Performance Events
        this.registerHandler('performance_degradation', this.handlePerformanceDegradation.bind(this));
        this.registerHandler('system_outage', this.handleSystemOutage.bind(this));
        this.registerHandler('resource_threshold_exceeded', this.handleResourceThreshold.bind(this));
        
        // Customer Success Events
        this.registerHandler('milestone_achieved', this.handleMilestoneAchieved.bind(this));
        this.registerHandler('sla_violation', this.handleSLAViolation.bind(this));
        this.registerHandler('customer_satisfaction_update', this.handleCustomerSatisfaction.bind(this));
    }
    
    registerHandler(event, handler) {
        this.eventHandlers.set(event, handler);
    }
    
    // Process business event
    async processEvent(event) {
        const handler = this.eventHandlers.get(event.type);
        
        if (!handler) {
            console.warn(`No handler registered for event type: ${event.type}`);
            return;
        }
        
        try {
            await handler(event);
            
            // Track event
            this.emit('event:processed', {
                type: event.type,
                timestamp: new Date(),
                data: event
            });
            
        } catch (error) {
            console.error(`Failed to process event ${event.type}:`, error);
            this.emit('event:failed', {
                type: event.type,
                error: error.message,
                data: event
            });
        }
    }
    
    // D&D Risk Handlers
    async handleDDRiskDetected(event) {
        const { entity, riskScore, severity, factors, location } = event.data;
        
        // Create alert
        const alert = {
            type: 'dd_risk',
            severity: severity,
            entityType: entity.type,
            entityId: entity.id,
            entityName: entity.name,
            message: `D&D risk detected for ${entity.name}: ${severity} severity (score: ${riskScore})`,
            riskScore: riskScore,
            riskFactors: factors,
            location: location,
            businessImpact: this.assessBusinessImpact(entity, riskScore, factors),
            context: {
                containerCount: entity.containerCount,
                estimatedValue: entity.value,
                destination: entity.destination
            }
        };
        
        // Process through alert manager
        await this.alertManager.processAlert(alert);
        
        // Send executive notification if high risk
        if (severity === 'critical' || riskScore >= 80) {
            await this.sendExecutiveNotification({
                type: 'dd_risk_critical',
                title: `Critical D&D Risk: ${entity.name}`,
                message: `Immediate attention required for ${entity.name}. Risk score: ${riskScore}/100`,
                priority: 1,
                data: alert
            });
        }
        
        // Notify relevant stakeholders
        await this.notifyStakeholders(entity, alert);
    }
    
    async handleDDRiskResolved(event) {
        const { entity, previousRisk, resolutionTime } = event.data;
        
        const notification = {
            type: 'dd_risk_resolved',
            severity: 'info',
            title: `D&D Risk Resolved: ${entity.name}`,
            message: `The D&D risk for ${entity.name} has been successfully resolved.`,
            data: {
                entity: entity,
                previousRisk: previousRisk,
                resolutionTime: resolutionTime,
                resolutionDuration: this.formatDuration(resolutionTime)
            }
        };
        
        // Notify stakeholders
        await this.notifyStakeholders(entity, notification);
    }
    
    // Container Status Handlers
    async handleContainerStatusChange(event) {
        const { container, previousStatus, newStatus, location, eta } = event.data;
        
        // Determine if this change requires notification
        const significantChanges = [
            'DELAYED',
            'CUSTOMS_HOLD',
            'INSPECTION_REQUIRED',
            'DELIVERED',
            'LOST'
        ];
        
        if (!significantChanges.includes(newStatus)) {
            return; // Skip non-significant changes
        }
        
        const notification = {
            type: 'container_status_update',
            severity: this.getStatusSeverity(newStatus),
            containerId: container.id,
            title: `Container ${container.id} Status Update`,
            message: `Status changed from ${previousStatus} to ${newStatus}`,
            data: {
                container: container,
                previousStatus: previousStatus,
                newStatus: newStatus,
                location: location,
                eta: eta,
                etaChange: this.calculateETAChange(container.originalETA, eta)
            }
        };
        
        // Send notifications based on subscription
        await this.sendToSubscribers(container.id, notification);
    }
    
    async handleContainerDelayed(event) {
        const { container, delayHours, reason, newETA, impact } = event.data;
        
        const severity = delayHours > 48 ? 'critical' : delayHours > 24 ? 'high' : 'medium';
        
        const alert = {
            type: 'container_delayed',
            severity: severity,
            entityType: 'container',
            entityId: container.id,
            containerId: container.id,
            message: `Container ${container.id} delayed by ${delayHours} hours`,
            delayHours: delayHours,
            reason: reason,
            newETA: newETA,
            businessImpact: impact || this.assessDelayImpact(container, delayHours),
            context: {
                customer: container.customer,
                origin: container.origin,
                destination: container.destination,
                cargo: container.cargo
            }
        };
        
        await this.alertManager.processAlert(alert);
        
        // Notify customer if significant delay
        if (delayHours > 12) {
            await this.sendCustomerNotification(container.customer, {
                type: 'shipment_delayed',
                title: 'Shipment Delay Notification',
                message: `Your shipment ${container.id} has been delayed by ${delayHours} hours. New ETA: ${new Date(newETA).toLocaleString()}`,
                severity: severity,
                data: alert
            });
        }
    }
    
    // Integration Failure Handlers
    async handleIntegrationFailure(event) {
        const { integration, error, affectedSystems, lastSuccessful } = event.data;
        
        const alert = {
            type: 'integration_failure',
            severity: integration.critical ? 'critical' : 'high',
            integrationName: integration.name,
            message: `Integration failure: ${integration.name}`,
            error: error,
            businessImpact: [
                `Data synchronization disrupted`,
                `${affectedSystems.length} systems affected`,
                integration.critical ? 'Critical business processes impacted' : null
            ].filter(Boolean),
            context: {
                integrationId: integration.id,
                provider: integration.provider,
                affectedSystems: affectedSystems,
                lastSuccessful: lastSuccessful,
                downtime: this.calculateDowntime(lastSuccessful)
            }
        };
        
        await this.alertManager.processAlert(alert);
        
        // Escalate if critical
        if (integration.critical) {
            await this.escalateToOncall({
                type: 'critical_integration_failure',
                integration: integration,
                alert: alert
            });
        }
    }
    
    // System Performance Handlers
    async handlePerformanceDegradation(event) {
        const { component, metrics, threshold, duration } = event.data;
        
        const alert = {
            type: 'performance_degradation',
            severity: this.getPerformanceSeverity(metrics, threshold),
            component: component,
            message: `Performance degradation detected in ${component}`,
            metrics: metrics,
            threshold: threshold,
            duration: duration,
            businessImpact: [
                'User experience degraded',
                metrics.responseTime > 5000 ? 'Significant delays in operations' : null,
                metrics.errorRate > 0.05 ? 'Increased error rate affecting reliability' : null
            ].filter(Boolean),
            context: {
                currentLoad: metrics.currentLoad,
                responseTime: metrics.responseTime,
                errorRate: metrics.errorRate,
                affectedUsers: metrics.affectedUsers
            }
        };
        
        await this.alertManager.processAlert(alert);
        
        // Auto-scale if configured
        if (component.autoScaleEnabled && metrics.currentLoad > 80) {
            await this.triggerAutoScale(component);
        }
    }
    
    // Customer Success Handlers
    async handleMilestoneAchieved(event) {
        const { customer, milestone, metrics, achievement } = event.data;
        
        const notification = {
            type: 'customer_milestone',
            severity: 'info',
            priority: 4,
            title: `🎉 ${customer.name} Achievement Unlocked!`,
            message: milestone.message || `${customer.name} has reached ${milestone.name}`,
            data: {
                customer: customer,
                milestone: milestone,
                metrics: metrics,
                achievement: achievement,
                rewards: milestone.rewards
            }
        };
        
        // Notify customer success team
        await this.notifyTeam('customer_success', notification);
        
        // Send congratulations to customer
        if (milestone.notifyCustomer) {
            await this.sendCustomerNotification(customer, {
                type: 'milestone_achieved',
                title: `Congratulations on reaching ${milestone.name}!`,
                message: milestone.customerMessage || notification.message,
                template: 'milestone_celebration'
            });
        }
        
        // Track achievement
        await this.trackAchievement(customer, milestone);
    }
    
    async handleSLAViolation(event) {
        const { sla, metric, actualValue, targetValue, customer } = event.data;
        
        const severity = sla.critical ? 'critical' : 'high';
        
        const alert = {
            type: 'sla_violation',
            severity: severity,
            title: `SLA Violation: ${sla.name}`,
            message: `${metric} (${actualValue}) exceeded target (${targetValue})`,
            slaId: sla.id,
            customer: customer,
            businessImpact: [
                'Customer SLA breached',
                sla.penaltyAmount ? `Potential penalty: $${sla.penaltyAmount}` : null,
                'Customer satisfaction at risk'
            ].filter(Boolean),
            context: {
                metric: metric,
                actualValue: actualValue,
                targetValue: targetValue,
                breachDuration: event.data.breachDuration,
                contractReference: sla.contractReference
            }
        };
        
        await this.alertManager.processAlert(alert);
        
        // Notify customer success manager
        await this.notifyCSM(customer, alert);
        
        // Create incident if critical
        if (sla.critical) {
            await this.createIncident({
                type: 'sla_violation',
                severity: 'critical',
                alert: alert
            });
        }
    }
    
    // Helper Methods
    assessBusinessImpact(entity, riskScore, factors) {
        const impacts = [];
        
        if (riskScore >= 80) {
            impacts.push('Critical operational risk');
        }
        
        if (entity.value > 1000000) {
            impacts.push(`High-value shipment at risk ($${(entity.value / 1000000).toFixed(1)}M)`);
        }
        
        if (factors.some(f => f.category === 'security')) {
            impacts.push('Security threat detected');
        }
        
        if (factors.some(f => f.category === 'compliance')) {
            impacts.push('Potential compliance violation');
        }
        
        if (entity.customer?.tier === 'enterprise') {
            impacts.push('Enterprise customer affected');
        }
        
        return impacts;
    }
    
    assessDelayImpact(container, delayHours) {
        const impacts = [];
        
        if (delayHours > 24) {
            impacts.push('Significant delivery delay');
        }
        
        if (container.perishable) {
            impacts.push('Perishable goods at risk');
        }
        
        if (container.justInTime) {
            impacts.push('Just-in-time delivery compromised');
        }
        
        if (container.value > 500000) {
            impacts.push('High-value shipment delayed');
        }
        
        return impacts;
    }
    
    getStatusSeverity(status) {
        const severityMap = {
            'DELAYED': 'medium',
            'CUSTOMS_HOLD': 'high',
            'INSPECTION_REQUIRED': 'medium',
            'DELIVERED': 'info',
            'LOST': 'critical',
            'DAMAGED': 'high'
        };
        
        return severityMap[status] || 'low';
    }
    
    getPerformanceSeverity(metrics, threshold) {
        if (metrics.responseTime > threshold.critical || metrics.errorRate > 0.1) {
            return 'critical';
        }
        if (metrics.responseTime > threshold.warning || metrics.errorRate > 0.05) {
            return 'high';
        }
        return 'medium';
    }
    
    calculateETAChange(originalETA, newETA) {
        const diff = new Date(newETA) - new Date(originalETA);
        const hours = Math.abs(diff / 3600000);
        return {
            hours: hours,
            direction: diff > 0 ? 'delayed' : 'early'
        };
    }
    
    calculateDowntime(lastSuccessful) {
        const downtime = Date.now() - new Date(lastSuccessful).getTime();
        return this.formatDuration(downtime);
    }
    
    formatDuration(milliseconds) {
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.floor((milliseconds % 3600000) / 60000);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
    
    // Notification Methods
    async sendExecutiveNotification(notification) {
        const executives = await this.getExecutives();
        
        for (const executive of executives) {
            await this.notificationService.sendNotification({
                ...notification,
                userId: executive.id,
                recipient: executive,
                channels: ['email', 'sms', 'push'] // All channels for executives
            });
        }
    }
    
    async notifyStakeholders(entity, notification) {
        const stakeholders = await this.getStakeholders(entity);
        
        for (const stakeholder of stakeholders) {
            await this.notificationService.sendNotification({
                ...notification,
                userId: stakeholder.id,
                recipient: stakeholder
            });
        }
    }
    
    async sendCustomerNotification(customer, notification) {
        if (!customer.notificationsEnabled) return;
        
        await this.notificationService.sendNotification({
            ...notification,
            userId: customer.primaryContactId,
            recipient: await this.getCustomerContact(customer),
            channels: customer.preferredChannels || ['email']
        });
    }
    
    async notifyTeam(teamName, notification) {
        const team = await this.getTeam(teamName);
        
        // Send to team channel
        if (team.slackChannel) {
            await this.notificationService.sendNotification({
                ...notification,
                channel: team.slackChannel,
                channels: ['slack']
            });
        }
        
        // Send to team members based on their preferences
        for (const member of team.members) {
            if (member.notificationPreferences[notification.type] !== false) {
                await this.notificationService.sendNotification({
                    ...notification,
                    userId: member.id,
                    recipient: member
                });
            }
        }
    }
    
    // Milestone Tracking
    startMilestoneTracking() {
        // Check for milestones every hour
        setInterval(() => {
            this.checkMilestones();
        }, 3600000);
    }
    
    async checkMilestones() {
        const customers = await this.getActiveCustomers();
        
        for (const customer of customers) {
            const metrics = await this.getCustomerMetrics(customer);
            const milestones = await this.getAvailableMilestones(customer);
            
            for (const milestone of milestones) {
                if (this.isMilestoneAchieved(milestone, metrics)) {
                    await this.processEvent({
                        type: 'milestone_achieved',
                        data: {
                            customer: customer,
                            milestone: milestone,
                            metrics: metrics,
                            achievement: {
                                date: new Date(),
                                value: metrics[milestone.metric]
                            }
                        }
                    });
                }
            }
        }
    }
    
    isMilestoneAchieved(milestone, metrics) {
        const value = metrics[milestone.metric];
        
        switch (milestone.condition) {
            case 'greater_than':
                return value > milestone.target;
            case 'less_than':
                return value < milestone.target;
            case 'equals':
                return value === milestone.target;
            default:
                return false;
        }
    }
    
    // Mock data methods (would connect to database in production)
    async getExecutives() {
        return [
            { id: 'exec1', email: 'ceo@rootuip.com', phone: '+1234567890', role: 'executive' },
            { id: 'exec2', email: 'cto@rootuip.com', phone: '+1234567891', role: 'executive' }
        ];
    }
    
    async getStakeholders(entity) {
        return [
            { id: 'stake1', email: 'ops@rootuip.com', role: 'operations' },
            { id: 'stake2', email: 'cs@rootuip.com', role: 'customer_success' }
        ];
    }
    
    async getCustomerContact(customer) {
        return {
            id: customer.primaryContactId,
            email: customer.contactEmail,
            phone: customer.contactPhone,
            preferences: customer.notificationPreferences
        };
    }
    
    async getTeam(teamName) {
        const teams = {
            customer_success: {
                name: 'Customer Success',
                slackChannel: '#customer-success',
                members: [
                    { id: 'cs1', email: 'cs1@rootuip.com', notificationPreferences: {} },
                    { id: 'cs2', email: 'cs2@rootuip.com', notificationPreferences: {} }
                ]
            }
        };
        
        return teams[teamName] || { members: [] };
    }
    
    async getActiveCustomers() {
        // Mock implementation
        return [];
    }
    
    async getCustomerMetrics(customer) {
        // Mock implementation
        return {
            totalShipments: 1000,
            onTimeDelivery: 95.5,
            customerSince: new Date('2020-01-01')
        };
    }
    
    async getAvailableMilestones(customer) {
        // Mock implementation
        return [];
    }
}

module.exports = BusinessEventNotifier;