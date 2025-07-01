#!/usr/bin/env node

/**
 * ROOTUIP Enterprise Approval Workflow System
 * Manages multi-level approval processes for deployments and releases
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const nodemailer = require('nodemailer');

class EnterpriseApprovalSystem {
    constructor(config = {}) {
        this.config = {
            repoPath: config.repoPath || process.cwd(),
            approvalConfigFile: config.approvalConfigFile || 'ci-cd/approval-config.json',
            approversFile: config.approversFile || 'ci-cd/approvers.json',
            templatesDir: config.templatesDir || 'ci-cd/templates/approvals',
            slackWebhook: config.slackWebhook || process.env.SLACK_WEBHOOK_URL,
            teamsWebhook: config.teamsWebhook || process.env.TEAMS_WEBHOOK_URL,
            jiraConfig: config.jiraConfig || {
                host: process.env.JIRA_HOST,
                email: process.env.JIRA_EMAIL,
                token: process.env.JIRA_TOKEN,
                project: process.env.JIRA_PROJECT || 'ROOTUIP'
            },
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
        
        this.approvalConfig = this.loadApprovalConfig();
        this.approvers = this.loadApprovers();
        this.activeApprovals = new Map();
        this.approvalHistory = [];
        
        // Approval states
        this.APPROVAL_STATES = {
            PENDING: 'pending',
            APPROVED: 'approved',
            REJECTED: 'rejected',
            EXPIRED: 'expired',
            CANCELLED: 'cancelled'
        };
        
        // Approval types
        this.APPROVAL_TYPES = {
            DEPLOYMENT: 'deployment',
            RELEASE: 'release',
            HOTFIX: 'hotfix',
            ROLLBACK: 'rollback',
            CONFIG_CHANGE: 'config_change',
            SECURITY_PATCH: 'security_patch'
        };
    }
    
    // Load approval configuration
    loadApprovalConfig() {
        const configPath = path.join(this.config.repoPath, this.config.approvalConfigFile);
        
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        // Default approval configuration
        return {
            environments: {
                development: {
                    requireApproval: false,
                    autoApprove: true,
                    approvalTimeout: 3600 // 1 hour
                },
                staging: {
                    requireApproval: true,
                    autoApprove: false,
                    approvalTimeout: 86400, // 24 hours
                    requiredApprovals: 2,
                    approverGroups: ['team-leads', 'qa-team'],
                    conditions: {
                        businessHours: false,
                        skipWeekends: false
                    }
                },
                production: {
                    requireApproval: true,
                    autoApprove: false,
                    approvalTimeout: 172800, // 48 hours
                    requiredApprovals: 3,
                    approverGroups: ['senior-engineers', 'product-owners', 'security-team'],
                    conditions: {
                        businessHours: true,
                        skipWeekends: true,
                        requireAllGroups: true,
                        emergencyBypass: {
                            enabled: true,
                            approvers: ['cto', 'engineering-director'],
                            requiredApprovals: 2
                        }
                    }
                }
            },
            approvalTypes: {
                deployment: {
                    name: 'Deployment Approval',
                    description: 'Standard deployment to environment',
                    template: 'deployment-approval'
                },
                release: {
                    name: 'Release Approval',
                    description: 'New version release',
                    template: 'release-approval',
                    additionalChecks: ['changelog-review', 'breaking-changes', 'customer-impact']
                },
                hotfix: {
                    name: 'Hotfix Approval',
                    description: 'Emergency hotfix deployment',
                    template: 'hotfix-approval',
                    expedited: true,
                    approvalTimeout: 3600 // 1 hour
                },
                rollback: {
                    name: 'Rollback Approval',
                    description: 'Rollback to previous version',
                    template: 'rollback-approval',
                    expedited: true,
                    requiredApprovals: 1
                },
                security_patch: {
                    name: 'Security Patch Approval',
                    description: 'Security-related deployment',
                    template: 'security-approval',
                    additionalApprovers: ['security-team'],
                    requiredApprovals: 2
                }
            },
            integrations: {
                github: {
                    enabled: true,
                    createIssue: true,
                    assignReviewers: true
                },
                jira: {
                    enabled: true,
                    createTicket: true,
                    project: 'DEPLOY'
                },
                slack: {
                    enabled: true,
                    channels: ['#deployments', '#engineering']
                },
                email: {
                    enabled: true,
                    includeDetails: true
                }
            }
        };
    }
    
    // Load approvers configuration
    loadApprovers() {
        const approversPath = path.join(this.config.repoPath, this.config.approversFile);
        
        if (fs.existsSync(approversPath)) {
            return JSON.parse(fs.readFileSync(approversPath, 'utf8'));
        }
        
        // Default approvers
        return {
            groups: {
                'team-leads': {
                    name: 'Team Leads',
                    members: [
                        { id: 'alice.johnson', name: 'Alice Johnson', email: 'alice@rootuip.com', slack: '@alice' },
                        { id: 'bob.smith', name: 'Bob Smith', email: 'bob@rootuip.com', slack: '@bob' }
                    ],
                    minimumApprovals: 1
                },
                'senior-engineers': {
                    name: 'Senior Engineers',
                    members: [
                        { id: 'carol.davis', name: 'Carol Davis', email: 'carol@rootuip.com', slack: '@carol' },
                        { id: 'david.wilson', name: 'David Wilson', email: 'david@rootuip.com', slack: '@david' }
                    ],
                    minimumApprovals: 1
                },
                'product-owners': {
                    name: 'Product Owners',
                    members: [
                        { id: 'eve.martin', name: 'Eve Martin', email: 'eve@rootuip.com', slack: '@eve' },
                        { id: 'frank.garcia', name: 'Frank Garcia', email: 'frank@rootuip.com', slack: '@frank' }
                    ],
                    minimumApprovals: 1
                },
                'security-team': {
                    name: 'Security Team',
                    members: [
                        { id: 'grace.lee', name: 'Grace Lee', email: 'grace@rootuip.com', slack: '@grace' },
                        { id: 'henry.wong', name: 'Henry Wong', email: 'henry@rootuip.com', slack: '@henry' }
                    ],
                    minimumApprovals: 1
                },
                'qa-team': {
                    name: 'QA Team',
                    members: [
                        { id: 'iris.chen', name: 'Iris Chen', email: 'iris@rootuip.com', slack: '@iris' },
                        { id: 'jack.taylor', name: 'Jack Taylor', email: 'jack@rootuip.com', slack: '@jack' }
                    ],
                    minimumApprovals: 1
                },
                'cto': {
                    name: 'CTO',
                    members: [
                        { id: 'cto', name: 'Chief Technology Officer', email: 'cto@rootuip.com', slack: '@cto' }
                    ],
                    minimumApprovals: 1
                },
                'engineering-director': {
                    name: 'Engineering Director',
                    members: [
                        { id: 'eng-director', name: 'Engineering Director', email: 'eng-director@rootuip.com', slack: '@eng-director' }
                    ],
                    minimumApprovals: 1
                }
            },
            escalation: {
                enabled: true,
                levels: [
                    { after: 3600, notify: ['team-leads'] },      // 1 hour
                    { after: 14400, notify: ['senior-engineers'] }, // 4 hours
                    { after: 86400, notify: ['cto'] }              // 24 hours
                ]
            }
        };
    }
    
    // Create approval request
    async createApprovalRequest(approvalData) {
        const {
            type,
            environment,
            title,
            description,
            requester,
            metadata = {},
            emergency = false
        } = approvalData;
        
        console.log(`🔄 Creating approval request: ${title}`);
        
        // Generate unique approval ID
        const approvalId = this.generateApprovalId(type, environment);
        
        // Get approval configuration for environment and type
        const envConfig = this.approvalConfig.environments[environment];
        const typeConfig = this.approvalConfig.approvalTypes[type];
        
        if (!envConfig.requireApproval && !emergency) {
            console.log('✅ Auto-approved (no approval required)');
            return {
                approvalId,
                status: this.APPROVAL_STATES.APPROVED,
                autoApproved: true,
                approvedAt: new Date()
            };
        }
        
        // Determine required approvers
        const requiredApprovers = this.determineRequiredApprovers(envConfig, typeConfig, emergency);
        
        // Create approval request object
        const approvalRequest = {
            id: approvalId,
            type,
            environment,
            title,
            description,
            requester,
            metadata,
            emergency,
            status: this.APPROVAL_STATES.PENDING,
            requiredApprovers,
            approvals: [],
            rejections: [],
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + (typeConfig?.approvalTimeout || envConfig.approvalTimeout) * 1000),
            lastUpdated: new Date()
        };
        
        // Store approval request
        this.activeApprovals.set(approvalId, approvalRequest);
        
        // Send notifications
        await this.sendApprovalNotifications(approvalRequest);
        
        // Create GitHub issue if enabled
        if (this.approvalConfig.integrations.github.enabled) {
            await this.createGitHubIssue(approvalRequest);
        }
        
        // Create Jira ticket if enabled
        if (this.approvalConfig.integrations.jira.enabled) {
            await this.createJiraTicket(approvalRequest);
        }
        
        // Start approval monitoring
        this.startApprovalMonitoring(approvalId);
        
        console.log(`📋 Approval request created: ${approvalId}`);
        return approvalRequest;
    }
    
    // Determine required approvers
    determineRequiredApprovers(envConfig, typeConfig, emergency) {
        let approverGroups = [...(envConfig.approverGroups || [])];
        
        // Add type-specific approvers
        if (typeConfig?.additionalApprovers) {
            approverGroups = [...approverGroups, ...typeConfig.additionalApprovers];
        }
        
        // Handle emergency bypass
        if (emergency && envConfig.conditions?.emergencyBypass?.enabled) {
            approverGroups = envConfig.conditions.emergencyBypass.approvers;
        }
        
        const requiredApprovers = {
            groups: approverGroups,
            totalRequired: typeConfig?.requiredApprovals || envConfig.requiredApprovals || 1,
            requireAllGroups: envConfig.conditions?.requireAllGroups || false,
            emergency
        };
        
        return requiredApprovers;
    }
    
    // Generate approval ID
    generateApprovalId(type, environment) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${type}-${environment}-${timestamp}-${random}`;
    }
    
    // Submit approval
    async submitApproval(approvalId, approverId, decision, comments = '') {
        const approvalRequest = this.activeApprovals.get(approvalId);
        
        if (!approvalRequest) {
            throw new Error(`Approval request not found: ${approvalId}`);
        }
        
        if (approvalRequest.status !== this.APPROVAL_STATES.PENDING) {
            throw new Error(`Approval request is not pending: ${approvalRequest.status}`);
        }
        
        // Check if approver is authorized
        const approver = this.findApprover(approverId);
        if (!approver) {
            throw new Error(`Approver not found: ${approverId}`);
        }
        
        if (!this.isApproverAuthorized(approver, approvalRequest)) {
            throw new Error(`Approver not authorized for this request: ${approverId}`);
        }
        
        // Check if approver already submitted decision
        const existingDecision = [...approvalRequest.approvals, ...approvalRequest.rejections]
            .find(d => d.approverId === approverId);
        
        if (existingDecision) {
            throw new Error(`Approver already submitted decision: ${approverId}`);
        }
        
        const decisionData = {
            approverId,
            approverName: approver.name,
            decision,
            comments,
            timestamp: new Date(),
            ipAddress: this.getClientIP(),
            userAgent: process.env.USER_AGENT || 'approval-system'
        };
        
        // Record decision
        if (decision === 'approve') {
            approvalRequest.approvals.push(decisionData);
            console.log(`✅ Approval received from ${approver.name}`);
        } else if (decision === 'reject') {
            approvalRequest.rejections.push(decisionData);
            console.log(`❌ Rejection received from ${approver.name}`);
        }
        
        approvalRequest.lastUpdated = new Date();
        
        // Check if approval is complete
        const finalStatus = this.evaluateApprovalStatus(approvalRequest);
        approvalRequest.status = finalStatus;
        
        if (finalStatus === this.APPROVAL_STATES.APPROVED) {
            approvalRequest.approvedAt = new Date();
            console.log(`🎉 Approval request approved: ${approvalId}`);
        } else if (finalStatus === this.APPROVAL_STATES.REJECTED) {
            approvalRequest.rejectedAt = new Date();
            console.log(`🚫 Approval request rejected: ${approvalId}`);
        }
        
        // Send status update notifications
        await this.sendStatusUpdateNotifications(approvalRequest, decisionData);
        
        // Update external systems
        await this.updateExternalSystems(approvalRequest);
        
        // Save approval history if completed
        if (finalStatus !== this.APPROVAL_STATES.PENDING) {
            this.approvalHistory.push({ ...approvalRequest });
            this.activeApprovals.delete(approvalId);
        }
        
        return approvalRequest;
    }
    
    // Find approver by ID
    findApprover(approverId) {
        for (const [groupId, group] of Object.entries(this.approvers.groups)) {
            const member = group.members.find(m => m.id === approverId);
            if (member) {
                return { ...member, groupId };
            }
        }
        return null;
    }
    
    // Check if approver is authorized
    isApproverAuthorized(approver, approvalRequest) {
        const requiredGroups = approvalRequest.requiredApprovers.groups;
        return requiredGroups.includes(approver.groupId);
    }
    
    // Evaluate approval status
    evaluateApprovalStatus(approvalRequest) {
        const { requiredApprovers, approvals, rejections } = approvalRequest;
        
        // Check for rejections first
        if (rejections.length > 0) {
            return this.APPROVAL_STATES.REJECTED;
        }
        
        // Check if expired
        if (new Date() > approvalRequest.expiresAt) {
            return this.APPROVAL_STATES.EXPIRED;
        }
        
        // Check approval requirements
        if (requiredApprovers.requireAllGroups) {
            // All groups must have at least one approval
            const approvedGroups = new Set();
            
            approvals.forEach(approval => {
                const approver = this.findApprover(approval.approverId);
                if (approver) {
                    approvedGroups.add(approver.groupId);
                }
            });
            
            const allGroupsApproved = requiredApprovers.groups.every(group => 
                approvedGroups.has(group)
            );
            
            if (allGroupsApproved) {
                return this.APPROVAL_STATES.APPROVED;
            }
        } else {
            // Check total number of approvals
            if (approvals.length >= requiredApprovers.totalRequired) {
                return this.APPROVAL_STATES.APPROVED;
            }
        }
        
        return this.APPROVAL_STATES.PENDING;
    }
    
    // Send approval notifications
    async sendApprovalNotifications(approvalRequest) {
        console.log(`📧 Sending approval notifications for ${approvalRequest.id}`);
        
        // Get all potential approvers
        const approvers = this.getApproversForRequest(approvalRequest);
        
        // Send email notifications
        if (this.approvalConfig.integrations.email.enabled) {
            await this.sendEmailNotifications(approvalRequest, approvers);
        }
        
        // Send Slack notifications
        if (this.approvalConfig.integrations.slack.enabled) {
            await this.sendSlackNotifications(approvalRequest, approvers);
        }
        
        // Send Teams notifications
        if (this.config.teamsWebhook) {
            await this.sendTeamsNotifications(approvalRequest, approvers);
        }
    }
    
    // Get approvers for request
    getApproversForRequest(approvalRequest) {
        const approvers = [];
        
        approvalRequest.requiredApprovers.groups.forEach(groupId => {
            const group = this.approvers.groups[groupId];
            if (group) {
                approvers.push(...group.members);
            }
        });
        
        return approvers;
    }
    
    // Send email notifications
    async sendEmailNotifications(approvalRequest, approvers) {
        if (!this.config.emailConfig.host) {
            console.log('Email not configured, skipping email notifications');
            return;
        }
        
        try {
            const transporter = nodemailer.createTransporter(this.config.emailConfig);
            
            // Load email template
            const template = await this.loadEmailTemplate(approvalRequest.type);
            
            // Send to each approver
            const emailPromises = approvers.map(approver => {
                const subject = this.renderTemplate(template.subject, { approvalRequest, approver });
                const body = this.renderTemplate(template.body, { approvalRequest, approver });
                
                return transporter.sendMail({
                    from: '"ROOTUIP Deployment System" <deployments@rootuip.com>',
                    to: approver.email,
                    subject,
                    html: body,
                    priority: approvalRequest.emergency ? 'high' : 'normal'
                });
            });
            
            await Promise.all(emailPromises);
            console.log(`📧 Sent email notifications to ${approvers.length} approvers`);
            
        } catch (error) {
            console.error('Failed to send email notifications:', error);
        }
    }
    
    // Send Slack notifications
    async sendSlackNotifications(approvalRequest, approvers) {
        if (!this.config.slackWebhook) {
            console.log('Slack webhook not configured, skipping Slack notifications');
            return;
        }
        
        try {
            const slackMessage = this.createSlackMessage(approvalRequest, approvers);
            
            const response = await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slackMessage)
            });
            
            if (response.ok) {
                console.log('📱 Sent Slack notification');
            } else {
                throw new Error(`Slack API error: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('Failed to send Slack notification:', error);
        }
    }
    
    // Create Slack message
    createSlackMessage(approvalRequest, approvers) {
        const urgencyEmoji = approvalRequest.emergency ? '🚨' : '📋';
        const approverMentions = approvers.map(a => a.slack).join(' ');
        
        return {
            text: `${urgencyEmoji} Approval Required: ${approvalRequest.title}`,
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `${urgencyEmoji} Approval Required`
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Type:* ${approvalRequest.type}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Environment:* ${approvalRequest.environment}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Requester:* ${approvalRequest.requester}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Expires:* ${approvalRequest.expiresAt.toLocaleString()}`
                        }
                    ]
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Title:* ${approvalRequest.title}\n*Description:* ${approvalRequest.description}`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*Approvers:* ${approverMentions}\n*Required Approvals:* ${approvalRequest.requiredApprovers.totalRequired}`
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '✅ Approve'
                            },
                            style: 'primary',
                            url: `https://deployments.rootuip.com/approve/${approvalRequest.id}`
                        },
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '❌ Reject'
                            },
                            style: 'danger',
                            url: `https://deployments.rootuip.com/reject/${approvalRequest.id}`
                        },
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '🔍 View Details'
                            },
                            url: `https://deployments.rootuip.com/requests/${approvalRequest.id}`
                        }
                    ]
                }
            ]
        };
    }
    
    // Send Teams notifications
    async sendTeamsNotifications(approvalRequest, approvers) {
        if (!this.config.teamsWebhook) {
            return;
        }
        
        try {
            const teamsMessage = this.createTeamsMessage(approvalRequest, approvers);
            
            const response = await fetch(this.config.teamsWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamsMessage)
            });
            
            if (response.ok) {
                console.log('👥 Sent Teams notification');
            }
            
        } catch (error) {
            console.error('Failed to send Teams notification:', error);
        }
    }
    
    // Create Teams message
    createTeamsMessage(approvalRequest, approvers) {
        return {
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            themeColor: approvalRequest.emergency ? 'FF0000' : '0076D7',
            summary: `Approval Required: ${approvalRequest.title}`,
            sections: [
                {
                    activityTitle: `${approvalRequest.emergency ? '🚨' : '📋'} Approval Required`,
                    activitySubtitle: approvalRequest.title,
                    facts: [
                        { name: 'Type', value: approvalRequest.type },
                        { name: 'Environment', value: approvalRequest.environment },
                        { name: 'Requester', value: approvalRequest.requester },
                        { name: 'Required Approvals', value: approvalRequest.requiredApprovers.totalRequired.toString() },
                        { name: 'Expires', value: approvalRequest.expiresAt.toLocaleString() }
                    ],
                    text: approvalRequest.description
                }
            ],
            potentialAction: [
                {
                    '@type': 'OpenUri',
                    name: 'View Approval Request',
                    targets: [
                        {
                            os: 'default',
                            uri: `https://deployments.rootuip.com/requests/${approvalRequest.id}`
                        }
                    ]
                }
            ]
        };
    }
    
    // Create GitHub issue
    async createGitHubIssue(approvalRequest) {
        if (!process.env.GITHUB_TOKEN) {
            console.log('GitHub token not configured, skipping issue creation');
            return;
        }
        
        try {
            const { Octokit } = require('@octokit/rest');
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            
            const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'rootuip/platform').split('/');
            
            const title = `[APPROVAL] ${approvalRequest.title}`;
            const body = this.createGitHubIssueBody(approvalRequest);
            
            const issue = await octokit.issues.create({
                owner,
                repo,
                title,
                body,
                labels: ['approval', `environment:${approvalRequest.environment}`, `type:${approvalRequest.type}`],
                assignees: this.getApproversForRequest(approvalRequest).map(a => a.githubUsername).filter(Boolean)
            });
            
            // Store GitHub issue URL
            approvalRequest.metadata.githubIssue = issue.data.html_url;
            
            console.log(`📝 Created GitHub issue: ${issue.data.html_url}`);
            
        } catch (error) {
            console.error('Failed to create GitHub issue:', error);
        }
    }
    
    // Create GitHub issue body
    createGitHubIssueBody(approvalRequest) {
        const approvers = this.getApproversForRequest(approvalRequest);
        
        return `## Approval Request

**Type:** ${approvalRequest.type}
**Environment:** ${approvalRequest.environment}
**Requester:** ${approvalRequest.requester}
**Created:** ${approvalRequest.createdAt.toISOString()}
**Expires:** ${approvalRequest.expiresAt.toISOString()}

### Description
${approvalRequest.description}

### Required Approvals
- **Total Required:** ${approvalRequest.requiredApprovers.totalRequired}
- **Groups:** ${approvalRequest.requiredApprovers.groups.join(', ')}
- **Require All Groups:** ${approvalRequest.requiredApprovers.requireAllGroups ? 'Yes' : 'No'}

### Approvers
${approvers.map(a => `- [ ] @${a.githubUsername || a.id} (${a.name})`).join('\n')}

### Metadata
\`\`\`json
${JSON.stringify(approvalRequest.metadata, null, 2)}
\`\`\`

---
*This issue was automatically created by the ROOTUIP approval system.*`;
    }
    
    // Create Jira ticket
    async createJiraTicket(approvalRequest) {
        if (!this.config.jiraConfig.host || !this.config.jiraConfig.token) {
            console.log('Jira not configured, skipping ticket creation');
            return;
        }
        
        try {
            const jiraData = {
                fields: {
                    project: { key: this.config.jiraConfig.project },
                    summary: `[APPROVAL] ${approvalRequest.title}`,
                    description: this.createJiraDescription(approvalRequest),
                    issuetype: { name: 'Task' },
                    priority: { name: approvalRequest.emergency ? 'High' : 'Medium' },
                    labels: ['approval', approvalRequest.environment, approvalRequest.type]
                }
            };
            
            const response = await fetch(`${this.config.jiraConfig.host}/rest/api/2/issue`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${this.config.jiraConfig.email}:${this.config.jiraConfig.token}`).toString('base64')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(jiraData)
            });
            
            if (response.ok) {
                const ticket = await response.json();
                approvalRequest.metadata.jiraTicket = `${this.config.jiraConfig.host}/browse/${ticket.key}`;
                console.log(`🎫 Created Jira ticket: ${ticket.key}`);
            }
            
        } catch (error) {
            console.error('Failed to create Jira ticket:', error);
        }
    }
    
    // Create Jira description
    createJiraDescription(approvalRequest) {
        return `*Approval Request Details*

*Type:* ${approvalRequest.type}
*Environment:* ${approvalRequest.environment}
*Requester:* ${approvalRequest.requester}
*Created:* ${approvalRequest.createdAt.toISOString()}
*Expires:* ${approvalRequest.expiresAt.toISOString()}

*Description:*
${approvalRequest.description}

*Required Approvals:* ${approvalRequest.requiredApprovers.totalRequired}
*Groups:* ${approvalRequest.requiredApprovers.groups.join(', ')}`;
    }
    
    // Start approval monitoring
    startApprovalMonitoring(approvalId) {
        // Set up expiration check
        const approvalRequest = this.activeApprovals.get(approvalId);
        if (!approvalRequest) return;
        
        const timeUntilExpiration = approvalRequest.expiresAt.getTime() - Date.now();
        
        if (timeUntilExpiration > 0) {
            setTimeout(() => {
                this.handleApprovalExpiration(approvalId);
            }, timeUntilExpiration);
        }
        
        // Set up escalation reminders
        this.setupEscalationReminders(approvalId);
    }
    
    // Setup escalation reminders
    setupEscalationReminders(approvalId) {
        if (!this.approvers.escalation.enabled) return;
        
        const approvalRequest = this.activeApprovals.get(approvalId);
        if (!approvalRequest) return;
        
        this.approvers.escalation.levels.forEach(level => {
            setTimeout(() => {
                if (this.activeApprovals.has(approvalId)) {
                    this.sendEscalationNotification(approvalId, level);
                }
            }, level.after * 1000);
        });
    }
    
    // Handle approval expiration
    async handleApprovalExpiration(approvalId) {
        const approvalRequest = this.activeApprovals.get(approvalId);
        
        if (!approvalRequest || approvalRequest.status !== this.APPROVAL_STATES.PENDING) {
            return;
        }
        
        console.log(`⏰ Approval request expired: ${approvalId}`);
        
        approvalRequest.status = this.APPROVAL_STATES.EXPIRED;
        approvalRequest.expiredAt = new Date();
        approvalRequest.lastUpdated = new Date();
        
        // Send expiration notifications
        await this.sendExpirationNotifications(approvalRequest);
        
        // Move to history
        this.approvalHistory.push({ ...approvalRequest });
        this.activeApprovals.delete(approvalId);
    }
    
    // Send escalation notification
    async sendEscalationNotification(approvalId, escalationLevel) {
        const approvalRequest = this.activeApprovals.get(approvalId);
        if (!approvalRequest) return;
        
        console.log(`🔔 Escalating approval request: ${approvalId}`);
        
        // Get escalation approvers
        const escalationApprovers = [];
        escalationLevel.notify.forEach(groupId => {
            const group = this.approvers.groups[groupId];
            if (group) {
                escalationApprovers.push(...group.members);
            }
        });
        
        // Send escalation notifications
        if (this.config.slackWebhook) {
            const message = {
                text: `🔔 ESCALATION: Approval request requires attention`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*ESCALATION NOTICE*\n\nApproval request *${approvalRequest.title}* has been pending for ${Math.floor((Date.now() - approvalRequest.createdAt.getTime()) / 3600000)} hours.\n\n*Environment:* ${approvalRequest.environment}\n*Type:* ${approvalRequest.type}\n*Requester:* ${approvalRequest.requester}\n\nImmediate attention required.`
                        }
                    }
                ]
            };
            
            await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
        }
    }
    
    // Send status update notifications
    async sendStatusUpdateNotifications(approvalRequest, decisionData) {
        const statusEmoji = decisionData.decision === 'approve' ? '✅' : '❌';
        const statusText = decisionData.decision === 'approve' ? 'Approved' : 'Rejected';
        
        if (this.config.slackWebhook) {
            const message = {
                text: `${statusEmoji} Approval ${statusText}: ${approvalRequest.title}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${statusEmoji} *${statusText}* by ${decisionData.approverName}\n\n*Request:* ${approvalRequest.title}\n*Comments:* ${decisionData.comments || 'No comments'}\n\n*Current Status:* ${approvalRequest.status.toUpperCase()}`
                        }
                    }
                ]
            };
            
            await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
        }
    }
    
    // Send expiration notifications
    async sendExpirationNotifications(approvalRequest) {
        if (this.config.slackWebhook) {
            const message = {
                text: `⏰ Approval Request Expired: ${approvalRequest.title}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `⏰ *EXPIRED*\n\nApproval request *${approvalRequest.title}* has expired without sufficient approvals.\n\n*Environment:* ${approvalRequest.environment}\n*Type:* ${approvalRequest.type}\n*Requester:* ${approvalRequest.requester}\n\nRequest must be resubmitted.`
                        }
                    }
                ]
            };
            
            await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
        }
    }
    
    // Update external systems
    async updateExternalSystems(approvalRequest) {
        // Update GitHub issue
        if (approvalRequest.metadata.githubIssue && process.env.GITHUB_TOKEN) {
            try {
                const { Octokit } = require('@octokit/rest');
                const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
                
                const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'rootuip/platform').split('/');
                const issueNumber = approvalRequest.metadata.githubIssue.split('/').pop();
                
                let state = 'open';
                let labels = ['approval', `environment:${approvalRequest.environment}`, `type:${approvalRequest.type}`];
                
                if (approvalRequest.status === this.APPROVAL_STATES.APPROVED) {
                    state = 'closed';
                    labels.push('approved');
                } else if (approvalRequest.status === this.APPROVAL_STATES.REJECTED) {
                    state = 'closed';
                    labels.push('rejected');
                } else if (approvalRequest.status === this.APPROVAL_STATES.EXPIRED) {
                    state = 'closed';
                    labels.push('expired');
                }
                
                await octokit.issues.update({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    state,
                    labels
                });
                
            } catch (error) {
                console.error('Failed to update GitHub issue:', error);
            }
        }
        
        // Update Jira ticket
        if (approvalRequest.metadata.jiraTicket && this.config.jiraConfig.host) {
            try {
                const ticketKey = approvalRequest.metadata.jiraTicket.split('/').pop();
                
                let status = 'To Do';
                if (approvalRequest.status === this.APPROVAL_STATES.APPROVED) {
                    status = 'Done';
                } else if (approvalRequest.status === this.APPROVAL_STATES.REJECTED) {
                    status = 'Cancelled';
                }
                
                const transitionData = {
                    transition: { name: status }
                };
                
                await fetch(`${this.config.jiraConfig.host}/rest/api/2/issue/${ticketKey}/transitions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${this.config.jiraConfig.email}:${this.config.jiraConfig.token}`).toString('base64')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(transitionData)
                });
                
            } catch (error) {
                console.error('Failed to update Jira ticket:', error);
            }
        }
    }
    
    // Load email template
    async loadEmailTemplate(type) {
        const templatePath = path.join(
            this.config.repoPath,
            this.config.templatesDir,
            `${type}-email.json`
        );
        
        if (fs.existsSync(templatePath)) {
            return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        }
        
        // Default template
        return {
            subject: 'ROOTUIP Approval Required: {{approvalRequest.title}}',
            body: `
                <h2>Approval Required</h2>
                <p>Hello {{approver.name}},</p>
                <p>An approval request requires your attention:</p>
                <ul>
                    <li><strong>Title:</strong> {{approvalRequest.title}}</li>
                    <li><strong>Type:</strong> {{approvalRequest.type}}</li>
                    <li><strong>Environment:</strong> {{approvalRequest.environment}}</li>
                    <li><strong>Requester:</strong> {{approvalRequest.requester}}</li>
                    <li><strong>Expires:</strong> {{approvalRequest.expiresAt}}</li>
                </ul>
                <p><strong>Description:</strong><br>{{approvalRequest.description}}</p>
                <p>Please review and provide your approval decision.</p>
                <p><a href="https://deployments.rootuip.com/requests/{{approvalRequest.id}}">View Request</a></p>
            `
        };
    }
    
    // Render template
    renderTemplate(template, variables) {
        return template.replace(/\{\{(.+?)\}\}/g, (match, path) => {
            const value = this.getNestedValue(variables, path.trim());
            return value !== undefined ? value : match;
        });
    }
    
    // Get nested object value by path
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    // Get client IP (placeholder)
    getClientIP() {
        return process.env.CLIENT_IP || '127.0.0.1';
    }
    
    // Get approval request status
    getApprovalStatus(approvalId) {
        const active = this.activeApprovals.get(approvalId);
        if (active) return active;
        
        const historical = this.approvalHistory.find(a => a.id === approvalId);
        return historical || null;
    }
    
    // List active approval requests
    listActiveApprovals() {
        return Array.from(this.activeApprovals.values());
    }
    
    // List approval history
    listApprovalHistory(limit = 50) {
        return this.approvalHistory
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }
    
    // Cancel approval request
    async cancelApprovalRequest(approvalId, reason = 'Cancelled by requester') {
        const approvalRequest = this.activeApprovals.get(approvalId);
        
        if (!approvalRequest) {
            throw new Error(`Approval request not found: ${approvalId}`);
        }
        
        if (approvalRequest.status !== this.APPROVAL_STATES.PENDING) {
            throw new Error(`Cannot cancel approval request with status: ${approvalRequest.status}`);
        }
        
        approvalRequest.status = this.APPROVAL_STATES.CANCELLED;
        approvalRequest.cancelledAt = new Date();
        approvalRequest.cancellationReason = reason;
        approvalRequest.lastUpdated = new Date();
        
        // Send cancellation notifications
        if (this.config.slackWebhook) {
            const message = {
                text: `🚫 Approval Request Cancelled: ${approvalRequest.title}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `🚫 *CANCELLED*\n\nApproval request *${approvalRequest.title}* has been cancelled.\n\n*Reason:* ${reason}\n*Environment:* ${approvalRequest.environment}\n*Type:* ${approvalRequest.type}`
                        }
                    }
                ]
            };
            
            await fetch(this.config.slackWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
        }
        
        // Update external systems
        await this.updateExternalSystems(approvalRequest);
        
        // Move to history
        this.approvalHistory.push({ ...approvalRequest });
        this.activeApprovals.delete(approvalId);
        
        console.log(`🚫 Approval request cancelled: ${approvalId}`);
        return approvalRequest;
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    const approvalSystem = new EnterpriseApprovalSystem();
    
    switch (command) {
        case 'create':
            // Create approval request
            const approvalData = {
                type: process.argv[3] || 'deployment',
                environment: process.argv[4] || 'production',
                title: process.argv[5] || 'Test Approval',
                description: process.argv[6] || 'Test approval request',
                requester: process.argv[7] || 'system',
                emergency: process.argv.includes('--emergency')
            };
            
            approvalSystem.createApprovalRequest(approvalData)
                .then(result => {
                    console.log('Approval request created:', result.id);
                })
                .catch(error => {
                    console.error('Failed to create approval request:', error);
                    process.exit(1);
                });
            break;
            
        case 'approve':
            // Submit approval
            const approvalId = process.argv[3];
            const approverId = process.argv[4];
            const comments = process.argv[5] || '';
            
            approvalSystem.submitApproval(approvalId, approverId, 'approve', comments)
                .then(result => {
                    console.log('Approval submitted:', result.status);
                })
                .catch(error => {
                    console.error('Failed to submit approval:', error);
                    process.exit(1);
                });
            break;
            
        case 'reject':
            // Submit rejection
            const rejectId = process.argv[3];
            const rejecterId = process.argv[4];
            const rejectComments = process.argv[5] || '';
            
            approvalSystem.submitApproval(rejectId, rejecterId, 'reject', rejectComments)
                .then(result => {
                    console.log('Rejection submitted:', result.status);
                })
                .catch(error => {
                    console.error('Failed to submit rejection:', error);
                    process.exit(1);
                });
            break;
            
        case 'status':
            // Get approval status
            const statusId = process.argv[3];
            const status = approvalSystem.getApprovalStatus(statusId);
            
            if (status) {
                console.log(JSON.stringify(status, null, 2));
            } else {
                console.log('Approval request not found');
                process.exit(1);
            }
            break;
            
        case 'list':
            // List active approvals
            const active = approvalSystem.listActiveApprovals();
            console.log(`Active approval requests: ${active.length}`);
            active.forEach(approval => {
                console.log(`- ${approval.id}: ${approval.title} (${approval.status})`);
            });
            break;
            
        default:
            console.log('Usage: node enterprise-approval-system.js <create|approve|reject|status|list> [args...]');
            process.exit(1);
    }
}

module.exports = EnterpriseApprovalSystem;