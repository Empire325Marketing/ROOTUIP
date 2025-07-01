// ROOTUIP Operational Analytics System
// Real-time operational metrics and performance tracking

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Redis = require('ioredis');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const cron = require('node-cron');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'operational-analytics.log' }),
        new winston.transports.Console()
    ]
});

// Database connections
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
});

// InfluxDB for time-series metrics
const influxDB = new InfluxDB({
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN
});

const writeApi = influxDB.getWriteApi(
    process.env.INFLUXDB_ORG || 'rootuip',
    process.env.INFLUXDB_BUCKET || 'operational_metrics'
);

// Operational Metrics Collection
class OperationalAnalytics {
    constructor() {
        this.metrics = {
            ddPrevention: {
                successRate: 0,
                totalPrevented: 0,
                savingsGenerated: 0
            },
            integrationHealth: {
                totalIntegrations: 0,
                healthyIntegrations: 0,
                failedConnections: 0,
                avgResponseTime: 0
            },
            documentProcessing: {
                totalProcessed: 0,
                accuracyRate: 0,
                processingTime: 0,
                errorRate: 0
            },
            apiPerformance: {
                totalRequests: 0,
                avgResponseTime: 0,
                errorRate: 0,
                uptime: 0
            },
            userEngagement: {
                activeUsers: 0,
                featureAdoption: {},
                sessionDuration: 0,
                actionsPerSession: 0
            }
        };
    }

    // D&D Prevention Analytics
    async calculateDDPreventionMetrics() {
        try {
            const query = `
                WITH prevention_stats AS (
                    SELECT 
                        COUNT(*) FILTER (WHERE prevented = true) as prevented_count,
                        COUNT(*) as total_count,
                        SUM(CASE WHEN prevented = true THEN estimated_cost ELSE 0 END) as total_savings,
                        customer_id,
                        carrier_id
                    FROM demurrage_detentions
                    WHERE created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY customer_id, carrier_id
                )
                SELECT 
                    SUM(prevented_count) as total_prevented,
                    SUM(total_count) as total_cases,
                    SUM(total_savings) as total_savings,
                    AVG(prevented_count::float / NULLIF(total_count, 0)) as avg_success_rate,
                    COUNT(DISTINCT customer_id) as unique_customers,
                    COUNT(DISTINCT carrier_id) as unique_carriers
                FROM prevention_stats;
            `;

            const result = await pool.query(query);
            const data = result.rows[0];

            this.metrics.ddPrevention = {
                successRate: (data.avg_success_rate * 100).toFixed(2),
                totalPrevented: data.total_prevented,
                savingsGenerated: data.total_savings,
                uniqueCustomers: data.unique_customers,
                uniqueCarriers: data.unique_carriers
            };

            // Store in InfluxDB
            const point = new Point('dd_prevention')
                .floatField('success_rate', data.avg_success_rate * 100)
                .intField('total_prevented', data.total_prevented)
                .floatField('savings_generated', data.total_savings)
                .timestamp(new Date());

            writeApi.writePoint(point);

            // Cache in Redis
            await redis.setex('metrics:dd_prevention', 300, JSON.stringify(this.metrics.ddPrevention));

        } catch (error) {
            logger.error('Error calculating D&D prevention metrics:', error);
        }
    }

    // Integration Health Monitoring
    async monitorIntegrationHealth() {
        try {
            const integrations = await pool.query(`
                SELECT 
                    i.id,
                    i.name,
                    i.type,
                    i.status,
                    i.last_sync,
                    i.error_count,
                    AVG(ih.response_time) as avg_response_time,
                    COUNT(ih.id) FILTER (WHERE ih.status = 'success') as success_count,
                    COUNT(ih.id) as total_requests
                FROM integrations i
                LEFT JOIN integration_health ih ON i.id = ih.integration_id
                WHERE ih.created_at >= NOW() - INTERVAL '1 hour'
                GROUP BY i.id, i.name, i.type, i.status, i.last_sync, i.error_count
            `);

            const healthyCount = integrations.rows.filter(i => 
                i.status === 'active' && 
                i.error_count < 5 && 
                new Date() - new Date(i.last_sync) < 300000 // 5 minutes
            ).length;

            this.metrics.integrationHealth = {
                totalIntegrations: integrations.rows.length,
                healthyIntegrations: healthyCount,
                failedConnections: integrations.rows.filter(i => i.status === 'failed').length,
                avgResponseTime: integrations.rows.reduce((acc, i) => acc + parseFloat(i.avg_response_time || 0), 0) / integrations.rows.length
            };

            // Check SLA compliance
            for (const integration of integrations.rows) {
                const slaCompliance = (integration.success_count / integration.total_requests) * 100;
                
                if (slaCompliance < 99.5) {
                    await this.createSLAAlert(integration.name, slaCompliance);
                }

                // Log to InfluxDB
                const point = new Point('integration_health')
                    .tag('integration_name', integration.name)
                    .tag('integration_type', integration.type)
                    .floatField('response_time', parseFloat(integration.avg_response_time || 0))
                    .floatField('sla_compliance', slaCompliance)
                    .intField('error_count', integration.error_count)
                    .timestamp(new Date());

                writeApi.writePoint(point);
            }

        } catch (error) {
            logger.error('Error monitoring integration health:', error);
        }
    }

    // Document Processing Accuracy
    async analyzeDocumentProcessing() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_documents,
                    COUNT(*) FILTER (WHERE status = 'processed') as processed_count,
                    COUNT(*) FILTER (WHERE accuracy_score >= 0.95) as high_accuracy_count,
                    AVG(processing_time) as avg_processing_time,
                    AVG(accuracy_score) as avg_accuracy,
                    COUNT(*) FILTER (WHERE status = 'error') as error_count
                FROM document_processing
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            `;

            const result = await pool.query(query);
            const data = result.rows[0];

            this.metrics.documentProcessing = {
                totalProcessed: data.processed_count,
                accuracyRate: (data.avg_accuracy * 100).toFixed(2),
                processingTime: data.avg_processing_time,
                errorRate: ((data.error_count / data.total_documents) * 100).toFixed(2),
                highAccuracyPercentage: ((data.high_accuracy_count / data.processed_count) * 100).toFixed(2)
            };

            // Document type breakdown
            const typeBreakdown = await pool.query(`
                SELECT 
                    document_type,
                    COUNT(*) as count,
                    AVG(accuracy_score) as avg_accuracy,
                    AVG(processing_time) as avg_time
                FROM document_processing
                WHERE created_at >= NOW() - INTERVAL '24 hours'
                GROUP BY document_type
            `);

            // Store detailed metrics
            for (const docType of typeBreakdown.rows) {
                const point = new Point('document_processing')
                    .tag('document_type', docType.document_type)
                    .intField('count', docType.count)
                    .floatField('accuracy', docType.avg_accuracy * 100)
                    .floatField('processing_time', docType.avg_time)
                    .timestamp(new Date());

                writeApi.writePoint(point);
            }

        } catch (error) {
            logger.error('Error analyzing document processing:', error);
        }
    }

    // API Performance Monitoring
    async trackAPIPerformance() {
        try {
            // Get API metrics from Redis (collected by middleware)
            const apiStats = await redis.hgetall('api:stats:current');
            
            const totalRequests = parseInt(apiStats.total_requests || 0);
            const totalResponseTime = parseFloat(apiStats.total_response_time || 0);
            const errorCount = parseInt(apiStats.error_count || 0);

            // Calculate uptime
            const uptimeCheck = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'up') as up_count,
                    COUNT(*) as total_checks
                FROM api_health_checks
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            `);

            const uptime = (uptimeCheck.rows[0].up_count / uptimeCheck.rows[0].total_checks) * 100;

            this.metrics.apiPerformance = {
                totalRequests,
                avgResponseTime: totalRequests > 0 ? (totalResponseTime / totalRequests).toFixed(2) : 0,
                errorRate: totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(2) : 0,
                uptime: uptime.toFixed(2)
            };

            // Endpoint-specific metrics
            const endpointStats = await redis.hgetall('api:endpoints:stats');
            
            for (const [endpoint, stats] of Object.entries(endpointStats)) {
                const parsedStats = JSON.parse(stats);
                
                const point = new Point('api_performance')
                    .tag('endpoint', endpoint)
                    .intField('request_count', parsedStats.count)
                    .floatField('avg_response_time', parsedStats.avg_time)
                    .floatField('error_rate', parsedStats.error_rate)
                    .timestamp(new Date());

                writeApi.writePoint(point);
            }

        } catch (error) {
            logger.error('Error tracking API performance:', error);
        }
    }

    // User Engagement Analytics
    async analyzeUserEngagement() {
        try {
            // Active users
            const activeUsersQuery = await pool.query(`
                SELECT 
                    COUNT(DISTINCT user_id) as daily_active_users,
                    COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN user_id END) as weekly_active_users,
                    COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN user_id END) as monthly_active_users
                FROM user_activities
                WHERE created_at >= NOW() - INTERVAL '30 days'
            `);

            // Feature adoption
            const featureAdoption = await pool.query(`
                SELECT 
                    feature_name,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) as total_uses,
                    AVG(duration) as avg_duration
                FROM feature_usage
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY feature_name
                ORDER BY unique_users DESC
            `);

            // Session metrics
            const sessionMetrics = await pool.query(`
                SELECT 
                    AVG(duration) as avg_session_duration,
                    AVG(action_count) as avg_actions_per_session,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY duration) as median_duration
                FROM user_sessions
                WHERE created_at >= NOW() - INTERVAL '7 days'
            `);

            this.metrics.userEngagement = {
                activeUsers: {
                    daily: activeUsersQuery.rows[0].daily_active_users,
                    weekly: activeUsersQuery.rows[0].weekly_active_users,
                    monthly: activeUsersQuery.rows[0].monthly_active_users
                },
                featureAdoption: featureAdoption.rows.reduce((acc, feature) => {
                    acc[feature.feature_name] = {
                        uniqueUsers: feature.unique_users,
                        totalUses: feature.total_uses,
                        avgDuration: feature.avg_duration
                    };
                    return acc;
                }, {}),
                sessionDuration: sessionMetrics.rows[0].avg_session_duration,
                actionsPerSession: sessionMetrics.rows[0].avg_actions_per_session,
                medianDuration: sessionMetrics.rows[0].median_duration
            };

            // Store in time-series DB
            const point = new Point('user_engagement')
                .intField('daily_active_users', activeUsersQuery.rows[0].daily_active_users)
                .intField('weekly_active_users', activeUsersQuery.rows[0].weekly_active_users)
                .intField('monthly_active_users', activeUsersQuery.rows[0].monthly_active_users)
                .floatField('avg_session_duration', sessionMetrics.rows[0].avg_session_duration)
                .floatField('avg_actions_per_session', sessionMetrics.rows[0].avg_actions_per_session)
                .timestamp(new Date());

            writeApi.writePoint(point);

        } catch (error) {
            logger.error('Error analyzing user engagement:', error);
        }
    }

    // Create SLA Alert
    async createSLAAlert(integrationName, compliance) {
        const alert = {
            type: 'sla_violation',
            severity: compliance < 95 ? 'critical' : 'warning',
            integration: integrationName,
            compliance: compliance,
            message: `SLA compliance for ${integrationName} is ${compliance.toFixed(2)}% (below 99.5% threshold)`,
            created_at: new Date()
        };

        await pool.query(
            'INSERT INTO operational_alerts (type, severity, details, created_at) VALUES ($1, $2, $3, $4)',
            [alert.type, alert.severity, JSON.stringify(alert), alert.created_at]
        );

        // Publish to Redis for real-time notifications
        await redis.publish('operational_alerts', JSON.stringify(alert));
    }

    // Generate Compliance Report
    async generateComplianceReport(reportType = 'SOC2') {
        const report = {
            type: reportType,
            generated_at: new Date(),
            period: {
                start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
                end: new Date()
            },
            sections: {}
        };

        // Security metrics
        report.sections.security = await this.getSecurityMetrics();
        
        // Availability metrics
        report.sections.availability = await this.getAvailabilityMetrics();
        
        // Processing integrity
        report.sections.processing = await this.getProcessingIntegrityMetrics();
        
        // Confidentiality
        report.sections.confidentiality = await this.getConfidentialityMetrics();

        return report;
    }

    // Helper methods for compliance reporting
    async getSecurityMetrics() {
        const metrics = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE event_type = 'login_success') as successful_logins,
                COUNT(*) FILTER (WHERE event_type = 'login_failure') as failed_logins,
                COUNT(*) FILTER (WHERE event_type = 'password_reset') as password_resets,
                COUNT(*) FILTER (WHERE event_type = 'mfa_enabled') as mfa_enablements
            FROM security_events
            WHERE created_at >= NOW() - INTERVAL '90 days'
        `);

        return metrics.rows[0];
    }

    async getAvailabilityMetrics() {
        const metrics = await pool.query(`
            SELECT 
                AVG(uptime_percentage) as avg_uptime,
                MIN(uptime_percentage) as min_uptime,
                COUNT(*) FILTER (WHERE uptime_percentage < 99.5) as sla_breaches
            FROM daily_uptime_metrics
            WHERE date >= NOW() - INTERVAL '90 days'
        `);

        return metrics.rows[0];
    }

    async getProcessingIntegrityMetrics() {
        const metrics = await pool.query(`
            SELECT 
                COUNT(*) as total_transactions,
                COUNT(*) FILTER (WHERE status = 'completed') as successful_transactions,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_transactions,
                AVG(processing_time) as avg_processing_time
            FROM transaction_logs
            WHERE created_at >= NOW() - INTERVAL '90 days'
        `);

        return metrics.rows[0];
    }

    async getConfidentialityMetrics() {
        const metrics = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE action = 'data_access') as data_access_events,
                COUNT(*) FILTER (WHERE action = 'data_export') as data_export_events,
                COUNT(DISTINCT user_id) as unique_accessors
            FROM audit_logs
            WHERE created_at >= NOW() - INTERVAL '90 days'
            AND object_type IN ('customer_data', 'financial_data', 'personal_info')
        `);

        return metrics.rows[0];
    }
}

// Initialize analytics system
const analytics = new OperationalAnalytics();

// API Routes
router.get('/metrics/dd-prevention', async (req, res) => {
    try {
        // Try cache first
        const cached = await redis.get('metrics:dd_prevention');
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        await analytics.calculateDDPreventionMetrics();
        res.json(analytics.metrics.ddPrevention);
    } catch (error) {
        logger.error('Error fetching D&D prevention metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/metrics/integration-health', async (req, res) => {
    try {
        await analytics.monitorIntegrationHealth();
        res.json(analytics.metrics.integrationHealth);
    } catch (error) {
        logger.error('Error fetching integration health:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/metrics/document-processing', async (req, res) => {
    try {
        await analytics.analyzeDocumentProcessing();
        res.json(analytics.metrics.documentProcessing);
    } catch (error) {
        logger.error('Error fetching document processing metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/metrics/api-performance', async (req, res) => {
    try {
        await analytics.trackAPIPerformance();
        res.json(analytics.metrics.apiPerformance);
    } catch (error) {
        logger.error('Error fetching API performance metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/metrics/user-engagement', async (req, res) => {
    try {
        await analytics.analyzeUserEngagement();
        res.json(analytics.metrics.userEngagement);
    } catch (error) {
        logger.error('Error fetching user engagement metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/compliance/report/:type', async (req, res) => {
    try {
        const report = await analytics.generateComplianceReport(req.params.type);
        res.json(report);
    } catch (error) {
        logger.error('Error generating compliance report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Scheduled tasks
cron.schedule('*/5 * * * *', async () => {
    logger.info('Running operational metrics collection...');
    await analytics.calculateDDPreventionMetrics();
    await analytics.monitorIntegrationHealth();
    await analytics.trackAPIPerformance();
});

cron.schedule('*/15 * * * *', async () => {
    logger.info('Running document processing analysis...');
    await analytics.analyzeDocumentProcessing();
});

cron.schedule('0 * * * *', async () => {
    logger.info('Running user engagement analysis...');
    await analytics.analyzeUserEngagement();
});

// Flush pending writes
setInterval(() => {
    writeApi.flush()
        .then(() => logger.debug('Successfully flushed metrics to InfluxDB'))
        .catch(error => logger.error('Error flushing metrics:', error));
}, 10000);

module.exports = router;