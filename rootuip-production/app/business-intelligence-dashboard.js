// ROOTUIP Business Intelligence Dashboard
// Customer analytics, revenue tracking, and market intelligence

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

class BusinessIntelligenceDashboard {
    constructor() {
        this.app = express();
        this.port = process.env.BI_PORT || 3014;
        
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
                new winston.transports.File({ filename: 'logs/business-intelligence.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Analytics configuration
        this.analyticsConfig = {
            retentionPeriods: {
                realtime: 24,      // 24 hours
                daily: 90,         // 90 days
                monthly: 24,       // 24 months
                yearly: 10         // 10 years
            },
            cacheTTL: {
                realtime: 300,     // 5 minutes
                daily: 3600,       // 1 hour
                monthly: 86400     // 24 hours
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startAnalyticsEngine();
    }
    
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('public'));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 1000,
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
        
        // Executive dashboard
        this.app.get('/api/dashboard/executive', async (req, res) => {
            try {
                const dashboard = await this.getExecutiveDashboard();
                res.json(dashboard);
            } catch (error) {
                this.logger.error('Executive dashboard failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Customer analytics
        this.app.get('/api/analytics/customers', async (req, res) => {
            try {
                const { timeframe = '30d', segment } = req.query;
                const analytics = await this.getCustomerAnalytics(timeframe, segment);
                res.json(analytics);
            } catch (error) {
                this.logger.error('Customer analytics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Revenue analytics
        this.app.get('/api/analytics/revenue', async (req, res) => {
            try {
                const { timeframe = '12m', breakdown = 'monthly' } = req.query;
                const analytics = await this.getRevenueAnalytics(timeframe, breakdown);
                res.json(analytics);
            } catch (error) {
                this.logger.error('Revenue analytics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Platform performance metrics
        this.app.get('/api/analytics/platform', async (req, res) => {
            try {
                const { timeframe = '7d' } = req.query;
                const metrics = await this.getPlatformMetrics(timeframe);
                res.json(metrics);
            } catch (error) {
                this.logger.error('Platform metrics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Market intelligence
        this.app.get('/api/intelligence/market', async (req, res) => {
            try {
                const intelligence = await this.getMarketIntelligence();
                res.json(intelligence);
            } catch (error) {
                this.logger.error('Market intelligence failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Usage analytics
        this.app.get('/api/analytics/usage', async (req, res) => {
            try {
                const { customerId, timeframe = '30d' } = req.query;
                const usage = await this.getUsageAnalytics(customerId, timeframe);
                res.json(usage);
            } catch (error) {
                this.logger.error('Usage analytics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Predictive analytics
        this.app.get('/api/analytics/predictions', async (req, res) => {
            try {
                const { type = 'churn', horizon = '90d' } = req.query;
                const predictions = await this.getPredictiveAnalytics(type, horizon);
                res.json(predictions);
            } catch (error) {
                this.logger.error('Predictive analytics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Custom reports
        this.app.post('/api/reports/custom', async (req, res) => {
            try {
                const reportConfig = req.body;
                const report = await this.generateCustomReport(reportConfig);
                res.json(report);
            } catch (error) {
                this.logger.error('Custom report generation failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Real-time metrics
        this.app.get('/api/realtime/metrics', async (req, res) => {
            try {
                const metrics = await this.getRealtimeMetrics();
                res.json(metrics);
            } catch (error) {
                this.logger.error('Realtime metrics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async getExecutiveDashboard() {
        const cacheKey = 'dashboard:executive';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const [
            revenueMetrics,
            customerMetrics,
            platformMetrics,
            growthMetrics
        ] = await Promise.all([
            this.getRevenueOverview(),
            this.getCustomerOverview(),
            this.getPlatformOverview(),
            this.getGrowthOverview()
        ]);
        
        const dashboard = {
            revenue: revenueMetrics,
            customers: customerMetrics,
            platform: platformMetrics,
            growth: growthMetrics,
            timestamp: new Date().toISOString()
        };
        
        // Cache for 5 minutes
        await this.redis.setex(cacheKey, this.analyticsConfig.cacheTTL.realtime, JSON.stringify(dashboard));
        
        return dashboard;
    }
    
    async getRevenueOverview() {
        const queries = {
            currentMRR: `
                SELECT COALESCE(SUM(contract_value / 12), 0) as mrr
                FROM customer_contracts 
                WHERE status = 'active'
                AND contract_type = 'annual'
            `,
            
            quarterlyRevenue: `
                SELECT 
                    DATE_TRUNC('quarter', contract_start_date) as quarter,
                    SUM(contract_value) as revenue
                FROM customer_contracts 
                WHERE contract_start_date >= NOW() - INTERVAL '2 years'
                GROUP BY quarter
                ORDER BY quarter
            `,
            
            revenueGrowth: `
                SELECT 
                    COALESCE(
                        (current_quarter.revenue - previous_quarter.revenue) * 100.0 / 
                        NULLIF(previous_quarter.revenue, 0), 
                        0
                    ) as growth_rate
                FROM (
                    SELECT SUM(contract_value) as revenue
                    FROM customer_contracts 
                    WHERE contract_start_date >= DATE_TRUNC('quarter', NOW())
                ) current_quarter,
                (
                    SELECT SUM(contract_value) as revenue
                    FROM customer_contracts 
                    WHERE contract_start_date >= DATE_TRUNC('quarter', NOW()) - INTERVAL '3 months'
                    AND contract_start_date < DATE_TRUNC('quarter', NOW())
                ) previous_quarter
            `,
            
            arrForecast: `
                SELECT 
                    SUM(contract_value) as current_arr,
                    SUM(contract_value * 1.25) as projected_arr  -- 25% growth assumption
                FROM customer_contracts 
                WHERE status = 'active'
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        return {
            mrr: parseFloat(results.currentMRR[0]?.mrr || 0),
            quarterlyTrend: results.quarterlyRevenue,
            growthRate: parseFloat(results.revenueGrowth[0]?.growth_rate || 0),
            arr: {
                current: parseFloat(results.arrForecast[0]?.current_arr || 0),
                projected: parseFloat(results.arrForecast[0]?.projected_arr || 0)
            }
        };
    }
    
    async getCustomerOverview() {
        const queries = {
            totalCustomers: `
                SELECT COUNT(*) as total
                FROM companies 
                WHERE status = 'active'
            `,
            
            newCustomers: `
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as new_customers
                FROM companies 
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY month
                ORDER BY month
            `,
            
            customerSegments: `
                SELECT 
                    CASE 
                        WHEN annual_container_volume >= 50000 THEN 'Enterprise'
                        WHEN annual_container_volume >= 10000 THEN 'Mid-Market'
                        ELSE 'SMB'
                    END as segment,
                    COUNT(*) as count,
                    AVG(annual_container_volume) as avg_volume
                FROM companies 
                WHERE status = 'active'
                GROUP BY segment
            `,
            
            churnRate: `
                SELECT 
                    COUNT(CASE WHEN status = 'churned' THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0) as churn_rate
                FROM companies 
                WHERE created_at >= NOW() - INTERVAL '3 months'
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        return {
            total: parseInt(results.totalCustomers[0]?.total || 0),
            acquisitionTrend: results.newCustomers,
            segments: results.customerSegments,
            churnRate: parseFloat(results.churnRate[0]?.churn_rate || 0)
        };
    }
    
    async getPlatformOverview() {
        const queries = {
            containersTracked: `
                SELECT COUNT(*) as total
                FROM containers 
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `,
            
            apiPerformance: `
                SELECT 
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0) as error_rate
                FROM api_usage 
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            `,
            
            uptime: `
                SELECT 
                    COUNT(CASE WHEN status = 'healthy' THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0) as uptime_percentage
                FROM system_health_checks 
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `,
            
            costSavings: `
                SELECT SUM(amount_saved) as total_savings
                FROM detention_savings 
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        return {
            containersTracked: parseInt(results.containersTracked[0]?.total || 0),
            performance: {
                responseTime: parseFloat(results.apiPerformance[0]?.avg_response_time || 0),
                errorRate: parseFloat(results.apiPerformance[0]?.error_rate || 0),
                uptime: parseFloat(results.uptime[0]?.uptime_percentage || 99.9)
            },
            costSavings: parseFloat(results.costSavings[0]?.total_savings || 0)
        };
    }
    
    async getGrowthOverview() {
        const queries = {
            userGrowth: `
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as new_users
                FROM users 
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY month
                ORDER BY month
            `,
            
            usageGrowth: `
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as containers_added
                FROM containers 
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY month
                ORDER BY month
            `,
            
            featureAdoption: `
                SELECT 
                    feature_name,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) as total_usage
                FROM feature_usage 
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY feature_name
                ORDER BY total_usage DESC
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        return {
            userGrowth: results.userGrowth,
            usageGrowth: results.usageGrowth,
            featureAdoption: results.featureAdoption
        };
    }
    
    async getCustomerAnalytics(timeframe, segment) {
        const cacheKey = `analytics:customers:${timeframe}:${segment || 'all'}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const whereClause = this.buildTimeframeClause(timeframe);
        const segmentClause = segment ? `AND customer_segment = '${segment}'` : '';
        
        const queries = {
            engagement: `
                SELECT 
                    user_id,
                    COUNT(DISTINCT DATE(created_at)) as active_days,
                    COUNT(*) as total_actions,
                    MAX(created_at) as last_activity
                FROM user_activity 
                WHERE ${whereClause} ${segmentClause}
                GROUP BY user_id
            `,
            
            featureUsage: `
                SELECT 
                    feature_name,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) as usage_count,
                    AVG(session_duration) as avg_session_duration
                FROM feature_usage 
                WHERE ${whereClause} ${segmentClause}
                GROUP BY feature_name
            `,
            
            cohortAnalysis: `
                SELECT 
                    DATE_TRUNC('month', u.created_at) as cohort_month,
                    DATE_TRUNC('month', a.created_at) as activity_month,
                    COUNT(DISTINCT a.user_id) as active_users
                FROM users u
                LEFT JOIN user_activity a ON u.id = a.user_id
                WHERE u.created_at >= NOW() - INTERVAL '12 months'
                GROUP BY cohort_month, activity_month
                ORDER BY cohort_month, activity_month
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        const analytics = {
            engagement: this.calculateEngagementMetrics(results.engagement),
            featureUsage: results.featureUsage,
            cohortAnalysis: this.processCohortData(results.cohortAnalysis),
            timestamp: new Date().toISOString()
        };
        
        // Cache for 1 hour
        await this.redis.setex(cacheKey, this.analyticsConfig.cacheTTL.daily, JSON.stringify(analytics));
        
        return analytics;
    }
    
    async getRevenueAnalytics(timeframe, breakdown) {
        const cacheKey = `analytics:revenue:${timeframe}:${breakdown}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const truncateClause = breakdown === 'daily' ? 'day' : 
                              breakdown === 'weekly' ? 'week' : 'month';
        
        const queries = {
            revenueTimeSeries: `
                SELECT 
                    DATE_TRUNC('${truncateClause}', contract_start_date) as period,
                    SUM(contract_value) as revenue,
                    COUNT(*) as contracts,
                    AVG(contract_value) as avg_contract_value
                FROM customer_contracts 
                WHERE contract_start_date >= NOW() - INTERVAL '${timeframe}'
                GROUP BY period
                ORDER BY period
            `,
            
            revenueBySegment: `
                SELECT 
                    c.customer_segment,
                    SUM(cc.contract_value) as revenue,
                    COUNT(*) as contracts,
                    AVG(cc.contract_value) as avg_contract_value
                FROM customer_contracts cc
                JOIN companies c ON cc.company_id = c.id
                WHERE cc.contract_start_date >= NOW() - INTERVAL '${timeframe}'
                GROUP BY c.customer_segment
            `,
            
            revenueByIndustry: `
                SELECT 
                    c.industry,
                    SUM(cc.contract_value) as revenue,
                    COUNT(*) as contracts
                FROM customer_contracts cc
                JOIN companies c ON cc.company_id = c.id
                WHERE cc.contract_start_date >= NOW() - INTERVAL '${timeframe}'
                GROUP BY c.industry
                ORDER BY revenue DESC
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        const analytics = {
            timeSeries: results.revenueTimeSeries,
            bySegment: results.revenueBySegment,
            byIndustry: results.revenueByIndustry,
            breakdown: breakdown,
            timestamp: new Date().toISOString()
        };
        
        // Cache for 1 hour
        await this.redis.setex(cacheKey, this.analyticsConfig.cacheTTL.daily, JSON.stringify(analytics));
        
        return analytics;
    }
    
    async getPlatformMetrics(timeframe) {
        const whereClause = this.buildTimeframeClause(timeframe);
        
        const queries = {
            apiMetrics: `
                SELECT 
                    DATE_TRUNC('hour', created_at) as hour,
                    endpoint,
                    COUNT(*) as requests,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
                FROM api_usage 
                WHERE ${whereClause}
                GROUP BY hour, endpoint
                ORDER BY hour
            `,
            
            systemHealth: `
                SELECT 
                    service_name,
                    AVG(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) * 100 as uptime_percentage,
                    AVG(response_time_ms) as avg_response_time
                FROM system_health_checks 
                WHERE ${whereClause}
                GROUP BY service_name
            `,
            
            errorAnalysis: `
                SELECT 
                    error_type,
                    COUNT(*) as occurrences,
                    COUNT(DISTINCT user_id) as affected_users
                FROM error_logs 
                WHERE ${whereClause}
                GROUP BY error_type
                ORDER BY occurrences DESC
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        return {
            api: this.processApiMetrics(results.apiMetrics),
            systemHealth: results.systemHealth,
            errors: results.errorAnalysis,
            timestamp: new Date().toISOString()
        };
    }
    
    async getMarketIntelligence() {
        const cacheKey = 'intelligence:market';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const queries = {
            industryTrends: `
                SELECT 
                    industry,
                    COUNT(*) as customers,
                    AVG(annual_container_volume) as avg_volume,
                    SUM(annual_container_volume) as total_volume
                FROM companies 
                WHERE status = 'active'
                GROUP BY industry
                ORDER BY total_volume DESC
            `,
            
            carrierDistribution: `
                SELECT 
                    carrier_code,
                    COUNT(DISTINCT company_id) as customers,
                    COUNT(*) as containers
                FROM containers 
                WHERE created_at >= NOW() - INTERVAL '90 days'
                GROUP BY carrier_code
                ORDER BY containers DESC
            `,
            
            routeAnalysis: `
                SELECT 
                    origin_port,
                    destination_port,
                    COUNT(*) as shipments,
                    AVG(transit_time_days) as avg_transit_time
                FROM containers 
                WHERE created_at >= NOW() - INTERVAL '90 days'
                AND transit_time_days IS NOT NULL
                GROUP BY origin_port, destination_port
                HAVING COUNT(*) >= 10
                ORDER BY shipments DESC
                LIMIT 20
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = result.rows;
        }
        
        const intelligence = {
            industryTrends: results.industryTrends,
            carrierDistribution: results.carrierDistribution,
            popularRoutes: results.routeAnalysis,
            marketInsights: this.generateMarketInsights(results),
            timestamp: new Date().toISOString()
        };
        
        // Cache for 24 hours
        await this.redis.setex(cacheKey, this.analyticsConfig.cacheTTL.monthly, JSON.stringify(intelligence));
        
        return intelligence;
    }
    
    async getUsageAnalytics(customerId, timeframe) {
        const whereClause = customerId ? 
            `WHERE company_id = '${customerId}' AND ${this.buildTimeframeClause(timeframe)}` :
            `WHERE ${this.buildTimeframeClause(timeframe)}`;
        
        const queries = {
            containerUsage: `
                SELECT 
                    DATE_TRUNC('day', created_at) as date,
                    COUNT(*) as containers_added,
                    COUNT(DISTINCT origin_port) as unique_origins,
                    COUNT(DISTINCT destination_port) as unique_destinations
                FROM containers 
                ${whereClause}
                GROUP BY date
                ORDER BY date
            `,
            
            featureUtilization: `
                SELECT 
                    feature_name,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(session_duration) as avg_duration
                FROM feature_usage 
                ${whereClause.replace('company_id', 'user_id IN (SELECT id FROM users WHERE company_id')} )
                GROUP BY feature_name
            `,
            
            alertsGenerated: `
                SELECT 
                    alert_type,
                    COUNT(*) as total_alerts,
                    COUNT(CASE WHEN acknowledged THEN 1 END) as acknowledged,
                    AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))/60) as avg_response_minutes
                FROM system_alerts 
                ${whereClause}
                GROUP BY alert_type
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            try {
                const result = await this.db.query(query);
                results[key] = result.rows;
            } catch (error) {
                this.logger.error(`Query failed for ${key}:`, error);
                results[key] = [];
            }
        }
        
        return {
            containerUsage: results.containerUsage,
            featureUtilization: results.featureUtilization,
            alerts: results.alertsGenerated,
            timestamp: new Date().toISOString()
        };
    }
    
    async getPredictiveAnalytics(type, horizon) {
        switch (type) {
            case 'churn':
                return await this.getChurnPredictions(horizon);
            case 'revenue':
                return await this.getRevenueForecast(horizon);
            case 'usage':
                return await this.getUsageForecast(horizon);
            default:
                throw new Error(`Unknown prediction type: ${type}`);
        }
    }
    
    async getChurnPredictions(horizon) {
        // Simplified churn prediction based on usage patterns
        const query = `
            SELECT 
                c.id,
                c.company_name,
                c.created_at as customer_since,
                COALESCE(recent_activity.last_login, '1970-01-01') as last_login,
                COALESCE(recent_activity.container_count, 0) as recent_containers,
                COALESCE(support_tickets.ticket_count, 0) as support_tickets,
                CASE 
                    WHEN recent_activity.last_login < NOW() - INTERVAL '30 days' 
                         AND recent_activity.container_count < 10 THEN 'high'
                    WHEN recent_activity.last_login < NOW() - INTERVAL '14 days' 
                         OR support_tickets.ticket_count > 5 THEN 'medium'
                    ELSE 'low'
                END as churn_risk
            FROM companies c
            LEFT JOIN (
                SELECT 
                    company_id,
                    MAX(last_login) as last_login,
                    COUNT(*) as container_count
                FROM users u
                JOIN containers cont ON u.company_id = cont.company_id
                WHERE cont.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY company_id
            ) recent_activity ON c.id = recent_activity.company_id
            LEFT JOIN (
                SELECT 
                    company_id,
                    COUNT(*) as ticket_count
                FROM support_tickets
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY company_id
            ) support_tickets ON c.id = support_tickets.company_id
            WHERE c.status = 'active'
        `;
        
        const result = await this.db.query(query);
        
        return {
            predictions: result.rows,
            summary: {
                high_risk: result.rows.filter(r => r.churn_risk === 'high').length,
                medium_risk: result.rows.filter(r => r.churn_risk === 'medium').length,
                low_risk: result.rows.filter(r => r.churn_risk === 'low').length
            },
            horizon: horizon,
            timestamp: new Date().toISOString()
        };
    }
    
    buildTimeframeClause(timeframe) {
        const unit = timeframe.slice(-1);
        const value = parseInt(timeframe.slice(0, -1));
        
        const intervalMap = {
            'd': 'days',
            'w': 'weeks', 
            'm': 'months',
            'y': 'years'
        };
        
        return `created_at >= NOW() - INTERVAL '${value} ${intervalMap[unit]}'`;
    }
    
    calculateEngagementMetrics(engagementData) {
        if (!engagementData.length) return {};
        
        const totalUsers = engagementData.length;
        const activeUsers = engagementData.filter(u => u.active_days > 0).length;
        const avgActiveDays = engagementData.reduce((sum, u) => sum + parseInt(u.active_days), 0) / totalUsers;
        const avgActions = engagementData.reduce((sum, u) => sum + parseInt(u.total_actions), 0) / totalUsers;
        
        return {
            totalUsers,
            activeUsers,
            engagementRate: (activeUsers / totalUsers) * 100,
            avgActiveDays: Math.round(avgActiveDays * 10) / 10,
            avgActions: Math.round(avgActions * 10) / 10
        };
    }
    
    processCohortData(cohortData) {
        // Process cohort analysis data into a matrix format
        const cohorts = {};
        
        cohortData.forEach(row => {
            const cohort = row.cohort_month;
            const activity = row.activity_month;
            
            if (!cohorts[cohort]) {
                cohorts[cohort] = {};
            }
            
            cohorts[cohort][activity] = parseInt(row.active_users);
        });
        
        return cohorts;
    }
    
    processApiMetrics(apiData) {
        const endpoints = {};
        
        apiData.forEach(row => {
            const endpoint = row.endpoint;
            
            if (!endpoints[endpoint]) {
                endpoints[endpoint] = {
                    requests: 0,
                    errors: 0,
                    avgResponseTime: 0,
                    hourlyData: []
                };
            }
            
            endpoints[endpoint].requests += parseInt(row.requests);
            endpoints[endpoint].errors += parseInt(row.errors);
            endpoints[endpoint].hourlyData.push({
                hour: row.hour,
                requests: parseInt(row.requests),
                responseTime: parseFloat(row.avg_response_time),
                errors: parseInt(row.errors)
            });
        });
        
        // Calculate averages
        Object.values(endpoints).forEach(endpoint => {
            endpoint.errorRate = (endpoint.errors / endpoint.requests) * 100;
            endpoint.avgResponseTime = endpoint.hourlyData.reduce((sum, d) => sum + d.responseTime, 0) / endpoint.hourlyData.length;
        });
        
        return endpoints;
    }
    
    generateMarketInsights(data) {
        const insights = [];
        
        // Top industry by volume
        if (data.industryTrends.length > 0) {
            const topIndustry = data.industryTrends[0];
            insights.push({
                type: 'industry_leader',
                message: `${topIndustry.industry} leads with ${topIndustry.total_volume.toLocaleString()} containers tracked`,
                impact: 'high'
            });
        }
        
        // Carrier concentration
        const totalContainers = data.carrierDistribution.reduce((sum, c) => sum + parseInt(c.containers), 0);
        const topCarrierShare = data.carrierDistribution[0] ? 
            (parseInt(data.carrierDistribution[0].containers) / totalContainers) * 100 : 0;
        
        if (topCarrierShare > 40) {
            insights.push({
                type: 'carrier_concentration',
                message: `${data.carrierDistribution[0].carrier_code} handles ${topCarrierShare.toFixed(1)}% of tracked containers`,
                impact: 'medium'
            });
        }
        
        return insights;
    }
    
    startAnalyticsEngine() {
        // Aggregate daily metrics
        setInterval(() => {
            this.aggregateDailyMetrics();
        }, 3600000); // Every hour
        
        // Update real-time dashboard
        setInterval(() => {
            this.updateRealtimeDashboard();
        }, 60000); // Every minute
        
        this.logger.info('Business Intelligence engine started');
    }
    
    async aggregateDailyMetrics() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];
            
            // Aggregate key metrics for yesterday
            const aggregations = [
                this.aggregateUserMetrics(dateStr),
                this.aggregateRevenueMetrics(dateStr),
                this.aggregateUsageMetrics(dateStr)
            ];
            
            await Promise.all(aggregations);
            
            this.logger.info(`Daily metrics aggregated for ${dateStr}`);
            
        } catch (error) {
            this.logger.error('Daily metrics aggregation failed:', error);
        }
    }
    
    async getRealtimeMetrics() {
        const cacheKey = 'realtime:metrics';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const queries = {
            activeUsers: `
                SELECT COUNT(DISTINCT user_id) as count
                FROM user_sessions 
                WHERE last_activity > NOW() - INTERVAL '5 minutes'
            `,
            
            apiCallsLastMinute: `
                SELECT COUNT(*) as count
                FROM api_usage 
                WHERE created_at > NOW() - INTERVAL '1 minute'
            `,
            
            containersAdded: `
                SELECT COUNT(*) as count
                FROM containers 
                WHERE created_at > NOW() - INTERVAL '1 hour'
            `,
            
            alertsActive: `
                SELECT COUNT(*) as count
                FROM system_alerts 
                WHERE acknowledged = false
                AND created_at > NOW() - INTERVAL '24 hours'
            `
        };
        
        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.db.query(query);
            results[key] = parseInt(result.rows[0]?.count || 0);
        }
        
        const metrics = {
            ...results,
            timestamp: new Date().toISOString()
        };
        
        // Cache for 1 minute
        await this.redis.setex(cacheKey, 60, JSON.stringify(metrics));
        
        return metrics;
    }
    
    start() {
        this.server = this.app.listen(this.port, () => {
            this.logger.info(`Business Intelligence Dashboard running on port ${this.port}`);
            console.log(`📈 ROOTUIP Business Intelligence Dashboard`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Executive Dashboard: http://localhost:${this.port}/api/dashboard/executive`);
            console.log(`   Analytics APIs: http://localhost:${this.port}/api/analytics/*`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down BI dashboard...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Start BI dashboard if called directly
if (require.main === module) {
    const biDashboard = new BusinessIntelligenceDashboard();
    biDashboard.start();
}

module.exports = BusinessIntelligenceDashboard;