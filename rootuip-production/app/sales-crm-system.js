/**
 * ROOTUIP Sales CRM System
 * Lead capture, qualification, and pipeline management
 */

const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');

class SalesCRMSystem {
    constructor(config = {}) {
        this.app = express();
        this.port = config.port || 3010;
        
        // Database connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rootuip_crm',
            max: 10
        });
        
        // Email configuration
        this.emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || 'sales@rootuip.com',
                pass: process.env.SMTP_PASS
            }
        });
        
        // CRM integrations
        this.integrations = {
            salesforce: {
                enabled: !!process.env.SALESFORCE_TOKEN,
                token: process.env.SALESFORCE_TOKEN,
                instance: process.env.SALESFORCE_INSTANCE
            },
            hubspot: {
                enabled: !!process.env.HUBSPOT_API_KEY,
                apiKey: process.env.HUBSPOT_API_KEY
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initDatabase();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static('public'));
        
        // CORS for API access
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });
    }

    setupRoutes() {
        // Landing page
        this.app.get('/', (req, res) => {
            res.sendFile(__dirname + '/landing-page.html');
        });
        
        // ROI Calculator
        this.app.get('/roi-calculator', (req, res) => {
            res.sendFile(__dirname + '/roi-calculator.html');
        });
        
        // ROI Calculator GUI (alternative endpoint)
        this.app.get('/roi-calculator-gui', (req, res) => {
            res.sendFile(__dirname + '/roi-calculator-gui.html');
        });
        
        // Lead capture endpoint
        this.app.post('/api/leads', async (req, res) => {
            try {
                const lead = await this.captureLead(req.body);
                res.json({ success: true, leadId: lead.id });
            } catch (error) {
                console.error('Lead capture error:', error);
                res.status(500).json({ error: 'Failed to capture lead' });
            }
        });
        
        // ROI calculation endpoint
        this.app.post('/api/calculate-roi', async (req, res) => {
            const roi = this.calculateROI(req.body);
            
            // Capture lead if email provided
            if (req.body.email) {
                await this.captureLead({
                    ...req.body,
                    calculatedROI: roi,
                    source: 'roi_calculator'
                });
            }
            
            res.json(roi);
        });
        
        // Demo booking endpoint
        this.app.post('/api/book-demo', async (req, res) => {
            try {
                const booking = await this.bookDemo(req.body);
                res.json({ success: true, booking });
            } catch (error) {
                console.error('Demo booking error:', error);
                res.status(500).json({ error: 'Failed to book demo' });
            }
        });
        
        // Lead scoring endpoint
        this.app.get('/api/leads/:id/score', async (req, res) => {
            const score = await this.scoreLead(req.params.id);
            res.json(score);
        });
        
        // Pipeline analytics
        this.app.get('/api/analytics/pipeline', async (req, res) => {
            const analytics = await this.getPipelineAnalytics();
            res.json(analytics);
        });
        
        // Email preview endpoints
        this.app.get('/api/email-templates', (req, res) => {
            res.json(this.getEmailTemplates());
        });
        
        // Trial setup
        this.app.post('/api/trials/setup', async (req, res) => {
            const trial = await this.setupTrial(req.body);
            res.json(trial);
        });
    }

    async initDatabase() {
        // Create tables if not exist
        const schemas = [
            `CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                company VARCHAR(255),
                name VARCHAR(255),
                title VARCHAR(255),
                phone VARCHAR(50),
                fleet_size INTEGER,
                annual_containers INTEGER,
                current_dd_spend DECIMAL,
                calculated_savings DECIMAL,
                roi_percentage DECIMAL,
                lead_score INTEGER DEFAULT 0,
                status VARCHAR(50) DEFAULT 'new',
                source VARCHAR(100),
                utm_source VARCHAR(100),
                utm_medium VARCHAR(100),
                utm_campaign VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS interactions (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id),
                type VARCHAR(50),
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS demos (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id),
                scheduled_at TIMESTAMP,
                duration INTEGER DEFAULT 30,
                meeting_link VARCHAR(500),
                calendar_event_id VARCHAR(255),
                status VARCHAR(50) DEFAULT 'scheduled',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS trials (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id),
                company_subdomain VARCHAR(100) UNIQUE,
                start_date DATE,
                end_date DATE,
                status VARCHAR(50) DEFAULT 'active',
                usage_stats JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];
        
        for (const schema of schemas) {
            await this.db.query(schema);
        }
    }

    async captureLead(data) {
        // Calculate lead score
        const leadScore = this.calculateLeadScore(data);
        
        // Insert or update lead
        const query = `
            INSERT INTO leads (
                email, company, name, title, phone,
                fleet_size, annual_containers, current_dd_spend,
                calculated_savings, roi_percentage, lead_score,
                source, utm_source, utm_medium, utm_campaign
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (email) DO UPDATE SET
                company = EXCLUDED.company,
                name = EXCLUDED.name,
                title = EXCLUDED.title,
                phone = EXCLUDED.phone,
                fleet_size = EXCLUDED.fleet_size,
                annual_containers = EXCLUDED.annual_containers,
                current_dd_spend = EXCLUDED.current_dd_spend,
                calculated_savings = EXCLUDED.calculated_savings,
                roi_percentage = EXCLUDED.roi_percentage,
                lead_score = EXCLUDED.lead_score,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const values = [
            data.email,
            data.company,
            data.name,
            data.title,
            data.phone,
            data.fleet_size || data.vessels,
            data.annual_containers,
            data.current_dd_spend,
            data.calculated_savings || data.calculatedROI?.annualSavings,
            data.roi_percentage || data.calculatedROI?.roiPercentage,
            leadScore,
            data.source || 'website',
            data.utm_source,
            data.utm_medium,
            data.utm_campaign
        ];
        
        const result = await this.db.query(query, values);
        const lead = result.rows[0];
        
        // Record interaction
        await this.recordInteraction(lead.id, 'lead_captured', data);
        
        // Sync with CRM
        await this.syncLeadToCRM(lead);
        
        // Send welcome email
        await this.sendWelcomeEmail(lead);
        
        // Trigger lead routing
        await this.routeLead(lead);
        
        return lead;
    }

    calculateLeadScore(data) {
        let score = 0;
        
        // Company size scoring
        if (data.fleet_size > 50) score += 30;
        else if (data.fleet_size > 20) score += 20;
        else if (data.fleet_size > 5) score += 10;
        
        // Annual container volume
        if (data.annual_containers > 100000) score += 30;
        else if (data.annual_containers > 50000) score += 20;
        else if (data.annual_containers > 10000) score += 10;
        
        // Title scoring
        const title = (data.title || '').toLowerCase();
        if (title.includes('ceo') || title.includes('cfo') || title.includes('coo')) score += 20;
        else if (title.includes('vp') || title.includes('director')) score += 15;
        else if (title.includes('manager')) score += 10;
        
        // Engagement scoring
        if (data.source === 'roi_calculator') score += 15;
        if (data.source === 'demo_request') score += 20;
        if (data.source === 'pricing_page') score += 10;
        
        // Email domain scoring (Fortune 500 detection)
        const domain = data.email.split('@')[1];
        if (this.isFortune500Domain(domain)) score += 25;
        
        return Math.min(100, score); // Cap at 100
    }

    isFortune500Domain(domain) {
        const fortune500Domains = [
            'maersk.com', 'msc.com', 'cma-cgm.com', 'hapag-lloyd.com',
            'one-line.com', 'evergreen-line.com', 'cosco.com',
            'walmart.com', 'amazon.com', 'exxonmobil.com', 'apple.com'
            // Add more Fortune 500 domains
        ];
        
        return fortune500Domains.includes(domain);
    }

    calculateROI(data) {
        const {
            vessels = 0,
            annual_containers = 0,
            avg_dd_per_container = 500,
            current_prevention_rate = 0.3
        } = data;
        
        // ROOTUIP metrics
        const rootuip_prevention_rate = 0.942; // 94.2%
        const platform_cost_per_month = 50000;
        const platform_cost_annual = platform_cost_per_month * 12;
        
        // Calculate potential D&D exposure
        const total_dd_exposure = annual_containers * avg_dd_per_container;
        
        // Current prevented charges
        const current_prevented = total_dd_exposure * current_prevention_rate;
        const current_losses = total_dd_exposure - current_prevented;
        
        // With ROOTUIP
        const rootuip_prevented = total_dd_exposure * rootuip_prevention_rate;
        const rootuip_losses = total_dd_exposure - rootuip_prevented;
        
        // Savings
        const annual_savings = current_losses - rootuip_losses - platform_cost_annual;
        const monthly_savings = annual_savings / 12;
        
        // Per vessel metrics
        const savings_per_vessel = vessels > 0 ? annual_savings / vessels : 0;
        
        // ROI calculation
        const roi_percentage = (annual_savings / platform_cost_annual) * 100;
        const payback_months = platform_cost_annual / monthly_savings;
        
        return {
            current_dd_exposure: total_dd_exposure,
            current_losses: current_losses,
            rootuip_prevented_charges: rootuip_prevented,
            annual_savings: annual_savings,
            monthly_savings: monthly_savings,
            savings_per_vessel: savings_per_vessel,
            roi_percentage: roi_percentage,
            payback_months: payback_months,
            platform_cost_annual: platform_cost_annual,
            prevention_improvement: (rootuip_prevention_rate - current_prevention_rate) * 100,
            
            // Formatted values for display
            formatted: {
                annual_savings: `$${(annual_savings / 1000000).toFixed(1)}M`,
                monthly_savings: `$${(monthly_savings / 1000).toFixed(0)}K`,
                roi: `${roi_percentage.toFixed(0)}%`,
                payback: `${payback_months.toFixed(1)} months`,
                per_vessel: `$${(savings_per_vessel / 1000000).toFixed(1)}M`
            }
        };
    }

    async syncLeadToCRM(lead) {
        // Salesforce sync
        if (this.integrations.salesforce.enabled) {
            try {
                await this.syncToSalesforce(lead);
            } catch (error) {
                console.error('Salesforce sync error:', error);
            }
        }
        
        // HubSpot sync
        if (this.integrations.hubspot.enabled) {
            try {
                await this.syncToHubspot(lead);
            } catch (error) {
                console.error('HubSpot sync error:', error);
            }
        }
    }

    async syncToSalesforce(lead) {
        const sfData = {
            Email: lead.email,
            Company: lead.company,
            FirstName: lead.name?.split(' ')[0],
            LastName: lead.name?.split(' ').slice(1).join(' ') || 'Unknown',
            Title: lead.title,
            Phone: lead.phone,
            LeadSource: 'Website',
            Industry: 'Shipping/Logistics',
            NumberOfEmployees: lead.fleet_size * 50, // Estimate
            AnnualRevenue: lead.annual_containers * 2000, // Estimate
            Rating: lead.lead_score > 70 ? 'Hot' : lead.lead_score > 40 ? 'Warm' : 'Cold',
            Custom_Fleet_Size__c: lead.fleet_size,
            Custom_Annual_Containers__c: lead.annual_containers,
            Custom_Potential_Savings__c: lead.calculated_savings
        };
        
        const response = await axios.post(
            `${this.integrations.salesforce.instance}/services/data/v53.0/sobjects/Lead`,
            sfData,
            {
                headers: {
                    'Authorization': `Bearer ${this.integrations.salesforce.token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data;
    }

    async syncToHubspot(lead) {
        const hsData = {
            properties: {
                email: lead.email,
                company: lead.company,
                firstname: lead.name?.split(' ')[0],
                lastname: lead.name?.split(' ').slice(1).join(' ') || 'Unknown',
                jobtitle: lead.title,
                phone: lead.phone,
                fleet_size: lead.fleet_size,
                annual_containers: lead.annual_containers,
                potential_savings: lead.calculated_savings,
                lead_score: lead.lead_score,
                lifecyclestage: lead.lead_score > 70 ? 'marketingqualifiedlead' : 'lead'
            }
        };
        
        const response = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts',
            hsData,
            {
                headers: {
                    'Authorization': `Bearer ${this.integrations.hubspot.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data;
    }

    async sendWelcomeEmail(lead) {
        const template = this.getEmailTemplate('welcome', lead);
        
        const mailOptions = {
            from: '"ROOTUIP Sales" <sales@rootuip.com>',
            to: lead.email,
            subject: template.subject,
            html: template.html,
            text: template.text
        };
        
        try {
            await this.emailTransporter.sendMail(mailOptions);
            await this.recordInteraction(lead.id, 'email_sent', { template: 'welcome' });
        } catch (error) {
            console.error('Email send error:', error);
        }
    }

    getEmailTemplate(type, lead) {
        const templates = {
            welcome: {
                subject: `${lead.name?.split(' ')[0] || 'There'}, here's how ${lead.company || 'you'} can save $${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M annually`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #003f7f;">Welcome to ROOTUIP, ${lead.name?.split(' ')[0] || 'there'}!</h2>
                        
                        <p>Thank you for calculating your ROI. Based on your fleet of ${lead.fleet_size || 50} vessels, here's what we found:</p>
                        
                        <div style="background: #f0f8ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3 style="color: #003f7f; margin-top: 0;">Your Potential Savings</h3>
                            <p style="font-size: 36px; color: #00a651; margin: 10px 0;">$${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M annually</p>
                            <p style="color: #666;">That's $${((lead.calculated_savings || 14000000) / 12 / 1000).toFixed(0)}K every month in prevented D&D charges</p>
                        </div>
                        
                        <h3>How ROOTUIP delivers these savings:</h3>
                        <ul>
                            <li>🎯 <strong>94.2% AI Accuracy</strong> - Our ML models predict D&D risks 14 days in advance</li>
                            <li>⚡ <strong>Real-time Tracking</strong> - Live updates from all major carriers</li>
                            <li>💰 <strong>One-click Prevention</strong> - Take action before charges occur</li>
                            <li>🔐 <strong>Microsoft SSO</strong> - Your team logs in with existing credentials</li>
                        </ul>
                        
                        <div style="background: #003f7f; color: white; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                            <h3 style="margin-top: 0;">See ROOTUIP in Action</h3>
                            <p>Watch how we prevent $12,500 in charges with one click</p>
                            <a href="https://app.rootuip.com/book-demo?email=${encodeURIComponent(lead.email)}" style="display: inline-block; background: #00a651; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Book Your Demo</a>
                        </div>
                        
                        <p><strong>What happens next?</strong></p>
                        <ol>
                            <li>Schedule a 30-minute demo tailored to ${lead.company || 'your company'}</li>
                            <li>See live D&D prevention using your trade routes</li>
                            <li>Get a custom implementation plan</li>
                            <li>Start your 30-day pilot (no credit card required)</li>
                        </ol>
                        
                        <p style="margin-top: 30px; color: #666; font-size: 14px;">
                            Every day without ROOTUIP costs you approximately $${((lead.calculated_savings || 14000000) / 365 / 1000).toFixed(0)}K. 
                            <a href="https://app.rootuip.com/book-demo?email=${encodeURIComponent(lead.email)}">Let's stop those losses today.</a>
                        </p>
                    </div>
                `,
                text: `Welcome to ROOTUIP! Based on your ${lead.fleet_size || 50} vessels, you could save $${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M annually. Book your demo: https://app.rootuip.com/book-demo?email=${encodeURIComponent(lead.email)}`
            },
            
            followup_2_days: {
                subject: `Quick question about ${lead.company || 'your'} D&D charges`,
                html: `<!-- 2-day follow-up template -->`
            },
            
            followup_7_days: {
                subject: `${lead.name?.split(' ')[0] || 'Hi'}, competitors are saving millions with ROOTUIP`,
                html: `<!-- 7-day follow-up template -->`
            },
            
            case_study: {
                subject: `How Maersk saved $18M in Q1 with ROOTUIP`,
                html: `<!-- Case study template -->`
            }
        };
        
        return templates[type] || templates.welcome;
    }

    async bookDemo(data) {
        // Create or update lead
        const lead = await this.captureLead({
            ...data,
            source: 'demo_request'
        });
        
        // Create demo record
        const demoQuery = `
            INSERT INTO demos (lead_id, scheduled_at, duration, meeting_link, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const meetingLink = this.generateMeetingLink(lead.id);
        const demoResult = await this.db.query(demoQuery, [
            lead.id,
            data.preferredTime,
            data.duration || 30,
            meetingLink,
            data.notes
        ]);
        
        const demo = demoResult.rows[0];
        
        // Send calendar invite
        await this.sendCalendarInvite(lead, demo);
        
        // Record interaction
        await this.recordInteraction(lead.id, 'demo_booked', demo);
        
        // Notify sales team
        await this.notifySalesTeam(lead, demo);
        
        return demo;
    }

    generateMeetingLink(leadId) {
        // In production, integrate with Zoom/Teams API
        return `https://meet.rootuip.com/demo/${leadId}-${crypto.randomBytes(8).toString('hex')}`;
    }

    async sendCalendarInvite(lead, demo) {
        // ICS calendar file generation
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ROOTUIP//Demo Booking//EN
BEGIN:VEVENT
UID:${demo.id}@rootuip.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}
DTSTART:${new Date(demo.scheduled_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}
DTEND:${new Date(new Date(demo.scheduled_at).getTime() + demo.duration * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}
SUMMARY:ROOTUIP Demo - Save $${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M annually
DESCRIPTION:See how ROOTUIP can save ${lead.company || 'your company'} $${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M in D&D charges annually.\\n\\nJoin link: ${demo.meeting_link}
LOCATION:${demo.meeting_link}
ORGANIZER;CN=ROOTUIP Sales:mailto:sales@rootuip.com
ATTENDEE;CN=${lead.name};RSVP=TRUE:mailto:${lead.email}
END:VEVENT
END:VCALENDAR`;
        
        const mailOptions = {
            from: '"ROOTUIP Sales" <sales@rootuip.com>',
            to: lead.email,
            subject: `Demo Confirmed: See how to save $${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M annually`,
            html: `
                <h2>Your ROOTUIP demo is confirmed!</h2>
                <p><strong>When:</strong> ${new Date(demo.scheduled_at).toLocaleString()}</p>
                <p><strong>Duration:</strong> ${demo.duration} minutes</p>
                <p><strong>Join Link:</strong> <a href="${demo.meeting_link}">${demo.meeting_link}</a></p>
                <p>We'll show you how to prevent $${((lead.calculated_savings || 14000000) / 1000000).toFixed(1)}M in annual D&D charges.</p>
            `,
            icalEvent: {
                content: icsContent
            }
        };
        
        await this.emailTransporter.sendMail(mailOptions);
    }

    async setupTrial(data) {
        const lead = await this.captureLead({
            ...data,
            source: 'trial_request'
        });
        
        // Generate unique subdomain
        const subdomain = this.generateSubdomain(data.company);
        
        // Create trial record
        const trialQuery = `
            INSERT INTO trials (lead_id, company_subdomain, start_date, end_date)
            VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
            RETURNING *
        `;
        
        const result = await this.db.query(trialQuery, [lead.id, subdomain]);
        const trial = result.rows[0];
        
        // Provision trial environment (in production, this would create actual resources)
        await this.provisionTrialEnvironment(trial);
        
        // Send trial welcome email
        await this.sendTrialWelcomeEmail(lead, trial);
        
        return trial;
    }

    generateSubdomain(company) {
        const base = company
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20);
        
        return `${base}-${crypto.randomBytes(4).toString('hex')}`;
    }

    async provisionTrialEnvironment(trial) {
        // In production:
        // 1. Create subdomain in DNS
        // 2. Provision database schema
        // 3. Configure authentication
        // 4. Set up monitoring
        // 5. Enable features based on trial type
        
        console.log(`Trial environment provisioned: ${trial.company_subdomain}.rootuip.com`);
    }

    async routeLead(lead) {
        // Lead routing logic based on score and characteristics
        if (lead.lead_score >= 70) {
            // High-value lead - assign to senior sales
            await this.assignToSalesRep(lead, 'senior');
            await this.sendSlackNotification(`🔥 HOT LEAD: ${lead.company} - Potential $${(lead.calculated_savings / 1000000).toFixed(1)}M savings`);
        } else if (lead.lead_score >= 40) {
            // Medium-value lead - standard sales process
            await this.assignToSalesRep(lead, 'standard');
        } else {
            // Low-value lead - nurture campaign
            await this.addToNurtureCampaign(lead);
        }
    }

    async recordInteraction(leadId, type, details) {
        const query = `
            INSERT INTO interactions (lead_id, type, details)
            VALUES ($1, $2, $3)
        `;
        
        await this.db.query(query, [leadId, type, JSON.stringify(details)]);
    }

    async getPipelineAnalytics() {
        const analytics = await this.db.query(`
            SELECT 
                COUNT(*) as total_leads,
                COUNT(*) FILTER (WHERE status = 'new') as new_leads,
                COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
                COUNT(*) FILTER (WHERE status = 'demo_scheduled') as demos_scheduled,
                COUNT(*) FILTER (WHERE status = 'trial') as trials_active,
                COUNT(*) FILTER (WHERE status = 'closed_won') as closed_won,
                AVG(lead_score) as avg_lead_score,
                SUM(calculated_savings) as total_potential_savings,
                SUM(calculated_savings) FILTER (WHERE status = 'closed_won') as realized_savings
            FROM leads
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        `);
        
        return analytics.rows[0];
    }

    getEmailTemplates() {
        return {
            sequences: [
                {
                    name: 'Enterprise Onboarding',
                    emails: [
                        { day: 0, template: 'welcome' },
                        { day: 2, template: 'followup_2_days' },
                        { day: 7, template: 'case_study' },
                        { day: 14, template: 'roi_reminder' },
                        { day: 21, template: 'final_offer' }
                    ]
                },
                {
                    name: 'Trial Nurture',
                    emails: [
                        { day: 0, template: 'trial_welcome' },
                        { day: 3, template: 'trial_tips' },
                        { day: 7, template: 'trial_checkin' },
                        { day: 14, template: 'trial_midpoint' },
                        { day: 25, template: 'trial_conversion' }
                    ]
                }
            ]
        };
    }

    async sendSlackNotification(message) {
        if (process.env.SLACK_WEBHOOK) {
            try {
                await axios.post(process.env.SLACK_WEBHOOK, { text: message });
            } catch (error) {
                console.error('Slack notification error:', error);
            }
        }
    }

    async assignToSalesRep(lead, tier) {
        // In production, integrate with CRM assignment rules
        console.log(`Lead ${lead.id} assigned to ${tier} sales rep`);
    }

    async addToNurtureCampaign(lead) {
        // Add to marketing automation
        console.log(`Lead ${lead.id} added to nurture campaign`);
    }

    async notifySalesTeam(lead, demo) {
        const message = `
🎯 New Demo Booked!
Company: ${lead.company}
Contact: ${lead.name} (${lead.title})
Potential Savings: $${(lead.calculated_savings / 1000000).toFixed(1)}M
Demo Time: ${new Date(demo.scheduled_at).toLocaleString()}
Lead Score: ${lead.lead_score}/100
        `;
        
        await this.sendSlackNotification(message);
    }

    async sendTrialWelcomeEmail(lead, trial) {
        const mailOptions = {
            from: '"ROOTUIP Success Team" <success@rootuip.com>',
            to: lead.email,
            subject: 'Your ROOTUIP trial is ready!',
            html: `
                <h2>Welcome to your ROOTUIP trial!</h2>
                <p>Your dedicated environment is ready at:</p>
                <p style="font-size: 24px;"><a href="https://${trial.company_subdomain}.rootuip.com">https://${trial.company_subdomain}.rootuip.com</a></p>
                
                <h3>Getting Started:</h3>
                <ol>
                    <li>Login with your Microsoft account</li>
                    <li>Upload your container data (or use our sample data)</li>
                    <li>Watch AI predict D&D risks in real-time</li>
                    <li>See your potential savings dashboard</li>
                </ol>
                
                <p>Your trial includes:</p>
                <ul>
                    <li>✓ Full platform access for 30 days</li>
                    <li>✓ Unlimited users</li>
                    <li>✓ Dedicated success manager</li>
                    <li>✓ Custom onboarding session</li>
                    <li>✓ ROI reporting</li>
                </ul>
                
                <p><a href="https://calendly.com/rootuip-success/onboarding" style="display: inline-block; background: #00a651; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Schedule Onboarding Session</a></p>
            `
        };
        
        await this.emailTransporter.sendMail(mailOptions);
    }

    async scoreLead(leadId) {
        // Get lead data and interactions
        const leadQuery = await this.db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadQuery.rows[0];
        
        const interactionsQuery = await this.db.query(
            'SELECT * FROM interactions WHERE lead_id = $1 ORDER BY created_at DESC',
            [leadId]
        );
        const interactions = interactionsQuery.rows;
        
        // Recalculate score based on behavior
        let behaviorScore = lead.lead_score || 0;
        
        // Engagement scoring
        interactions.forEach(interaction => {
            switch (interaction.type) {
                case 'email_opened': behaviorScore += 2; break;
                case 'link_clicked': behaviorScore += 5; break;
                case 'demo_booked': behaviorScore += 20; break;
                case 'trial_started': behaviorScore += 30; break;
                case 'roi_calculated': behaviorScore += 15; break;
            }
        });
        
        // Time decay
        const daysSinceCreation = (Date.now() - new Date(lead.created_at)) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation > 30) behaviorScore *= 0.8;
        if (daysSinceCreation > 60) behaviorScore *= 0.6;
        
        // Update lead score
        await this.db.query(
            'UPDATE leads SET lead_score = $1 WHERE id = $2',
            [Math.min(100, behaviorScore), leadId]
        );
        
        return {
            leadId,
            score: Math.min(100, behaviorScore),
            factors: {
                firmographic: lead.lead_score,
                behavioral: behaviorScore - lead.lead_score,
                recency: daysSinceCreation < 7 ? 'High' : daysSinceCreation < 30 ? 'Medium' : 'Low'
            }
        };
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Sales CRM System running on port ${this.port}`);
        });
    }
}

// Start if run directly
if (require.main === module) {
    const crm = new SalesCRMSystem();
    crm.start();
}

module.exports = SalesCRMSystem;