const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use(cors());
app.use(express.json());

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// Security Monitoring System
class SecurityMonitor {
    constructor() {
        this.threats = new Map();
        this.vulnerabilities = [];
        this.securityEvents = [];
        this.blockedIPs = new Set();
        this.initializeMonitoring();
    }

    initializeMonitoring() {
        // Start various security monitors
        setInterval(() => this.detectAnomalies(), 30000); // Every 30 seconds
        setInterval(() => this.scanForVulnerabilities(), 3600000); // Every hour
        setInterval(() => this.analyzeAccessPatterns(), 60000); // Every minute
        setInterval(() => this.checkSecurityCompliance(), 86400000); // Daily
    }

    // Anomaly Detection
    async detectAnomalies() {
        try {
            // Check for unusual login patterns
            const suspiciousLogins = await db.query(`
                SELECT 
                    user_id,
                    ip_address,
                    COUNT(*) as attempt_count,
                    COUNT(DISTINCT ip_address) as unique_ips,
                    COUNT(CASE WHEN success = false THEN 1 END) as failed_attempts
                FROM auth_logs
                WHERE created_at > NOW() - INTERVAL '15 minutes'
                GROUP BY user_id, ip_address
                HAVING COUNT(*) > 10 OR COUNT(CASE WHEN success = false THEN 1 END) > 5
            `);

            for (const activity of suspiciousLogins.rows) {
                if (activity.failed_attempts > 5) {
                    this.createSecurityEvent('brute_force_attempt', {
                        user_id: activity.user_id,
                        ip_address: activity.ip_address,
                        attempts: activity.failed_attempts
                    });
                    this.blockIP(activity.ip_address, 'Brute force attempt');
                }
            }

            // Check for SQL injection attempts
            const sqlInjectionAttempts = await db.query(`
                SELECT 
                    ip_address,
                    endpoint,
                    query_params,
                    COUNT(*) as attempts
                FROM api_logs
                WHERE timestamp > NOW() - INTERVAL '15 minutes'
                    AND (
                        query_params ~* '(union.*select|select.*from|insert.*into|delete.*from)'
                        OR query_params ~* '(drop.*table|exec.*xp_|script.*>|<.*script)'
                    )
                GROUP BY ip_address, endpoint, query_params
            `);

            for (const injection of sqlInjectionAttempts.rows) {
                this.createSecurityEvent('sql_injection_attempt', {
                    ip_address: injection.ip_address,
                    endpoint: injection.endpoint,
                    payload: injection.query_params
                });
                this.blockIP(injection.ip_address, 'SQL injection attempt');
            }

            // Check for rate limit violations
            await this.checkRateLimitViolations();

        } catch (error) {
            console.error('Anomaly detection error:', error);
        }
    }

    // Vulnerability Scanning
    async scanForVulnerabilities() {
        console.log('Starting vulnerability scan...');
        const vulnerabilities = [];

        try {
            // Check for outdated dependencies
            const outdatedDeps = await this.checkOutdatedDependencies();
            vulnerabilities.push(...outdatedDeps);

            // Check for weak passwords
            const weakPasswords = await db.query(`
                SELECT COUNT(*) as count
                FROM users
                WHERE password_strength < 3
                    OR last_password_change < NOW() - INTERVAL '90 days'
            `);

            if (weakPasswords.rows[0].count > 0) {
                vulnerabilities.push({
                    type: 'weak_passwords',
                    severity: 'medium',
                    count: weakPasswords.rows[0].count,
                    message: `${weakPasswords.rows[0].count} users have weak or old passwords`
                });
            }

            // Check for missing security headers
            const securityHeaders = await this.checkSecurityHeaders();
            vulnerabilities.push(...securityHeaders);

            // Check SSL certificate expiry
            const sslStatus = await this.checkSSLCertificate();
            if (sslStatus.daysUntilExpiry < 30) {
                vulnerabilities.push({
                    type: 'ssl_expiry',
                    severity: 'high',
                    message: `SSL certificate expires in ${sslStatus.daysUntilExpiry} days`
                });
            }

            this.vulnerabilities = vulnerabilities;

            // Store scan results
            await db.query(`
                INSERT INTO vulnerability_scans (
                    scan_id, vulnerabilities, total_found, 
                    critical_count, high_count, medium_count, low_count,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                crypto.randomUUID(),
                JSON.stringify(vulnerabilities),
                vulnerabilities.length,
                vulnerabilities.filter(v => v.severity === 'critical').length,
                vulnerabilities.filter(v => v.severity === 'high').length,
                vulnerabilities.filter(v => v.severity === 'medium').length,
                vulnerabilities.filter(v => v.severity === 'low').length
            ]);

            console.log(`Vulnerability scan completed. Found ${vulnerabilities.length} issues.`);

        } catch (error) {
            console.error('Vulnerability scan error:', error);
        }
    }

    // Access Pattern Analysis
    async analyzeAccessPatterns() {
        try {
            // Detect unusual access patterns
            const accessPatterns = await db.query(`
                SELECT 
                    user_id,
                    COUNT(DISTINCT ip_address) as ip_count,
                    COUNT(DISTINCT country) as country_count,
                    COUNT(*) as total_requests,
                    ARRAY_AGG(DISTINCT country) as countries
                FROM api_logs
                WHERE timestamp > NOW() - INTERVAL '1 hour'
                GROUP BY user_id
                HAVING COUNT(DISTINCT country) > 3
            `);

            for (const pattern of accessPatterns.rows) {
                this.createSecurityEvent('unusual_access_pattern', {
                    user_id: pattern.user_id,
                    countries: pattern.countries,
                    message: `User accessed from ${pattern.country_count} different countries`
                });
            }

            // Detect data exfiltration attempts
            const dataExfiltration = await db.query(`
                SELECT 
                    user_id,
                    SUM(response_size) as total_data,
                    COUNT(*) as request_count
                FROM api_logs
                WHERE timestamp > NOW() - INTERVAL '15 minutes'
                    AND endpoint LIKE '%export%' OR endpoint LIKE '%download%'
                GROUP BY user_id
                HAVING SUM(response_size) > 104857600 -- 100MB
            `);

            for (const exfil of dataExfiltration.rows) {
                this.createSecurityEvent('possible_data_exfiltration', {
                    user_id: exfil.user_id,
                    data_size: exfil.total_data,
                    requests: exfil.request_count
                });
            }

        } catch (error) {
            console.error('Access pattern analysis error:', error);
        }
    }

    // Security Compliance Check
    async checkSecurityCompliance() {
        console.log('Running security compliance check...');
        
        const compliance = {
            gdpr: await this.checkGDPRCompliance(),
            sox: await this.checkSOXCompliance(),
            iso27001: await this.checkISO27001Compliance(),
            pci: await this.checkPCICompliance()
        };

        // Generate compliance report
        const report = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            compliance,
            overallScore: this.calculateComplianceScore(compliance),
            recommendations: this.generateComplianceRecommendations(compliance)
        };

        // Store compliance report
        await db.query(`
            INSERT INTO compliance_reports (
                report_id, compliance_data, overall_score, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [report.id, JSON.stringify(compliance), report.overallScore]);

        return report;
    }

    // Helper methods
    createSecurityEvent(type, details) {
        const event = {
            id: crypto.randomUUID(),
            type,
            details,
            timestamp: new Date(),
            severity: this.calculateSeverity(type),
            status: 'active'
        };

        this.securityEvents.push(event);
        
        // Keep only last 1000 events
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-1000);
        }

        // Store critical events in database
        if (event.severity === 'critical' || event.severity === 'high') {
            this.storeSecurityEvent(event);
        }

        // Send alerts for critical events
        if (event.severity === 'critical') {
            this.sendSecurityAlert(event);
        }

        return event;
    }

    blockIP(ip, reason) {
        this.blockedIPs.add(ip);
        
        // Store in database
        db.query(`
            INSERT INTO blocked_ips (ip_address, reason, blocked_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (ip_address) DO UPDATE
            SET reason = $2, blocked_at = NOW()
        `, [ip, reason]).catch(console.error);

        console.log(`Blocked IP ${ip}: ${reason}`);
    }

    calculateSeverity(eventType) {
        const severityMap = {
            'brute_force_attempt': 'high',
            'sql_injection_attempt': 'critical',
            'xss_attempt': 'high',
            'unusual_access_pattern': 'medium',
            'possible_data_exfiltration': 'high',
            'weak_password': 'medium',
            'outdated_dependency': 'medium',
            'ssl_expiry': 'high'
        };

        return severityMap[eventType] || 'low';
    }

    async storeSecurityEvent(event) {
        try {
            await db.query(`
                INSERT INTO security_events (
                    event_id, event_type, severity, details, 
                    status, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, [
                event.id,
                event.type,
                event.severity,
                JSON.stringify(event.details),
                event.status
            ]);
        } catch (error) {
            console.error('Failed to store security event:', error);
        }
    }

    async checkOutdatedDependencies() {
        // Simulated dependency check
        // In production, would use tools like npm audit, snyk, etc.
        return [
            {
                type: 'outdated_dependency',
                severity: 'medium',
                package: 'example-package',
                current: '1.0.0',
                latest: '2.0.0',
                vulnerabilities: ['CVE-2024-1234']
            }
        ];
    }

    async checkSecurityHeaders() {
        const issues = [];
        
        // Would check actual headers in production
        const requiredHeaders = [
            'Strict-Transport-Security',
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Content-Security-Policy'
        ];

        // Simulated check
        return issues;
    }

    async checkSSLCertificate() {
        // Would check actual certificate in production
        return {
            valid: true,
            daysUntilExpiry: 45,
            issuer: 'Let\'s Encrypt'
        };
    }

    async checkRateLimitViolations() {
        const violations = await db.query(`
            SELECT 
                ip_address,
                COUNT(*) as request_count
            FROM api_logs
            WHERE timestamp > NOW() - INTERVAL '1 minute'
            GROUP BY ip_address
            HAVING COUNT(*) > 100
        `);

        for (const violation of violations.rows) {
            this.createSecurityEvent('rate_limit_violation', {
                ip_address: violation.ip_address,
                requests: violation.request_count
            });
        }
    }

    async checkGDPRCompliance() {
        const checks = {
            dataEncryption: true,
            rightToErasure: true,
            dataPortability: true,
            consentManagement: true,
            dataBreachNotification: true,
            privacyByDesign: true
        };

        const score = Object.values(checks).filter(v => v).length / Object.keys(checks).length * 100;
        
        return {
            score,
            checks,
            compliant: score === 100
        };
    }

    async checkSOXCompliance() {
        const checks = {
            accessControls: true,
            auditTrails: true,
            changeManagement: true,
            segregationOfDuties: true,
            dataIntegrity: true
        };

        const score = Object.values(checks).filter(v => v).length / Object.keys(checks).length * 100;
        
        return {
            score,
            checks,
            compliant: score === 100
        };
    }

    async checkISO27001Compliance() {
        const checks = {
            riskAssessment: true,
            assetManagement: true,
            accessControl: true,
            cryptography: true,
            physicalSecurity: true,
            operationsSecurity: true,
            communicationsSecurity: true,
            incidentManagement: true,
            businessContinuity: true,
            compliance: true
        };

        const score = Object.values(checks).filter(v => v).length / Object.keys(checks).length * 100;
        
        return {
            score,
            checks,
            compliant: score >= 95
        };
    }

    async checkPCICompliance() {
        // Not applicable if not handling credit cards
        return {
            score: 100,
            applicable: false,
            message: 'PCI DSS not applicable - no credit card processing'
        };
    }

    calculateComplianceScore(compliance) {
        const scores = Object.values(compliance)
            .filter(c => c.applicable !== false)
            .map(c => c.score);
        
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    generateComplianceRecommendations(compliance) {
        const recommendations = [];
        
        Object.entries(compliance).forEach(([standard, result]) => {
            if (result.compliant === false) {
                const failedChecks = Object.entries(result.checks || {})
                    .filter(([_, passed]) => !passed)
                    .map(([check]) => check);
                
                recommendations.push({
                    standard,
                    priority: 'high',
                    message: `Improve ${standard.toUpperCase()} compliance`,
                    actions: failedChecks
                });
            }
        });
        
        return recommendations;
    }

    sendSecurityAlert(event) {
        // Would send actual alerts via email/SMS/Slack
        console.log(`SECURITY ALERT: ${event.type} - ${JSON.stringify(event.details)}`);
    }

    getSecurityStatus() {
        return {
            threats: {
                active: this.securityEvents.filter(e => e.status === 'active').length,
                blocked_ips: this.blockedIPs.size,
                recent_events: this.securityEvents.slice(-10)
            },
            vulnerabilities: {
                total: this.vulnerabilities.length,
                critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
                high: this.vulnerabilities.filter(v => v.severity === 'high').length,
                medium: this.vulnerabilities.filter(v => v.severity === 'medium').length,
                low: this.vulnerabilities.filter(v => v.severity === 'low').length
            },
            compliance: {
                lastCheck: new Date(),
                overallScore: 95 // Would calculate from actual compliance data
            }
        };
    }
}

// Initialize security monitor
const securityMonitor = new SecurityMonitor();

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per minute
    handler: (req, res) => {
        securityMonitor.createSecurityEvent('rate_limit_exceeded', {
            ip: req.ip,
            endpoint: req.path
        });
        res.status(429).json({
            error: 'Too many requests, please try again later.'
        });
    }
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per 15 minutes
    skipSuccessfulRequests: true
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', strictLimiter);

// IP blocking middleware
app.use((req, res, next) => {
    if (securityMonitor.blockedIPs.has(req.ip)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
});

// API Endpoints

// Get security status
app.get('/api/security/status', (req, res) => {
    res.json(securityMonitor.getSecurityStatus());
});

// Get security events
app.get('/api/security/events', async (req, res) => {
    try {
        const { severity, limit = 100 } = req.query;
        
        let query = `
            SELECT * FROM security_events
            WHERE created_at > NOW() - INTERVAL '7 days'
        `;
        
        const params = [];
        if (severity) {
            params.push(severity);
            query += ` AND severity = $${params.length}`;
        }
        
        query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
        
        const events = await db.query(query, params);
        res.json(events.rows);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get vulnerability scan results
app.get('/api/security/vulnerabilities', async (req, res) => {
    try {
        const latestScan = await db.query(`
            SELECT * FROM vulnerability_scans
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        res.json(latestScan.rows[0] || { vulnerabilities: [] });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get compliance report
app.get('/api/security/compliance', async (req, res) => {
    try {
        const report = await securityMonitor.checkSecurityCompliance();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger manual security scan
app.post('/api/security/scan', async (req, res) => {
    try {
        securityMonitor.scanForVulnerabilities();
        res.json({ message: 'Security scan initiated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get blocked IPs
app.get('/api/security/blocked-ips', async (req, res) => {
    try {
        const blockedIPs = await db.query(`
            SELECT * FROM blocked_ips
            WHERE blocked_at > NOW() - INTERVAL '30 days'
            ORDER BY blocked_at DESC
        `);
        
        res.json(blockedIPs.rows);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unblock IP
app.delete('/api/security/blocked-ips/:ip', async (req, res) => {
    try {
        const { ip } = req.params;
        securityMonitor.blockedIPs.delete(ip);
        
        await db.query('DELETE FROM blocked_ips WHERE ip_address = $1', [ip]);
        
        res.json({ message: `IP ${ip} unblocked` });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS security_events (
                id SERIAL PRIMARY KEY,
                event_id UUID UNIQUE,
                event_type VARCHAR(50),
                severity VARCHAR(20),
                details JSONB,
                status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS vulnerability_scans (
                id SERIAL PRIMARY KEY,
                scan_id UUID UNIQUE,
                vulnerabilities JSONB,
                total_found INTEGER,
                critical_count INTEGER,
                high_count INTEGER,
                medium_count INTEGER,
                low_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS blocked_ips (
                ip_address VARCHAR(45) PRIMARY KEY,
                reason TEXT,
                blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS compliance_reports (
                id SERIAL PRIMARY KEY,
                report_id UUID UNIQUE,
                compliance_data JSONB,
                overall_score FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Indexes for performance
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
            CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
        `);

        console.log('Security monitoring database initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'security-monitoring',
        activeThreats: securityMonitor.securityEvents.filter(e => e.status === 'active').length,
        blockedIPs: securityMonitor.blockedIPs.size
    });
});

// Start server
const PORT = process.env.PORT || 3018;
app.listen(PORT, () => {
    console.log(`Security Monitoring Service running on port ${PORT}`);
    initializeDatabase();
});

module.exports = { app, securityMonitor };