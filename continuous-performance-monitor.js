/**
 * ROOTUIP Continuous Performance Monitoring
 * Automated performance regression detection and monitoring
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class ContinuousPerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            checkInterval: config.checkInterval || 300000, // 5 minutes
            baselineWindow: config.baselineWindow || 86400000, // 24 hours
            alertThresholds: {
                responseTime: { warning: 1.1, critical: 1.5 }, // 10% and 50% increase
                errorRate: { warning: 0.02, critical: 0.05 }, // 2% and 5%
                throughput: { warning: 0.9, critical: 0.7 }, // 10% and 30% decrease
                cpu: { warning: 80, critical: 95 },
                memory: { warning: 85, critical: 95 }
            },
            ...config
        };
        
        this.metrics = new Map();
        this.baselines = new Map();
        this.alerts = new Map();
        this.reports = new Map();
        
        this.initializeMonitoring();
    }
    
    // Initialize monitoring
    initializeMonitoring() {
        this.setupMetricCollectors();
        this.loadBaselines();
        this.startContinuousMonitoring();
        
        console.log('Continuous Performance Monitor initialized');
    }
    
    // Setup metric collectors
    setupMetricCollectors() {
        this.collectors = {
            response_time: this.collectResponseTimeMetrics.bind(this),
            throughput: this.collectThroughputMetrics.bind(this),
            error_rate: this.collectErrorRateMetrics.bind(this),
            resource_usage: this.collectResourceMetrics.bind(this),
            database_performance: this.collectDatabaseMetrics.bind(this),
            api_performance: this.collectAPIMetrics.bind(this),
            websocket_metrics: this.collectWebSocketMetrics.bind(this),
            ml_performance: this.collectMLMetrics.bind(this)
        };
    }
    
    // Start continuous monitoring
    startContinuousMonitoring() {
        // Initial collection
        this.collectAllMetrics();
        
        // Regular collection
        this.monitoringInterval = setInterval(() => {
            this.collectAllMetrics();
        }, this.config.checkInterval);
        
        // Baseline updates
        this.baselineInterval = setInterval(() => {
            this.updateBaselines();
        }, 3600000); // Every hour
        
        // Report generation
        this.reportInterval = setInterval(() => {
            this.generatePerformanceReport();
        }, 86400000); // Daily
    }
    
    // Collect all metrics
    async collectAllMetrics() {
        const timestamp = new Date();
        const collectedMetrics = {};
        
        for (const [name, collector] of Object.entries(this.collectors)) {
            try {
                collectedMetrics[name] = await collector();
            } catch (error) {
                console.error(`Failed to collect ${name} metrics:`, error);
                collectedMetrics[name] = null;
            }
        }
        
        // Store metrics
        this.storeMetrics(timestamp, collectedMetrics);
        
        // Check for regressions
        const regressions = this.detectRegressions(collectedMetrics);
        if (regressions.length > 0) {
            this.handleRegressions(regressions);
        }
        
        // Check SLA compliance
        const slaViolations = this.checkSLACompliance(collectedMetrics);
        if (slaViolations.length > 0) {
            this.handleSLAViolations(slaViolations);
        }
        
        this.emit('metrics:collected', {
            timestamp,
            metrics: collectedMetrics,
            regressions,
            slaViolations
        });
    }
    
    // Collect response time metrics
    async collectResponseTimeMetrics() {
        // In production, this would query actual metrics
        const endpoints = [
            '/api/containers',
            '/api/tracking',
            '/api/analytics',
            '/dashboard'
        ];
        
        const metrics = {};
        
        for (const endpoint of endpoints) {
            metrics[endpoint] = {
                p50: Math.random() * 100 + 50,
                p95: Math.random() * 300 + 100,
                p99: Math.random() * 500 + 200,
                avg: Math.random() * 150 + 75
            };
        }
        
        return metrics;
    }
    
    // Collect throughput metrics
    async collectThroughputMetrics() {
        return {
            requests_per_second: Math.random() * 2000 + 8000,
            successful_requests: Math.random() * 1800 + 7200,
            failed_requests: Math.random() * 100 + 50,
            concurrent_users: Math.floor(Math.random() * 2000) + 8000
        };
    }
    
    // Collect error rate metrics
    async collectErrorRateMetrics() {
        const total = 10000;
        const errors = Math.floor(Math.random() * 100) + 50;
        
        return {
            total_requests: total,
            failed_requests: errors,
            error_rate: errors / total,
            error_types: {
                '5xx': Math.floor(errors * 0.3),
                '4xx': Math.floor(errors * 0.5),
                'timeout': Math.floor(errors * 0.2)
            }
        };
    }
    
    // Collect resource metrics
    async collectResourceMetrics() {
        return {
            cpu: {
                usage: Math.random() * 40 + 40,
                cores: 16,
                load_average: [2.5, 2.8, 3.1]
            },
            memory: {
                used: Math.random() * 32 + 32,
                total: 64,
                percentage: Math.random() * 50 + 40
            },
            disk: {
                read_ops: Math.floor(Math.random() * 1000) + 500,
                write_ops: Math.floor(Math.random() * 800) + 400,
                utilization: Math.random() * 30 + 20
            },
            network: {
                in_mbps: Math.random() * 500 + 500,
                out_mbps: Math.random() * 400 + 400,
                connections: Math.floor(Math.random() * 5000) + 5000
            }
        };
    }
    
    // Collect database metrics
    async collectDatabaseMetrics() {
        return {
            query_performance: {
                avg_query_time: Math.random() * 50 + 20,
                slow_queries: Math.floor(Math.random() * 50),
                deadlocks: Math.floor(Math.random() * 5)
            },
            connections: {
                active: Math.floor(Math.random() * 100) + 50,
                idle: Math.floor(Math.random() * 50) + 20,
                waiting: Math.floor(Math.random() * 20)
            },
            replication: {
                lag_seconds: Math.random() * 2,
                status: 'healthy'
            }
        };
    }
    
    // Collect API metrics
    async collectAPIMetrics() {
        return {
            endpoints: {
                '/api/v1/containers': {
                    calls: Math.floor(Math.random() * 10000) + 50000,
                    avg_response_time: Math.random() * 100 + 50,
                    error_rate: Math.random() * 0.02
                },
                '/api/v1/tracking': {
                    calls: Math.floor(Math.random() * 8000) + 40000,
                    avg_response_time: Math.random() * 80 + 40,
                    error_rate: Math.random() * 0.01
                }
            },
            rate_limiting: {
                throttled_requests: Math.floor(Math.random() * 100),
                rate_limit_violations: Math.floor(Math.random() * 50)
            }
        };
    }
    
    // Collect WebSocket metrics
    async collectWebSocketMetrics() {
        return {
            connections: {
                active: Math.floor(Math.random() * 2000) + 8000,
                new_per_minute: Math.floor(Math.random() * 500) + 500,
                dropped_per_minute: Math.floor(Math.random() * 50) + 50
            },
            messages: {
                sent_per_second: Math.floor(Math.random() * 10000) + 40000,
                received_per_second: Math.floor(Math.random() * 8000) + 35000,
                avg_latency: Math.random() * 20 + 10
            }
        };
    }
    
    // Collect ML metrics
    async collectMLMetrics() {
        return {
            models: {
                eta_prediction: {
                    inferences_per_minute: Math.floor(Math.random() * 500) + 500,
                    avg_inference_time: Math.random() * 200 + 100,
                    cache_hit_rate: Math.random() * 0.3 + 0.5
                },
                anomaly_detection: {
                    inferences_per_minute: Math.floor(Math.random() * 1000) + 2000,
                    avg_inference_time: Math.random() * 50 + 25,
                    cache_hit_rate: Math.random() * 0.4 + 0.4
                }
            },
            gpu: {
                utilization: Math.random() * 40 + 40,
                memory_used: Math.random() * 8 + 8,
                temperature: Math.random() * 20 + 60
            }
        };
    }
    
    // Detect performance regressions
    detectRegressions(currentMetrics) {
        const regressions = [];
        
        // Compare with baselines
        for (const [metricType, metrics] of Object.entries(currentMetrics)) {
            if (!metrics) continue;
            
            const baseline = this.baselines.get(metricType);
            if (!baseline) continue;
            
            const regression = this.compareWithBaseline(metricType, metrics, baseline);
            if (regression) {
                regressions.push(regression);
            }
        }
        
        return regressions;
    }
    
    // Compare with baseline
    compareWithBaseline(metricType, current, baseline) {
        const regression = {
            type: metricType,
            severity: 'none',
            details: []
        };
        
        switch (metricType) {
            case 'response_time':
                for (const [endpoint, metrics] of Object.entries(current)) {
                    if (baseline[endpoint]) {
                        const increase = metrics.p95 / baseline[endpoint].p95;
                        if (increase > this.config.alertThresholds.responseTime.critical) {
                            regression.severity = 'critical';
                            regression.details.push({
                                endpoint,
                                metric: 'p95',
                                baseline: baseline[endpoint].p95,
                                current: metrics.p95,
                                increase: `${((increase - 1) * 100).toFixed(1)}%`
                            });
                        } else if (increase > this.config.alertThresholds.responseTime.warning) {
                            regression.severity = regression.severity === 'critical' ? 'critical' : 'warning';
                            regression.details.push({
                                endpoint,
                                metric: 'p95',
                                baseline: baseline[endpoint].p95,
                                current: metrics.p95,
                                increase: `${((increase - 1) * 100).toFixed(1)}%`
                            });
                        }
                    }
                }
                break;
                
            case 'throughput':
                const throughputRatio = current.requests_per_second / baseline.requests_per_second;
                if (throughputRatio < this.config.alertThresholds.throughput.critical) {
                    regression.severity = 'critical';
                    regression.details.push({
                        metric: 'requests_per_second',
                        baseline: baseline.requests_per_second,
                        current: current.requests_per_second,
                        decrease: `${((1 - throughputRatio) * 100).toFixed(1)}%`
                    });
                }
                break;
                
            case 'error_rate':
                if (current.error_rate > this.config.alertThresholds.errorRate.critical) {
                    regression.severity = 'critical';
                    regression.details.push({
                        metric: 'error_rate',
                        baseline: baseline.error_rate,
                        current: current.error_rate,
                        value: `${(current.error_rate * 100).toFixed(2)}%`
                    });
                }
                break;
        }
        
        return regression.severity !== 'none' ? regression : null;
    }
    
    // Check SLA compliance
    checkSLACompliance(metrics) {
        const violations = [];
        
        // Define SLA targets
        const slaTargets = {
            response_time_p95: 2000,
            error_rate: 0.01,
            availability: 0.999,
            throughput_min: 1000
        };
        
        // Check response times
        if (metrics.response_time) {
            for (const [endpoint, times] of Object.entries(metrics.response_time)) {
                if (times.p95 > slaTargets.response_time_p95) {
                    violations.push({
                        type: 'response_time',
                        endpoint,
                        target: slaTargets.response_time_p95,
                        actual: times.p95,
                        severity: times.p95 > slaTargets.response_time_p95 * 2 ? 'critical' : 'warning'
                    });
                }
            }
        }
        
        // Check error rate
        if (metrics.error_rate && metrics.error_rate.error_rate > slaTargets.error_rate) {
            violations.push({
                type: 'error_rate',
                target: slaTargets.error_rate,
                actual: metrics.error_rate.error_rate,
                severity: metrics.error_rate.error_rate > slaTargets.error_rate * 2 ? 'critical' : 'warning'
            });
        }
        
        // Check throughput
        if (metrics.throughput && metrics.throughput.requests_per_second < slaTargets.throughput_min) {
            violations.push({
                type: 'throughput',
                target: slaTargets.throughput_min,
                actual: metrics.throughput.requests_per_second,
                severity: 'warning'
            });
        }
        
        return violations;
    }
    
    // Generate performance report
    async generatePerformanceReport() {
        const report = {
            id: this.generateReportId(),
            timestamp: new Date(),
            period: {
                start: new Date(Date.now() - 86400000),
                end: new Date()
            },
            summary: await this.generateReportSummary(),
            trends: await this.analyzeTrends(),
            capacity: await this.analyzeCapacity(),
            recommendations: await this.generateRecommendations(),
            sla_compliance: await this.calculateSLACompliance()
        };
        
        this.reports.set(report.id, report);
        this.emit('report:generated', report);
        
        // Save report
        await this.saveReport(report);
        
        return report;
    }
    
    // Generate report summary
    async generateReportSummary() {
        const recentMetrics = this.getRecentMetrics(86400000); // Last 24 hours
        
        return {
            overall_health: this.calculateOverallHealth(recentMetrics),
            key_metrics: {
                avg_response_time: this.calculateAverageMetric(recentMetrics, 'response_time'),
                total_requests: this.calculateTotalMetric(recentMetrics, 'throughput', 'requests_per_second'),
                error_rate: this.calculateAverageMetric(recentMetrics, 'error_rate', 'error_rate'),
                avg_cpu_usage: this.calculateAverageMetric(recentMetrics, 'resource_usage', 'cpu.usage'),
                avg_memory_usage: this.calculateAverageMetric(recentMetrics, 'resource_usage', 'memory.percentage')
            },
            incidents: this.getRecentIncidents(86400000),
            alerts_triggered: this.getRecentAlerts(86400000).length
        };
    }
    
    // Analyze trends
    async analyzeTrends() {
        const weekMetrics = this.getRecentMetrics(604800000); // Last 7 days
        
        return {
            response_time_trend: this.calculateTrend(weekMetrics, 'response_time'),
            throughput_trend: this.calculateTrend(weekMetrics, 'throughput'),
            error_rate_trend: this.calculateTrend(weekMetrics, 'error_rate'),
            resource_trend: this.calculateTrend(weekMetrics, 'resource_usage')
        };
    }
    
    // Analyze capacity
    async analyzeCapacity() {
        const peakMetrics = this.getPeakMetrics(604800000); // Last 7 days
        
        return {
            current_capacity: {
                containers: 1000000,
                concurrent_users: 10000,
                api_calls_per_minute: 100000
            },
            peak_usage: {
                containers: peakMetrics.max_containers || 850000,
                concurrent_users: peakMetrics.max_concurrent_users || 8500,
                api_calls_per_minute: peakMetrics.max_api_calls || 85000
            },
            headroom: {
                containers: '15%',
                concurrent_users: '15%',
                api_calls_per_minute: '15%'
            },
            scaling_recommendations: this.generateScalingRecommendations(peakMetrics)
        };
    }
    
    // Generate recommendations
    async generateRecommendations() {
        const recommendations = [];
        const recentMetrics = this.getRecentMetrics(86400000);
        
        // Performance recommendations
        const avgResponseTime = this.calculateAverageMetric(recentMetrics, 'response_time');
        if (avgResponseTime > 1000) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Optimize Response Times',
                description: 'Average response times exceed 1 second',
                actions: [
                    'Implement query result caching',
                    'Optimize database indexes',
                    'Consider adding read replicas'
                ]
            });
        }
        
        // Resource recommendations
        const avgCPU = this.calculateAverageMetric(recentMetrics, 'resource_usage', 'cpu.usage');
        if (avgCPU > 70) {
            recommendations.push({
                type: 'resources',
                priority: 'medium',
                title: 'CPU Usage Optimization',
                description: `Average CPU usage is ${avgCPU.toFixed(1)}%`,
                actions: [
                    'Profile CPU-intensive operations',
                    'Consider horizontal scaling',
                    'Optimize algorithms and data structures'
                ]
            });
        }
        
        // Reliability recommendations
        const errorRate = this.calculateAverageMetric(recentMetrics, 'error_rate', 'error_rate');
        if (errorRate > 0.01) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                title: 'Reduce Error Rate',
                description: `Current error rate is ${(errorRate * 100).toFixed(2)}%`,
                actions: [
                    'Implement circuit breakers',
                    'Add retry logic with exponential backoff',
                    'Improve error handling and recovery'
                ]
            });
        }
        
        return recommendations;
    }
    
    // Calculate SLA compliance
    async calculateSLACompliance() {
        const monthMetrics = this.getRecentMetrics(2592000000); // Last 30 days
        
        const compliance = {
            uptime: this.calculateUptime(monthMetrics),
            response_time: this.calculateResponseTimeCompliance(monthMetrics),
            error_rate: this.calculateErrorRateCompliance(monthMetrics),
            overall: true
        };
        
        // Check overall compliance
        compliance.overall = 
            compliance.uptime.percentage >= 99.9 &&
            compliance.response_time.percentage >= 95 &&
            compliance.error_rate.percentage >= 99;
        
        return compliance;
    }
    
    // Handle regressions
    handleRegressions(regressions) {
        for (const regression of regressions) {
            const alert = {
                id: this.generateAlertId(),
                type: 'regression',
                severity: regression.severity,
                title: `Performance Regression: ${regression.type}`,
                details: regression.details,
                timestamp: new Date()
            };
            
            this.alerts.set(alert.id, alert);
            this.emit('alert:regression', alert);
            
            // Log critical regressions
            if (regression.severity === 'critical') {
                console.error('CRITICAL REGRESSION DETECTED:', regression);
            }
        }
    }
    
    // Handle SLA violations
    handleSLAViolations(violations) {
        for (const violation of violations) {
            const alert = {
                id: this.generateAlertId(),
                type: 'sla_violation',
                severity: violation.severity,
                title: `SLA Violation: ${violation.type}`,
                details: violation,
                timestamp: new Date()
            };
            
            this.alerts.set(alert.id, alert);
            this.emit('alert:sla_violation', alert);
        }
    }
    
    // Update baselines
    async updateBaselines() {
        const recentMetrics = this.getRecentMetrics(this.config.baselineWindow);
        
        for (const [metricType, collector] of Object.entries(this.collectors)) {
            const baseline = this.calculateBaseline(recentMetrics, metricType);
            if (baseline) {
                this.baselines.set(metricType, baseline);
            }
        }
        
        console.log('Performance baselines updated');
    }
    
    // Calculate baseline
    calculateBaseline(metrics, metricType) {
        const relevantMetrics = metrics
            .filter(m => m.data[metricType])
            .map(m => m.data[metricType]);
        
        if (relevantMetrics.length === 0) return null;
        
        // Calculate percentiles for baseline
        const baseline = {};
        
        if (metricType === 'response_time') {
            // Calculate baseline for each endpoint
            const endpoints = new Set();
            relevantMetrics.forEach(m => {
                Object.keys(m).forEach(e => endpoints.add(e));
            });
            
            endpoints.forEach(endpoint => {
                const values = relevantMetrics
                    .filter(m => m[endpoint])
                    .map(m => m[endpoint]);
                
                if (values.length > 0) {
                    baseline[endpoint] = {
                        p50: this.calculatePercentile(values.map(v => v.p50), 50),
                        p95: this.calculatePercentile(values.map(v => v.p95), 95),
                        p99: this.calculatePercentile(values.map(v => v.p99), 99),
                        avg: this.calculateAverage(values.map(v => v.avg))
                    };
                }
            });
        } else {
            // Generic baseline calculation
            baseline.requests_per_second = this.calculatePercentile(
                relevantMetrics.map(m => m.requests_per_second || 0), 50
            );
            baseline.error_rate = this.calculatePercentile(
                relevantMetrics.map(m => m.error_rate || 0), 50
            );
        }
        
        return baseline;
    }
    
    // Save report
    async saveReport(report) {
        const reportPath = path.join(
            __dirname,
            'performance-reports',
            `${report.id}.json`
        );
        
        try {
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`Performance report saved: ${report.id}`);
        } catch (error) {
            console.error('Failed to save report:', error);
        }
    }
    
    // Load baselines
    async loadBaselines() {
        try {
            const baselinePath = path.join(__dirname, 'performance-baselines.json');
            const data = await fs.readFile(baselinePath, 'utf8');
            const baselines = JSON.parse(data);
            
            for (const [type, baseline] of Object.entries(baselines)) {
                this.baselines.set(type, baseline);
            }
            
            console.log('Performance baselines loaded');
        } catch (error) {
            console.log('No existing baselines found, will create new ones');
        }
    }
    
    // Helper methods
    storeMetrics(timestamp, data) {
        const metrics = {
            timestamp,
            data
        };
        
        if (!this.metrics.has('timeline')) {
            this.metrics.set('timeline', []);
        }
        
        this.metrics.get('timeline').push(metrics);
        
        // Cleanup old metrics
        const cutoff = Date.now() - 604800000; // Keep 7 days
        const timeline = this.metrics.get('timeline');
        this.metrics.set('timeline', timeline.filter(m => m.timestamp > cutoff));
    }
    
    getRecentMetrics(duration) {
        const cutoff = Date.now() - duration;
        const timeline = this.metrics.get('timeline') || [];
        return timeline.filter(m => m.timestamp > cutoff);
    }
    
    getRecentAlerts(duration) {
        const cutoff = Date.now() - duration;
        return Array.from(this.alerts.values())
            .filter(alert => alert.timestamp > cutoff);
    }
    
    getRecentIncidents(duration) {
        return this.getRecentAlerts(duration)
            .filter(alert => alert.severity === 'critical')
            .length;
    }
    
    getPeakMetrics(duration) {
        const metrics = this.getRecentMetrics(duration);
        const peaks = {};
        
        metrics.forEach(m => {
            if (m.data.throughput) {
                peaks.max_concurrent_users = Math.max(
                    peaks.max_concurrent_users || 0,
                    m.data.throughput.concurrent_users || 0
                );
            }
        });
        
        return peaks;
    }
    
    calculateOverallHealth(metrics) {
        let score = 100;
        
        // Deduct points for issues
        const errorRate = this.calculateAverageMetric(metrics, 'error_rate', 'error_rate');
        if (errorRate > 0.05) score -= 30;
        else if (errorRate > 0.02) score -= 20;
        else if (errorRate > 0.01) score -= 10;
        
        const avgResponseTime = this.calculateAverageMetric(metrics, 'response_time');
        if (avgResponseTime > 2000) score -= 20;
        else if (avgResponseTime > 1000) score -= 10;
        
        const alerts = this.getRecentAlerts(86400000);
        score -= Math.min(30, alerts.length * 5);
        
        return {
            score: Math.max(0, score),
            status: score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor'
        };
    }
    
    calculateAverageMetric(metrics, type, path = null) {
        const values = [];
        
        metrics.forEach(m => {
            if (m.data[type]) {
                if (path) {
                    const value = this.getNestedValue(m.data[type], path);
                    if (value !== undefined) values.push(value);
                } else {
                    // For response time, average all endpoints
                    if (type === 'response_time') {
                        Object.values(m.data[type]).forEach(endpoint => {
                            if (endpoint.avg) values.push(endpoint.avg);
                        });
                    }
                }
            }
        });
        
        return values.length > 0 ? 
            values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    calculateTotalMetric(metrics, type, path) {
        let total = 0;
        
        metrics.forEach(m => {
            if (m.data[type] && m.data[type][path]) {
                total += m.data[type][path];
            }
        });
        
        return total;
    }
    
    calculateTrend(metrics, type) {
        if (metrics.length < 2) return 'stable';
        
        const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
        const secondHalf = metrics.slice(Math.floor(metrics.length / 2));
        
        const firstAvg = this.calculateAverageMetric(firstHalf, type);
        const secondAvg = this.calculateAverageMetric(secondHalf, type);
        
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (Math.abs(change) < 5) return 'stable';
        return change > 0 ? 'increasing' : 'decreasing';
    }
    
    calculateUptime(metrics) {
        const total = metrics.length;
        const healthy = metrics.filter(m => {
            const errorRate = m.data.error_rate?.error_rate || 0;
            return errorRate < 0.5; // Less than 50% error rate
        }).length;
        
        return {
            percentage: (healthy / total * 100).toFixed(2),
            downtime_minutes: Math.round((total - healthy) * 5) // 5 minute intervals
        };
    }
    
    calculateResponseTimeCompliance(metrics) {
        let total = 0;
        let compliant = 0;
        
        metrics.forEach(m => {
            if (m.data.response_time) {
                Object.values(m.data.response_time).forEach(endpoint => {
                    total++;
                    if (endpoint.p95 <= 2000) compliant++;
                });
            }
        });
        
        return {
            percentage: total > 0 ? (compliant / total * 100).toFixed(2) : 100,
            violations: total - compliant
        };
    }
    
    calculateErrorRateCompliance(metrics) {
        const compliant = metrics.filter(m => {
            const errorRate = m.data.error_rate?.error_rate || 0;
            return errorRate <= 0.01;
        }).length;
        
        return {
            percentage: (compliant / metrics.length * 100).toFixed(2),
            violations: metrics.length - compliant
        };
    }
    
    generateScalingRecommendations(peakMetrics) {
        const recommendations = [];
        
        if (peakMetrics.max_concurrent_users > 9000) {
            recommendations.push('Consider adding more application servers');
        }
        
        if (peakMetrics.max_api_calls > 90000) {
            recommendations.push('Implement API response caching');
        }
        
        return recommendations;
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
    
    calculateAverage(values) {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        const sorted = values.sort((a, b) => a - b);
        const index = Math.floor(sorted.length * (percentile / 100));
        return sorted[index];
    }
    
    generateReportId() {
        return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Cleanup
    stop() {
        if (this.monitoringInterval) clearInterval(this.monitoringInterval);
        if (this.baselineInterval) clearInterval(this.baselineInterval);
        if (this.reportInterval) clearInterval(this.reportInterval);
        
        console.log('Performance monitoring stopped');
    }
}

module.exports = { ContinuousPerformanceMonitor };