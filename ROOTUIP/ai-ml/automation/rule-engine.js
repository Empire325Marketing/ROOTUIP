/**
 * Automation Rule Engine
 * Intelligent workflow automation for container management
 */

const EventEmitter = require('events');
const moment = require('moment');

// Rule types and conditions
const RULE_TYPES = {
    TRIGGER: 'trigger',
    CONDITION: 'condition',
    ACTION: 'action',
    NOTIFICATION: 'notification'
};

const TRIGGER_EVENTS = {
    CONTAINER_UPDATE: 'container.update',
    CHARGE_DETECTED: 'charge.detected',
    RISK_THRESHOLD: 'risk.threshold',
    DOCUMENT_RECEIVED: 'document.received',
    DELAY_PREDICTED: 'delay.predicted',
    DISPUTE_ELIGIBLE: 'dispute.eligible'
};

const CONDITIONS = {
    GREATER_THAN: 'gt',
    LESS_THAN: 'lt',
    EQUALS: 'eq',
    CONTAINS: 'contains',
    IN_RANGE: 'in_range',
    MATCHES_PATTERN: 'matches',
    TIME_WINDOW: 'time_window'
};

const ACTIONS = {
    SEND_ALERT: 'send_alert',
    CREATE_TASK: 'create_task',
    UPDATE_STATUS: 'update_status',
    INITIATE_DISPUTE: 'initiate_dispute',
    SCHEDULE_PICKUP: 'schedule_pickup',
    GENERATE_REPORT: 'generate_report',
    ESCALATE: 'escalate',
    API_CALL: 'api_call'
};

// Pre-built automation templates
const AUTOMATION_TEMPLATES = {
    DD_PREVENTION: {
        name: 'D&D Charge Prevention',
        description: 'Automatically prevent demurrage and detention charges',
        rules: [
            {
                trigger: TRIGGER_EVENTS.CONTAINER_UPDATE,
                conditions: [
                    { field: 'status', operator: CONDITIONS.EQUALS, value: 'discharged' }
                ],
                actions: [
                    { type: ACTIONS.CREATE_TASK, params: { task: 'schedule_pickup', priority: 'high' } },
                    { type: ACTIONS.SEND_ALERT, params: { channel: 'email', template: 'discharge_notification' } }
                ]
            },
            {
                trigger: TRIGGER_EVENTS.RISK_THRESHOLD,
                conditions: [
                    { field: 'riskScore', operator: CONDITIONS.GREATER_THAN, value: 0.7 }
                ],
                actions: [
                    { type: ACTIONS.ESCALATE, params: { to: 'operations_manager' } },
                    { type: ACTIONS.SCHEDULE_PICKUP, params: { urgency: 'immediate' } }
                ]
            }
        ]
    },
    DISPUTE_AUTOMATION: {
        name: 'Automated Dispute Management',
        description: 'Identify and file disputes for eligible charges',
        rules: [
            {
                trigger: TRIGGER_EVENTS.CHARGE_DETECTED,
                conditions: [
                    { field: 'disputeEligible', operator: CONDITIONS.EQUALS, value: true },
                    { field: 'amount', operator: CONDITIONS.GREATER_THAN, value: 500 }
                ],
                actions: [
                    { type: ACTIONS.INITIATE_DISPUTE, params: { autoFile: true } },
                    { type: ACTIONS.GENERATE_REPORT, params: { type: 'dispute_evidence' } }
                ]
            }
        ]
    },
    PROACTIVE_MONITORING: {
        name: 'Proactive Container Monitoring',
        description: 'Monitor containers and predict issues before they occur',
        rules: [
            {
                trigger: TRIGGER_EVENTS.DELAY_PREDICTED,
                conditions: [
                    { field: 'delayDays', operator: CONDITIONS.GREATER_THAN, value: 3 }
                ],
                actions: [
                    { type: ACTIONS.SEND_ALERT, params: { channel: 'sms', priority: 'high' } },
                    { type: ACTIONS.UPDATE_STATUS, params: { status: 'at_risk' } }
                ]
            }
        ]
    }
};

class AutomationRuleEngine extends EventEmitter {
    constructor() {
        super();
        
        this.rules = new Map();
        this.workflows = new Map();
        this.activeAutomations = new Map();
        
        // Execution statistics
        this.stats = {
            rulesExecuted: 0,
            actionsPerformed: 0,
            automationsSaved: 0,
            averageExecutionTime: 0,
            successRate: 0
        };
        
        // Initialize default templates
        this.loadTemplates();
    }

    // Load automation templates
    loadTemplates() {
        Object.entries(AUTOMATION_TEMPLATES).forEach(([key, template]) => {
            this.createWorkflow(key, template);
        });
    }

    // Create new automation workflow
    createWorkflow(id, config) {
        const workflow = {
            id: id,
            name: config.name,
            description: config.description,
            rules: config.rules,
            enabled: true,
            created: new Date(),
            lastExecuted: null,
            executionCount: 0,
            metrics: {
                totalExecutions: 0,
                successfulExecutions: 0,
                averageExecutionTime: 0,
                lastError: null
            }
        };
        
        this.workflows.set(id, workflow);
        
        // Register rules
        config.rules.forEach((rule, index) => {
            this.registerRule(`${id}_${index}`, rule);
        });
        
        this.emit('workflow_created', { workflowId: id, workflow });
        return workflow;
    }

    // Register individual rule
    registerRule(ruleId, ruleConfig) {
        const rule = {
            id: ruleId,
            trigger: ruleConfig.trigger,
            conditions: ruleConfig.conditions || [],
            actions: ruleConfig.actions || [],
            enabled: true,
            priority: ruleConfig.priority || 'normal'
        };
        
        this.rules.set(ruleId, rule);
        
        // Subscribe to trigger events
        this.subscribeToTrigger(rule.trigger, ruleId);
    }

    // Subscribe to trigger events
    subscribeToTrigger(trigger, ruleId) {
        // In real implementation, this would connect to actual event sources
        // For demo, we'll simulate events
        this.on(trigger, (data) => {
            this.evaluateRule(ruleId, data);
        });
    }

    // Evaluate rule conditions
    async evaluateRule(ruleId, eventData) {
        const startTime = Date.now();
        const rule = this.rules.get(ruleId);
        
        if (!rule || !rule.enabled) return;
        
        this.emit('rule_evaluation_started', { ruleId, eventData });
        
        try {
            // Check all conditions
            const conditionsMet = await this.evaluateConditions(rule.conditions, eventData);
            
            if (conditionsMet) {
                // Execute actions
                await this.executeActions(rule.actions, eventData);
                
                // Update metrics
                this.updateRuleMetrics(ruleId, true, Date.now() - startTime);
                
                this.emit('rule_executed', {
                    ruleId,
                    eventData,
                    executionTime: Date.now() - startTime
                });
            }
            
        } catch (error) {
            this.updateRuleMetrics(ruleId, false, Date.now() - startTime, error);
            this.emit('rule_error', { ruleId, error: error.message });
        }
    }

    // Evaluate conditions
    async evaluateConditions(conditions, data) {
        for (const condition of conditions) {
            const fieldValue = this.getFieldValue(data, condition.field);
            const met = this.checkCondition(fieldValue, condition.operator, condition.value);
            
            if (!met) return false;
        }
        
        return true;
    }

    // Get nested field value
    getFieldValue(data, field) {
        const parts = field.split('.');
        let value = data;
        
        for (const part of parts) {
            value = value[part];
            if (value === undefined) return null;
        }
        
        return value;
    }

    // Check individual condition
    checkCondition(fieldValue, operator, targetValue) {
        switch (operator) {
            case CONDITIONS.GREATER_THAN:
                return fieldValue > targetValue;
                
            case CONDITIONS.LESS_THAN:
                return fieldValue < targetValue;
                
            case CONDITIONS.EQUALS:
                return fieldValue === targetValue;
                
            case CONDITIONS.CONTAINS:
                return fieldValue && fieldValue.includes(targetValue);
                
            case CONDITIONS.IN_RANGE:
                return fieldValue >= targetValue.min && fieldValue <= targetValue.max;
                
            case CONDITIONS.MATCHES_PATTERN:
                return new RegExp(targetValue).test(fieldValue);
                
            case CONDITIONS.TIME_WINDOW:
                const time = moment(fieldValue);
                const start = moment(targetValue.start);
                const end = moment(targetValue.end);
                return time.isBetween(start, end);
                
            default:
                return false;
        }
    }

    // Execute actions
    async executeActions(actions, data) {
        const results = [];
        
        for (const action of actions) {
            const result = await this.executeAction(action, data);
            results.push(result);
        }
        
        return results;
    }

    // Execute individual action
    async executeAction(action, data) {
        const startTime = Date.now();
        
        this.emit('action_started', { action: action.type, data });
        
        try {
            let result;
            
            switch (action.type) {
                case ACTIONS.SEND_ALERT:
                    result = await this.sendAlert(action.params, data);
                    break;
                    
                case ACTIONS.CREATE_TASK:
                    result = await this.createTask(action.params, data);
                    break;
                    
                case ACTIONS.UPDATE_STATUS:
                    result = await this.updateStatus(action.params, data);
                    break;
                    
                case ACTIONS.INITIATE_DISPUTE:
                    result = await this.initiateDispute(action.params, data);
                    break;
                    
                case ACTIONS.SCHEDULE_PICKUP:
                    result = await this.schedulePickup(action.params, data);
                    break;
                    
                case ACTIONS.GENERATE_REPORT:
                    result = await this.generateReport(action.params, data);
                    break;
                    
                case ACTIONS.ESCALATE:
                    result = await this.escalate(action.params, data);
                    break;
                    
                case ACTIONS.API_CALL:
                    result = await this.makeApiCall(action.params, data);
                    break;
                    
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
            
            this.stats.actionsPerformed++;
            
            this.emit('action_completed', {
                action: action.type,
                result,
                executionTime: Date.now() - startTime
            });
            
            return result;
            
        } catch (error) {
            this.emit('action_error', {
                action: action.type,
                error: error.message
            });
            throw error;
        }
    }

    // Action implementations
    async sendAlert(params, data) {
        const alert = {
            id: this.generateId(),
            channel: params.channel,
            template: params.template,
            priority: params.priority || 'normal',
            recipient: params.recipient || this.getDefaultRecipient(params.channel),
            data: data,
            sentAt: new Date()
        };
        
        // Simulate sending alert
        return new Promise((resolve) => {
            setTimeout(() => {
                this.emit('alert_sent', alert);
                resolve({
                    success: true,
                    alertId: alert.id,
                    channel: alert.channel
                });
            }, 100);
        });
    }

    async createTask(params, data) {
        const task = {
            id: this.generateId(),
            type: params.task,
            priority: params.priority || 'normal',
            assignee: params.assignee || 'auto',
            data: data,
            status: 'pending',
            createdAt: new Date(),
            dueDate: this.calculateDueDate(params.priority)
        };
        
        // Store task
        this.activeAutomations.set(task.id, task);
        
        this.emit('task_created', task);
        
        return {
            success: true,
            taskId: task.id,
            dueDate: task.dueDate
        };
    }

    async updateStatus(params, data) {
        const update = {
            entityId: data.containerNumber || data.id,
            previousStatus: data.status,
            newStatus: params.status,
            updatedAt: new Date(),
            reason: 'Automated by rule engine'
        };
        
        this.emit('status_updated', update);
        
        return {
            success: true,
            update: update
        };
    }

    async initiateDispute(params, data) {
        const dispute = {
            id: this.generateId(),
            chargeId: data.chargeId,
            containerNumber: data.containerNumber,
            amount: data.amount,
            reason: this.determineDisputeReason(data),
            evidence: await this.gatherEvidence(data),
            autoFiled: params.autoFile,
            createdAt: new Date(),
            status: 'pending'
        };
        
        if (params.autoFile) {
            dispute.filedAt = new Date();
            dispute.status = 'filed';
        }
        
        this.emit('dispute_initiated', dispute);
        
        return {
            success: true,
            disputeId: dispute.id,
            status: dispute.status
        };
    }

    async schedulePickup(params, data) {
        const pickup = {
            id: this.generateId(),
            containerNumber: data.containerNumber,
            location: data.location,
            urgency: params.urgency || 'normal',
            requestedDate: this.calculatePickupDate(params.urgency),
            carrier: data.carrier,
            status: 'scheduled',
            createdAt: new Date()
        };
        
        this.emit('pickup_scheduled', pickup);
        
        return {
            success: true,
            pickupId: pickup.id,
            scheduledDate: pickup.requestedDate
        };
    }

    async generateReport(params, data) {
        const report = {
            id: this.generateId(),
            type: params.type,
            format: params.format || 'pdf',
            data: this.prepareReportData(params.type, data),
            generatedAt: new Date(),
            url: `/reports/${this.generateId()}.${params.format || 'pdf'}`
        };
        
        this.emit('report_generated', report);
        
        return {
            success: true,
            reportId: report.id,
            url: report.url
        };
    }

    async escalate(params, data) {
        const escalation = {
            id: this.generateId(),
            to: params.to,
            level: params.level || 1,
            reason: params.reason || 'Automated escalation',
            data: data,
            createdAt: new Date(),
            priority: 'high'
        };
        
        this.emit('escalation_created', escalation);
        
        return {
            success: true,
            escalationId: escalation.id,
            assignedTo: escalation.to
        };
    }

    async makeApiCall(params, data) {
        // Simulate API call
        const apiCall = {
            id: this.generateId(),
            endpoint: params.endpoint,
            method: params.method || 'POST',
            payload: this.prepareApiPayload(params.template, data),
            timestamp: new Date()
        };
        
        return new Promise((resolve) => {
            setTimeout(() => {
                this.emit('api_called', apiCall);
                resolve({
                    success: true,
                    callId: apiCall.id,
                    response: { status: 200, data: 'OK' }
                });
            }, 200);
        });
    }

    // Create custom automation
    createCustomAutomation(config) {
        const automation = {
            id: this.generateId(),
            name: config.name,
            description: config.description,
            trigger: {
                event: config.triggerEvent,
                filters: config.triggerFilters || []
            },
            conditions: config.conditions || [],
            actions: config.actions || [],
            schedule: config.schedule,
            enabled: true,
            created: new Date(),
            metrics: {
                executions: 0,
                successes: 0,
                failures: 0,
                avgExecutionTime: 0
            }
        };
        
        // Validate automation
        const validation = this.validateAutomation(automation);
        if (!validation.valid) {
            throw new Error(`Invalid automation: ${validation.errors.join(', ')}`);
        }
        
        // Register automation
        this.workflows.set(automation.id, automation);
        this.registerRule(automation.id, {
            trigger: automation.trigger.event,
            conditions: automation.conditions,
            actions: automation.actions
        });
        
        this.emit('custom_automation_created', automation);
        
        return automation;
    }

    // Validate automation configuration
    validateAutomation(automation) {
        const errors = [];
        
        // Check trigger
        if (!automation.trigger || !automation.trigger.event) {
            errors.push('Trigger event is required');
        }
        
        // Check conditions
        automation.conditions.forEach((condition, index) => {
            if (!condition.field || !condition.operator || condition.value === undefined) {
                errors.push(`Condition ${index + 1} is incomplete`);
            }
        });
        
        // Check actions
        if (!automation.actions || automation.actions.length === 0) {
            errors.push('At least one action is required');
        }
        
        automation.actions.forEach((action, index) => {
            if (!action.type) {
                errors.push(`Action ${index + 1} type is required`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // Simulate automation execution
    async simulateAutomation(automationId, testData) {
        const automation = this.workflows.get(automationId);
        if (!automation) {
            throw new Error('Automation not found');
        }
        
        const simulation = {
            id: this.generateId(),
            automationId: automationId,
            testData: testData,
            startTime: Date.now(),
            steps: []
        };
        
        // Simulate trigger
        simulation.steps.push({
            type: 'trigger',
            event: automation.trigger?.event || automation.rules[0].trigger,
            timestamp: Date.now(),
            status: 'success'
        });
        
        // Simulate conditions
        const conditions = automation.conditions || automation.rules[0].conditions;
        for (const condition of conditions) {
            const met = await this.checkCondition(
                this.getFieldValue(testData, condition.field),
                condition.operator,
                condition.value
            );
            
            simulation.steps.push({
                type: 'condition',
                condition: condition,
                met: met,
                timestamp: Date.now(),
                status: met ? 'success' : 'failed'
            });
            
            if (!met) {
                simulation.result = 'conditions_not_met';
                break;
            }
        }
        
        // Simulate actions if conditions met
        if (!simulation.result) {
            const actions = automation.actions || automation.rules[0].actions;
            for (const action of actions) {
                simulation.steps.push({
                    type: 'action',
                    action: action.type,
                    params: action.params,
                    timestamp: Date.now(),
                    status: 'success',
                    result: { simulated: true }
                });
            }
            
            simulation.result = 'completed';
        }
        
        simulation.endTime = Date.now();
        simulation.executionTime = simulation.endTime - simulation.startTime;
        
        this.emit('simulation_completed', simulation);
        
        return simulation;
    }

    // Get automation performance metrics
    getAutomationMetrics(automationId) {
        const automation = this.workflows.get(automationId);
        if (!automation) return null;
        
        return {
            automationId: automationId,
            name: automation.name,
            enabled: automation.enabled,
            metrics: automation.metrics,
            performance: {
                successRate: automation.metrics.executions > 0 
                    ? (automation.metrics.successes / automation.metrics.executions * 100).toFixed(2) + '%'
                    : 'N/A',
                avgExecutionTime: automation.metrics.avgExecutionTime + 'ms',
                lastExecution: automation.lastExecuted,
                totalSavings: this.calculateAutomationSavings(automation)
            }
        };
    }

    // Calculate automation savings
    calculateAutomationSavings(automation) {
        // Simulate savings calculation based on automation type
        const savingsPerExecution = {
            DD_PREVENTION: 2500,
            DISPUTE_AUTOMATION: 1850,
            PROACTIVE_MONITORING: 800
        };
        
        const baseSavings = savingsPerExecution[automation.id] || 500;
        return automation.metrics.successes * baseSavings;
    }

    // Helper methods
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    getDefaultRecipient(channel) {
        const defaults = {
            email: 'operations@company.com',
            sms: '+1234567890',
            slack: '#operations',
            teams: 'Operations Team'
        };
        return defaults[channel] || 'default@company.com';
    }

    calculateDueDate(priority) {
        const hours = {
            urgent: 2,
            high: 4,
            normal: 24,
            low: 48
        };
        return moment().add(hours[priority] || 24, 'hours').toDate();
    }

    calculatePickupDate(urgency) {
        const days = {
            immediate: 0,
            urgent: 1,
            normal: 2,
            flexible: 5
        };
        return moment().add(days[urgency] || 2, 'days').toDate();
    }

    determineDisputeReason(data) {
        if (data.scenario === 'port_congestion') return 'Port congestion beyond carrier control';
        if (data.scenario === 'customs_hold') return 'Government inspection delay';
        if (data.scenario === 'equipment_shortage') return 'Terminal equipment unavailability';
        return 'Operational delay';
    }

    async gatherEvidence(data) {
        // Simulate evidence gathering
        return [
            'Port congestion notice',
            'Terminal wait time report',
            'Vessel arrival records',
            'Free time calculation'
        ];
    }

    prepareReportData(type, data) {
        // Prepare data based on report type
        return {
            reportType: type,
            generatedAt: new Date(),
            data: data,
            summary: `Automated ${type} report`
        };
    }

    prepareApiPayload(template, data) {
        // Prepare API payload based on template
        return {
            template: template,
            data: data,
            timestamp: new Date()
        };
    }

    updateRuleMetrics(ruleId, success, executionTime, error = null) {
        const workflowId = ruleId.split('_')[0];
        const workflow = this.workflows.get(workflowId);
        
        if (workflow) {
            workflow.metrics.executions++;
            if (success) workflow.metrics.successes++;
            else workflow.metrics.failures++;
            
            // Update average execution time
            const prevAvg = workflow.metrics.avgExecutionTime;
            workflow.metrics.avgExecutionTime = 
                (prevAvg * (workflow.metrics.executions - 1) + executionTime) / workflow.metrics.executions;
            
            if (error) workflow.metrics.lastError = error.message;
            
            workflow.lastExecuted = new Date();
        }
        
        this.stats.rulesExecuted++;
        if (success) {
            this.stats.successRate = 
                ((this.stats.successRate * (this.stats.rulesExecuted - 1)) + 1) / this.stats.rulesExecuted;
        } else {
            this.stats.successRate = 
                (this.stats.successRate * (this.stats.rulesExecuted - 1)) / this.stats.rulesExecuted;
        }
    }

    // Get engine statistics
    getStats() {
        return {
            ...this.stats,
            totalWorkflows: this.workflows.size,
            activeRules: this.rules.size,
            activeTasks: this.activeAutomations.size,
            workflows: Array.from(this.workflows.values()).map(w => ({
                id: w.id,
                name: w.name,
                enabled: w.enabled,
                executions: w.metrics.executions
            }))
        };
    }
}

module.exports = AutomationRuleEngine;