/**
 * ROOTUIP Performance Monitoring Service
 * Real-time performance tracking, error monitoring, and alerting
 */

const express = require('express');
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const os = require('os');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const responseTime = require('response-time');

class PerformanceMonitor extends EventEmitter {
    constructor(port = 3009) {
        super();
        this.port = port;
        this.app = express();
        this.server = require('http').createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        // Performance metrics storage
        this.metrics = {
            pageLoads: new Map(),
            apiCalls: new Map(),
            errors: [],
            dbQueries: [],
            resources: new Map(),
            vitals: {
                cpu: [],
                memory: [],
                responseTime: []
            }
        };
        
        // Performance thresholds
        this.thresholds = {
            pageLoad: 2000, // 2 seconds
            apiResponse: 500, // 500ms
            dbQuery: 100, // 100ms
            errorRate: 0.01, // 1%
            cpuUsage: 80, // 80%
            memoryUsage: 85 // 85%
        };
        
        // Alert configurations
        this.alerts = {
            email: process.env.ALERT_EMAIL || 'alerts@rootuip.com',
            webhook: process.env.ALERT_WEBHOOK,
            cooldown: 300000 // 5 minutes between same alerts
        };
        
        this.alertHistory = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startMonitoring();
    }

    setupMiddleware() {
        // Compression for all responses
        this.app.use(compression({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        }));

        // Response time tracking
        this.app.use(responseTime((req, res, time) => {
            this.recordApiCall(req.path, req.method, time, res.statusCode);
        }));

        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });

        this.app.use(express.json());
    }

    setupRoutes() {
        // Performance monitoring dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'performance-dashboard.html'));
        });

        // Client-side performance beacon
        this.app.post('/beacon', (req, res) => {
            const { type, data } = req.body;
            
            switch (type) {
                case 'pageLoad':
                    this.recordPageLoad(data);
                    break;
                case 'error':
                    this.recordError(data);
                    break;
                case 'resource':
                    this.recordResourceTiming(data);
                    break;
                case 'vitals':
                    this.recordWebVitals(data);
                    break;
            }
            
            res.status(204).send();
        });

        // Real-time metrics API
        this.app.get('/api/metrics', (req, res) => {
            res.json(this.getMetricsSummary());
        });

        // Historical metrics
        this.app.get('/api/metrics/history', (req, res) => {
            const duration = req.query.duration || '1h';
            res.json(this.getHistoricalMetrics(duration));
        });

        // Error details
        this.app.get('/api/errors', (req, res) => {
            const limit = parseInt(req.query.limit) || 100;
            res.json(this.metrics.errors.slice(-limit));
        });

        // Database query analysis
        this.app.get('/api/db/slow-queries', (req, res) => {
            const threshold = parseInt(req.query.threshold) || 100;
            const slowQueries = this.metrics.dbQueries
                .filter(q => q.duration > threshold)
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 50);
            res.json(slowQueries);
        });

        // Performance recommendations
        this.app.get('/api/recommendations', (req, res) => {
            res.json(this.generateRecommendations());
        });

        // Health check
        this.app.get('/health', (req, res) => {
            const health = this.getHealthStatus();
            res.status(health.status === 'healthy' ? 200 : 503).json(health);
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('New monitoring dashboard connected');
            
            // Send initial metrics
            ws.send(JSON.stringify({
                type: 'initial',
                data: this.getMetricsSummary()
            }));

            // Send real-time updates
            const interval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'update',
                        data: this.getRealTimeMetrics()
                    }));
                }
            }, 1000);

            ws.on('close', () => {
                clearInterval(interval);
            });
        });
    }

    startMonitoring() {
        // System metrics collection
        setInterval(() => {
            this.collectSystemMetrics();
        }, 5000);

        // Metric aggregation
        setInterval(() => {
            this.aggregateMetrics();
        }, 60000);

        // Alert checking
        setInterval(() => {
            this.checkAlerts();
        }, 30000);

        // Cleanup old data
        setInterval(() => {
            this.cleanupOldData();
        }, 3600000); // Every hour
    }

    recordPageLoad(data) {
        const {
            url,
            loadTime,
            domContentLoaded,
            firstPaint,
            firstContentfulPaint,
            largestContentfulPaint,
            timeToInteractive,
            totalBlockingTime,
            cumulativeLayoutShift
        } = data;

        const timestamp = Date.now();
        const metrics = {
            timestamp,
            url,
            loadTime,
            domContentLoaded,
            firstPaint,
            firstContentfulPaint,
            largestContentfulPaint,
            timeToInteractive,
            totalBlockingTime,
            cumulativeLayoutShift
        };

        // Store by URL
        if (!this.metrics.pageLoads.has(url)) {
            this.metrics.pageLoads.set(url, []);
        }
        this.metrics.pageLoads.get(url).push(metrics);

        // Check threshold
        if (loadTime > this.thresholds.pageLoad) {
            this.triggerAlert('slow_page_load', {
                url,
                loadTime,
                threshold: this.thresholds.pageLoad
            });
        }

        // Emit for real-time updates
        this.emit('pageLoad', metrics);
    }

    recordApiCall(endpoint, method, responseTime, statusCode) {
        const timestamp = Date.now();
        const key = `${method} ${endpoint}`;
        
        if (!this.metrics.apiCalls.has(key)) {
            this.metrics.apiCalls.set(key, []);
        }

        const metric = {
            timestamp,
            endpoint,
            method,
            responseTime,
            statusCode,
            success: statusCode < 400
        };

        this.metrics.apiCalls.get(key).push(metric);

        // Check threshold
        if (responseTime > this.thresholds.apiResponse) {
            this.triggerAlert('slow_api', {
                endpoint,
                method,
                responseTime,
                threshold: this.thresholds.apiResponse
            });
        }

        this.emit('apiCall', metric);
    }

    recordError(data) {
        const error = {
            timestamp: Date.now(),
            ...data,
            userAgent: data.userAgent || 'unknown',
            resolved: false
        };

        this.metrics.errors.push(error);

        // Trigger immediate alert for critical errors
        if (data.severity === 'critical') {
            this.triggerAlert('critical_error', error);
        }

        this.emit('error', error);
    }

    recordResourceTiming(data) {
        const { url, duration, size, type } = data;
        
        if (!this.metrics.resources.has(type)) {
            this.metrics.resources.set(type, []);
        }

        this.metrics.resources.get(type).push({
            timestamp: Date.now(),
            url,
            duration,
            size
        });
    }

    recordWebVitals(data) {
        // Store Core Web Vitals
        this.metrics.vitals = {
            ...this.metrics.vitals,
            lastUpdate: Date.now(),
            ...data
        };
    }

    recordDatabaseQuery(query) {
        const queryMetric = {
            timestamp: Date.now(),
            query: query.sql,
            duration: query.duration,
            rows: query.rows,
            table: this.extractTableName(query.sql)
        };

        this.metrics.dbQueries.push(queryMetric);

        if (query.duration > this.thresholds.dbQuery) {
            this.triggerAlert('slow_query', queryMetric);
        }
    }

    collectSystemMetrics() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

        this.metrics.vitals.cpu.push({
            timestamp: Date.now(),
            usage: cpuUsage
        });

        this.metrics.vitals.memory.push({
            timestamp: Date.now(),
            usage: memoryUsage,
            total: totalMem,
            free: freeMem
        });

        // Keep only last hour
        const oneHourAgo = Date.now() - 3600000;
        this.metrics.vitals.cpu = this.metrics.vitals.cpu.filter(m => m.timestamp > oneHourAgo);
        this.metrics.vitals.memory = this.metrics.vitals.memory.filter(m => m.timestamp > oneHourAgo);
    }

    getMetricsSummary() {
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;

        // Page load statistics
        const recentPageLoads = [];
        this.metrics.pageLoads.forEach((loads, url) => {
            const recent = loads.filter(l => l.timestamp > fiveMinutesAgo);
            recentPageLoads.push(...recent);
        });

        const avgPageLoad = recentPageLoads.length > 0
            ? recentPageLoads.reduce((sum, l) => sum + l.loadTime, 0) / recentPageLoads.length
            : 0;

        // API call statistics
        const recentApiCalls = [];
        this.metrics.apiCalls.forEach((calls) => {
            const recent = calls.filter(c => c.timestamp > fiveMinutesAgo);
            recentApiCalls.push(...recent);
        });

        const avgApiResponse = recentApiCalls.length > 0
            ? recentApiCalls.reduce((sum, c) => sum + c.responseTime, 0) / recentApiCalls.length
            : 0;

        const apiErrorRate = recentApiCalls.length > 0
            ? recentApiCalls.filter(c => !c.success).length / recentApiCalls.length
            : 0;

        // Recent errors
        const recentErrors = this.metrics.errors.filter(e => e.timestamp > fiveMinutesAgo);

        // System metrics
        const latestCpu = this.metrics.vitals.cpu[this.metrics.vitals.cpu.length - 1]?.usage || 0;
        const latestMemory = this.metrics.vitals.memory[this.metrics.vitals.memory.length - 1]?.usage || 0;

        return {
            summary: {
                avgPageLoad,
                avgApiResponse,
                apiErrorRate,
                errorCount: recentErrors.length,
                cpuUsage: latestCpu,
                memoryUsage: latestMemory,
                activeConnections: this.wss.clients.size
            },
            pageLoads: {
                count: recentPageLoads.length,
                average: avgPageLoad,
                p95: this.calculatePercentile(recentPageLoads.map(l => l.loadTime), 95),
                slowest: recentPageLoads.sort((a, b) => b.loadTime - a.loadTime).slice(0, 5)
            },
            apiCalls: {
                count: recentApiCalls.length,
                average: avgApiResponse,
                errorRate: apiErrorRate,
                byEndpoint: this.groupApiCallsByEndpoint(recentApiCalls)
            },
            errors: {
                recent: recentErrors.slice(-10),
                byType: this.groupErrorsByType(recentErrors)
            },
            system: {
                cpu: latestCpu,
                memory: latestMemory,
                uptime: process.uptime()
            }
        };
    }

    getRealTimeMetrics() {
        const latest = {
            timestamp: Date.now(),
            cpu: this.metrics.vitals.cpu[this.metrics.vitals.cpu.length - 1]?.usage || 0,
            memory: this.metrics.vitals.memory[this.metrics.vitals.memory.length - 1]?.usage || 0,
            activeRequests: this.getActiveRequestCount(),
            errorRate: this.getRecentErrorRate(),
            avgResponseTime: this.getRecentAvgResponseTime()
        };

        return latest;
    }

    generateRecommendations() {
        const recommendations = [];
        const metrics = this.getMetricsSummary();

        // Page load recommendations
        if (metrics.pageLoads.average > this.thresholds.pageLoad) {
            recommendations.push({
                category: 'performance',
                severity: 'high',
                title: 'Slow Page Load Times',
                description: `Average page load time (${metrics.pageLoads.average.toFixed(0)}ms) exceeds target (${this.thresholds.pageLoad}ms)`,
                actions: [
                    'Enable browser caching for static assets',
                    'Implement lazy loading for images',
                    'Minimize JavaScript bundle size',
                    'Use CDN for global distribution'
                ]
            });
        }

        // API performance
        if (metrics.apiCalls.average > this.thresholds.apiResponse) {
            recommendations.push({
                category: 'api',
                severity: 'medium',
                title: 'Slow API Response Times',
                description: `Average API response time (${metrics.apiCalls.average.toFixed(0)}ms) exceeds target (${this.thresholds.apiResponse}ms)`,
                actions: [
                    'Implement Redis caching for frequent queries',
                    'Optimize database indexes',
                    'Use connection pooling',
                    'Consider API response pagination'
                ]
            });
        }

        // Database optimization
        const slowQueries = this.metrics.dbQueries.filter(q => q.duration > this.thresholds.dbQuery);
        if (slowQueries.length > 10) {
            recommendations.push({
                category: 'database',
                severity: 'high',
                title: 'Database Performance Issues',
                description: `${slowQueries.length} slow queries detected`,
                actions: [
                    'Add indexes for frequently queried columns',
                    'Optimize JOIN operations',
                    'Use query result caching',
                    'Consider database sharding for scale'
                ]
            });
        }

        // Error rate
        if (metrics.apiCalls.errorRate > this.thresholds.errorRate) {
            recommendations.push({
                category: 'reliability',
                severity: 'critical',
                title: 'High Error Rate',
                description: `Error rate (${(metrics.apiCalls.errorRate * 100).toFixed(2)}%) exceeds threshold (${this.thresholds.errorRate * 100}%)`,
                actions: [
                    'Implement circuit breakers',
                    'Add retry logic with exponential backoff',
                    'Improve error handling and logging',
                    'Set up automated error alerts'
                ]
            });
        }

        // Resource usage
        if (metrics.system.cpu > this.thresholds.cpuUsage) {
            recommendations.push({
                category: 'infrastructure',
                severity: 'medium',
                title: 'High CPU Usage',
                description: `CPU usage (${metrics.system.cpu.toFixed(1)}%) approaching limit`,
                actions: [
                    'Scale horizontally with load balancing',
                    'Optimize CPU-intensive operations',
                    'Implement request queuing',
                    'Consider upgrading server resources'
                ]
            });
        }

        return recommendations;
    }

    triggerAlert(type, data) {
        const alertKey = `${type}_${JSON.stringify(data)}`;
        const lastAlert = this.alertHistory.get(alertKey);
        
        // Check cooldown period
        if (lastAlert && Date.now() - lastAlert < this.alerts.cooldown) {
            return;
        }

        this.alertHistory.set(alertKey, Date.now());

        const alert = {
            type,
            severity: this.getAlertSeverity(type),
            timestamp: new Date().toISOString(),
            data,
            message: this.formatAlertMessage(type, data)
        };

        // Log alert
        console.error(`[ALERT] ${alert.message}`);

        // Send webhook if configured
        if (this.alerts.webhook) {
            this.sendWebhookAlert(alert);
        }

        // Emit for real-time dashboard
        this.emit('alert', alert);
    }

    getAlertSeverity(type) {
        const severityMap = {
            'critical_error': 'critical',
            'slow_page_load': 'high',
            'slow_api': 'medium',
            'slow_query': 'medium',
            'high_error_rate': 'high',
            'high_cpu': 'medium',
            'high_memory': 'medium'
        };
        return severityMap[type] || 'low';
    }

    formatAlertMessage(type, data) {
        const messages = {
            'critical_error': `Critical error: ${data.message} at ${data.url}`,
            'slow_page_load': `Slow page load: ${data.url} took ${data.loadTime}ms (threshold: ${data.threshold}ms)`,
            'slow_api': `Slow API: ${data.method} ${data.endpoint} took ${data.responseTime}ms`,
            'slow_query': `Slow database query: ${data.duration}ms for table ${data.table}`,
            'high_error_rate': `High error rate: ${(data.rate * 100).toFixed(2)}% errors`,
            'high_cpu': `High CPU usage: ${data.usage.toFixed(1)}%`,
            'high_memory': `High memory usage: ${data.usage.toFixed(1)}%`
        };
        return messages[type] || `Alert: ${type}`;
    }

    async sendWebhookAlert(alert) {
        try {
            const response = await fetch(this.alerts.webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert)
            });
            
            if (!response.ok) {
                console.error('Failed to send webhook alert:', response.statusText);
            }
        } catch (error) {
            console.error('Error sending webhook alert:', error);
        }
    }

    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    groupApiCallsByEndpoint(calls) {
        const grouped = {};
        calls.forEach(call => {
            const key = `${call.method} ${call.endpoint}`;
            if (!grouped[key]) {
                grouped[key] = {
                    count: 0,
                    totalTime: 0,
                    errors: 0
                };
            }
            grouped[key].count++;
            grouped[key].totalTime += call.responseTime;
            if (!call.success) grouped[key].errors++;
        });

        Object.keys(grouped).forEach(key => {
            grouped[key].avgTime = grouped[key].totalTime / grouped[key].count;
            grouped[key].errorRate = grouped[key].errors / grouped[key].count;
        });

        return grouped;
    }

    groupErrorsByType(errors) {
        const grouped = {};
        errors.forEach(error => {
            const type = error.type || 'unknown';
            grouped[type] = (grouped[type] || 0) + 1;
        });
        return grouped;
    }

    extractTableName(sql) {
        const match = sql.match(/(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+`?(\w+)`?/i);
        return match ? match[1] : 'unknown';
    }

    getActiveRequestCount() {
        // This would be tracked by middleware in production
        return Math.floor(Math.random() * 50);
    }

    getRecentErrorRate() {
        const fiveMinutesAgo = Date.now() - 300000;
        const recentApiCalls = [];
        
        this.metrics.apiCalls.forEach((calls) => {
            const recent = calls.filter(c => c.timestamp > fiveMinutesAgo);
            recentApiCalls.push(...recent);
        });

        if (recentApiCalls.length === 0) return 0;
        return recentApiCalls.filter(c => !c.success).length / recentApiCalls.length;
    }

    getRecentAvgResponseTime() {
        const oneMinuteAgo = Date.now() - 60000;
        const recentApiCalls = [];
        
        this.metrics.apiCalls.forEach((calls) => {
            const recent = calls.filter(c => c.timestamp > oneMinuteAgo);
            recentApiCalls.push(...recent);
        });

        if (recentApiCalls.length === 0) return 0;
        return recentApiCalls.reduce((sum, c) => sum + c.responseTime, 0) / recentApiCalls.length;
    }

    getHealthStatus() {
        const metrics = this.getMetricsSummary();
        const issues = [];

        if (metrics.summary.avgPageLoad > this.thresholds.pageLoad) {
            issues.push('Slow page loads');
        }
        if (metrics.summary.apiErrorRate > this.thresholds.errorRate) {
            issues.push('High error rate');
        }
        if (metrics.summary.cpuUsage > this.thresholds.cpuUsage) {
            issues.push('High CPU usage');
        }
        if (metrics.summary.memoryUsage > this.thresholds.memoryUsage) {
            issues.push('High memory usage');
        }

        return {
            status: issues.length === 0 ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            issues,
            metrics: {
                pageLoad: metrics.summary.avgPageLoad,
                apiResponse: metrics.summary.avgApiResponse,
                errorRate: metrics.summary.apiErrorRate,
                cpu: metrics.summary.cpuUsage,
                memory: metrics.summary.memoryUsage
            }
        };
    }

    cleanupOldData() {
        const oneDayAgo = Date.now() - 86400000;

        // Clean page loads
        this.metrics.pageLoads.forEach((loads, url) => {
            const filtered = loads.filter(l => l.timestamp > oneDayAgo);
            if (filtered.length === 0) {
                this.metrics.pageLoads.delete(url);
            } else {
                this.metrics.pageLoads.set(url, filtered);
            }
        });

        // Clean API calls
        this.metrics.apiCalls.forEach((calls, key) => {
            const filtered = calls.filter(c => c.timestamp > oneDayAgo);
            if (filtered.length === 0) {
                this.metrics.apiCalls.delete(key);
            } else {
                this.metrics.apiCalls.set(key, filtered);
            }
        });

        // Clean errors (keep last 1000)
        this.metrics.errors = this.metrics.errors.slice(-1000);

        // Clean DB queries (keep last 1000)
        this.metrics.dbQueries = this.metrics.dbQueries.slice(-1000);
    }

    getHistoricalMetrics(duration) {
        const durationMs = this.parseDuration(duration);
        const since = Date.now() - durationMs;
        
        // Aggregate metrics by time buckets
        const bucketSize = this.getBucketSize(durationMs);
        const buckets = new Map();

        // Process page loads
        this.metrics.pageLoads.forEach((loads) => {
            loads.filter(l => l.timestamp > since).forEach(load => {
                const bucket = Math.floor(load.timestamp / bucketSize) * bucketSize;
                if (!buckets.has(bucket)) {
                    buckets.set(bucket, {
                        timestamp: bucket,
                        pageLoads: [],
                        apiCalls: [],
                        errors: 0
                    });
                }
                buckets.get(bucket).pageLoads.push(load.loadTime);
            });
        });

        // Process API calls
        this.metrics.apiCalls.forEach((calls) => {
            calls.filter(c => c.timestamp > since).forEach(call => {
                const bucket = Math.floor(call.timestamp / bucketSize) * bucketSize;
                if (!buckets.has(bucket)) {
                    buckets.set(bucket, {
                        timestamp: bucket,
                        pageLoads: [],
                        apiCalls: [],
                        errors: 0
                    });
                }
                buckets.get(bucket).apiCalls.push(call.responseTime);
                if (!call.success) buckets.get(bucket).errors++;
            });
        });

        // Convert to array and calculate averages
        const history = Array.from(buckets.values()).map(bucket => ({
            timestamp: bucket.timestamp,
            pageLoad: bucket.pageLoads.length > 0 
                ? bucket.pageLoads.reduce((a, b) => a + b, 0) / bucket.pageLoads.length 
                : null,
            apiResponse: bucket.apiCalls.length > 0 
                ? bucket.apiCalls.reduce((a, b) => a + b, 0) / bucket.apiCalls.length 
                : null,
            errorRate: bucket.apiCalls.length > 0 
                ? bucket.errors / bucket.apiCalls.length 
                : 0
        })).sort((a, b) => a.timestamp - b.timestamp);

        return {
            duration,
            bucketSize,
            data: history
        };
    }

    parseDuration(duration) {
        const units = {
            'm': 60000,
            'h': 3600000,
            'd': 86400000,
            'w': 604800000
        };
        const match = duration.match(/^(\d+)([mhdw])$/);
        if (!match) return 3600000; // Default 1 hour
        return parseInt(match[1]) * units[match[2]];
    }

    getBucketSize(durationMs) {
        if (durationMs <= 3600000) return 60000; // 1 minute buckets for <= 1 hour
        if (durationMs <= 86400000) return 300000; // 5 minute buckets for <= 1 day
        if (durationMs <= 604800000) return 3600000; // 1 hour buckets for <= 1 week
        return 86400000; // 1 day buckets for > 1 week
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Performance Monitor running on port ${this.port}`);
            console.log(`Dashboard: http://localhost:${this.port}`);
        });
    }
}

// Export for use in other services
module.exports = PerformanceMonitor;

// Start if run directly
if (require.main === module) {
    const monitor = new PerformanceMonitor();
    monitor.start();
}