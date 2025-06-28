const request = require('supertest');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

// Test configuration
const testConfig = {
    database: {
        host: process.env.TEST_DB_HOST || 'localhost',
        port: process.env.TEST_DB_PORT || 5432,
        database: process.env.TEST_DB_NAME || 'rootuip_test',
        user: process.env.TEST_DB_USER || 'test_user',
        password: process.env.TEST_DB_PASSWORD || 'test_password'
    },
    jwtSecret: 'test-jwt-secret',
    jwtRefreshSecret: 'test-refresh-secret'
};

describe('Enterprise Authentication Integration Tests', () => {
    let app;
    let pool;
    let testCompanyId;
    let testUserId;
    let authToken;
    let refreshToken;

    beforeAll(async () => {
        // Set test environment
        process.env.JWT_SECRET = testConfig.jwtSecret;
        process.env.JWT_REFRESH_SECRET = testConfig.jwtRefreshSecret;
        process.env.DB_HOST = testConfig.database.host;
        process.env.DB_NAME = testConfig.database.database;
        process.env.DB_USER = testConfig.database.user;
        process.env.DB_PASSWORD = testConfig.database.password;

        // Initialize database connection
        pool = new Pool(testConfig.database);

        // Import app after setting environment
        app = require('../enterprise-auth-complete');

        // Clean up test data
        await cleanupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
        await pool.end();
    });

    async function cleanupTestData() {
        try {
            await pool.query("DELETE FROM audit_logs WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%')");
            await pool.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
            await pool.query("DELETE FROM api_keys WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%')");
            await pool.query("DELETE FROM users WHERE email LIKE '%@test.com'");
            await pool.query("DELETE FROM roles WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'Test%')");
            await pool.query("DELETE FROM companies WHERE name LIKE 'Test%'");
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    describe('Company Registration', () => {
        test('should register a new company successfully', async () => {
            const response = await request(app)
                .post('/auth/register-company')
                .send({
                    companyName: 'Test Corp',
                    adminEmail: 'admin@test.com',
                    adminPassword: 'TestPassword123!',
                    adminFirstName: 'Test',
                    adminLastName: 'Admin'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.company).toBeDefined();
            expect(response.body.company.name).toBe('Test Corp');
            
            testCompanyId = response.body.company.id;
        });

        test('should fail with duplicate company email', async () => {
            const response = await request(app)
                .post('/auth/register-company')
                .send({
                    companyName: 'Test Corp 2',
                    adminEmail: 'admin@test.com',
                    adminPassword: 'TestPassword123!',
                    adminFirstName: 'Test',
                    adminLastName: 'Admin'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('already exists');
        });

        test('should enforce password policy', async () => {
            const response = await request(app)
                .post('/auth/register-company')
                .send({
                    companyName: 'Test Corp 3',
                    adminEmail: 'admin3@test.com',
                    adminPassword: 'weak',
                    adminFirstName: 'Test',
                    adminLastName: 'Admin'
                });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
            expect(response.body.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Authentication', () => {
        test('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@test.com',
                    password: 'TestPassword123!'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.email).toBe('admin@test.com');
            expect(response.body.tokens).toBeDefined();
            expect(response.body.tokens.accessToken).toBeDefined();
            expect(response.body.tokens.refreshToken).toBeDefined();

            authToken = response.body.tokens.accessToken;
            refreshToken = response.body.tokens.refreshToken;
            testUserId = response.body.user.id;
        });

        test('should fail login with invalid password', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@test.com',
                    password: 'WrongPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid credentials');
        });

        test('should fail login with non-existent user', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'TestPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid credentials');
        });

        test('should handle account lockout after failed attempts', async () => {
            // Make multiple failed login attempts
            for (let i = 0; i < 6; i++) {
                await request(app)
                    .post('/auth/login')
                    .send({
                        email: 'admin@test.com',
                        password: 'WrongPassword'
                    });
            }

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@test.com',
                    password: 'TestPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toContain('locked');

            // Reset lockout for other tests
            await pool.query(
                'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE email = $1',
                ['admin@test.com']
            );
        });
    });

    describe('Token Management', () => {
        test('should refresh tokens successfully', async () => {
            const response = await request(app)
                .post('/auth/refresh')
                .send({
                    refreshToken: refreshToken
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.tokens).toBeDefined();
            expect(response.body.tokens.accessToken).toBeDefined();
            expect(response.body.tokens.refreshToken).toBeDefined();

            // Update tokens for subsequent tests
            authToken = response.body.tokens.accessToken;
            refreshToken = response.body.tokens.refreshToken;
        });

        test('should fail refresh with invalid token', async () => {
            const response = await request(app)
                .post('/auth/refresh')
                .send({
                    refreshToken: 'invalid-refresh-token'
                });

            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined();
        });

        test('should logout successfully', async () => {
            const response = await request(app)
                .post('/auth/logout')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify token is revoked
            const verifyResponse = await request(app)
                .get('/auth/verify')
                .set('Authorization', `Bearer ${authToken}`);

            expect(verifyResponse.status).toBe(401);

            // Get new token for subsequent tests
            const loginResponse = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@test.com',
                    password: 'TestPassword123!'
                });

            authToken = loginResponse.body.tokens.accessToken;
            refreshToken = loginResponse.body.tokens.refreshToken;
        });
    });

    describe('Multi-Factor Authentication', () => {
        let mfaSecret;
        let backupCodes;

        test('should setup TOTP MFA', async () => {
            const response = await request(app)
                .post('/auth/mfa/setup')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'totp'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.secret).toBeDefined();
            expect(response.body.qrCode).toBeDefined();

            mfaSecret = response.body.secret;
        });

        test('should verify TOTP MFA', async () => {
            const token = speakeasy.totp({
                secret: mfaSecret,
                encoding: 'base32'
            });

            const response = await request(app)
                .post('/auth/mfa/verify')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    token: token
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.backupCodes).toBeDefined();
            expect(response.body.backupCodes.length).toBeGreaterThan(0);

            backupCodes = response.body.backupCodes;
        });

        test('should require MFA on login after enabling', async () => {
            // Login without MFA should return MFA required
            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@test.com',
                    password: 'TestPassword123!'
                });

            expect(response.status).toBe(200);
            expect(response.body.mfaRequired).toBe(true);
            expect(response.body.tempToken).toBeDefined();

            // Complete login with MFA
            const token = speakeasy.totp({
                secret: mfaSecret,
                encoding: 'base32'
            });

            const mfaResponse = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@test.com',
                    password: 'TestPassword123!',
                    mfaCode: token
                });

            expect(mfaResponse.status).toBe(200);
            expect(mfaResponse.body.success).toBe(true);
            expect(mfaResponse.body.tokens).toBeDefined();
        });
    });

    describe('User Management', () => {
        let invitationToken;

        test('should invite a new user', async () => {
            const response = await request(app)
                .post('/auth/invite')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    email: 'newuser@test.com',
                    roleId: 'viewer',
                    metadata: {
                        department: 'Engineering'
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.invitation).toBeDefined();

            // Extract invitation token (in real scenario, this would be from email)
            const inviteResult = await pool.query(
                'SELECT invitation_token FROM user_invitations WHERE email = $1',
                ['newuser@test.com']
            );
            invitationToken = inviteResult.rows[0].invitation_token;
        });

        test('should accept invitation and create user', async () => {
            const response = await request(app)
                .post('/auth/accept-invitation')
                .send({
                    token: invitationToken,
                    password: 'NewUserPass123!',
                    firstName: 'New',
                    lastName: 'User'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('should list users with proper permissions', async () => {
            const response = await request(app)
                .get('/auth/users')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.users).toBeDefined();
            expect(Array.isArray(response.body.users)).toBe(true);
            expect(response.body.users.length).toBeGreaterThan(0);
        });
    });

    describe('API Key Management', () => {
        let apiKey;

        test('should create API key', async () => {
            const response = await request(app)
                .post('/auth/api-keys')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Integration',
                    permissions: {
                        users: { read: true },
                        audit: { read: true }
                    },
                    expiresIn: '30d'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.apiKey).toBeDefined();
            expect(response.body.apiKey.key).toBeDefined();

            apiKey = response.body.apiKey.key;
        });

        test('should authenticate with API key', async () => {
            const response = await request(app)
                .get('/auth/verify')
                .set('X-API-Key', apiKey);

            expect(response.status).toBe(200);
            expect(response.body.valid).toBe(true);
        });

        test('should list API keys', async () => {
            const response = await request(app)
                .get('/auth/api-keys')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.apiKeys).toBeDefined();
            expect(Array.isArray(response.body.apiKeys)).toBe(true);
        });
    });

    describe('Audit Logging', () => {
        test('should retrieve audit logs', async () => {
            const response = await request(app)
                .get('/auth/audit-logs')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.logs).toBeDefined();
            expect(Array.isArray(response.body.logs)).toBe(true);
            expect(response.body.pagination).toBeDefined();
        });

        test('should filter audit logs by action', async () => {
            const response = await request(app)
                .get('/auth/audit-logs?action=LOGIN_SUCCESS')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.logs).toBeDefined();
            
            // Verify all logs have the filtered action
            response.body.logs.forEach(log => {
                expect(log.action).toBe('LOGIN_SUCCESS');
            });
        });
    });

    describe('Security Dashboard', () => {
        test('should retrieve security metrics', async () => {
            const response = await request(app)
                .get('/auth/security-dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.metrics).toBeDefined();
            expect(response.body.metrics.activeUsers).toBeDefined();
            expect(response.body.metrics.activeSessions).toBeDefined();
            expect(response.body.metrics.failedLoginsLast24h).toBeDefined();
            expect(response.body.metrics.mfaEnabledUsers).toBeDefined();
            expect(response.body.metrics.activeApiKeys).toBeDefined();
        });
    });

    describe('Compliance Reporting', () => {
        test('should list compliance frameworks', async () => {
            const response = await request(app)
                .get('/auth/compliance/frameworks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.frameworks).toBeDefined();
            expect(Array.isArray(response.body.frameworks)).toBe(true);
            expect(response.body.frameworks.length).toBeGreaterThan(0);
        });

        test('should get compliance status', async () => {
            const response = await request(app)
                .get('/auth/compliance/status')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.complianceScore).toBeDefined();
            expect(response.body.status).toBeDefined();
            expect(response.body.keyMetrics).toBeDefined();
        });

        test('should generate JSON compliance report', async () => {
            const response = await request(app)
                .get('/auth/compliance/report?framework=SOC2&format=json')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.metadata).toBeDefined();
            expect(response.body.metadata.framework).toBe('SOC 2 Type II');
            expect(response.body.executiveSummary).toBeDefined();
            expect(response.body.metrics).toBeDefined();
            expect(response.body.recommendations).toBeDefined();
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits on authentication endpoints', async () => {
            // Make multiple rapid requests
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(app)
                        .post('/auth/login')
                        .send({
                            email: 'ratelimit@test.com',
                            password: 'TestPassword123!'
                        })
                );
            }

            const responses = await Promise.all(promises);
            
            // Some requests should be rate limited
            const rateLimited = responses.filter(r => r.status === 429);
            expect(rateLimited.length).toBeGreaterThan(0);
        });
    });

    describe('Tenant Isolation', () => {
        let otherCompanyId;
        let otherCompanyToken;

        beforeAll(async () => {
            // Create another company
            const response = await request(app)
                .post('/auth/register-company')
                .send({
                    companyName: 'Test Other Corp',
                    adminEmail: 'admin@testother.com',
                    adminPassword: 'OtherPassword123!',
                    adminFirstName: 'Other',
                    adminLastName: 'Admin'
                });

            otherCompanyId = response.body.company.id;

            // Login as other company admin
            const loginResponse = await request(app)
                .post('/auth/login')
                .send({
                    email: 'admin@testother.com',
                    password: 'OtherPassword123!'
                });

            otherCompanyToken = loginResponse.body.tokens.accessToken;
        });

        test('should not access other company users', async () => {
            const response = await request(app)
                .get('/auth/users')
                .set('Authorization', `Bearer ${otherCompanyToken}`);

            expect(response.status).toBe(200);
            expect(response.body.users).toBeDefined();
            
            // Should not see users from the first test company
            const otherCompanyUsers = response.body.users.filter(u => 
                u.email === 'admin@test.com' || u.email === 'newuser@test.com'
            );
            expect(otherCompanyUsers.length).toBe(0);
        });

        test('should not access other company audit logs', async () => {
            const response = await request(app)
                .get('/auth/audit-logs')
                .set('Authorization', `Bearer ${otherCompanyToken}`);

            expect(response.status).toBe(200);
            expect(response.body.logs).toBeDefined();
            
            // All logs should be from the other company only
            response.body.logs.forEach(log => {
                expect(log.company_id).toBe(otherCompanyId);
            });
        });
    });
});