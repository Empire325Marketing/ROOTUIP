// ROOTUIP Sales Automation System
// Enterprise lead generation, email sequences, and CRM integration

const express = require('express');
const sgMail = require('@sendgrid/mail');
const hubspot = require('@hubspot/api-client');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

class SalesAutomationSystem {
    constructor() {
        this.app = express();
        this.port = process.env.SALES_PORT || 3011;
        
        // Initialize services
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/sales-automation.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Configure SendGrid
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        // Configure HubSpot
        this.hubspotClient = new hubspot.Client({
            accessToken: process.env.HUBSPOT_ACCESS_TOKEN
        });
        
        // Lead scoring configurations
        this.leadScoringRules = {
            companySize: {
                'fortune500': 40,
                'enterprise': 25,
                'midmarket': 15,
                'small': 5
            },
            industry: {
                'retail': 30,
                'manufacturing': 25,
                'automotive': 20,
                'pharmaceuticals': 15,
                'consumer_goods': 15,
                'electronics': 10,
                'other': 5
            },
            annualRevenue: {
                '50000000000+': 35,
                '10000000000-50000000000': 30,
                '1000000000-10000000000': 25,
                '100000000-1000000000': 15,
                '10000000-100000000': 10,
                '0-10000000': 5
            },
            containerVolume: {
                high: 25, // >10000 containers
                medium: 15, // 1000-10000 containers
                low: 5 // <1000 containers
            },
            roiThreshold: {
                high: 20, // >500% ROI
                medium: 10, // 200-500% ROI
                low: 5 // <200% ROI
            }
        };
        
        // Email templates
        this.emailTemplates = {
            roiCalculationWelcome: 'd-1234567890abcdef',
            followUp1: 'd-abcdef1234567890',
            followUp2: 'd-567890abcdef1234',
            demoInvitation: 'd-90abcdef12345678',
            casStudyShare: 'd-def1234567890abc'
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startAutomationEngine();
    }
    
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(express.json({ limit: '10mb' }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use(limiter);
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        
        // ROI calculation submission
        this.app.post('/api/roi-calculations', async (req, res) => {
            try {
                const leadData = req.body;
                
                // Validate required fields
                const requiredFields = ['companyName', 'contactEmail', 'contactName', 'industry', 'companySize', 'containerVolume'];
                const missing = requiredFields.filter(field => !leadData[field]);
                
                if (missing.length > 0) {
                    return res.status(400).json({
                        error: 'Missing required fields',
                        missing: missing
                    });
                }
                
                // Process the lead
                const result = await this.processROILead(leadData);
                
                res.json({
                    success: true,
                    leadId: result.leadId,
                    score: result.score,
                    qualified: result.qualified
                });
                
            } catch (error) {
                this.logger.error('ROI calculation processing failed:', error);
                res.status(500).json({
                    error: 'Failed to process ROI calculation',
                    message: error.message
                });
            }
        });
        
        // Demo booking
        this.app.post('/api/demo-requests', async (req, res) => {
            try {
                const demoData = req.body;
                const result = await this.processDemoRequest(demoData);
                
                res.json({
                    success: true,
                    demoId: result.demoId,
                    calendarLink: result.calendarLink
                });
                
            } catch (error) {
                this.logger.error('Demo request processing failed:', error);
                res.status(500).json({
                    error: 'Failed to process demo request',
                    message: error.message
                });
            }
        });
        
        // Lead qualification webhook (from external sources)
        this.app.post('/api/webhooks/lead-qualification', async (req, res) => {
            try {
                const leadData = req.body;
                await this.qualifyLead(leadData);
                res.json({ success: true });
            } catch (error) {
                this.logger.error('Lead qualification failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Sales analytics
        this.app.get('/api/sales/analytics', async (req, res) => {
            try {
                const analytics = await this.getSalesAnalytics();
                res.json(analytics);
            } catch (error) {
                this.logger.error('Sales analytics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Lead scoring API
        this.app.post('/api/leads/:leadId/score', async (req, res) => {
            try {
                const { leadId } = req.params;
                const score = await this.recalculateLeadScore(leadId);
                res.json({ leadId, score });
            } catch (error) {
                this.logger.error('Lead scoring failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Email campaign triggers
        this.app.post('/api/campaigns/trigger', async (req, res) => {
            try {
                const { campaignType, leadIds } = req.body;
                const result = await this.triggerEmailCampaign(campaignType, leadIds);
                res.json(result);
            } catch (error) {
                this.logger.error('Email campaign trigger failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async processROILead(leadData) {
        const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Calculate lead score
        const score = this.calculateLeadScore(leadData);
        const qualified = score >= 60; // Qualified if score >= 60
        
        // Store in database
        await this.storeLeadInDatabase(leadId, leadData, score, qualified);
        
        // Send to HubSpot
        await this.createHubSpotContact(leadData, score);
        
        // Trigger immediate welcome email
        await this.sendWelcomeEmail(leadData);
        
        // Schedule follow-up sequence
        await this.scheduleFollowUpSequence(leadId, leadData, qualified);
        
        // Notify sales team if highly qualified
        if (score >= 80) {
            await this.notifySalesTeam(leadData, score);
        }
        
        this.logger.info('ROI lead processed', {
            leadId,
            score,
            qualified,
            company: leadData.companyName,
            email: leadData.contactEmail
        });
        
        return { leadId, score, qualified };
    }
    
    calculateLeadScore(leadData) {
        let score = 0;
        
        // Company size scoring
        score += this.leadScoringRules.companySize[leadData.companySize] || 0;
        
        // Industry scoring
        score += this.leadScoringRules.industry[leadData.industry] || 0;
        
        // Revenue scoring
        if (leadData.annualRevenue) {
            score += this.leadScoringRules.annualRevenue[leadData.annualRevenue] || 0;
        }
        
        // Container volume scoring
        const volume = leadData.containerVolume || 0;
        if (volume > 10000) {
            score += this.leadScoringRules.containerVolume.high;
        } else if (volume > 1000) {
            score += this.leadScoringRules.containerVolume.medium;
        } else {
            score += this.leadScoringRules.containerVolume.low;
        }
        
        // ROI threshold scoring
        const roi = leadData.roiPercentage || 0;
        if (roi > 500) {
            score += this.leadScoringRules.roiThreshold.high;
        } else if (roi > 200) {
            score += this.leadScoringRules.roiThreshold.medium;
        } else {
            score += this.leadScoringRules.roiThreshold.low;
        }
        
        // Job title boost
        const title = leadData.jobTitle?.toLowerCase() || '';
        if (title.includes('vp') || title.includes('director') || title.includes('chief')) {
            score += 15;
        } else if (title.includes('manager')) {
            score += 10;
        }
        
        // Email domain verification
        if (leadData.contactEmail && !this.isPersonalEmail(leadData.contactEmail)) {
            score += 10;
        }
        
        return Math.min(score, 100); // Cap at 100
    }
    
    isPersonalEmail(email) {
        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        return personalDomains.includes(domain);
    }
    
    async storeLeadInDatabase(leadId, leadData, score, qualified) {
        const query = `
            INSERT INTO sales_leads (
                lead_id, company_name, contact_name, contact_email, contact_phone,
                job_title, industry, company_size, annual_revenue, container_volume,
                current_charges, total_savings, roi_percentage, lead_score,
                qualified, source, created_at, lead_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), $17)
        `;
        
        await this.db.query(query, [
            leadId,
            leadData.companyName,
            leadData.contactName,
            leadData.contactEmail,
            leadData.contactPhone,
            leadData.jobTitle,
            leadData.industry,
            leadData.companySize,
            leadData.annualRevenue,
            leadData.containerVolume,
            leadData.currentCharges,
            leadData.totalSavings,
            leadData.roiPercentage,
            score,
            qualified,
            'roi_calculator',
            JSON.stringify(leadData)
        ]);
    }
    
    async createHubSpotContact(leadData, score) {
        try {
            const properties = {
                email: leadData.contactEmail,
                firstname: leadData.contactName.split(' ')[0],
                lastname: leadData.contactName.split(' ').slice(1).join(' '),
                company: leadData.companyName,
                jobtitle: leadData.jobTitle,
                phone: leadData.contactPhone,
                industry: leadData.industry,
                annual_container_volume: leadData.containerVolume?.toString(),
                estimated_annual_savings: leadData.totalSavings?.toString(),
                roi_percentage: leadData.roiPercentage?.toString(),
                lead_score: score.toString(),
                lead_source: 'ROOTUIP ROI Calculator',
                company_size: leadData.companySize,
                lifecyclestage: score >= 60 ? 'marketingqualifiedlead' : 'lead'
            };
            
            const SimplePublicObjectInput = {
                properties: properties
            };
            
            const response = await this.hubspotClient.crm.contacts.basicApi.create(SimplePublicObjectInput);
            
            this.logger.info('HubSpot contact created', {
                contactId: response.id,
                email: leadData.contactEmail
            });
            
            return response.id;
            
        } catch (error) {
            this.logger.error('HubSpot contact creation failed:', error);
            // Don't throw - this shouldn't stop the lead processing
        }
    }
    
    async sendWelcomeEmail(leadData) {
        try {
            const msg = {
                to: leadData.contactEmail,
                from: {
                    email: 'sales@rootuip.com',
                    name: 'ROOTUIP Sales Team'
                },
                templateId: this.emailTemplates.roiCalculationWelcome,
                dynamicTemplateData: {
                    first_name: leadData.contactName.split(' ')[0],
                    company_name: leadData.companyName,
                    total_savings: this.formatCurrency(leadData.totalSavings),
                    roi_percentage: leadData.roiPercentage,
                    container_volume: leadData.containerVolume?.toLocaleString(),
                    industry: leadData.industry,
                    demo_link: `https://rootuip.com/schedule-demo?lead=${leadData.contactEmail}`
                }
            };
            
            await sgMail.send(msg);
            
            this.logger.info('Welcome email sent', {
                email: leadData.contactEmail,
                template: 'roiCalculationWelcome'
            });
            
        } catch (error) {
            this.logger.error('Welcome email failed:', error);
        }
    }
    
    async scheduleFollowUpSequence(leadId, leadData, qualified) {
        const sequences = qualified ? 
            this.getQualifiedLeadSequence() : 
            this.getStandardLeadSequence();
        
        for (const step of sequences) {
            await this.scheduleEmail(leadId, leadData, step);
        }
    }
    
    getQualifiedLeadSequence() {
        return [
            {
                delay: 1, // 1 day
                template: 'followUp1',
                subject: 'Your ROOTUIP savings analysis + next steps'
            },
            {
                delay: 3, // 3 days
                template: 'demoInvitation',
                subject: 'Ready for your personalized ROOTUIP demo?'
            },
            {
                delay: 7, // 7 days
                template: 'casStudyShare',
                subject: 'How [Similar Company] saved $4.2M with ROOTUIP'
            }
        ];
    }
    
    getStandardLeadSequence() {
        return [
            {
                delay: 2, // 2 days
                template: 'followUp1',
                subject: 'Questions about your ROI calculation?'
            },
            {
                delay: 5, // 5 days
                template: 'followUp2',
                subject: 'Still interested in reducing D&D costs?'
            },
            {
                delay: 10, // 10 days
                template: 'casStudyShare',
                subject: 'See how Fortune 500 companies use ROOTUIP'
            }
        ];
    }
    
    async scheduleEmail(leadId, leadData, step) {
        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + step.delay);
        
        await this.redis.zadd(
            'scheduled_emails',
            sendAt.getTime(),
            JSON.stringify({
                leadId,
                leadData,
                template: step.template,
                subject: step.subject,
                scheduledFor: sendAt.toISOString()
            })
        );
    }
    
    async notifySalesTeam(leadData, score) {
        // Send Slack notification
        if (process.env.SLACK_WEBHOOK) {
            await this.sendSlackNotification(leadData, score);
        }
        
        // Send email to sales team
        const msg = {
            to: 'sales-team@rootuip.com',
            from: 'alerts@rootuip.com',
            subject: `🚨 High-Value Lead Alert: ${leadData.companyName}`,
            html: `
                <h2>High-Value Lead Alert</h2>
                <p><strong>Score:</strong> ${score}/100</p>
                <p><strong>Company:</strong> ${leadData.companyName}</p>
                <p><strong>Contact:</strong> ${leadData.contactName} (${leadData.jobTitle})</p>
                <p><strong>Email:</strong> ${leadData.contactEmail}</p>
                <p><strong>Industry:</strong> ${leadData.industry}</p>
                <p><strong>Container Volume:</strong> ${leadData.containerVolume?.toLocaleString()}</p>
                <p><strong>Estimated Savings:</strong> ${this.formatCurrency(leadData.totalSavings)}</p>
                <p><strong>ROI:</strong> ${leadData.roiPercentage}%</p>
                
                <p><a href="https://app.hubspot.com/contacts/search?email=${leadData.contactEmail}">View in HubSpot</a></p>
            `
        };
        
        await sgMail.send(msg);
    }
    
    async sendSlackNotification(leadData, score) {
        const payload = {
            text: '🚨 High-Value Lead Alert',
            attachments: [{
                color: 'good',
                fields: [
                    { title: 'Company', value: leadData.companyName, short: true },
                    { title: 'Score', value: `${score}/100`, short: true },
                    { title: 'Contact', value: `${leadData.contactName} (${leadData.jobTitle})`, short: true },
                    { title: 'Email', value: leadData.contactEmail, short: true },
                    { title: 'Savings', value: this.formatCurrency(leadData.totalSavings), short: true },
                    { title: 'ROI', value: `${leadData.roiPercentage}%`, short: true }
                ],
                timestamp: Math.floor(Date.now() / 1000)
            }]
        };
        
        await fetch(process.env.SLACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }
    
    startAutomationEngine() {
        // Process scheduled emails every minute
        setInterval(async () => {
            await this.processScheduledEmails();
        }, 60000);
        
        // Lead scoring refresh every hour
        setInterval(async () => {
            await this.refreshLeadScores();
        }, 3600000);
        
        this.logger.info('Sales automation engine started');
    }
    
    async processScheduledEmails() {
        try {
            const now = Date.now();
            const scheduledEmails = await this.redis.zrangebyscore('scheduled_emails', 0, now);
            
            for (const emailData of scheduledEmails) {
                try {
                    const email = JSON.parse(emailData);
                    await this.sendScheduledEmail(email);
                    
                    // Remove from schedule
                    await this.redis.zrem('scheduled_emails', emailData);
                    
                } catch (error) {
                    this.logger.error('Failed to process scheduled email:', error);
                }
            }
            
        } catch (error) {
            this.logger.error('Scheduled email processing failed:', error);
        }
    }
    
    async sendScheduledEmail(emailConfig) {
        const { leadData, template, subject } = emailConfig;
        
        const msg = {
            to: leadData.contactEmail,
            from: {
                email: 'sales@rootuip.com',
                name: 'ROOTUIP Sales Team'
            },
            templateId: this.emailTemplates[template],
            dynamicTemplateData: {
                first_name: leadData.contactName.split(' ')[0],
                company_name: leadData.companyName,
                total_savings: this.formatCurrency(leadData.totalSavings),
                roi_percentage: leadData.roiPercentage,
                demo_link: `https://rootuip.com/schedule-demo?lead=${leadData.contactEmail}`,
                case_study_link: `https://rootuip.com/case-studies?industry=${leadData.industry}`
            }
        };
        
        await sgMail.send(msg);
        
        this.logger.info('Scheduled email sent', {
            email: leadData.contactEmail,
            template
        });
    }
    
    async refreshLeadScores() {
        try {
            const leads = await this.db.query(`
                SELECT lead_id, lead_data 
                FROM sales_leads 
                WHERE created_at > NOW() - INTERVAL '30 days'
                AND status = 'active'
            `);
            
            for (const lead of leads.rows) {
                const leadData = JSON.parse(lead.lead_data);
                const newScore = this.calculateLeadScore(leadData);
                
                await this.db.query(
                    'UPDATE sales_leads SET lead_score = $1 WHERE lead_id = $2',
                    [newScore, lead.lead_id]
                );
            }
            
            this.logger.info(`Refreshed scores for ${leads.rows.length} leads`);
            
        } catch (error) {
            this.logger.error('Lead score refresh failed:', error);
        }
    }
    
    async getSalesAnalytics() {
        const analytics = {};
        
        // Lead volume metrics
        const leadVolumeQuery = `
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as total_leads,
                COUNT(CASE WHEN qualified THEN 1 END) as qualified_leads,
                AVG(lead_score) as avg_score
            FROM sales_leads 
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date DESC
        `;
        
        const leadVolume = await this.db.query(leadVolumeQuery);
        analytics.leadVolume = leadVolume.rows;
        
        // Industry breakdown
        const industryQuery = `
            SELECT 
                industry,
                COUNT(*) as count,
                AVG(lead_score) as avg_score,
                AVG(total_savings) as avg_savings
            FROM sales_leads 
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY industry
            ORDER BY count DESC
        `;
        
        const industry = await this.db.query(industryQuery);
        analytics.industryBreakdown = industry.rows;
        
        // Conversion funnel
        const funnelQuery = `
            SELECT 
                COUNT(*) as total_leads,
                COUNT(CASE WHEN qualified THEN 1 END) as qualified_leads,
                COUNT(CASE WHEN demo_scheduled THEN 1 END) as demo_scheduled,
                COUNT(CASE WHEN status = 'customer' THEN 1 END) as customers
            FROM sales_leads 
            WHERE created_at > NOW() - INTERVAL '30 days'
        `;
        
        const funnel = await this.db.query(funnelQuery);
        analytics.conversionFunnel = funnel.rows[0];
        
        // Top performing sources
        const sourceQuery = `
            SELECT 
                source,
                COUNT(*) as leads,
                AVG(lead_score) as avg_score
            FROM sales_leads 
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY source
            ORDER BY leads DESC
        `;
        
        const sources = await this.db.query(sourceQuery);
        analytics.leadSources = sources.rows;
        
        return analytics;
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }
    
    start() {
        this.app.listen(this.port, () => {
            this.logger.info(`Sales Automation System running on port ${this.port}`);
            console.log(`🎯 ROOTUIP Sales Automation System`);
            console.log(`   Port: ${this.port}`);
            console.log(`   SendGrid: ${process.env.SENDGRID_API_KEY ? 'Configured' : 'Not configured'}`);
            console.log(`   HubSpot: ${process.env.HUBSPOT_ACCESS_TOKEN ? 'Configured' : 'Not configured'}`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down sales automation system...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Create sales_leads table if it doesn't exist
const createSalesLeadsTable = `
    CREATE TABLE IF NOT EXISTS sales_leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id VARCHAR(100) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_phone VARCHAR(50),
        job_title VARCHAR(150),
        industry VARCHAR(100),
        company_size VARCHAR(50),
        annual_revenue VARCHAR(100),
        container_volume INTEGER,
        current_charges DECIMAL(15,2),
        total_savings DECIMAL(15,2),
        roi_percentage DECIMAL(8,2),
        lead_score INTEGER DEFAULT 0,
        qualified BOOLEAN DEFAULT false,
        demo_scheduled BOOLEAN DEFAULT false,
        demo_completed BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'active',
        source VARCHAR(100),
        hubspot_contact_id VARCHAR(50),
        last_contact_date TIMESTAMP WITH TIME ZONE,
        next_followup_date TIMESTAMP WITH TIME ZONE,
        lead_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_sales_leads_email ON sales_leads(contact_email);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_score ON sales_leads(lead_score);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_qualified ON sales_leads(qualified);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_created ON sales_leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON sales_leads(status);
`;

// Start server if called directly
if (require.main === module) {
    const salesSystem = new SalesAutomationSystem();
    
    // Initialize database schema
    salesSystem.db.query(createSalesLeadsTable).then(() => {
        salesSystem.start();
    }).catch(error => {
        console.error('Failed to initialize sales automation system:', error);
        process.exit(1);
    });
}

module.exports = SalesAutomationSystem;