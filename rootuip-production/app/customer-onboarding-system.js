// ROOTUIP Customer Onboarding and Success Management System
// Complete customer journey from contract signature to full deployment

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const sgMail = require('@sendgrid/mail');
const hubspot = require('@hubspot/api-client');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

class CustomerOnboardingSystem {
    constructor() {
        this.app = express();
        this.port = process.env.ONBOARDING_PORT || 3012;
        
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
                new winston.transports.File({ filename: 'logs/customer-onboarding.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Configure SendGrid
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        // Configure HubSpot
        this.hubspotClient = new hubspot.Client({
            accessToken: process.env.HUBSPOT_ACCESS_TOKEN
        });
        
        // Onboarding timeline and milestones
        this.onboardingPhases = {
            'contract_signed': {
                duration: 1,
                name: 'Contract Execution',
                tasks: [
                    'Contract signature confirmation',
                    'Technical requirements gathering',
                    'Project team assignment',
                    'Kickoff meeting scheduling'
                ]
            },
            'technical_discovery': {
                duration: 5,
                name: 'Technical Discovery',
                tasks: [
                    'System architecture review',
                    'API credential setup',
                    'Integration mapping',
                    'Security requirements validation',
                    'Data migration planning'
                ]
            },
            'environment_setup': {
                duration: 10,
                name: 'Environment Setup',
                tasks: [
                    'Development environment provisioning',
                    'API integrations configuration',
                    'Database schema deployment',
                    'Security configuration',
                    'Monitoring setup'
                ]
            },
            'data_migration': {
                duration: 7,
                name: 'Data Migration',
                tasks: [
                    'Historical data extraction',
                    'Data validation and cleansing',
                    'Migration testing',
                    'Data integrity verification',
                    'Rollback procedures testing'
                ]
            },
            'integration_testing': {
                duration: 10,
                name: 'Integration Testing',
                tasks: [
                    'Carrier API testing',
                    'ERP system integration',
                    'Real-time data flow validation',
                    'Performance testing',
                    'User acceptance testing'
                ]
            },
            'user_training': {
                duration: 5,
                name: 'User Training',
                tasks: [
                    'Administrator training',
                    'End-user training sessions',
                    'Documentation handover',
                    'Support procedures training',
                    'Best practices workshop'
                ]
            },
            'go_live': {
                duration: 5,
                name: 'Go-Live Support',
                tasks: [
                    'Production deployment',
                    'Go-live monitoring',
                    'Issue resolution',
                    'Performance optimization',
                    'Success metrics validation'
                ]
            },
            'post_launch': {
                duration: 7,
                name: 'Post-Launch Optimization',
                tasks: [
                    '30-day performance review',
                    'ROI measurement',
                    'Process optimization',
                    'Additional training',
                    'Success celebration'
                ]
            }
        };
        
        // Email templates for onboarding
        this.emailTemplates = {
            contractSigned: 'd-contract-signed-template',
            kickoffScheduled: 'd-kickoff-scheduled-template',
            phaseCompleted: 'd-phase-completed-template',
            milestoneAchieved: 'd-milestone-achieved-template',
            trainingScheduled: 'd-training-scheduled-template',
            goLiveNotification: 'd-go-live-notification-template',
            successMetrics: 'd-success-metrics-template'
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startOnboardingEngine();
    }
    
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(express.json({ limit: '10mb' }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
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
        
        // Start customer onboarding
        this.app.post('/api/onboarding/start', async (req, res) => {
            try {
                const customerData = req.body;
                const result = await this.startOnboarding(customerData);
                
                res.json({
                    success: true,
                    onboardingId: result.onboardingId,
                    timeline: result.timeline
                });
                
            } catch (error) {
                this.logger.error('Onboarding start failed:', error);
                res.status(500).json({
                    error: 'Failed to start onboarding',
                    message: error.message
                });
            }
        });
        
        // Get onboarding status
        this.app.get('/api/onboarding/:onboardingId/status', async (req, res) => {
            try {
                const { onboardingId } = req.params;
                const status = await this.getOnboardingStatus(onboardingId);
                res.json(status);
            } catch (error) {
                this.logger.error('Get onboarding status failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Update phase completion
        this.app.post('/api/onboarding/:onboardingId/phase/:phase/complete', async (req, res) => {
            try {
                const { onboardingId, phase } = req.params;
                const { completedBy, notes } = req.body;
                
                const result = await this.completePhase(onboardingId, phase, completedBy, notes);
                res.json(result);
            } catch (error) {
                this.logger.error('Phase completion failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Schedule training session
        this.app.post('/api/onboarding/:onboardingId/training/schedule', async (req, res) => {
            try {
                const { onboardingId } = req.params;
                const trainingData = req.body;
                
                const result = await this.scheduleTraining(onboardingId, trainingData);
                res.json(result);
            } catch (error) {
                this.logger.error('Training scheduling failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Customer dashboard
        this.app.get('/api/onboarding/:onboardingId/dashboard', async (req, res) => {
            try {
                const { onboardingId } = req.params;
                const dashboard = await this.getCustomerDashboard(onboardingId);
                res.json(dashboard);
            } catch (error) {
                this.logger.error('Customer dashboard failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Success metrics tracking
        this.app.post('/api/onboarding/:onboardingId/metrics', async (req, res) => {
            try {
                const { onboardingId } = req.params;
                const metrics = req.body;
                
                const result = await this.recordSuccessMetrics(onboardingId, metrics);
                res.json(result);
            } catch (error) {
                this.logger.error('Metrics recording failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Onboarding analytics
        this.app.get('/api/onboarding/analytics', async (req, res) => {
            try {
                const analytics = await this.getOnboardingAnalytics();
                res.json(analytics);
            } catch (error) {
                this.logger.error('Onboarding analytics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async startOnboarding(customerData) {
        const onboardingId = `onb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create onboarding record
        await this.createOnboardingRecord(onboardingId, customerData);
        
        // Generate timeline
        const timeline = this.generateOnboardingTimeline(customerData);
        
        // Store timeline in database
        await this.storeOnboardingTimeline(onboardingId, timeline);
        
        // Create HubSpot deal
        await this.createHubSpotDeal(customerData, onboardingId);
        
        // Send welcome email
        await this.sendWelcomeEmail(customerData, timeline);
        
        // Schedule kickoff meeting
        await this.scheduleKickoffMeeting(onboardingId, customerData);
        
        // Create project team assignments
        await this.assignProjectTeam(onboardingId, customerData);
        
        this.logger.info('Onboarding started', {
            onboardingId,
            company: customerData.companyName,
            estimatedCompletion: timeline.estimatedCompletion
        });
        
        return { onboardingId, timeline };
    }
    
    generateOnboardingTimeline(customerData) {
        const startDate = new Date();
        const timeline = {
            phases: [],
            estimatedCompletion: null,
            totalDuration: 0
        };
        
        let currentDate = new Date(startDate);
        
        for (const [phaseKey, phase] of Object.entries(this.onboardingPhases)) {
            const phaseStart = new Date(currentDate);
            const phaseEnd = new Date(currentDate);
            phaseEnd.setDate(phaseEnd.getDate() + phase.duration);
            
            timeline.phases.push({
                key: phaseKey,
                name: phase.name,
                duration: phase.duration,
                startDate: phaseStart.toISOString(),
                endDate: phaseEnd.toISOString(),
                status: 'pending',
                tasks: phase.tasks.map(task => ({
                    name: task,
                    status: 'pending',
                    assignee: null,
                    completedAt: null
                }))
            });
            
            currentDate = new Date(phaseEnd);
            timeline.totalDuration += phase.duration;
        }
        
        timeline.estimatedCompletion = currentDate.toISOString();
        
        // Adjust timeline based on customer complexity
        if (customerData.complexity === 'high') {
            timeline.totalDuration = Math.ceil(timeline.totalDuration * 1.3);
        } else if (customerData.complexity === 'low') {
            timeline.totalDuration = Math.ceil(timeline.totalDuration * 0.8);
        }
        
        return timeline;
    }
    
    async createOnboardingRecord(onboardingId, customerData) {
        const query = `
            INSERT INTO customer_onboarding (
                onboarding_id, company_name, contact_name, contact_email, 
                contract_value, complexity, industry, container_volume,
                start_date, status, customer_data, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'started', $9, NOW())
        `;
        
        await this.db.query(query, [
            onboardingId,
            customerData.companyName,
            customerData.contactName,
            customerData.contactEmail,
            customerData.contractValue,
            customerData.complexity || 'medium',
            customerData.industry,
            customerData.containerVolume,
            JSON.stringify(customerData)
        ]);
    }
    
    async storeOnboardingTimeline(onboardingId, timeline) {
        const query = `
            UPDATE customer_onboarding 
            SET timeline = $1, estimated_completion = $2
            WHERE onboarding_id = $3
        `;
        
        await this.db.query(query, [
            JSON.stringify(timeline),
            timeline.estimatedCompletion,
            onboardingId
        ]);
    }
    
    async createHubSpotDeal(customerData, onboardingId) {
        try {
            const properties = {
                dealname: `ROOTUIP Implementation - ${customerData.companyName}`,
                amount: customerData.contractValue?.toString(),
                closedate: new Date().toISOString().split('T')[0],
                dealstage: 'contractsent',
                pipeline: 'default',
                onboarding_id: onboardingId,
                implementation_complexity: customerData.complexity || 'medium'
            };
            
            const SimplePublicObjectInput = {
                properties: properties
            };
            
            const response = await this.hubspotClient.crm.deals.basicApi.create(SimplePublicObjectInput);
            
            this.logger.info('HubSpot deal created', {
                dealId: response.id,
                onboardingId
            });
            
            return response.id;
            
        } catch (error) {
            this.logger.error('HubSpot deal creation failed:', error);
        }
    }
    
    async sendWelcomeEmail(customerData, timeline) {
        try {
            const msg = {
                to: customerData.contactEmail,
                from: {
                    email: 'success@rootuip.com',
                    name: 'ROOTUIP Customer Success Team'
                },
                templateId: this.emailTemplates.contractSigned,
                dynamicTemplateData: {
                    customer_name: customerData.contactName,
                    company_name: customerData.companyName,
                    estimated_completion: new Date(timeline.estimatedCompletion).toLocaleDateString(),
                    total_duration: timeline.totalDuration,
                    project_manager: 'Sarah Johnson',
                    onboarding_portal: `https://app.rootuip.com/onboarding?id=${customerData.onboardingId}`
                }
            };
            
            await sgMail.send(msg);
            
            this.logger.info('Welcome email sent', {
                email: customerData.contactEmail,
                template: 'contractSigned'
            });
            
        } catch (error) {
            this.logger.error('Welcome email failed:', error);
        }
    }
    
    async scheduleKickoffMeeting(onboardingId, customerData) {
        // Schedule kickoff meeting for next business day
        const kickoffDate = this.getNextBusinessDay();
        
        const meetingData = {
            onboardingId,
            type: 'kickoff',
            scheduledFor: kickoffDate.toISOString(),
            attendees: [
                customerData.contactEmail,
                'success@rootuip.com',
                'technical@rootuip.com'
            ],
            agenda: [
                'Project overview and timeline review',
                'Technical requirements validation',
                'Team introductions',
                'Communication protocols',
                'Next steps and action items'
            ]
        };
        
        await this.storeMeeting(meetingData);
        
        // Send calendar invitation
        await this.sendKickoffInvitation(customerData, kickoffDate);
    }
    
    async assignProjectTeam(onboardingId, customerData) {
        const team = {
            projectManager: 'Sarah Johnson',
            technicalLead: 'Michael Chen',
            customerSuccess: 'Jessica Williams',
            supportEngineer: 'David Rodriguez'
        };
        
        // Determine team based on customer size and complexity
        if (customerData.containerVolume > 50000) {
            team.seniorArchitect = 'Alex Thompson';
        }
        
        if (customerData.complexity === 'high') {
            team.integrationSpecialist = 'Maria Garcia';
        }
        
        const query = `
            UPDATE customer_onboarding 
            SET project_team = $1
            WHERE onboarding_id = $2
        `;
        
        await this.db.query(query, [
            JSON.stringify(team),
            onboardingId
        ]);
        
        return team;
    }
    
    async completePhase(onboardingId, phaseKey, completedBy, notes) {
        // Update phase status
        const query = `
            UPDATE customer_onboarding 
            SET current_phase = $1,
                timeline = jsonb_set(
                    timeline,
                    '{phases}',
                    (
                        SELECT jsonb_agg(
                            CASE 
                                WHEN phase->>'key' = $2 
                                THEN jsonb_set(phase, '{status}', '"completed"')
                                ELSE phase
                            END
                        )
                        FROM jsonb_array_elements(timeline->'phases') AS phase
                    )
                )
            WHERE onboarding_id = $3
            RETURNING company_name, contact_email
        `;
        
        const result = await this.db.query(query, [phaseKey, phaseKey, onboardingId]);
        
        if (result.rows.length === 0) {
            throw new Error('Onboarding record not found');
        }
        
        const customer = result.rows[0];
        
        // Record phase completion
        await this.recordPhaseCompletion(onboardingId, phaseKey, completedBy, notes);
        
        // Send phase completion notification
        await this.sendPhaseCompletionEmail(customer, phaseKey);
        
        // Check if this triggers next phase
        await this.checkPhaseTransitions(onboardingId);
        
        this.logger.info('Phase completed', {
            onboardingId,
            phase: phaseKey,
            completedBy
        });
        
        return { success: true, phase: phaseKey, status: 'completed' };
    }
    
    async recordSuccessMetrics(onboardingId, metrics) {
        const query = `
            INSERT INTO onboarding_metrics (
                onboarding_id, metric_type, metric_value, measurement_date,
                baseline_value, target_value, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `;
        
        for (const metric of metrics) {
            await this.db.query(query, [
                onboardingId,
                metric.type,
                metric.value,
                metric.date || new Date().toISOString(),
                metric.baseline,
                metric.target,
                metric.notes
            ]);
        }
        
        // Calculate ROI achievement
        const roiMetrics = metrics.filter(m => m.type === 'cost_savings' || m.type === 'efficiency_gain');
        if (roiMetrics.length > 0) {
            await this.calculateAndRecordROI(onboardingId, roiMetrics);
        }
        
        return { success: true, metricsRecorded: metrics.length };
    }
    
    async getOnboardingStatus(onboardingId) {
        const query = `
            SELECT 
                o.*,
                COALESCE(
                    (
                        SELECT jsonb_agg(m.*)
                        FROM onboarding_metrics m 
                        WHERE m.onboarding_id = o.onboarding_id
                        ORDER BY m.created_at DESC
                        LIMIT 10
                    ),
                    '[]'::jsonb
                ) as recent_metrics
            FROM customer_onboarding o
            WHERE o.onboarding_id = $1
        `;
        
        const result = await this.db.query(query, [onboardingId]);
        
        if (result.rows.length === 0) {
            throw new Error('Onboarding record not found');
        }
        
        const onboarding = result.rows[0];
        
        // Calculate progress percentage
        const timeline = onboarding.timeline;
        if (timeline && timeline.phases) {
            const totalPhases = timeline.phases.length;
            const completedPhases = timeline.phases.filter(p => p.status === 'completed').length;
            onboarding.progressPercentage = Math.round((completedPhases / totalPhases) * 100);
        }
        
        return onboarding;
    }
    
    async getCustomerDashboard(onboardingId) {
        const [onboarding, metrics, meetings, team] = await Promise.all([
            this.getOnboardingStatus(onboardingId),
            this.getMetricsSummary(onboardingId),
            this.getUpcomingMeetings(onboardingId),
            this.getProjectTeam(onboardingId)
        ]);
        
        return {
            onboarding,
            metrics,
            meetings,
            team,
            lastUpdated: new Date().toISOString()
        };
    }
    
    async getOnboardingAnalytics() {
        const queries = {
            activeOnboardings: `
                SELECT COUNT(*) as count
                FROM customer_onboarding 
                WHERE status IN ('started', 'in_progress')
            `,
            averageDuration: `
                SELECT AVG(EXTRACT(DAY FROM completed_at - start_date)) as avg_days
                FROM customer_onboarding 
                WHERE status = 'completed'
                AND completed_at > NOW() - INTERVAL '6 months'
            `,
            successRate: `
                SELECT 
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as success_rate
                FROM customer_onboarding 
                WHERE created_at > NOW() - INTERVAL '6 months'
            `,
            phaseBreakdown: `
                SELECT 
                    current_phase,
                    COUNT(*) as count
                FROM customer_onboarding 
                WHERE status IN ('started', 'in_progress')
                GROUP BY current_phase
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        return results;
    }
    
    getNextBusinessDay() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        
        // Skip weekends
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() + 1);
        }
        
        return date;
    }
    
    startOnboardingEngine() {
        // Check for overdue phases every hour
        setInterval(async () => {
            await this.checkOverduePhases();
        }, 3600000);
        
        // Send weekly progress reports
        setInterval(async () => {
            await this.sendWeeklyProgressReports();
        }, 7 * 24 * 3600000);
        
        this.logger.info('Onboarding automation engine started');
    }
    
    async checkOverduePhases() {
        const query = `
            SELECT onboarding_id, company_name, contact_email, current_phase, timeline
            FROM customer_onboarding 
            WHERE status IN ('started', 'in_progress')
            AND timeline IS NOT NULL
        `;
        
        const result = await this.db.query(query);
        
        for (const onboarding of result.rows) {
            const timeline = onboarding.timeline;
            if (!timeline.phases) continue;
            
            const currentPhase = timeline.phases.find(p => p.key === onboarding.current_phase);
            if (!currentPhase) continue;
            
            const endDate = new Date(currentPhase.endDate);
            const now = new Date();
            
            if (now > endDate && currentPhase.status !== 'completed') {
                await this.handleOverduePhase(onboarding, currentPhase);
            }
        }
    }
    
    start() {
        this.app.listen(this.port, () => {
            this.logger.info(`Customer Onboarding System running on port ${this.port}`);
            console.log(`👥 ROOTUIP Customer Onboarding System`);
            console.log(`   Port: ${this.port}`);
            console.log(`   SendGrid: ${process.env.SENDGRID_API_KEY ? 'Configured' : 'Not configured'}`);
            console.log(`   HubSpot: ${process.env.HUBSPOT_ACCESS_TOKEN ? 'Configured' : 'Not configured'}`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down onboarding system...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Database schema for onboarding system
const createOnboardingTables = `
    CREATE TABLE IF NOT EXISTS customer_onboarding (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        onboarding_id VARCHAR(100) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contract_value DECIMAL(15,2),
        complexity VARCHAR(20) DEFAULT 'medium',
        industry VARCHAR(100),
        container_volume INTEGER,
        start_date TIMESTAMP WITH TIME ZONE,
        estimated_completion TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        current_phase VARCHAR(50),
        status VARCHAR(50) DEFAULT 'started',
        timeline JSONB,
        project_team JSONB,
        customer_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS onboarding_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        onboarding_id VARCHAR(100) REFERENCES customer_onboarding(onboarding_id),
        metric_type VARCHAR(100) NOT NULL,
        metric_value DECIMAL(15,2) NOT NULL,
        measurement_date TIMESTAMP WITH TIME ZONE,
        baseline_value DECIMAL(15,2),
        target_value DECIMAL(15,2),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS onboarding_meetings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        onboarding_id VARCHAR(100) REFERENCES customer_onboarding(onboarding_id),
        meeting_type VARCHAR(50) NOT NULL,
        scheduled_for TIMESTAMP WITH TIME ZONE,
        attendees JSONB,
        agenda JSONB,
        status VARCHAR(20) DEFAULT 'scheduled',
        meeting_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_onboarding_status ON customer_onboarding(status);
    CREATE INDEX IF NOT EXISTS idx_onboarding_phase ON customer_onboarding(current_phase);
    CREATE INDEX IF NOT EXISTS idx_onboarding_created ON customer_onboarding(created_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_onboarding ON onboarding_metrics(onboarding_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_onboarding ON onboarding_meetings(onboarding_id);
`;

// Start server if called directly
if (require.main === module) {
    const onboardingSystem = new CustomerOnboardingSystem();
    
    // Initialize database schema
    onboardingSystem.db.query(createOnboardingTables).then(() => {
        onboardingSystem.start();
    }).catch(error => {
        console.error('Failed to initialize onboarding system:', error);
        process.exit(1);
    });
}

module.exports = CustomerOnboardingSystem;