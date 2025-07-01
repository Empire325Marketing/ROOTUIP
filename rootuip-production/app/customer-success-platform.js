const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const sgMail = require('@sendgrid/mail');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'your-sendgrid-api-key');

// HubSpot Configuration
const HUBSPOT_CONFIG = {
    accessToken: process.env.HUBSPOT_TOKEN || 'your-hubspot-access-token',
    baseUrl: 'https://api.hubapi.com',
    portalId: process.env.HUBSPOT_PORTAL_ID || '8751929'
};

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/customer_success'
});

// ==================== ONBOARDING SYSTEM ====================

// Create new customer onboarding
app.post('/api/onboarding/create', async (req, res) => {
    try {
        const { customerId, companyName, contractValue, primaryContact } = req.body;
        const onboardingId = uuidv4();
        
        // Create onboarding workflow
        const workflow = await createOnboardingWorkflow(onboardingId, customerId, companyName);
        
        // Create implementation project
        const project = await createImplementationProject(onboardingId, customerId);
        
        // Schedule automated tasks
        await scheduleOnboardingTasks(onboardingId, customerId, primaryContact);
        
        // Send welcome email
        await sendWelcomeEmail(primaryContact, companyName, onboardingId);
        
        res.json({
            success: true,
            onboardingId,
            workflow,
            project,
            message: 'Onboarding initiated successfully'
        });
    } catch (error) {
        console.error('Onboarding creation error:', error);
        res.status(500).json({ error: 'Failed to create onboarding' });
    }
});

// Track milestone completion
app.post('/api/onboarding/milestone/complete', async (req, res) => {
    try {
        const { onboardingId, milestoneId, completedBy, notes } = req.body;
        
        await db.query(`
            UPDATE onboarding_milestones 
            SET status = 'completed', 
                completed_at = NOW(), 
                completed_by = $3,
                notes = $4
            WHERE onboarding_id = $1 AND milestone_id = $2
        `, [onboardingId, milestoneId, completedBy, notes]);
        
        // Check if all milestones completed
        const result = await db.query(`
            SELECT COUNT(*) as remaining 
            FROM onboarding_milestones 
            WHERE onboarding_id = $1 AND status != 'completed'
        `, [onboardingId]);
        
        if (result.rows[0].remaining === '0') {
            await initiateGoLiveCelebration(onboardingId);
        }
        
        res.json({ success: true, message: 'Milestone completed' });
    } catch (error) {
        console.error('Milestone completion error:', error);
        res.status(500).json({ error: 'Failed to complete milestone' });
    }
});

// ==================== HEALTH MONITORING ====================

// Get customer health dashboard
app.get('/api/health/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        
        // Gather health metrics
        const usageAnalytics = await getUsageAnalytics(customerId);
        const featureAdoption = await getFeatureAdoption(customerId);
        const engagementScore = await calculateEngagementScore(customerId);
        const churnRisk = await assessChurnRisk(customerId);
        const expansionOpportunities = await identifyExpansionOpportunities(customerId);
        
        const healthScore = calculateOverallHealthScore({
            usage: usageAnalytics,
            adoption: featureAdoption,
            engagement: engagementScore,
            risk: churnRisk
        });
        
        res.json({
            customerId,
            healthScore,
            metrics: {
                usageAnalytics,
                featureAdoption,
                engagementScore,
                churnRisk,
                expansionOpportunities
            },
            alerts: generateHealthAlerts(healthScore, churnRisk),
            recommendations: generateHealthRecommendations(healthScore)
        });
    } catch (error) {
        console.error('Health monitoring error:', error);
        res.status(500).json({ error: 'Failed to get health metrics' });
    }
});

// Real-time usage tracking
app.post('/api/health/track-usage', async (req, res) => {
    try {
        const { customerId, feature, action, metadata } = req.body;
        
        await db.query(`
            INSERT INTO usage_tracking 
            (customer_id, feature, action, metadata, tracked_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [customerId, feature, action, JSON.stringify(metadata)]);
        
        // Check for usage anomalies
        await checkUsageAnomalies(customerId);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Usage tracking error:', error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

// ==================== SUPPORT OPERATIONS ====================

// Create support ticket
app.post('/api/support/ticket/create', async (req, res) => {
    try {
        const { customerId, title, description, priority, category, reportedBy } = req.body;
        const ticketId = uuidv4();
        
        // Create ticket with SLA
        const sla = calculateSLA(priority, customerId);
        
        await db.query(`
            INSERT INTO support_tickets 
            (ticket_id, customer_id, title, description, priority, category, 
             reported_by, sla_deadline, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW())
        `, [ticketId, customerId, title, description, priority, category, 
            reportedBy, sla.deadline]);
        
        // Auto-assign based on category and priority
        await autoAssignTicket(ticketId, category, priority);
        
        // Send acknowledgment
        await sendTicketAcknowledgment(reportedBy, ticketId, sla);
        
        res.json({
            success: true,
            ticketId,
            sla,
            message: 'Ticket created successfully'
        });
    } catch (error) {
        console.error('Ticket creation error:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// AI-powered knowledge base search
app.get('/api/support/kb/search', async (req, res) => {
    try {
        const { query, customerId } = req.query;
        
        // Search knowledge base with AI
        const articles = await searchKnowledgeBase(query);
        
        // Get personalized recommendations
        const recommendations = await getPersonalizedArticles(customerId, query);
        
        // Track search for analytics
        await trackKBSearch(customerId, query);
        
        res.json({
            results: articles,
            recommendations,
            totalResults: articles.length
        });
    } catch (error) {
        console.error('KB search error:', error);
        res.status(500).json({ error: 'Failed to search knowledge base' });
    }
});

// ==================== SUCCESS MANAGEMENT ====================

// Generate Executive Business Review
app.post('/api/success/ebr/generate', async (req, res) => {
    try {
        const { customerId, period, attendees } = req.body;
        
        // Gather comprehensive data
        const usageData = await getComprehensiveUsageData(customerId, period);
        const roiMetrics = await calculateROIMetrics(customerId, period);
        const achievements = await getCustomerAchievements(customerId, period);
        const recommendations = await generateStrategicRecommendations(customerId);
        
        // Generate EBR document
        const ebrDocument = await generateEBRDocument({
            customerId,
            period,
            usageData,
            roiMetrics,
            achievements,
            recommendations
        });
        
        // Schedule EBR meeting
        const meeting = await scheduleEBRMeeting(customerId, attendees);
        
        res.json({
            success: true,
            ebrDocument,
            meeting,
            dashboardUrl: `/ebr/${customerId}/${period}`
        });
    } catch (error) {
        console.error('EBR generation error:', error);
        res.status(500).json({ error: 'Failed to generate EBR' });
    }
});

// Certification program management
app.post('/api/success/certification/enroll', async (req, res) => {
    try {
        const { customerId, userId, certificationLevel } = req.body;
        const enrollmentId = uuidv4();
        
        // Create certification path
        const certificationPath = await createCertificationPath(
            userId, 
            certificationLevel
        );
        
        // Enroll user
        await db.query(`
            INSERT INTO certification_enrollments
            (enrollment_id, customer_id, user_id, certification_level, 
             path_id, status, enrolled_at)
            VALUES ($1, $2, $3, $4, $5, 'active', NOW())
        `, [enrollmentId, customerId, userId, certificationLevel, 
            certificationPath.pathId]);
        
        // Send welcome materials
        await sendCertificationWelcome(userId, certificationLevel);
        
        res.json({
            success: true,
            enrollmentId,
            certificationPath,
            message: 'Enrolled in certification program'
        });
    } catch (error) {
        console.error('Certification enrollment error:', error);
        res.status(500).json({ error: 'Failed to enroll in certification' });
    }
});

// ==================== RETENTION OPTIMIZATION ====================

// Identify upsell opportunities
app.get('/api/retention/upsell-opportunities/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        
        // Analyze usage patterns
        const usagePatterns = await analyzeUsagePatterns(customerId);
        const featureLimits = await checkFeatureLimits(customerId);
        const userGrowth = await analyzeUserGrowth(customerId);
        
        // Generate opportunities
        const opportunities = generateUpsellOpportunities({
            usage: usagePatterns,
            limits: featureLimits,
            growth: userGrowth
        });
        
        // Calculate potential value
        const potentialValue = calculateUpsellValue(opportunities);
        
        res.json({
            opportunities,
            potentialValue,
            recommendations: prioritizeOpportunities(opportunities)
        });
    } catch (error) {
        console.error('Upsell identification error:', error);
        res.status(500).json({ error: 'Failed to identify upsell opportunities' });
    }
});

// Automated renewal process
app.post('/api/retention/renewal/initiate', async (req, res) => {
    try {
        const { customerId, renewalDate } = req.body;
        const renewalId = uuidv4();
        
        // Get customer data
        const customerData = await getCustomerRenewalData(customerId);
        
        // Calculate renewal terms
        const renewalTerms = await calculateRenewalTerms(customerData);
        
        // Create renewal workflow
        await db.query(`
            INSERT INTO renewal_workflows
            (renewal_id, customer_id, current_contract_value, proposed_value,
             renewal_date, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 'initiated', NOW())
        `, [renewalId, customerId, customerData.contractValue, 
            renewalTerms.proposedValue, renewalDate]);
        
        // Schedule renewal activities
        await scheduleRenewalActivities(renewalId, customerId, renewalDate);
        
        res.json({
            success: true,
            renewalId,
            renewalTerms,
            timeline: generateRenewalTimeline(renewalDate)
        });
    } catch (error) {
        console.error('Renewal initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate renewal' });
    }
});

// Success story creation
app.post('/api/retention/success-story/create', async (req, res) => {
    try {
        const { customerId, storyType, metrics, quotes } = req.body;
        const storyId = uuidv4();
        
        // Validate metrics and achievements
        const validatedMetrics = await validateSuccessMetrics(customerId, metrics);
        
        // Create story draft
        const storyDraft = await createSuccessStoryDraft({
            customerId,
            storyType,
            metrics: validatedMetrics,
            quotes
        });
        
        // Create approval workflow
        await createApprovalWorkflow(storyId, customerId, 'success_story');
        
        res.json({
            success: true,
            storyId,
            draft: storyDraft,
            approvalProcess: `/approval/${storyId}`
        });
    } catch (error) {
        console.error('Success story creation error:', error);
        res.status(500).json({ error: 'Failed to create success story' });
    }
});

// ==================== HELPER FUNCTIONS ====================

async function createOnboardingWorkflow(onboardingId, customerId, companyName) {
    const milestones = [
        { phase: 'kickoff', name: 'Kickoff Meeting', daysFromStart: 0 },
        { phase: 'technical', name: 'Technical Setup', daysFromStart: 3 },
        { phase: 'data', name: 'Data Migration', daysFromStart: 7 },
        { phase: 'training', name: 'User Training', daysFromStart: 14 },
        { phase: 'testing', name: 'UAT Testing', daysFromStart: 21 },
        { phase: 'golive', name: 'Go Live', daysFromStart: 30 }
    ];
    
    for (const milestone of milestones) {
        await db.query(`
            INSERT INTO onboarding_milestones
            (milestone_id, onboarding_id, phase, name, target_date, status)
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${milestone.daysFromStart} days', 'pending')
        `, [uuidv4(), onboardingId, milestone.phase, milestone.name]);
    }
    
    return milestones;
}

async function calculateEngagementScore(customerId) {
    const result = await db.query(`
        SELECT 
            COUNT(DISTINCT user_id) as active_users,
            COUNT(DISTINCT DATE(tracked_at)) as active_days,
            COUNT(*) as total_actions
        FROM usage_tracking
        WHERE customer_id = $1 
        AND tracked_at > NOW() - INTERVAL '30 days'
    `, [customerId]);
    
    const data = result.rows[0];
    const score = (
        (data.active_users * 0.4) +
        (data.active_days * 0.3) +
        (Math.min(data.total_actions / 1000, 1) * 0.3)
    ) * 100;
    
    return Math.round(score);
}

async function assessChurnRisk(customerId) {
    // Multiple risk factors
    const usageDecline = await checkUsageDecline(customerId);
    const supportTickets = await getRecentTicketCount(customerId);
    const lastLogin = await getLastLoginDays(customerId);
    const contractHealth = await getContractHealth(customerId);
    
    const riskScore = (
        (usageDecline * 0.35) +
        (Math.min(supportTickets / 10, 1) * 0.25) +
        (Math.min(lastLogin / 30, 1) * 0.2) +
        ((1 - contractHealth) * 0.2)
    );
    
    return {
        score: Math.round(riskScore * 100),
        factors: {
            usageDecline,
            supportTickets,
            lastLogin,
            contractHealth
        },
        level: riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low'
    };
}

async function calculateSLA(priority, customerId) {
    const contractValue = await getContractValue(customerId);
    
    let hours;
    if (priority === 'critical') {
        hours = contractValue >= 1000000 ? 1 : 2;
    } else if (priority === 'high') {
        hours = contractValue >= 1000000 ? 4 : 8;
    } else if (priority === 'medium') {
        hours = 24;
    } else {
        hours = 48;
    }
    
    return {
        hours,
        deadline: new Date(Date.now() + hours * 60 * 60 * 1000)
    };
}

async function generateROIMetrics(customerId, period) {
    const metrics = await db.query(`
        SELECT 
            baseline_metrics,
            current_metrics,
            cost_savings,
            efficiency_gains,
            revenue_impact
        FROM roi_tracking
        WHERE customer_id = $1
        AND period = $2
    `, [customerId, period]);
    
    const data = metrics.rows[0] || {};
    
    return {
        totalROI: calculateTotalROI(data),
        costSavings: data.cost_savings || 0,
        efficiencyGains: data.efficiency_gains || 0,
        revenueImpact: data.revenue_impact || 0,
        paybackPeriod: calculatePaybackPeriod(data)
    };
}

// ==================== AUTOMATED TASKS ====================

// Health monitoring cron job
cron.schedule('0 */6 * * *', async () => {
    console.log('Running health monitoring checks...');
    
    const customers = await db.query(`
        SELECT customer_id FROM customers WHERE status = 'active'
    `);
    
    for (const customer of customers.rows) {
        const health = await assessChurnRisk(customer.customer_id);
        
        if (health.level === 'high') {
            await createHealthAlert(customer.customer_id, health);
            await notifyCustomerSuccessManager(customer.customer_id, health);
        }
    }
});

// SLA monitoring cron job
cron.schedule('*/15 * * * *', async () => {
    console.log('Checking SLA compliance...');
    
    const tickets = await db.query(`
        SELECT * FROM support_tickets 
        WHERE status NOT IN ('closed', 'resolved')
        AND sla_deadline < NOW() + INTERVAL '1 hour'
    `);
    
    for (const ticket of tickets.rows) {
        await escalateTicket(ticket.ticket_id);
        await notifySLABreach(ticket);
    }
});

// Renewal reminder cron job
cron.schedule('0 9 * * *', async () => {
    console.log('Checking upcoming renewals...');
    
    const renewals = await db.query(`
        SELECT * FROM customers 
        WHERE contract_end_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        AND renewal_status != 'initiated'
    `);
    
    for (const customer of renewals.rows) {
        await initiateRenewalProcess(customer.customer_id);
    }
});

// ==================== API ENDPOINTS ====================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Onboarding tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS onboarding_milestones (
                milestone_id UUID PRIMARY KEY,
                onboarding_id UUID,
                phase VARCHAR(50),
                name VARCHAR(200),
                target_date TIMESTAMP,
                completed_at TIMESTAMP,
                completed_by VARCHAR(200),
                status VARCHAR(50),
                notes TEXT
            )
        `);

        // Health monitoring tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS usage_tracking (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(200),
                feature VARCHAR(100),
                action VARCHAR(100),
                metadata JSONB,
                tracked_at TIMESTAMP
            )
        `);

        // Support tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                ticket_id UUID PRIMARY KEY,
                customer_id VARCHAR(200),
                title VARCHAR(500),
                description TEXT,
                priority VARCHAR(50),
                category VARCHAR(100),
                reported_by VARCHAR(200),
                assigned_to VARCHAR(200),
                sla_deadline TIMESTAMP,
                status VARCHAR(50),
                created_at TIMESTAMP,
                resolved_at TIMESTAMP
            )
        `);

        // Success management tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS certification_enrollments (
                enrollment_id UUID PRIMARY KEY,
                customer_id VARCHAR(200),
                user_id VARCHAR(200),
                certification_level VARCHAR(50),
                path_id UUID,
                progress INTEGER DEFAULT 0,
                status VARCHAR(50),
                enrolled_at TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        // Retention tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS renewal_workflows (
                renewal_id UUID PRIMARY KEY,
                customer_id VARCHAR(200),
                current_contract_value DECIMAL,
                proposed_value DECIMAL,
                renewal_date DATE,
                status VARCHAR(50),
                created_at TIMESTAMP,
                completed_at TIMESTAMP
            )
        `);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Customer Success Platform running on port ${PORT}`);
    console.log(`🎯 HubSpot integration: ${HUBSPOT_CONFIG.portalId}`);
    console.log(`📧 SendGrid configured for automated emails`);
    console.log(`📊 Health monitoring: Every 6 hours`);
    console.log(`💰 ROI tracking and EBR generation active`);
    await initializeDatabase();
});

module.exports = app;