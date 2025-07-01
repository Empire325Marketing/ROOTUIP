/**
 * ROOTUIP Email Automation System
 * SendGrid integration for enterprise email sequences and automation
 */

const sgMail = require('@sendgrid/mail');
const { Pool } = require('pg');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const schedule = require('node-schedule');

class EmailAutomationSystem {
    constructor(config = {}) {
        // SendGrid configuration
        this.sendGridApiKey = process.env.SENDGRID_API_KEY || config.sendGridApiKey;
        sgMail.setApiKey(this.sendGridApiKey);
        
        // Database connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rootuip_crm',
            max: 10
        });
        
        // Email settings
        this.fromEmail = process.env.EMAIL_FROM || 'hello@rootuip.com';
        this.replyToEmail = process.env.EMAIL_REPLY_TO || 'support@rootuip.com';
        
        // Template cache
        this.templates = new Map();
        
        // Initialize email sequences
        this.sequences = this.defineEmailSequences();
        
        // Start automation scheduler
        this.startAutomationScheduler();
    }

    defineEmailSequences() {
        return {
            trial_welcome: {
                name: 'Trial Welcome Series',
                emails: [
                    {
                        delay: 0, // Immediate
                        template: 'trial_welcome',
                        subject: 'Welcome to ROOTUIP - Your $14M savings journey starts now'
                    },
                    {
                        delay: 2 * 24 * 60, // 2 days
                        template: 'trial_getting_started',
                        subject: 'Quick win: Prevent your first D&D charge today'
                    },
                    {
                        delay: 5 * 24 * 60, // 5 days
                        template: 'trial_best_practices',
                        subject: 'How Maersk saved $18M with these 3 features'
                    },
                    {
                        delay: 10 * 24 * 60, // 10 days
                        template: 'trial_midpoint_check',
                        subject: '{firstName}, you\'ve prevented ${savedAmount} so far'
                    },
                    {
                        delay: 20 * 24 * 60, // 20 days
                        template: 'trial_success_metrics',
                        subject: 'Your trial results: ${containersTracked} containers, ${chargesPrevented} charges prevented'
                    },
                    {
                        delay: 25 * 24 * 60, // 25 days
                        template: 'trial_conversion_offer',
                        subject: 'Special offer: Lock in your ${annualSavings} annual savings'
                    }
                ]
            },
            
            demo_followup: {
                name: 'Demo Follow-up Series',
                emails: [
                    {
                        delay: 60, // 1 hour after demo
                        template: 'demo_thank_you',
                        subject: 'Your ROOTUIP demo recording + ROI summary'
                    },
                    {
                        delay: 2 * 24 * 60, // 2 days
                        template: 'demo_technical_specs',
                        subject: 'ROOTUIP technical integration guide for {company}'
                    },
                    {
                        delay: 5 * 24 * 60, // 5 days
                        template: 'demo_stakeholder_deck',
                        subject: 'Executive presentation: ROOTUIP ROI for {company}'
                    },
                    {
                        delay: 10 * 24 * 60, // 10 days
                        template: 'demo_pilot_proposal',
                        subject: 'Start saving ${dailySavings} per day - pilot proposal inside'
                    }
                ]
            },
            
            executive_nurture: {
                name: 'Executive Decision Maker Series',
                emails: [
                    {
                        delay: 0,
                        template: 'exec_industry_report',
                        subject: '2024 Container D&D Report: Industry loses $4.2B annually'
                    },
                    {
                        delay: 7 * 24 * 60, // Weekly
                        template: 'exec_competitor_savings',
                        subject: 'How your competitors are saving millions on D&D'
                    },
                    {
                        delay: 14 * 24 * 60,
                        template: 'exec_board_metrics',
                        subject: 'Board-ready metrics: ROOTUIP impact on EBITDA'
                    },
                    {
                        delay: 21 * 24 * 60,
                        template: 'exec_cfo_calculator',
                        subject: 'CFO calculator: ${roi}% ROI in ${paybackDays} days'
                    }
                ]
            },
            
            roi_report_delivery: {
                name: 'ROI Report Delivery',
                emails: [
                    {
                        delay: 0,
                        template: 'roi_detailed_report',
                        subject: 'Your personalized ROOTUIP savings report: ${annualSavings}'
                    },
                    {
                        delay: 3 * 24 * 60,
                        template: 'roi_implementation_plan',
                        subject: 'Start saving in 14 days - your implementation roadmap'
                    }
                ]
            },
            
            renewal_reminder: {
                name: 'Contract Renewal Series',
                emails: [
                    {
                        delay: -90 * 24 * 60, // 90 days before expiry
                        template: 'renewal_value_recap',
                        subject: 'You\'ve saved ${totalSaved} with ROOTUIP this year'
                    },
                    {
                        delay: -60 * 24 * 60, // 60 days before
                        template: 'renewal_enhanced_features',
                        subject: 'New: AI accuracy now 96.8% - upgrade your plan'
                    },
                    {
                        delay: -30 * 24 * 60, // 30 days before
                        template: 'renewal_exclusive_pricing',
                        subject: 'Exclusive renewal pricing - save 20% for {company}'
                    },
                    {
                        delay: -7 * 24 * 60, // 7 days before
                        template: 'renewal_urgent',
                        subject: 'Action required: ROOTUIP access expires in 7 days'
                    }
                ]
            },
            
            customer_success: {
                name: 'Customer Success Check-ins',
                emails: [
                    {
                        delay: 30 * 24 * 60, // Monthly
                        template: 'success_monthly_review',
                        subject: 'Your ROOTUIP impact report for {month}'
                    },
                    {
                        delay: 90 * 24 * 60, // Quarterly
                        template: 'success_business_review',
                        subject: 'Quarterly business review - ${quarterlySavings} saved'
                    }
                ]
            }
        };
    }

    async loadEmailTemplate(templateName) {
        // Check cache first
        if (this.templates.has(templateName)) {
            return this.templates.get(templateName);
        }
        
        // Load from file
        const templatePath = path.join(__dirname, 'email-templates', `${templateName}.hbs`);
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Compile template
        const compiled = handlebars.compile(templateContent);
        this.templates.set(templateName, compiled);
        
        return compiled;
    }

    async sendEmail(to, subject, templateName, data = {}) {
        try {
            // Load and compile template
            const template = await this.loadEmailTemplate(templateName);
            const html = template(data);
            
            // Prepare email
            const msg = {
                to,
                from: {
                    email: this.fromEmail,
                    name: 'ROOTUIP Team'
                },
                replyTo: this.replyToEmail,
                subject: this.personalizeSubject(subject, data),
                html,
                text: this.htmlToText(html),
                trackingSettings: {
                    clickTracking: { enable: true },
                    openTracking: { enable: true },
                    subscriptionTracking: { enable: false }
                },
                categories: [templateName, data.sequenceName || 'transactional']
            };
            
            // Add custom headers for better deliverability
            msg.headers = {
                'X-Entity-Ref-ID': data.leadId || data.userId || 'unknown',
                'X-Campaign-ID': data.sequenceName || templateName
            };
            
            // Send email
            const [response] = await sgMail.send(msg);
            
            // Log email activity
            await this.logEmailActivity({
                recipient: to,
                template: templateName,
                subject: msg.subject,
                status: 'sent',
                messageId: response.headers['x-message-id'],
                leadId: data.leadId,
                userId: data.userId
            });
            
            return { success: true, messageId: response.headers['x-message-id'] };
            
        } catch (error) {
            console.error('Email send error:', error);
            
            // Log failed attempt
            await this.logEmailActivity({
                recipient: to,
                template: templateName,
                subject,
                status: 'failed',
                error: error.message,
                leadId: data.leadId,
                userId: data.userId
            });
            
            throw error;
        }
    }

    personalizeSubject(subject, data) {
        // Replace placeholders with actual values
        return subject.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] || match;
        }).replace(/\$\{(\w+)\}/g, (match, key) => {
            const value = data[key];
            if (typeof value === 'number' && key.includes('amount') || key.includes('savings')) {
                return this.formatCurrency(value);
            }
            return value || match;
        });
    }

    formatCurrency(amount) {
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(0)}K`;
        }
        return `$${amount.toFixed(0)}`;
    }

    htmlToText(html) {
        // Simple HTML to text conversion
        return html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async startEmailSequence(sequenceName, recipientData) {
        const sequence = this.sequences[sequenceName];
        if (!sequence) {
            throw new Error(`Email sequence ${sequenceName} not found`);
        }
        
        // Create sequence tracking record
        const tracking = await this.db.query(`
            INSERT INTO email_sequences (
                lead_id, user_id, sequence_name, recipient_email,
                status, started_at, data
            ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
            RETURNING id
        `, [
            recipientData.leadId,
            recipientData.userId,
            sequenceName,
            recipientData.email,
            'active',
            JSON.stringify(recipientData)
        ]);
        
        const sequenceId = tracking.rows[0].id;
        
        // Schedule emails
        for (const email of sequence.emails) {
            const sendTime = new Date(Date.now() + email.delay * 60000);
            
            await this.db.query(`
                INSERT INTO scheduled_emails (
                    sequence_id, template_name, subject,
                    scheduled_for, status
                ) VALUES ($1, $2, $3, $4, 'pending')
            `, [
                sequenceId,
                email.template,
                email.subject,
                sendTime
            ]);
        }
        
        return sequenceId;
    }

    async pauseSequence(sequenceId) {
        await this.db.query(`
            UPDATE email_sequences SET status = 'paused' WHERE id = $1
        `, [sequenceId]);
        
        await this.db.query(`
            UPDATE scheduled_emails 
            SET status = 'paused' 
            WHERE sequence_id = $1 AND status = 'pending'
        `, [sequenceId]);
    }

    async resumeSequence(sequenceId) {
        await this.db.query(`
            UPDATE email_sequences SET status = 'active' WHERE id = $1
        `, [sequenceId]);
        
        await this.db.query(`
            UPDATE scheduled_emails 
            SET status = 'pending' 
            WHERE sequence_id = $1 AND status = 'paused'
        `, [sequenceId]);
    }

    async cancelSequence(sequenceId, reason) {
        await this.db.query(`
            UPDATE email_sequences 
            SET status = 'cancelled', cancelled_reason = $2, cancelled_at = NOW()
            WHERE id = $1
        `, [sequenceId, reason]);
        
        await this.db.query(`
            UPDATE scheduled_emails 
            SET status = 'cancelled' 
            WHERE sequence_id = $1 AND status IN ('pending', 'paused')
        `, [sequenceId]);
    }

    startAutomationScheduler() {
        // Run every minute to check for scheduled emails
        schedule.scheduleJob('* * * * *', async () => {
            await this.processPendingEmails();
        });
        
        // Run hourly for sequence triggers
        schedule.scheduleJob('0 * * * *', async () => {
            await this.checkSequenceTriggers();
        });
        
        console.log('Email automation scheduler started');
    }

    async processPendingEmails() {
        try {
            // Get emails due to be sent
            const pendingEmails = await this.db.query(`
                SELECT 
                    se.id, se.sequence_id, se.template_name, se.subject,
                    es.recipient_email, es.data, es.lead_id, es.user_id
                FROM scheduled_emails se
                JOIN email_sequences es ON se.sequence_id = es.id
                WHERE se.status = 'pending' 
                    AND se.scheduled_for <= NOW()
                    AND es.status = 'active'
                LIMIT 50
            `);
            
            for (const email of pendingEmails.rows) {
                try {
                    // Parse recipient data
                    const data = JSON.parse(email.data);
                    data.leadId = email.lead_id;
                    data.userId = email.user_id;
                    data.sequenceName = email.sequence_id;
                    
                    // Send email
                    await this.sendEmail(
                        email.recipient_email,
                        email.subject,
                        email.template_name,
                        data
                    );
                    
                    // Mark as sent
                    await this.db.query(`
                        UPDATE scheduled_emails 
                        SET status = 'sent', sent_at = NOW() 
                        WHERE id = $1
                    `, [email.id]);
                    
                } catch (error) {
                    console.error(`Failed to send scheduled email ${email.id}:`, error);
                    
                    // Mark as failed
                    await this.db.query(`
                        UPDATE scheduled_emails 
                        SET status = 'failed', 
                            error_message = $2,
                            retry_count = retry_count + 1
                        WHERE id = $1
                    `, [email.id, error.message]);
                }
            }
        } catch (error) {
            console.error('Error processing pending emails:', error);
        }
    }

    async checkSequenceTriggers() {
        // Check for trial expirations
        await this.checkTrialExpirations();
        
        // Check for renewal reminders
        await this.checkRenewalReminders();
        
        // Check for inactive users
        await this.checkInactiveUsers();
        
        // Check for high-value leads
        await this.checkHighValueLeads();
    }

    async checkTrialExpirations() {
        const expiringTrials = await this.db.query(`
            SELECT * FROM trials 
            WHERE status = 'active' 
                AND end_date BETWEEN NOW() AND NOW() + INTERVAL '5 days'
                AND NOT EXISTS (
                    SELECT 1 FROM email_sequences 
                    WHERE user_id = trials.user_id 
                        AND sequence_name = 'trial_conversion'
                )
        `);
        
        for (const trial of expiringTrials.rows) {
            await this.startEmailSequence('trial_conversion', {
                userId: trial.user_id,
                email: trial.email,
                firstName: trial.first_name,
                companyName: trial.company_name,
                trialEndDate: trial.end_date,
                savedAmount: trial.total_saved || 0
            });
        }
    }

    async checkRenewalReminders() {
        const upcomingRenewals = await this.db.query(`
            SELECT * FROM subscriptions 
            WHERE status = 'active' 
                AND renewal_date BETWEEN NOW() + INTERVAL '85 days' 
                    AND NOW() + INTERVAL '95 days'
                AND NOT EXISTS (
                    SELECT 1 FROM email_sequences 
                    WHERE user_id = subscriptions.user_id 
                        AND sequence_name = 'renewal_reminder'
                        AND created_at > NOW() - INTERVAL '1 year'
                )
        `);
        
        for (const subscription of upcomingRenewals.rows) {
            const metrics = await this.getCustomerMetrics(subscription.user_id);
            
            await this.startEmailSequence('renewal_reminder', {
                userId: subscription.user_id,
                email: subscription.email,
                firstName: subscription.first_name,
                company: subscription.company_name,
                renewalDate: subscription.renewal_date,
                totalSaved: metrics.totalSaved,
                containersTracked: metrics.containersTracked
            });
        }
    }

    async checkInactiveUsers() {
        const inactiveUsers = await this.db.query(`
            SELECT u.* FROM users u
            WHERE u.status = 'active'
                AND u.last_login < NOW() - INTERVAL '14 days'
                AND NOT EXISTS (
                    SELECT 1 FROM email_sequences es
                    WHERE es.user_id = u.id 
                        AND es.sequence_name = 'reengagement'
                        AND es.created_at > NOW() - INTERVAL '30 days'
                )
        `);
        
        for (const user of inactiveUsers.rows) {
            await this.startEmailSequence('reengagement', {
                userId: user.id,
                email: user.email,
                firstName: user.first_name,
                lastLoginDays: Math.floor((Date.now() - user.last_login) / (1000 * 60 * 60 * 24))
            });
        }
    }

    async checkHighValueLeads() {
        const highValueLeads = await this.db.query(`
            SELECT * FROM leads 
            WHERE lead_score >= 70 
                AND status = 'new'
                AND created_at < NOW() - INTERVAL '1 hour'
                AND fleet_size >= 20
                AND NOT EXISTS (
                    SELECT 1 FROM email_sequences 
                    WHERE lead_id = leads.id 
                        AND sequence_name = 'executive_nurture'
                )
        `);
        
        for (const lead of highValueLeads.rows) {
            await this.startEmailSequence('executive_nurture', {
                leadId: lead.id,
                email: lead.email,
                firstName: lead.name?.split(' ')[0] || 'there',
                company: lead.company,
                title: lead.title,
                annualSavings: lead.calculated_savings,
                roi: lead.roi_percentage
            });
        }
    }

    async getCustomerMetrics(userId) {
        // Get aggregated metrics for customer
        const metrics = await this.db.query(`
            SELECT 
                COUNT(DISTINCT container_id) as containers_tracked,
                SUM(prevented_amount) as total_saved,
                COUNT(DISTINCT CASE WHEN prevented = true THEN charge_id END) as charges_prevented
            FROM container_tracking_metrics
            WHERE user_id = $1
        `, [userId]);
        
        return {
            containersTracked: metrics.rows[0]?.containers_tracked || 0,
            totalSaved: metrics.rows[0]?.total_saved || 0,
            chargesPrevented: metrics.rows[0]?.charges_prevented || 0
        };
    }

    async logEmailActivity(activity) {
        await this.db.query(`
            INSERT INTO email_activity_log (
                recipient, template, subject, status,
                message_id, error_message, lead_id, user_id,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
            activity.recipient,
            activity.template,
            activity.subject,
            activity.status,
            activity.messageId,
            activity.error,
            activity.leadId,
            activity.userId
        ]);
    }

    async getEmailMetrics(startDate, endDate) {
        const metrics = await this.db.query(`
            SELECT 
                COUNT(*) as total_sent,
                COUNT(CASE WHEN status = 'opened' THEN 1 END) as opened,
                COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked,
                COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
                COUNT(CASE WHEN status = 'unsubscribed' THEN 1 END) as unsubscribed,
                template,
                DATE(created_at) as date
            FROM email_activity_log
            WHERE created_at BETWEEN $1 AND $2
            GROUP BY template, DATE(created_at)
            ORDER BY date DESC
        `, [startDate, endDate]);
        
        return metrics.rows;
    }

    async handleWebhook(event) {
        // Process SendGrid webhooks
        const events = Array.isArray(event) ? event : [event];
        
        for (const evt of events) {
            switch (evt.event) {
                case 'open':
                    await this.recordEmailOpen(evt);
                    break;
                case 'click':
                    await this.recordEmailClick(evt);
                    break;
                case 'bounce':
                    await this.handleBounce(evt);
                    break;
                case 'unsubscribe':
                    await this.handleUnsubscribe(evt);
                    break;
                case 'spam_report':
                    await this.handleSpamReport(evt);
                    break;
            }
        }
    }

    async recordEmailOpen(event) {
        await this.db.query(`
            UPDATE email_activity_log 
            SET status = 'opened', 
                opened_at = COALESCE(opened_at, NOW()),
                open_count = COALESCE(open_count, 0) + 1
            WHERE message_id = $1
        `, [event.sg_message_id]);
    }

    async recordEmailClick(event) {
        await this.db.query(`
            UPDATE email_activity_log 
            SET status = 'clicked', 
                clicked_at = COALESCE(clicked_at, NOW()),
                click_count = COALESCE(click_count, 0) + 1,
                clicked_links = clicked_links || $2::jsonb
            WHERE message_id = $1
        `, [event.sg_message_id, JSON.stringify([event.url])]);
    }

    async handleBounce(event) {
        await this.db.query(`
            UPDATE email_activity_log 
            SET status = 'bounced', 
                bounce_type = $2,
                bounce_reason = $3
            WHERE message_id = $1
        `, [event.sg_message_id, event.type, event.reason]);
        
        // Mark email as invalid if hard bounce
        if (event.type === 'blocked' || event.type === 'bounce') {
            await this.db.query(`
                UPDATE leads SET email_valid = false WHERE email = $1;
                UPDATE users SET email_valid = false WHERE email = $1;
            `, [event.email]);
        }
    }

    async handleUnsubscribe(event) {
        // Update email preferences
        await this.db.query(`
            INSERT INTO email_preferences (email, unsubscribed, unsubscribed_at)
            VALUES ($1, true, NOW())
            ON CONFLICT (email) DO UPDATE
            SET unsubscribed = true, unsubscribed_at = NOW()
        `, [event.email]);
        
        // Cancel active sequences
        await this.db.query(`
            UPDATE email_sequences 
            SET status = 'cancelled', cancelled_reason = 'unsubscribed'
            WHERE recipient_email = $1 AND status = 'active'
        `, [event.email]);
    }

    async handleSpamReport(event) {
        // Mark as spam reporter
        await this.db.query(`
            INSERT INTO email_preferences (email, spam_reporter, spam_reported_at)
            VALUES ($1, true, NOW())
            ON CONFLICT (email) DO UPDATE
            SET spam_reporter = true, spam_reported_at = NOW()
        `, [event.email]);
        
        // Cancel all sequences and prevent future emails
        await this.db.query(`
            UPDATE email_sequences 
            SET status = 'cancelled', cancelled_reason = 'spam_report'
            WHERE recipient_email = $1
        `, [event.email]);
    }
}

// Initialize database schema
const initSchema = `
CREATE TABLE IF NOT EXISTS email_sequences (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    user_id INTEGER REFERENCES users(id),
    sequence_name VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_reason TEXT,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_emails (
    id SERIAL PRIMARY KEY,
    sequence_id INTEGER REFERENCES email_sequences(id),
    template_name VARCHAR(100) NOT NULL,
    subject TEXT NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_activity_log (
    id SERIAL PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    template VARCHAR(100),
    subject TEXT,
    status VARCHAR(50),
    message_id VARCHAR(255),
    error_message TEXT,
    lead_id INTEGER,
    user_id INTEGER,
    opened_at TIMESTAMP,
    open_count INTEGER DEFAULT 0,
    clicked_at TIMESTAMP,
    click_count INTEGER DEFAULT 0,
    clicked_links JSONB DEFAULT '[]',
    bounce_type VARCHAR(50),
    bounce_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_preferences (
    email VARCHAR(255) PRIMARY KEY,
    unsubscribed BOOLEAN DEFAULT false,
    unsubscribed_at TIMESTAMP,
    spam_reporter BOOLEAN DEFAULT false,
    spam_reported_at TIMESTAMP,
    email_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_sequences_status ON email_sequences(status);
CREATE INDEX idx_scheduled_emails_pending ON scheduled_emails(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_email_activity_recipient ON email_activity_log(recipient);
CREATE INDEX idx_email_activity_message_id ON email_activity_log(message_id);
`;

module.exports = { EmailAutomationSystem, initSchema };