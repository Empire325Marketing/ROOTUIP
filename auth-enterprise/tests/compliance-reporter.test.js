const ComplianceReporter = require('../compliance-reporter');
const { Pool } = require('pg');

// Mock dependencies
jest.mock('pg');
jest.mock('pdfkit');
jest.mock('fs');
jest.mock('nodemailer');

describe('ComplianceReporter Unit Tests', () => {
    let reporter;
    let mockPool;
    let mockLogger;

    beforeEach(() => {
        // Setup mock pool
        mockPool = {
            query: jest.fn()
        };
        Pool.mockImplementation(() => mockPool);

        // Setup mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };

        // Create reporter instance
        reporter = new ComplianceReporter({}, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUserMetrics', () => {
        test('should calculate user metrics correctly', async () => {
            const companyId = 'test-company-id';
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            // Mock query responses
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // totalUsers
                .mockResolvedValueOnce({ rows: [{ count: '85' }] })  // activeUsers
                .mockResolvedValueOnce({ rows: [{ count: '78' }] })  // mfaEnabled
                .mockResolvedValueOnce({ rows: [{ count: '12' }] })  // privilegedUsers
                .mockResolvedValueOnce({ rows: [{ count: '8' }] });   // dormantAccounts

            const metrics = await reporter.getUserMetrics(companyId, startDate, endDate);

            expect(metrics).toEqual({
                totalUsers: 100,
                activeUsers: 85,
                mfaEnabled: 78,
                privilegedUsers: 12,
                dormantAccounts: 8,
                mfaAdoptionRate: '78.00%'
            });

            expect(mockPool.query).toHaveBeenCalledTimes(5);
        });

        test('should handle zero users gracefully', async () => {
            mockPool.query.mockResolvedValue({ rows: [{ count: '0' }] });

            const metrics = await reporter.getUserMetrics('test-company', new Date(), new Date());

            expect(metrics.mfaAdoptionRate).toBe('0%');
            expect(metrics.totalUsers).toBe(0);
        });
    });

    describe('getAuthenticationMetrics', () => {
        test('should calculate authentication metrics', async () => {
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ count: '1000' }] })     // totalLogins
                .mockResolvedValueOnce({ rows: [{ count: '50' }] })       // failedLogins
                .mockResolvedValueOnce({ rows: [{ count: '850' }] })      // mfaUsage
                .mockResolvedValueOnce({ rows: [{ count: '25' }] })       // passwordResets
                .mockResolvedValueOnce({ rows: [{ avg_hours: 4.5, max_hours: 12 }] }); // sessionDuration

            const metrics = await reporter.getAuthenticationMetrics('test-company', new Date(), new Date());

            expect(metrics).toEqual({
                totalLogins: 1000,
                failedLogins: 50,
                mfaUsage: 850,
                passwordResets: 25,
                sessionDuration: {
                    average: '4.50 hours',
                    maximum: '12.00 hours'
                },
                failureRate: '4.76%'
            });
        });
    });

    describe('assessControls', () => {
        test('should assess SOC2 controls', async () => {
            // Mock getUserMetrics response
            jest.spyOn(reporter, 'getUserMetrics').mockResolvedValue({
                totalUsers: 100,
                mfaEnabled: 85,
                mfaAdoptionRate: '85.00%',
                dormantAccounts: 5
            });

            jest.spyOn(reporter, 'assessLogicalAccess').mockResolvedValue({
                control: 'CC6.1 - Logical Access',
                status: 'COMPLIANT',
                evidence: { mfaAdoption: '85.00%' },
                findings: []
            });

            const controls = await reporter.assessControls('test-company', 'SOC2');

            expect(controls['CC6.1']).toBeDefined();
            expect(controls['CC6.1'].status).toBe('COMPLIANT');
        });
    });

    describe('generateFindings', () => {
        test('should generate findings for low MFA adoption', () => {
            const metrics = {
                mfaAdoptionRate: '65.00%',
                dormantAccounts: 5,
                totalUsers: 100
            };

            const findings = reporter.generateFindings(metrics);

            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('MEDIUM');
            expect(findings[0].description).toContain('MFA adoption is below 80%');
        });

        test('should generate findings for high dormant accounts', () => {
            const metrics = {
                mfaAdoptionRate: '90.00%',
                dormantAccounts: 15,
                totalUsers: 100
            };

            const findings = reporter.generateFindings(metrics);

            expect(findings).toHaveLength(1);
            expect(findings[0].severity).toBe('LOW');
            expect(findings[0].description).toContain('10% of accounts are dormant');
        });
    });

    describe('generateRecommendations', () => {
        test('should generate MFA recommendations', () => {
            const userMetrics = { mfaAdoptionRate: '75.00%' };
            const authMetrics = { failureRate: '3.00%' };
            const securityEvents = { totalSecurityEvents: 50 };

            const recommendations = reporter.generateRecommendations(
                userMetrics,
                authMetrics,
                securityEvents
            );

            expect(recommendations).toHaveLength(1);
            expect(recommendations[0].priority).toBe('HIGH');
            expect(recommendations[0].category).toBe('Authentication');
            expect(recommendations[0].title).toContain('MFA');
        });

        test('should generate multiple recommendations', () => {
            const userMetrics = { mfaAdoptionRate: '75.00%' };
            const authMetrics = { failureRate: '8.00%' };
            const securityEvents = { totalSecurityEvents: 150 };

            const recommendations = reporter.generateRecommendations(
                userMetrics,
                authMetrics,
                securityEvents
            );

            expect(recommendations.length).toBeGreaterThan(1);
            expect(recommendations.some(r => r.priority === 'HIGH')).toBe(true);
            expect(recommendations.some(r => r.category === 'Security Monitoring')).toBe(true);
        });
    });

    describe('calculateComplianceScore', () => {
        test('should calculate compliance score correctly', () => {
            const metrics = {
                users: { mfaAdoptionRate: '85.00%' },
                authentication: { failureRate: '5.00%' },
                policy: {
                    compliance: {
                        passwordCompliance: '90.00%',
                        verificationCompliance: '88.00%'
                    }
                }
            };

            const score = reporter.calculateComplianceScore(metrics);

            expect(score).toBe(87); // (85 + 95 + 90 + 88) / 4
        });

        test('should handle missing metrics', () => {
            const metrics = {
                users: { mfaAdoptionRate: null },
                authentication: { failureRate: null },
                policy: {
                    compliance: {
                        passwordCompliance: null,
                        verificationCompliance: null
                    }
                }
            };

            const score = reporter.calculateComplianceScore(metrics);

            expect(score).toBe(25); // (0 + 100 + 0 + 0) / 4
        });
    });

    describe('generateComplianceReport', () => {
        test('should generate JSON report successfully', async () => {
            const companyId = 'test-company';
            const framework = 'SOC2';

            // Mock all the data gathering methods
            jest.spyOn(reporter, 'getUserMetrics').mockResolvedValue({
                totalUsers: 100,
                mfaAdoptionRate: '85.00%'
            });

            jest.spyOn(reporter, 'getAuthenticationMetrics').mockResolvedValue({
                failureRate: '3.00%'
            });

            jest.spyOn(reporter, 'getSecurityEvents').mockResolvedValue({
                totalSecurityEvents: 25
            });

            jest.spyOn(reporter, 'getAccessControlMetrics').mockResolvedValue({});
            jest.spyOn(reporter, 'getAuditTrailSummary').mockResolvedValue({});
            jest.spyOn(reporter, 'getPolicyCompliance').mockResolvedValue({});
            jest.spyOn(reporter, 'getIncidentMetrics').mockResolvedValue({});
            jest.spyOn(reporter, 'assessControls').mockResolvedValue({});
            jest.spyOn(reporter, 'getCompanyInfo').mockResolvedValue({
                name: 'Test Company',
                domain: 'test.com'
            });

            const report = await reporter.generateComplianceReport(companyId, framework);

            expect(report).toBeDefined();
            expect(report.metadata).toBeDefined();
            expect(report.metadata.framework).toBe('SOC 2 Type II');
            expect(report.company.name).toBe('Test Company');
            expect(report.executiveSummary).toBeDefined();
        });

        test('should handle errors gracefully', async () => {
            const error = new Error('Database connection failed');
            jest.spyOn(reporter, 'getUserMetrics').mockRejectedValue(error);

            await expect(
                reporter.generateComplianceReport('test-company', 'SOC2')
            ).rejects.toThrow('Database connection failed');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to generate compliance report',
                expect.objectContaining({
                    error: 'Database connection failed',
                    companyId: 'test-company',
                    framework: 'SOC2'
                })
            );
        });
    });

    describe('getPolicyCompliance', () => {
        test('should calculate policy compliance correctly', async () => {
            mockPool.query
                .mockResolvedValueOnce({ 
                    rows: [{
                        min_length: 12,
                        require_uppercase: true,
                        require_lowercase: true,
                        require_numbers: true,
                        require_special: true,
                        max_age_days: 90,
                        min_age_days: 1,
                        password_history_count: 5
                    }] 
                })
                .mockResolvedValueOnce({ 
                    rows: [{
                        total_users: 100,
                        has_password: 100,
                        recent_password: 85,
                        mfa_enabled: 78,
                        verified_users: 95
                    }] 
                });

            const compliance = await reporter.getPolicyCompliance('test-company');

            expect(compliance.passwordPolicy.configured).toBe(true);
            expect(compliance.passwordPolicy.minLength).toBe(12);
            expect(compliance.compliance.passwordCompliance).toBe('85.00%');
            expect(compliance.compliance.mfaCompliance).toBe('78.00%');
            expect(compliance.compliance.verificationCompliance).toBe('95.00%');
        });
    });

    describe('handleComplianceRequest', () => {
        test('should handle JSON report request', async () => {
            const req = {
                user: { companyId: 'test-company' },
                query: { framework: 'SOC2', format: 'json' }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
                setHeader: jest.fn()
            };

            jest.spyOn(reporter, 'generateComplianceReport').mockResolvedValue({
                metadata: { framework: 'SOC2' }
            });

            await reporter.handleComplianceRequest(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: { framework: 'SOC2' }
                })
            );
        });

        test('should handle PDF report request', async () => {
            const req = {
                user: { companyId: 'test-company' },
                query: { framework: 'ISO27001', format: 'pdf' }
            };
            const res = {
                setHeader: jest.fn(),
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockReadStream = { pipe: jest.fn() };
            require('fs').createReadStream = jest.fn().mockReturnValue(mockReadStream);

            jest.spyOn(reporter, 'generateComplianceReport').mockResolvedValue({
                filename: 'report.pdf',
                filepath: '/tmp/report.pdf',
                contentType: 'application/pdf'
            });

            await reporter.handleComplianceRequest(req, res);

            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
            expect(res.setHeader).toHaveBeenCalledWith(
                'Content-Disposition',
                expect.stringContaining('report.pdf')
            );
        });

        test('should handle request errors', async () => {
            const req = {
                user: { companyId: 'test-company' },
                query: {}
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            jest.spyOn(reporter, 'generateComplianceReport')
                .mockRejectedValue(new Error('Report generation failed'));

            await reporter.handleComplianceRequest(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Failed to generate compliance report'
            });
        });
    });
});