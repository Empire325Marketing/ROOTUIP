/**
 * ROOTUIP Real-Time Monitoring Stack
 * APM, Infrastructure monitoring, and custom business metrics
 */

const EventEmitter = require('events');
const os = require('os');
const cluster = require('cluster');

// Application Performance Monitoring (APM)
class APMMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            sampleRate: config.sampleRate || 0.1,
            flushInterval: config.flushInterval || 30000,
            bufferSize: config.bufferSize || 1000,
            ...config
        };
        
        this.metrics = new Map();
        this.transactions = new Map();
        this.spans = new Map();
        this.buffer = [];
        this.startTime = Date.now();
        
        this.setupMetricsCollection();
        this.startPeriodicFlush();
    }
    
    // Transaction tracking for distributed tracing
    startTransaction(name, type = 'request', metadata = {}) {
        const transactionId = this.generateId();
        const transaction = {
            id: transactionId,
            name,
            type,
            startTime: Date.now(),
            metadata,
            spans: [],
            labels: {},
            outcome: 'unknown'
        };
        
        this.transactions.set(transactionId, transaction);
        return transactionId;
    }
    
    endTransaction(transactionId, outcome = 'success', result = null) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) return;
        
        transaction.endTime = Date.now();
        transaction.duration = transaction.endTime - transaction.startTime;
        transaction.outcome = outcome;
        transaction.result = result;
        
        this.recordMetric('transaction.duration', transaction.duration, {
            name: transaction.name,
            type: transaction.type,
            outcome
        });
        
        this.addToBuffer('transaction', transaction);
        this.transactions.delete(transactionId);
        
        this.emit('transaction_completed', transaction);
    }
    
    // Span tracking for detailed operation monitoring
    startSpan(transactionId, name, type = 'custom', metadata = {}) {
        const spanId = this.generateId();
        const span = {
            id: spanId,
            transactionId,
            name,
            type,
            startTime: Date.now(),
            metadata,
            labels: {}
        };
        
        this.spans.set(spanId, span);
        
        const transaction = this.transactions.get(transactionId);
        if (transaction) {
            transaction.spans.push(spanId);
        }
        
        return spanId;
    }
    
    endSpan(spanId, outcome = 'success') {
        const span = this.spans.get(spanId);
        if (!span) return;
        
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.outcome = outcome;
        
        this.recordMetric('span.duration', span.duration, {
            name: span.name,
            type: span.type,
            outcome
        });
        
        this.addToBuffer('span', span);
        this.spans.delete(spanId);
    }
    
    // Custom metrics recording
    recordMetric(name, value, labels = {}) {
        const metric = {
            name,
            value,
            labels,
            timestamp: Date.now()
        };
        
        // Store in memory for aggregation
        const key = `${name}:${JSON.stringify(labels)}`;
        if (!this.metrics.has(key)) {
            this.metrics.set(key, {
                name,
                labels,
                values: [],
                count: 0,
                sum: 0,
                min: Infinity,
                max: -Infinity
            });
        }
        
        const metricData = this.metrics.get(key);
        metricData.values.push(value);
        metricData.count++;
        metricData.sum += value;
        metricData.min = Math.min(metricData.min, value);
        metricData.max = Math.max(metricData.max, value);
        
        this.addToBuffer('metric', metric);
    }
    
    // Error tracking
    recordError(error, context = {}, labels = {}) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            type: error.constructor.name,
            code: error.code,
            context,
            labels,
            timestamp: Date.now(),
            fingerprint: this.generateErrorFingerprint(error)
        };
        
        this.recordMetric('error.count', 1, {
            type: error.constructor.name,
            ...labels
        });
        
        this.addToBuffer('error', errorData);
        this.emit('error_recorded', errorData);
    }
    
    // Event tracking for business metrics
    recordEvent(event, data = {}, labels = {}) {
        const eventData = {
            event,
            data,
            labels,
            timestamp: Date.now()
        };
        
        this.recordMetric(`event.${event}`, 1, labels);
        this.addToBuffer('event', eventData);
    }
    
    setupMetricsCollection() {
        // System metrics collection
        setInterval(() => {
            this.collectSystemMetrics();
        }, 5000);
        
        // Process metrics collection
        setInterval(() => {
            this.collectProcessMetrics();
        }, 10000);
    }
    
    collectSystemMetrics() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const memory = process.memoryUsage();
        
        // CPU metrics
        this.recordMetric('system.cpu.count', cpus.length);
        this.recordMetric('system.load.1m', loadAvg[0]);
        this.recordMetric('system.load.5m', loadAvg[1]);
        this.recordMetric('system.load.15m', loadAvg[2]);
        
        // Memory metrics
        this.recordMetric('system.memory.total', os.totalmem());
        this.recordMetric('system.memory.free', os.freemem());
        this.recordMetric('system.memory.used', os.totalmem() - os.freemem());
        
        // Process memory
        this.recordMetric('process.memory.rss', memory.rss);
        this.recordMetric('process.memory.heap_used', memory.heapUsed);
        this.recordMetric('process.memory.heap_total', memory.heapTotal);
        this.recordMetric('process.memory.external', memory.external);
    }
    
    collectProcessMetrics() {
        const uptime = process.uptime();
        
        this.recordMetric('process.uptime', uptime);
        this.recordMetric('process.pid', process.pid);
        
        if (cluster.isWorker) {
            this.recordMetric('cluster.worker.id', cluster.worker.id);
        }
    }
    
    addToBuffer(type, data) {
        this.buffer.push({ type, data, timestamp: Date.now() });
        
        if (this.buffer.length >= this.config.bufferSize) {
            this.flush();
        }
    }
    
    startPeriodicFlush() {
        setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    
    flush() {
        if (this.buffer.length === 0) return;
        
        const data = [...this.buffer];
        this.buffer = [];
        
        // Emit for external processors (Elasticsearch, DataDog, etc.)
        this.emit('data_flush', {
            timestamp: Date.now(),
            data,
            aggregated_metrics: this.getAggregatedMetrics()
        });
        
        // Reset aggregated metrics
        this.metrics.clear();
    }
    
    getAggregatedMetrics() {
        const aggregated = [];
        
        this.metrics.forEach((metric, key) => {
            const avg = metric.sum / metric.count;
            const percentiles = this.calculatePercentiles(metric.values);
            
            aggregated.push({
                name: metric.name,
                labels: metric.labels,
                count: metric.count,
                sum: metric.sum,
                min: metric.min,
                max: metric.max,
                avg,
                p50: percentiles.p50,
                p95: percentiles.p95,
                p99: percentiles.p99
            });
        });
        
        return aggregated;
    }
    
    calculatePercentiles(values) {
        const sorted = values.sort((a, b) => a - b);
        const count = sorted.length;
        
        return {
            p50: sorted[Math.floor(count * 0.5)],
            p95: sorted[Math.floor(count * 0.95)],
            p99: sorted[Math.floor(count * 0.99)]
        };
    }
    
    generateErrorFingerprint(error) {
        const crypto = require('crypto');
        const fingerprint = `${error.constructor.name}:${error.message}`;
        return crypto.createHash('md5').update(fingerprint).digest('hex');
    }
    
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
}

// Infrastructure Monitoring
class InfrastructureMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.services = new Map();
        this.alerts = [];
        this.thresholds = new Map();
        
        this.setupDefaultThresholds();
        this.startHealthChecks();
    }
    
    setupDefaultThresholds() {
        this.thresholds.set('cpu_usage', { warning: 70, critical: 90 });
        this.thresholds.set('memory_usage', { warning: 80, critical: 95 });
        this.thresholds.set('disk_usage', { warning: 80, critical: 90 });
        this.thresholds.set('response_time', { warning: 1000, critical: 5000 });
        this.thresholds.set('error_rate', { warning: 0.05, critical: 0.1 });
    }
    
    registerService(name, config) {
        this.services.set(name, {
            name,
            url: config.url,
            healthEndpoint: config.healthEndpoint || '/health',
            timeout: config.timeout || 5000,
            interval: config.interval || 30000,
            status: 'unknown',
            lastCheck: null,
            responseTime: null,
            consecutiveFailures: 0
        });
    }
    
    startHealthChecks() {
        this.services.forEach((service) => {
            this.scheduleHealthCheck(service);
        });
    }
    
    scheduleHealthCheck(service) {
        const check = async () => {
            await this.performHealthCheck(service);
            setTimeout(check, service.interval);
        };
        
        setTimeout(check, 1000); // Start after 1 second
    }
    
    async performHealthCheck(service) {
        const startTime = Date.now();
        
        try {
            const response = await this.makeHealthRequest(service);
            const responseTime = Date.now() - startTime;
            
            service.status = response.status === 200 ? 'healthy' : 'unhealthy';
            service.responseTime = responseTime;
            service.lastCheck = new Date();
            service.consecutiveFailures = 0;
            
            this.checkThresholds(service, {
                response_time: responseTime
            });
            
            this.emit('health_check_completed', {
                service: service.name,
                status: service.status,
                responseTime,
                timestamp: service.lastCheck
            });
            
        } catch (error) {
            service.status = 'unhealthy';
            service.lastCheck = new Date();
            service.consecutiveFailures++;
            
            this.emit('health_check_failed', {
                service: service.name,
                error: error.message,
                consecutiveFailures: service.consecutiveFailures,
                timestamp: service.lastCheck
            });
            
            if (service.consecutiveFailures >= 3) {
                this.triggerAlert('critical', `Service ${service.name} is down`, {
                    service: service.name,
                    consecutiveFailures: service.consecutiveFailures
                });
            }
        }
    }
    
    async makeHealthRequest(service) {
        const { default: fetch } = await import('node-fetch');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), service.timeout);
        
        try {
            const response = await fetch(`${service.url}${service.healthEndpoint}`, {
                signal: controller.signal,
                timeout: service.timeout
            });
            
            clearTimeout(timeout);
            return response;
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }
    
    checkThresholds(service, metrics) {
        Object.entries(metrics).forEach(([metric, value]) => {
            const threshold = this.thresholds.get(metric);
            if (!threshold) return;
            
            if (value >= threshold.critical) {
                this.triggerAlert('critical', `${metric} critical threshold exceeded`, {
                    service: service.name,
                    metric,
                    value,
                    threshold: threshold.critical
                });
            } else if (value >= threshold.warning) {
                this.triggerAlert('warning', `${metric} warning threshold exceeded`, {
                    service: service.name,
                    metric,
                    value,
                    threshold: threshold.warning
                });
            }
        });
    }
    
    triggerAlert(severity, message, data = {}) {
        const alert = {
            id: this.generateAlertId(),
            severity,
            message,
            data,
            timestamp: new Date(),
            acknowledged: false,
            resolved: false
        };
        
        this.alerts.push(alert);
        this.emit('alert_triggered', alert);
        
        // Auto-resolve warning alerts after 5 minutes if no new occurrences
        if (severity === 'warning') {
            setTimeout(() => {
                this.resolveAlert(alert.id, 'auto-resolved');
            }, 300000);
        }
    }
    
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedBy = acknowledgedBy;
            alert.acknowledgedAt = new Date();
            this.emit('alert_acknowledged', alert);
        }
    }
    
    resolveAlert(alertId, resolvedBy) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            alert.resolvedBy = resolvedBy;
            alert.resolvedAt = new Date();
            this.emit('alert_resolved', alert);
        }
    }
    
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getSystemStatus() {
        const services = Array.from(this.services.values()).map(service => ({
            name: service.name,
            status: service.status,
            responseTime: service.responseTime,
            lastCheck: service.lastCheck
        }));
        
        const activeAlerts = this.alerts.filter(alert => !alert.resolved);
        
        return {
            services,
            activeAlerts: activeAlerts.length,
            criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
            warningAlerts: activeAlerts.filter(a => a.severity === 'warning').length,
            systemHealth: this.calculateSystemHealth(services)
        };
    }
    
    calculateSystemHealth(services) {
        const healthyServices = services.filter(s => s.status === 'healthy').length;
        const totalServices = services.length;
        
        if (totalServices === 0) return 'unknown';
        
        const healthPercentage = (healthyServices / totalServices) * 100;
        
        if (healthPercentage === 100) return 'healthy';
        if (healthPercentage >= 80) return 'degraded';
        return 'unhealthy';
    }
}

// Business Metrics Dashboard
class BusinessMetricsDashboard {
    constructor(apmMonitor) {
        this.apm = apmMonitor;
        this.businessMetrics = new Map();
        this.kpis = new Map();
        
        this.setupBusinessMetrics();
        this.setupKPIs();
    }
    
    setupBusinessMetrics() {
        // Container tracking metrics
        this.defineMetric('containers_tracked_total', 'counter', 'Total containers tracked');
        this.defineMetric('containers_tracked_rate', 'gauge', 'Containers tracked per hour');
        this.defineMetric('tracking_accuracy', 'gauge', 'Tracking data accuracy percentage');
        
        // User engagement metrics
        this.defineMetric('active_users_daily', 'gauge', 'Daily active users');
        this.defineMetric('api_requests_total', 'counter', 'Total API requests');
        this.defineMetric('api_requests_rate', 'gauge', 'API requests per minute');
        
        // Revenue metrics
        this.defineMetric('revenue_total', 'counter', 'Total revenue');
        this.defineMetric('revenue_rate', 'gauge', 'Revenue per hour');
        this.defineMetric('customer_acquisition_cost', 'gauge', 'Customer acquisition cost');
        
        // Performance metrics
        this.defineMetric('user_satisfaction_score', 'gauge', 'User satisfaction score');
        this.defineMetric('data_quality_score', 'gauge', 'Data quality score');
    }
    
    setupKPIs() {
        this.kpis.set('operational_efficiency', {
            name: 'Operational Efficiency',
            calculation: () => this.calculateOperationalEfficiency(),
            target: 95,
            unit: '%'
        });
        
        this.kpis.set('customer_satisfaction', {
            name: 'Customer Satisfaction',
            calculation: () => this.getMetricValue('user_satisfaction_score'),
            target: 4.5,
            unit: '/5'
        });
        
        this.kpis.set('data_accuracy', {
            name: 'Data Accuracy',
            calculation: () => this.getMetricValue('tracking_accuracy'),
            target: 99,
            unit: '%'
        });
        
        this.kpis.set('system_uptime', {
            name: 'System Uptime',
            calculation: () => this.calculateUptime(),
            target: 99.9,
            unit: '%'
        });
    }
    
    defineMetric(name, type, description) {
        this.businessMetrics.set(name, {
            name,
            type,
            description,
            value: type === 'counter' ? 0 : null,
            lastUpdated: null
        });
    }
    
    recordBusinessMetric(name, value, labels = {}) {
        const metric = this.businessMetrics.get(name);
        if (!metric) return;
        
        if (metric.type === 'counter') {
            metric.value += value;
        } else {
            metric.value = value;
        }
        
        metric.lastUpdated = new Date();
        
        // Also record in APM for correlation
        this.apm.recordMetric(`business.${name}`, value, labels);
    }
    
    getMetricValue(name) {
        const metric = this.businessMetrics.get(name);
        return metric ? metric.value : null;
    }
    
    calculateOperationalEfficiency() {
        const successfulRequests = this.getMetricValue('api_requests_successful') || 0;
        const totalRequests = this.getMetricValue('api_requests_total') || 1;
        
        return (successfulRequests / totalRequests) * 100;
    }
    
    calculateUptime() {
        // This would typically be calculated based on downtime records
        // For now, return a calculated value
        return 99.95; // Example value
    }
    
    getDashboardData() {
        const metrics = Object.fromEntries(this.businessMetrics);
        const kpiValues = {};
        
        this.kpis.forEach((kpi, key) => {
            const value = kpi.calculation();
            kpiValues[key] = {
                name: kpi.name,
                value,
                target: kpi.target,
                unit: kpi.unit,
                status: this.getKPIStatus(value, kpi.target)
            };
        });
        
        return {
            timestamp: new Date(),
            metrics,
            kpis: kpiValues,
            alerts: this.getActiveAlerts()
        };
    }
    
    getKPIStatus(value, target) {
        if (value === null || value === undefined) return 'unknown';
        
        const percentage = (value / target) * 100;
        
        if (percentage >= 100) return 'excellent';
        if (percentage >= 90) return 'good';
        if (percentage >= 70) return 'warning';
        return 'critical';
    }
    
    getActiveAlerts() {
        // This would integrate with the alert system
        return [];
    }
}

module.exports = {
    APMMonitor,
    InfrastructureMonitor,
    BusinessMetricsDashboard
};