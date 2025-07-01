/**
 * ROOTUIP Incident Manager
 * Automated incident detection, response, and management
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class IncidentManager extends EventEmitter {
    constructor(notificationService, sliSloManager) {
        super();
        
        this.notificationService = notificationService;
        this.sliSloManager = sliSloManager;
        
        // Incident states
        this.INCIDENT_STATES = {
            DETECTED: 'detected',
            ACKNOWLEDGED: 'acknowledged',
            INVESTIGATING: 'investigating',
            IDENTIFIED: 'identified',
            FIXING: 'fixing',
            MONITORING: 'monitoring',
            RESOLVED: 'resolved',
            POSTMORTEM: 'postmortem'
        };
        
        // Incident severities
        this.SEVERITIES = {
            CRITICAL: { level: 1, sla: 15, escalation: 5 }, // 15 min SLA, escalate after 5 min
            HIGH: { level: 2, sla: 30, escalation: 15 },
            MEDIUM: { level: 3, sla: 120, escalation: 60 },
            LOW: { level: 4, sla: 480, escalation: 240 }
        };
        
        // Active incidents
        this.incidents = new Map();
        
        // Escalation policies
        this.escalationPolicies = this.loadEscalationPolicies();
        
        // Runbooks
        this.runbooks = this.loadRunbooks();
        
        // On-call schedules
        this.oncallSchedules = new Map();
        
        // Initialize
        this.initialize();
    }
    
    async initialize() {
        // Subscribe to SLO violations
        this.sliSloManager.on('slo:violation', (violation) => {
            this.handleSLOViolation(violation);
        });
        
        // Subscribe to error budget exhaustion
        this.sliSloManager.on('error_budget:exhausted', (data) => {
            this.handleErrorBudgetExhaustion(data);
        });
        
        // Start incident monitoring
        this.startIncidentMonitoring();
        
        console.log('Incident Manager initialized');
    }
    
    // Create new incident
    async createIncident(data) {
        const incident = {
            id: uuidv4(),
            title: data.title,
            description: data.description,
            severity: data.severity || 'MEDIUM',
            service: data.service,
            impact: data.impact || this.assessImpact(data),
            state: this.INCIDENT_STATES.DETECTED,
            detectedAt: new Date(),
            acknowledgedAt: null,
            resolvedAt: null,
            mttr: null,
            timeline: [],
            responders: [],
            runbook: null,
            rootCause: null,
            affectedComponents: data.affectedComponents || [],
            customerImpact: data.customerImpact || false,
            metrics: data.metrics || {}
        };
        
        // Add to timeline
        this.addTimelineEvent(incident, 'Incident detected', {
            trigger: data.trigger,
            initialMetrics: data.metrics
        });
        
        // Store incident
        this.incidents.set(incident.id, incident);
        
        // Find matching runbook
        incident.runbook = this.findMatchingRunbook(incident);
        
        // Start response process
        await this.initiateResponse(incident);
        
        // Emit event
        this.emit('incident:created', incident);
        
        return incident;
    }
    
    // Initiate incident response
    async initiateResponse(incident) {
        // Page on-call
        await this.pageOncall(incident);
        
        // Create communication channels
        await this.createCommunicationChannels(incident);
        
        // Start auto-remediation if available
        if (incident.runbook && incident.runbook.autoRemediation) {
            await this.startAutoRemediation(incident);
        }
        
        // Set up monitoring
        this.monitorIncident(incident);
        
        // Schedule escalation
        this.scheduleEscalation(incident);
    }
    
    // Page on-call personnel
    async pageOncall(incident) {
        const oncall = await this.getOncallPerson(incident.service, incident.severity);
        
        if (!oncall) {
            console.error('No on-call person found for', incident.service);
            return;
        }
        
        // Send page
        const notification = {
            type: 'incident_page',
            severity: 'critical',
            title: `[${incident.severity}] ${incident.title}`,
            message: `New incident requires immediate attention: ${incident.description}`,
            channels: this.getPageChannels(incident.severity),
            data: {
                incidentId: incident.id,
                incidentUrl: `https://rootuip.com/incidents/${incident.id}`,
                runbook: incident.runbook?.url,
                service: incident.service
            },
            recipient: oncall
        };
        
        await this.notificationService.sendNotification(notification);
        
        // Add responder
        incident.responders.push({
            id: oncall.id,
            name: oncall.name,
            role: 'primary',
            pagedAt: new Date()
        });
        
        this.addTimelineEvent(incident, `Paged ${oncall.name}`, { method: notification.channels });
    }
    
    // Get on-call person
    async getOncallPerson(service, severity) {
        const schedule = this.oncallSchedules.get(service) || this.oncallSchedules.get('default');
        
        if (!schedule) return null;
        
        const now = new Date();
        const currentShift = schedule.shifts.find(shift => {
            const start = new Date(shift.start);
            const end = new Date(shift.end);
            return now >= start && now <= end;
        });
        
        if (severity === 'CRITICAL' && currentShift?.backup) {
            // For critical incidents, also return backup
            return [currentShift.primary, currentShift.backup];
        }
        
        return currentShift?.primary;
    }
    
    // Get page channels based on severity
    getPageChannels(severity) {
        switch (severity) {
            case 'CRITICAL':
                return ['sms', 'phone', 'push', 'email'];
            case 'HIGH':
                return ['sms', 'push', 'email'];
            case 'MEDIUM':
                return ['push', 'email', 'slack'];
            default:
                return ['email', 'slack'];
        }
    }
    
    // Create communication channels
    async createCommunicationChannels(incident) {
        // Create Slack channel
        const channelName = `inc-${incident.id.substring(0, 8)}`;
        
        // In production, this would create actual Slack channel
        incident.slackChannel = `#${channelName}`;
        
        // Create video conference bridge
        incident.confBridge = {
            url: `https://meet.rootuip.com/incident-${incident.id}`,
            dialIn: '+1-800-ROOTUIP'
        };
        
        // Send initial status
        await this.sendIncidentUpdate(incident, 'Incident response initiated');
    }
    
    // Acknowledge incident
    async acknowledgeIncident(incidentId, responderId) {
        const incident = this.incidents.get(incidentId);
        if (!incident) return null;
        
        incident.state = this.INCIDENT_STATES.ACKNOWLEDGED;
        incident.acknowledgedAt = new Date();
        
        // Add responder if not already added
        if (!incident.responders.find(r => r.id === responderId)) {
            incident.responders.push({
                id: responderId,
                name: `Responder ${responderId}`,
                role: 'responder',
                joinedAt: new Date()
            });
        }
        
        this.addTimelineEvent(incident, 'Incident acknowledged', { responderId });
        
        // Cancel escalation if acknowledged within time
        this.cancelEscalation(incident);
        
        // Update metrics
        incident.timeToAcknowledge = incident.acknowledgedAt - incident.detectedAt;
        
        this.emit('incident:acknowledged', incident);
        
        return incident;
    }
    
    // Update incident state
    async updateIncidentState(incidentId, newState, data = {}) {
        const incident = this.incidents.get(incidentId);
        if (!incident) return null;
        
        const oldState = incident.state;
        incident.state = newState;
        
        this.addTimelineEvent(incident, `State changed from ${oldState} to ${newState}`, data);
        
        // Handle state-specific actions
        switch (newState) {
            case this.INCIDENT_STATES.RESOLVED:
                await this.resolveIncident(incident, data);
                break;
            case this.INCIDENT_STATES.IDENTIFIED:
                incident.rootCause = data.rootCause;
                break;
        }
        
        // Send update
        await this.sendIncidentUpdate(incident, `Incident ${newState}`);
        
        this.emit('incident:updated', incident);
        
        return incident;
    }
    
    // Resolve incident
    async resolveIncident(incident, resolution) {
        incident.resolvedAt = new Date();
        incident.resolution = resolution;
        incident.mttr = incident.resolvedAt - incident.detectedAt;
        
        // Calculate metrics
        const mttrMinutes = Math.floor(incident.mttr / 60000);
        const sla = this.SEVERITIES[incident.severity].sla;
        incident.metSLA = mttrMinutes <= sla;
        
        // Update timeline
        this.addTimelineEvent(incident, 'Incident resolved', {
            resolution: resolution.description,
            mttr: `${mttrMinutes} minutes`,
            metSLA: incident.metSLA
        });
        
        // Send resolution notification
        await this.sendResolutionNotification(incident);
        
        // Schedule post-mortem for significant incidents
        if (incident.severity === 'CRITICAL' || incident.severity === 'HIGH' || !incident.metSLA) {
            await this.schedulePostMortem(incident);
        }
        
        this.emit('incident:resolved', incident);
    }
    
    // Start auto-remediation
    async startAutoRemediation(incident) {
        const runbook = incident.runbook;
        if (!runbook || !runbook.autoRemediation) return;
        
        this.addTimelineEvent(incident, 'Starting auto-remediation', {
            runbook: runbook.name
        });
        
        try {
            for (const step of runbook.autoRemediation.steps) {
                const result = await this.executeRemediationStep(step, incident);
                
                this.addTimelineEvent(incident, `Executed: ${step.name}`, {
                    success: result.success,
                    output: result.output
                });
                
                if (!result.success) {
                    throw new Error(`Remediation step failed: ${step.name}`);
                }
                
                // Check if issue resolved
                if (await this.checkIfResolved(incident)) {
                    await this.updateIncidentState(incident.id, this.INCIDENT_STATES.RESOLVED, {
                        description: 'Auto-remediation successful',
                        automatedResolution: true
                    });
                    return;
                }
            }
        } catch (error) {
            this.addTimelineEvent(incident, 'Auto-remediation failed', {
                error: error.message
            });
            
            // Escalate since auto-remediation failed
            await this.escalateIncident(incident, 'Auto-remediation failed');
        }
    }
    
    // Execute remediation step
    async executeRemediationStep(step, incident) {
        try {
            switch (step.type) {
                case 'restart_service':
                    return await this.restartService(step.target);
                    
                case 'scale_up':
                    return await this.scaleService(step.target, step.instances);
                    
                case 'failover':
                    return await this.performFailover(step.target);
                    
                case 'clear_cache':
                    return await this.clearCache(step.target);
                    
                case 'rollback':
                    return await this.rollbackDeployment(step.target, step.version);
                    
                default:
                    return { success: false, output: 'Unknown remediation type' };
            }
        } catch (error) {
            return { success: false, output: error.message };
        }
    }
    
    // Schedule escalation
    scheduleEscalation(incident) {
        const escalationTime = this.SEVERITIES[incident.severity].escalation * 60000;
        
        incident.escalationTimer = setTimeout(() => {
            if (incident.state === this.INCIDENT_STATES.DETECTED) {
                this.escalateIncident(incident, 'No acknowledgment within SLA');
            }
        }, escalationTime);
    }
    
    // Escalate incident
    async escalateIncident(incident, reason) {
        const policy = this.escalationPolicies.get(incident.service) || 
                      this.escalationPolicies.get('default');
        
        if (!policy) return;
        
        const currentLevel = incident.escalationLevel || 0;
        const nextLevel = policy.levels[currentLevel + 1];
        
        if (!nextLevel) {
            // Max escalation reached
            return;
        }
        
        incident.escalationLevel = currentLevel + 1;
        
        this.addTimelineEvent(incident, `Escalated to level ${incident.escalationLevel}`, {
            reason,
            notified: nextLevel.contacts
        });
        
        // Notify next level
        for (const contact of nextLevel.contacts) {
            await this.notificationService.sendNotification({
                type: 'incident_escalation',
                severity: 'critical',
                title: `[ESCALATED] ${incident.title}`,
                message: `Incident escalated: ${reason}`,
                recipient: contact,
                channels: ['sms', 'phone', 'email'],
                data: { incident }
            });
        }
        
        this.emit('incident:escalated', incident);
    }
    
    // Monitor incident
    monitorIncident(incident) {
        // Set up continuous monitoring
        incident.monitor = setInterval(async () => {
            // Check if incident is worsening
            const currentMetrics = await this.getCurrentMetrics(incident.service);
            
            if (this.isWorsening(incident.metrics, currentMetrics)) {
                await this.escalateIncident(incident, 'Incident worsening');
            }
            
            // Update metrics
            incident.currentMetrics = currentMetrics;
            
        }, 60000); // Check every minute
    }
    
    // Send incident update
    async sendIncidentUpdate(incident, message) {
        const update = {
            type: 'incident_update',
            severity: incident.severity.toLowerCase(),
            title: `[${incident.severity}] Incident Update: ${incident.id}`,
            message: message,
            channels: ['slack', 'email'],
            data: {
                incident: incident,
                dashboardUrl: `https://rootuip.com/incidents/${incident.id}`
            }
        };
        
        // Send to all responders
        for (const responder of incident.responders) {
            await this.notificationService.sendNotification({
                ...update,
                recipient: responder
            });
        }
        
        // Send to incident channel
        if (incident.slackChannel) {
            await this.notificationService.sendNotification({
                ...update,
                channel: incident.slackChannel
            });
        }
    }
    
    // Handle SLO violation
    async handleSLOViolation(violation) {
        // Check if violation should create incident
        if (violation.severity === 'critical' || violation.severity === 'high') {
            const existingIncident = this.findExistingIncident(violation.service, violation.slo);
            
            if (!existingIncident) {
                await this.createIncident({
                    title: `SLO Violation: ${violation.slo} for ${violation.service}`,
                    description: `${violation.slo} SLO violated. Current: ${violation.sli.value}%, Target: ${violation.sli.target}%`,
                    severity: violation.severity.toUpperCase(),
                    service: violation.service,
                    trigger: 'slo_violation',
                    metrics: {
                        slo: violation.slo,
                        current: violation.sli.value,
                        target: violation.sli.target
                    }
                });
            }
        }
    }
    
    // Handle error budget exhaustion
    async handleErrorBudgetExhaustion(data) {
        await this.createIncident({
            title: `Error Budget Exhausted: ${data.slo}`,
            description: `Error budget for ${data.slo} has been exhausted. Immediate action required.`,
            severity: 'HIGH',
            service: 'platform',
            trigger: 'error_budget_exhausted',
            customerImpact: true,
            metrics: {
                errorBudget: data.budget
            }
        });
    }
    
    // Schedule post-mortem
    async schedulePostMortem(incident) {
        const postMortemDate = new Date();
        postMortemDate.setDate(postMortemDate.getDate() + 2); // 2 days after resolution
        
        incident.postMortem = {
            scheduled: postMortemDate,
            attendees: incident.responders,
            status: 'scheduled'
        };
        
        // Send calendar invite
        await this.notificationService.sendNotification({
            type: 'postmortem_scheduled',
            title: `Post-mortem scheduled: ${incident.title}`,
            message: `Post-mortem review scheduled for ${postMortemDate.toLocaleString()}`,
            template: 'calendar_invite',
            recipients: incident.responders,
            data: {
                incident: incident,
                meetingUrl: incident.confBridge.url,
                agenda: this.generatePostMortemAgenda(incident)
            }
        });
        
        this.addTimelineEvent(incident, 'Post-mortem scheduled', {
            date: postMortemDate
        });
    }
    
    // Generate post-mortem agenda
    generatePostMortemAgenda(incident) {
        return {
            timeline: 'Review incident timeline',
            impact: 'Assess customer and business impact',
            rootCause: 'Identify root cause(s)',
            contributing: 'Discuss contributing factors',
            response: 'Evaluate incident response',
            actionItems: 'Define preventive action items',
            improvements: 'Identify process improvements'
        };
    }
    
    // Create post-mortem report
    async createPostMortemReport(incidentId, data) {
        const incident = this.incidents.get(incidentId);
        if (!incident) return null;
        
        incident.postMortemReport = {
            createdAt: new Date(),
            summary: data.summary,
            timeline: incident.timeline,
            rootCauses: data.rootCauses,
            contributingFactors: data.contributingFactors,
            impact: {
                duration: incident.mttr,
                customersAffected: data.customersAffected,
                revenueImpact: data.revenueImpact,
                slaBreaches: data.slaBreaches
            },
            whatWentWell: data.whatWentWell,
            whatWentWrong: data.whatWentWrong,
            actionItems: data.actionItems,
            lessonsLearned: data.lessonsLearned
        };
        
        incident.state = this.INCIDENT_STATES.POSTMORTEM;
        
        // Share report
        await this.sharePostMortemReport(incident);
        
        this.emit('incident:postmortem', incident);
        
        return incident.postMortemReport;
    }
    
    // Helper methods
    addTimelineEvent(incident, event, data = {}) {
        incident.timeline.push({
            timestamp: new Date(),
            event,
            data
        });
    }
    
    findMatchingRunbook(incident) {
        // Find runbook based on service and symptoms
        const serviceRunbooks = this.runbooks.get(incident.service) || [];
        
        return serviceRunbooks.find(runbook => {
            // Match based on keywords, metrics, or patterns
            if (runbook.keywords) {
                return runbook.keywords.some(keyword => 
                    incident.title.toLowerCase().includes(keyword) ||
                    incident.description.toLowerCase().includes(keyword)
                );
            }
            return false;
        });
    }
    
    findExistingIncident(service, slo) {
        for (const [id, incident] of this.incidents) {
            if (incident.state !== this.INCIDENT_STATES.RESOLVED &&
                incident.service === service &&
                incident.metrics.slo === slo) {
                return incident;
            }
        }
        return null;
    }
    
    async checkIfResolved(incident) {
        // Check if the issue that triggered the incident is resolved
        const currentMetrics = await this.getCurrentMetrics(incident.service);
        
        // Logic depends on incident type
        if (incident.trigger === 'slo_violation') {
            return currentMetrics[incident.metrics.slo] >= incident.metrics.target;
        }
        
        return false;
    }
    
    isWorsening(oldMetrics, newMetrics) {
        // Compare metrics to determine if situation is worsening
        // Implementation depends on specific metrics
        return false;
    }
    
    async getCurrentMetrics(service) {
        // Get current metrics for service
        // In production, this would fetch from monitoring system
        return {
            availability: 99.9,
            latency: 150,
            errorRate: 0.1
        };
    }
    
    cancelEscalation(incident) {
        if (incident.escalationTimer) {
            clearTimeout(incident.escalationTimer);
            incident.escalationTimer = null;
        }
    }
    
    // Load configuration
    loadRunbooks() {
        const runbooks = new Map();
        
        // Example runbooks
        runbooks.set('api', [
            {
                name: 'High latency',
                keywords: ['latency', 'slow', 'timeout'],
                autoRemediation: {
                    enabled: true,
                    steps: [
                        { type: 'scale_up', target: 'api', instances: 2 },
                        { type: 'clear_cache', target: 'api-cache' }
                    ]
                }
            },
            {
                name: 'High error rate',
                keywords: ['error', '500', 'failed'],
                autoRemediation: {
                    enabled: true,
                    steps: [
                        { type: 'restart_service', target: 'api' },
                        { type: 'rollback', target: 'api', version: 'previous' }
                    ]
                }
            }
        ]);
        
        return runbooks;
    }
    
    loadEscalationPolicies() {
        const policies = new Map();
        
        policies.set('default', {
            levels: [
                { level: 0, contacts: [], wait: 0 },
                { level: 1, contacts: ['oncall-secondary'], wait: 15 },
                { level: 2, contacts: ['team-lead'], wait: 30 },
                { level: 3, contacts: ['engineering-manager', 'cto'], wait: 60 }
            ]
        });
        
        return policies;
    }
    
    // Mock remediation methods
    async restartService(service) {
        console.log(`Restarting service: ${service}`);
        return { success: true, output: `Service ${service} restarted` };
    }
    
    async scaleService(service, instances) {
        console.log(`Scaling ${service} to ${instances} instances`);
        return { success: true, output: `Scaled to ${instances} instances` };
    }
    
    async performFailover(service) {
        console.log(`Performing failover for ${service}`);
        return { success: true, output: 'Failover completed' };
    }
    
    async clearCache(cache) {
        console.log(`Clearing cache: ${cache}`);
        return { success: true, output: 'Cache cleared' };
    }
    
    async rollbackDeployment(service, version) {
        console.log(`Rolling back ${service} to ${version}`);
        return { success: true, output: `Rolled back to ${version}` };
    }
    
    async sendResolutionNotification(incident) {
        const notification = {
            type: 'incident_resolved',
            severity: 'info',
            title: `Incident Resolved: ${incident.title}`,
            message: `MTTR: ${Math.floor(incident.mttr / 60000)} minutes. ${incident.metSLA ? 'Met SLA' : 'Missed SLA'}`,
            channels: ['slack', 'email'],
            data: { incident }
        };
        
        // Notify all responders
        for (const responder of incident.responders) {
            await this.notificationService.sendNotification({
                ...notification,
                recipient: responder
            });
        }
    }
    
    async sharePostMortemReport(incident) {
        // Share report with stakeholders
        console.log('Sharing post-mortem report for incident:', incident.id);
    }
    
    // Start monitoring
    startIncidentMonitoring() {
        // Monitor for stale incidents
        setInterval(() => {
            this.checkStaleIncidents();
        }, 300000); // Every 5 minutes
    }
    
    checkStaleIncidents() {
        const now = new Date();
        
        for (const [id, incident] of this.incidents) {
            if (incident.state !== this.INCIDENT_STATES.RESOLVED) {
                const age = now - incident.detectedAt;
                const ageMinutes = Math.floor(age / 60000);
                
                // Alert if incident is taking too long
                if (ageMinutes > this.SEVERITIES[incident.severity].sla * 2) {
                    this.escalateIncident(incident, `Incident open for ${ageMinutes} minutes`);
                }
            }
        }
    }
}

module.exports = IncidentManager;