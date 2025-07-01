const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const hubspot = require('@hubspot/api-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
sgMail.setApiKey('your-sendgrid-api-key');
const hubspotClient = new hubspot.Client({ accessToken: 'your-hubspot-access-token' });

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// Lead scoring algorithm
function calculateLeadScore(leadData) {
    let score = 0;
    
    // Company size scoring
    if (leadData.containers > 10000) score += 40;
    else if (leadData.containers > 5000) score += 30;
    else if (leadData.containers > 1000) score += 20;
    else score += 10;
    
    // Industry scoring
    const highValueIndustries = ['shipping', 'manufacturing', 'pharmaceutical', 'automotive'];
    if (highValueIndustries.includes(leadData.industry)) score += 20;
    
    // Engagement scoring
    if (leadData.roi_calculator_completed) score += 15;
    if (leadData.demo_requested) score += 25;
    
    // Title scoring
    const executiveTitles = ['CEO', 'CTO', 'COO', 'VP', 'Director'];
    if (executiveTitles.some(title => leadData.title?.includes(title))) score += 20;
    
    return score;
}

// Enterprise lead capture endpoint
app.post('/api/enterprise-leads', async (req, res) => {
    try {
        const leadData = req.body;
        const leadScore = calculateLeadScore(leadData);
        
        // Store lead in database
        const result = await db.query(`
            INSERT INTO enterprise_leads (
                first_name, last_name, email, phone, company, title,
                industry, containers, annual_savings, roi_percentage,
                lead_score, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            RETURNING id
        `, [
            leadData.firstName, leadData.lastName, leadData.email,
            leadData.phone, leadData.company, leadData.title,
            leadData.industry, leadData.containers, leadData.annual_savings,
            leadData.roi_percentage, leadScore
        ]);
        
        const leadId = result.rows[0].id;
        
        // Create HubSpot contact and deal
        const contactObj = {
            properties: {
                firstname: leadData.firstName,
                lastname: leadData.lastName,
                email: leadData.email,
                phone: leadData.phone,
                company: leadData.company,
                jobtitle: leadData.title,
                industry: leadData.industry,
                container_volume: leadData.containers,
                annual_savings: leadData.annual_savings,
                roi_percentage: leadData.roi_percentage,
                lead_score: leadScore,
                lifecyclestage: leadScore >= 70 ? 'qualifiedlead' : 'lead'
            }
        };
        
        const contact = await hubspotClient.crm.contacts.basicApi.create(contactObj);
        
        // Create deal for qualified leads
        if (leadScore >= 70) {
            const dealValue = parseInt(leadData.containers) > 5000 ? 500000 : 150000;
            
            const dealObj = {
                properties: {
                    dealname: `${leadData.company} - Enterprise Container Tracking`,
                    pipeline: 'default',
                    dealstage: 'qualifiedtobuy',
                    amount: dealValue,
                    closedate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                    container_volume: leadData.containers,
                    annual_savings: leadData.annual_savings
                },
                associations: [{
                    to: { id: contact.id },
                    types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
                }]
            };
            
            await hubspotClient.crm.deals.basicApi.create(dealObj);
        }
        
        // Send immediate follow-up email
        const emailTemplate = leadScore >= 70 ? 'enterprise-qualified' : 'enterprise-nurture';
        await sendFollowUpEmail(leadData, emailTemplate);
        
        // Schedule demo for qualified leads
        if (leadScore >= 70) {
            await scheduleDemoCall(leadData);
        }
        
        res.json({ 
            success: true, 
            leadId,
            qualified: leadScore >= 70,
            message: 'Lead captured successfully'
        });
        
    } catch (error) {
        console.error('Lead capture error:', error);
        res.status(500).json({ error: 'Failed to process lead' });
    }
});

// Send follow-up emails
async function sendFollowUpEmail(leadData, template) {
    const templates = {
        'enterprise-qualified': {
            subject: `${leadData.firstName}, Your Enterprise Container Tracking ROI Analysis`,
            html: `
                <h2>Thank you for your interest in ROOTUIP Enterprise</h2>
                <p>Hi ${leadData.firstName},</p>
                <p>Based on your inputs, ROOTUIP can deliver <strong>${leadData.annual_savings}</strong> in annual savings for ${leadData.company}.</p>
                <h3>Your Personalized ROI Summary:</h3>
                <ul>
                    <li>Annual Savings: ${leadData.annual_savings}</li>
                    <li>ROI: ${leadData.roi_percentage}</li>
                    <li>Container Volume: ${leadData.containers}/month</li>
                </ul>
                <p>Our enterprise team will contact you within 24 hours to schedule a personalized demo.</p>
                <p>In the meantime, you can review our enterprise features at your secured dashboard.</p>
                <a href="https://tracking.rootuip.com/enterprise-dashboard" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Access Enterprise Dashboard</a>
            `
        },
        'enterprise-nurture': {
            subject: 'Maximize Your Logistics Efficiency with ROOTUIP',
            html: `
                <h2>Welcome to ROOTUIP, ${leadData.firstName}</h2>
                <p>Thank you for calculating your ROI with ROOTUIP's container tracking platform.</p>
                <p>Here's what leading enterprises achieve with ROOTUIP:</p>
                <ul>
                    <li>70% reduction in shipment delays</li>
                    <li>80% less time on manual tracking</li>
                    <li>Real-time visibility across all containers</li>
                    <li>Predictive analytics for proactive management</li>
                </ul>
                <p>Ready to see ROOTUIP in action?</p>
                <a href="https://tracking.rootuip.com/book-demo" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Schedule Your Demo</a>
            `
        }
    };
    
    const msg = {
        to: leadData.email,
        from: 'enterprise@rootuip.com',
        subject: templates[template].subject,
        html: templates[template].html,
        trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
        }
    };
    
    await sgMail.send(msg);
}

// Automated demo scheduling
async function scheduleDemoCall(leadData) {
    // Create calendar event
    const demoDate = new Date();
    demoDate.setDate(demoDate.getDate() + 2); // 2 days from now
    demoDate.setHours(14, 0, 0, 0); // 2 PM
    
    // Update HubSpot with demo scheduled
    const taskObj = {
        properties: {
            hs_task_subject: `Demo Call - ${leadData.company}`,
            hs_task_body: `Enterprise demo for ${leadData.firstName} ${leadData.lastName} at ${leadData.company}. Container volume: ${leadData.containers}/month. Potential value: ${leadData.annual_savings}`,
            hs_task_priority: 'HIGH',
            hs_task_type: 'CALL',
            hs_timestamp: demoDate.getTime()
        },
        associations: [{
            to: { id: leadData.hubspotContactId },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }]
        }]
    };
    
    await hubspotClient.crm.tasks.basicApi.create(taskObj);
}

// Email automation sequences
app.post('/api/email-sequences/start', async (req, res) => {
    try {
        const { leadId, sequence } = req.body;
        
        const sequences = {
            'enterprise-onboarding': [
                { delay: 0, template: 'welcome' },
                { delay: 1, template: 'platform-overview' },
                { delay: 3, template: 'best-practices' },
                { delay: 7, template: 'success-metrics' },
                { delay: 14, template: 'advanced-features' },
                { delay: 30, template: 'monthly-review' }
            ],
            'trial-nurture': [
                { delay: 0, template: 'trial-welcome' },
                { delay: 2, template: 'quick-wins' },
                { delay: 5, template: 'roi-reminder' },
                { delay: 10, template: 'upgrade-benefits' },
                { delay: 14, template: 'trial-ending' }
            ]
        };
        
        const selectedSequence = sequences[sequence];
        
        // Schedule emails
        for (const step of selectedSequence) {
            const sendDate = new Date();
            sendDate.setDate(sendDate.getDate() + step.delay);
            
            await db.query(`
                INSERT INTO email_queue (
                    lead_id, template, scheduled_at, status
                ) VALUES ($1, $2, $3, 'pending')
            `, [leadId, step.template, sendDate]);
        }
        
        res.json({ success: true, message: 'Email sequence scheduled' });
        
    } catch (error) {
        console.error('Email sequence error:', error);
        res.status(500).json({ error: 'Failed to start email sequence' });
    }
});

// Contract generation
app.post('/api/contracts/generate', async (req, res) => {
    try {
        const { dealId, terms } = req.body;
        
        // Get deal details from HubSpot
        const deal = await hubspotClient.crm.deals.basicApi.getById(dealId);
        
        // Generate contract
        const contract = {
            id: `CTR-${Date.now()}`,
            dealId,
            company: deal.properties.company,
            value: deal.properties.amount,
            term: terms.duration || 12,
            startDate: new Date(),
            features: terms.features || ['full-platform', 'api-access', 'dedicated-support'],
            sla: {
                uptime: '99.9%',
                supportResponse: '1 hour',
                dedicatedManager: true
            },
            status: 'draft'
        };
        
        // Store contract
        await db.query(`
            INSERT INTO contracts (
                id, deal_id, company, value, term_months,
                start_date, features, sla, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            contract.id, contract.dealId, contract.company,
            contract.value, contract.term, contract.startDate,
            JSON.stringify(contract.features), JSON.stringify(contract.sla),
            contract.status
        ]);
        
        // Update deal stage
        await hubspotClient.crm.deals.basicApi.update(dealId, {
            properties: {
                dealstage: 'contractsent',
                contract_id: contract.id
            }
        });
        
        res.json({ success: true, contractId: contract.id });
        
    } catch (error) {
        console.error('Contract generation error:', error);
        res.status(500).json({ error: 'Failed to generate contract' });
    }
});

// Revenue forecasting
app.get('/api/analytics/revenue-forecast', async (req, res) => {
    try {
        // Get pipeline data
        const deals = await hubspotClient.crm.deals.searchApi.doSearch({
            filterGroups: [{
                filters: [{
                    propertyName: 'pipeline',
                    operator: 'EQ',
                    value: 'default'
                }]
            }],
            properties: ['dealname', 'amount', 'closedate', 'dealstage', 'probability']
        });
        
        // Calculate forecast
        const forecast = {
            current_quarter: 0,
            next_quarter: 0,
            yearly: 0,
            pipeline_value: 0,
            weighted_pipeline: 0,
            deals_by_stage: {}
        };
        
        const stageProbabilities = {
            'appointmentscheduled': 0.2,
            'qualifiedtobuy': 0.4,
            'presentationscheduled': 0.6,
            'decisionmakerboughtin': 0.8,
            'contractsent': 0.9,
            'closedwon': 1.0
        };
        
        deals.results.forEach(deal => {
            const amount = parseFloat(deal.properties.amount) || 0;
            const probability = stageProbabilities[deal.properties.dealstage] || 0.1;
            const closeDate = new Date(deal.properties.closedate);
            const currentDate = new Date();
            
            forecast.pipeline_value += amount;
            forecast.weighted_pipeline += amount * probability;
            
            // Quarterly breakdown
            const quarterDiff = Math.floor((closeDate - currentDate) / (90 * 24 * 60 * 60 * 1000));
            if (quarterDiff === 0) forecast.current_quarter += amount * probability;
            else if (quarterDiff === 1) forecast.next_quarter += amount * probability;
            
            if (quarterDiff <= 3) forecast.yearly += amount * probability;
            
            // Stage breakdown
            const stage = deal.properties.dealstage;
            if (!forecast.deals_by_stage[stage]) {
                forecast.deals_by_stage[stage] = { count: 0, value: 0 };
            }
            forecast.deals_by_stage[stage].count++;
            forecast.deals_by_stage[stage].value += amount;
        });
        
        res.json(forecast);
        
    } catch (error) {
        console.error('Revenue forecast error:', error);
        res.status(500).json({ error: 'Failed to generate forecast' });
    }
});

// Customer health scoring
app.get('/api/customers/:id/health', async (req, res) => {
    try {
        const customerId = req.params.id;
        
        // Get customer metrics
        const metrics = await db.query(`
            SELECT 
                c.*,
                COUNT(DISTINCT ct.id) as total_containers_tracked,
                AVG(ct.delay_percentage) as avg_delay_rate,
                COUNT(DISTINCT s.id) as support_tickets,
                AVG(s.resolution_time) as avg_resolution_time,
                MAX(u.last_login) as last_platform_login,
                COUNT(DISTINCT u.id) as active_users
            FROM customers c
            LEFT JOIN container_tracking ct ON c.id = ct.customer_id
            LEFT JOIN support_tickets s ON c.id = s.customer_id
            LEFT JOIN users u ON c.id = u.customer_id
            WHERE c.id = $1
            GROUP BY c.id
        `, [customerId]);
        
        const customer = metrics.rows[0];
        
        // Calculate health score
        let healthScore = 100;
        
        // Usage factors
        const daysInactive = (Date.now() - new Date(customer.last_platform_login)) / (24 * 60 * 60 * 1000);
        if (daysInactive > 30) healthScore -= 20;
        else if (daysInactive > 14) healthScore -= 10;
        
        // Support factors
        if (customer.support_tickets > 10) healthScore -= 15;
        if (customer.avg_resolution_time > 48) healthScore -= 10;
        
        // Business impact
        const utilizationRate = customer.total_containers_tracked / (customer.contract_containers || 1);
        if (utilizationRate < 0.5) healthScore -= 20;
        else if (utilizationRate < 0.8) healthScore -= 10;
        
        // Determine status
        let status = 'healthy';
        if (healthScore < 60) status = 'at-risk';
        else if (healthScore < 80) status = 'needs-attention';
        
        res.json({
            customerId,
            healthScore,
            status,
            metrics: {
                usage: {
                    containers_tracked: customer.total_containers_tracked,
                    utilization_rate: utilizationRate,
                    last_login: customer.last_platform_login,
                    active_users: customer.active_users
                },
                performance: {
                    avg_delay_rate: customer.avg_delay_rate,
                    improvement_from_baseline: 70 // percentage
                },
                support: {
                    tickets: customer.support_tickets,
                    avg_resolution_time: customer.avg_resolution_time
                }
            },
            recommendations: generateHealthRecommendations(healthScore, customer)
        });
        
    } catch (error) {
        console.error('Customer health error:', error);
        res.status(500).json({ error: 'Failed to calculate health score' });
    }
});

function generateHealthRecommendations(score, customer) {
    const recommendations = [];
    
    if (score < 80) {
        recommendations.push({
            priority: 'high',
            action: 'Schedule executive check-in',
            reason: 'Health score below threshold'
        });
    }
    
    if (customer.utilization_rate < 0.8) {
        recommendations.push({
            priority: 'medium',
            action: 'Provide additional training',
            reason: 'Low platform utilization'
        });
    }
    
    if (customer.support_tickets > 5) {
        recommendations.push({
            priority: 'high',
            action: 'Assign dedicated support',
            reason: 'High support ticket volume'
        });
    }
    
    return recommendations;
}

// Initialize database tables
async function initializeDatabase() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS enterprise_leads (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255) UNIQUE,
                phone VARCHAR(50),
                company VARCHAR(255),
                title VARCHAR(255),
                industry VARCHAR(100),
                containers INTEGER,
                annual_savings VARCHAR(50),
                roi_percentage VARCHAR(50),
                lead_score INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS email_queue (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER,
                template VARCHAR(100),
                scheduled_at TIMESTAMP,
                sent_at TIMESTAMP,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS contracts (
                id VARCHAR(50) PRIMARY KEY,
                deal_id VARCHAR(50),
                company VARCHAR(255),
                value DECIMAL(10, 2),
                term_months INTEGER,
                start_date DATE,
                features JSONB,
                sla JSONB,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Start server
const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
    console.log(`Enterprise Sales Automation running on port ${PORT}`);
    initializeDatabase();
});

module.exports = app;