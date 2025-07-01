/**
 * ROOTUIP Automated Compliance Checking System
 * Continuous compliance monitoring and automated checks
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

class AutomatedComplianceChecking extends EventEmitter {
    constructor(complianceFramework, securityCompliance, auditLogger) {
        super();
        
        // Dependencies
        this.complianceFramework = complianceFramework;
        this.securityCompliance = securityCompliance;
        this.auditLogger = auditLogger;
        
        // Check definitions
        this.complianceChecks = new Map();
        
        // Check schedules
        this.checkSchedules = new Map();
        
        // Check results
        this.checkResults = new Map();
        
        // Automated remediation
        this.remediationActions = new Map();
        
        // Metrics
        this.metrics = {
            totalChecks: 0,
            passedChecks: 0,
            failedChecks: 0,
            automatedRemediations: 0,
            lastCheckTime: null,
            averageCheckDuration: 0
        };
        
        // Initialize checks
        this.initializeComplianceChecks();
        
        // Initialize remediation actions
        this.initializeRemediationActions();
        
        // Start automated checking
        this.startAutomatedChecking();
    }
    
    // Initialize compliance checks
    initializeComplianceChecks() {
        // SOC 2 Checks
        this.addComplianceCheck('soc2_access_review', {
            name: 'SOC 2 Access Review',
            description: 'Verify user access reviews are conducted quarterly',
            framework: 'SOC2_TYPE_II',
            control: 'CC6.1',
            frequency: 'weekly',
            automated: true,
            check: async () => {
                const lastReview = await this.getLastAccessReview();
                const daysSinceReview = (Date.now() - lastReview) / (24 * 60 * 60 * 1000);
                
                return {
                    passed: daysSinceReview <= 90,
                    details: {
                        lastReview,
                        daysSinceReview,
                        requirement: '90 days'
                    },
                    evidence: {
                        type: 'access_review',
                        timestamp: lastReview
                    }
                };
            }
        });
        
        this.addComplianceCheck('soc2_encryption', {
            name: 'SOC 2 Data Encryption',
            description: 'Verify all data at rest and in transit is encrypted',
            framework: 'SOC2_TYPE_II',
            control: 'CC6.7',
            frequency: 'daily',
            automated: true,
            check: async () => {
                const encryptionStatus = await this.checkEncryptionStatus();
                
                return {
                    passed: encryptionStatus.allEncrypted,
                    details: encryptionStatus,
                    evidence: {
                        type: 'encryption_scan',
                        results: encryptionStatus
                    }
                };
            }
        });
        
        this.addComplianceCheck('soc2_logging', {
            name: 'SOC 2 Security Logging',
            description: 'Verify security event logging is active and complete',
            framework: 'SOC2_TYPE_II',
            control: 'CC7.2',
            frequency: 'hourly',
            automated: true,
            check: async () => {
                const loggingStatus = await this.checkLoggingStatus();
                
                return {
                    passed: loggingStatus.active && loggingStatus.coverage >= 95,
                    details: loggingStatus,
                    evidence: {
                        type: 'logging_health',
                        metrics: loggingStatus
                    }
                };
            }
        });
        
        // GDPR Checks
        this.addComplianceCheck('gdpr_consent', {
            name: 'GDPR Consent Management',
            description: 'Verify all data processing has valid consent',
            framework: 'GDPR',
            article: '6',
            frequency: 'daily',
            automated: true,
            check: async () => {
                const consentStatus = await this.checkConsentStatus();
                
                return {
                    passed: consentStatus.invalidConsents === 0,
                    details: consentStatus,
                    evidence: {
                        type: 'consent_audit',
                        results: consentStatus
                    }
                };
            }
        });
        
        this.addComplianceCheck('gdpr_retention', {
            name: 'GDPR Data Retention',
            description: 'Verify data is not kept longer than necessary',
            framework: 'GDPR',
            article: '5(1)(e)',
            frequency: 'weekly',
            automated: true,
            check: async () => {
                const retentionStatus = await this.checkDataRetention();
                
                return {
                    passed: retentionStatus.overdueData === 0,
                    details: retentionStatus,
                    remediation: retentionStatus.overdueData > 0 ? 'delete_expired_data' : null
                };
            }
        });
        
        this.addComplianceCheck('gdpr_dsr_response', {
            name: 'GDPR DSR Response Time',
            description: 'Verify data subject requests are handled within 30 days',
            framework: 'GDPR',
            article: '12',
            frequency: 'daily',
            automated: true,
            check: async () => {
                const dsrStatus = await this.checkDSRResponseTimes();
                
                return {
                    passed: dsrStatus.overdue === 0,
                    details: dsrStatus,
                    evidence: {
                        type: 'dsr_metrics',
                        data: dsrStatus
                    }
                };
            }
        });
        
        // ISO 27001 Checks
        this.addComplianceCheck('iso27001_risk_assessment', {
            name: 'ISO 27001 Risk Assessment',
            description: 'Verify risk assessments are current',
            framework: 'ISO27001',
            control: 'A.12.6.1',
            frequency: 'weekly',
            automated: true,
            check: async () => {
                const riskStatus = await this.checkRiskAssessmentStatus();
                
                return {
                    passed: riskStatus.outdatedAssessments === 0,
                    details: riskStatus,
                    evidence: {
                        type: 'risk_assessment',
                        lastAssessment: riskStatus.lastAssessment
                    }
                };
            }
        });
        
        this.addComplianceCheck('iso27001_patch_management', {
            name: 'ISO 27001 Patch Management',
            description: 'Verify systems are patched within SLA',
            framework: 'ISO27001',
            control: 'A.12.6.1',
            frequency: 'daily',
            automated: true,
            check: async () => {
                const patchStatus = await this.checkPatchStatus();
                
                return {
                    passed: patchStatus.criticalUnpatched === 0,
                    details: patchStatus,
                    remediation: patchStatus.criticalUnpatched > 0 ? 'apply_critical_patches' : null
                };
            }
        });
        
        // Security Checks
        this.addComplianceCheck('security_mfa', {
            name: 'Multi-Factor Authentication',
            description: 'Verify MFA is enabled for all privileged accounts',
            framework: 'SECURITY',
            frequency: 'daily',
            automated: true,
            critical: true,
            check: async () => {
                const mfaStatus = await this.checkMFAStatus();
                
                return {
                    passed: mfaStatus.coverage === 100,
                    details: mfaStatus,
                    remediation: mfaStatus.coverage < 100 ? 'enforce_mfa' : null
                };
            }
        });
        
        this.addComplianceCheck('security_vulnerabilities', {
            name: 'Vulnerability Status',
            description: 'Verify no critical vulnerabilities are open',
            framework: 'SECURITY',
            frequency: 'hourly',
            automated: true,
            critical: true,
            check: async () => {
                const vulnStatus = this.securityCompliance.metrics;
                
                return {
                    passed: vulnStatus.vulnerabilitiesCritical === 0,
                    details: {
                        critical: vulnStatus.vulnerabilitiesCritical,
                        total: vulnStatus.vulnerabilitiesOpen
                    },
                    alert: vulnStatus.vulnerabilitiesCritical > 0
                };
            }
        });
        
        // Business Rules Checks
        this.addComplianceCheck('business_segregation', {
            name: 'Segregation of Duties',
            description: 'Verify proper segregation of duties is maintained',
            framework: 'BUSINESS',
            frequency: 'weekly',
            automated: true,
            check: async () => {
                const segregationStatus = await this.checkSegregationOfDuties();
                
                return {
                    passed: segregationStatus.violations === 0,
                    details: segregationStatus,
                    evidence: {
                        type: 'access_matrix',
                        violations: segregationStatus.violationDetails
                    }
                };
            }
        });
        
        // Audit Trail Checks
        this.addComplianceCheck('audit_integrity', {
            name: 'Audit Log Integrity',
            description: 'Verify audit logs have not been tampered with',
            framework: 'AUDIT',
            frequency: 'daily',
            automated: true,
            critical: true,
            check: async () => {
                const integrityResults = [];
                
                for (const category of ['authentication', 'data_access', 'admin']) {
                    const result = await this.auditLogger.verifyIntegrity(category);
                    integrityResults.push({
                        category,
                        valid: result.valid,
                        errors: result.errors.length
                    });
                }
                
                const allValid = integrityResults.every(r => r.valid);
                
                return {
                    passed: allValid,
                    details: integrityResults,
                    alert: !allValid,
                    evidence: {
                        type: 'integrity_check',
                        results: integrityResults
                    }
                };
            }
        });
    }
    
    // Initialize remediation actions
    initializeRemediationActions() {
        // Delete expired data
        this.addRemediationAction('delete_expired_data', {
            name: 'Delete Expired Data',
            description: 'Automatically delete data past retention period',
            automated: true,
            requiresApproval: false,
            action: async (checkResult) => {
                const deleted = await this.deleteExpiredData(checkResult.details);
                
                return {
                    success: true,
                    deletedRecords: deleted.count,
                    details: deleted
                };
            }
        });
        
        // Enforce MFA
        this.addRemediationAction('enforce_mfa', {
            name: 'Enforce Multi-Factor Authentication',
            description: 'Enable MFA for accounts without it',
            automated: true,
            requiresApproval: true,
            action: async (checkResult) => {
                const enforced = await this.enforceMFA(checkResult.details.accountsWithoutMFA);
                
                return {
                    success: enforced.success,
                    accountsUpdated: enforced.count
                };
            }
        });
        
        // Apply critical patches
        this.addRemediationAction('apply_critical_patches', {
            name: 'Apply Critical Patches',
            description: 'Automatically apply critical security patches',
            automated: true,
            requiresApproval: true,
            action: async (checkResult) => {
                const patched = await this.applyCriticalPatches(checkResult.details);
                
                return {
                    success: patched.success,
                    systemsPatched: patched.count,
                    patchesApplied: patched.patches
                };
            }
        });
        
        // Rotate encryption keys
        this.addRemediationAction('rotate_encryption_keys', {
            name: 'Rotate Encryption Keys',
            description: 'Automatically rotate overdue encryption keys',
            automated: true,
            requiresApproval: false,
            action: async (checkResult) => {
                const rotated = await this.rotateEncryptionKeys(checkResult.details.overdueKeys);
                
                return {
                    success: true,
                    keysRotated: rotated.count
                };
            }
        });
        
        // Revoke excessive permissions
        this.addRemediationAction('revoke_permissions', {
            name: 'Revoke Excessive Permissions',
            description: 'Remove unnecessary access permissions',
            automated: false,
            requiresApproval: true,
            action: async (checkResult) => {
                // Generate revocation plan
                return {
                    plan: await this.generateRevocationPlan(checkResult.details),
                    requiresManualExecution: true
                };
            }
        });
    }
    
    // Add compliance check
    addComplianceCheck(checkId, config) {
        this.complianceChecks.set(checkId, {
            ...config,
            id: checkId,
            enabled: true,
            lastRun: null,
            lastResult: null,
            runCount: 0,
            failureCount: 0
        });
    }
    
    // Add remediation action
    addRemediationAction(actionId, config) {
        this.remediationActions.set(actionId, {
            ...config,
            id: actionId,
            executionCount: 0,
            lastExecution: null
        });
    }
    
    // Start automated checking
    startAutomatedChecking() {
        // Schedule checks based on frequency
        for (const [checkId, check] of this.complianceChecks) {
            if (!check.automated || !check.enabled) continue;
            
            const schedule = this.getSchedulePattern(check.frequency);
            
            const task = cron.schedule(schedule, async () => {
                await this.runComplianceCheck(checkId);
            });
            
            this.checkSchedules.set(checkId, task);
        }
        
        // Run initial checks
        this.runAllChecks();
        
        console.log('Automated compliance checking started');
    }
    
    // Get schedule pattern
    getSchedulePattern(frequency) {
        const patterns = {
            'hourly': '0 * * * *',
            'daily': '0 0 * * *',
            'weekly': '0 0 * * 0',
            'monthly': '0 0 1 * *'
        };
        
        return patterns[frequency] || patterns.daily;
    }
    
    // Run compliance check
    async runComplianceCheck(checkId) {
        const check = this.complianceChecks.get(checkId);
        if (!check || !check.enabled) return;
        
        const startTime = Date.now();
        const checkRun = {
            id: uuidv4(),
            checkId,
            timestamp: new Date(),
            result: null,
            duration: 0,
            error: null
        };
        
        try {
            // Execute check
            const result = await check.check();
            
            checkRun.result = result;
            checkRun.duration = Date.now() - startTime;
            
            // Update check statistics
            check.lastRun = checkRun.timestamp;
            check.lastResult = result;
            check.runCount++;
            
            if (!result.passed) {
                check.failureCount++;
            }
            
            // Update metrics
            this.metrics.totalChecks++;
            if (result.passed) {
                this.metrics.passedChecks++;
            } else {
                this.metrics.failedChecks++;
            }
            
            // Store result
            if (!this.checkResults.has(checkId)) {
                this.checkResults.set(checkId, []);
            }
            this.checkResults.get(checkId).push(checkRun);
            
            // Keep only last 100 results
            const results = this.checkResults.get(checkId);
            if (results.length > 100) {
                results.shift();
            }
            
            // Log to audit trail
            await this.auditLogger.writeAuditLog('compliance', {
                action: 'compliance_check',
                checkId,
                checkName: check.name,
                result: result.passed ? 'passed' : 'failed',
                details: result.details
            });
            
            // Handle failures
            if (!result.passed) {
                await this.handleCheckFailure(check, result);
            }
            
            // Emit check result
            this.emit('check:completed', {
                checkId,
                passed: result.passed,
                details: result.details
            });
            
        } catch (error) {
            checkRun.error = error.message;
            check.lastRun = checkRun.timestamp;
            check.lastResult = { passed: false, error: error.message };
            
            console.error(`Compliance check ${checkId} failed:`, error);
            
            this.emit('check:error', {
                checkId,
                error: error.message
            });
        }
        
        // Update average duration
        this.updateAverageCheckDuration(checkRun.duration);
        
        return checkRun;
    }
    
    // Handle check failure
    async handleCheckFailure(check, result) {
        // Create alert for critical checks
        if (check.critical || result.alert) {
            this.emit('compliance:alert', {
                checkId: check.id,
                checkName: check.name,
                framework: check.framework,
                severity: check.critical ? 'critical' : 'high',
                details: result.details,
                timestamp: new Date()
            });
        }
        
        // Attempt automated remediation if available
        if (result.remediation && check.automated) {
            const remediationAction = this.remediationActions.get(result.remediation);
            
            if (remediationAction && remediationAction.automated) {
                if (!remediationAction.requiresApproval) {
                    // Execute remediation immediately
                    await this.executeRemediation(result.remediation, result);
                } else {
                    // Queue for approval
                    this.emit('remediation:approval_required', {
                        checkId: check.id,
                        checkName: check.name,
                        remediationId: result.remediation,
                        remediationName: remediationAction.name,
                        details: result.details
                    });
                }
            }
        }
        
        // Update compliance score
        await this.updateComplianceScore(check.framework);
    }
    
    // Execute remediation
    async executeRemediation(remediationId, checkResult) {
        const remediation = this.remediationActions.get(remediationId);
        if (!remediation) return;
        
        const execution = {
            id: uuidv4(),
            remediationId,
            timestamp: new Date(),
            checkResult,
            result: null,
            error: null
        };
        
        try {
            // Execute remediation action
            const result = await remediation.action(checkResult);
            
            execution.result = result;
            remediation.executionCount++;
            remediation.lastExecution = execution.timestamp;
            
            // Log remediation
            await this.auditLogger.writeAuditLog('compliance', {
                action: 'remediation_executed',
                remediationId,
                remediationName: remediation.name,
                automated: true,
                result: result.success ? 'success' : 'failed',
                details: result
            });
            
            // Update metrics
            if (result.success) {
                this.metrics.automatedRemediations++;
            }
            
            // Emit remediation event
            this.emit('remediation:executed', {
                remediationId,
                success: result.success,
                details: result
            });
            
            // Re-run check after remediation
            if (result.success) {
                setTimeout(() => {
                    this.runComplianceCheck(checkResult.checkId);
                }, 5000); // Wait 5 seconds before re-checking
            }
            
        } catch (error) {
            execution.error = error.message;
            
            console.error(`Remediation ${remediationId} failed:`, error);
            
            this.emit('remediation:error', {
                remediationId,
                error: error.message
            });
        }
        
        return execution;
    }
    
    // Run all checks
    async runAllChecks() {
        const results = [];
        
        for (const checkId of this.complianceChecks.keys()) {
            const result = await this.runComplianceCheck(checkId);
            results.push(result);
        }
        
        this.metrics.lastCheckTime = new Date();
        
        // Generate compliance summary
        const summary = this.generateComplianceSummary(results);
        
        this.emit('compliance:summary', summary);
        
        return summary;
    }
    
    // Generate compliance summary
    generateComplianceSummary(results) {
        const summary = {
            timestamp: new Date(),
            totalChecks: results.length,
            passed: results.filter(r => r.result?.passed).length,
            failed: results.filter(r => r.result && !r.result.passed).length,
            errors: results.filter(r => r.error).length,
            byFramework: {},
            criticalIssues: [],
            complianceScore: 0
        };
        
        // Group by framework
        for (const [checkId, check] of this.complianceChecks) {
            const framework = check.framework;
            if (!summary.byFramework[framework]) {
                summary.byFramework[framework] = {
                    total: 0,
                    passed: 0,
                    failed: 0
                };
            }
            
            summary.byFramework[framework].total++;
            
            if (check.lastResult) {
                if (check.lastResult.passed) {
                    summary.byFramework[framework].passed++;
                } else {
                    summary.byFramework[framework].failed++;
                    
                    // Track critical issues
                    if (check.critical) {
                        summary.criticalIssues.push({
                            checkId,
                            checkName: check.name,
                            framework,
                            details: check.lastResult.details
                        });
                    }
                }
            }
        }
        
        // Calculate overall compliance score
        summary.complianceScore = summary.totalChecks > 0 ?
            (summary.passed / summary.totalChecks) * 100 : 0;
        
        return summary;
    }
    
    // Update compliance score
    async updateComplianceScore(framework) {
        const frameworkChecks = Array.from(this.complianceChecks.values())
            .filter(check => check.framework === framework);
        
        const passed = frameworkChecks.filter(check => 
            check.lastResult && check.lastResult.passed
        ).length;
        
        const score = frameworkChecks.length > 0 ?
            (passed / frameworkChecks.length) * 100 : 0;
        
        // Update framework score
        if (this.complianceFramework) {
            const fw = this.complianceFramework.frameworks.get(framework);
            if (fw) {
                fw.complianceScore = score;
            }
        }
        
        this.emit('score:updated', {
            framework,
            score,
            passed,
            total: frameworkChecks.length
        });
    }
    
    // Get compliance status
    getComplianceStatus() {
        const status = {
            checks: {},
            frameworks: {},
            metrics: this.metrics,
            issues: []
        };
        
        // Check status
        for (const [checkId, check] of this.complianceChecks) {
            status.checks[checkId] = {
                name: check.name,
                framework: check.framework,
                enabled: check.enabled,
                lastRun: check.lastRun,
                passed: check.lastResult?.passed || false,
                runCount: check.runCount,
                failureRate: check.runCount > 0 ? 
                    (check.failureCount / check.runCount) * 100 : 0
            };
            
            // Identify issues
            if (check.lastResult && !check.lastResult.passed) {
                status.issues.push({
                    checkId,
                    checkName: check.name,
                    framework: check.framework,
                    critical: check.critical || false,
                    details: check.lastResult.details
                });
            }
        }
        
        // Framework compliance
        const summary = this.generateComplianceSummary([]);
        status.frameworks = summary.byFramework;
        
        return status;
    }
    
    // Generate compliance report
    async generateComplianceReport(options = {}) {
        const report = {
            generatedAt: new Date(),
            period: options.period || 'last_7_days',
            summary: this.generateComplianceSummary([]),
            checks: {},
            remediations: {},
            trends: {},
            recommendations: []
        };
        
        // Detailed check results
        for (const [checkId, check] of this.complianceChecks) {
            const history = this.checkResults.get(checkId) || [];
            const recentHistory = this.filterByPeriod(history, options.period);
            
            report.checks[checkId] = {
                name: check.name,
                framework: check.framework,
                status: check.lastResult?.passed ? 'compliant' : 'non-compliant',
                runCount: recentHistory.length,
                passRate: this.calculatePassRate(recentHistory),
                lastRun: check.lastRun,
                averageDuration: this.calculateAverageDuration(recentHistory),
                issues: recentHistory.filter(r => r.result && !r.result.passed)
                    .map(r => ({
                        timestamp: r.timestamp,
                        details: r.result.details
                    }))
            };
        }
        
        // Remediation summary
        for (const [actionId, action] of this.remediationActions) {
            report.remediations[actionId] = {
                name: action.name,
                automated: action.automated,
                executionCount: action.executionCount,
                lastExecution: action.lastExecution
            };
        }
        
        // Generate trends
        report.trends = await this.generateComplianceTrends(options.period);
        
        // Generate recommendations
        report.recommendations = this.generateRecommendations(report);
        
        return report;
    }
    
    // Helper methods for checks
    async getLastAccessReview() {
        // Simulate getting last access review date
        return new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    }
    
    async checkEncryptionStatus() {
        return {
            allEncrypted: true,
            dataAtRest: { encrypted: true, algorithm: 'AES-256' },
            dataInTransit: { encrypted: true, protocol: 'TLS 1.3' }
        };
    }
    
    async checkLoggingStatus() {
        return {
            active: true,
            coverage: 98,
            categories: ['authentication', 'access', 'changes', 'security']
        };
    }
    
    async checkConsentStatus() {
        return {
            totalRecords: 10000,
            validConsents: 9950,
            invalidConsents: 50,
            expiringConsents: 200
        };
    }
    
    async checkDataRetention() {
        return {
            totalRecords: 50000,
            withinRetention: 49800,
            overdueData: 200,
            oldestRecord: new Date(Date.now() - 365 * 3 * 24 * 60 * 60 * 1000)
        };
    }
    
    async checkDSRResponseTimes() {
        return {
            totalRequests: 50,
            completed: 48,
            pending: 2,
            overdue: 0,
            averageResponseTime: 15 // days
        };
    }
    
    async checkRiskAssessmentStatus() {
        return {
            totalAssets: 100,
            assessedAssets: 95,
            outdatedAssessments: 5,
            lastAssessment: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        };
    }
    
    async checkPatchStatus() {
        return {
            totalSystems: 50,
            fullyPatched: 48,
            criticalUnpatched: 0,
            pendingPatches: 10
        };
    }
    
    async checkMFAStatus() {
        return {
            totalAccounts: 100,
            mfaEnabled: 95,
            coverage: 95,
            accountsWithoutMFA: ['user1', 'user2', 'user3', 'user4', 'user5']
        };
    }
    
    async checkSegregationOfDuties() {
        return {
            violations: 0,
            violationDetails: [],
            rolesChecked: 50,
            conflictsFound: 0
        };
    }
    
    // Remediation methods
    async deleteExpiredData(details) {
        // Simulate data deletion
        return {
            count: details.overdueData,
            categories: ['user_logs', 'temporary_data']
        };
    }
    
    async enforceMFA(accounts) {
        // Simulate MFA enforcement
        return {
            success: true,
            count: accounts.length
        };
    }
    
    async applyCriticalPatches(details) {
        // Simulate patch application
        return {
            success: true,
            count: details.criticalUnpatched,
            patches: []
        };
    }
    
    async rotateEncryptionKeys(keys) {
        // Simulate key rotation
        return {
            count: keys.length
        };
    }
    
    async generateRevocationPlan(details) {
        return {
            users: details.excessivePermissions || [],
            permissions: details.unnecessaryAccess || [],
            estimatedImpact: 'low'
        };
    }
    
    // Helper methods
    updateAverageCheckDuration(duration) {
        const total = this.metrics.averageCheckDuration * (this.metrics.totalChecks - 1) + duration;
        this.metrics.averageCheckDuration = total / this.metrics.totalChecks;
    }
    
    filterByPeriod(history, period) {
        const now = Date.now();
        const periods = {
            'last_24_hours': 24 * 60 * 60 * 1000,
            'last_7_days': 7 * 24 * 60 * 60 * 1000,
            'last_30_days': 30 * 24 * 60 * 60 * 1000
        };
        
        const cutoff = now - (periods[period] || periods.last_7_days);
        
        return history.filter(h => new Date(h.timestamp).getTime() > cutoff);
    }
    
    calculatePassRate(history) {
        if (history.length === 0) return 0;
        
        const passed = history.filter(h => h.result && h.result.passed).length;
        return (passed / history.length) * 100;
    }
    
    calculateAverageDuration(history) {
        if (history.length === 0) return 0;
        
        const total = history.reduce((sum, h) => sum + (h.duration || 0), 0);
        return total / history.length;
    }
    
    async generateComplianceTrends(period) {
        // Generate trend data
        return {
            complianceScore: {
                current: this.metrics.passedChecks / this.metrics.totalChecks * 100,
                trend: 'improving',
                change: '+5%'
            },
            checkVolume: {
                daily: Math.floor(this.metrics.totalChecks / 30),
                trend: 'stable'
            },
            remediations: {
                automated: this.metrics.automatedRemediations,
                trend: 'increasing'
            }
        };
    }
    
    generateRecommendations(report) {
        const recommendations = [];
        
        // Check for failing checks
        for (const [checkId, checkData] of Object.entries(report.checks)) {
            if (checkData.passRate < 90) {
                recommendations.push({
                    priority: checkData.passRate < 50 ? 'high' : 'medium',
                    check: checkData.name,
                    issue: `Low pass rate: ${checkData.passRate.toFixed(1)}%`,
                    recommendation: 'Investigate root cause and implement fixes'
                });
            }
        }
        
        // Check for unused remediations
        const unusedRemediations = Array.from(this.remediationActions.entries())
            .filter(([id, action]) => action.executionCount === 0);
        
        if (unusedRemediations.length > 0) {
            recommendations.push({
                priority: 'low',
                area: 'Automation',
                issue: `${unusedRemediations.length} remediation actions never used`,
                recommendation: 'Review and enable automated remediations'
            });
        }
        
        return recommendations;
    }
}

module.exports = AutomatedComplianceChecking;