/**
 * ROOTUIP Alert Rules Engine
 * Defines monitoring rules and thresholds
 */

class AlertRulesEngine {
    constructor() {
        this.rules = {
            // Performance Rules
            performance: [
                {
                    id: 'high_response_time',
                    name: 'High API Response Time',
                    condition: (metrics) => metrics.avgResponseTime > 100,
                    severity: (metrics) => metrics.avgResponseTime > 200 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'High API Response Time Detected',
                        description: `Average response time is ${metrics.avgResponseTime}ms`,
                        recommendation: 'Check database queries and API endpoint performance'
                    })
                },
                {
                    id: 'p95_response_time',
                    name: 'P95 Response Time Threshold',
                    condition: (metrics) => metrics.p95ResponseTime > 200,
                    severity: (metrics) => metrics.p95ResponseTime > 500 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'P95 Response Time Exceeded',
                        description: `95th percentile response time is ${metrics.p95ResponseTime}ms`,
                        recommendation: 'Investigate slow queries and optimize bottlenecks'
                    })
                },
                {
                    id: 'high_cpu_usage',
                    name: 'High CPU Usage',
                    condition: (metrics) => metrics.cpu > 70,
                    severity: (metrics) => metrics.cpu > 90 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'High CPU Usage Alert',
                        description: `CPU usage is at ${metrics.cpu}%`,
                        recommendation: metrics.cpu > 90 ? 
                            'Critical: Scale up immediately or reduce load' : 
                            'Monitor closely and prepare to scale'
                    })
                },
                {
                    id: 'memory_pressure',
                    name: 'Memory Pressure',
                    condition: (metrics) => (metrics.memoryUsed / metrics.memoryTotal) > 0.8,
                    severity: (metrics) => (metrics.memoryUsed / metrics.memoryTotal) > 0.95 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'High Memory Usage Detected',
                        description: `Memory usage is at ${((metrics.memoryUsed / metrics.memoryTotal) * 100).toFixed(1)}%`,
                        recommendation: 'Check for memory leaks or increase memory allocation'
                    })
                }
            ],

            // Availability Rules
            availability: [
                {
                    id: 'service_down',
                    name: 'Service Down',
                    condition: (metrics) => metrics.serviceStatus === 'down',
                    severity: () => 'critical',
                    message: (metrics) => ({
                        title: `Service ${metrics.serviceName} is DOWN`,
                        description: `Service has been unreachable for ${metrics.downtime} seconds`,
                        recommendation: 'Immediate action required - check service logs and restart if necessary'
                    })
                },
                {
                    id: 'high_error_rate',
                    name: 'High Error Rate',
                    condition: (metrics) => metrics.errorRate > 1,
                    severity: (metrics) => metrics.errorRate > 5 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'Elevated Error Rate',
                        description: `Error rate is ${metrics.errorRate}% (${metrics.errorCount} errors in last 5 minutes)`,
                        recommendation: 'Review application logs and recent deployments'
                    })
                },
                {
                    id: 'uptime_sla_breach',
                    name: 'Uptime SLA Breach Risk',
                    condition: (metrics) => metrics.monthlyUptime < 99.95,
                    severity: (metrics) => metrics.monthlyUptime < 99.9 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'Uptime SLA at Risk',
                        description: `Monthly uptime is ${metrics.monthlyUptime}%, below 99.99% target`,
                        recommendation: 'Review incident history and improve reliability measures'
                    })
                }
            ],

            // Business Logic Rules
            business: [
                {
                    id: 'low_prevention_rate',
                    name: 'D&D Prevention Rate Drop',
                    condition: (metrics) => metrics.preventionRate < 92,
                    severity: (metrics) => metrics.preventionRate < 90 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'D&D Prevention Rate Below Target',
                        description: `Prevention rate is ${metrics.preventionRate}%, below 94% target`,
                        recommendation: 'Review ML model performance and retrain if necessary'
                    })
                },
                {
                    id: 'prediction_backlog',
                    name: 'Prediction Queue Backlog',
                    condition: (metrics) => metrics.predictionQueueSize > 100,
                    severity: (metrics) => metrics.predictionQueueSize > 500 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'Prediction Queue Building Up',
                        description: `${metrics.predictionQueueSize} predictions pending in queue`,
                        recommendation: 'Scale ML processing capacity or optimize prediction pipeline'
                    })
                },
                {
                    id: 'low_model_confidence',
                    name: 'Low Model Confidence',
                    condition: (metrics) => metrics.avgConfidence < 0.7,
                    severity: () => 'warning',
                    message: (metrics) => ({
                        title: 'ML Model Confidence Dropping',
                        description: `Average prediction confidence is ${(metrics.avgConfidence * 100).toFixed(1)}%`,
                        recommendation: 'Model may need retraining with recent data'
                    })
                }
            ],

            // Infrastructure Rules
            infrastructure: [
                {
                    id: 'disk_space_low',
                    name: 'Low Disk Space',
                    condition: (metrics) => metrics.diskUsagePercent > 80,
                    severity: (metrics) => metrics.diskUsagePercent > 90 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'Disk Space Running Low',
                        description: `Disk usage is at ${metrics.diskUsagePercent}%`,
                        recommendation: 'Clean up logs, archives, or expand storage'
                    })
                },
                {
                    id: 'database_connections',
                    name: 'Database Connection Pool',
                    condition: (metrics) => (metrics.dbActiveConnections / metrics.dbMaxConnections) > 0.8,
                    severity: (metrics) => (metrics.dbActiveConnections / metrics.dbMaxConnections) > 0.95 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'Database Connection Pool Near Limit',
                        description: `Using ${metrics.dbActiveConnections} of ${metrics.dbMaxConnections} connections`,
                        recommendation: 'Review connection pooling settings or scale database'
                    })
                },
                {
                    id: 'cache_hit_rate_low',
                    name: 'Low Cache Hit Rate',
                    condition: (metrics) => metrics.cacheHitRate < 85,
                    severity: (metrics) => metrics.cacheHitRate < 70 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'Cache Performance Degraded',
                        description: `Cache hit rate is ${metrics.cacheHitRate}%`,
                        recommendation: 'Review cache configuration and warming strategies'
                    })
                },
                {
                    id: 'ssl_expiry',
                    name: 'SSL Certificate Expiry',
                    condition: (metrics) => metrics.sslDaysRemaining < 30,
                    severity: (metrics) => metrics.sslDaysRemaining < 7 ? 'critical' : 'warning',
                    message: (metrics) => ({
                        title: 'SSL Certificate Expiring Soon',
                        description: `SSL certificate expires in ${metrics.sslDaysRemaining} days`,
                        recommendation: 'Renew SSL certificate to avoid service disruption'
                    })
                }
            ],

            // Security Rules
            security: [
                {
                    id: 'brute_force_attempt',
                    name: 'Potential Brute Force Attack',
                    condition: (metrics) => metrics.failedLoginAttempts > 50,
                    severity: () => 'critical',
                    message: (metrics) => ({
                        title: 'Potential Security Threat Detected',
                        description: `${metrics.failedLoginAttempts} failed login attempts from ${metrics.sourceIP}`,
                        recommendation: 'Block IP address and review security logs'
                    })
                },
                {
                    id: 'unusual_api_activity',
                    name: 'Unusual API Activity',
                    condition: (metrics) => metrics.apiCallsPerMinute > metrics.normalRate * 5,
                    severity: () => 'warning',
                    message: (metrics) => ({
                        title: 'Unusual API Activity Detected',
                        description: `API calls increased to ${metrics.apiCallsPerMinute}/min (5x normal)`,
                        recommendation: 'Monitor for potential abuse or DDoS attack'
                    })
                },
                {
                    id: 'auth_service_failure',
                    name: 'Authentication Service Issues',
                    condition: (metrics) => metrics.authFailureRate > 10,
                    severity: () => 'critical',
                    message: (metrics) => ({
                        title: 'Authentication Service Failing',
                        description: `${metrics.authFailureRate}% of auth requests failing`,
                        recommendation: 'Check auth service health and database connectivity'
                    })
                }
            ]
        };

        // Custom rule evaluation functions
        this.customEvaluators = new Map();
        
        // Anomaly detection rules
        this.anomalyRules = {
            responseTimeAnomaly: {
                baseline: 50,
                stdDev: 20,
                threshold: 3 // 3 standard deviations
            },
            trafficAnomaly: {
                baseline: 1000,
                stdDev: 200,
                threshold: 4
            }
        };
    }

    evaluateRules(metrics, category = null) {
        const alerts = [];
        const categories = category ? [category] : Object.keys(this.rules);

        for (const cat of categories) {
            const categoryRules = this.rules[cat] || [];
            
            for (const rule of categoryRules) {
                try {
                    if (rule.condition(metrics)) {
                        const severity = rule.severity(metrics);
                        const message = rule.message(metrics);
                        
                        alerts.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            category: cat,
                            severity,
                            ...message,
                            timestamp: new Date().toISOString(),
                            metrics: this.extractRelevantMetrics(metrics, rule)
                        });
                    }
                } catch (error) {
                    console.error(`Error evaluating rule ${rule.id}:`, error);
                }
            }
        }

        // Check for anomalies
        const anomalies = this.detectAnomalies(metrics);
        alerts.push(...anomalies);

        return alerts;
    }

    detectAnomalies(metrics) {
        const anomalies = [];

        // Response time anomaly
        if (metrics.avgResponseTime) {
            const zScore = Math.abs(metrics.avgResponseTime - this.anomalyRules.responseTimeAnomaly.baseline) 
                         / this.anomalyRules.responseTimeAnomaly.stdDev;
            
            if (zScore > this.anomalyRules.responseTimeAnomaly.threshold) {
                anomalies.push({
                    ruleId: 'response_time_anomaly',
                    ruleName: 'Response Time Anomaly',
                    category: 'anomaly',
                    severity: zScore > 5 ? 'critical' : 'warning',
                    title: 'Anomalous Response Time Detected',
                    description: `Response time ${metrics.avgResponseTime}ms is ${zScore.toFixed(1)} standard deviations from normal`,
                    recommendation: 'Investigate system load and recent changes',
                    timestamp: new Date().toISOString()
                });
            }
        }

        return anomalies;
    }

    extractRelevantMetrics(metrics, rule) {
        // Extract only the metrics used by this rule
        const relevant = {};
        const ruleString = rule.condition.toString() + rule.message.toString();
        
        Object.keys(metrics).forEach(key => {
            if (ruleString.includes(key)) {
                relevant[key] = metrics[key];
            }
        });
        
        return relevant;
    }

    addCustomRule(id, rule) {
        if (!rule.category || !rule.condition || !rule.severity || !rule.message) {
            throw new Error('Custom rule must have category, condition, severity, and message');
        }

        const category = rule.category;
        if (!this.rules[category]) {
            this.rules[category] = [];
        }

        this.rules[category].push({
            id,
            name: rule.name || id,
            condition: rule.condition,
            severity: rule.severity,
            message: rule.message
        });
    }

    removeRule(id, category = null) {
        const categories = category ? [category] : Object.keys(this.rules);
        
        for (const cat of categories) {
            const rules = this.rules[cat] || [];
            const index = rules.findIndex(r => r.id === id);
            
            if (index !== -1) {
                rules.splice(index, 1);
                return true;
            }
        }
        
        return false;
    }

    getRuleById(id) {
        for (const category of Object.keys(this.rules)) {
            const rule = this.rules[category].find(r => r.id === id);
            if (rule) {
                return { ...rule, category };
            }
        }
        return null;
    }

    listRules(category = null) {
        if (category) {
            return this.rules[category] || [];
        }

        const allRules = [];
        for (const cat of Object.keys(this.rules)) {
            allRules.push(...this.rules[cat].map(r => ({ ...r, category: cat })));
        }
        return allRules;
    }

    updateAnomalyBaseline(metric, baseline, stdDev) {
        if (this.anomalyRules[metric]) {
            this.anomalyRules[metric].baseline = baseline;
            this.anomalyRules[metric].stdDev = stdDev;
        }
    }
}

module.exports = AlertRulesEngine;