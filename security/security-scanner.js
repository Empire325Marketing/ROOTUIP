const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityScanner {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            overallScore: 0,
            vulnerabilities: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
            },
            tests: [],
            recommendations: []
        };
        
        this.baseUrl = 'http://localhost:3003';
    }
    
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }
    
    addVulnerability(severity, title, description, recommendation) {
        this.results.vulnerabilities[severity.toLowerCase()]++;
        this.results.tests.push({
            severity,
            title,
            description,
            recommendation,
            timestamp: new Date().toISOString()
        });
        
        if (!this.results.recommendations.includes(recommendation)) {
            this.results.recommendations.push(recommendation);
        }
    }
    
    async testEndpoint(endpoint, options = {}) {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3003,
                path: endpoint,
                method: options.method || 'GET',
                headers: options.headers || {}
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    statusCode: 0,
                    error: error.message
                });
            });
            
            if (options.data) {
                req.write(JSON.stringify(options.data));
            }
            
            req.end();
        });
    }
    
    async testSecurityHeaders() {
        this.log('Testing security headers...');
        
        const response = await this.testEndpoint('/auth/health');
        const headers = response.headers || {};
        
        // Check for essential security headers
        const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'strict-transport-security',
            'content-security-policy'
        ];
        
        requiredHeaders.forEach(header => {
            if (!headers[header]) {
                this.addVulnerability(
                    'MEDIUM',
                    `Missing Security Header: ${header}`,
                    `The ${header} security header is not present`,
                    `Add ${header} header to prevent security vulnerabilities`
                );
            }
        });
        
        // Check HSTS header strength
        if (headers['strict-transport-security']) {
            const hsts = headers['strict-transport-security'];
            if (!hsts.includes('max-age=') || !hsts.includes('includeSubDomains')) {
                this.addVulnerability(
                    'LOW',
                    'Weak HSTS Configuration',
                    'HSTS header could be strengthened',
                    'Include max-age and includeSubDomains in HSTS header'
                );
            }
        }
    }
    
    async testAuthenticationSecurity() {
        this.log('Testing authentication security...');
        
        // Test rate limiting on login endpoint
        const loginAttempts = [];
        for (let i = 0; i < 10; i++) {
            loginAttempts.push(this.testEndpoint('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { email: 'test@test.com', password: 'wrongpassword' }
            }));
        }
        
        const results = await Promise.all(loginAttempts);
        const rateLimited = results.some(r => r.statusCode === 429);
        
        if (!rateLimited) {
            this.addVulnerability(
                'HIGH',
                'Missing Rate Limiting',
                'Login endpoint does not implement rate limiting',
                'Implement rate limiting to prevent brute force attacks'
            );
        }
        
        // Test for information disclosure in error messages
        const badLogin = await this.testEndpoint('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { email: 'nonexistent@test.com', password: 'password123' }
        });
        
        if (badLogin.body && badLogin.body.includes('user not found')) {
            this.addVulnerability(
                'LOW',
                'Information Disclosure',
                'Login endpoint reveals whether user exists',
                'Use generic error messages that do not reveal user existence'
            );
        }
    }
    
    async testSessionSecurity() {
        this.log('Testing session security...');
        
        // First, perform a successful login
        const loginResponse = await this.testEndpoint('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { email: 'demo@rootuip.com', password: 'Demo123456' }
        });
        
        if (loginResponse.statusCode === 200) {
            try {
                const loginData = JSON.parse(loginResponse.body);
                const token = loginData.accessToken;
                
                // Test token validation
                const verifyResponse = await this.testEndpoint('/auth/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (verifyResponse.statusCode !== 200) {
                    this.addVulnerability(
                        'HIGH',
                        'Token Validation Issue',
                        'Valid token was rejected by verification endpoint',
                        'Review token validation logic'
                    );
                }
                
                // Test invalid token handling
                const invalidTokenResponse = await this.testEndpoint('/auth/verify', {
                    headers: { 'Authorization': 'Bearer invalid-token' }
                });
                
                if (invalidTokenResponse.statusCode !== 401) {
                    this.addVulnerability(
                        'MEDIUM',
                        'Improper Token Validation',
                        'Invalid tokens are not properly rejected',
                        'Ensure invalid tokens return 401 status'
                    );
                }
                
            } catch (error) {
                this.addVulnerability(
                    'LOW',
                    'JSON Parsing Error',
                    'Login response could not be parsed as JSON',
                    'Ensure consistent JSON response format'
                );
            }
        }
    }
    
    async testInputValidation() {
        this.log('Testing input validation...');
        
        // Test SQL injection attempts
        const sqlPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --"
        ];
        
        for (const payload of sqlPayloads) {
            const response = await this.testEndpoint('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { email: payload, password: 'test' }
            });
            
            // If we get a 500 error or database error, might be vulnerable
            if (response.statusCode === 500 || 
                (response.body && response.body.toLowerCase().includes('sql'))) {
                this.addVulnerability(
                    'CRITICAL',
                    'Potential SQL Injection',
                    `SQL injection payload may have caused server error: ${payload}`,
                    'Implement proper input validation and parameterized queries'
                );
            }
        }
        
        // Test XSS attempts
        const xssPayloads = [
            '<script>alert("xss")</script>',
            'javascript:alert("xss")',
            '<img src="x" onerror="alert(1)">'
        ];
        
        for (const payload of xssPayloads) {
            const response = await this.testEndpoint('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { email: payload, password: 'test' }
            });
            
            // Check if payload is reflected without encoding
            if (response.body && response.body.includes(payload)) {
                this.addVulnerability(
                    'HIGH',
                    'Potential XSS Vulnerability',
                    'User input may be reflected without proper encoding',
                    'Implement proper input sanitization and output encoding'
                );
            }
        }
    }
    
    async testAPIEndpoints() {
        this.log('Testing API endpoint security...');
        
        // Test for unauthenticated access to protected endpoints
        const protectedEndpoints = [
            '/auth/api/users',
            '/auth/api/stats',
            '/auth/api/audit-logs'
        ];
        
        for (const endpoint of protectedEndpoints) {
            const response = await this.testEndpoint(endpoint);
            
            if (response.statusCode !== 401) {
                this.addVulnerability(
                    'HIGH',
                    'Unprotected API Endpoint',
                    `Endpoint ${endpoint} accessible without authentication`,
                    'Ensure all protected endpoints require valid authentication'
                );
            }
        }
        
        // Test for HTTP methods that shouldn't be allowed
        const methodTests = ['TRACE', 'OPTIONS', 'CONNECT'];
        
        for (const method of methodTests) {
            const response = await this.testEndpoint('/auth/health', { method });
            
            if (method === 'TRACE' && response.statusCode === 200) {
                this.addVulnerability(
                    'LOW',
                    'HTTP TRACE Method Enabled',
                    'TRACE method is enabled and could lead to XST attacks',
                    'Disable TRACE method on the server'
                );
            }
        }
    }
    
    async testPasswordSecurity() {
        this.log('Testing password security...');
        
        // Test weak password acceptance
        const weakPasswords = [
            'password',
            '123456',
            'admin',
            'test'
        ];
        
        for (const password of weakPasswords) {
            const response = await this.testEndpoint('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { email: 'test@test.com', password }
            });
            
            // If we don't get an error about password strength, might be an issue
            if (response.statusCode === 200) {
                this.addVulnerability(
                    'MEDIUM',
                    'Weak Password Accepted',
                    `Weak password "${password}" was accepted`,
                    'Implement strong password policy validation'
                );
            }
        }
    }
    
    calculateOverallScore() {
        const weights = {
            critical: 10,
            high: 7,
            medium: 4,
            low: 2,
            info: 1
        };
        
        let totalDeductions = 0;
        Object.entries(this.results.vulnerabilities).forEach(([severity, count]) => {
            totalDeductions += count * weights[severity];
        });
        
        // Start with 100 and deduct points
        this.results.overallScore = Math.max(0, 100 - totalDeductions);
    }
    
    generateReport() {
        this.calculateOverallScore();
        
        const report = {
            ...this.results,
            summary: {
                totalVulnerabilities: Object.values(this.results.vulnerabilities).reduce((a, b) => a + b, 0),
                riskLevel: this.results.overallScore >= 80 ? 'LOW' : 
                          this.results.overallScore >= 60 ? 'MEDIUM' : 
                          this.results.overallScore >= 40 ? 'HIGH' : 'CRITICAL'
            }
        };
        
        return report;
    }
    
    async runAllTests() {
        this.log('Starting comprehensive security scan...');
        
        try {
            await this.testSecurityHeaders();
            await this.testAuthenticationSecurity();
            await this.testSessionSecurity();
            await this.testInputValidation();
            await this.testAPIEndpoints();
            await this.testPasswordSecurity();
            
            const report = this.generateReport();
            
            // Save report
            const reportPath = path.join(__dirname, 'reports', `security-scan-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            
            // Save latest report
            fs.writeFileSync(
                path.join(__dirname, 'reports', 'latest-security-report.json'),
                JSON.stringify(report, null, 2)
            );
            
            this.log(`Security scan completed. Overall score: ${report.overallScore}/100`);
            this.log(`Risk level: ${report.summary.riskLevel}`);
            this.log(`Total vulnerabilities: ${report.summary.totalVulnerabilities}`);
            this.log(`Report saved to: ${reportPath}`);
            
            return report;
            
        } catch (error) {
            this.log(`Error during security scan: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

// Run the scanner
if (require.main === module) {
    const scanner = new SecurityScanner();
    scanner.runAllTests().catch(console.error);
}

module.exports = SecurityScanner;
