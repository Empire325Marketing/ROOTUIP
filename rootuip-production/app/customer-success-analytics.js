// ROOTUIP Customer Success Analytics & Health Scoring System
// Customer health scoring, churn prediction, feature adoption tracking

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const helmet = require('helmet');

class CustomerSuccessAnalytics {
    constructor() {
        this.app = express();
        this.port = process.env.CS_ANALYTICS_PORT || 3016;
        
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
                new winston.transports.File({ filename: 'logs/customer-success.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Health scoring configuration
        this.healthScoringConfig = {
            weights: {
                usage: 0.30,           // Platform usage frequency and depth
                engagement: 0.25,      // Feature adoption and user activity
                support: 0.20,         // Support ticket volume and resolution
                financial: 0.15,       // Payment history and contract status
                growth: 0.10           // Account expansion and feature requests
            },
            
            thresholds: {
                healthy: 80,
                atRisk: 60,
                critical: 40
            },
            
            timeframes: {
                recent: 30,    // days
                trend: 90,     // days
                historical: 365 // days
            }
        };
        
        // Feature adoption tracking
        this.featureTracking = {
            coreFeatures: [
                'container_tracking',
                'alert_management',
                'reporting',
                'api_integration'
            ],
            
            advancedFeatures: [
                'predictive_analytics',
                'custom_dashboards',
                'bulk_operations',
                'automated_workflows'
            ],
            
            adoptionStages: {
                trial: 'Feature accessed < 5 times',
                adoption: 'Feature accessed 5-20 times',
                champion: 'Feature accessed > 20 times'
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startAnalyticsEngine();
    }
    
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(express.json({ limit: '10mb' }));
        
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
        
        // Customer health overview
        this.app.get('/api/customer-success/overview', async (req, res) => {
            try {
                const overview = await this.getCustomerSuccessOverview();
                res.json(overview);
            } catch (error) {
                this.logger.error('Customer success overview failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Individual customer health score
        this.app.get('/api/customer-success/health/:customerId', async (req, res) => {
            try {
                const { customerId } = req.params;
                const health = await this.getCustomerHealthScore(customerId);
                res.json(health);
            } catch (error) {
                this.logger.error('Customer health score failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Churn prediction
        this.app.get('/api/customer-success/churn-prediction', async (req, res) => {
            try {
                const { timeframe = '90d' } = req.query;
                const predictions = await this.getChurnPredictions(timeframe);
                res.json(predictions);
            } catch (error) {
                this.logger.error('Churn prediction failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Feature adoption analytics
        this.app.get('/api/customer-success/feature-adoption', async (req, res) => {
            try {
                const { customerId, timeframe = '30d' } = req.query;
                const adoption = await this.getFeatureAdoption(customerId, timeframe);
                res.json(adoption);
            } catch (error) {
                this.logger.error('Feature adoption failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Customer journey analytics
        this.app.get('/api/customer-success/journey/:customerId', async (req, res) => {
            try {
                const { customerId } = req.params;
                const journey = await this.getCustomerJourney(customerId);
                res.json(journey);
            } catch (error) {
                this.logger.error('Customer journey failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Usage patterns
        this.app.get('/api/customer-success/usage-patterns', async (req, res) => {
            try {
                const { segment, timeframe = '30d' } = req.query;
                const patterns = await this.getUsagePatterns(segment, timeframe);
                res.json(patterns);
            } catch (error) {
                this.logger.error('Usage patterns failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Support ticket analysis
        this.app.get('/api/customer-success/support-analysis', async (req, res) => {
            try {
                const { customerId, timeframe = '90d' } = req.query;
                const analysis = await this.getSupportAnalysis(customerId, timeframe);
                res.json(analysis);
            } catch (error) {
                this.logger.error('Support analysis failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Customer segmentation
        this.app.get('/api/customer-success/segmentation', async (req, res) => {
            try {
                const segmentation = await this.getCustomerSegmentation();
                res.json(segmentation);
            } catch (error) {
                this.logger.error('Customer segmentation failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Success metrics
        this.app.get('/api/customer-success/metrics', async (req, res) => {
            try {
                const { timeframe = '30d' } = req.query;
                const metrics = await this.getSuccessMetrics(timeframe);
                res.json(metrics);
            } catch (error) {
                this.logger.error('Success metrics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Update customer health score
        this.app.post('/api/customer-success/health/:customerId/update', async (req, res) => {
            try {
                const { customerId } = req.params;
                const result = await this.updateCustomerHealthScore(customerId);
                res.json(result);
            } catch (error) {
                this.logger.error('Health score update failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async getCustomerSuccessOverview() {
        const cacheKey = 'cs:overview';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const [
            healthDistribution,
            churnRisk,
            featureAdoptionOverview,
            supportMetrics
        ] = await Promise.all([
            this.getHealthDistribution(),
            this.getChurnRiskOverview(),
            this.getFeatureAdoptionOverview(),
            this.getSupportMetricsOverview()
        ]);
        
        const overview = {
            healthDistribution,
            churnRisk,
            featureAdoption: featureAdoptionOverview,
            support: supportMetrics,
            timestamp: new Date().toISOString()
        };
        
        // Cache for 1 hour
        await this.redis.setex(cacheKey, 3600, JSON.stringify(overview));
        
        return overview;
    }
    
    async getCustomerHealthScore(customerId) {
        const cacheKey = `cs:health:${customerId}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const [
            usageScore,
            engagementScore,
            supportScore,
            financialScore,
            growthScore
        ] = await Promise.all([
            this.calculateUsageScore(customerId),
            this.calculateEngagementScore(customerId),
            this.calculateSupportScore(customerId),
            this.calculateFinancialScore(customerId),
            this.calculateGrowthScore(customerId)
        ]);
        
        const weights = this.healthScoringConfig.weights;
        const overallScore = Math.round(
            (usageScore * weights.usage) +
            (engagementScore * weights.engagement) +
            (supportScore * weights.support) +
            (financialScore * weights.financial) +
            (growthScore * weights.growth)
        );
        
        const healthStatus = this.determineHealthStatus(overallScore);
        const trends = await this.getHealthTrends(customerId);
        const risks = await this.identifyRisks(customerId);
        const recommendations = await this.generateRecommendations(customerId, {
            usage: usageScore,
            engagement: engagementScore,
            support: supportScore,
            financial: financialScore,
            growth: growthScore
        });
        
        const healthData = {
            customerId,
            overallScore,
            healthStatus,
            scoreBreakdown: {
                usage: usageScore,
                engagement: engagementScore,
                support: supportScore,
                financial: financialScore,
                growth: growthScore
            },
            trends,
            risks,
            recommendations,
            lastUpdated: new Date().toISOString()
        };
        
        // Cache for 30 minutes
        await this.redis.setex(cacheKey, 1800, JSON.stringify(healthData));
        
        // Store in database for historical tracking
        await this.storeHealthScore(healthData);
        
        return healthData;
    }
    
    async calculateUsageScore(customerId) {
        const query = `
            SELECT 
                COUNT(DISTINCT DATE(created_at)) as active_days,
                COUNT(*) as total_actions,
                COUNT(DISTINCT feature_name) as features_used,
                AVG(session_duration) as avg_session_duration
            FROM user_activity ua
            JOIN users u ON ua.user_id = u.id
            WHERE u.company_id = $1
            AND ua.created_at >= NOW() - INTERVAL '30 days'
        `;
        
        const result = await this.db.query(query, [customerId]);
        const data = result.rows[0];
        
        if (!data || data.total_actions === '0') {
            return 0;
        }
        
        // Scoring factors
        const activeDays = parseInt(data.active_days);
        const totalActions = parseInt(data.total_actions);
        const featuresUsed = parseInt(data.features_used);
        const avgSessionDuration = parseFloat(data.avg_session_duration) || 0;
        
        // Calculate score components (0-100)
        const frequencyScore = Math.min((activeDays / 30) * 100, 100);
        const volumeScore = Math.min((totalActions / 100) * 100, 100);
        const diversityScore = Math.min((featuresUsed / 10) * 100, 100);
        const engagementScore = Math.min((avgSessionDuration / 1800) * 100, 100); // 30 minutes = 100%
        
        return Math.round((frequencyScore + volumeScore + diversityScore + engagementScore) / 4);
    }
    
    async calculateEngagementScore(customerId) {
        const queries = {
            featureAdoption: `
                SELECT 
                    feature_name,
                    COUNT(*) as usage_count,
                    MIN(created_at) as first_used
                FROM feature_usage fu
                JOIN users u ON fu.user_id = u.id
                WHERE u.company_id = $1
                AND fu.created_at >= NOW() - INTERVAL '90 days'
                GROUP BY feature_name
            `,
            
            userGrowth: `
                SELECT COUNT(*) as active_users
                FROM users 
                WHERE company_id = $1
                AND last_login >= NOW() - INTERVAL '30 days'
            `,
            
            dataQuality: `
                SELECT 
                    COUNT(*) as total_containers,
                    COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as containers_with_data
                FROM containers 
                WHERE company_id = $1
                AND created_at >= NOW() - INTERVAL '30 days'
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query, [customerId]);
            results[key] = result.rows;
        }
        
        // Calculate engagement metrics
        const coreFeatures = this.featureTracking.coreFeatures;
        const adoptedCoreFeatures = results.featureAdoption.filter(f => 
            coreFeatures.includes(f.feature_name) && parseInt(f.usage_count) >= 5
        ).length;
        
        const advancedFeatures = this.featureTracking.advancedFeatures;
        const adoptedAdvancedFeatures = results.featureAdoption.filter(f => 
            advancedFeatures.includes(f.feature_name) && parseInt(f.usage_count) >= 3
        ).length;
        
        const activeUsers = parseInt(results.userGrowth[0]?.active_users || 0);
        const dataQuality = results.dataQuality[0] ? 
            parseInt(results.dataQuality[0].containers_with_data) / Math.max(parseInt(results.dataQuality[0].total_containers), 1) : 0;
        
        // Scoring components
        const coreAdoptionScore = (adoptedCoreFeatures / coreFeatures.length) * 100;
        const advancedAdoptionScore = (adoptedAdvancedFeatures / advancedFeatures.length) * 50; // 50% weight
        const userEngagementScore = Math.min(activeUsers * 10, 100); // 10 points per active user, max 100
        const dataQualityScore = dataQuality * 100;
        
        return Math.round((coreAdoptionScore + advancedAdoptionScore + userEngagementScore + dataQualityScore) / 4);
    }
    
    async calculateSupportScore(customerId) {
        const query = `
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tickets,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours,
                COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_tickets
            FROM support_tickets 
            WHERE company_id = $1
            AND created_at >= NOW() - INTERVAL '90 days'
        `;
        
        const result = await this.db.query(query, [customerId]);
        const data = result.rows[0];
        
        if (!data) {
            return 100; // No tickets = healthy
        }
        
        const totalTickets = parseInt(data.total_tickets);
        const highPriorityTickets = parseInt(data.high_priority_tickets);
        const resolvedTickets = parseInt(data.resolved_tickets);
        const avgResolutionHours = parseFloat(data.avg_resolution_hours) || 0;
        const recentTickets = parseInt(data.recent_tickets);
        
        if (totalTickets === 0) {
            return 100;
        }
        
        // Scoring factors (lower is better for support score)
        const volumeScore = Math.max(100 - (totalTickets * 2), 0); // 2 points deduction per ticket
        const severityScore = Math.max(100 - (highPriorityTickets * 10), 0); // 10 points deduction per high priority
        const resolutionScore = (resolvedTickets / totalTickets) * 100; // Resolution rate
        const recentActivityScore = Math.max(100 - (recentTickets * 5), 0); // Recent activity penalty
        
        return Math.round((volumeScore + severityScore + resolutionScore + recentActivityScore) / 4);
    }
    
    async calculateFinancialScore(customerId) {
        const query = `
            SELECT 
                c.contract_value,
                c.contract_start_date,
                c.contract_end_date,
                c.payment_status,
                COUNT(p.id) as payment_count,
                COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
                MAX(p.payment_date) as last_payment_date
            FROM customer_contracts c
            LEFT JOIN payments p ON c.id = p.contract_id
            WHERE c.company_id = $1
            AND c.status = 'active'
            GROUP BY c.id, c.contract_value, c.contract_start_date, c.contract_end_date, c.payment_status
        `;
        
        const result = await this.db.query(query, [customerId]);
        
        if (result.rows.length === 0) {
            return 50; // No contract data
        }
        
        const data = result.rows[0];
        const contractValue = parseFloat(data.contract_value) || 0;
        const paymentCount = parseInt(data.payment_count);
        const failedPayments = parseInt(data.failed_payments);
        const paymentStatus = data.payment_status;
        
        // Scoring factors
        const paymentStatusScore = paymentStatus === 'current' ? 100 : 
                                 paymentStatus === 'overdue' ? 50 : 0;
        const paymentHistoryScore = paymentCount > 0 ? 
            Math.max(100 - (failedPayments / paymentCount * 100), 0) : 100;
        const contractValueScore = Math.min(contractValue / 100000 * 100, 100); // $100k = 100%
        
        return Math.round((paymentStatusScore + paymentHistoryScore + contractValueScore) / 3);
    }
    
    async calculateGrowthScore(customerId) {
        const queries = {
            containerGrowth: `
                SELECT 
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_containers,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END) as previous_containers
                FROM containers 
                WHERE company_id = $1
            `,
            
            userGrowth: `
                SELECT 
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_users,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END) as previous_users
                FROM users 
                WHERE company_id = $1
            `,
            
            featureRequests: `
                SELECT COUNT(*) as feature_requests
                FROM feature_requests 
                WHERE company_id = $1
                AND created_at >= NOW() - INTERVAL '90 days'
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query, [customerId]);
            results[key] = result.rows[0];
        }
        
        // Calculate growth metrics
        const recentContainers = parseInt(results.containerGrowth.recent_containers);
        const previousContainers = parseInt(results.containerGrowth.previous_containers);
        const containerGrowthRate = previousContainers > 0 ? 
            ((recentContainers - previousContainers) / previousContainers) * 100 : 
            recentContainers > 0 ? 100 : 0;
        
        const recentUsers = parseInt(results.userGrowth.recent_users);
        const previousUsers = parseInt(results.userGrowth.previous_users);
        const userGrowthRate = previousUsers > 0 ? 
            ((recentUsers - previousUsers) / previousUsers) * 100 : 
            recentUsers > 0 ? 100 : 0;
        
        const featureRequests = parseInt(results.featureRequests.feature_requests);
        
        // Scoring components
        const containerGrowthScore = Math.min(Math.max(containerGrowthRate + 50, 0), 100);
        const userGrowthScore = Math.min(Math.max(userGrowthRate + 50, 0), 100);
        const engagementScore = Math.min(featureRequests * 10, 100); // 10 points per feature request
        
        return Math.round((containerGrowthScore + userGrowthScore + engagementScore) / 3);
    }
    
    determineHealthStatus(score) {
        const thresholds = this.healthScoringConfig.thresholds;
        
        if (score >= thresholds.healthy) {
            return 'healthy';
        } else if (score >= thresholds.atRisk) {
            return 'at_risk';
        } else {
            return 'critical';
        }
    }
    
    async getChurnPredictions(timeframe) {
        const cacheKey = `cs:churn:${timeframe}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        // Get customers with low health scores and declining trends
        const query = `
            SELECT 
                c.id,
                c.company_name,
                h.overall_score,
                h.health_status,
                h.score_breakdown,
                h.last_updated,
                cc.contract_end_date
            FROM companies c
            LEFT JOIN customer_health_scores h ON c.id = h.customer_id
            LEFT JOIN customer_contracts cc ON c.id = cc.company_id AND cc.status = 'active'
            WHERE h.overall_score IS NOT NULL
            ORDER BY h.overall_score ASC
        `;
        
        const result = await this.db.query(query);
        
        // Apply churn prediction model
        const predictions = result.rows.map(customer => {
            const churnProbability = this.calculateChurnProbability(customer);
            const daysToChurn = this.estimateDaysToChurn(customer);
            const churnReason = this.identifyChurnReason(customer);
            
            return {
                customerId: customer.id,
                companyName: customer.company_name,
                currentHealthScore: customer.overall_score,
                healthStatus: customer.health_status,
                churnProbability: churnProbability,
                estimatedDaysToChurn: daysToChurn,
                primaryChurnReason: churnReason,
                contractEndDate: customer.contract_end_date,
                recommendedActions: this.getChurnPreventionActions(customer, churnReason)
            };
        });
        
        // Sort by churn probability
        predictions.sort((a, b) => b.churnProbability - a.churnProbability);
        
        const churnData = {
            predictions: predictions.slice(0, 50), // Top 50 at-risk customers
            summary: {
                highRisk: predictions.filter(p => p.churnProbability >= 0.7).length,
                mediumRisk: predictions.filter(p => p.churnProbability >= 0.4 && p.churnProbability < 0.7).length,
                lowRisk: predictions.filter(p => p.churnProbability < 0.4).length
            },
            timeframe: timeframe,
            timestamp: new Date().toISOString()
        };
        
        // Cache for 2 hours
        await this.redis.setex(cacheKey, 7200, JSON.stringify(churnData));
        
        return churnData;
    }
    
    calculateChurnProbability(customer) {
        const healthScore = customer.overall_score || 50;
        const scoreBreakdown = customer.score_breakdown || {};
        
        // Base probability based on health score
        let probability = Math.max(0, (100 - healthScore) / 100);
        
        // Adjust based on specific factors
        if (scoreBreakdown.usage < 30) probability += 0.2;
        if (scoreBreakdown.engagement < 40) probability += 0.15;
        if (scoreBreakdown.support < 50) probability += 0.1;
        if (scoreBreakdown.financial < 60) probability += 0.25;
        
        // Contract end date proximity
        if (customer.contract_end_date) {
            const daysToEnd = Math.ceil((new Date(customer.contract_end_date) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysToEnd < 90) probability += 0.2;
            if (daysToEnd < 30) probability += 0.3;
        }
        
        return Math.min(probability, 1.0);
    }
    
    estimateDaysToChurn(customer) {
        const churnProb = this.calculateChurnProbability(customer);
        const healthScore = customer.overall_score || 50;
        
        if (churnProb >= 0.8) return 30;
        if (churnProb >= 0.6) return 60;
        if (churnProb >= 0.4) return 120;
        
        return Math.max(180, healthScore * 2);
    }
    
    identifyChurnReason(customer) {
        const scoreBreakdown = customer.score_breakdown || {};
        
        const reasons = [
            { factor: 'financial', score: scoreBreakdown.financial || 50, reason: 'Payment issues' },
            { factor: 'usage', score: scoreBreakdown.usage || 50, reason: 'Low platform usage' },
            { factor: 'support', score: scoreBreakdown.support || 50, reason: 'Support issues' },
            { factor: 'engagement', score: scoreBreakdown.engagement || 50, reason: 'Poor feature adoption' },
            { factor: 'growth', score: scoreBreakdown.growth || 50, reason: 'No account growth' }
        ];
        
        // Find the lowest scoring factor
        const primaryReason = reasons.reduce((min, current) => 
            current.score < min.score ? current : min
        );
        
        return primaryReason.reason;
    }
    
    getChurnPreventionActions(customer, churnReason) {
        const actionMap = {
            'Payment issues': [
                'Contact billing team to resolve payment issues',
                'Offer payment plan options',
                'Review contract terms'
            ],
            'Low platform usage': [
                'Schedule platform training session',
                'Provide usage best practices guide',
                'Assign customer success manager'
            ],
            'Support issues': [
                'Escalate to senior support team',
                'Schedule executive check-in call',
                'Review support ticket history'
            ],
            'Poor feature adoption': [
                'Provide feature adoption workshop',
                'Create custom onboarding plan',
                'Share relevant case studies'
            ],
            'No account growth': [
                'Discuss expansion opportunities',
                'Present advanced feature benefits',
                'Connect with other successful customers'
            ]
        };
        
        return actionMap[churnReason] || ['Schedule customer success review'];
    }
    
    async getFeatureAdoption(customerId, timeframe) {
        const whereClause = customerId ? 
            `WHERE u.company_id = '${customerId}' AND fu.created_at >= NOW() - INTERVAL '${timeframe}'` :
            `WHERE fu.created_at >= NOW() - INTERVAL '${timeframe}'`;
        
        const query = `
            SELECT 
                fu.feature_name,
                COUNT(DISTINCT fu.user_id) as unique_users,
                COUNT(*) as total_usage,
                AVG(fu.session_duration) as avg_session_duration,
                MIN(fu.created_at) as first_used,
                MAX(fu.created_at) as last_used
            FROM feature_usage fu
            JOIN users u ON fu.user_id = u.id
            ${whereClause}
            GROUP BY fu.feature_name
            ORDER BY total_usage DESC
        `;
        
        const result = await this.db.query(query);
        
        const features = result.rows.map(row => {
            const usageCount = parseInt(row.total_usage);
            const adoptionStage = usageCount < 5 ? 'trial' : 
                                usageCount < 20 ? 'adoption' : 'champion';
            
            return {
                featureName: row.feature_name,
                uniqueUsers: parseInt(row.unique_users),
                totalUsage: usageCount,
                avgSessionDuration: parseFloat(row.avg_session_duration),
                adoptionStage: adoptionStage,
                firstUsed: row.first_used,
                lastUsed: row.last_used,
                isCore: this.featureTracking.coreFeatures.includes(row.feature_name),
                isAdvanced: this.featureTracking.advancedFeatures.includes(row.feature_name)
            };
        });
        
        return {
            features: features,
            summary: {
                coreAdoption: features.filter(f => f.isCore && f.adoptionStage !== 'trial').length,
                advancedAdoption: features.filter(f => f.isAdvanced && f.adoptionStage !== 'trial').length,
                totalFeatures: features.length
            },
            timeframe: timeframe,
            timestamp: new Date().toISOString()
        };
    }
    
    startAnalyticsEngine() {
        this.logger.info('Starting customer success analytics engine');
        
        // Update health scores hourly
        setInterval(() => {
            this.updateAllHealthScores();
        }, 3600000); // 1 hour
        
        // Generate weekly reports
        setInterval(() => {
            this.generateWeeklyReports();
        }, 7 * 24 * 3600000); // 1 week
        
        // Process churn alerts daily
        setInterval(() => {
            this.processChurnAlerts();
        }, 24 * 3600000); // 1 day
    }
    
    async updateAllHealthScores() {
        try {
            const companies = await this.db.query('SELECT id FROM companies WHERE status = \'active\'');
            
            for (const company of companies.rows) {
                await this.updateCustomerHealthScore(company.id);
                // Add small delay to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.logger.info(`Updated health scores for ${companies.rows.length} customers`);
            
        } catch (error) {
            this.logger.error('Health score update failed:', error);
        }
    }
    
    async updateCustomerHealthScore(customerId) {
        try {
            // Clear cache to force recalculation
            await this.redis.del(`cs:health:${customerId}`);
            
            // Recalculate health score
            const healthData = await this.getCustomerHealthScore(customerId);
            
            return {
                success: true,
                customerId: customerId,
                healthScore: healthData.overallScore,
                healthStatus: healthData.healthStatus
            };
            
        } catch (error) {
            this.logger.error(`Health score update failed for customer ${customerId}:`, error);
            return {
                success: false,
                customerId: customerId,
                error: error.message
            };
        }
    }
    
    async storeHealthScore(healthData) {
        const query = `
            INSERT INTO customer_health_scores (
                customer_id, overall_score, health_status, score_breakdown,
                trends, risks, recommendations, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (customer_id) 
            DO UPDATE SET 
                overall_score = $2,
                health_status = $3,
                score_breakdown = $4,
                trends = $5,
                risks = $6,
                recommendations = $7,
                last_updated = NOW()
        `;
        
        await this.db.query(query, [
            healthData.customerId,
            healthData.overallScore,
            healthData.healthStatus,
            JSON.stringify(healthData.scoreBreakdown),
            JSON.stringify(healthData.trends),
            JSON.stringify(healthData.risks),
            JSON.stringify(healthData.recommendations)
        ]);
    }
    
    start() {
        this.server = this.app.listen(this.port, () => {
            this.logger.info(`Customer Success Analytics running on port ${this.port}`);
            console.log(`👥 ROOTUIP Customer Success Analytics`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Overview: http://localhost:${this.port}/api/customer-success/overview`);
            console.log(`   Health Scoring: http://localhost:${this.port}/api/customer-success/health/:customerId`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down customer success analytics...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Database schema for customer success analytics
const createCustomerSuccessTables = `
    CREATE TABLE IF NOT EXISTS customer_health_scores (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID UNIQUE NOT NULL,
        overall_score INTEGER NOT NULL,
        health_status VARCHAR(20) NOT NULL,
        score_breakdown JSONB,
        trends JSONB,
        risks JSONB,
        recommendations JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS feature_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        feature_name VARCHAR(100) NOT NULL,
        session_duration INTEGER,
        usage_context JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS customer_journey_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_health_scores_customer ON customer_health_scores(customer_id);
    CREATE INDEX IF NOT EXISTS idx_health_scores_status ON customer_health_scores(health_status);
    CREATE INDEX IF NOT EXISTS idx_feature_usage_user ON feature_usage(user_id);
    CREATE INDEX IF NOT EXISTS idx_feature_usage_feature ON feature_usage(feature_name);
    CREATE INDEX IF NOT EXISTS idx_journey_events_customer ON customer_journey_events(customer_id);
`;

// Start customer success analytics if called directly
if (require.main === module) {
    const csAnalytics = new CustomerSuccessAnalytics();
    
    // Initialize database schema
    csAnalytics.db.query(createCustomerSuccessTables).then(() => {
        csAnalytics.start();
    }).catch(error => {
        console.error('Failed to initialize customer success analytics:', error);
        process.exit(1);
    });
}

module.exports = CustomerSuccessAnalytics;