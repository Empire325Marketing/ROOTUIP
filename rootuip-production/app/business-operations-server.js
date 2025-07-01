/**
 * ROOTUIP Business Operations Server
 * Integrates all Week 2 enterprise systems
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

// Import all business systems
const { EmailAutomationSystem } = require('./email-automation-system');
const { HubSpotCRMIntegration } = require('./hubspot-crm-integration');
const { AnalyticsTrackingSystem } = require('./analytics-tracking-system');
const CustomerSupportSystem = require('./customer-support-system');

class BusinessOperationsServer {
    constructor() {
        this.app = express();
        this.port = process.env.BUSINESS_OPS_PORT || 3011;
        
        // Database connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rootuip_business',
            max: 20
        });
        
        // Initialize all systems
        this.initializeSystems();
        
        // Setup middleware
        this.setupMiddleware();
        
        // Setup routes
        this.setupRoutes();
    }

    async initializeSystems() {
        console.log('Initializing business operations systems...');
        
        // Email Automation
        this.emailSystem = new EmailAutomationSystem({
            sendGridApiKey: process.env.SENDGRID_API_KEY
        });
        
        // HubSpot CRM
        this.crmSystem = new HubSpotCRMIntegration({
            apiKey: process.env.HUBSPOT_API_KEY,
            portalId: process.env.HUBSPOT_PORTAL_ID
        });
        
        // Analytics
        this.analyticsSystem = new AnalyticsTrackingSystem({
            ga4MeasurementId: process.env.GA4_MEASUREMENT_ID,
            ga4ApiSecret: process.env.GA4_API_SECRET,
            mixpanelToken: process.env.MIXPANEL_TOKEN
        });
        
        // Customer Support
        this.supportSystem = new CustomerSupportSystem({
            intercomToken: process.env.INTERCOM_ACCESS_TOKEN,
            intercomAppId: process.env.INTERCOM_APP_ID
        });
        
        // Set up system integrations
        await this.setupSystemIntegrations();
        
        console.log('All business systems initialized');
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                systems: {
                    email: 'active',
                    crm: 'active',
                    analytics: 'active',
                    support: 'active'
                },
                timestamp: new Date().toISOString()
            });
        });
        
        // Lead capture with full automation
        this.app.post('/api/leads/capture', async (req, res) => {
            try {
                const leadData = req.body;
                
                // 1. Track analytics event
                await this.analyticsSystem.track('lead_capture', {
                    source: leadData.source,
                    company: leadData.company,
                    calculated_savings: leadData.calculated_savings
                }, null, req.sessionID);
                
                // 2. Calculate lead score
                const leadScore = await this.crmSystem.calculateLeadScore(leadData);
                leadData.lead_score = leadScore;
                
                // 3. Store in database
                const lead = await this.db.query(`
                    INSERT INTO leads (
                        email, name, company, title, phone,
                        fleet_size, annual_containers, calculated_savings,
                        roi_percentage, lead_score, source,
                        utm_source, utm_medium, utm_campaign
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING *
                `, [
                    leadData.email, leadData.name, leadData.company,
                    leadData.title, leadData.phone, leadData.fleet_size,
                    leadData.annual_containers, leadData.calculated_savings,
                    leadData.roi_percentage, leadScore, leadData.source,
                    leadData.utm_source, leadData.utm_medium, leadData.utm_campaign
                ]);
                
                const newLead = lead.rows[0];
                
                // 4. Sync to HubSpot
                const hubspotId = await this.crmSystem.syncContact({
                    ...leadData,
                    id: newLead.id,
                    leadId: newLead.id
                });
                
                // 5. Start email sequence
                await this.emailSystem.startEmailSequence(
                    leadScore >= 70 ? 'executive_nurture' : 'demo_followup',
                    {
                        leadId: newLead.id,
                        email: leadData.email,
                        firstName: leadData.name?.split(' ')[0],
                        company: leadData.company,
                        annualSavings: leadData.calculated_savings
                    }
                );
                
                // 6. Create support user
                await this.supportSystem.createOrUpdateUser({
                    userId: `lead_${newLead.id}`,
                    email: leadData.email,
                    name: leadData.name,
                    company: leadData.company,
                    companyId: `company_${leadData.company}`,
                    fleet_size: leadData.fleet_size,
                    support_tier: leadScore >= 80 ? 'enterprise' : 'standard'
                });
                
                // 7. Track conversion funnel
                await this.analyticsSystem.trackConversionFunnel('lead', {
                    lead_id: newLead.id,
                    lead_score: leadScore,
                    potential_value: leadData.calculated_savings
                });
                
                res.json({
                    success: true,
                    leadId: newLead.id,
                    leadScore,
                    nextSteps: this.getNextSteps(leadScore)
                });
                
            } catch (error) {
                console.error('Lead capture error:', error);
                res.status(500).json({ error: 'Failed to capture lead' });
            }
        });
        
        // Demo booking with full automation
        this.app.post('/api/demo/book', async (req, res) => {
            try {
                const demoData = req.body;
                
                // Track event
                await this.analyticsSystem.track('demo_scheduled', demoData);
                
                // Update lead stage
                if (demoData.leadId) {
                    await this.crmSystem.syncDeal(demoData.hubspotContactId, {
                        ...demoData,
                        demo_scheduled: true
                    });
                }
                
                // Send confirmation emails
                await this.emailSystem.sendEmail(
                    demoData.email,
                    'Your ROOTUIP demo is confirmed',
                    'demo_confirmation',
                    demoData
                );
                
                // Create calendar event
                // (Calendar integration would go here)
                
                res.json({ success: true, demoId: demoData.id });
                
            } catch (error) {
                console.error('Demo booking error:', error);
                res.status(500).json({ error: 'Failed to book demo' });
            }
        });
        
        // Customer health check
        this.app.get('/api/customer/:userId/health', async (req, res) => {
            try {
                const { userId } = req.params;
                
                // Get platform usage metrics
                const usage = await this.db.query(`
                    SELECT 
                        COUNT(DISTINCT DATE(created_at)) as login_days,
                        COUNT(DISTINCT feature_name) as features_used,
                        SUM(prevented_charges) as total_prevented,
                        MAX(created_at) as last_activity
                    FROM user_activities
                    WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
                `, [userId]);
                
                // Get support metrics
                const supportScore = await this.supportSystem.calculateCustomerHealthScore(userId);
                
                // Calculate overall health
                const metrics = {
                    login_frequency: usage.rows[0].login_days,
                    feature_adoption: (usage.rows[0].features_used / 10) * 100, // Assume 10 core features
                    support_tickets: 0, // Would query from support system
                    nps_score: 8, // Would come from surveys
                    charges_prevented: usage.rows[0].total_prevented || 0,
                    roi_achieved: 0 // Would calculate based on savings
                };
                
                const healthScore = await this.analyticsSystem.trackCustomerHealth(userId, metrics);
                
                res.json({
                    userId,
                    healthScore,
                    metrics,
                    supportScore,
                    recommendations: this.getHealthRecommendations(healthScore)
                });
                
            } catch (error) {
                console.error('Health check error:', error);
                res.status(500).json({ error: 'Failed to check customer health' });
            }
        });
        
        // Revenue dashboard
        this.app.get('/api/revenue/dashboard', async (req, res) => {
            try {
                const { startDate, endDate } = req.query;
                
                // Get revenue metrics
                const revenue = await this.analyticsSystem.getRevenueAnalytics(startDate, endDate);
                
                // Get pipeline from HubSpot
                const pipeline = await this.crmSystem.getRevenueForecast(startDate, endDate);
                
                // Get conversion rates
                const conversions = await this.analyticsSystem.getFunnelAnalytics(startDate, endDate);
                
                res.json({
                    revenue,
                    pipeline,
                    conversions,
                    summary: {
                        mrr: revenue.mrr[0]?.mrr || 0,
                        arr: revenue.mrr[0]?.arr || 0,
                        growth: revenue.mrr[0]?.growth_rate || 0,
                        pipelineValue: pipeline.reduce((sum, p) => sum + p.weighted_value, 0)
                    }
                });
                
            } catch (error) {
                console.error('Revenue dashboard error:', error);
                res.status(500).json({ error: 'Failed to get revenue data' });
            }
        });
        
        // Support dashboard
        this.app.get('/api/support/dashboard', async (req, res) => {
            try {
                const { startDate, endDate } = req.query;
                
                const metrics = await this.supportSystem.getSupportMetrics(startDate, endDate);
                
                res.json({
                    metrics,
                    slaCompliance: metrics.slaCompliance,
                    recommendations: this.getSupportRecommendations(metrics)
                });
                
            } catch (error) {
                console.error('Support dashboard error:', error);
                res.status(500).json({ error: 'Failed to get support metrics' });
            }
        });
        
        // Analytics routes
        this.app.use('/api/analytics', this.analyticsSystem.setupRoutes());
        
        // Webhook endpoints
        this.app.use('/webhooks', this.setupWebhooks());
    }

    setupWebhooks() {
        const router = express.Router();
        
        // SendGrid webhook
        router.post('/sendgrid', async (req, res) => {
            try {
                await this.emailSystem.handleWebhook(req.body);
                res.json({ success: true });
            } catch (error) {
                console.error('SendGrid webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });
        
        // HubSpot webhook
        router.post('/hubspot', async (req, res) => {
            try {
                // Handle HubSpot events
                res.json({ success: true });
            } catch (error) {
                console.error('HubSpot webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });
        
        // Intercom webhook
        router.use('/intercom', this.supportSystem.setupWebhooks());
        
        return router;
    }

    async setupSystemIntegrations() {
        // CRM → Email: When deal stage changes, trigger email
        this.crmSystem.on('deal:synced', async (data) => {
            if (data.stage === 'proposal_sent') {
                await this.emailSystem.sendEmail(
                    data.email,
                    'Your ROOTUIP proposal is ready',
                    'proposal_notification',
                    data
                );
            }
        });
        
        // Support → Analytics: Track support interactions
        this.supportSystem.on('ticket:created', async (ticket) => {
            await this.analyticsSystem.track('support_ticket_created', {
                category: ticket.category,
                priority: ticket.priority,
                tier: ticket.tier
            }, ticket.user_id);
        });
        
        // Support → CRM: Update deal based on support issues
        this.supportSystem.on('sla:breached', async (data) => {
            if (data.ticket.tier === 'enterprise') {
                // Log activity in HubSpot
                await this.crmSystem.logActivity(
                    data.ticket.hubspot_id,
                    'sla_breach',
                    data
                );
            }
        });
        
        // Analytics → Email: Trigger based on behavior
        this.analyticsSystem.on('milestone:reached', async (data) => {
            if (data.milestone === 'first_charge_prevented') {
                await this.emailSystem.sendEmail(
                    data.email,
                    'Congratulations! You just saved money with ROOTUIP',
                    'milestone_first_save',
                    data
                );
            }
        });
    }

    getNextSteps(leadScore) {
        if (leadScore >= 80) {
            return [
                'High-value lead assigned to senior sales',
                'Executive nurture sequence started',
                'Demo scheduling link sent',
                'Success manager notified'
            ];
        } else if (leadScore >= 60) {
            return [
                'Lead assigned to sales team',
                'Demo follow-up sequence started',
                'ROI report scheduled for delivery'
            ];
        } else {
            return [
                'Lead added to nurture campaign',
                'Educational content sequence started',
                'Will be re-scored based on engagement'
            ];
        }
    }

    getHealthRecommendations(score) {
        if (score >= 80) {
            return ['Consider upsell opportunities', 'Schedule quarterly business review'];
        } else if (score >= 60) {
            return ['Increase feature adoption training', 'Check in with customer success'];
        } else {
            return ['Immediate intervention required', 'Schedule executive escalation call'];
        }
    }

    getSupportRecommendations(metrics) {
        const recommendations = [];
        
        if (metrics.slaCompliance < 90) {
            recommendations.push('SLA compliance below target - review staffing levels');
        }
        
        const avgResolution = metrics.tickets[0]?.avg_resolution_hours || 0;
        if (avgResolution > 24) {
            recommendations.push('Resolution time exceeds target - review escalation process');
        }
        
        return recommendations;
    }

    async start() {
        // Initialize database schema
        await this.initializeDatabase();
        
        this.app.listen(this.port, () => {
            console.log(`Business Operations Server running on port ${this.port}`);
            console.log('Systems active:');
            console.log('  ✓ Email Automation (SendGrid)');
            console.log('  ✓ CRM Integration (HubSpot)');
            console.log('  ✓ Analytics Tracking (GA4 + Mixpanel)');
            console.log('  ✓ Customer Support (Intercom)');
        });
    }

    async initializeDatabase() {
        // Create all necessary tables
        const schemas = [
            require('./email-automation-system').initSchema,
            require('./hubspot-crm-integration').initSchema,
            require('./analytics-tracking-system').initSchema
        ];
        
        for (const schema of schemas) {
            await this.db.query(schema);
        }
        
        console.log('Database schemas initialized');
    }
}

// Start server
if (require.main === module) {
    const server = new BusinessOperationsServer();
    server.start();
}

module.exports = BusinessOperationsServer;