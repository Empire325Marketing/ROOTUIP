const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const crypto = require('crypto');
const axios = require('axios');
const Joi = require('joi');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// Email configuration
const emailTransporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'noreply@rootuip.com',
        pass: process.env.EMAIL_PASSWORD || 'demo_password'
    }
});

// Lead Generation Engine
class LeadGenerationEngine {
    constructor() {
        this.leadScores = new Map();
        this.emailSequences = new Map();
        this.initializeEngine();
    }

    async initializeEngine() {
        await this.setupDatabase();
        this.startEmailAutomation();
        this.startLeadScoring();
        console.log('Lead Generation Engine initialized');
    }

    // LEAD CAPTURE SYSTEM
    async captureROILead(leadData) {
        const leadId = crypto.randomUUID();
        const captureTime = new Date();
        
        try {
            // Validate and enrich lead data
            const enrichedLead = await this.enrichLeadData(leadData);
            
            // Calculate initial lead score
            const leadScore = await this.calculateLeadScore(enrichedLead);
            
            // Store in database
            const result = await db.query(`
                INSERT INTO leads (
                    lead_id, email, company, name, phone, website,
                    roi_calculation_data, company_size, annual_revenue,
                    pain_points, budget_range, timeline, source,
                    lead_score, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *
            `, [
                leadId, enrichedLead.email, enrichedLead.company, enrichedLead.name,
                enrichedLead.phone, enrichedLead.website, JSON.stringify(enrichedLead.roiData),
                enrichedLead.companySize, enrichedLead.annualRevenue, enrichedLead.painPoints,
                enrichedLead.budgetRange, enrichedLead.timeline, enrichedLead.source,
                leadScore, 'new', captureTime, captureTime
            ]);

            // Start email automation
            await this.triggerEmailSequence(leadId, 'roi_calculator_followup');
            
            // Create CRM record
            await this.createCRMRecord(result.rows[0]);
            
            // Track conversion event
            await this.trackConversionEvent(leadId, 'roi_calculator_completion', enrichedLead);
            
            return {
                leadId,
                leadScore,
                status: 'captured',
                nextAction: this.determineNextAction(leadScore, enrichedLead)
            };
            
        } catch (error) {
            console.error('Lead capture error:', error);
            throw error;
        }
    }

    async progressiveProfileLead(leadId, additionalData) {
        try {
            // Get current lead data
            const currentLead = await db.query('SELECT * FROM leads WHERE lead_id = $1', [leadId]);
            if (currentLead.rows.length === 0) {
                throw new Error('Lead not found');
            }

            const lead = currentLead.rows[0];
            
            // Merge new data
            const updatedData = { ...lead, ...additionalData };
            
            // Recalculate lead score with new information
            const newScore = await this.calculateLeadScore(updatedData);
            
            // Update database
            await db.query(`
                UPDATE leads SET
                    company_size = COALESCE($2, company_size),
                    annual_revenue = COALESCE($3, annual_revenue),
                    pain_points = COALESCE($4, pain_points),
                    budget_range = COALESCE($5, budget_range),
                    timeline = COALESCE($6, timeline),
                    decision_makers = COALESCE($7, decision_makers),
                    technical_requirements = COALESCE($8, technical_requirements),
                    lead_score = $9,
                    updated_at = NOW()
                WHERE lead_id = $1
            `, [
                leadId, additionalData.companySize, additionalData.annualRevenue,
                additionalData.painPoints, additionalData.budgetRange, additionalData.timeline,
                JSON.stringify(additionalData.decisionMakers), JSON.stringify(additionalData.technicalRequirements),
                newScore
            ]);

            // Update CRM record
            await this.updateCRMRecord(leadId, additionalData);
            
            // Trigger appropriate email sequence based on score change
            if (newScore > lead.lead_score + 20) {
                await this.triggerEmailSequence(leadId, 'high_value_prospect');
            }
            
            return {
                leadId,
                previousScore: lead.lead_score,
                newScore,
                scoreChange: newScore - lead.lead_score,
                qualification: this.getQualificationLevel(newScore)
            };
            
        } catch (error) {
            console.error('Progressive profiling error:', error);
            throw error;
        }
    }

    // LEAD QUALIFICATION ENGINE
    async calculateLeadScore(leadData) {
        let score = 0;
        const weights = {
            companySize: 25,
            revenue: 30,
            budget: 20,
            timeline: 15,
            painPoints: 10
        };

        // Company size scoring
        const sizeScores = {
            'enterprise': 100,
            'large': 80,
            'medium': 60,
            'small': 30,
            'startup': 10
        };
        score += (sizeScores[leadData.companySize] || 0) * weights.companySize / 100;

        // Revenue scoring
        if (leadData.annualRevenue) {
            const revenue = parseInt(leadData.annualRevenue.replace(/[^0-9]/g, ''));
            if (revenue >= 1000000000) score += weights.revenue; // $1B+
            else if (revenue >= 500000000) score += weights.revenue * 0.9; // $500M+
            else if (revenue >= 100000000) score += weights.revenue * 0.8; // $100M+
            else if (revenue >= 50000000) score += weights.revenue * 0.6; // $50M+
            else if (revenue >= 10000000) score += weights.revenue * 0.4; // $10M+
        }

        // Budget scoring
        const budgetScores = {
            '1000000+': 100,    // $1M+
            '500000-1000000': 90,
            '250000-500000': 80,
            '100000-250000': 60,
            '50000-100000': 40,
            '25000-50000': 20,
            'under-25000': 5
        };
        score += (budgetScores[leadData.budgetRange] || 0) * weights.budget / 100;

        // Timeline scoring
        const timelineScores = {
            'immediate': 100,
            '1-3-months': 90,
            '3-6-months': 70,
            '6-12-months': 50,
            '12+-months': 20,
            'no-timeline': 5
        };
        score += (timelineScores[leadData.timeline] || 0) * weights.timeline / 100;

        // Pain point scoring
        const painPointMultipliers = {
            'demurrage-costs': 2.0,
            'operational-inefficiency': 1.8,
            'compliance-issues': 1.6,
            'manual-processes': 1.4,
            'data-visibility': 1.2
        };
        
        if (leadData.painPoints && Array.isArray(leadData.painPoints)) {
            const painScore = leadData.painPoints.reduce((total, pain) => {
                return total + (painPointMultipliers[pain] || 1.0);
            }, 0);
            score += (painScore / leadData.painPoints.length) * weights.painPoints;
        }

        // Store score calculation details
        await this.storeScoreBreakdown(leadData.leadId || leadData.email, {
            totalScore: Math.round(score),
            breakdown: {
                companySize: (sizeScores[leadData.companySize] || 0) * weights.companySize / 100,
                revenue: 'calculated above',
                budget: (budgetScores[leadData.budgetRange] || 0) * weights.budget / 100,
                timeline: (timelineScores[leadData.timeline] || 0) * weights.timeline / 100,
                painPoints: 'calculated above'
            }
        });

        return Math.round(score);
    }

    getQualificationLevel(score) {
        if (score >= 80) return 'hot';
        if (score >= 60) return 'warm';
        if (score >= 40) return 'qualified';
        if (score >= 20) return 'nurture';
        return 'cold';
    }

    // DEMO BOOKING SYSTEM
    async bookDemo(leadId, demoData) {
        const demoId = crypto.randomUUID();
        
        try {
            // Validate demo booking data
            const schema = Joi.object({
                preferredDate: Joi.date().min('now').required(),
                preferredTime: Joi.string().required(),
                attendees: Joi.array().items(Joi.object({
                    name: Joi.string().required(),
                    email: Joi.string().email().required(),
                    role: Joi.string().required()
                })).required(),
                focusAreas: Joi.array().items(Joi.string()),
                specialRequests: Joi.string().allow('')
            });

            const { error, value } = schema.validate(demoData);
            if (error) throw new Error(error.details[0].message);

            // Check calendar availability
            const isAvailable = await this.checkCalendarAvailability(value.preferredDate, value.preferredTime);
            if (!isAvailable) {
                throw new Error('Selected time slot is not available');
            }

            // Create demo booking
            const result = await db.query(`
                INSERT INTO demo_bookings (
                    demo_id, lead_id, scheduled_date, scheduled_time,
                    attendees, focus_areas, special_requests,
                    status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                RETURNING *
            `, [
                demoId, leadId, value.preferredDate, value.preferredTime,
                JSON.stringify(value.attendees), value.focusAreas,
                value.specialRequests, 'scheduled'
            ]);

            // Update lead status
            await db.query(`
                UPDATE leads SET 
                    status = 'demo_scheduled',
                    demo_scheduled_date = $2,
                    updated_at = NOW()
                WHERE lead_id = $1
            `, [leadId, value.preferredDate]);

            // Send confirmation emails
            await this.sendDemoConfirmation(leadId, result.rows[0]);
            
            // Create calendar event
            await this.createCalendarEvent(result.rows[0]);
            
            // Trigger demo preparation sequence
            await this.triggerEmailSequence(leadId, 'demo_preparation');
            
            // Update CRM with demo info
            await this.updateCRMRecord(leadId, { demoScheduled: true, demoDate: value.preferredDate });

            return {
                demoId,
                status: 'scheduled',
                confirmationSent: true,
                calendarEvent: 'created'
            };
            
        } catch (error) {
            console.error('Demo booking error:', error);
            throw error;
        }
    }

    // EMAIL AUTOMATION SEQUENCES
    async triggerEmailSequence(leadId, sequenceType) {
        try {
            const lead = await db.query('SELECT * FROM leads WHERE lead_id = $1', [leadId]);
            if (lead.rows.length === 0) return;

            const leadData = lead.rows[0];
            const sequences = this.getEmailSequences();
            const sequence = sequences[sequenceType];

            if (!sequence) {
                console.warn(`Email sequence '${sequenceType}' not found`);
                return;
            }

            // Schedule all emails in the sequence
            for (let i = 0; i < sequence.length; i++) {
                const email = sequence[i];
                const sendDate = new Date();
                sendDate.setDate(sendDate.getDate() + email.delayDays);

                await db.query(`
                    INSERT INTO email_queue (
                        email_id, lead_id, sequence_type, email_index,
                        subject, content, send_date, status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                `, [
                    crypto.randomUUID(), leadId, sequenceType, i,
                    this.personalize(email.subject, leadData),
                    this.personalize(email.content, leadData),
                    sendDate, 'scheduled'
                ]);
            }

            console.log(`Triggered ${sequenceType} sequence for lead ${leadId}`);
        } catch (error) {
            console.error('Email sequence trigger error:', error);
        }
    }

    getEmailSequences() {
        return {
            roi_calculator_followup: [
                {
                    delayDays: 0,
                    subject: "Your ROI calculation results - {{company}} could save ${{estimatedSavings}}",
                    content: `Hi {{name}},

Thank you for using our ROI calculator. Based on your inputs, {{company}} could potentially save ${{estimatedSavings}} annually by implementing ROOTUIP's container intelligence platform.

Here's what this means for your business:
• Reduce demurrage costs by 94%
• Improve operational efficiency by 67%
• Enhance supply chain visibility by 85%

I'd love to show you exactly how we can achieve these results for {{company}}. 

Would you be available for a 30-minute demo this week?

Best regards,
Enterprise Sales Team
ROOTUIP`
                },
                {
                    delayDays: 3,
                    subject: "Case Study: How {{similarCompany}} saved $2.3M with ROOTUIP",
                    content: `Hi {{name}},

I wanted to share a relevant case study with you. {{similarCompany}}, a company similar to {{company}}, implemented ROOTUIP and achieved:

• $2.3M in annual savings
• 94% reduction in demurrage costs  
• 6-month ROI

The key was our AI-powered predictive analytics that prevented costly delays before they occurred.

Would you like to see how this could work for {{company}}?

Best regards,
Enterprise Sales Team`
                },
                {
                    delayDays: 7,
                    subject: "Last chance: Book your personalized demo",
                    content: `Hi {{name}},

I don't want you to miss out on the savings opportunity we identified for {{company}}.

Based on your ROI calculation, you're potentially losing ${{monthlyLoss}} every month without a solution like ROOTUIP.

I have a few demo slots available this week. It only takes 30 minutes to show you exactly how we can achieve these savings.

Shall we schedule it?

Best regards,
Enterprise Sales Team`
                }
            ],
            demo_preparation: [
                {
                    delayDays: 0,
                    subject: "Demo confirmed: What to expect from your ROOTUIP session",
                    content: `Hi {{name}},

Your demo is confirmed for {{demoDate}} at {{demoTime}}.

To make the most of our time together, I'll be showing you:
• Live container tracking in action
• AI-powered demurrage prevention
• Real-time analytics dashboard
• Custom ROI scenario for {{company}}

Please have these ready:
• Your current container volume data
• Specific pain points you want addressed
• Key stakeholders who should be involved

Looking forward to our session!

Best regards,
{{salesRep}}`
                },
                {
                    delayDays: 1,
                    subject: "Demo tomorrow: Pre-demo checklist",
                    content: `Hi {{name}},

Just a friendly reminder that your ROOTUIP demo is tomorrow at {{demoTime}}.

Quick checklist:
✓ Calendar invite accepted
✓ Attendees notified
✓ Questions prepared
✓ Current pain points documented

The demo link: {{demoLink}}

See you tomorrow!

Best regards,
{{salesRep}}`
                }
            ],
            high_value_prospect: [
                {
                    delayDays: 0,
                    subject: "Exclusive: Enterprise package designed for {{company}}",
                    content: `Hi {{name}},

Based on your profile and requirements, I've prepared an exclusive enterprise package specifically for {{company}}.

This includes:
• Dedicated implementation team
• Custom integration support
• 24/7 enterprise support
• Advanced analytics and reporting
• Compliance certifications

Given {{company}}'s scale and requirements, I believe this warrants a direct conversation with our enterprise team.

Would you be available for a strategic discussion this week?

Best regards,
Enterprise Sales Director`
                }
            ]
        };
    }

    personalize(template, leadData) {
        return template
            .replace(/\{\{name\}\}/g, leadData.name || 'there')
            .replace(/\{\{company\}\}/g, leadData.company || 'your company')
            .replace(/\{\{estimatedSavings\}\}/g, this.formatCurrency(leadData.roi_calculation_data?.estimatedSavings || 0))
            .replace(/\{\{monthlyLoss\}\}/g, this.formatCurrency((leadData.roi_calculation_data?.estimatedSavings || 0) / 12))
            .replace(/\{\{demoDate\}\}/g, leadData.demo_scheduled_date ? new Date(leadData.demo_scheduled_date).toLocaleDateString() : 'TBD')
            .replace(/\{\{demoTime\}\}/g, leadData.demo_scheduled_time || 'TBD')
            .replace(/\{\{salesRep\}\}/g, leadData.assigned_sales_rep || 'Sales Team')
            .replace(/\{\{similarCompany\}\}/g, this.getSimilarCompany(leadData.company_size));
    }

    // FORM ABANDONMENT RECOVERY
    async trackFormAbandonment(formData) {
        const abandonmentId = crypto.randomUUID();
        
        try {
            await db.query(`
                INSERT INTO form_abandonments (
                    abandonment_id, email, form_type, completed_fields,
                    abandonment_stage, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, [
                abandonmentId, formData.email, formData.formType,
                JSON.stringify(formData.completedFields), formData.stage
            ]);

            // Trigger recovery email after 1 hour
            setTimeout(() => {
                this.sendAbandonmentRecoveryEmail(abandonmentId);
            }, 3600000); // 1 hour

            return { abandonmentId, recoveryScheduled: true };
        } catch (error) {
            console.error('Form abandonment tracking error:', error);
        }
    }

    async sendAbandonmentRecoveryEmail(abandonmentId) {
        try {
            const abandonment = await db.query(
                'SELECT * FROM form_abandonments WHERE abandonment_id = $1',
                [abandonmentId]
            );

            if (abandonment.rows.length === 0) return;

            const data = abandonment.rows[0];
            const completionLink = `https://app.rootuip.com/complete-assessment?token=${abandonmentId}`;

            const emailContent = `
                Hi there,

                I noticed you started our ROI calculator but didn't get a chance to finish.

                It only takes 2 more minutes to complete, and you'll get:
                • Personalized savings estimate
                • Industry benchmark comparison
                • Custom recommendations

                Complete your assessment: ${completionLink}

                Best regards,
                ROOTUIP Team
            `;

            await emailTransporter.sendMail({
                from: 'noreply@rootuip.com',
                to: data.email,
                subject: 'Complete your ROI assessment - 2 minutes left',
                text: emailContent
            });

            await db.query(
                'UPDATE form_abandonments SET recovery_sent = true WHERE abandonment_id = $1',
                [abandonmentId]
            );
        } catch (error) {
            console.error('Abandonment recovery email error:', error);
        }
    }

    // DATA ENRICHMENT
    async enrichLeadData(leadData) {
        try {
            // Company enrichment via external APIs
            const companyData = await this.enrichCompanyData(leadData.company, leadData.website);
            
            return {
                ...leadData,
                ...companyData,
                enrichmentDate: new Date(),
                enrichmentSource: 'automated'
            };
        } catch (error) {
            console.error('Lead enrichment error:', error);
            return leadData;
        }
    }

    async enrichCompanyData(companyName, website) {
        // Simulate company enrichment
        // In production, integrate with Clearbit, ZoomInfo, etc.
        const enrichmentData = {
            industry: 'Logistics & Transportation',
            employeeCount: this.estimateEmployeeCount(companyName),
            technologies: ['Microsoft Office 365', 'Salesforce', 'Oracle'],
            socialProfiles: {
                linkedin: `https://linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
                twitter: `@${companyName.toLowerCase().replace(/\s+/g, '')}`
            }
        };

        return enrichmentData;
    }

    estimateEmployeeCount(companyName) {
        // Simple heuristic for demo purposes
        const indicators = companyName.toLowerCase();
        if (indicators.includes('international') || indicators.includes('global')) return '10000+';
        if (indicators.includes('corp') || indicators.includes('corporation')) return '1000-10000';
        if (indicators.includes('group') || indicators.includes('holdings')) return '500-1000';
        return '100-500';
    }

    // UTILITY METHODS
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    getSimilarCompany(companySize) {
        const examples = {
            'enterprise': 'Maersk',
            'large': 'Hapag-Lloyd',
            'medium': 'OOCL',
            'small': 'Regional Logistics Co'
        };
        return examples[companySize] || 'Similar Company';
    }

    determineNextAction(leadScore, leadData) {
        if (leadScore >= 80) return 'immediate_sales_contact';
        if (leadScore >= 60) return 'demo_booking';
        if (leadScore >= 40) return 'nurture_sequence';
        return 'educational_content';
    }

    async checkCalendarAvailability(date, time) {
        // Simulate calendar availability check
        // In production, integrate with Google Calendar, Calendly, etc.
        return true;
    }

    async createCalendarEvent(demoData) {
        // Simulate calendar event creation
        console.log(`Calendar event created for demo ${demoData.demo_id}`);
        return { eventId: crypto.randomUUID(), status: 'created' };
    }

    async sendDemoConfirmation(leadId, demoData) {
        try {
            const lead = await db.query('SELECT * FROM leads WHERE lead_id = $1', [leadId]);
            if (lead.rows.length === 0) return;

            const leadInfo = lead.rows[0];
            
            await emailTransporter.sendMail({
                from: 'demos@rootuip.com',
                to: leadInfo.email,
                subject: `Demo Confirmed: ${new Date(demoData.scheduled_date).toLocaleDateString()}`,
                html: this.getDemoConfirmationTemplate(leadInfo, demoData)
            });
        } catch (error) {
            console.error('Demo confirmation email error:', error);
        }
    }

    getDemoConfirmationTemplate(leadInfo, demoData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c5282;">Demo Confirmed!</h2>
                
                <p>Hi ${leadInfo.name},</p>
                
                <p>Your ROOTUIP demo has been confirmed for:</p>
                
                <div style="background: #f7fafc; padding: 20px; border-left: 4px solid #4299e1; margin: 20px 0;">
                    <strong>Date:</strong> ${new Date(demoData.scheduled_date).toLocaleDateString()}<br>
                    <strong>Time:</strong> ${demoData.scheduled_time}<br>
                    <strong>Duration:</strong> 30 minutes
                </div>
                
                <p>We'll be covering:</p>
                <ul>
                    <li>Live container tracking demonstration</li>
                    <li>AI-powered demurrage prevention</li>
                    <li>Custom ROI scenario for ${leadInfo.company}</li>
                    <li>Q&A session</li>
                </ul>
                
                <p>Looking forward to showing you how ROOTUIP can transform your logistics operations!</p>
                
                <p>Best regards,<br>
                ROOTUIP Demo Team</p>
            </div>
        `;
    }

    async storeScoreBreakdown(identifier, scoreData) {
        try {
            await db.query(`
                INSERT INTO lead_scoring_history (
                    identifier, score_data, created_at
                ) VALUES ($1, $2, NOW())
            `, [identifier, JSON.stringify(scoreData)]);
        } catch (error) {
            console.error('Score storage error:', error);
        }
    }

    // EMAIL AUTOMATION PROCESSOR
    startEmailAutomation() {
        // Process email queue every minute
        cron.schedule('* * * * *', async () => {
            await this.processEmailQueue();
        });
    }

    async processEmailQueue() {
        try {
            const emails = await db.query(`
                SELECT * FROM email_queue 
                WHERE status = 'scheduled' 
                AND send_date <= NOW()
                ORDER BY send_date ASC
                LIMIT 10
            `);

            for (const email of emails.rows) {
                await this.sendQueuedEmail(email);
            }
        } catch (error) {
            console.error('Email queue processing error:', error);
        }
    }

    async sendQueuedEmail(emailData) {
        try {
            const lead = await db.query('SELECT * FROM leads WHERE lead_id = $1', [emailData.lead_id]);
            if (lead.rows.length === 0) return;

            const leadInfo = lead.rows[0];

            await emailTransporter.sendMail({
                from: 'automation@rootuip.com',
                to: leadInfo.email,
                subject: emailData.subject,
                text: emailData.content
            });

            await db.query(
                'UPDATE email_queue SET status = $1, sent_at = NOW() WHERE email_id = $2',
                ['sent', emailData.email_id]
            );

            // Track email engagement
            await this.trackEmailSent(emailData.email_id, emailData.lead_id);

        } catch (error) {
            console.error('Email sending error:', error);
            await db.query(
                'UPDATE email_queue SET status = $1, error_message = $2 WHERE email_id = $3',
                ['failed', error.message, emailData.email_id]
            );
        }
    }

    async trackEmailSent(emailId, leadId) {
        await db.query(`
            INSERT INTO email_engagement (
                email_id, lead_id, event_type, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [emailId, leadId, 'sent']);
    }

    // LEAD SCORING PROCESSOR
    startLeadScoring() {
        // Recalculate lead scores every hour
        cron.schedule('0 * * * *', async () => {
            await this.recalculateLeadScores();
        });
    }

    async recalculateLeadScores() {
        try {
            console.log('Recalculating lead scores...');
            
            const leads = await db.query(`
                SELECT * FROM leads 
                WHERE status IN ('new', 'qualified', 'nurture')
                AND updated_at > NOW() - INTERVAL '7 days'
            `);

            for (const lead of leads.rows) {
                const newScore = await this.calculateLeadScore(lead);
                
                if (Math.abs(newScore - lead.lead_score) >= 10) {
                    await db.query(
                        'UPDATE leads SET lead_score = $1, updated_at = NOW() WHERE lead_id = $2',
                        [newScore, lead.lead_id]
                    );
                    
                    // Trigger appropriate actions based on score change
                    await this.handleScoreChange(lead.lead_id, lead.lead_score, newScore);
                }
            }
            
            console.log(`Recalculated ${leads.rows.length} lead scores`);
        } catch (error) {
            console.error('Lead scoring error:', error);
        }
    }

    async handleScoreChange(leadId, oldScore, newScore) {
        const oldLevel = this.getQualificationLevel(oldScore);
        const newLevel = this.getQualificationLevel(newScore);
        
        if (oldLevel !== newLevel) {
            // Update lead qualification status
            await db.query(
                'UPDATE leads SET qualification_level = $1 WHERE lead_id = $2',
                [newLevel, leadId]
            );
            
            // Trigger appropriate email sequence for new qualification level
            if (newLevel === 'hot' && oldLevel !== 'hot') {
                await this.triggerEmailSequence(leadId, 'high_value_prospect');
            }
        }
    }

    // DATABASE SETUP
    async setupDatabase() {
        try {
            // Leads table
            await db.query(`
                CREATE TABLE IF NOT EXISTS leads (
                    id SERIAL PRIMARY KEY,
                    lead_id UUID UNIQUE,
                    email VARCHAR(255) UNIQUE,
                    company VARCHAR(255),
                    name VARCHAR(255),
                    phone VARCHAR(50),
                    website VARCHAR(255),
                    roi_calculation_data JSONB,
                    company_size VARCHAR(50),
                    annual_revenue VARCHAR(100),
                    pain_points TEXT[],
                    budget_range VARCHAR(50),
                    timeline VARCHAR(50),
                    decision_makers JSONB,
                    technical_requirements JSONB,
                    source VARCHAR(100),
                    lead_score INTEGER DEFAULT 0,
                    qualification_level VARCHAR(20),
                    status VARCHAR(50) DEFAULT 'new',
                    assigned_sales_rep VARCHAR(255),
                    demo_scheduled_date DATE,
                    demo_scheduled_time VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Demo bookings table
            await db.query(`
                CREATE TABLE IF NOT EXISTS demo_bookings (
                    id SERIAL PRIMARY KEY,
                    demo_id UUID UNIQUE,
                    lead_id UUID REFERENCES leads(lead_id),
                    scheduled_date DATE,
                    scheduled_time VARCHAR(20),
                    attendees JSONB,
                    focus_areas TEXT[],
                    special_requests TEXT,
                    status VARCHAR(50) DEFAULT 'scheduled',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Email queue table
            await db.query(`
                CREATE TABLE IF NOT EXISTS email_queue (
                    id SERIAL PRIMARY KEY,
                    email_id UUID UNIQUE,
                    lead_id UUID REFERENCES leads(lead_id),
                    sequence_type VARCHAR(100),
                    email_index INTEGER,
                    subject TEXT,
                    content TEXT,
                    send_date TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'scheduled',
                    sent_at TIMESTAMP,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Form abandonment tracking
            await db.query(`
                CREATE TABLE IF NOT EXISTS form_abandonments (
                    id SERIAL PRIMARY KEY,
                    abandonment_id UUID UNIQUE,
                    email VARCHAR(255),
                    form_type VARCHAR(100),
                    completed_fields JSONB,
                    abandonment_stage VARCHAR(100),
                    recovery_sent BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Email engagement tracking
            await db.query(`
                CREATE TABLE IF NOT EXISTS email_engagement (
                    id SERIAL PRIMARY KEY,
                    email_id UUID,
                    lead_id UUID,
                    event_type VARCHAR(50),
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Lead scoring history
            await db.query(`
                CREATE TABLE IF NOT EXISTS lead_scoring_history (
                    id SERIAL PRIMARY KEY,
                    identifier VARCHAR(255),
                    score_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
                CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC);
                CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
                CREATE INDEX IF NOT EXISTS idx_email_queue_send_date ON email_queue(send_date);
                CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
            `);

            console.log('Lead generation database setup complete');
        } catch (error) {
            console.error('Database setup error:', error);
        }
    }
}

// CRM Integration Methods (will be extended in next component)
LeadGenerationEngine.prototype.createCRMRecord = async function(leadData) {
    // Placeholder for CRM integration
    console.log(`Creating CRM record for lead: ${leadData.email}`);
    return { crmId: crypto.randomUUID(), status: 'created' };
};

LeadGenerationEngine.prototype.updateCRMRecord = async function(leadId, updateData) {
    // Placeholder for CRM update
    console.log(`Updating CRM record for lead: ${leadId}`);
    return { status: 'updated' };
};

// Initialize the engine
const leadEngine = new LeadGenerationEngine();

// API Endpoints
app.post('/api/leads/capture', async (req, res) => {
    try {
        const result = await leadEngine.captureROILead(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leads/:leadId/profile', async (req, res) => {
    try {
        const result = await leadEngine.progressiveProfileLead(req.params.leadId, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leads/:leadId/demo', async (req, res) => {
    try {
        const result = await leadEngine.bookDemo(req.params.leadId, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/leads/abandonment', async (req, res) => {
    try {
        const result = await leadEngine.trackFormAbandonment(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/leads/:leadId/score', async (req, res) => {
    try {
        const lead = await db.query('SELECT * FROM leads WHERE lead_id = $1', [req.params.leadId]);
        if (lead.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        const leadData = lead.rows[0];
        const scoreBreakdown = await leadEngine.calculateLeadScore(leadData);
        
        res.json({
            leadId: req.params.leadId,
            currentScore: leadData.lead_score,
            qualificationLevel: leadEngine.getQualificationLevel(leadData.lead_score),
            scoreBreakdown
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'lead-generation-engine',
        activeSequences: leadEngine.emailSequences.size
    });
});

const PORT = process.env.PORT || 3020;
app.listen(PORT, () => {
    console.log(`Lead Generation Engine running on port ${PORT}`);
});

module.exports = { app, leadEngine };