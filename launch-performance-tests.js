/**
 * ROOTUIP Performance Testing Launcher
 * Comprehensive load testing and monitoring system
 */

const { PerformanceTestingSuite } = require('./performance-testing-suite');
const { RealWorldSimulation } = require('./real-world-simulation');
const { ContinuousPerformanceMonitor } = require('./continuous-performance-monitor');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PERF_TEST_PORT || 8085;

// Initialize components
const performanceTest = new PerformanceTestingSuite({
    targetUrl: process.env.TARGET_URL || 'http://localhost:3000',
    testDuration: 300000 // 5 minutes default
});

const realWorldSim = new RealWorldSimulation({
    baseUrl: process.env.TARGET_URL || 'http://localhost:3000'
});

const continuousMonitor = new ContinuousPerformanceMonitor({
    checkInterval: 60000 // 1 minute for demo
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Run performance test
app.post('/api/tests/run', async (req, res) => {
    try {
        const { testType, scenarioId, options } = req.body;
        const result = await performanceTest.runPerformanceTest(testType, scenarioId, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get test scenarios
app.get('/api/tests/scenarios', (req, res) => {
    const scenarios = Array.from(performanceTest.testScenarios.entries()).map(([id, scenario]) => ({
        id,
        ...scenario
    }));
    res.json(scenarios);
});

// Get active tests
app.get('/api/tests/active', (req, res) => {
    const activeTests = Array.from(performanceTest.activeTests.values());
    res.json(activeTests);
});

// Get test results
app.get('/api/tests/results', (req, res) => {
    const results = Array.from(performanceTest.testResults.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 10);
    res.json(results);
});

// Get specific test result
app.get('/api/tests/results/:id', (req, res) => {
    const result = performanceTest.testResults.get(req.params.id);
    if (!result) {
        return res.status(404).json({ error: 'Test result not found' });
    }
    res.json(result);
});

// Run real-world simulation
app.post('/api/simulation/run', async (req, res) => {
    try {
        const result = await realWorldSim.runComprehensiveSimulation(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get simulation scenarios
app.get('/api/simulation/scenarios', (req, res) => {
    const scenarios = Array.from(realWorldSim.scenarios.entries()).map(([id, scenario]) => ({
        id,
        ...scenario
    }));
    res.json(scenarios);
});

// Get monitoring metrics
app.get('/api/monitor/metrics', (req, res) => {
    const timeline = continuousMonitor.metrics.get('timeline') || [];
    const recent = timeline.slice(-100); // Last 100 data points
    res.json(recent);
});

// Get performance baselines
app.get('/api/monitor/baselines', (req, res) => {
    const baselines = {};
    continuousMonitor.baselines.forEach((value, key) => {
        baselines[key] = value;
    });
    res.json(baselines);
});

// Get alerts
app.get('/api/monitor/alerts', (req, res) => {
    const alerts = Array.from(continuousMonitor.alerts.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    res.json(alerts);
});

// Get latest performance report
app.get('/api/monitor/report', (req, res) => {
    const reports = Array.from(continuousMonitor.reports.values());
    const latest = reports[reports.length - 1];
    res.json(latest || { message: 'No reports generated yet' });
});

// Quick performance check
app.post('/api/quick-check', async (req, res) => {
    try {
        // Run a quick load test
        const result = await performanceTest.runPerformanceTest('load', 'load_test_standard', {
            duration: 60000, // 1 minute
            virtualUsers: 1000
        });
        
        res.json({
            testId: result.id,
            summary: result.results.summary,
            status: result.status,
            recommendations: result.results.summary.recommendations
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Performance Testing Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #2c3e50;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-type {
            display: inline-block;
            padding: 10px 20px;
            margin: 5px;
            background: #3498db;
            color: white;
            border-radius: 5px;
            cursor: pointer;
            text-decoration: none;
        }
        .test-type:hover {
            background: #2980b9;
        }
        .metric {
            display: inline-block;
            margin: 10px;
            padding: 15px;
            background: #ecf0f1;
            border-radius: 5px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .metric-label {
            font-size: 12px;
            color: #7f8c8d;
        }
        .status {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
        .status.running { background: #f39c12; color: white; }
        .status.completed { background: #27ae60; color: white; }
        .status.failed { background: #e74c3c; color: white; }
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ROOTUIP Performance Testing Dashboard</h1>
        
        <div class="card">
            <h2>Quick Actions</h2>
            <a class="test-type" onclick="runQuickCheck()">Quick Performance Check</a>
            <a class="test-type" onclick="runLoadTest()">Standard Load Test</a>
            <a class="test-type" onclick="runStressTest()">Stress Test</a>
            <a class="test-type" onclick="runSimulation()">Real-World Simulation</a>
        </div>
        
        <div class="card">
            <h2>Current Performance Metrics</h2>
            <div id="metrics">
                <div class="metric">
                    <div class="metric-value">-</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value">-</div>
                    <div class="metric-label">Requests/sec</div>
                </div>
                <div class="metric">
                    <div class="metric-value">-</div>
                    <div class="metric-label">Error Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">-</div>
                    <div class="metric-label">Active Users</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Test Results</h2>
            <div id="results">Loading...</div>
        </div>
        
        <div class="card">
            <h2>Recent Alerts</h2>
            <div id="alerts">Loading...</div>
        </div>
    </div>
    
    <script>
        // Update metrics every 5 seconds
        setInterval(updateMetrics, 5000);
        updateMetrics();
        updateResults();
        updateAlerts();
        
        async function updateMetrics() {
            try {
                const response = await fetch('/api/monitor/metrics');
                const metrics = await response.json();
                
                if (metrics.length > 0) {
                    const latest = metrics[metrics.length - 1];
                    updateMetricDisplay(latest);
                }
            } catch (error) {
                console.error('Failed to update metrics:', error);
            }
        }
        
        function updateMetricDisplay(metric) {
            const metricsDiv = document.getElementById('metrics');
            let avgResponseTime = '-';
            let throughput = '-';
            let errorRate = '-';
            let activeUsers = '-';
            
            if (metric.data.response_time) {
                const times = Object.values(metric.data.response_time).map(e => e.avg);
                avgResponseTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length) + 'ms';
            }
            
            if (metric.data.throughput) {
                throughput = Math.round(metric.data.throughput.requests_per_second);
            }
            
            if (metric.data.error_rate) {
                errorRate = (metric.data.error_rate.error_rate * 100).toFixed(2) + '%';
            }
            
            if (metric.data.throughput) {
                activeUsers = metric.data.throughput.concurrent_users || '-';
            }
            
            metricsDiv.innerHTML = \`
                <div class="metric">
                    <div class="metric-value">\${avgResponseTime}</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric">
                    <div class="metric-value">\${throughput}</div>
                    <div class="metric-label">Requests/sec</div>
                </div>
                <div class="metric">
                    <div class="metric-value">\${errorRate}</div>
                    <div class="metric-label">Error Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">\${activeUsers}</div>
                    <div class="metric-label">Active Users</div>
                </div>
            \`;
        }
        
        async function updateResults() {
            try {
                const response = await fetch('/api/tests/results');
                const results = await response.json();
                
                const resultsDiv = document.getElementById('results');
                if (results.length === 0) {
                    resultsDiv.innerHTML = '<p>No test results yet. Run a test to see results.</p>';
                    return;
                }
                
                resultsDiv.innerHTML = results.map(result => \`
                    <div style="margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                        <strong>\${result.scenario.name}</strong>
                        <span class="status \${result.status}">\${result.status}</span>
                        <br>
                        <small>Started: \${new Date(result.startTime).toLocaleString()}</small>
                        <br>
                        <small>Duration: \${Math.round(result.duration / 1000)}s</small>
                        <br>
                        <strong>Summary:</strong>
                        <ul style="margin: 5px 0;">
                            <li>Total Requests: \${result.results.summary.totalRequests || '-'}</li>
                            <li>Success Rate: \${((result.results.summary.successfulRequests / result.results.summary.totalRequests * 100) || 0).toFixed(1)}%</li>
                            <li>Avg Response Time: \${Math.round(result.results.summary.avgResponseTime || 0)}ms</li>
                            <li>Error Rate: \${(result.results.summary.errorRate * 100 || 0).toFixed(2)}%</li>
                        </ul>
                    </div>
                \`).join('');
            } catch (error) {
                console.error('Failed to update results:', error);
            }
        }
        
        async function updateAlerts() {
            try {
                const response = await fetch('/api/monitor/alerts');
                const alerts = await response.json();
                
                const alertsDiv = document.getElementById('alerts');
                if (alerts.length === 0) {
                    alertsDiv.innerHTML = '<p>No recent alerts.</p>';
                    return;
                }
                
                alertsDiv.innerHTML = alerts.slice(0, 5).map(alert => \`
                    <div style="margin-bottom: 10px; padding: 10px; background: \${alert.severity === 'critical' ? '#ffe5e5' : '#fff3cd'}; border-radius: 5px;">
                        <strong>\${alert.title}</strong> - <small>\${alert.severity}</small>
                        <br>
                        <small>\${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                \`).join('');
            } catch (error) {
                console.error('Failed to update alerts:', error);
            }
        }
        
        async function runQuickCheck() {
            if (!confirm('Run a 1-minute quick performance check?')) return;
            
            try {
                const response = await fetch('/api/quick-check', { method: 'POST' });
                const result = await response.json();
                
                alert(\`Quick check completed!
Test ID: \${result.testId}
Status: \${result.status}
Avg Response Time: \${Math.round(result.summary.avgResponseTime || 0)}ms
Error Rate: \${(result.summary.errorRate * 100 || 0).toFixed(2)}%\`);
                
                updateResults();
            } catch (error) {
                alert('Failed to run quick check: ' + error.message);
            }
        }
        
        async function runLoadTest() {
            if (!confirm('Run a standard 5-minute load test with 5000 users?')) return;
            
            try {
                const response = await fetch('/api/tests/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        testType: 'load',
                        scenarioId: 'load_test_standard'
                    })
                });
                const result = await response.json();
                
                alert('Load test started! Test ID: ' + result.id);
                setTimeout(updateResults, 2000);
            } catch (error) {
                alert('Failed to start load test: ' + error.message);
            }
        }
        
        async function runStressTest() {
            if (!confirm('Run a stress test to find system limits? This may take up to 15 minutes.')) return;
            
            try {
                const response = await fetch('/api/tests/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        testType: 'stress',
                        scenarioId: 'stress_test_limits'
                    })
                });
                const result = await response.json();
                
                alert('Stress test started! Test ID: ' + result.id);
                setTimeout(updateResults, 2000);
            } catch (error) {
                alert('Failed to start stress test: ' + error.message);
            }
        }
        
        async function runSimulation() {
            if (!confirm('Run a real-world simulation? This simulates production-like traffic patterns.')) return;
            
            try {
                const response = await fetch('/api/simulation/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const result = await response.json();
                
                alert('Simulation started! ID: ' + result.id);
            } catch (error) {
                alert('Failed to start simulation: ' + error.message);
            }
        }
    </script>
</body>
</html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 ROOTUIP Performance Testing System Started!

✅ Dashboard: http://localhost:${PORT}

📊 Testing Capabilities:
- Load Testing: Simulate up to 10,000+ concurrent users
- Stress Testing: Find system breaking points
- Spike Testing: Test sudden traffic surges
- Endurance Testing: 24+ hour stability tests
- Scalability Testing: Growth scenario validation

🎯 Target Performance:
- 1M+ Containers tracked simultaneously
- 10K+ Concurrent users supported
- 100K+ API calls per minute handled
- <2s average response time maintained
- 99.9% uptime achieved

🔧 Test Scenarios Available:
1. Standard Load Test (5K users, 5 minutes)
2. Peak Load Test (10K users, 10 minutes)
3. Stress Test (20K users, progressive)
4. Spike Test (1K→15K sudden surge)
5. Endurance Test (3K users, 24 hours)
6. Scalability Test (100K→1M containers)

📈 Real-World Simulations:
- Container tracking patterns
- API integration stress
- Database performance
- WebSocket scaling
- ML model inference load

⚡ Continuous Monitoring:
- Performance regression detection
- SLA compliance validation
- Capacity planning insights
- Optimization recommendations

Try the Quick Performance Check for instant results!
`);
    
    // Start demo data generation
    setInterval(() => {
        continuousMonitor.collectAllMetrics();
    }, 5000);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down performance testing system...');
    continuousMonitor.stop();
    process.exit(0);
});

// Performance test event handlers
performanceTest.on('test:completed', (result) => {
    console.log(`\n✅ Test completed: ${result.scenario.name}`);
    console.log(`Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`Total Requests: ${result.results.summary.totalRequests}`);
    console.log(`Success Rate: ${((result.results.summary.successfulRequests / result.results.summary.totalRequests * 100) || 0).toFixed(1)}%`);
    console.log(`Avg Response Time: ${Math.round(result.results.summary.avgResponseTime || 0)}ms`);
    
    if (result.results.summary.recommendations?.length > 0) {
        console.log('\n📋 Recommendations:');
        result.results.summary.recommendations.forEach((rec, i) => {
            console.log(`${i + 1}. [${rec.severity}] ${rec.title}`);
            console.log(`   ${rec.suggestion}`);
        });
    }
});

// Monitor event handlers
continuousMonitor.on('alert:regression', (alert) => {
    console.log(`\n⚠️ PERFORMANCE REGRESSION: ${alert.title}`);
    console.log(`Severity: ${alert.severity}`);
    alert.details.forEach(detail => {
        console.log(`- ${detail.endpoint || detail.metric}: ${detail.current} (was ${detail.baseline})`);
    });
});

continuousMonitor.on('alert:sla_violation', (alert) => {
    console.log(`\n🚨 SLA VIOLATION: ${alert.title}`);
    console.log(`Target: ${alert.details.target}, Actual: ${alert.details.actual}`);
});

continuousMonitor.on('report:generated', (report) => {
    console.log(`\n📊 Performance Report Generated: ${report.id}`);
    console.log(`Overall Health: ${report.summary.overall_health.status} (${report.summary.overall_health.score}/100)`);
});