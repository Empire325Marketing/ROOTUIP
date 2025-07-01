// ROOTUIP Application Performance Monitoring System
// Real-time performance metrics, error tracking, and auto-scaling

const express = require('express');
const prometheus = require('prom-client');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const os = require('os');
const cluster = require('cluster');
const Sentry = require('@sentry/node');
const axios = require('axios');

class ApplicationPerformanceMonitoring {
    constructor() {
        this.app = express();
        this.port = process.env.APM_PORT || 3013;
        
        // Initialize Sentry for error tracking
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'production',
            tracesSampleRate: 1.0,
            profilesSampleRate: 1.0
        });
        
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
                new winston.transports.File({ filename: 'logs/apm.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Prometheus metrics
        this.metrics = this.initializeMetrics();
        
        // Performance thresholds
        this.thresholds = {
            responseTime: {
                warning: 2000,    // 2 seconds
                critical: 5000    // 5 seconds
            },
            errorRate: {
                warning: 0.05,    // 5%
                critical: 0.10    // 10%
            },
            cpuUsage: {
                warning: 0.70,    // 70%
                critical: 0.85    // 85%
            },
            memoryUsage: {
                warning: 0.80,    // 80%
                critical: 0.90    // 90%
            },
            diskUsage: {
                warning: 0.75,    // 75%
                critical: 0.85    // 85%
            }
        };
        
        // Alert tracking
        this.alertHistory = new Map();
        this.alertCooldowns = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startMonitoring();
    }
    
    initializeMetrics() {
        // Clear existing metrics
        prometheus.register.clear();
        
        const metrics = {
            // HTTP Request metrics
            httpRequestDuration: new prometheus.Histogram({
                name: 'rootuip_http_request_duration_seconds',
                help: 'Duration of HTTP requests in seconds',
                labelNames: ['method', 'route', 'status_code'],
                buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
            }),
            
            httpRequestTotal: new prometheus.Counter({
                name: 'rootuip_http_requests_total',
                help: 'Total number of HTTP requests',
                labelNames: ['method', 'route', 'status_code']
            }),
            
            httpRequestSize: new prometheus.Histogram({
                name: 'rootuip_http_request_size_bytes',
                help: 'Size of HTTP requests in bytes',
                buckets: [10, 100, 1000, 10000, 100000, 1000000]
            }),
            
            httpResponseSize: new prometheus.Histogram({
                name: 'rootuip_http_response_size_bytes',
                help: 'Size of HTTP responses in bytes',
                buckets: [10, 100, 1000, 10000, 100000, 1000000]
            }),
            
            // Application metrics
            applicationErrors: new prometheus.Counter({
                name: 'rootuip_application_errors_total',
                help: 'Total application errors',
                labelNames: ['error_type', 'severity']
            }),
            
            databaseConnections: new prometheus.Gauge({
                name: 'rootuip_database_connections',
                help: 'Number of active database connections'
            }),
            
            databaseQueryDuration: new prometheus.Histogram({
                name: 'rootuip_database_query_duration_seconds',
                help: 'Database query execution time',
                labelNames: ['query_type'],
                buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
            }),
            
            redisConnections: new prometheus.Gauge({
                name: 'rootuip_redis_connections',
                help: 'Number of active Redis connections'
            }),
            
            // System metrics
            systemCpuUsage: new prometheus.Gauge({
                name: 'rootuip_system_cpu_usage_percent',
                help: 'System CPU usage percentage'
            }),
            
            systemMemoryUsage: new prometheus.Gauge({
                name: 'rootuip_system_memory_usage_bytes',
                help: 'System memory usage in bytes'
            }),
            
            systemDiskUsage: new prometheus.Gauge({
                name: 'rootuip_system_disk_usage_percent',
                help: 'System disk usage percentage'
            }),
            
            // Business metrics
            activeUsers: new prometheus.Gauge({
                name: 'rootuip_active_users',
                help: 'Number of active users'
            }),
            
            containerTracked: new prometheus.Gauge({
                name: 'rootuip_containers_tracked',
                help: 'Number of containers being tracked'
            }),
            
            apiCallsPerMinute: new prometheus.Gauge({
                name: 'rootuip_api_calls_per_minute',
                help: 'API calls per minute'
            }),
            
            // Auto-scaling metrics
            instanceCount: new prometheus.Gauge({
                name: 'rootuip_instance_count',
                help: 'Number of running instances'
            }),
            
            queueDepth: new prometheus.Gauge({
                name: 'rootuip_queue_depth',
                help: 'Depth of processing queues',
                labelNames: ['queue_name']
            })
        };
        
        // Register all metrics
        Object.values(metrics).forEach(metric => {
            prometheus.register.registerMetric(metric);
        });
        
        return metrics;
    }
    
    setupMiddleware() {
        // Sentry request handler
        this.app.use(Sentry.Handlers.requestHandler());
        this.app.use(Sentry.Handlers.tracingHandler());
        
        this.app.use(express.json());
        
        // Request tracking middleware
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            const startUsage = process.cpuUsage();
            
            // Track request size
            if (req.get('content-length')) {
                this.metrics.httpRequestSize.observe(parseInt(req.get('content-length')));
            }
            
            // Override res.end to capture metrics
            const originalEnd = res.end;
            res.end = (...args) => {
                const duration = (Date.now() - startTime) / 1000;
                const cpuUsage = process.cpuUsage(startUsage);
                
                // Record metrics
                this.metrics.httpRequestDuration
                    .labels(req.method, req.route?.path || req.path, res.statusCode)
                    .observe(duration);
                
                this.metrics.httpRequestTotal
                    .labels(req.method, req.route?.path || req.path, res.statusCode)
                    .inc();
                
                // Track response size
                if (res.get('content-length')) {
                    this.metrics.httpResponseSize.observe(parseInt(res.get('content-length')));
                }
                
                // Log slow requests
                if (duration > this.thresholds.responseTime.warning / 1000) {
                    this.logger.warn('Slow request detected', {
                        method: req.method,
                        path: req.path,
                        duration: duration,
                        statusCode: res.statusCode,
                        userAgent: req.get('User-Agent'),
                        ip: req.ip
                    });
                }
                
                // Check for errors
                if (res.statusCode >= 500) {
                    this.metrics.applicationErrors
                        .labels('http_error', 'error')
                        .inc();
                    
                    this.handleError({
                        type: 'http_error',
                        statusCode: res.statusCode,
                        path: req.path,
                        method: req.method,
                        duration: duration
                    });
                }
                
                originalEnd.apply(res, args);
            };
            
            next();
        });
        
        // Error tracking middleware
        this.app.use(Sentry.Handlers.errorHandler());
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            });
        });
        
        // Metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                res.set('Content-Type', prometheus.register.contentType);
                res.end(await prometheus.register.metrics());
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Performance dashboard
        this.app.get('/dashboard/performance', async (req, res) => {
            try {
                const dashboard = await this.getPerformanceDashboard();
                res.json(dashboard);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // System status
        this.app.get('/status', async (req, res) => {
            try {
                const status = await this.getSystemStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Alert history
        this.app.get('/alerts', async (req, res) => {
            try {
                const alerts = await this.getAlertHistory();
                res.json(alerts);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Manual scaling trigger
        this.app.post('/scale/:direction', async (req, res) => {
            try {
                const { direction } = req.params;
                const result = await this.triggerScaling(direction);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Error simulation (for testing)
        this.app.post('/simulate/error', (req, res) => {
            const { type } = req.body;
            
            switch (type) {
                case 'timeout':
                    setTimeout(() => res.json({ simulated: 'timeout' }), 10000);
                    break;
                case 'memory':
                    const bigArray = new Array(1000000).fill('memory test');
                    res.json({ simulated: 'memory', size: bigArray.length });
                    break;
                case 'error':
                    throw new Error('Simulated error for testing');
                default:
                    res.status(400).json({ error: 'Unknown simulation type' });
            }
        });
    }
    
    startMonitoring() {
        this.logger.info('Starting application performance monitoring');
        
        // System metrics collection
        setInterval(() => {
            this.collectSystemMetrics();
        }, 10000); // Every 10 seconds
        
        // Database metrics collection
        setInterval(() => {
            this.collectDatabaseMetrics();
        }, 30000); // Every 30 seconds
        
        // Business metrics collection
        setInterval(() => {
            this.collectBusinessMetrics();
        }, 60000); // Every minute
        
        // Health checks
        setInterval(() => {
            this.performHealthChecks();
        }, 30000); // Every 30 seconds
        
        // Alert processing
        setInterval(() => {
            this.processAlerts();
        }, 15000); // Every 15 seconds
        
        // Cleanup old metrics
        setInterval(() => {
            this.cleanupMetrics();
        }, 3600000); // Every hour
    }
    
    collectSystemMetrics() {
        try {
            // CPU usage
            const cpuUsage = os.loadavg()[0] / os.cpus().length;
            this.metrics.systemCpuUsage.set(cpuUsage);
            
            // Memory usage
            const memUsage = process.memoryUsage();
            this.metrics.systemMemoryUsage.set(memUsage.heapUsed);
            
            // Instance count (if in cluster mode)
            if (cluster.isMaster) {
                this.metrics.instanceCount.set(Object.keys(cluster.workers).length);
            }
            
            // Check thresholds
            this.checkThresholds('cpu', cpuUsage);
            this.checkThresholds('memory', memUsage.heapUsed / memUsage.heapTotal);
            
        } catch (error) {
            this.logger.error('System metrics collection failed:', error);
        }
    }
    
    async collectDatabaseMetrics() {
        try {
            // Database connection count
            const dbResult = await this.db.query('SELECT count(*) as connections FROM pg_stat_activity');
            this.metrics.databaseConnections.set(parseInt(dbResult.rows[0].connections));
            
            // Redis connection info
            const redisInfo = await this.redis.info('clients');
            const redisConnections = parseInt(redisInfo.match(/connected_clients:(\d+)/)?.[1] || 0);
            this.metrics.redisConnections.set(redisConnections);
            
        } catch (error) {
            this.logger.error('Database metrics collection failed:', error);
        }
    }
    
    async collectBusinessMetrics() {
        try {
            // Active users (last 5 minutes)
            const activeUsersQuery = `
                SELECT COUNT(DISTINCT user_id) as active_users
                FROM user_sessions 
                WHERE last_activity > NOW() - INTERVAL '5 minutes'
            `;
            const activeUsers = await this.db.query(activeUsersQuery);
            this.metrics.activeUsers.set(parseInt(activeUsers.rows[0]?.active_users || 0));
            
            // Containers being tracked
            const containersQuery = `
                SELECT COUNT(*) as total_containers
                FROM containers 
                WHERE status IN ('In Transit', 'At Port', 'Loading')
            `;
            const containers = await this.db.query(containersQuery);
            this.metrics.containerTracked.set(parseInt(containers.rows[0]?.total_containers || 0));
            
            // API calls per minute
            const apiCallsQuery = `
                SELECT COUNT(*) as api_calls
                FROM api_usage 
                WHERE created_at > NOW() - INTERVAL '1 minute'
            `;
            const apiCalls = await this.db.query(apiCallsQuery);
            this.metrics.apiCallsPerMinute.set(parseInt(apiCalls.rows[0]?.api_calls || 0));
            
        } catch (error) {
            this.logger.error('Business metrics collection failed:', error);
        }
    }
    
    checkThresholds(metricType, value) {
        const thresholds = this.thresholds[`${metricType}Usage`];
        if (!thresholds) return;
        
        let severity = null;
        if (value >= thresholds.critical) {
            severity = 'critical';
        } else if (value >= thresholds.warning) {
            severity = 'warning';
        }
        
        if (severity) {
            this.generateAlert({
                type: `${metricType}_usage`,
                severity: severity,
                value: value,
                threshold: thresholds[severity],
                message: `${metricType.toUpperCase()} usage is ${(value * 100).toFixed(1)}% (threshold: ${(thresholds[severity] * 100).toFixed(1)}%)`
            });
        }
    }
    
    async performHealthChecks() {
        const checks = {
            database: await this.checkDatabaseHealth(),
            redis: await this.checkRedisHealth(),
            disk: await this.checkDiskHealth(),
            external_apis: await this.checkExternalAPIs()
        };
        
        // Store health check results
        await this.storeHealthCheckResults(checks);
        
        // Generate alerts for failed checks
        for (const [service, status] of Object.entries(checks)) {
            if (!status.healthy) {
                this.generateAlert({
                    type: 'service_health',
                    severity: 'critical',
                    service: service,
                    message: `${service} health check failed: ${status.error}`
                });
            }
        }
    }
    
    async checkDatabaseHealth() {
        try {
            const start = Date.now();
            await this.db.query('SELECT 1');
            const duration = Date.now() - start;
            
            return {
                healthy: true,
                responseTime: duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async checkRedisHealth() {
        try {
            const start = Date.now();
            await this.redis.ping();
            const duration = Date.now() - start;
            
            return {
                healthy: true,
                responseTime: duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async checkDiskHealth() {
        try {
            const stats = require('fs').statSync('.');
            // This is a simplified check - in production you'd use a proper disk usage library
            return {
                healthy: true,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async checkExternalAPIs() {
        const apis = [
            { name: 'Maersk', url: 'https://api.maersk.com' },
            { name: 'SendGrid', url: 'https://api.sendgrid.com' },
            { name: 'HubSpot', url: 'https://api.hubapi.com' }
        ];
        
        const results = {};
        
        for (const api of apis) {
            try {
                const start = Date.now();
                const response = await axios.get(api.url, { timeout: 5000 });
                const duration = Date.now() - start;
                
                results[api.name] = {
                    healthy: response.status < 500,
                    responseTime: duration,
                    statusCode: response.status
                };
            } catch (error) {
                results[api.name] = {
                    healthy: false,
                    error: error.message
                };
            }
        }
        
        return {
            healthy: Object.values(results).every(r => r.healthy),
            services: results,
            timestamp: new Date().toISOString()
        };
    }
    
    generateAlert(alertData) {
        const alertKey = `${alertData.type}_${alertData.severity}`;
        const now = Date.now();
        
        // Check cooldown to prevent spam
        const lastAlert = this.alertCooldowns.get(alertKey);
        if (lastAlert && (now - lastAlert) < 300000) { // 5 minute cooldown
            return;
        }
        
        this.alertCooldowns.set(alertKey, now);
        
        // Store alert
        this.alertHistory.set(now, {
            ...alertData,
            timestamp: new Date().toISOString(),
            id: `alert_${now}`
        });
        
        // Send notifications
        this.sendAlertNotification(alertData);
        
        // Update metrics
        this.metrics.applicationErrors
            .labels(alertData.type, alertData.severity)
            .inc();
        
        this.logger.warn('Performance alert generated', alertData);
    }
    
    async sendAlertNotification(alertData) {
        try {
            // Slack notification
            if (process.env.SLACK_WEBHOOK && alertData.severity === 'critical') {
                await this.sendSlackAlert(alertData);
            }
            
            // Email notification for critical alerts
            if (alertData.severity === 'critical') {
                await this.sendEmailAlert(alertData);
            }
            
            // Store in database
            await this.storeAlert(alertData);
            
        } catch (error) {
            this.logger.error('Alert notification failed:', error);
        }
    }
    
    async sendSlackAlert(alertData) {
        const payload = {
            text: '🚨 ROOTUIP Performance Alert',
            attachments: [{
                color: alertData.severity === 'critical' ? 'danger' : 'warning',
                fields: [
                    { title: 'Type', value: alertData.type, short: true },
                    { title: 'Severity', value: alertData.severity, short: true },
                    { title: 'Message', value: alertData.message, short: false }
                ],
                timestamp: Math.floor(Date.now() / 1000)
            }]
        };
        
        await axios.post(process.env.SLACK_WEBHOOK, payload);
    }
    
    async triggerScaling(direction) {
        // This would integrate with your container orchestration system
        // (Kubernetes, Docker Swarm, etc.)
        
        this.logger.info(`Scaling ${direction} triggered`, {
            currentInstances: cluster.isMaster ? Object.keys(cluster.workers).length : 1,
            timestamp: new Date().toISOString()
        });
        
        // Auto-scaling logic would go here
        return {
            success: true,
            direction: direction,
            timestamp: new Date().toISOString()
        };
    }
    
    async getPerformanceDashboard() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        
        return {
            system: {
                cpu: this.metrics.systemCpuUsage._value || 0,
                memory: this.metrics.systemMemoryUsage._value || 0,
                instances: this.metrics.instanceCount._value || 1
            },
            application: {
                activeUsers: this.metrics.activeUsers._value || 0,
                containersTracked: this.metrics.containerTracked._value || 0,
                apiCallsPerMinute: this.metrics.apiCallsPerMinute._value || 0
            },
            alerts: Array.from(this.alertHistory.values())
                .filter(alert => new Date(alert.timestamp).getTime() > oneHourAgo)
                .slice(-10),
            timestamp: new Date().toISOString()
        };
    }
    
    async getSystemStatus() {
        return {
            status: 'operational',
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'production',
            timestamp: new Date().toISOString()
        };
    }
    
    handleError(errorData) {
        // Send to Sentry
        Sentry.captureException(new Error(errorData.message || 'Application error'), {
            tags: {
                type: errorData.type,
                statusCode: errorData.statusCode
            },
            extra: errorData
        });
        
        // Generate alert for critical errors
        if (errorData.statusCode >= 500) {
            this.generateAlert({
                type: 'application_error',
                severity: 'error',
                message: `HTTP ${errorData.statusCode} error on ${errorData.path}`,
                details: errorData
            });
        }
    }
    
    start() {
        this.server = this.app.listen(this.port, () => {
            this.logger.info(`Application Performance Monitoring running on port ${this.port}`);
            console.log(`📊 ROOTUIP Application Performance Monitoring`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Metrics: http://localhost:${this.port}/metrics`);
            console.log(`   Dashboard: http://localhost:${this.port}/dashboard/performance`);
            console.log(`   Sentry: ${process.env.SENTRY_DSN ? 'Configured' : 'Not configured'}`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down APM system...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Start monitoring if called directly
if (require.main === module) {
    const apm = new ApplicationPerformanceMonitoring();
    apm.start();
}

module.exports = ApplicationPerformanceMonitoring;