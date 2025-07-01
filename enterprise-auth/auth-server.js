// ROOTUIP Enterprise Authentication Server
// Complete authentication API with JWT, MFA, and enterprise features

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const PostgresStore = require('connect-pg-simple')(session);

// Import our controllers and middleware
const SecurityConfig = require('./config/security-config');
const AuthMiddleware = require('./middleware/auth-middleware');
const AuthController = require('./controllers/auth-controller');
const UserController = require('./controllers/user-controller');
const CompanyController = require('./controllers/company-controller');

class AuthServer {
    constructor() {
        this.app = express();
        this.db = null;
        this.authMiddleware = null;
        this.authController = null;
        this.userController = null;
        this.companyController = null;
        
        this.setupDatabase();
        this.setupMiddleware();
        this.setupControllers();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupDatabase() {
        // Initialize PostgreSQL connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/rootuip',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test database connection
        this.db.query('SELECT NOW()', (err, result) => {
            if (err) {
                console.error('Database connection failed:', err);
                process.exit(1);
            }
            console.log('Database connected successfully at:', result.rows[0].now);
        });
    }

    setupMiddleware() {
        // Validate security configuration
        const configErrors = SecurityConfig.validate();
        if (configErrors.length > 0) {
            console.error('Security configuration errors:');
            configErrors.forEach(error => console.error(`  - ${error}`));
            process.exit(1);
        }

        // Trust proxy (for production deployment behind load balancer)
        this.app.set('trust proxy', process.env.NODE_ENV === 'production');

        // Initialize auth middleware
        this.authMiddleware = new AuthMiddleware(this.db);

        // Security headers
        this.app.use(this.authMiddleware.securityHeaders());

        // CORS configuration
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || [
                'http://localhost:3000',
                'https://app.rootuip.com',
                'https://customer.rootuip.com'
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-csrf-token'],
            exposedHeaders: ['x-csrf-token']
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(cookieParser());

        // Session management
        this.app.use(session({
            store: new PostgresStore({
                pool: this.db,
                tableName: 'user_sessions'
            }),
            secret: SecurityConfig.csrf.secret,
            resave: false,
            saveUninitialized: false,
            cookie: SecurityConfig.session.secureFlags,
            name: 'rootuip_session'
        }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
            next();
        });

        // Health check endpoint (before authentication)
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            });
        });
    }

    setupControllers() {
        this.authController = new AuthController(this.db);
        this.userController = new UserController(this.db);
        this.companyController = new CompanyController(this.db);
    }

    setupRoutes() {
        // Authentication routes (public)
        const authRouter = express.Router();

        // Rate limiting for authentication endpoints
        authRouter.use('/login', this.authMiddleware.rateLimiters.login);
        authRouter.use('/register', this.authMiddleware.rateLimiters.registration);

        // Public authentication endpoints
        authRouter.post('/register', 
            this.authMiddleware.validateRegistration(),
            (req, res) => this.authController.register(req, res)
        );

        authRouter.post('/login',
            this.authMiddleware.validateLogin(),
            (req, res) => this.authController.login(req, res)
        );

        authRouter.post('/refresh',
            (req, res) => this.authController.refreshToken(req, res)
        );

        // MFA setup and verification (protected)
        authRouter.post('/mfa/setup',
            this.authMiddleware.authenticateJWT(),
            (req, res) => this.authController.setupMFA(req, res)
        );

        authRouter.post('/mfa/verify',
            this.authMiddleware.authenticateJWT(),
            this.authMiddleware.rateLimiters.mfaVerification,
            (req, res) => this.authController.verifyMFA(req, res)
        );

        authRouter.post('/mfa/disable',
            this.authMiddleware.authenticateJWT(),
            (req, res) => this.authController.disableMFA(req, res)
        );

        // Logout (protected)
        authRouter.post('/logout',
            this.authMiddleware.authenticateJWT(),
            (req, res) => this.authController.logout(req, res)
        );

        this.app.use('/api/auth', authRouter);

        // User management routes (protected)
        const userRouter = express.Router();

        // Apply authentication to all user routes
        userRouter.use(this.authMiddleware.authenticateJWT());
        userRouter.use(this.authMiddleware.requireCompanyAccess());

        // User CRUD operations
        userRouter.get('/',
            this.authMiddleware.requireRole(['admin', 'manager']),
            (req, res) => this.userController.getUsers(req, res)
        );

        userRouter.get('/:userId',
            this.authMiddleware.requireRole(['admin', 'manager']),
            (req, res) => this.userController.getUser(req, res)
        );

        userRouter.post('/',
            this.authMiddleware.requireRole(['admin']),
            this.authMiddleware.validateRegistration(),
            (req, res) => this.userController.createUser(req, res)
        );

        userRouter.put('/:userId',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.userController.updateUser(req, res)
        );

        userRouter.delete('/:userId',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.userController.deleteUser(req, res)
        );

        // User management actions
        userRouter.post('/:userId/lock',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.userController.toggleUserLock(req, res)
        );

        userRouter.post('/:userId/reset-password',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.userController.resetUserPassword(req, res)
        );

        userRouter.get('/:userId/permissions',
            this.authMiddleware.requireRole(['admin', 'manager']),
            (req, res) => this.userController.getUserPermissions(req, res)
        );

        this.app.use('/api/users', userRouter);

        // Company management routes (protected)
        const companyRouter = express.Router();

        // Apply authentication to all company routes
        companyRouter.use(this.authMiddleware.authenticateJWT());
        companyRouter.use(this.authMiddleware.requireCompanyAccess());

        // Company information
        companyRouter.get('/',
            this.authMiddleware.requireRole(['admin', 'manager']),
            (req, res) => this.companyController.getCompany(req, res)
        );

        companyRouter.put('/',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.updateCompany(req, res)
        );

        // Security settings
        companyRouter.get('/security',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.getSecuritySettings(req, res)
        );

        companyRouter.put('/security',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.updateSecuritySettings(req, res)
        );

        // IP allowlist management
        companyRouter.post('/ip-allowlist',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.addIPAllowlist(req, res)
        );

        companyRouter.delete('/ip-allowlist/:allowlistId',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.removeIPAllowlist(req, res)
        );

        // Audit and monitoring
        companyRouter.get('/audit-logs',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.getAuditLogs(req, res)
        );

        companyRouter.get('/statistics',
            this.authMiddleware.requireRole(['admin', 'manager']),
            (req, res) => this.companyController.getStatistics(req, res)
        );

        companyRouter.get('/security-events',
            this.authMiddleware.requireRole(['admin']),
            (req, res) => this.companyController.getSecurityEvents(req, res)
        );

        this.app.use('/api/company', companyRouter);

        // API Key management routes (protected)
        const apiKeyRouter = express.Router();

        // Apply authentication and API rate limiting
        apiKeyRouter.use(this.authMiddleware.rateLimiters.api);

        // Support both JWT and API key authentication for API routes
        apiKeyRouter.use((req, res, next) => {
            // Try JWT first, then API key
            const authHeader = req.headers.authorization;
            const apiKey = req.headers['x-api-key'];

            if (authHeader && authHeader.startsWith('Bearer ')) {
                return this.authMiddleware.authenticateJWT()(req, res, next);
            } else if (apiKey) {
                return this.authMiddleware.authenticateApiKey()(req, res, next);
            } else {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'Please provide either Bearer token or API key'
                });
            }
        });

        // API key management endpoints
        apiKeyRouter.get('/',
            this.authMiddleware.requireRole(['admin', 'manager']),
            async (req, res) => {
                try {
                    const result = await this.db.query(`
                        SELECT id, name, key_prefix, scopes, rate_limit, last_used, 
                               total_requests, created_at, expires_at, is_active
                        FROM api_keys
                        WHERE company_id = $1
                        ORDER BY created_at DESC
                    `, [req.user.companyId]);

                    res.json({
                        success: true,
                        data: result.rows
                    });
                } catch (error) {
                    res.status(500).json({
                        error: 'Failed to retrieve API keys',
                        message: error.message
                    });
                }
            }
        );

        apiKeyRouter.post('/',
            this.authMiddleware.requireRole(['admin']),
            async (req, res) => {
                try {
                    const { name, scopes = ['read'], rateLimit, expiresAt } = req.body;

                    // Generate API key
                    const apiKey = SecurityConfig.generateApiKey();
                    const keyPrefix = apiKey.substring(0, 10);
                    const keyHash = await this.authMiddleware.crypto.hashApiKey(apiKey);

                    // Validate rate limit
                    const maxRateLimit = SecurityConfig.getApiRateLimit(req.user.role);
                    const finalRateLimit = Math.min(rateLimit || maxRateLimit, maxRateLimit);

                    const result = await this.db.query(`
                        INSERT INTO api_keys (
                            user_id, company_id, name, key_prefix, key_hash,
                            scopes, rate_limit, expires_at, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING id, name, key_prefix, scopes, rate_limit, created_at
                    `, [
                        req.user.id,
                        req.user.companyId,
                        name,
                        keyPrefix,
                        keyHash,
                        scopes,
                        finalRateLimit,
                        expiresAt,
                        req.user.id
                    ]);

                    res.status(201).json({
                        success: true,
                        message: 'API key created successfully',
                        data: {
                            ...result.rows[0],
                            apiKey: apiKey // Only returned once
                        }
                    });
                } catch (error) {
                    res.status(500).json({
                        error: 'Failed to create API key',
                        message: error.message
                    });
                }
            }
        );

        apiKeyRouter.delete('/:keyId',
            this.authMiddleware.requireRole(['admin']),
            async (req, res) => {
                try {
                    const { keyId } = req.params;

                    await this.db.query(`
                        UPDATE api_keys
                        SET is_active = false, revoked_at = NOW(), revoked_by = $2
                        WHERE id = $1 AND company_id = $3
                    `, [keyId, req.user.id, req.user.companyId]);

                    res.json({
                        success: true,
                        message: 'API key revoked successfully'
                    });
                } catch (error) {
                    res.status(500).json({
                        error: 'Failed to revoke API key',
                        message: error.message
                    });
                }
            }
        );

        this.app.use('/api/keys', apiKeyRouter);

        // CSRF token endpoint
        this.app.get('/api/csrf-token', (req, res) => {
            const csrfToken = this.authMiddleware.crypto.generateCSRFToken();
            req.session.csrfToken = this.authMiddleware.crypto.hashCSRFToken(csrfToken);
            
            res.json({
                success: true,
                data: { csrfToken }
            });
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'The requested endpoint does not exist'
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);

            // Log error to audit trail
            if (req.user) {
                this.authMiddleware.logAuditEvent(req, 'system.error', {
                    error: err.message,
                    stack: err.stack
                });
            }

            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
            });
        });

        // Graceful shutdown handling
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            this.shutdown();
        });

        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down gracefully');
            this.shutdown();
        });
    }

    async shutdown() {
        console.log('Closing database connections...');
        await this.db.end();
        console.log('Server shutdown complete');
        process.exit(0);
    }

    start(port = process.env.PORT || 3021) {
        this.app.listen(port, () => {
            console.log(`
🚀 ROOTUIP Enterprise Authentication Server
📡 Server running on port ${port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🔒 Security: ${SecurityConfig.jwt.issuer}
📊 Database: Connected
⚡ Status: Ready for enterprise authentication

API Endpoints:
- POST /api/auth/register    - User registration
- POST /api/auth/login       - User login with MFA
- POST /api/auth/refresh     - Token refresh
- POST /api/auth/logout      - User logout
- GET  /api/users           - List company users
- GET  /api/company         - Company settings
- GET  /api/keys            - API key management
- GET  /api/health          - Health check

🔐 Enterprise Features:
✅ JWT Authentication with refresh tokens
✅ Multi-Factor Authentication (TOTP)
✅ Role-based access control (Admin, Manager, Viewer)
✅ API key authentication for integrations
✅ Company-level user management
✅ IP allowlisting and security policies
✅ Comprehensive audit logging
✅ Session management with device tracking
✅ Password policies and enforcement
✅ Rate limiting and security headers
✅ CSRF protection and input validation
            `);
        });
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new AuthServer();
    server.start();
}

module.exports = AuthServer;