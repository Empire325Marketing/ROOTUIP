// ROOTUIP Security & Compliance Monitoring System
// SOC 2, GDPR compliance, security incident detection and response

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class SecurityComplianceMonitoring {
    constructor() {
        this.app = express();
        this.port = process.env.SECURITY_PORT || 3015;
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/security-compliance.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Security configuration
        this.securityConfig = {
            // SOC 2 Type II requirements
            soc2: {
                accessLogging: true,
                dataEncryption: true,
                backupRetention: 90, // days
                incidentResponse: true,
                vulnerabilityScanning: true
            },
            
            // GDPR compliance
            gdpr: {
                dataRetention: 2555, // 7 years in days
                consentTracking: true,
                dataPortability: true,
                rightToErasure: true,
                dataProcessingLog: true
            },
            
            // Security thresholds
            thresholds: {
                loginAttempts: 5,
                sessionTimeout: 3600, // 1 hour
                passwordComplexity: {
                    minLength: 12,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumbers: true,
                    requireSpecialChars: true
                },
                suspiciousActivity: {
                    maxFailedLogins: 10,
                    maxApiCalls: 1000,
                    timeWindow: 300 // 5 minutes
                }
            }
        };
        
        // Compliance frameworks
        this.complianceFrameworks = {
            soc2: this.initializeSOC2Monitoring(),
            gdpr: this.initializeGDPRMonitoring(),
            iso27001: this.initializeISO27001Monitoring()
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startSecurityMonitoring();
    }
    
    setupMiddleware() {
        // Enhanced security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        }));
        
        this.app.use(express.json({ limit: '10mb' }));
        
        // Rate limiting with different tiers
        const createRateLimit = (windowMs, max, message) => rateLimit({
            windowMs,
            max,
            message,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logSecurityEvent('rate_limit_exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path
                });
                res.status(429).json({ error: message });
            }
        });
        
        // Different rate limits for different endpoints
        this.app.use('/api/auth', createRateLimit(15 * 60 * 1000, 20, 'Too many authentication attempts'));
        this.app.use('/api', createRateLimit(15 * 60 * 1000, 1000, 'Too many API requests'));
        
        // Security event logging middleware
        this.app.use((req, res, next) => {
            // Log all requests for audit trail
            this.logAuditEvent('http_request', {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString(),
                sessionId: req.sessionID,
                userId: req.user?.id
            });
            
            // Monitor for suspicious patterns
            this.detectSuspiciousActivity(req);
            
            next();
        });
        
        // Input validation and sanitization
        this.app.use((req, res, next) => {
            if (req.body) {
                req.body = this.sanitizeInput(req.body);
            }
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        
        // Security dashboard
        this.app.get('/api/security/dashboard', async (req, res) => {
            try {
                const dashboard = await this.getSecurityDashboard();
                res.json(dashboard);
            } catch (error) {
                this.logger.error('Security dashboard failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Compliance status
        this.app.get('/api/compliance/status', async (req, res) => {
            try {
                const status = await this.getComplianceStatus();
                res.json(status);
            } catch (error) {
                this.logger.error('Compliance status failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Security incidents
        this.app.get('/api/security/incidents', async (req, res) => {
            try {
                const { severity, timeframe = '7d' } = req.query;
                const incidents = await this.getSecurityIncidents(severity, timeframe);
                res.json(incidents);
            } catch (error) {
                this.logger.error('Security incidents query failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Audit logs
        this.app.get('/api/audit/logs', async (req, res) => {
            try {
                const { userId, action, timeframe = '24h' } = req.query;
                const logs = await this.getAuditLogs(userId, action, timeframe);
                res.json(logs);
            } catch (error) {
                this.logger.error('Audit logs query failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // GDPR data request
        this.app.post('/api/gdpr/data-request', async (req, res) => {
            try {
                const { userId, requestType } = req.body;
                const result = await this.processGDPRRequest(userId, requestType);
                res.json(result);
            } catch (error) {
                this.logger.error('GDPR data request failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Vulnerability scan
        this.app.post('/api/security/scan', async (req, res) => {
            try {
                const { scanType = 'basic' } = req.body;
                const result = await this.performVulnerabilityScan(scanType);
                res.json(result);
            } catch (error) {
                this.logger.error('Vulnerability scan failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Security configuration
        this.app.get('/api/security/config', async (req, res) => {
            try {
                const config = await this.getSecurityConfiguration();
                res.json(config);
            } catch (error) {
                this.logger.error('Security config failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Incident reporting
        this.app.post('/api/security/incident', async (req, res) => {
            try {
                const incidentData = req.body;
                const result = await this.reportSecurityIncident(incidentData);
                res.json(result);
            } catch (error) {
                this.logger.error('Incident reporting failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    initializeSOC2Monitoring() {
        return {
            controlObjectives: {
                CC1: 'Control Environment',
                CC2: 'Communication and Information',
                CC3: 'Risk Assessment',
                CC4: 'Monitoring Activities',
                CC5: 'Control Activities',
                CC6: 'Logical and Physical Access Controls',
                CC7: 'System Operations',
                CC8: 'Change Management',
                CC9: 'Risk Mitigation'
            },
            
            evidenceCollection: {
                accessLogs: true,
                changeManagement: true,
                incidentResponse: true,
                vulnerabilityManagement: true,
                backupVerification: true
            },
            
            requiredDocumentation: [
                'System Description',
                'Risk Assessment',
                'Incident Response Plan',
                'Access Control Procedures',
                'Change Management Process'
            ]
        };
    }
    
    initializeGDPRMonitoring() {
        return {
            dataProcessingActivities: {
                customerData: {
                    purpose: 'Service delivery',
                    legalBasis: 'Contract',
                    retention: '7 years',
                    encryption: true
                },
                employeeData: {
                    purpose: 'HR management',
                    legalBasis: 'Legitimate interest',
                    retention: '7 years',
                    encryption: true
                }
            },
            
            dataSubjectRights: [
                'Access',
                'Rectification',
                'Erasure',
                'Portability',
                'Restriction',
                'Objection'
            ],
            
            consentManagement: {
                trackingConsent: true,
                marketingConsent: true,
                analyticsConsent: true
            }
        };
    }
    
    initializeISO27001Monitoring() {
        return {
            controlCategories: {
                'A.5': 'Information Security Policies',
                'A.6': 'Organization of Information Security',
                'A.7': 'Human Resource Security',
                'A.8': 'Asset Management',
                'A.9': 'Access Control',
                'A.10': 'Cryptography',
                'A.11': 'Physical and Environmental Security',
                'A.12': 'Operations Security',
                'A.13': 'Communications Security',
                'A.14': 'System Acquisition, Development and Maintenance',
                'A.15': 'Supplier Relationships',
                'A.16': 'Information Security Incident Management',
                'A.17': 'Information Security Aspects of Business Continuity Management',
                'A.18': 'Compliance'
            }
        };
    }
    
    startSecurityMonitoring() {
        this.logger.info('Starting security and compliance monitoring');
        
        // Continuous security monitoring
        setInterval(() => {
            this.performSecurityChecks();
        }, 60000); // Every minute
        
        // Compliance assessments
        setInterval(() => {
            this.performComplianceChecks();
        }, 3600000); // Every hour
        
        // Threat intelligence updates
        setInterval(() => {
            this.updateThreatIntelligence();
        }, 3600000); // Every hour
        
        // Audit log processing
        setInterval(() => {
            this.processAuditLogs();
        }, 300000); // Every 5 minutes
        
        // Vulnerability scanning
        setInterval(() => {
            this.performVulnerabilityScan('scheduled');
        }, 86400000); // Daily
    }
    
    async performSecurityChecks() {
        try {
            const checks = [
                this.checkFailedLogins(),
                this.checkSuspiciousIPs(),
                this.checkDataAccess(),
                this.checkSystemIntegrity(),
                this.checkEncryptionStatus()
            ];
            
            const results = await Promise.all(checks);
            
            // Process results and generate alerts
            results.forEach((result, index) => {
                if (result.status === 'alert') {
                    this.generateSecurityAlert(result);
                }
            });
            
        } catch (error) {
            this.logger.error('Security checks failed:', error);
        }
    }
    
    async checkFailedLogins() {
        const query = `
            SELECT 
                ip_address,
                COUNT(*) as failed_attempts,
                MAX(created_at) as last_attempt
            FROM audit_logs 
            WHERE action = 'login_failed'
            AND created_at > NOW() - INTERVAL '5 minutes'
            GROUP BY ip_address
            HAVING COUNT(*) >= $1
        `;
        
        const result = await this.db.query(query, [this.securityConfig.thresholds.loginAttempts]);
        
        if (result.rows.length > 0) {
            return {
                status: 'alert',
                type: 'excessive_failed_logins',
                data: result.rows,
                severity: 'medium'
            };
        }
        
        return { status: 'ok', type: 'failed_logins' };
    }
    
    async checkSuspiciousIPs() {
        // Check for IPs with unusual patterns
        const query = `
            SELECT 
                ip_address,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(*) as total_requests,
                COUNT(DISTINCT path) as unique_paths
            FROM audit_logs 
            WHERE created_at > NOW() - INTERVAL '1 hour'
            GROUP BY ip_address
            HAVING COUNT(*) > $1 OR COUNT(DISTINCT user_id) > 10
        `;
        
        const result = await this.db.query(query, [this.securityConfig.thresholds.suspiciousActivity.maxApiCalls]);
        
        if (result.rows.length > 0) {
            return {
                status: 'alert',
                type: 'suspicious_ip_activity',
                data: result.rows,
                severity: 'high'
            };
        }
        
        return { status: 'ok', type: 'ip_analysis' };
    }
    
    async checkDataAccess() {
        // Monitor for unusual data access patterns
        const query = `
            SELECT 
                user_id,
                COUNT(*) as access_count,
                COUNT(DISTINCT table_name) as tables_accessed
            FROM data_access_logs 
            WHERE created_at > NOW() - INTERVAL '1 hour'
            GROUP BY user_id
            HAVING COUNT(*) > 1000 OR COUNT(DISTINCT table_name) > 50
        `;
        
        const result = await this.db.query(query);
        
        if (result.rows.length > 0) {
            return {
                status: 'alert',
                type: 'unusual_data_access',
                data: result.rows,
                severity: 'high'
            };
        }
        
        return { status: 'ok', type: 'data_access' };
    }
    
    async checkSystemIntegrity() {
        // Check for system file modifications, unauthorized processes, etc.
        const checks = {
            configFiles: await this.verifyConfigIntegrity(),
            systemProcesses: await this.verifySystemProcesses(),
            diskSpace: await this.checkDiskSpace(),
            systemLoad: await this.checkSystemLoad()
        };
        
        const alerts = Object.entries(checks).filter(([key, check]) => check.status === 'alert');
        
        if (alerts.length > 0) {
            return {
                status: 'alert',
                type: 'system_integrity',
                data: alerts,
                severity: 'medium'
            };
        }
        
        return { status: 'ok', type: 'system_integrity' };
    }
    
    async checkEncryptionStatus() {
        // Verify encryption is working properly
        const query = `
            SELECT 
                table_name,
                encryption_status,
                last_verified
            FROM encryption_status
            WHERE encryption_status = 'disabled' OR last_verified < NOW() - INTERVAL '24 hours'
        `;
        
        const result = await this.db.query(query);
        
        if (result.rows.length > 0) {
            return {
                status: 'alert',
                type: 'encryption_issues',
                data: result.rows,
                severity: 'critical'
            };
        }
        
        return { status: 'ok', type: 'encryption' };
    }
    
    async performComplianceChecks() {
        try {
            const complianceResults = {
                soc2: await this.checkSOC2Compliance(),
                gdpr: await this.checkGDPRCompliance(),
                iso27001: await this.checkISO27001Compliance()
            };
            
            // Store compliance results
            await this.storeComplianceResults(complianceResults);
            
            // Generate compliance alerts if needed
            Object.entries(complianceResults).forEach(([framework, result]) => {
                if (result.overallScore < 85) {
                    this.generateComplianceAlert(framework, result);
                }
            });
            
        } catch (error) {
            this.logger.error('Compliance checks failed:', error);
        }
    }
    
    async checkSOC2Compliance() {
        const controls = await this.assessSOC2Controls();
        
        const totalControls = Object.keys(controls).length;
        const passingControls = Object.values(controls).filter(c => c.status === 'compliant').length;
        const overallScore = (passingControls / totalControls) * 100;
        
        return {
            framework: 'SOC 2 Type II',
            overallScore: overallScore,
            controlResults: controls,
            recommendations: this.generateSOC2Recommendations(controls),
            nextAssessment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };
    }
    
    async checkGDPRCompliance() {
        const assessments = {
            dataProcessing: await this.assessDataProcessing(),
            consentManagement: await this.assessConsentManagement(),
            dataSubjectRights: await this.assessDataSubjectRights(),
            dataRetention: await this.assessDataRetention(),
            dataProtectionImpact: await this.assessDPIA()
        };
        
        const scores = Object.values(assessments).map(a => a.score);
        const overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        return {
            framework: 'GDPR',
            overallScore: overallScore,
            assessments: assessments,
            recommendations: this.generateGDPRRecommendations(assessments)
        };
    }
    
    async processGDPRRequest(userId, requestType) {
        const requestId = `gdpr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Log the request
        await this.logGDPRRequest(requestId, userId, requestType);
        
        switch (requestType) {
            case 'access':
                return await this.processDataAccessRequest(userId, requestId);
            case 'portability':
                return await this.processDataPortabilityRequest(userId, requestId);
            case 'erasure':
                return await this.processDataErasureRequest(userId, requestId);
            case 'rectification':
                return await this.processDataRectificationRequest(userId, requestId);
            default:
                throw new Error(`Unknown GDPR request type: ${requestType}`);
        }
    }
    
    async processDataAccessRequest(userId, requestId) {
        // Collect all user data across systems
        const userData = {
            personalData: await this.collectPersonalData(userId),
            activityLogs: await this.collectActivityLogs(userId),
            preferences: await this.collectUserPreferences(userId),
            communications: await this.collectCommunications(userId)
        };
        
        // Generate data export
        const exportData = {
            requestId: requestId,
            userId: userId,
            requestDate: new Date().toISOString(),
            data: userData,
            format: 'JSON'
        };
        
        // Store export for download
        await this.storeDataExport(requestId, exportData);
        
        return {
            requestId: requestId,
            status: 'completed',
            downloadUrl: `/api/gdpr/download/${requestId}`,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };
    }
    
    async processDataErasureRequest(userId, requestId) {
        // Verify erasure is legally permissible
        const erasureCheck = await this.verifyErasurePermissibility(userId);
        
        if (!erasureCheck.permitted) {
            return {
                requestId: requestId,
                status: 'rejected',
                reason: erasureCheck.reason
            };
        }
        
        // Perform data erasure
        const erasureResults = await this.performDataErasure(userId);
        
        return {
            requestId: requestId,
            status: 'completed',
            erasureResults: erasureResults,
            completedAt: new Date().toISOString()
        };
    }
    
    async performVulnerabilityScan(scanType) {
        const scanId = `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.logger.info(`Starting vulnerability scan: ${scanId} (${scanType})`);
        
        const scanResults = {
            scanId: scanId,
            scanType: scanType,
            startTime: new Date().toISOString(),
            status: 'running',
            findings: []
        };
        
        try {
            // Perform different types of scans
            const scans = [];
            
            if (scanType === 'basic' || scanType === 'full') {
                scans.push(this.scanDependencies());
                scans.push(this.scanConfigurations());
                scans.push(this.scanNetwork());
            }
            
            if (scanType === 'full') {
                scans.push(this.scanCode());
                scans.push(this.scanInfrastructure());
            }
            
            const results = await Promise.all(scans);
            scanResults.findings = results.flat();
            scanResults.status = 'completed';
            scanResults.endTime = new Date().toISOString();
            
            // Store scan results
            await this.storeScanResults(scanResults);
            
            // Generate alerts for critical findings
            const criticalFindings = scanResults.findings.filter(f => f.severity === 'critical');
            if (criticalFindings.length > 0) {
                this.generateSecurityAlert({
                    type: 'critical_vulnerabilities',
                    data: criticalFindings,
                    severity: 'critical'
                });
            }
            
        } catch (error) {
            scanResults.status = 'failed';
            scanResults.error = error.message;
            this.logger.error(`Vulnerability scan failed: ${scanId}`, error);
        }
        
        return scanResults;
    }
    
    async scanDependencies() {
        // Scan for vulnerable dependencies
        const vulnerabilities = [];
        
        // This would integrate with tools like npm audit, Snyk, etc.
        // For demo purposes, we'll simulate some findings
        
        return [
            {
                type: 'dependency',
                severity: 'medium',
                package: 'example-package',
                version: '1.0.0',
                vulnerability: 'CVE-2024-12345',
                description: 'Cross-site scripting vulnerability',
                recommendation: 'Update to version 1.0.1 or later'
            }
        ];
    }
    
    async scanConfigurations() {
        // Scan system configurations for security issues
        const findings = [];
        
        // Check SSL/TLS configuration
        // Check database security settings
        // Check access controls
        // etc.
        
        return findings;
    }
    
    detectSuspiciousActivity(req) {
        const patterns = [
            this.detectSQLInjection(req),
            this.detectXSSAttempts(req),
            this.detectBruteForce(req),
            this.detectUnusualUserAgent(req)
        ];
        
        patterns.forEach(pattern => {
            if (pattern.detected) {
                this.logSecurityEvent('suspicious_activity', {
                    type: pattern.type,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path,
                    details: pattern.details
                });
            }
        });
    }
    
    detectSQLInjection(req) {
        const sqlPatterns = [
            /(\bUNION\b.*\bSELECT\b)/i,
            /(\bSELECT\b.*\bFROM\b.*\bWHERE\b)/i,
            /(\bINSERT\b.*\bINTO\b)/i,
            /(\bDELETE\b.*\bFROM\b)/i,
            /(\bDROP\b.*\bTABLE\b)/i,
            /('.*OR.*'.*=.*')/i
        ];
        
        const inputStr = JSON.stringify(req.body) + req.url;
        
        for (const pattern of sqlPatterns) {
            if (pattern.test(inputStr)) {
                return {
                    detected: true,
                    type: 'sql_injection',
                    details: { pattern: pattern.source, input: inputStr.substring(0, 100) }
                };
            }
        }
        
        return { detected: false };
    }
    
    detectXSSAttempts(req) {
        const xssPatterns = [
            /<script.*>.*<\/script>/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe.*>/i,
            /eval\s*\(/i
        ];
        
        const inputStr = JSON.stringify(req.body) + req.url;
        
        for (const pattern of xssPatterns) {
            if (pattern.test(inputStr)) {
                return {
                    detected: true,
                    type: 'xss_attempt',
                    details: { pattern: pattern.source, input: inputStr.substring(0, 100) }
                };
            }
        }
        
        return { detected: false };
    }
    
    sanitizeInput(input) {
        if (typeof input === 'string') {
            // Remove potentially dangerous characters
            return input
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        
        return input;
    }
    
    async logAuditEvent(action, details) {
        const auditEvent = {
            id: crypto.randomUUID(),
            action: action,
            details: details,
            timestamp: new Date().toISOString(),
            hash: this.generateEventHash(action, details)
        };
        
        // Store in database
        await this.storeAuditEvent(auditEvent);
        
        // Store in Redis for real-time monitoring
        await this.redis.lpush('audit_events', JSON.stringify(auditEvent));
        await this.redis.ltrim('audit_events', 0, 9999); // Keep last 10k events
    }
    
    async logSecurityEvent(eventType, details) {
        const securityEvent = {
            id: crypto.randomUUID(),
            type: eventType,
            severity: this.calculateEventSeverity(eventType, details),
            details: details,
            timestamp: new Date().toISOString()
        };
        
        // Store security event
        await this.storeSecurityEvent(securityEvent);
        
        // Real-time alert if critical
        if (securityEvent.severity === 'critical') {
            await this.sendImmediateAlert(securityEvent);
        }
        
        this.logger.warn('Security event detected', securityEvent);
    }
    
    generateEventHash(action, details) {
        const data = JSON.stringify({ action, details });
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    calculateEventSeverity(eventType, details) {
        const severityMap = {
            'rate_limit_exceeded': 'low',
            'suspicious_activity': 'medium',
            'sql_injection': 'high',
            'xss_attempt': 'high',
            'excessive_failed_logins': 'medium',
            'suspicious_ip_activity': 'high',
            'unusual_data_access': 'high',
            'system_integrity': 'medium',
            'encryption_issues': 'critical',
            'critical_vulnerabilities': 'critical'
        };
        
        return severityMap[eventType] || 'medium';
    }
    
    async generateSecurityAlert(alertData) {
        const alert = {
            id: crypto.randomUUID(),
            type: alertData.type,
            severity: alertData.severity,
            message: this.generateAlertMessage(alertData),
            data: alertData.data,
            timestamp: new Date().toISOString(),
            status: 'open'
        };
        
        // Store alert
        await this.storeSecurityAlert(alert);
        
        // Send notifications
        await this.sendSecurityNotifications(alert);
        
        this.logger.error('Security alert generated', alert);
        
        return alert;
    }
    
    generateAlertMessage(alertData) {
        const messages = {
            'excessive_failed_logins': `Multiple failed login attempts detected from ${alertData.data.length} IP addresses`,
            'suspicious_ip_activity': `Suspicious activity detected from ${alertData.data.length} IP addresses`,
            'unusual_data_access': `Unusual data access patterns detected for ${alertData.data.length} users`,
            'encryption_issues': `Encryption issues detected in ${alertData.data.length} locations`,
            'critical_vulnerabilities': `${alertData.data.length} critical vulnerabilities discovered`
        };
        
        return messages[alertData.type] || `Security alert: ${alertData.type}`;
    }
    
    async getSecurityDashboard() {
        const [
            incidents,
            compliance,
            vulnerabilities,
            threatIntel
        ] = await Promise.all([
            this.getRecentIncidents(),
            this.getComplianceOverview(),
            this.getVulnerabilityOverview(),
            this.getThreatIntelligence()
        ]);
        
        return {
            incidents,
            compliance,
            vulnerabilities,
            threatIntel,
            timestamp: new Date().toISOString()
        };
    }
    
    start() {
        this.server = this.app.listen(this.port, () => {
            this.logger.info(`Security & Compliance Monitoring running on port ${this.port}`);
            console.log(`🔒 ROOTUIP Security & Compliance Monitoring`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Security Dashboard: http://localhost:${this.port}/api/security/dashboard`);
            console.log(`   Compliance Status: http://localhost:${this.port}/api/compliance/status`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down security monitoring...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Database schema for security and compliance
const createSecurityTables = `
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        action VARCHAR(100) NOT NULL,
        user_id UUID,
        ip_address INET,
        user_agent TEXT,
        path VARCHAR(500),
        method VARCHAR(10),
        status_code INTEGER,
        details JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        hash VARCHAR(64)
    );
    
    CREATE TABLE IF NOT EXISTS security_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS security_alerts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        status VARCHAR(20) DEFAULT 'open',
        acknowledged_by UUID,
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS compliance_assessments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        framework VARCHAR(50) NOT NULL,
        overall_score DECIMAL(5,2),
        assessment_data JSONB,
        assessor VARCHAR(255),
        assessment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS vulnerability_scans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        scan_id VARCHAR(100) UNIQUE NOT NULL,
        scan_type VARCHAR(50),
        status VARCHAR(20),
        findings JSONB,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS gdpr_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        request_id VARCHAR(100) UNIQUE NOT NULL,
        user_id UUID NOT NULL,
        request_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        request_data JSONB,
        response_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address);
    CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_compliance_framework ON compliance_assessments(framework);
    CREATE INDEX IF NOT EXISTS idx_vuln_scans_status ON vulnerability_scans(status);
    CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id);
`;

// Start security monitoring if called directly
if (require.main === module) {
    const securityMonitoring = new SecurityComplianceMonitoring();
    
    // Initialize database schema
    securityMonitoring.db.query(createSecurityTables).then(() => {
        securityMonitoring.start();
    }).catch(error => {
        console.error('Failed to initialize security monitoring:', error);
        process.exit(1);
    });
}

module.exports = SecurityComplianceMonitoring;