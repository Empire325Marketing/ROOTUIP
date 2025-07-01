/**
 * ROOTUIP Performance Testing Suite
 * Comprehensive load testing and performance validation
 */

const EventEmitter = require('events');
const os = require('os');
const cluster = require('cluster');
const crypto = require('crypto');

class PerformanceTestingSuite extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            targetUrl: config.targetUrl || 'http://localhost:3000',
            apiBaseUrl: config.apiBaseUrl || 'http://localhost:3000/api',
            wsUrl: config.wsUrl || 'ws://localhost:3000',
            testDuration: config.testDuration || 300000, // 5 minutes default
            rampUpTime: config.rampUpTime || 60000, // 1 minute
            coolDownTime: config.coolDownTime || 30000, // 30 seconds
            ...config
        };
        
        this.testScenarios = new Map();
        this.testResults = new Map();
        this.activeTests = new Map();
        this.metrics = {
            requests: new Map(),
            responses: new Map(),
            errors: new Map(),
            latencies: [],
            throughput: []
        };
        
        this.initializeTestSuite();
    }
    
    // Initialize test suite
    initializeTestSuite() {
        this.setupTestScenarios();
        this.setupMetricsCollection();
        this.setupClusterWorkers();
        
        console.log('Performance Testing Suite initialized');
    }
    
    // Setup test scenarios
    setupTestScenarios() {
        // Load Testing Scenarios
        this.testScenarios.set('load_test_standard', {
            name: 'Standard Load Test',
            description: 'Simulate normal daily traffic patterns',
            config: {
                virtualUsers: 5000,
                rampUp: 'linear',
                duration: 300000,
                scenarios: [
                    { weight: 40, action: 'viewDashboard' },
                    { weight: 30, action: 'trackContainer' },
                    { weight: 20, action: 'apiCall' },
                    { weight: 10, action: 'generateReport' }
                ]
            }
        });
        
        this.testScenarios.set('load_test_peak', {
            name: 'Peak Load Test',
            description: 'Simulate peak traffic conditions',
            config: {
                virtualUsers: 10000,
                rampUp: 'exponential',
                duration: 600000,
                scenarios: [
                    { weight: 50, action: 'trackContainer' },
                    { weight: 30, action: 'apiCall' },
                    { weight: 15, action: 'websocketConnect' },
                    { weight: 5, action: 'bulkOperation' }
                ]
            }
        });
        
        // Stress Testing Scenarios
        this.testScenarios.set('stress_test_limits', {
            name: 'System Limits Stress Test',
            description: 'Find system breaking points',
            config: {
                virtualUsers: 20000,
                rampUp: 'aggressive',
                duration: 900000,
                incrementUsers: 1000,
                incrementInterval: 60000,
                scenarios: [
                    { weight: 60, action: 'heavyApiCall' },
                    { weight: 25, action: 'databaseQuery' },
                    { weight: 15, action: 'mlInference' }
                ]
            }
        });
        
        // Spike Testing Scenarios
        this.testScenarios.set('spike_test_sudden', {
            name: 'Sudden Spike Test',
            description: 'Simulate sudden traffic surge',
            config: {
                baseUsers: 1000,
                spikeUsers: 15000,
                spikeDuration: 120000,
                scenarios: [
                    { weight: 70, action: 'trackContainer' },
                    { weight: 30, action: 'apiCall' }
                ]
            }
        });
        
        // Endurance Testing Scenarios
        this.testScenarios.set('endurance_test_24h', {
            name: '24-Hour Endurance Test',
            description: 'Test system stability over extended period',
            config: {
                virtualUsers: 3000,
                duration: 86400000, // 24 hours
                checkInterval: 3600000, // 1 hour
                scenarios: [
                    { weight: 35, action: 'normalOperation' },
                    { weight: 25, action: 'apiCall' },
                    { weight: 20, action: 'databaseQuery' },
                    { weight: 15, action: 'websocketActivity' },
                    { weight: 5, action: 'heavyOperation' }
                ]
            }
        });
        
        // Scalability Testing Scenarios
        this.testScenarios.set('scalability_test_growth', {
            name: 'Growth Scalability Test',
            description: 'Test system scalability for growth',
            config: {
                startContainers: 100000,
                endContainers: 1000000,
                incrementContainers: 100000,
                usersPerMillion: 10000,
                scenarios: [
                    { weight: 40, action: 'containerOperations' },
                    { weight: 30, action: 'bulkTracking' },
                    { weight: 20, action: 'analyticsQuery' },
                    { weight: 10, action: 'reportGeneration' }
                ]
            }
        });
    }
    
    // Run performance test
    async runPerformanceTest(testType, scenarioId, options = {}) {
        const scenario = this.testScenarios.get(scenarioId);
        if (!scenario) {
            throw new Error(`Test scenario ${scenarioId} not found`);
        }
        
        const testRun = {
            id: this.generateTestRunId(),
            type: testType,
            scenario: scenario,
            startTime: new Date(),
            status: 'initializing',
            options: options,
            results: {
                summary: {},
                detailed: [],
                errors: [],
                recommendations: []
            }
        };
        
        this.activeTests.set(testRun.id, testRun);
        console.log(`Starting ${testType} test: ${scenario.name}`);
        
        try {
            // Initialize test
            await this.initializeTest(testRun);
            
            // Execute test based on type
            switch (testType) {
                case 'load':
                    await this.executeLoadTest(testRun);
                    break;
                case 'stress':
                    await this.executeStressTest(testRun);
                    break;
                case 'spike':
                    await this.executeSpikeTest(testRun);
                    break;
                case 'endurance':
                    await this.executeEnduranceTest(testRun);
                    break;
                case 'scalability':
                    await this.executeScalabilityTest(testRun);
                    break;
                default:
                    throw new Error(`Unknown test type: ${testType}`);
            }
            
            // Finalize results
            await this.finalizeTestResults(testRun);
            
        } catch (error) {
            testRun.status = 'failed';
            testRun.error = error.message;
            console.error(`Test failed: ${error.message}`);
        }
        
        testRun.endTime = new Date();
        testRun.duration = testRun.endTime - testRun.startTime;
        
        this.testResults.set(testRun.id, testRun);
        this.activeTests.delete(testRun.id);
        
        this.emit('test:completed', testRun);
        
        return testRun;
    }
    
    // Execute load test
    async executeLoadTest(testRun) {
        const config = testRun.scenario.config;
        testRun.status = 'running';
        
        console.log(`Executing load test with ${config.virtualUsers} virtual users`);
        
        // Ramp up users
        await this.rampUpUsers(testRun, config.virtualUsers, config.rampUp);
        
        // Run main test
        const startTime = Date.now();
        const endTime = startTime + config.duration;
        
        while (Date.now() < endTime && testRun.status === 'running') {
            await this.executeTestIteration(testRun, config.scenarios);
            await this.collectMetrics(testRun);
            
            // Check for errors or thresholds
            if (this.shouldStopTest(testRun)) {
                break;
            }
            
            await this.sleep(1000); // 1 second between iterations
        }
        
        // Cool down
        await this.coolDownUsers(testRun);
    }
    
    // Execute stress test
    async executeStressTest(testRun) {
        const config = testRun.scenario.config;
        testRun.status = 'running';
        
        console.log('Executing stress test to find system limits');
        
        let currentUsers = 0;
        let systemLimit = false;
        
        while (!systemLimit && currentUsers < config.virtualUsers) {
            currentUsers += config.incrementUsers;
            console.log(`Increasing load to ${currentUsers} users`);
            
            await this.rampUpUsers(testRun, currentUsers, 'aggressive');
            
            // Run test at current load
            const testStart = Date.now();
            const testEnd = testStart + config.incrementInterval;
            
            while (Date.now() < testEnd) {
                await this.executeTestIteration(testRun, config.scenarios);
                const metrics = await this.collectMetrics(testRun);
                
                // Check if system is reaching limits
                if (this.isSystemAtLimit(metrics)) {
                    systemLimit = true;
                    testRun.results.summary.breakingPoint = currentUsers;
                    console.log(`System limit reached at ${currentUsers} users`);
                    break;
                }
                
                await this.sleep(1000);
            }
        }
        
        await this.coolDownUsers(testRun);
    }
    
    // Execute spike test
    async executeSpikeTest(testRun) {
        const config = testRun.scenario.config;
        testRun.status = 'running';
        
        console.log('Executing spike test');
        
        // Establish baseline
        await this.rampUpUsers(testRun, config.baseUsers, 'linear');
        await this.sleep(30000); // 30 seconds baseline
        
        const baselineMetrics = await this.collectMetrics(testRun);
        testRun.results.summary.baseline = baselineMetrics;
        
        // Create spike
        console.log(`Creating spike to ${config.spikeUsers} users`);
        await this.rampUpUsers(testRun, config.spikeUsers, 'instant');
        
        // Measure spike impact
        const spikeStart = Date.now();
        const spikeEnd = spikeStart + config.spikeDuration;
        
        while (Date.now() < spikeEnd) {
            await this.executeTestIteration(testRun, config.scenarios);
            await this.collectMetrics(testRun);
            await this.sleep(1000);
        }
        
        // Return to baseline
        await this.rampDownUsers(testRun, config.baseUsers);
        await this.sleep(30000); // 30 seconds recovery
        
        const recoveryMetrics = await this.collectMetrics(testRun);
        testRun.results.summary.recovery = recoveryMetrics;
    }
    
    // Execute endurance test
    async executeEnduranceTest(testRun) {
        const config = testRun.scenario.config;
        testRun.status = 'running';
        
        console.log(`Executing ${config.duration / 3600000} hour endurance test`);
        
        await this.rampUpUsers(testRun, config.virtualUsers, 'linear');
        
        const startTime = Date.now();
        const endTime = startTime + config.duration;
        let lastCheckpoint = startTime;
        
        while (Date.now() < endTime && testRun.status === 'running') {
            await this.executeTestIteration(testRun, config.scenarios);
            const metrics = await this.collectMetrics(testRun);
            
            // Checkpoint every hour
            if (Date.now() - lastCheckpoint >= config.checkInterval) {
                await this.createCheckpoint(testRun, metrics);
                lastCheckpoint = Date.now();
            }
            
            // Check for memory leaks or degradation
            if (this.detectPerformanceDegradation(testRun)) {
                console.warn('Performance degradation detected');
                testRun.results.summary.degradationDetected = true;
            }
            
            await this.sleep(5000); // 5 seconds between iterations
        }
        
        await this.coolDownUsers(testRun);
    }
    
    // Execute scalability test
    async executeScalabilityTest(testRun) {
        const config = testRun.scenario.config;
        testRun.status = 'running';
        
        console.log('Executing scalability test');
        
        let currentContainers = config.startContainers;
        const scalabilityResults = [];
        
        while (currentContainers <= config.endContainers) {
            console.log(`Testing with ${currentContainers} containers`);
            
            const users = Math.floor(currentContainers / 1000000 * config.usersPerMillion);
            await this.rampUpUsers(testRun, users, 'linear');
            
            // Simulate load at current scale
            const scaleTest = {
                containers: currentContainers,
                users: users,
                metrics: []
            };
            
            const testDuration = 300000; // 5 minutes per scale
            const testStart = Date.now();
            
            while (Date.now() - testStart < testDuration) {
                await this.executeTestIteration(testRun, config.scenarios);
                const metrics = await this.collectMetrics(testRun);
                scaleTest.metrics.push(metrics);
                await this.sleep(1000);
            }
            
            // Analyze scalability
            scaleTest.analysis = this.analyzeScalability(scaleTest.metrics);
            scalabilityResults.push(scaleTest);
            
            currentContainers += config.incrementContainers;
        }
        
        testRun.results.summary.scalability = scalabilityResults;
        await this.coolDownUsers(testRun);
    }
    
    // Execute test iteration
    async executeTestIteration(testRun, scenarios) {
        const promises = [];
        const activeUsers = testRun.activeUsers || 1000;
        
        // Distribute actions based on weights
        for (let i = 0; i < activeUsers; i++) {
            const action = this.selectWeightedAction(scenarios);
            promises.push(this.executeAction(action, testRun));
            
            // Batch requests to avoid overwhelming
            if (promises.length >= 100) {
                await Promise.all(promises);
                promises.length = 0;
            }
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }
    
    // Execute specific action
    async executeAction(action, testRun) {
        const startTime = Date.now();
        let success = false;
        let error = null;
        
        try {
            switch (action) {
                case 'viewDashboard':
                    await this.simulateViewDashboard();
                    break;
                case 'trackContainer':
                    await this.simulateTrackContainer();
                    break;
                case 'apiCall':
                    await this.simulateApiCall();
                    break;
                case 'generateReport':
                    await this.simulateGenerateReport();
                    break;
                case 'websocketConnect':
                    await this.simulateWebSocketConnect();
                    break;
                case 'databaseQuery':
                    await this.simulateDatabaseQuery();
                    break;
                case 'mlInference':
                    await this.simulateMLInference();
                    break;
                case 'heavyOperation':
                    await this.simulateHeavyOperation();
                    break;
                default:
                    await this.simulateGenericAction();
            }
            success = true;
        } catch (err) {
            error = err.message;
            this.recordError(testRun, action, error);
        }
        
        const duration = Date.now() - startTime;
        this.recordMetric(testRun, action, duration, success);
        
        return { action, duration, success, error };
    }
    
    // Simulation methods
    async simulateViewDashboard() {
        // Simulate dashboard view
        await this.httpRequest('GET', '/dashboard', {
            expectedStatus: 200,
            timeout: 5000
        });
    }
    
    async simulateTrackContainer() {
        const containerId = this.generateContainerId();
        await this.httpRequest('GET', `/api/containers/${containerId}`, {
            expectedStatus: [200, 404],
            timeout: 3000
        });
    }
    
    async simulateApiCall() {
        const endpoints = [
            '/api/containers',
            '/api/shipments',
            '/api/analytics',
            '/api/users'
        ];
        
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        await this.httpRequest('GET', endpoint, {
            expectedStatus: 200,
            timeout: 2000
        });
    }
    
    async simulateGenerateReport() {
        await this.httpRequest('POST', '/api/reports', {
            body: {
                type: 'summary',
                dateRange: 'last30days',
                format: 'pdf'
            },
            expectedStatus: [200, 202],
            timeout: 10000
        });
    }
    
    async simulateWebSocketConnect() {
        // Simulate WebSocket connection
        const ws = await this.createWebSocketConnection();
        
        // Send some messages
        for (let i = 0; i < 10; i++) {
            await this.sendWebSocketMessage(ws, {
                type: 'subscribe',
                container: this.generateContainerId()
            });
            await this.sleep(100);
        }
        
        // Close connection
        ws.close();
    }
    
    async simulateDatabaseQuery() {
        // Simulate complex database query
        await this.httpRequest('POST', '/api/analytics/query', {
            body: {
                query: 'complex_aggregation',
                timeRange: 'last90days',
                groupBy: ['carrier', 'route', 'status']
            },
            expectedStatus: 200,
            timeout: 5000
        });
    }
    
    async simulateMLInference() {
        // Simulate ML model inference
        await this.httpRequest('POST', '/api/ml/predict', {
            body: {
                model: 'eta_prediction',
                containers: Array(100).fill(null).map(() => this.generateContainerId())
            },
            expectedStatus: 200,
            timeout: 8000
        });
    }
    
    async simulateHeavyOperation() {
        // Simulate heavy bulk operation
        await this.httpRequest('POST', '/api/bulk/process', {
            body: {
                operation: 'update_status',
                containers: Array(1000).fill(null).map(() => this.generateContainerId())
            },
            expectedStatus: [200, 202],
            timeout: 30000
        });
    }
    
    async simulateGenericAction() {
        await this.sleep(Math.random() * 1000 + 500);
    }
    
    // HTTP request helper
    async httpRequest(method, path, options = {}) {
        // Simulate HTTP request
        const delay = Math.random() * 1000 + 100;
        await this.sleep(delay);
        
        // Simulate occasional failures
        if (Math.random() < 0.02) { // 2% error rate
            throw new Error('Request failed');
        }
        
        return {
            status: Array.isArray(options.expectedStatus) ? 
                options.expectedStatus[0] : (options.expectedStatus || 200),
            duration: delay
        };
    }
    
    // WebSocket connection helper
    async createWebSocketConnection() {
        // Simulate WebSocket connection
        return {
            send: async (data) => await this.sleep(10),
            close: () => {}
        };
    }
    
    async sendWebSocketMessage(ws, message) {
        await ws.send(JSON.stringify(message));
    }
    
    // Metrics collection
    async collectMetrics(testRun) {
        const metrics = {
            timestamp: new Date(),
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                rate: 0
            },
            response: {
                min: Infinity,
                max: 0,
                avg: 0,
                p50: 0,
                p95: 0,
                p99: 0
            },
            system: await this.collectSystemMetrics(),
            errors: this.getRecentErrors(testRun)
        };
        
        // Calculate request metrics
        const recentRequests = this.getRecentRequests(testRun);
        metrics.requests.total = recentRequests.length;
        metrics.requests.successful = recentRequests.filter(r => r.success).length;
        metrics.requests.failed = metrics.requests.total - metrics.requests.successful;
        metrics.requests.rate = metrics.requests.total / 60; // per second
        
        // Calculate response time metrics
        if (recentRequests.length > 0) {
            const times = recentRequests.map(r => r.duration).sort((a, b) => a - b);
            metrics.response.min = times[0];
            metrics.response.max = times[times.length - 1];
            metrics.response.avg = times.reduce((a, b) => a + b, 0) / times.length;
            metrics.response.p50 = times[Math.floor(times.length * 0.5)];
            metrics.response.p95 = times[Math.floor(times.length * 0.95)];
            metrics.response.p99 = times[Math.floor(times.length * 0.99)];
        }
        
        testRun.results.detailed.push(metrics);
        
        return metrics;
    }
    
    // Collect system metrics
    async collectSystemMetrics() {
        return {
            cpu: {
                usage: os.loadavg()[0] / os.cpus().length * 100,
                cores: os.cpus().length
            },
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                percentage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100)
            },
            connections: {
                active: Math.floor(Math.random() * 10000), // Simulated
                waiting: Math.floor(Math.random() * 1000)
            }
        };
    }
    
    // Performance analysis
    analyzeScalability(metrics) {
        if (metrics.length < 2) return { scalable: 'unknown' };
        
        // Calculate performance degradation
        const firstMetric = metrics[0];
        const lastMetric = metrics[metrics.length - 1];
        
        const responseTimeDegradation = 
            (lastMetric.response.avg - firstMetric.response.avg) / firstMetric.response.avg * 100;
        
        const throughputChange = 
            (lastMetric.requests.rate - firstMetric.requests.rate) / firstMetric.requests.rate * 100;
        
        return {
            scalable: responseTimeDegradation < 20 && throughputChange > -10,
            responseTimeDegradation: responseTimeDegradation.toFixed(2),
            throughputChange: throughputChange.toFixed(2),
            recommendation: this.getScalabilityRecommendation(responseTimeDegradation, throughputChange)
        };
    }
    
    getScalabilityRecommendation(rtDegradation, throughputChange) {
        if (rtDegradation < 10 && throughputChange > 0) {
            return 'System scales excellently';
        } else if (rtDegradation < 20 && throughputChange > -10) {
            return 'System scales well with minor degradation';
        } else if (rtDegradation < 50) {
            return 'System shows moderate scalability issues';
        } else {
            return 'System has significant scalability problems';
        }
    }
    
    // Check if system is at limit
    isSystemAtLimit(metrics) {
        return (
            metrics.response.p95 > 10000 || // 10 second response time
            metrics.requests.failed / metrics.requests.total > 0.1 || // 10% error rate
            metrics.system.cpu.usage > 95 || // CPU maxed out
            metrics.system.memory.percentage > 95 // Memory maxed out
        );
    }
    
    // Detect performance degradation
    detectPerformanceDegradation(testRun) {
        const recent = testRun.results.detailed.slice(-10);
        if (recent.length < 10) return false;
        
        // Check for increasing response times
        let increasing = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i].response.avg > recent[i-1].response.avg) {
                increasing++;
            }
        }
        
        return increasing > 7; // Consistent increase
    }
    
    // Should stop test
    shouldStopTest(testRun) {
        const recent = testRun.results.detailed.slice(-5);
        if (recent.length === 0) return false;
        
        // Stop if error rate is too high
        const avgErrorRate = recent.reduce((sum, m) => 
            sum + (m.requests.failed / m.requests.total), 0) / recent.length;
        
        return avgErrorRate > 0.5; // 50% error rate
    }
    
    // Finalize test results
    async finalizeTestResults(testRun) {
        testRun.status = 'finalizing';
        
        const results = testRun.results;
        const allMetrics = results.detailed;
        
        // Calculate summary statistics
        results.summary = {
            ...results.summary,
            duration: testRun.duration,
            totalRequests: allMetrics.reduce((sum, m) => sum + m.requests.total, 0),
            successfulRequests: allMetrics.reduce((sum, m) => sum + m.requests.successful, 0),
            failedRequests: allMetrics.reduce((sum, m) => sum + m.requests.failed, 0),
            avgResponseTime: this.calculateAverage(allMetrics.map(m => m.response.avg)),
            p95ResponseTime: this.calculatePercentile(allMetrics.map(m => m.response.p95), 95),
            p99ResponseTime: this.calculatePercentile(allMetrics.map(m => m.response.p99), 99),
            throughput: this.calculateAverage(allMetrics.map(m => m.requests.rate)),
            errorRate: this.calculateErrorRate(allMetrics),
            recommendations: this.generateRecommendations(testRun)
        };
        
        // SLA compliance check
        results.summary.slaCompliance = this.checkSLACompliance(results.summary);
        
        testRun.status = 'completed';
    }
    
    // Generate recommendations
    generateRecommendations(testRun) {
        const recommendations = [];
        const summary = testRun.results.summary;
        
        // Response time recommendations
        if (summary.p95ResponseTime > 5000) {
            recommendations.push({
                type: 'performance',
                severity: 'high',
                title: 'High Response Times',
                description: `P95 response time of ${summary.p95ResponseTime}ms exceeds target`,
                suggestion: 'Consider optimizing database queries and adding caching'
            });
        }
        
        // Error rate recommendations
        if (summary.errorRate > 0.05) {
            recommendations.push({
                type: 'reliability',
                severity: 'critical',
                title: 'High Error Rate',
                description: `Error rate of ${(summary.errorRate * 100).toFixed(2)}% is concerning`,
                suggestion: 'Investigate error logs and improve error handling'
            });
        }
        
        // Scalability recommendations
        if (testRun.type === 'scalability' && summary.scalability) {
            const lastScale = summary.scalability[summary.scalability.length - 1];
            if (!lastScale.analysis.scalable) {
                recommendations.push({
                    type: 'scalability',
                    severity: 'high',
                    title: 'Scalability Issues',
                    description: lastScale.analysis.recommendation,
                    suggestion: 'Consider horizontal scaling and load balancing improvements'
                });
            }
        }
        
        // Resource recommendations
        const avgCpu = this.calculateAverage(testRun.results.detailed.map(m => m.system.cpu.usage));
        if (avgCpu > 80) {
            recommendations.push({
                type: 'resources',
                severity: 'medium',
                title: 'High CPU Usage',
                description: `Average CPU usage of ${avgCpu.toFixed(1)}% during test`,
                suggestion: 'Consider adding more CPU cores or optimizing CPU-intensive operations'
            });
        }
        
        return recommendations;
    }
    
    // Check SLA compliance
    checkSLACompliance(summary) {
        const slaTargets = {
            responseTime: { p95: 2000, p99: 5000 },
            availability: 99.9,
            errorRate: 0.01,
            throughput: 1000 // requests per second
        };
        
        const compliance = {
            responseTime: summary.p95ResponseTime <= slaTargets.responseTime.p95 &&
                         summary.p99ResponseTime <= slaTargets.responseTime.p99,
            availability: (1 - summary.errorRate) * 100 >= slaTargets.availability,
            errorRate: summary.errorRate <= slaTargets.errorRate,
            throughput: summary.throughput >= slaTargets.throughput
        };
        
        compliance.overall = Object.values(compliance).every(v => v === true);
        
        return compliance;
    }
    
    // Helper methods
    async rampUpUsers(testRun, targetUsers, rampType) {
        console.log(`Ramping up to ${targetUsers} users (${rampType})`);
        
        switch (rampType) {
            case 'linear':
                // Linear ramp up over configured time
                const steps = 10;
                const usersPerStep = targetUsers / steps;
                for (let i = 1; i <= steps; i++) {
                    testRun.activeUsers = Math.floor(usersPerStep * i);
                    await this.sleep(this.config.rampUpTime / steps);
                }
                break;
                
            case 'exponential':
                // Exponential ramp up
                for (let i = 1; i <= 10; i++) {
                    testRun.activeUsers = Math.floor(targetUsers * Math.pow(i/10, 2));
                    await this.sleep(this.config.rampUpTime / 10);
                }
                break;
                
            case 'aggressive':
            case 'instant':
                // Immediate ramp up
                testRun.activeUsers = targetUsers;
                break;
        }
    }
    
    async rampDownUsers(testRun, targetUsers) {
        const steps = 5;
        const currentUsers = testRun.activeUsers;
        const usersPerStep = (currentUsers - targetUsers) / steps;
        
        for (let i = 1; i <= steps; i++) {
            testRun.activeUsers = Math.floor(currentUsers - (usersPerStep * i));
            await this.sleep(this.config.coolDownTime / steps);
        }
    }
    
    async coolDownUsers(testRun) {
        await this.rampDownUsers(testRun, 0);
    }
    
    selectWeightedAction(scenarios) {
        const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const scenario of scenarios) {
            random -= scenario.weight;
            if (random <= 0) {
                return scenario.action;
            }
        }
        
        return scenarios[0].action;
    }
    
    recordMetric(testRun, action, duration, success) {
        if (!this.metrics.requests.has(testRun.id)) {
            this.metrics.requests.set(testRun.id, []);
        }
        
        this.metrics.requests.get(testRun.id).push({
            action,
            duration,
            success,
            timestamp: Date.now()
        });
    }
    
    recordError(testRun, action, error) {
        if (!this.metrics.errors.has(testRun.id)) {
            this.metrics.errors.set(testRun.id, []);
        }
        
        this.metrics.errors.get(testRun.id).push({
            action,
            error,
            timestamp: Date.now()
        });
    }
    
    getRecentRequests(testRun, duration = 60000) {
        const requests = this.metrics.requests.get(testRun.id) || [];
        const cutoff = Date.now() - duration;
        return requests.filter(r => r.timestamp > cutoff);
    }
    
    getRecentErrors(testRun, duration = 60000) {
        const errors = this.metrics.errors.get(testRun.id) || [];
        const cutoff = Date.now() - duration;
        return errors.filter(e => e.timestamp > cutoff);
    }
    
    async createCheckpoint(testRun, metrics) {
        console.log(`Checkpoint at ${new Date().toISOString()}`);
        console.log(`- Requests: ${metrics.requests.total} (${metrics.requests.failed} failed)`);
        console.log(`- Response time: ${metrics.response.avg.toFixed(0)}ms avg, ${metrics.response.p95.toFixed(0)}ms p95`);
        console.log(`- System: ${metrics.system.cpu.usage.toFixed(1)}% CPU, ${metrics.system.memory.percentage.toFixed(1)}% memory`);
    }
    
    generateContainerId() {
        const prefix = ['MSKU', 'HLCU', 'TGHU', 'CSQU'][Math.floor(Math.random() * 4)];
        const number = Math.floor(Math.random() * 9000000) + 1000000;
        return `${prefix}${number}`;
    }
    
    generateTestRunId() {
        return `test_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
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
    
    calculateErrorRate(metrics) {
        const total = metrics.reduce((sum, m) => sum + m.requests.total, 0);
        const failed = metrics.reduce((sum, m) => sum + m.requests.failed, 0);
        return total > 0 ? failed / total : 0;
    }
    
    async initializeTest(testRun) {
        // Setup test environment
        console.log('Initializing test environment...');
        await this.sleep(1000);
    }
    
    setupMetricsCollection() {
        // Cleanup old metrics periodically
        setInterval(() => {
            const cutoff = Date.now() - 3600000; // 1 hour
            for (const [testId, requests] of this.metrics.requests) {
                const filtered = requests.filter(r => r.timestamp > cutoff);
                if (filtered.length === 0) {
                    this.metrics.requests.delete(testId);
                } else {
                    this.metrics.requests.set(testId, filtered);
                }
            }
        }, 300000); // Every 5 minutes
    }
    
    setupClusterWorkers() {
        if (cluster.isMaster) {
            console.log(`Master process ${process.pid} setting up workers`);
            
            // Fork workers for load generation
            const numWorkers = Math.min(os.cpus().length, 4);
            for (let i = 0; i < numWorkers; i++) {
                cluster.fork();
            }
            
            cluster.on('exit', (worker, code, signal) => {
                console.log(`Worker ${worker.process.pid} died`);
                cluster.fork(); // Replace dead workers
            });
        }
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { PerformanceTestingSuite };