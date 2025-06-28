const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const winston = require('winston');

class ComplianceReporter {
    constructor(dbConfig, logger) {
        this.pool = new Pool(dbConfig);
        this.logger = logger || winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            transports: [new winston.transports.Console()]
        });
        
        // Compliance frameworks
        this.frameworks = {
            SOC2: {
                name: 'SOC 2 Type II',
                controls: [
                    'CC6.1', 'CC6.2', 'CC6.3', 'CC6.6', 'CC6.7', 'CC6.8',
                    'CC7.1', 'CC7.2', 'CC7.3', 'CC7.4', 'CC7.5',
                    'CC8.1', 'CC9.1', 'CC9.2'
                ]
            },
            ISO27001: {
                name: 'ISO 27001:2013',
                controls: [
                    'A.9.1', 'A.9.2', 'A.9.3', 'A.9.4',
                    'A.12.1', 'A.12.2', 'A.12.3', 'A.12.4',
                    'A.18.1', 'A.18.2'
                ]
            },
            GDPR: {
                name: 'GDPR',
                articles: ['25', '32', '33', '34']
            },
            HIPAA: {
                name: 'HIPAA',
                safeguards: ['Administrative', 'Physical', 'Technical']
            }
        };
    }

    async generateComplianceReport(companyId, framework = 'SOC2', options = {}) {
        try {
            const startDate = options.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const endDate = options.endDate || new Date();
            
            // Gather compliance data
            const [
                userMetrics,
                authMetrics,
                securityEvents,
                accessControls,
                auditTrail,
                policyCompliance,
                incidentMetrics
            ] = await Promise.all([
                this.getUserMetrics(companyId, startDate, endDate),
                this.getAuthenticationMetrics(companyId, startDate, endDate),
                this.getSecurityEvents(companyId, startDate, endDate),
                this.getAccessControlMetrics(companyId),
                this.getAuditTrailSummary(companyId, startDate, endDate),
                this.getPolicyCompliance(companyId),
                this.getIncidentMetrics(companyId, startDate, endDate)
            ]);

            const reportData = {
                company: await this.getCompanyInfo(companyId),
                reportPeriod: { startDate, endDate },
                framework: this.frameworks[framework],
                metrics: {
                    users: userMetrics,
                    authentication: authMetrics,
                    security: securityEvents,
                    access: accessControls,
                    audit: auditTrail,
                    policy: policyCompliance,
                    incidents: incidentMetrics
                },
                controlsAssessment: await this.assessControls(companyId, framework),
                recommendations: this.generateRecommendations(userMetrics, authMetrics, securityEvents),
                attestation: this.generateAttestation(framework)
            };

            // Generate report in requested format
            if (options.format === 'pdf') {
                return await this.generatePDFReport(reportData);
            } else {
                return this.generateJSONReport(reportData);
            }

        } catch (error) {
            this.logger.error('Failed to generate compliance report', {
                error: error.message,
                companyId,
                framework
            });
            throw error;
        }
    }

    async getUserMetrics(companyId, startDate, endDate) {
        const queries = {
            totalUsers: `
                SELECT COUNT(*) as count 
                FROM users 
                WHERE company_id = $1 AND deleted_at IS NULL
            `,
            activeUsers: `
                SELECT COUNT(DISTINCT user_id) as count 
                FROM sessions 
                WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)
                AND created_at BETWEEN $2 AND $3
            `,
            mfaEnabled: `
                SELECT COUNT(*) as count 
                FROM users 
                WHERE company_id = $1 AND mfa_enabled = true AND deleted_at IS NULL
            `,
            privilegedUsers: `
                SELECT COUNT(*) as count 
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.company_id = $1 
                AND r.name IN ('admin', 'security_admin')
                AND u.deleted_at IS NULL
            `,
            dormantAccounts: `
                SELECT COUNT(*) as count 
                FROM users 
                WHERE company_id = $1 
                AND (last_login_at < $2 OR last_login_at IS NULL)
                AND deleted_at IS NULL
            `
        };

        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.pool.query(query, 
                key === 'dormantAccounts' 
                    ? [companyId, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)]
                    : key === 'activeUsers'
                    ? [companyId, startDate, endDate]
                    : [companyId]
            );
            results[key] = parseInt(result.rows[0].count);
        }

        results.mfaAdoptionRate = results.totalUsers > 0 
            ? ((results.mfaEnabled / results.totalUsers) * 100).toFixed(2) + '%'
            : '0%';

        return results;
    }

    async getAuthenticationMetrics(companyId, startDate, endDate) {
        const queries = {
            totalLogins: `
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE company_id = $1 
                AND action = 'LOGIN_SUCCESS'
                AND created_at BETWEEN $2 AND $3
            `,
            failedLogins: `
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE company_id = $1 
                AND action IN ('LOGIN_FAILED', 'LOGIN_LOCKED')
                AND created_at BETWEEN $2 AND $3
            `,
            mfaUsage: `
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE company_id = $1 
                AND action = 'MFA_VERIFIED'
                AND created_at BETWEEN $2 AND $3
            `,
            passwordResets: `
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE company_id = $1 
                AND action = 'PASSWORD_RESET'
                AND created_at BETWEEN $2 AND $3
            `,
            sessionDuration: `
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (expires_at - created_at))/3600) as avg_hours,
                    MAX(EXTRACT(EPOCH FROM (expires_at - created_at))/3600) as max_hours
                FROM sessions
                WHERE user_id IN (SELECT id FROM users WHERE company_id = $1)
                AND created_at BETWEEN $2 AND $3
            `
        };

        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.pool.query(query, [companyId, startDate, endDate]);
            
            if (key === 'sessionDuration') {
                results[key] = {
                    average: parseFloat(result.rows[0].avg_hours || 0).toFixed(2) + ' hours',
                    maximum: parseFloat(result.rows[0].max_hours || 0).toFixed(2) + ' hours'
                };
            } else {
                results[key] = parseInt(result.rows[0].count);
            }
        }

        results.failureRate = results.totalLogins > 0
            ? ((results.failedLogins / (results.totalLogins + results.failedLogins)) * 100).toFixed(2) + '%'
            : '0%';

        return results;
    }

    async getSecurityEvents(companyId, startDate, endDate) {
        const query = `
            SELECT 
                action,
                COUNT(*) as count,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT ip_address) as unique_ips
            FROM audit_logs
            WHERE company_id = $1 
            AND created_at BETWEEN $2 AND $3
            AND action IN (
                'SUSPICIOUS_LOGIN',
                'ACCOUNT_LOCKED',
                'PRIVILEGE_ESCALATION',
                'API_RATE_LIMIT_EXCEEDED',
                'INVALID_TOKEN_ATTEMPT',
                'MFA_BYPASS_ATTEMPT'
            )
            GROUP BY action
            ORDER BY count DESC
        `;

        const result = await this.pool.query(query, [companyId, startDate, endDate]);
        
        return {
            events: result.rows,
            totalSecurityEvents: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
            uniqueUsersAffected: new Set(result.rows.flatMap(row => row.unique_users)).size,
            topEvents: result.rows.slice(0, 5)
        };
    }

    async getAccessControlMetrics(companyId) {
        const queries = {
            roleDistribution: `
                SELECT 
                    r.name as role_name,
                    COUNT(u.id) as user_count,
                    r.permissions
                FROM roles r
                LEFT JOIN users u ON u.role_id = r.id AND u.deleted_at IS NULL
                WHERE r.company_id = $1
                GROUP BY r.id, r.name, r.permissions
                ORDER BY user_count DESC
            `,
            apiKeyUsage: `
                SELECT 
                    COUNT(*) as total_keys,
                    COUNT(CASE WHEN is_active THEN 1 END) as active_keys,
                    COUNT(CASE WHEN last_used_at > NOW() - INTERVAL '30 days' THEN 1 END) as recently_used,
                    COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired
                FROM api_keys
                WHERE company_id = $1
            `,
            permissionAudit: `
                SELECT 
                    jsonb_object_keys(permissions) as permission_category,
                    COUNT(*) as roles_with_permission
                FROM roles
                WHERE company_id = $1
                GROUP BY jsonb_object_keys(permissions)
            `
        };

        const results = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.pool.query(query, [companyId]);
            results[key] = result.rows;
        }

        return results;
    }

    async getAuditTrailSummary(companyId, startDate, endDate) {
        const query = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total_events,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT action) as unique_actions,
                COUNT(DISTINCT ip_address) as unique_ips
            FROM audit_logs
            WHERE company_id = $1 
            AND created_at BETWEEN $2 AND $3
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;

        const result = await this.pool.query(query, [companyId, startDate, endDate]);
        
        const totalEvents = result.rows.reduce((sum, row) => sum + parseInt(row.total_events), 0);
        const avgEventsPerDay = totalEvents / Math.max(result.rows.length, 1);

        return {
            dailySummary: result.rows.slice(0, 30), // Last 30 days
            totalEvents,
            averageEventsPerDay: Math.round(avgEventsPerDay),
            coverage: {
                daysWithLogs: result.rows.length,
                totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
            }
        };
    }

    async getPolicyCompliance(companyId) {
        const policyQuery = `
            SELECT * FROM password_policies WHERE company_id = $1
        `;
        
        const complianceQuery = `
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN LENGTH(password_hash) > 0 THEN 1 END) as has_password,
                COUNT(CASE WHEN password_changed_at > NOW() - INTERVAL '90 days' THEN 1 END) as recent_password,
                COUNT(CASE WHEN mfa_enabled THEN 1 END) as mfa_enabled,
                COUNT(CASE WHEN is_verified THEN 1 END) as verified_users
            FROM users
            WHERE company_id = $1 AND deleted_at IS NULL
        `;

        const [policyResult, complianceResult] = await Promise.all([
            this.pool.query(policyQuery, [companyId]),
            this.pool.query(complianceQuery, [companyId])
        ]);

        const policy = policyResult.rows[0] || {};
        const compliance = complianceResult.rows[0];

        return {
            passwordPolicy: {
                configured: !!policyResult.rows[0],
                minLength: policy.min_length || 8,
                complexity: {
                    uppercase: policy.require_uppercase || false,
                    lowercase: policy.require_lowercase || false,
                    numbers: policy.require_numbers || false,
                    special: policy.require_special || false
                },
                rotation: {
                    maxAge: policy.max_age_days || 90,
                    minAge: policy.min_age_days || 1,
                    history: policy.password_history_count || 5
                }
            },
            compliance: {
                passwordCompliance: compliance.total_users > 0
                    ? ((compliance.recent_password / compliance.total_users) * 100).toFixed(2) + '%'
                    : '0%',
                mfaCompliance: compliance.total_users > 0
                    ? ((compliance.mfa_enabled / compliance.total_users) * 100).toFixed(2) + '%'
                    : '0%',
                verificationCompliance: compliance.total_users > 0
                    ? ((compliance.verified_users / compliance.total_users) * 100).toFixed(2) + '%'
                    : '0%'
            }
        };
    }

    async getIncidentMetrics(companyId, startDate, endDate) {
        const incidentQuery = `
            SELECT 
                DATE_TRUNC('week', created_at) as week,
                COUNT(CASE WHEN action LIKE '%FAILED%' OR action LIKE '%LOCKED%' THEN 1 END) as security_incidents,
                COUNT(CASE WHEN action LIKE '%SUSPICIOUS%' THEN 1 END) as suspicious_activities,
                COUNT(CASE WHEN action = 'DATA_BREACH_ATTEMPT' THEN 1 END) as breach_attempts
            FROM audit_logs
            WHERE company_id = $1 
            AND created_at BETWEEN $2 AND $3
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY week DESC
        `;

        const result = await this.pool.query(incidentQuery, [companyId, startDate, endDate]);

        return {
            weeklyTrend: result.rows,
            totalIncidents: result.rows.reduce((sum, row) => 
                sum + parseInt(row.security_incidents) + 
                parseInt(row.suspicious_activities) + 
                parseInt(row.breach_attempts), 0
            ),
            severityBreakdown: {
                high: result.rows.reduce((sum, row) => sum + parseInt(row.breach_attempts), 0),
                medium: result.rows.reduce((sum, row) => sum + parseInt(row.suspicious_activities), 0),
                low: result.rows.reduce((sum, row) => sum + parseInt(row.security_incidents), 0)
            }
        };
    }

    async assessControls(companyId, framework) {
        const controlAssessments = {};
        
        if (framework === 'SOC2') {
            controlAssessments['CC6.1'] = await this.assessLogicalAccess(companyId);
            controlAssessments['CC6.2'] = await this.assessUserRegistration(companyId);
            controlAssessments['CC6.3'] = await this.assessUserDeprovisioning(companyId);
            controlAssessments['CC6.6'] = await this.assessPasswordManagement(companyId);
            controlAssessments['CC6.7'] = await this.assessAccessRestrictions(companyId);
            controlAssessments['CC6.8'] = await this.assessPrivilegedAccess(companyId);
            controlAssessments['CC7.1'] = await this.assessSystemMonitoring(companyId);
            controlAssessments['CC7.2'] = await this.assessSecurityMonitoring(companyId);
            controlAssessments['CC8.1'] = await this.assessChangeManagement(companyId);
        }

        return controlAssessments;
    }

    async assessLogicalAccess(companyId) {
        const metrics = await this.getUserMetrics(companyId, new Date(0), new Date());
        
        return {
            control: 'CC6.1 - Logical Access',
            status: metrics.mfaEnabled / metrics.totalUsers > 0.8 ? 'COMPLIANT' : 'NEEDS_IMPROVEMENT',
            evidence: {
                mfaAdoption: metrics.mfaAdoptionRate,
                activeUsers: metrics.activeUsers,
                dormantAccounts: metrics.dormantAccounts
            },
            findings: this.generateFindings(metrics)
        };
    }

    generateFindings(metrics) {
        const findings = [];
        
        if (parseFloat(metrics.mfaAdoptionRate) < 80) {
            findings.push({
                severity: 'MEDIUM',
                description: 'MFA adoption is below 80% threshold',
                recommendation: 'Implement mandatory MFA for all users'
            });
        }
        
        if (metrics.dormantAccounts > metrics.totalUsers * 0.1) {
            findings.push({
                severity: 'LOW',
                description: 'More than 10% of accounts are dormant',
                recommendation: 'Implement automated account deactivation policy'
            });
        }
        
        return findings;
    }

    generateRecommendations(userMetrics, authMetrics, securityEvents) {
        const recommendations = [];
        
        // MFA recommendations
        if (parseFloat(userMetrics.mfaAdoptionRate) < 90) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Authentication',
                title: 'Increase MFA Adoption',
                description: `Current MFA adoption is ${userMetrics.mfaAdoptionRate}. Target: 90%+`,
                actions: [
                    'Enable mandatory MFA for admin accounts',
                    'Implement grace period for MFA enrollment',
                    'Provide MFA setup guides and training'
                ]
            });
        }
        
        // Password policy recommendations
        if (parseFloat(authMetrics.failureRate) > 5) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Access Control',
                title: 'Reduce Authentication Failures',
                description: `Authentication failure rate is ${authMetrics.failureRate}. Target: <5%`,
                actions: [
                    'Review password complexity requirements',
                    'Implement better password reset process',
                    'Add account lockout notifications'
                ]
            });
        }
        
        // Security monitoring recommendations
        if (securityEvents.totalSecurityEvents > 100) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Security Monitoring',
                title: 'Investigate Security Events',
                description: `${securityEvents.totalSecurityEvents} security events detected`,
                actions: [
                    'Review and categorize security events',
                    'Implement automated threat response',
                    'Enhance security monitoring rules'
                ]
            });
        }
        
        return recommendations;
    }

    generateAttestation(framework) {
        return {
            statement: `This compliance report has been generated based on automated security controls and audit logs for ${framework} framework compliance.`,
            disclaimer: 'This report is for internal use only and does not constitute a formal audit opinion.',
            generatedAt: new Date().toISOString(),
            reportId: crypto.randomBytes(16).toString('hex')
        };
    }

    async getCompanyInfo(companyId) {
        const query = 'SELECT * FROM companies WHERE id = $1';
        const result = await this.pool.query(query, [companyId]);
        return result.rows[0] || {};
    }

    generateJSONReport(reportData) {
        return {
            metadata: {
                reportId: crypto.randomBytes(16).toString('hex'),
                generatedAt: new Date().toISOString(),
                framework: reportData.framework.name,
                reportPeriod: reportData.reportPeriod
            },
            company: {
                name: reportData.company.name,
                domain: reportData.company.domain,
                subscriptionTier: reportData.company.subscription_tier
            },
            executiveSummary: this.generateExecutiveSummary(reportData),
            metrics: reportData.metrics,
            controlsAssessment: reportData.controlsAssessment,
            recommendations: reportData.recommendations,
            attestation: reportData.attestation
        };
    }

    generateExecutiveSummary(reportData) {
        const { metrics } = reportData;
        const overallScore = this.calculateComplianceScore(metrics);
        
        return {
            overallScore: overallScore + '%',
            keyHighlights: [
                `${metrics.users.totalUsers} total users with ${metrics.users.mfaAdoptionRate} MFA adoption`,
                `${metrics.authentication.failureRate} authentication failure rate`,
                `${metrics.security.totalSecurityEvents} security events in reporting period`,
                `${metrics.audit.totalEvents} audit events captured`
            ],
            riskLevel: overallScore > 80 ? 'LOW' : overallScore > 60 ? 'MEDIUM' : 'HIGH',
            complianceStatus: overallScore > 70 ? 'COMPLIANT' : 'NEEDS_IMPROVEMENT'
        };
    }

    calculateComplianceScore(metrics) {
        const scores = [
            parseFloat(metrics.users.mfaAdoptionRate) || 0,
            100 - parseFloat(metrics.authentication.failureRate) || 0,
            metrics.policy.compliance.passwordCompliance ? parseFloat(metrics.policy.compliance.passwordCompliance) : 0,
            metrics.policy.compliance.verificationCompliance ? parseFloat(metrics.policy.compliance.verificationCompliance) : 0
        ];
        
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    async generatePDFReport(reportData) {
        // Note: This is a simplified version. In production, use a proper PDF library
        // like pdfkit or puppeteer for better formatting
        
        const doc = new PDFDocument();
        const filename = `compliance-report-${reportData.framework.name}-${Date.now()}.pdf`;
        const filepath = path.join('/tmp', filename);
        
        doc.pipe(fs.createWriteStream(filepath));
        
        // Add content
        doc.fontSize(20).text('Compliance Report', { align: 'center' });
        doc.fontSize(16).text(reportData.framework.name, { align: 'center' });
        doc.moveDown();
        
        // Add company info
        doc.fontSize(14).text(`Company: ${reportData.company.name}`);
        doc.text(`Report Period: ${reportData.reportPeriod.startDate.toLocaleDateString()} - ${reportData.reportPeriod.endDate.toLocaleDateString()}`);
        doc.moveDown();
        
        // Add executive summary
        const summary = this.generateExecutiveSummary(reportData);
        doc.fontSize(16).text('Executive Summary');
        doc.fontSize(12).text(`Overall Compliance Score: ${summary.overallScore}`);
        doc.text(`Risk Level: ${summary.riskLevel}`);
        doc.moveDown();
        
        // Add key metrics
        doc.fontSize(16).text('Key Metrics');
        doc.fontSize(12);
        doc.text(`Total Users: ${reportData.metrics.users.totalUsers}`);
        doc.text(`MFA Adoption: ${reportData.metrics.users.mfaAdoptionRate}`);
        doc.text(`Active Users: ${reportData.metrics.users.activeUsers}`);
        doc.text(`Failed Logins: ${reportData.metrics.authentication.failedLogins}`);
        
        doc.end();
        
        // Return file path or buffer
        return {
            filename,
            filepath,
            contentType: 'application/pdf'
        };
    }

    // API endpoint handler
    async handleComplianceRequest(req, res) {
        try {
            const { companyId } = req.user;
            const { framework = 'SOC2', format = 'json', startDate, endDate } = req.query;
            
            const options = {
                format,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined
            };
            
            const report = await this.generateComplianceReport(companyId, framework, options);
            
            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
                fs.createReadStream(report.filepath).pipe(res);
            } else {
                res.json(report);
            }
            
        } catch (error) {
            this.logger.error('Compliance report request failed', { error: error.message });
            res.status(500).json({ error: 'Failed to generate compliance report' });
        }
    }
}

module.exports = ComplianceReporter;