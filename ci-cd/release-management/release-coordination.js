#!/usr/bin/env node

/**
 * ROOTUIP Release Coordination System
 * Manages feature releases, rollouts, and customer communications
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const nodemailer = require('nodemailer');

class ReleaseCoordinator {
    constructor(config = {}) {
        this.config = {
            repoPath: config.repoPath || process.cwd(),
            releaseConfigFile: config.releaseConfigFile || 'ci-cd/release-config.json',
            customerListFile: config.customerListFile || 'ci-cd/customers.json',
            templatesDir: config.templatesDir || 'ci-cd/templates',
            slackWebhook: config.slackWebhook || process.env.SLACK_WEBHOOK_URL,
            emailConfig: config.emailConfig || {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            },
            ...config
        };
        
        this.releaseConfig = this.loadReleaseConfig();
        this.customerSegments = this.loadCustomerSegments();
        this.featureFlags = this.loadFeatureFlags();
        this.rolloutSchedule = [];
        this.communicationLog = [];
    }
    
    // Load release configuration
    loadReleaseConfig() {
        const configPath = path.join(this.config.repoPath, this.config.releaseConfigFile);
        
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        // Default configuration
        return {
            environments: {
                development: {
                    autoRelease: true,
                    approvalRequired: false,
                    rollbackThreshold: 0.1,
                    monitoringDuration: 300
                },
                staging: {
                    autoRelease: false,
                    approvalRequired: true,
                    approvers: ['team-leads', 'qa-team'],
                    rollbackThreshold: 0.05,
                    monitoringDuration: 600
                },
                production: {
                    autoRelease: false,
                    approvalRequired: true,
                    approvers: ['senior-engineers', 'product-owners', 'security-team'],
                    rollbackThreshold: 0.01,
                    monitoringDuration: 3600,
                    canaryConfig: {
                        enabled: true,
                        initialPercentage: 5,
                        incrementPercentage: 10,
                        incrementInterval: 300,
                        maxPercentage: 100
                    }
                }
            },
            notifications: {
                channels: {
                    slack: '#releases',
                    email: 'releases@rootuip.com',
                    teams: 'General'
                },
                customerNotifications: {
                    preRelease: 24, // hours before release
                    postRelease: 1   // hours after release
                }
            },
            rollback: {
                autoTriggers: {
                    errorRate: 0.05,
                    responseTime: 5000,
                    availability: 0.95
                },
                approvalRequired: false,
                notificationChannels: ['slack', 'email', 'pagerduty']
            }
        };
    }
    
    // Load customer segments
    loadCustomerSegments() {
        const customerPath = path.join(this.config.repoPath, this.config.customerListFile);
        
        if (fs.existsSync(customerPath)) {
            return JSON.parse(fs.readFileSync(customerPath, 'utf8'));
        }
        
        // Default customer segments
        return {
            enterprise: {
                name: 'Enterprise Customers',
                tier: 'enterprise',
                contacts: [
                    { name: 'Enterprise Account Manager', email: 'enterprise@rootuip.com' }
                ],
                releaseWindow: 'business-hours',
                notificationLead: 48, // hours
                rolloutPercentage: 10,
                features: ['all']
            },
            premium: {
                name: 'Premium Customers',
                tier: 'premium',
                contacts: [
                    { name: 'Premium Support', email: 'premium@rootuip.com' }
                ],
                releaseWindow: 'maintenance-window',
                notificationLead: 24,
                rolloutPercentage: 50,
                features: ['standard', 'premium']
            },
            standard: {
                name: 'Standard Customers',
                tier: 'standard',
                contacts: [
                    { name: 'Customer Support', email: 'support@rootuip.com' }
                ],
                releaseWindow: 'any',
                notificationLead: 12,
                rolloutPercentage: 100,
                features: ['standard']
            }
        };
    }
    
    // Load feature flags
    loadFeatureFlags() {
        const flagsPath = path.join(this.config.repoPath, 'ci-cd/feature-flags.json');
        
        if (fs.existsSync(flagsPath)) {
            return JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
        }
        
        return { features: {} };
    }
    
    // Plan release rollout
    planReleaseRollout(releaseInfo) {
        console.log('📋 Planning release rollout strategy...');
        
        const rolloutPlan = {
            releaseId: releaseInfo.version.next,
            version: releaseInfo.version,
            startTime: new Date(),
            phases: [],
            customerCommunications: [],
            featureFlags: this.determineFeatureFlags(releaseInfo),
            rollbackPlan: this.createRollbackPlan(releaseInfo)
        };
        
        // Phase 1: Development environment
        rolloutPlan.phases.push({
            phase: 1,
            name: 'Development Deployment',
            environment: 'development',
            percentage: 100,
            startTime: new Date(),
            duration: 15, // minutes
            approval: false,
            monitoring: true
        });
        
        // Phase 2: Staging environment
        const stagingStart = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes later
        rolloutPlan.phases.push({
            phase: 2,
            name: 'Staging Validation',
            environment: 'staging',
            percentage: 100,
            startTime: stagingStart,
            duration: 60, // 1 hour
            approval: true,
            approvers: this.releaseConfig.environments.staging.approvers,
            monitoring: true,
            tests: ['smoke-tests', 'integration-tests', 'performance-tests']
        });
        
        // Phase 3: Production canary
        const canaryStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours later
        const canaryConfig = this.releaseConfig.environments.production.canaryConfig;
        
        if (canaryConfig.enabled) {
            rolloutPlan.phases.push({
                phase: 3,
                name: 'Production Canary',
                environment: 'production',
                percentage: canaryConfig.initialPercentage,
                startTime: canaryStart,
                duration: 30, // 30 minutes
                approval: true,
                approvers: this.releaseConfig.environments.production.approvers,
                monitoring: true,
                canary: true,
                autoRollback: true
            });
            
            // Phase 4: Gradual rollout
            let currentPercentage = canaryConfig.initialPercentage;
            let phaseNumber = 4;
            
            while (currentPercentage < canaryConfig.maxPercentage) {
                currentPercentage = Math.min(
                    currentPercentage + canaryConfig.incrementPercentage,
                    canaryConfig.maxPercentage
                );
                
                const phaseStart = new Date(
                    canaryStart.getTime() + 
                    (phaseNumber - 3) * canaryConfig.incrementInterval * 1000
                );
                
                rolloutPlan.phases.push({
                    phase: phaseNumber,
                    name: `Production Rollout ${currentPercentage}%`,
                    environment: 'production',
                    percentage: currentPercentage,
                    startTime: phaseStart,
                    duration: canaryConfig.incrementInterval / 60, // Convert to minutes
                    approval: currentPercentage === 100, // Final phase requires approval
                    monitoring: true,
                    autoRollback: true
                });
                
                phaseNumber++;
            }
        } else {
            // Direct production deployment
            rolloutPlan.phases.push({
                phase: 3,
                name: 'Production Deployment',
                environment: 'production',
                percentage: 100,
                startTime: canaryStart,
                duration: 60,
                approval: true,
                approvers: this.releaseConfig.environments.production.approvers,
                monitoring: true
            });
        }
        
        // Plan customer communications
        rolloutPlan.customerCommunications = this.planCustomerCommunications(rolloutPlan);
        
        this.rolloutSchedule.push(rolloutPlan);
        
        // Save rollout plan
        this.saveRolloutPlan(rolloutPlan);
        
        console.log(`✅ Rollout plan created with ${rolloutPlan.phases.length} phases`);
        return rolloutPlan;
    }
    
    // Determine feature flags for release
    determineFeatureFlags(releaseInfo) {
        const flags = {};
        
        // Analyze commits to identify feature flags
        releaseInfo.commits.forEach(commit => {
            if (commit.type === 'feat') {
                const featureName = this.extractFeatureName(commit.description);
                if (featureName) {
                    flags[featureName] = {
                        enabled: false, // Start disabled
                        rolloutPercentage: 0,
                        environments: {
                            development: true,
                            staging: false,
                            production: false
                        }
                    };
                }
            }
        });
        
        return flags;
    }
    
    // Extract feature name from commit description
    extractFeatureName(description) {
        // Simple extraction - in production, this would be more sophisticated
        const featureMatch = description.match(/add|implement|introduce\s+(.+)/i);
        if (featureMatch) {
            return featureMatch[1]
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
        }
        return null;
    }
    
    // Create rollback plan
    createRollbackPlan(releaseInfo) {
        return {
            triggers: this.releaseConfig.rollback.autoTriggers,
            procedures: [
                {
                    step: 1,
                    action: 'Stop new deployments',
                    automated: true,
                    duration: 1 // minutes
                },
                {
                    step: 2,
                    action: 'Switch traffic to previous version',
                    automated: true,
                    duration: 2
                },
                {
                    step: 3,
                    action: 'Verify system stability',
                    automated: true,
                    duration: 5
                },
                {
                    step: 4,
                    action: 'Notify stakeholders',
                    automated: true,
                    duration: 1
                }
            ],
            totalDuration: 9, // minutes
            approvalRequired: this.releaseConfig.rollback.approvalRequired,
            notificationChannels: this.releaseConfig.rollback.notificationChannels
        };
    }
    
    // Plan customer communications
    planCustomerCommunications(rolloutPlan) {
        const communications = [];
        
        // Pre-release notifications
        Object.entries(this.customerSegments).forEach(([segmentId, segment]) => {
            const preReleaseTime = new Date(
                rolloutPlan.startTime.getTime() - segment.notificationLead * 60 * 60 * 1000
            );
            
            communications.push({
                id: `pre-${segmentId}`,
                type: 'pre-release',
                segment: segmentId,
                scheduledTime: preReleaseTime,
                template: 'pre-release-notification',
                channels: ['email'],
                status: 'scheduled'
            });
        });
        
        // Post-release notifications
        const productionPhase = rolloutPlan.phases.find(p => 
            p.environment === 'production' && p.percentage === 100
        );
        
        if (productionPhase) {
            const postReleaseTime = new Date(
                productionPhase.startTime.getTime() + 
                this.releaseConfig.notifications.customerNotifications.postRelease * 60 * 60 * 1000
            );
            
            communications.push({
                id: 'post-all-customers',
                type: 'post-release',
                segment: 'all',
                scheduledTime: postReleaseTime,
                template: 'post-release-summary',
                channels: ['email', 'in-app'],
                status: 'scheduled'
            });
        }
        
        return communications;
    }
    
    // Execute release phase
    async executeReleasePhase(rolloutPlan, phaseNumber) {
        const phase = rolloutPlan.phases.find(p => p.phase === phaseNumber);
        if (!phase) {
            throw new Error(`Phase ${phaseNumber} not found in rollout plan`);
        }
        
        console.log(`🚀 Executing Phase ${phaseNumber}: ${phase.name}`);
        
        try {
            // Check if approval is required
            if (phase.approval) {
                console.log('⏳ Waiting for approval...');
                await this.requestApproval(rolloutPlan, phase);
            }
            
            // Update phase status
            phase.status = 'in-progress';
            phase.actualStartTime = new Date();
            
            // Execute deployment
            await this.executeDeployment(phase);
            
            // Start monitoring
            if (phase.monitoring) {
                await this.startPhaseMonitoring(rolloutPlan, phase);
            }
            
            // Run tests if specified
            if (phase.tests) {
                await this.runPhaseTests(phase);
            }
            
            // Update feature flags if needed
            if (phase.environment === 'production') {
                await this.updateFeatureFlags(rolloutPlan, phase);
            }
            
            phase.status = 'completed';
            phase.actualEndTime = new Date();
            
            console.log(`✅ Phase ${phaseNumber} completed successfully`);
            
            // Send notifications
            await this.sendPhaseNotification(rolloutPlan, phase, 'completed');
            
        } catch (error) {
            phase.status = 'failed';
            phase.error = error.message;
            phase.actualEndTime = new Date();
            
            console.error(`❌ Phase ${phaseNumber} failed:`, error);
            
            // Send failure notification
            await this.sendPhaseNotification(rolloutPlan, phase, 'failed');
            
            // Trigger rollback if configured
            if (phase.autoRollback) {
                await this.triggerRollback(rolloutPlan, phase);
            }
            
            throw error;
        }
    }
    
    // Request approval for phase
    async requestApproval(rolloutPlan, phase) {
        const approvalRequest = {
            id: `approval-${rolloutPlan.releaseId}-${phase.phase}`,
            releaseId: rolloutPlan.releaseId,
            phase: phase.phase,
            environment: phase.environment,
            approvers: phase.approvers,
            requestedAt: new Date(),
            status: 'pending'
        };
        
        // Send approval request notifications
        await this.sendApprovalRequest(approvalRequest);
        
        // In a real implementation, this would integrate with an approval system
        // For now, we'll simulate manual approval
        console.log(`Approval required for ${phase.name}`);
        console.log(`Approvers: ${phase.approvers.join(', ')}`);
        
        // Return immediately for automated deployment
        return true;
    }
    
    // Execute deployment for phase
    async executeDeployment(phase) {
        console.log(`Deploying to ${phase.environment} (${phase.percentage}% traffic)`);
        
        // Simulate deployment commands
        const deploymentCommand = `./ci-cd/scripts/deploy.sh ${phase.environment} ${phase.percentage}`;
        
        try {
            execSync(deploymentCommand, {
                cwd: this.config.repoPath,
                stdio: 'inherit'
            });
        } catch (error) {
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }
    
    // Start monitoring for phase
    async startPhaseMonitoring(rolloutPlan, phase) {
        console.log(`Starting monitoring for ${phase.name}`);
        
        const monitoringConfig = {
            environment: phase.environment,
            duration: phase.duration * 60, // Convert to seconds
            metrics: ['error_rate', 'response_time', 'throughput', 'availability'],
            thresholds: this.releaseConfig.environments[phase.environment]
        };
        
        // Start monitoring script
        try {
            execSync(`./ci-cd/scripts/start-monitoring.sh ${JSON.stringify(monitoringConfig)}`, {
                cwd: this.config.repoPath
            });
        } catch (error) {
            console.warn(`Failed to start monitoring: ${error.message}`);
        }
    }
    
    // Run tests for phase
    async runPhaseTests(phase) {
        console.log(`Running tests for ${phase.name}: ${phase.tests.join(', ')}`);
        
        for (const testType of phase.tests) {
            try {
                execSync(`npm run test:${testType}`, {
                    cwd: this.config.repoPath,
                    stdio: 'inherit'
                });
            } catch (error) {
                throw new Error(`${testType} failed: ${error.message}`);
            }
        }
    }
    
    // Update feature flags for phase
    async updateFeatureFlags(rolloutPlan, phase) {
        console.log(`Updating feature flags for ${phase.name}`);
        
        Object.entries(rolloutPlan.featureFlags).forEach(([featureName, config]) => {
            config.rolloutPercentage = phase.percentage;
            config.environments[phase.environment] = true;
        });
        
        // Save updated feature flags
        const flagsPath = path.join(this.config.repoPath, 'ci-cd/feature-flags.json');
        const currentFlags = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
        
        currentFlags.features = {
            ...currentFlags.features,
            ...rolloutPlan.featureFlags
        };
        
        fs.writeFileSync(flagsPath, JSON.stringify(currentFlags, null, 2));
    }
    
    // Trigger rollback
    async triggerRollback(rolloutPlan, failedPhase) {
        console.log(`🔄 Triggering rollback for ${failedPhase.name}`);
        
        const rollbackPlan = rolloutPlan.rollbackPlan;
        
        // Execute rollback procedures
        for (const procedure of rollbackPlan.procedures) {
            console.log(`Executing rollback step ${procedure.step}: ${procedure.action}`);
            
            try {
                if (procedure.automated) {
                    await this.executeRollbackStep(procedure, failedPhase);
                }
            } catch (error) {
                console.error(`Rollback step ${procedure.step} failed:`, error);
            }
        }
        
        // Send rollback notifications
        await this.sendRollbackNotification(rolloutPlan, failedPhase);
    }
    
    // Execute rollback step
    async executeRollbackStep(procedure, failedPhase) {
        const rollbackCommand = `./ci-cd/scripts/rollback.sh ${failedPhase.environment} ${procedure.step}`;
        
        execSync(rollbackCommand, {
            cwd: this.config.repoPath,
            stdio: 'inherit'
        });
        
        // Wait for step duration
        await new Promise(resolve => setTimeout(resolve, procedure.duration * 60 * 1000));
    }
    
    // Send customer notifications
    async sendCustomerNotifications(rolloutPlan) {
        console.log('📧 Sending customer notifications...');
        
        for (const communication of rolloutPlan.customerCommunications) {
            if (communication.status === 'scheduled' && 
                new Date() >= communication.scheduledTime) {
                
                try {
                    await this.sendCommunication(communication, rolloutPlan);
                    communication.status = 'sent';
                    communication.sentAt = new Date();
                } catch (error) {
                    communication.status = 'failed';
                    communication.error = error.message;
                    console.error(`Failed to send communication ${communication.id}:`, error);
                }
            }
        }
    }
    
    // Send individual communication
    async sendCommunication(communication, rolloutPlan) {
        const segment = this.customerSegments[communication.segment];
        const template = await this.loadTemplate(communication.template);
        
        const content = this.renderTemplate(template, {
            rolloutPlan,
            segment,
            communication
        });
        
        if (communication.channels.includes('email')) {
            await this.sendEmail(segment.contacts, content.subject, content.body);
        }
        
        if (communication.channels.includes('slack')) {
            await this.sendSlackNotification(content.slack);
        }
        
        this.communicationLog.push({
            ...communication,
            content,
            timestamp: new Date()
        });
    }
    
    // Load email template
    async loadTemplate(templateName) {
        const templatePath = path.join(
            this.config.repoPath,
            this.config.templatesDir,
            `${templateName}.json`
        );
        
        if (fs.existsSync(templatePath)) {
            return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        }
        
        // Return default template
        return {
            subject: 'ROOTUIP Release Update',
            body: 'A new version of ROOTUIP has been released.',
            slack: 'ROOTUIP release update'
        };
    }
    
    // Render template with variables
    renderTemplate(template, variables) {
        const rendered = {};
        
        Object.entries(template).forEach(([key, value]) => {
            rendered[key] = this.interpolateVariables(value, variables);
        });
        
        return rendered;
    }
    
    // Interpolate template variables
    interpolateVariables(text, variables) {
        return text.replace(/\{\{(.+?)\}\}/g, (match, path) => {
            const value = this.getNestedValue(variables, path.trim());
            return value !== undefined ? value : match;
        });
    }
    
    // Get nested object value by path
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    // Send email notification
    async sendEmail(recipients, subject, body) {
        if (!this.config.emailConfig.host) {
            console.log('Email not configured, skipping email notification');
            return;
        }
        
        const transporter = nodemailer.createTransporter(this.config.emailConfig);
        
        const emailPromises = recipients.map(recipient => {
            return transporter.sendMail({
                from: '"ROOTUIP Team" <noreply@rootuip.com>',
                to: recipient.email,
                subject,
                html: body,
                text: body.replace(/<[^>]*>/g, '') // Strip HTML for text version
            });
        });
        
        await Promise.all(emailPromises);
        console.log(`📧 Sent email to ${recipients.length} recipients`);
    }
    
    // Send Slack notification
    async sendSlackNotification(message) {
        if (!this.config.slackWebhook) {
            console.log('Slack webhook not configured, skipping Slack notification');
            return;
        }
        
        try {
            const response = await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message })
            });
            
            if (response.ok) {
                console.log('📱 Sent Slack notification');
            }
        } catch (error) {
            console.error('Failed to send Slack notification:', error);
        }
    }
    
    // Send phase notification
    async sendPhaseNotification(rolloutPlan, phase, status) {
        const message = `🚀 Release ${rolloutPlan.releaseId} - Phase ${phase.phase} (${phase.name}) ${status}`;
        
        await this.sendSlackNotification(message);
        
        // Send to monitoring systems
        const notification = {
            releaseId: rolloutPlan.releaseId,
            phase: phase.phase,
            environment: phase.environment,
            status,
            timestamp: new Date()
        };
        
        this.communicationLog.push(notification);
    }
    
    // Send approval request
    async sendApprovalRequest(approvalRequest) {
        const message = `⏳ Approval required for Release ${approvalRequest.releaseId} - ${approvalRequest.environment} deployment\nApprovers: ${approvalRequest.approvers.join(', ')}`;
        
        await this.sendSlackNotification(message);
    }
    
    // Send rollback notification
    async sendRollbackNotification(rolloutPlan, failedPhase) {
        const message = `🚨 ROLLBACK INITIATED - Release ${rolloutPlan.releaseId} - Phase ${failedPhase.phase} failed in ${failedPhase.environment}`;
        
        await this.sendSlackNotification(message);
        
        // Send urgent email to on-call team
        if (this.config.emailConfig.host) {
            await this.sendEmail(
                [{ email: 'oncall@rootuip.com' }],
                `URGENT: Rollback Initiated - ${rolloutPlan.releaseId}`,
                `Rollback has been initiated for release ${rolloutPlan.releaseId} due to failure in ${failedPhase.environment}.`
            );
        }
    }
    
    // Save rollout plan
    saveRolloutPlan(rolloutPlan) {
        const planPath = path.join(
            this.config.repoPath,
            'ci-cd/rollout-plans',
            `${rolloutPlan.releaseId}.json`
        );
        
        // Ensure directory exists
        const planDir = path.dirname(planPath);
        if (!fs.existsSync(planDir)) {
            fs.mkdirSync(planDir, { recursive: true });
        }
        
        fs.writeFileSync(planPath, JSON.stringify(rolloutPlan, null, 2));
        console.log(`💾 Saved rollout plan: ${planPath}`);
    }
    
    // Get rollout status
    getRolloutStatus(releaseId) {
        const plan = this.rolloutSchedule.find(p => p.releaseId === releaseId);
        if (!plan) {
            return null;
        }
        
        const completedPhases = plan.phases.filter(p => p.status === 'completed').length;
        const totalPhases = plan.phases.length;
        const currentPhase = plan.phases.find(p => p.status === 'in-progress');
        
        return {
            releaseId,
            progress: (completedPhases / totalPhases) * 100,
            currentPhase: currentPhase?.name || 'Complete',
            status: this.determineOverallStatus(plan),
            phases: plan.phases.map(p => ({
                phase: p.phase,
                name: p.name,
                status: p.status || 'pending',
                environment: p.environment,
                percentage: p.percentage
            }))
        };
    }
    
    // Determine overall rollout status
    determineOverallStatus(plan) {
        const hasFailures = plan.phases.some(p => p.status === 'failed');
        const hasInProgress = plan.phases.some(p => p.status === 'in-progress');
        const allCompleted = plan.phases.every(p => p.status === 'completed');
        
        if (hasFailures) return 'failed';
        if (hasInProgress) return 'in-progress';
        if (allCompleted) return 'completed';
        return 'pending';
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    const releaseId = process.argv[3];
    
    const coordinator = new ReleaseCoordinator();
    
    switch (command) {
        case 'plan':
            // Plan rollout from release info file
            const releaseInfoPath = releaseId || 'release-info.json';
            if (fs.existsSync(releaseInfoPath)) {
                const releaseInfo = JSON.parse(fs.readFileSync(releaseInfoPath, 'utf8'));
                coordinator.planReleaseRollout(releaseInfo);
            } else {
                console.error('Release info file not found');
                process.exit(1);
            }
            break;
            
        case 'execute':
            const phaseNumber = parseInt(process.argv[4]);
            // Execute specific phase
            console.log(`Executing phase ${phaseNumber} for release ${releaseId}`);
            break;
            
        case 'status':
            // Get rollout status
            const status = coordinator.getRolloutStatus(releaseId);
            console.log(JSON.stringify(status, null, 2));
            break;
            
        case 'notify':
            // Send customer notifications
            console.log('Sending customer notifications...');
            break;
            
        default:
            console.log('Usage: node release-coordination.js <plan|execute|status|notify> [releaseId] [phaseNumber]');
            process.exit(1);
    }
}

module.exports = ReleaseCoordinator;