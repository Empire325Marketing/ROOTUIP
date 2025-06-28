const http = require('http');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: 0,
            errors: 0,
            avgResponseTime: 0,
            responseTimes: [],
            statusCodes: {},
            endpoints: {},
            startTime: Date.now()
        };
        
        this.alertThresholds = {
            errorRate: 0.05, // 5%
            avgResponseTime: 1000, // 1 second
            requestsPerMinute: 1000
        };
    }
    
    async testEndpoint(endpoint, method = 'GET', data = null, headers = {}) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 3003,
                path: endpoint,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            
            const req = http.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                let body = '';
                
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    this.recordMetric(endpoint, res.statusCode, responseTime);
                    resolve({
                        statusCode: res.statusCode,
                        responseTime,
                        body
                    });
                });
            });
            
            req.on('error', (error) => {
                this.recordMetric(endpoint, 0, Date.now() - startTime, true);
                resolve({
                    statusCode: 0,
                    responseTime: Date.now() - startTime,
                    error: error.message
                });
            });
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }
    
    recordMetric(endpoint, statusCode, responseTime, isError = false) {
        this.metrics.requests++;
        
        if (isError || statusCode >= 400) {
            this.metrics.errors++;
        }
        
        this.metrics.responseTimes.push(responseTime);
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes.shift();
        }
        
        this.metrics.avgResponseTime = 
            this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
        
        this.metrics.statusCodes[statusCode] = (this.metrics.statusCodes[statusCode] || 0) + 1;
        
        if (!this.metrics.endpoints[endpoint]) {
            this.metrics.endpoints[endpoint] = {
                requests: 0,
                errors: 0,
                avgResponseTime: 0,
                responseTimes: []
            };
        }
        
        const endpointMetrics = this.metrics.endpoints[endpoint];
        endpointMetrics.requests++;
        if (isError || statusCode >= 400) endpointMetrics.errors++;
        endpointMetrics.responseTimes.push(responseTime);
        if (endpointMetrics.responseTimes.length > 100) {
            endpointMetrics.responseTimes.shift();
        }
        endpointMetrics.avgResponseTime = 
            endpointMetrics.responseTimes.reduce((a, b) => a + b, 0) / endpointMetrics.responseTimes.length;
    }
    
    checkAlerts() {
        const alerts = [];
        const errorRate = this.metrics.errors / this.metrics.requests;
        
        if (errorRate > this.alertThresholds.errorRate) {
            alerts.push({
                type: 'error_rate',
                severity: 'high',
                message: `Error rate is ${(errorRate * 100).toFixed(2)}% (threshold: ${this.alertThresholds.errorRate * 100}%)`
            });
        }
        
        if (this.metrics.avgResponseTime > this.alertThresholds.avgResponseTime) {
            alerts.push({
                type: 'response_time',
                severity: 'medium',
                message: `Average response time is ${this.metrics.avgResponseTime.toFixed(2)}ms (threshold: ${this.alertThresholds.avgResponseTime}ms)`
            });
        }
        
        return alerts;
    }
    
    getReport() {
        const uptime = (Date.now() - this.metrics.startTime) / 1000;
        const requestsPerMinute = (this.metrics.requests / uptime) * 60;
        
        return {
            uptime: uptime,
            totalRequests: this.metrics.requests,
            totalErrors: this.metrics.errors,
            errorRate: ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) + '%',
            avgResponseTime: this.metrics.avgResponseTime.toFixed(2) + 'ms',
            requestsPerMinute: requestsPerMinute.toFixed(2),
            statusCodes: this.metrics.statusCodes,
            endpointStats: Object.entries(this.metrics.endpoints).map(([endpoint, stats]) => ({
                endpoint,
                requests: stats.requests,
                errors: stats.errors,
                errorRate: ((stats.errors / stats.requests) * 100).toFixed(2) + '%',
                avgResponseTime: stats.avgResponseTime.toFixed(2) + 'ms'
            })),
            alerts: this.checkAlerts()
        };
    }
    
    async runTests() {
        // Test health endpoint
        await this.testEndpoint('/auth/health');
        
        // Test login with valid credentials
        await this.testEndpoint('/auth/login', 'POST', {
            email: 'demo@rootuip.com',
            password: 'Demo123456'
        });
        
        // Test login with invalid credentials (expected to fail)
        await this.testEndpoint('/auth/login', 'POST', {
            email: 'invalid@example.com',
            password: 'wrongpassword'
        });
        
        // Test verify without token (expected to fail)
        await this.testEndpoint('/auth/verify');
    }
    
    saveReport() {
        const report = this.getReport();
        const timestamp = new Date().toISOString();
        
        // Save to log file
        const logEntry = {
            timestamp,
            ...report
        };
        
        fs.appendFileSync(
            path.join(__dirname, 'logs', 'performance.jsonl'),
            JSON.stringify(logEntry) + '\n'
        );
        
        // Save latest report
        fs.writeFileSync(
            path.join(__dirname, 'logs', 'latest-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        return report;
    }
}

// Run performance monitoring
const monitor = new PerformanceMonitor();

console.log('Starting performance monitoring...');

// Run tests every 30 seconds
setInterval(async () => {
    await monitor.runTests();
    const report = monitor.saveReport();
    
    console.log(`[${new Date().toISOString()}] Performance Report:`);
    console.log(`- Total Requests: ${report.totalRequests}`);
    console.log(`- Error Rate: ${report.errorRate}`);
    console.log(`- Avg Response Time: ${report.avgResponseTime}`);
    console.log(`- Requests/min: ${report.requestsPerMinute}`);
    
    if (report.alerts.length > 0) {
        console.log('\nALERTS:');
        report.alerts.forEach(alert => {
            console.log(`- [${alert.severity.toUpperCase()}] ${alert.message}`);
        });
    }
    
    console.log('---');
}, 30000);

// Initial test
monitor.runTests();
