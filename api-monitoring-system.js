// ROOTUIP API Monitoring and Health Check System
// Comprehensive monitoring for carrier API integrations

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const prometheus = require('prom-client');
const nodemailer = require('nodemailer');
const axios = require('axios');

class APIMonitoringSystem {
    constructor() {
        this.app = express();
        this.port = process.env.MONITORING_PORT || 3009;
        
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
                new winston.transports.File({ filename: 'logs/api-monitoring.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Prometheus metrics
        this.metrics = {
            apiRequests: new prometheus.Counter({
                name: 'rootuip_api_requests_total',
                help: 'Total number of API requests',
                labelNames: ['carrier', 'endpoint', 'status']
            }),
            
            apiDuration: new prometheus.Histogram({
                name: 'rootuip_api_duration_seconds',
                help: 'API request duration',
                labelNames: ['carrier', 'endpoint'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
            }),
            
            apiErrors: new prometheus.Counter({
                name: 'rootuip_api_errors_total',
                help: 'Total number of API errors',
                labelNames: ['carrier', 'error_type']
            }),
            
            activeConnections: new prometheus.Gauge({
                name: 'rootuip_websocket_connections',
                help: 'Current WebSocket connections'
            }),
            
            containerUpdates: new prometheus.Counter({
                name: 'rootuip_container_updates_total',
                help: 'Total container updates processed',
                labelNames: ['carrier', 'status']
            }),
            
            alertsGenerated: new prometheus.Counter({
                name: 'rootuip_alerts_generated_total',
                help: 'Total alerts generated',
                labelNames: ['severity', 'type']
            })
        };
        
        // Register all metrics
        prometheus.register.clear();
        Object.values(this.metrics).forEach(metric => {
            prometheus.register.registerMetric(metric);
        });
        
        this.carrierStatuses = new Map();
        this.healthCheckInterval = 60000; // 1 minute
        this.alertThresholds = {
            errorRate: 0.1, // 10% error rate
            responseTime: 30000, // 30 seconds
            consecutiveFailures: 3
        };
        
        this.emailTransporter = this.setupEmailNotifications();
        this.setupRoutes();
        this.startHealthChecks();
    }
    
    setupEmailNotifications() {
        if (!process.env.SMTP_HOST) {
            this.logger.warn('SMTP not configured, email notifications disabled');
            return null;
        }
        
        return nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    
    setupRoutes() {
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0'
            });
        });
        
        // Prometheus metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                res.set('Content-Type', prometheus.register.contentType);
                res.end(await prometheus.register.metrics());
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Carrier status endpoint
        this.app.get('/api/carriers/status', async (req, res) => {
            try {
                const statuses = {};
                
                for (const [carrier, status] of this.carrierStatuses.entries()) {
                    statuses[carrier] = {
                        ...status,
                        lastCheck: status.lastCheck?.toISOString()
                    };
                }
                
                res.json(statuses);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Performance metrics endpoint
        this.app.get('/api/performance/metrics', async (req, res) => {
            try {
                const metrics = await this.getPerformanceMetrics();
                res.json(metrics);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Alert history endpoint
        this.app.get('/api/alerts/history', async (req, res) => {
            try {
                const { hours = 24, severity } = req.query;
                const alerts = await this.getAlertHistory(hours, severity);
                res.json(alerts);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Manual health check trigger
        this.app.post('/api/health-check/:carrier', async (req, res) => {
            try {
                const { carrier } = req.params;
                const result = await this.performCarrierHealthCheck(carrier);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // System dashboard data
        this.app.get('/api/dashboard', async (req, res) => {
            try {
                const dashboard = await this.getDashboardData();
                res.json(dashboard);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async startHealthChecks() {
        this.logger.info('Starting API health monitoring');
        
        // Initial health check
        await this.performAllHealthChecks();
        
        // Periodic health checks
        setInterval(async () => {
            try {
                await this.performAllHealthChecks();
            } catch (error) {
                this.logger.error('Health check failed:', error);
            }
        }, this.healthCheckInterval);
        
        // System metrics collection
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds
    }
    
    async performAllHealthChecks() {
        const carriers = ['MAEU', 'MSC', 'CMACGM', 'HAPAG'];
        
        for (const carrier of carriers) {
            try {
                await this.performCarrierHealthCheck(carrier);
            } catch (error) {
                this.logger.error(`Health check failed for ${carrier}:`, error);
            }
        }
    }
    
    async performCarrierHealthCheck(carrier) {
        const startTime = Date.now();
        const checkResult = {
            carrier,
            timestamp: new Date(),
            status: 'unknown',
            responseTime: 0,
            error: null,
            details: {}
        };
        
        try {
            // Check authentication status
            const authStatus = await this.checkCarrierAuth(carrier);
            checkResult.details.authentication = authStatus;
            
            // Check API connectivity
            const connectivityStatus = await this.checkCarrierConnectivity(carrier);
            checkResult.details.connectivity = connectivityStatus;
            
            // Check recent API performance
            const performanceStatus = await this.checkCarrierPerformance(carrier);
            checkResult.details.performance = performanceStatus;
            
            // Overall status determination
            if (authStatus.status === 'healthy' && 
                connectivityStatus.status === 'healthy' && 
                performanceStatus.status === 'healthy') {
                checkResult.status = 'healthy';
            } else if (authStatus.status === 'error' || 
                      connectivityStatus.status === 'error') {
                checkResult.status = 'error';
            } else {
                checkResult.status = 'warning';
            }
            
        } catch (error) {
            checkResult.status = 'error';
            checkResult.error = error.message;
        }
        
        checkResult.responseTime = Date.now() - startTime;
        
        // Store result
        this.carrierStatuses.set(carrier, checkResult);
        
        // Check for alerts
        await this.checkForAlerts(carrier, checkResult);
        
        // Update metrics
        this.updateHealthMetrics(carrier, checkResult);
        
        return checkResult;
    }
    
    async checkCarrierAuth(carrier) {
        try {
            const authKey = `auth:${carrier}`;
            const authData = await this.redis.get(authKey);
            
            if (!authData) {
                return {
                    status: 'warning',
                    message: 'No authentication token found',
                    hasToken: false
                };
            }
            
            const parsed = JSON.parse(authData);
            const expiresAt = parsed.expires_at || (parsed.timestamp + (parsed.expires_in * 1000));
            const timeToExpiry = expiresAt - Date.now();
            
            if (timeToExpiry <= 0) {
                return {
                    status: 'error',
                    message: 'Authentication token expired',
                    hasToken: true,
                    expired: true
                };
            } else if (timeToExpiry < 300000) { // 5 minutes
                return {
                    status: 'warning',
                    message: 'Authentication token expires soon',
                    hasToken: true,
                    expiresIn: timeToExpiry
                };
            }
            
            return {
                status: 'healthy',
                message: 'Authentication token valid',
                hasToken: true,
                expiresIn: timeToExpiry
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: 'Authentication check failed',
                error: error.message
            };
        }
    }
    
    async checkCarrierConnectivity(carrier) {
        try {
            // Basic connectivity test based on carrier
            const endpoints = {
                'MAEU': 'https://api.maersk.com',
                'MSC': 'https://api.msc.com',
                'CMACGM': 'https://api.cma-cgm.com',
                'HAPAG': 'https://api.hapag-lloyd.com'
            };
            
            const endpoint = endpoints[carrier];
            if (!endpoint) {
                return {
                    status: 'warning',
                    message: `No endpoint configured for ${carrier}`
                };
            }
            
            const startTime = Date.now();
            const response = await axios.get(endpoint, {
                timeout: 10000,
                validateStatus: () => true
            });
            const responseTime = Date.now() - startTime;
            
            if (response.status < 500) {
                return {
                    status: 'healthy',
                    message: 'Connectivity OK',
                    responseTime,
                    statusCode: response.status
                };
            } else {
                return {
                    status: 'error',
                    message: 'Server error response',
                    responseTime,
                    statusCode: response.status
                };
            }
            
        } catch (error) {
            return {
                status: 'error',
                message: 'Connectivity failed',
                error: error.message
            };
        }
    }
    
    async checkCarrierPerformance(carrier) {
        try {
            // Check recent API call performance from database
            const query = `
                SELECT 
                    COUNT(*) as total_calls,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
                    MAX(created_at) as last_call
                FROM api_usage 
                WHERE endpoint LIKE $1 
                AND created_at > NOW() - INTERVAL '1 hour'
            `;
            
            const result = await this.db.query(query, [`%${carrier}%`]);
            const stats = result.rows[0];
            
            if (stats.total_calls === '0') {
                return {
                    status: 'warning',
                    message: 'No recent API calls',
                    totalCalls: 0
                };
            }
            
            const errorRate = parseInt(stats.error_count) / parseInt(stats.total_calls);
            const avgResponseTime = parseFloat(stats.avg_response_time);
            
            let status = 'healthy';
            let message = 'Performance within normal range';
            
            if (errorRate > this.alertThresholds.errorRate) {
                status = 'error';
                message = `High error rate: ${(errorRate * 100).toFixed(1)}%`;
            } else if (avgResponseTime > this.alertThresholds.responseTime) {
                status = 'warning';
                message = `Slow response time: ${avgResponseTime.toFixed(0)}ms`;
            }
            
            return {
                status,
                message,
                totalCalls: parseInt(stats.total_calls),
                errorRate: errorRate,
                avgResponseTime: avgResponseTime,
                lastCall: stats.last_call
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: 'Performance check failed',
                error: error.message
            };
        }
    }
    
    async checkForAlerts(carrier, healthResult) {
        const previousStatus = this.carrierStatuses.get(carrier);
        
        // Status change alert
        if (previousStatus && previousStatus.status !== healthResult.status) {
            await this.generateAlert({
                type: 'status_change',
                carrier,
                severity: healthResult.status === 'error' ? 'high' : 'medium',
                message: `${carrier} status changed from ${previousStatus.status} to ${healthResult.status}`,
                details: healthResult
            });
        }
        
        // Consecutive failures
        if (healthResult.status === 'error') {
            const failureCount = await this.getConsecutiveFailures(carrier);
            
            if (failureCount >= this.alertThresholds.consecutiveFailures) {
                await this.generateAlert({
                    type: 'consecutive_failures',
                    carrier,
                    severity: 'critical',
                    message: `${carrier} has failed ${failureCount} consecutive health checks`,
                    details: { failureCount, lastResult: healthResult }
                });
            }
        }
        
        // Performance degradation
        if (healthResult.details.performance) {
            const perf = healthResult.details.performance;
            
            if (perf.errorRate > this.alertThresholds.errorRate) {
                await this.generateAlert({
                    type: 'high_error_rate',
                    carrier,
                    severity: 'high',
                    message: `${carrier} error rate is ${(perf.errorRate * 100).toFixed(1)}%`,
                    details: perf
                });
            }
        }
    }
    
    async generateAlert(alertData) {
        try {
            // Store alert in database
            const query = `
                INSERT INTO system_alerts (
                    alert_type, carrier, severity, message, details, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            
            await this.db.query(query, [
                alertData.type,
                alertData.carrier,
                alertData.severity,
                alertData.message,
                JSON.stringify(alertData.details)
            ]);
            
            // Update metrics
            this.metrics.alertsGenerated.labels(alertData.severity, alertData.type).inc();
            
            // Send notifications
            await this.sendAlertNotifications(alertData);
            
            this.logger.warn('Alert generated', alertData);
            
        } catch (error) {
            this.logger.error('Failed to generate alert:', error);
        }
    }
    
    async sendAlertNotifications(alertData) {
        try {
            // Email notification
            if (this.emailTransporter && alertData.severity === 'critical') {
                await this.sendEmailAlert(alertData);
            }
            
            // Slack notification
            if (process.env.SLACK_WEBHOOK) {
                await this.sendSlackAlert(alertData);
            }
            
            // Real-time notification via WebSocket
            await this.sendWebSocketAlert(alertData);
            
        } catch (error) {
            this.logger.error('Failed to send alert notifications:', error);
        }
    }
    
    async sendEmailAlert(alertData) {
        if (!this.emailTransporter) return;
        
        const mailOptions = {
            from: process.env.ALERT_FROM_EMAIL || 'alerts@rootuip.com',
            to: process.env.ALERT_TO_EMAIL || 'admin@rootuip.com',
            subject: `🚨 ROOTUIP Alert: ${alertData.carrier} - ${alertData.type}`,
            html: `
                <h3>ROOTUIP System Alert</h3>
                <p><strong>Carrier:</strong> ${alertData.carrier}</p>
                <p><strong>Severity:</strong> ${alertData.severity}</p>
                <p><strong>Type:</strong> ${alertData.type}</p>
                <p><strong>Message:</strong> ${alertData.message}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <h4>Details:</h4>
                <pre>${JSON.stringify(alertData.details, null, 2)}</pre>
            `
        };
        
        await this.emailTransporter.sendMail(mailOptions);
    }
    
    async sendSlackAlert(alertData) {
        const color = {
            'low': 'good',
            'medium': 'warning', 
            'high': 'danger',
            'critical': 'danger'
        }[alertData.severity] || 'warning';
        
        const payload = {
            text: `🚨 ROOTUIP System Alert`,
            attachments: [{
                color,
                fields: [
                    { title: 'Carrier', value: alertData.carrier, short: true },
                    { title: 'Severity', value: alertData.severity, short: true },
                    { title: 'Type', value: alertData.type, short: true },
                    { title: 'Message', value: alertData.message, short: false }
                ],
                timestamp: Math.floor(Date.now() / 1000)
            }]
        };
        
        await axios.post(process.env.SLACK_WEBHOOK, payload);
    }
    
    async sendWebSocketAlert(alertData) {
        // Publish to Redis for WebSocket distribution
        await this.redis.publish('system:alerts', JSON.stringify({
            type: 'system_alert',
            data: alertData,
            timestamp: Date.now()
        }));
    }
    
    updateHealthMetrics(carrier, result) {
        // Update Prometheus metrics
        this.metrics.apiRequests.labels(carrier, 'health_check', result.status).inc();
        this.metrics.apiDuration.labels(carrier, 'health_check').observe(result.responseTime / 1000);
        
        if (result.status === 'error') {
            this.metrics.apiErrors.labels(carrier, 'health_check').inc();
        }
    }
    
    collectSystemMetrics() {
        // Collect WebSocket connection count
        this.redis.get('websocket:connection_count').then(count => {
            if (count) {
                this.metrics.activeConnections.set(parseInt(count));
            }
        });
        
        // Collect container update metrics
        this.getRecentContainerUpdates().then(updates => {
            for (const update of updates) {
                this.metrics.containerUpdates.labels(update.carrier, update.status).inc();
            }
        });
    }
    
    async getRecentContainerUpdates() {
        const query = `
            SELECT carrier_code as carrier, status, COUNT(*) as count
            FROM containers 
            WHERE last_api_update > NOW() - INTERVAL '5 minutes'
            GROUP BY carrier_code, status
        `;
        
        const result = await this.db.query(query);
        return result.rows;
    }
    
    async getConsecutiveFailures(carrier) {
        const key = `health_failures:${carrier}`;
        const failures = await this.redis.get(key);
        return failures ? parseInt(failures) : 0;
    }
    
    async getPerformanceMetrics() {
        const query = `
            SELECT 
                DATE_TRUNC('hour', created_at) as hour,
                endpoint,
                AVG(response_time_ms) as avg_response_time,
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
            FROM api_usage 
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY hour, endpoint
            ORDER BY hour DESC
        `;
        
        const result = await this.db.query(query);
        return result.rows;
    }
    
    async getAlertHistory(hours = 24, severity = null) {
        let query = `
            SELECT * FROM system_alerts 
            WHERE created_at > NOW() - INTERVAL '${hours} hours'
        `;
        
        const params = [];
        if (severity) {
            query += ' AND severity = $1';
            params.push(severity);
        }
        
        query += ' ORDER BY created_at DESC LIMIT 100';
        
        const result = await this.db.query(query, params);
        return result.rows;
    }
    
    async getDashboardData() {
        const [carriers, metrics, alerts, performance] = await Promise.all([
            this.getCarrierStatusSummary(),
            this.getSystemMetricsSummary(),
            this.getAlertHistory(24),
            this.getPerformanceMetrics()
        ]);
        
        return {
            carriers,
            metrics,
            alerts: alerts.slice(0, 10), // Last 10 alerts
            performance,
            timestamp: new Date().toISOString()
        };
    }
    
    getCarrierStatusSummary() {
        const summary = {};
        
        for (const [carrier, status] of this.carrierStatuses.entries()) {
            summary[carrier] = {
                status: status.status,
                lastCheck: status.timestamp,
                responseTime: status.responseTime,
                details: status.details
            };
        }
        
        return summary;
    }
    
    async getSystemMetricsSummary() {
        const query = `
            SELECT 
                COUNT(DISTINCT company_id) as active_companies,
                COUNT(*) as total_containers,
                COUNT(CASE WHEN status IN ('In Transit', 'At Port') THEN 1 END) as active_containers,
                COUNT(CASE WHEN last_api_update > NOW() - INTERVAL '1 hour' THEN 1 END) as recently_updated
            FROM containers
        `;
        
        const result = await this.db.query(query);
        return result.rows[0];
    }
    
    start() {
        this.server = this.app.listen(this.port, () => {
            this.logger.info(`API Monitoring System running on port ${this.port}`);
            console.log(`🔍 ROOTUIP API Monitoring System`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Metrics: http://localhost:${this.port}/metrics`);
            console.log(`   Health: http://localhost:${this.port}/health`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down monitoring system...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Create system_alerts table if it doesn't exist
const createAlertsTable = `
    CREATE TABLE IF NOT EXISTS system_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        alert_type VARCHAR(50) NOT NULL,
        carrier VARCHAR(10),
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by VARCHAR(255),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at);
    CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_system_alerts_carrier ON system_alerts(carrier);
`;

// Start monitoring system if called directly
if (require.main === module) {
    const monitoring = new APIMonitoringSystem();
    
    // Initialize database schema
    monitoring.db.query(createAlertsTable).then(() => {
        monitoring.start();
    }).catch(error => {
        console.error('Failed to initialize monitoring system:', error);
        process.exit(1);
    });
}

module.exports = APIMonitoringSystem;