#!/usr/bin/env node

/**
 * ROOTUIP High Availability Monitoring and Testing System
 * Comprehensive monitoring, alerting, and automated recovery testing
 */

const AWS = require('aws-sdk');
const { EventEmitter } = require('events');
const prometheus = require('prom-client');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const pagerduty = require('node-pagerduty');
const slack = require('@slack/web-api');
const cron = require('node-cron');

class HAMonitoringSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            regions: config.regions || ['us-east-1', 'us-west-2', 'eu-west-1'],
            metricsInterval: config.metricsInterval || 10000, // 10 seconds
            healthCheckInterval: config.healthCheckInterval || 5000, // 5 seconds
            alertingThresholds: config.alertingThresholds || this.getDefaultThresholds(),
            testingSchedule: config.testingSchedule || this.getDefaultTestSchedule(),
            ...config
        };
        
        // AWS CloudWatch clients
        this.cloudWatchClients = {};
        this.initializeCloudWatchClients();
        
        // Monitoring backends
        this.prometheus = this.initializePrometheus();
        this.influxDB = this.initializeInfluxDB();
        
        // Alerting integrations
        this.pagerDuty = new pagerduty(config.pagerDutyToken);
        this.slack = new slack.WebClient(config.slackToken);
        
        // Monitoring components
        this.metricsCollector = new MetricsCollector(this);
        this.healthChecker = new HealthChecker(this);
        this.alertManager = new AlertManager(this);
        this.slaTracker = new SLATracker(this);
        this.testRunner = new AutomatedTestRunner(this);
        
        // Dashboards
        this.dashboardManager = new DashboardManager(this);
        
        // State tracking
        this.systemState = {
            regions: new Map(),
            services: new Map(),
            alerts: new Map(),
            sla: {
                current: 100,
                monthly: 100,
                target: 99.99
            }
        };
        
        // Initialize monitoring
        this.initialize();
    }
    
    // Get default alerting thresholds
    getDefaultThresholds() {
        return {
            availability: {
                critical: 99.0,
                warning: 99.9
            },
            responseTime: {
                critical: 3000, // ms
                warning: 1000
            },
            errorRate: {
                critical: 5, // percentage
                warning: 1
            },
            cpuUsage: {
                critical: 90,
                warning: 70
            },
            memoryUsage: {
                critical: 90,
                warning: 80
            },
            diskUsage: {
                critical: 90,
                warning: 80
            },
            replicationLag: {
                critical: 5000, // ms
                warning: 1000
            }
        };
    }
    
    // Get default test schedule
    getDefaultTestSchedule() {
        return {
            healthCheck: '*/1 * * * *', // Every minute
            failoverTest: '0 3 * * SUN', // Weekly Sunday 3AM
            backupTest: '0 2 * * *', // Daily 2AM
            loadTest: '0 4 * * SAT', // Weekly Saturday 4AM
            chaosTest: '0 5 15 * *' // Monthly on 15th 5AM
        };
    }
    
    // Initialize CloudWatch clients
    initializeCloudWatchClients() {
        for (const region of this.config.regions) {
            this.cloudWatchClients[region] = new AWS.CloudWatch({ region });
        }
    }
    
    // Initialize Prometheus
    initializePrometheus() {
        const register = new prometheus.Registry();
        
        // System metrics
        const systemMetrics = {
            availability: new prometheus.Gauge({
                name: 'rootuip_availability_percentage',
                help: 'System availability percentage',
                labelNames: ['region', 'service']
            }),
            responseTime: new prometheus.Histogram({
                name: 'rootuip_response_time_ms',
                help: 'Response time in milliseconds',
                labelNames: ['region', 'endpoint', 'method'],
                buckets: [10, 50, 100, 500, 1000, 2000, 5000]
            }),
            errorRate: new prometheus.Counter({
                name: 'rootuip_errors_total',
                help: 'Total number of errors',
                labelNames: ['region', 'service', 'error_type']
            }),
            requestRate: new prometheus.Counter({
                name: 'rootuip_requests_total',
                help: 'Total number of requests',
                labelNames: ['region', 'service', 'method', 'status']
            })
        };
        
        // Register metrics
        Object.values(systemMetrics).forEach(metric => register.registerMetric(metric));
        
        return { register, metrics: systemMetrics };
    }
    
    // Initialize InfluxDB
    initializeInfluxDB() {
        return new InfluxDB({
            url: this.config.influxDBUrl || 'http://localhost:8086',
            token: this.config.influxDBToken,
            org: this.config.influxDBOrg || 'rootuip',
            bucket: this.config.influxDBBucket || 'monitoring'
        });
    }
    
    // Initialize monitoring system
    async initialize() {
        console.log('Initializing HA Monitoring System');
        
        try {
            // Setup metric collection
            await this.setupMetricCollection();
            
            // Configure health checks
            await this.configureHealthChecks();
            
            // Setup alerting rules
            await this.setupAlertingRules();
            
            // Initialize dashboards
            await this.initializeDashboards();
            
            // Schedule automated tests
            this.scheduleAutomatedTests();
            
            // Start monitoring loops
            this.startMonitoring();
            
            console.log('HA Monitoring System initialized');
            
        } catch (error) {
            console.error('Failed to initialize monitoring:', error);
            throw error;
        }
    }
    
    // Setup metric collection
    async setupMetricCollection() {
        // CloudWatch metrics
        await this.setupCloudWatchMetrics();
        
        // Custom application metrics
        await this.setupApplicationMetrics();
        
        // Infrastructure metrics
        await this.setupInfrastructureMetrics();
        
        // Business metrics
        await this.setupBusinessMetrics();
    }
    
    // Configure health checks
    async configureHealthChecks() {
        const healthChecks = [
            {
                name: 'api-health',
                type: 'http',
                endpoint: '/health',
                interval: 30,
                timeout: 5,
                retries: 3
            },
            {
                name: 'database-health',
                type: 'tcp',
                port: 5432,
                interval: 30,
                timeout: 5
            },
            {
                name: 'cache-health',
                type: 'redis',
                interval: 30,
                timeout: 5
            },
            {
                name: 'synthetic-transaction',
                type: 'synthetic',
                scenario: 'user-login-flow',
                interval: 300,
                timeout: 30
            }
        ];
        
        for (const check of healthChecks) {
            await this.healthChecker.registerCheck(check);
        }
    }
    
    // Setup alerting rules
    async setupAlertingRules() {
        const rules = [
            {
                name: 'high-error-rate',
                condition: 'errorRate > 5',
                duration: 300, // 5 minutes
                severity: 'critical',
                actions: ['page', 'slack', 'email']
            },
            {
                name: 'slow-response-time',
                condition: 'responseTime.p95 > 3000',
                duration: 600, // 10 minutes
                severity: 'warning',
                actions: ['slack', 'email']
            },
            {
                name: 'low-availability',
                condition: 'availability < 99.9',
                duration: 300,
                severity: 'critical',
                actions: ['page', 'slack', 'email', 'auto-failover']
            },
            {
                name: 'high-replication-lag',
                condition: 'replicationLag > 5000',
                duration: 180,
                severity: 'critical',
                actions: ['page', 'slack']
            },
            {
                name: 'capacity-threshold',
                condition: 'cpuUsage > 80 OR memoryUsage > 80',
                duration: 600,
                severity: 'warning',
                actions: ['slack', 'auto-scale']
            }
        ];
        
        for (const rule of rules) {
            await this.alertManager.createRule(rule);
        }
    }
    
    // Start monitoring
    startMonitoring() {
        // Collect metrics
        setInterval(() => {
            this.collectMetrics();
        }, this.config.metricsInterval);
        
        // Perform health checks
        setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthCheckInterval);
        
        // Check SLA compliance
        setInterval(() => {
            this.checkSLACompliance();
        }, 60000); // Every minute
        
        // Update dashboards
        setInterval(() => {
            this.updateDashboards();
        }, 30000); // Every 30 seconds
    }
    
    // Collect metrics
    async collectMetrics() {
        try {
            // Collect from all regions
            const metrics = await Promise.all(
                this.config.regions.map(region => 
                    this.metricsCollector.collectRegionMetrics(region)
                )
            );
            
            // Process and store metrics
            for (const regionMetrics of metrics) {
                await this.processMetrics(regionMetrics);
            }
            
            // Check for anomalies
            await this.detectAnomalies(metrics);
            
        } catch (error) {
            console.error('Error collecting metrics:', error);
        }
    }
    
    // Perform health checks
    async performHealthChecks() {
        try {
            const results = await this.healthChecker.runAllChecks();
            
            // Update system state
            for (const result of results) {
                this.updateHealthState(result);
            }
            
            // Check for failures
            const failures = results.filter(r => !r.healthy);
            if (failures.length > 0) {
                await this.handleHealthCheckFailures(failures);
            }
            
        } catch (error) {
            console.error('Error performing health checks:', error);
        }
    }
    
    // Process metrics
    async processMetrics(metrics) {
        const { region, timestamp, data } = metrics;
        
        // Update Prometheus metrics
        this.prometheus.metrics.availability.set(
            { region, service: 'api' },
            data.availability
        );
        
        this.prometheus.metrics.responseTime.observe(
            { region, endpoint: '/api', method: 'GET' },
            data.responseTime
        );
        
        // Write to InfluxDB
        const writeApi = this.influxDB.getWriteApi(
            this.config.influxDBOrg,
            this.config.influxDBBucket
        );
        
        const point = new Point('system_metrics')
            .tag('region', region)
            .floatField('availability', data.availability)
            .floatField('responseTime', data.responseTime)
            .floatField('errorRate', data.errorRate)
            .floatField('cpuUsage', data.cpuUsage)
            .floatField('memoryUsage', data.memoryUsage)
            .timestamp(timestamp);
        
        writeApi.writePoint(point);
        await writeApi.close();
        
        // Send to CloudWatch
        await this.sendToCloudWatch(region, data);
    }
    
    // Send metrics to CloudWatch
    async sendToCloudWatch(region, data) {
        const cloudWatch = this.cloudWatchClients[region];
        
        const params = {
            Namespace: 'ROOTUIP/HA',
            MetricData: [
                {
                    MetricName: 'Availability',
                    Value: data.availability,
                    Unit: 'Percent',
                    Timestamp: new Date()
                },
                {
                    MetricName: 'ResponseTime',
                    Value: data.responseTime,
                    Unit: 'Milliseconds',
                    Timestamp: new Date()
                },
                {
                    MetricName: 'ErrorRate',
                    Value: data.errorRate,
                    Unit: 'Percent',
                    Timestamp: new Date()
                }
            ]
        };
        
        await cloudWatch.putMetricData(params).promise();
    }
    
    // Schedule automated tests
    scheduleAutomatedTests() {
        // Health check test
        cron.schedule(this.config.testingSchedule.healthCheck, async () => {
            await this.testRunner.runHealthCheckTest();
        });
        
        // Failover test
        cron.schedule(this.config.testingSchedule.failoverTest, async () => {
            await this.testRunner.runFailoverTest();
        });
        
        // Backup test
        cron.schedule(this.config.testingSchedule.backupTest, async () => {
            await this.testRunner.runBackupTest();
        });
        
        // Load test
        cron.schedule(this.config.testingSchedule.loadTest, async () => {
            await this.testRunner.runLoadTest();
        });
        
        // Chaos test
        cron.schedule(this.config.testingSchedule.chaosTest, async () => {
            await this.testRunner.runChaosTest();
        });
    }
    
    // Check SLA compliance
    async checkSLACompliance() {
        const compliance = await this.slaTracker.calculateCompliance();
        
        this.systemState.sla = {
            current: compliance.current,
            monthly: compliance.monthly,
            target: this.config.slaTarget || 99.99
        };
        
        // Alert if below target
        if (compliance.current < this.systemState.sla.target) {
            await this.alertManager.triggerAlert({
                name: 'sla-breach',
                severity: 'critical',
                message: `SLA breach: ${compliance.current}% < ${this.systemState.sla.target}%`,
                data: compliance
            });
        }
    }
    
    // Detect anomalies
    async detectAnomalies(metrics) {
        // Simple anomaly detection based on statistical analysis
        for (const regionMetrics of metrics) {
            const anomalies = await this.analyzeMetrics(regionMetrics);
            
            if (anomalies.length > 0) {
                await this.handleAnomalies(regionMetrics.region, anomalies);
            }
        }
    }
    
    // Get system status
    getSystemStatus() {
        const status = {
            overall: 'healthy',
            regions: {},
            services: {},
            sla: this.systemState.sla,
            activeAlerts: Array.from(this.systemState.alerts.values()),
            metrics: {
                availability: this.calculateOverallAvailability(),
                responseTime: this.calculateAverageResponseTime(),
                errorRate: this.calculateErrorRate()
            }
        };
        
        // Determine overall status
        if (status.activeAlerts.some(a => a.severity === 'critical')) {
            status.overall = 'critical';
        } else if (status.activeAlerts.some(a => a.severity === 'warning')) {
            status.overall = 'warning';
        }
        
        return status;
    }
    
    // Create status dashboard
    async createStatusDashboard() {
        return await this.dashboardManager.createDashboard({
            name: 'HA System Status',
            refresh: '10s',
            panels: [
                {
                    title: 'System Availability',
                    type: 'stat',
                    targets: ['availability'],
                    thresholds: [99.99, 99.9, 99.0]
                },
                {
                    title: 'Response Time',
                    type: 'graph',
                    targets: ['responseTime.p50', 'responseTime.p95', 'responseTime.p99']
                },
                {
                    title: 'Error Rate',
                    type: 'graph',
                    targets: ['errorRate'],
                    thresholds: [1, 5]
                },
                {
                    title: 'Regional Health',
                    type: 'heatmap',
                    targets: ['regional.health']
                },
                {
                    title: 'Active Alerts',
                    type: 'table',
                    targets: ['alerts.active']
                },
                {
                    title: 'SLA Compliance',
                    type: 'gauge',
                    targets: ['sla.current'],
                    min: 99,
                    max: 100
                }
            ]
        });
    }
}

// Metrics Collector
class MetricsCollector {
    constructor(parent) {
        this.parent = parent;
    }
    
    async collectRegionMetrics(region) {
        const metrics = {
            region,
            timestamp: Date.now(),
            data: {}
        };
        
        // Collect various metrics
        const [
            availability,
            performance,
            resources,
            application,
            business
        ] = await Promise.all([
            this.collectAvailabilityMetrics(region),
            this.collectPerformanceMetrics(region),
            this.collectResourceMetrics(region),
            this.collectApplicationMetrics(region),
            this.collectBusinessMetrics(region)
        ]);
        
        metrics.data = {
            ...availability,
            ...performance,
            ...resources,
            ...application,
            ...business
        };
        
        return metrics;
    }
    
    async collectAvailabilityMetrics(region) {
        // Calculate availability based on health checks
        const healthChecks = await this.getHealthCheckResults(region);
        const totalChecks = healthChecks.length;
        const healthyChecks = healthChecks.filter(c => c.healthy).length;
        
        return {
            availability: totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0,
            healthyServices: healthyChecks,
            totalServices: totalChecks
        };
    }
    
    async collectPerformanceMetrics(region) {
        const cloudWatch = this.parent.cloudWatchClients[region];
        
        // Get ALB metrics
        const responseTime = await this.getMetricStatistics(cloudWatch, {
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'TargetResponseTime',
            Statistics: ['Average', 'Maximum'],
            Period: 60
        });
        
        const requestCount = await this.getMetricStatistics(cloudWatch, {
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'RequestCount',
            Statistics: ['Sum'],
            Period: 60
        });
        
        const errorCount = await this.getMetricStatistics(cloudWatch, {
            Namespace: 'AWS/ApplicationELB',
            MetricName: 'HTTPCode_Target_5XX_Count',
            Statistics: ['Sum'],
            Period: 60
        });
        
        return {
            responseTime: responseTime.Average || 0,
            maxResponseTime: responseTime.Maximum || 0,
            requestRate: requestCount.Sum || 0,
            errorRate: requestCount.Sum > 0 ? 
                ((errorCount.Sum || 0) / requestCount.Sum) * 100 : 0
        };
    }
    
    async getMetricStatistics(cloudWatch, params) {
        const result = await cloudWatch.getMetricStatistics({
            ...params,
            StartTime: new Date(Date.now() - 300000), // Last 5 minutes
            EndTime: new Date()
        }).promise();
        
        if (result.Datapoints.length > 0) {
            return result.Datapoints[0];
        }
        
        return {};
    }
}

// Health Checker
class HealthChecker {
    constructor(parent) {
        this.parent = parent;
        this.checks = new Map();
    }
    
    async registerCheck(check) {
        this.checks.set(check.name, check);
    }
    
    async runAllChecks() {
        const results = [];
        
        for (const [name, check] of this.checks) {
            try {
                const result = await this.runCheck(check);
                results.push({
                    name,
                    ...result,
                    timestamp: Date.now()
                });
            } catch (error) {
                results.push({
                    name,
                    healthy: false,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
        
        return results;
    }
    
    async runCheck(check) {
        switch (check.type) {
            case 'http':
                return await this.httpHealthCheck(check);
            case 'tcp':
                return await this.tcpHealthCheck(check);
            case 'redis':
                return await this.redisHealthCheck(check);
            case 'synthetic':
                return await this.syntheticCheck(check);
            default:
                throw new Error(`Unknown check type: ${check.type}`);
        }
    }
    
    async httpHealthCheck(check) {
        const axios = require('axios');
        
        try {
            const response = await axios.get(check.endpoint, {
                timeout: check.timeout * 1000
            });
            
            return {
                healthy: response.status === 200,
                responseTime: response.headers['x-response-time'] || 0,
                status: response.status
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
}

// Alert Manager
class AlertManager {
    constructor(parent) {
        this.parent = parent;
        this.rules = new Map();
        this.activeAlerts = new Map();
    }
    
    async createRule(rule) {
        this.rules.set(rule.name, rule);
    }
    
    async evaluateRules(metrics) {
        for (const [name, rule] of this.rules) {
            const triggered = await this.evaluateRule(rule, metrics);
            
            if (triggered) {
                await this.handleTriggeredRule(rule, metrics);
            } else {
                await this.clearAlert(name);
            }
        }
    }
    
    async triggerAlert(alert) {
        // Check if already active
        if (this.activeAlerts.has(alert.name)) {
            return;
        }
        
        this.activeAlerts.set(alert.name, {
            ...alert,
            triggeredAt: Date.now()
        });
        
        // Execute actions
        for (const action of alert.actions || ['slack']) {
            await this.executeAction(action, alert);
        }
        
        // Emit alert event
        this.parent.emit('alert:triggered', alert);
    }
    
    async executeAction(action, alert) {
        switch (action) {
            case 'page':
                await this.sendPagerDutyAlert(alert);
                break;
            case 'slack':
                await this.sendSlackAlert(alert);
                break;
            case 'email':
                await this.sendEmailAlert(alert);
                break;
            case 'auto-failover':
                await this.triggerAutoFailover(alert);
                break;
            case 'auto-scale':
                await this.triggerAutoScale(alert);
                break;
        }
    }
    
    async sendSlackAlert(alert) {
        const color = alert.severity === 'critical' ? '#FF0000' : '#FFA500';
        
        await this.parent.slack.chat.postMessage({
            channel: this.parent.config.slackChannel || '#alerts',
            attachments: [{
                color,
                title: `${alert.severity.toUpperCase()}: ${alert.name}`,
                text: alert.message,
                fields: [
                    {
                        title: 'Region',
                        value: alert.region || 'Global',
                        short: true
                    },
                    {
                        title: 'Time',
                        value: new Date().toISOString(),
                        short: true
                    }
                ],
                footer: 'ROOTUIP Monitoring'
            }]
        });
    }
}

// SLA Tracker
class SLATracker {
    constructor(parent) {
        this.parent = parent;
        this.downtimeRecords = [];
    }
    
    async calculateCompliance() {
        const now = Date.now();
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        // Calculate total downtime this month
        const monthlyDowntime = this.downtimeRecords
            .filter(record => record.start >= monthStart.getTime())
            .reduce((total, record) => {
                const end = record.end || now;
                return total + (end - record.start);
            }, 0);
        
        // Calculate availability
        const totalTime = now - monthStart.getTime();
        const availability = ((totalTime - monthlyDowntime) / totalTime) * 100;
        
        return {
            current: availability,
            monthly: availability,
            downtime: monthlyDowntime,
            totalTime
        };
    }
}

// Automated Test Runner
class AutomatedTestRunner {
    constructor(parent) {
        this.parent = parent;
    }
    
    async runHealthCheckTest() {
        console.log('Running automated health check test');
        
        const results = {
            testType: 'health-check',
            timestamp: Date.now(),
            passed: true,
            regions: {}
        };
        
        for (const region of this.parent.config.regions) {
            const health = await this.testRegionHealth(region);
            results.regions[region] = health;
            
            if (!health.passed) {
                results.passed = false;
            }
        }
        
        // Record results
        await this.recordTestResults(results);
        
        return results;
    }
    
    async runFailoverTest() {
        console.log('Running automated failover test');
        
        // Create isolated test environment
        const testEnv = await this.createTestEnvironment();
        
        try {
            // Simulate primary region failure
            await this.simulateRegionFailure(testEnv.primaryRegion);
            
            // Wait for automatic failover
            const failoverResult = await this.waitForFailover(testEnv);
            
            // Verify system functionality
            const verification = await this.verifySystemAfterFailover(testEnv);
            
            // Clean up
            await this.cleanupTestEnvironment(testEnv);
            
            return {
                testType: 'failover',
                timestamp: Date.now(),
                passed: failoverResult.success && verification.passed,
                failoverTime: failoverResult.duration,
                details: { failoverResult, verification }
            };
            
        } catch (error) {
            await this.cleanupTestEnvironment(testEnv);
            throw error;
        }
    }
    
    async runChaosTest() {
        console.log('Running chaos engineering test');
        
        const scenarios = [
            'network-partition',
            'instance-termination',
            'disk-failure',
            'memory-pressure',
            'clock-skew'
        ];
        
        const results = {
            testType: 'chaos',
            timestamp: Date.now(),
            scenarios: []
        };
        
        for (const scenario of scenarios) {
            const result = await this.runChaosScenario(scenario);
            results.scenarios.push(result);
        }
        
        results.passed = results.scenarios.every(s => s.passed);
        
        return results;
    }
}

// Dashboard Manager
class DashboardManager {
    constructor(parent) {
        this.parent = parent;
        this.dashboards = new Map();
    }
    
    async createDashboard(config) {
        const dashboard = {
            id: `dashboard-${Date.now()}`,
            ...config,
            created: new Date().toISOString(),
            panels: await this.createPanels(config.panels)
        };
        
        this.dashboards.set(dashboard.id, dashboard);
        
        return dashboard;
    }
    
    async createPanels(panelConfigs) {
        const panels = [];
        
        for (const config of panelConfigs) {
            const panel = await this.createPanel(config);
            panels.push(panel);
        }
        
        return panels;
    }
    
    async updateDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) return;
        
        // Update all panels with latest data
        for (const panel of dashboard.panels) {
            panel.data = await this.fetchPanelData(panel);
        }
        
        // Emit update event
        this.parent.emit('dashboard:updated', dashboard);
    }
}

module.exports = HAMonitoringSystem;