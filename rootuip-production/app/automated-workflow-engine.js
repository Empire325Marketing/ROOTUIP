// ROOTUIP Automated Workflow Engine
// Orchestrates customer success workflows and automated actions

const { EventEmitter } = require('events');
const cron = require('node-cron');
const { Pool } = require('pg');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');
const axios = require('axios');
const winston = require('winston');
const Handlebars = require('handlebars');

// Initialize services
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'workflow-engine.log' }),
        new winston.transports.Console()
    ]
});

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

class WorkflowEngine extends EventEmitter {
    constructor() {
        super();
        this.workflows = new Map();
        this.activeJobs = new Map();
        this.templates = new Map();
        this.conditions = new Map();
        this.actions = new Map();
        
        this.initializeDefaultWorkflows();
        this.initializeActions();
        this.initializeConditions();
    }

    async initialize() {
        await this.loadWorkflowTemplates();
        await this.loadActiveWorkflows();
        await this.startScheduler();
        logger.info('Workflow Engine initialized');
    }

    initializeDefaultWorkflows() {
        // Onboarding Workflow
        this.registerWorkflow({
            id: 'onboarding-30-60-90',
            name: 'Customer Onboarding Journey',
            description: 'Automated 30-60-90 day onboarding workflow',
            triggers: ['customer_created'],
            steps: [
                {
                    id: 'welcome',
                    name: 'Send Welcome Email',
                    action: 'send_email',
                    template: 'welcome_email',
                    delay: 0,
                    conditions: []
                },
                {
                    id: 'schedule_kickoff',
                    name: 'Schedule Kickoff Call',
                    action: 'create_calendar_event',
                    delay: 60 * 60, // 1 hour
                    conditions: []
                },
                {
                    id: 'day_3_checkin',
                    name: 'Day 3 Check-in',
                    action: 'send_email',
                    template: 'day_3_checkin',
                    delay: 3 * 24 * 60 * 60, // 3 days
                    conditions: ['has_logged_in']
                },
                {
                    id: 'week_1_training',
                    name: 'Week 1 Training Reminder',
                    action: 'send_email',
                    template: 'training_reminder',
                    delay: 7 * 24 * 60 * 60, // 7 days
                    conditions: ['training_not_completed']
                },
                {
                    id: 'day_30_review',
                    name: '30-Day Success Review',
                    action: 'schedule_success_review',
                    delay: 30 * 24 * 60 * 60, // 30 days
                    conditions: []
                },
                {
                    id: 'day_60_optimization',
                    name: '60-Day Optimization Session',
                    action: 'schedule_optimization_call',
                    delay: 60 * 24 * 60 * 60, // 60 days
                    conditions: ['health_score_below_80']
                },
                {
                    id: 'day_90_ebr',
                    name: '90-Day Executive Review',
                    action: 'schedule_ebr',
                    delay: 90 * 24 * 60 * 60, // 90 days
                    conditions: []
                }
            ]
        });

        // Health Score Monitoring
        this.registerWorkflow({
            id: 'health-score-monitoring',
            name: 'Customer Health Monitoring',
            description: 'Monitors health scores and triggers interventions',
            triggers: ['health_score_calculated'],
            steps: [
                {
                    id: 'check_critical',
                    name: 'Check Critical Health',
                    action: 'evaluate_health',
                    conditions: ['health_score_below_40'],
                    branches: {
                        true: 'critical_intervention',
                        false: 'check_at_risk'
                    }
                },
                {
                    id: 'critical_intervention',
                    name: 'Critical Intervention',
                    action: 'critical_intervention_flow',
                    conditions: []
                },
                {
                    id: 'check_at_risk',
                    name: 'Check At-Risk Health',
                    action: 'evaluate_health',
                    conditions: ['health_score_below_60'],
                    branches: {
                        true: 'at_risk_intervention',
                        false: 'continue_monitoring'
                    }
                },
                {
                    id: 'at_risk_intervention',
                    name: 'At-Risk Intervention',
                    action: 'at_risk_intervention_flow',
                    conditions: []
                }
            ]
        });

        // Usage Drop Alert
        this.registerWorkflow({
            id: 'usage-drop-alert',
            name: 'Usage Drop Detection',
            description: 'Alerts when customer usage drops significantly',
            triggers: ['daily_usage_check'],
            steps: [
                {
                    id: 'analyze_usage',
                    name: 'Analyze Usage Patterns',
                    action: 'analyze_usage_trend',
                    conditions: []
                },
                {
                    id: 'check_drop',
                    name: 'Check Usage Drop',
                    action: 'evaluate_condition',
                    conditions: ['usage_dropped_30_percent'],
                    branches: {
                        true: 'send_usage_alert',
                        false: 'end'
                    }
                },
                {
                    id: 'send_usage_alert',
                    name: 'Send Usage Alert',
                    action: 'send_multi_channel_alert',
                    priority: 'high',
                    conditions: []
                }
            ]
        });

        // Expansion Opportunity
        this.registerWorkflow({
            id: 'expansion-opportunity',
            name: 'Expansion Opportunity Detection',
            description: 'Identifies and acts on expansion opportunities',
            triggers: ['monthly_analysis'],
            steps: [
                {
                    id: 'analyze_usage_limits',
                    name: 'Analyze Usage vs Limits',
                    action: 'check_usage_limits',
                    conditions: ['approaching_usage_limit']
                },
                {
                    id: 'check_feature_adoption',
                    name: 'Check Feature Adoption',
                    action: 'analyze_feature_usage',
                    conditions: ['high_feature_adoption']
                },
                {
                    id: 'calculate_expansion_score',
                    name: 'Calculate Expansion Score',
                    action: 'calculate_expansion_potential',
                    conditions: []
                },
                {
                    id: 'notify_sales',
                    name: 'Notify Sales Team',
                    action: 'create_expansion_opportunity',
                    conditions: ['expansion_score_above_70']
                }
            ]
        });

        // Renewal Workflow
        this.registerWorkflow({
            id: 'renewal-workflow',
            name: 'Contract Renewal Process',
            description: 'Automated renewal process starting 90 days before expiry',
            triggers: ['90_days_before_renewal'],
            steps: [
                {
                    id: 'renewal_kickoff',
                    name: 'Renewal Process Kickoff',
                    action: 'send_internal_alert',
                    template: 'renewal_kickoff',
                    conditions: []
                },
                {
                    id: 'prepare_renewal_deck',
                    name: 'Prepare Renewal Materials',
                    action: 'generate_renewal_deck',
                    delay: 3 * 24 * 60 * 60, // 3 days
                    conditions: []
                },
                {
                    id: 'schedule_renewal_call',
                    name: 'Schedule Renewal Discussion',
                    action: 'schedule_renewal_meeting',
                    delay: 7 * 24 * 60 * 60, // 7 days
                    conditions: []
                },
                {
                    id: '60_day_reminder',
                    name: '60-Day Renewal Reminder',
                    action: 'send_renewal_reminder',
                    delay: 30 * 24 * 60 * 60, // 30 days from start
                    conditions: ['renewal_not_confirmed']
                },
                {
                    id: '30_day_escalation',
                    name: '30-Day Escalation',
                    action: 'escalate_renewal',
                    delay: 60 * 24 * 60 * 60, // 60 days from start
                    conditions: ['renewal_not_confirmed']
                }
            ]
        });

        // Support Ticket Escalation
        this.registerWorkflow({
            id: 'ticket-escalation',
            name: 'Support Ticket Escalation',
            description: 'Escalates tickets based on SLA and priority',
            triggers: ['ticket_created', 'ticket_updated'],
            steps: [
                {
                    id: 'check_priority',
                    name: 'Check Ticket Priority',
                    action: 'evaluate_ticket_priority',
                    conditions: []
                },
                {
                    id: 'sla_timer',
                    name: 'Start SLA Timer',
                    action: 'start_sla_countdown',
                    conditions: []
                },
                {
                    id: 'first_response_check',
                    name: 'First Response SLA Check',
                    action: 'check_first_response',
                    delay: 'dynamic', // Based on priority
                    conditions: ['no_first_response']
                },
                {
                    id: 'escalate_to_senior',
                    name: 'Escalate to Senior Support',
                    action: 'escalate_ticket',
                    level: 2,
                    conditions: ['sla_breach_warning']
                },
                {
                    id: 'escalate_to_manager',
                    name: 'Escalate to Manager',
                    action: 'escalate_ticket',
                    level: 3,
                    conditions: ['sla_breached']
                }
            ]
        });
    }

    initializeActions() {
        // Email Actions
        this.registerAction('send_email', async (context) => {
            const { customerId, template, data } = context;
            const customer = await this.getCustomerData(customerId);
            const compiled = this.compileTemplate(template, { customer, ...data });
            
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: customer.primaryContact,
                subject: compiled.subject,
                html: compiled.html
            });
            
            await this.logActivity(customerId, 'email_sent', { template });
        });

        // Calendar Actions
        this.registerAction('create_calendar_event', async (context) => {
            const { customerId, eventType, data } = context;
            // Integration with calendar system (Google Calendar, Outlook, etc.)
            const event = await this.createCalendarEvent({
                customerId,
                type: eventType,
                ...data
            });
            
            await this.logActivity(customerId, 'calendar_event_created', { eventId: event.id });
        });

        // Health Score Actions
        this.registerAction('evaluate_health', async (context) => {
            const { customerId } = context;
            const healthData = await this.getHealthScore(customerId);
            
            return {
                score: healthData.score,
                trend: healthData.trend,
                factors: healthData.factors
            };
        });

        // Intervention Actions
        this.registerAction('critical_intervention_flow', async (context) => {
            const { customerId } = context;
            
            // 1. Alert CSM immediately
            await this.alertCSM(customerId, 'critical');
            
            // 2. Create urgent task
            await this.createTask({
                customerId,
                type: 'intervention',
                priority: 'critical',
                title: 'Critical Health Score - Immediate Action Required',
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });
            
            // 3. Schedule emergency call
            await this.scheduleCall(customerId, 'emergency', {
                within: '24_hours'
            });
            
            // 4. Notify leadership
            await this.notifyLeadership(customerId, 'customer_at_risk');
        });

        // Usage Analysis Actions
        this.registerAction('analyze_usage_trend', async (context) => {
            const { customerId } = context;
            const usage = await this.getUsageMetrics(customerId, 30); // Last 30 days
            
            const trend = this.calculateTrend(usage);
            const drop = this.calculateDrop(usage);
            
            return {
                trend,
                drop,
                current: usage.current,
                average: usage.average
            };
        });

        // Expansion Actions
        this.registerAction('calculate_expansion_potential', async (context) => {
            const { customerId } = context;
            
            const factors = {
                usageGrowth: await this.getUsageGrowth(customerId),
                featureAdoption: await this.getFeatureAdoption(customerId),
                supportTickets: await this.getSupportMetrics(customerId),
                engagementScore: await this.getEngagementScore(customerId),
                contractUtilization: await this.getContractUtilization(customerId)
            };
            
            const score = this.calculateExpansionScore(factors);
            
            await this.updateCustomerProperty(customerId, 'expansion_score', score);
            
            return { score, factors };
        });

        // Ticket Actions
        this.registerAction('escalate_ticket', async (context) => {
            const { ticketId, level } = context;
            
            const escalationPath = {
                2: 'senior_support',
                3: 'support_manager',
                4: 'director_support'
            };
            
            await this.assignTicketTo(ticketId, escalationPath[level]);
            await this.addTicketNote(ticketId, `Escalated to ${escalationPath[level]} due to SLA`);
            await this.sendEscalationNotification(ticketId, level);
        });
    }

    initializeConditions() {
        // Health Score Conditions
        this.registerCondition('health_score_below_40', async (context) => {
            const health = await this.getHealthScore(context.customerId);
            return health.score < 40;
        });

        this.registerCondition('health_score_below_60', async (context) => {
            const health = await this.getHealthScore(context.customerId);
            return health.score < 60;
        });

        this.registerCondition('health_score_below_80', async (context) => {
            const health = await this.getHealthScore(context.customerId);
            return health.score < 80;
        });

        // Usage Conditions
        this.registerCondition('usage_dropped_30_percent', async (context) => {
            const usage = context.data.usage;
            return usage.drop >= 30;
        });

        this.registerCondition('approaching_usage_limit', async (context) => {
            const utilization = await this.getContractUtilization(context.customerId);
            return utilization >= 85;
        });

        // Adoption Conditions
        this.registerCondition('high_feature_adoption', async (context) => {
            const adoption = await this.getFeatureAdoption(context.customerId);
            return adoption.score >= 80;
        });

        this.registerCondition('training_not_completed', async (context) => {
            const training = await this.getTrainingStatus(context.customerId);
            return !training.completed;
        });

        // Login Conditions
        this.registerCondition('has_logged_in', async (context) => {
            const lastLogin = await this.getLastLogin(context.customerId);
            return lastLogin !== null;
        });

        // Renewal Conditions
        this.registerCondition('renewal_not_confirmed', async (context) => {
            const renewal = await this.getRenewalStatus(context.customerId);
            return renewal.status !== 'confirmed';
        });

        // Support Conditions
        this.registerCondition('no_first_response', async (context) => {
            const ticket = await this.getTicket(context.ticketId);
            return !ticket.firstResponseAt;
        });

        this.registerCondition('sla_breach_warning', async (context) => {
            const sla = await this.checkSLA(context.ticketId);
            return sla.percentageUsed >= 75;
        });

        this.registerCondition('sla_breached', async (context) => {
            const sla = await this.checkSLA(context.ticketId);
            return sla.breached;
        });

        // Expansion Conditions
        this.registerCondition('expansion_score_above_70', async (context) => {
            return context.data.score >= 70;
        });
    }

    async executeWorkflow(workflowId, context) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        const execution = {
            id: this.generateExecutionId(),
            workflowId,
            context,
            startTime: new Date(),
            status: 'running',
            currentStep: 0,
            steps: []
        };

        try {
            logger.info(`Starting workflow execution: ${workflow.name}`, { executionId: execution.id });
            
            for (const step of workflow.steps) {
                const stepResult = await this.executeStep(step, execution);
                execution.steps.push(stepResult);
                
                if (stepResult.status === 'failed') {
                    execution.status = 'failed';
                    break;
                }
                
                if (step.branches && stepResult.result) {
                    const nextStepId = step.branches[stepResult.result];
                    if (nextStepId === 'end') break;
                    
                    const nextStep = workflow.steps.find(s => s.id === nextStepId);
                    if (nextStep) {
                        const branchResult = await this.executeStep(nextStep, execution);
                        execution.steps.push(branchResult);
                    }
                }
                
                execution.currentStep++;
            }
            
            execution.status = execution.status !== 'failed' ? 'completed' : execution.status;
            execution.endTime = new Date();
            
            await this.saveExecutionResult(execution);
            logger.info(`Workflow execution completed: ${workflow.name}`, { 
                executionId: execution.id,
                duration: execution.endTime - execution.startTime
            });
            
        } catch (error) {
            execution.status = 'error';
            execution.error = error.message;
            execution.endTime = new Date();
            
            await this.saveExecutionResult(execution);
            logger.error(`Workflow execution failed: ${workflow.name}`, { 
                executionId: execution.id,
                error: error.message
            });
            
            throw error;
        }
        
        return execution;
    }

    async executeStep(step, execution) {
        const stepExecution = {
            stepId: step.id,
            name: step.name,
            startTime: new Date(),
            status: 'running'
        };

        try {
            // Check conditions
            if (step.conditions && step.conditions.length > 0) {
                const conditionsMet = await this.evaluateConditions(step.conditions, execution.context);
                if (!conditionsMet) {
                    stepExecution.status = 'skipped';
                    stepExecution.reason = 'Conditions not met';
                    return stepExecution;
                }
            }

            // Handle delay
            if (step.delay) {
                if (step.delay === 'dynamic') {
                    step.delay = await this.calculateDynamicDelay(step, execution.context);
                }
                
                await this.scheduleDelayedStep(step, execution, step.delay);
                stepExecution.status = 'scheduled';
                stepExecution.scheduledFor = new Date(Date.now() + step.delay * 1000);
                return stepExecution;
            }

            // Execute action
            const action = this.actions.get(step.action);
            if (!action) {
                throw new Error(`Action ${step.action} not found`);
            }

            const actionContext = {
                ...execution.context,
                step,
                execution
            };

            if (step.template) {
                actionContext.template = step.template;
            }

            const result = await action(actionContext);
            
            stepExecution.status = 'completed';
            stepExecution.result = result;
            stepExecution.endTime = new Date();

        } catch (error) {
            stepExecution.status = 'failed';
            stepExecution.error = error.message;
            stepExecution.endTime = new Date();
            
            logger.error(`Step execution failed: ${step.name}`, {
                stepId: step.id,
                error: error.message
            });
        }

        return stepExecution;
    }

    async evaluateConditions(conditions, context) {
        for (const conditionId of conditions) {
            const condition = this.conditions.get(conditionId);
            if (!condition) {
                logger.warn(`Condition ${conditionId} not found`);
                continue;
            }

            const result = await condition(context);
            if (!result) {
                return false;
            }
        }
        
        return true;
    }

    async scheduleDelayedStep(step, execution, delay) {
        const jobId = `${execution.id}-${step.id}`;
        const runAt = new Date(Date.now() + delay * 1000);
        
        await pool.query(`
            INSERT INTO workflow_scheduled_jobs (
                id, workflow_id, execution_id, step_id, run_at, context
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [jobId, execution.workflowId, execution.id, step.id, runAt, JSON.stringify(execution.context)]);
        
        // Schedule with node-cron or external scheduler
        const job = cron.schedule(runAt, async () => {
            await this.executeStep(step, execution);
            await this.removeScheduledJob(jobId);
        });
        
        this.activeJobs.set(jobId, job);
    }

    async startScheduler() {
        // Check for scheduled jobs every minute
        cron.schedule('* * * * *', async () => {
            const jobs = await pool.query(`
                SELECT * FROM workflow_scheduled_jobs 
                WHERE run_at <= NOW() AND status = 'pending'
            `);
            
            for (const job of jobs.rows) {
                await this.runScheduledJob(job);
            }
        });

        // Trigger daily workflows
        cron.schedule('0 9 * * *', async () => {
            await this.triggerDailyWorkflows();
        });

        // Trigger monthly workflows
        cron.schedule('0 0 1 * *', async () => {
            await this.triggerMonthlyWorkflows();
        });
    }

    async triggerDailyWorkflows() {
        // Usage monitoring
        const customers = await this.getAllActiveCustomers();
        for (const customer of customers) {
            await this.executeWorkflow('usage-drop-alert', {
                customerId: customer.id,
                trigger: 'daily_usage_check'
            });
        }
    }

    async triggerMonthlyWorkflows() {
        // Expansion opportunities
        const customers = await this.getAllActiveCustomers();
        for (const customer of customers) {
            await this.executeWorkflow('expansion-opportunity', {
                customerId: customer.id,
                trigger: 'monthly_analysis'
            });
        }

        // Renewal checks
        const renewalCustomers = await this.getCustomersForRenewal(90);
        for (const customer of renewalCustomers) {
            await this.executeWorkflow('renewal-workflow', {
                customerId: customer.id,
                trigger: '90_days_before_renewal'
            });
        }
    }

    // Helper methods
    async getCustomerData(customerId) {
        const result = await pool.query(
            'SELECT * FROM customers WHERE id = $1',
            [customerId]
        );
        return result.rows[0];
    }

    async getHealthScore(customerId) {
        const result = await pool.query(`
            SELECT score, trend, factors, calculated_at
            FROM customer_health_scores
            WHERE customer_id = $1
            ORDER BY calculated_at DESC
            LIMIT 1
        `, [customerId]);
        
        return result.rows[0] || { score: 0, trend: 'stable', factors: {} };
    }

    async logActivity(customerId, type, data) {
        await pool.query(`
            INSERT INTO customer_activities (customer_id, type, data, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [customerId, type, JSON.stringify(data)]);
    }

    compileTemplate(templateName, data) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        
        const subjectCompiled = Handlebars.compile(template.subject);
        const htmlCompiled = Handlebars.compile(template.html);
        
        return {
            subject: subjectCompiled(data),
            html: htmlCompiled(data)
        };
    }

    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async saveExecutionResult(execution) {
        await pool.query(`
            INSERT INTO workflow_executions (
                id, workflow_id, context, status, start_time, end_time, steps, error
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
                status = $4, end_time = $6, steps = $7, error = $8
        `, [
            execution.id,
            execution.workflowId,
            JSON.stringify(execution.context),
            execution.status,
            execution.startTime,
            execution.endTime,
            JSON.stringify(execution.steps),
            execution.error
        ]);
    }

    // Registration methods
    registerWorkflow(workflow) {
        this.workflows.set(workflow.id, workflow);
        logger.info(`Workflow registered: ${workflow.name}`);
    }

    registerAction(name, handler) {
        this.actions.set(name, handler);
    }

    registerCondition(name, evaluator) {
        this.conditions.set(name, evaluator);
    }

    async loadWorkflowTemplates() {
        // Load email templates
        const templates = [
            {
                name: 'welcome_email',
                subject: 'Welcome to ROOTUIP - Let\'s Get Started! 🚀',
                html: `
                    <h1>Welcome {{customer.name}}!</h1>
                    <p>We're excited to have you onboard...</p>
                `
            },
            {
                name: 'day_3_checkin',
                subject: 'How\'s your ROOTUIP experience so far?',
                html: `
                    <h2>Hi {{customer.primaryContactName}},</h2>
                    <p>It's been 3 days since you joined...</p>
                `
            },
            {
                name: 'training_reminder',
                subject: 'Don\'t forget about your ROOTUIP training',
                html: `
                    <h2>Training Resources Available</h2>
                    <p>Complete your training to unlock the full potential...</p>
                `
            }
        ];
        
        templates.forEach(t => this.templates.set(t.name, t));
    }

    async loadActiveWorkflows() {
        const active = await pool.query(`
            SELECT * FROM workflow_scheduled_jobs 
            WHERE status = 'pending'
        `);
        
        // Restore scheduled jobs
        for (const job of active.rows) {
            const runAt = new Date(job.run_at);
            if (runAt > new Date()) {
                // Re-schedule future jobs
                const cronJob = cron.schedule(runAt, async () => {
                    await this.runScheduledJob(job);
                });
                this.activeJobs.set(job.id, cronJob);
            }
        }
    }
}

// Initialize and export
const workflowEngine = new WorkflowEngine();

module.exports = {
    workflowEngine,
    WorkflowEngine
};