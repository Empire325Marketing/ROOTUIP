// ROOTUIP Enterprise Authentication Middleware
// Comprehensive authentication, authorization, and security middleware

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const SecurityConfig = require('../config/security-config');
const CryptoUtils = require('../utils/crypto-utils');

class AuthMiddleware {
    constructor(database) {
        this.db = database;
        this.config = SecurityConfig;
        this.crypto = CryptoUtils;
        
        // Initialize rate limiters
        this.rateLimiters = this.createRateLimiters();
    }

    // Security Headers Middleware
    securityHeaders() {
        return helmet({
            contentSecurityPolicy: this.config.securityHeaders.contentSecurityPolicy,
            hsts: this.config.securityHeaders.hsts,
            noSniff: this.config.securityHeaders.noSniff,
            frameguard: this.config.securityHeaders.frameguard,
            xssFilter: this.config.securityHeaders.xssFilter,
            referrerPolicy: this.config.securityHeaders.referrerPolicy
        });
    }

    // Rate Limiting Middleware
    createRateLimiters() {
        const limiters = {};
        
        for (const [name, config] of Object.entries(this.config.rateLimiting)) {
            limiters[name] = rateLimit({
                ...config,
                handler: (req, res) => {
                    this.logSecurityEvent(req, 'rate_limit_exceeded', {
                        limiter: name,
                        ip: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                    
                    res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: config.message?.error || 'Too many requests',
                        retryAfter: config.message?.retryAfter || 'Please try again later'
                    });
                }
            });
        }
        
        return limiters;
    }

    // JWT Authentication Middleware
    authenticateJWT() {
        return async (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        message: 'Valid Bearer token required'
                    });
                }
                
                const token = authHeader.substring(7);
                
                // Verify JWT token
                const decoded = jwt.verify(token, this.config.jwt.accessTokenSecret, {
                    issuer: this.config.jwt.issuer,
                    audience: this.config.jwt.audience,
                    algorithm: this.config.jwt.algorithm
                });
                
                // Get user from database with company info
                const user = await this.getUserWithCompany(decoded.userId);
                if (!user) {
                    return res.status(401).json({
                        error: 'Invalid token',
                        message: 'User not found'
                    });
                }
                
                // Check if user account is active
                if (user.status !== 'active') {
                    return res.status(401).json({
                        error: 'Account inactive',
                        message: 'User account is not active'
                    });
                }
                
                // Check if company is active
                if (user.company_status !== 'active') {
                    return res.status(401).json({
                        error: 'Company inactive',
                        message: 'Company account is not active'
                    });
                }
                
                // Verify session is still valid
                if (decoded.sessionId) {
                    const session = await this.getActiveSession(decoded.sessionId);
                    if (!session) {
                        return res.status(401).json({
                            error: 'Session expired',
                            message: 'Session is no longer valid'
                        });
                    }
                    
                    // Update session activity
                    await this.updateSessionActivity(decoded.sessionId, req.ip);
                }
                
                // Add user info to request
                req.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    companyId: user.company_id,
                    companyName: user.company_name,
                    subscriptionTier: user.subscription_tier,
                    permissions: user.permissions || [],
                    sessionId: decoded.sessionId
                };
                
                // Log successful authentication
                this.logAuditEvent(req, 'auth.token_validated', {
                    userId: user.id,
                    sessionId: decoded.sessionId
                });
                
                next();
            } catch (error) {
                if (error instanceof jwt.JsonWebTokenError) {
                    this.logSecurityEvent(req, 'invalid_jwt_token', {
                        error: error.message,
                        token: req.headers.authorization?.substring(0, 20) + '...'
                    });
                    
                    return res.status(401).json({
                        error: 'Invalid token',
                        message: 'Token is malformed or invalid'
                    });
                }
                
                if (error instanceof jwt.TokenExpiredError) {
                    return res.status(401).json({
                        error: 'Token expired',
                        message: 'Please refresh your token'
                    });
                }
                
                console.error('JWT authentication error:', error);
                return res.status(500).json({
                    error: 'Authentication error',
                    message: 'Internal authentication error'
                });
            }
        };
    }

    // API Key Authentication Middleware
    authenticateApiKey() {
        return async (req, res, next) => {
            try {
                const apiKey = req.headers['x-api-key'];
                
                if (!apiKey) {
                    return res.status(401).json({
                        error: 'API key required',
                        message: 'Please provide your API key in the x-api-key header'
                    });
                }
                
                // Validate API key format
                if (!apiKey.startsWith(this.config.apiKey.prefix)) {
                    return res.status(401).json({
                        error: 'Invalid API key format',
                        message: 'API key format is invalid'
                    });
                }
                
                // Get API key from database
                const keyPrefix = this.crypto.getApiKeyPrefix(apiKey);
                const apiKeyRecord = await this.getApiKeyByPrefix(keyPrefix);
                
                if (!apiKeyRecord) {
                    this.logSecurityEvent(req, 'invalid_api_key', {
                        keyPrefix,
                        ip: req.ip
                    });
                    
                    return res.status(401).json({
                        error: 'Invalid API key',
                        message: 'API key not found'
                    });
                }
                
                // Verify API key hash
                const isValid = await this.crypto.verifyApiKey(apiKey, apiKeyRecord.key_hash);
                if (!isValid) {
                    this.logSecurityEvent(req, 'api_key_hash_mismatch', {
                        keyId: apiKeyRecord.id,
                        ip: req.ip
                    });
                    
                    return res.status(401).json({
                        error: 'Invalid API key',
                        message: 'API key verification failed'
                    });
                }
                
                // Check if API key is active and not expired
                if (!apiKeyRecord.is_active) {
                    return res.status(401).json({
                        error: 'API key inactive',
                        message: 'API key has been deactivated'
                    });
                }
                
                if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
                    return res.status(401).json({
                        error: 'API key expired',
                        message: 'API key has expired'
                    });
                }
                
                // Check rate limiting for this API key
                const rateLimitKey = this.crypto.generateRateLimitKey(apiKeyRecord.id, req.path);
                const rateLimit = await this.checkApiKeyRateLimit(apiKeyRecord.id, apiKeyRecord.rate_limit);
                
                if (!rateLimit.allowed) {
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: 'API key rate limit exceeded',
                        resetTime: rateLimit.resetTime
                    });
                }
                
                // Get user and company info
                const user = await this.getUserWithCompany(apiKeyRecord.user_id);
                if (!user || user.status !== 'active' || user.company_status !== 'active') {
                    return res.status(401).json({
                        error: 'Account inactive',
                        message: 'Associated user or company account is inactive'
                    });
                }
                
                // Update API key usage
                await this.updateApiKeyUsage(apiKeyRecord.id);
                
                // Add API key info to request
                req.apiKey = {
                    id: apiKeyRecord.id,
                    name: apiKeyRecord.name,
                    scopes: apiKeyRecord.scopes,
                    userId: apiKeyRecord.user_id,
                    companyId: apiKeyRecord.company_id
                };
                
                req.user = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    companyId: user.company_id,
                    companyName: user.company_name,
                    subscriptionTier: user.subscription_tier,
                    permissions: apiKeyRecord.scopes,
                    authMethod: 'api_key'
                };
                
                // Log API key usage
                this.logAuditEvent(req, 'api_key.used', {
                    apiKeyId: apiKeyRecord.id,
                    apiKeyName: apiKeyRecord.name,
                    userId: user.id
                });
                
                next();
            } catch (error) {
                console.error('API key authentication error:', error);
                return res.status(500).json({
                    error: 'Authentication error',
                    message: 'Internal authentication error'
                });
            }
        };
    }

    // Role-Based Authorization Middleware
    requireRole(requiredRoles) {
        if (typeof requiredRoles === 'string') {
            requiredRoles = [requiredRoles];
        }
        
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
            }
            
            if (!requiredRoles.includes(req.user.role)) {
                this.logSecurityEvent(req, 'insufficient_role', {
                    userId: req.user.id,
                    userRole: req.user.role,
                    requiredRoles
                });
                
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: `Role '${req.user.role}' is not authorized for this action`
                });
            }
            
            next();
        };
    }

    // Permission-Based Authorization Middleware
    requirePermission(requiredPermissions) {
        if (typeof requiredPermissions === 'string') {
            requiredPermissions = [requiredPermissions];
        }
        
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
            }
            
            const userPermissions = req.user.permissions || [];
            const hasPermission = requiredPermissions.some(permission => 
                userPermissions.includes(permission)
            );
            
            if (!hasPermission) {
                this.logSecurityEvent(req, 'insufficient_permissions', {
                    userId: req.user.id,
                    userPermissions,
                    requiredPermissions
                });
                
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: 'User does not have required permissions'
                });
            }
            
            next();
        };
    }

    // Company-Level Authorization (multi-tenancy)
    requireCompanyAccess() {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User must be authenticated'
                });
            }
            
            // Extract company ID from request (URL parameter, body, etc.)
            const requestedCompanyId = req.params.companyId || req.body.companyId || req.query.companyId;
            
            if (requestedCompanyId && requestedCompanyId !== req.user.companyId) {
                this.logSecurityEvent(req, 'unauthorized_company_access', {
                    userId: req.user.id,
                    userCompanyId: req.user.companyId,
                    requestedCompanyId
                });
                
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Cannot access resources of another company'
                });
            }
            
            next();
        };
    }

    // IP Allowlist Middleware
    enforceIPAllowlist() {
        return async (req, res, next) => {
            if (!this.config.ipAllowlist.enabled) {
                return next();
            }
            
            try {
                const clientIP = this.getClientIP(req);
                const companyId = req.user?.companyId;
                
                if (!companyId) {
                    return next(); // Skip for non-authenticated requests
                }
                
                // Check if IP is allowed for this company
                const isAllowed = await this.isIPAllowed(companyId, clientIP);
                
                if (!isAllowed) {
                    this.logSecurityEvent(req, 'ip_not_allowed', {
                        userId: req.user?.id,
                        companyId,
                        clientIP: this.crypto.hashIP(clientIP)
                    });
                    
                    return res.status(403).json({
                        error: 'Access denied',
                        message: 'Access from this IP address is not allowed'
                    });
                }
                
                next();
            } catch (error) {
                console.error('IP allowlist check error:', error);
                return res.status(500).json({
                    error: 'Security check failed',
                    message: 'Unable to verify IP allowlist'
                });
            }
        };
    }

    // CSRF Protection Middleware
    csrfProtection() {
        return (req, res, next) => {
            // Skip CSRF for API key authentication
            if (req.apiKey) {
                return next();
            }
            
            // Skip for GET, HEAD, OPTIONS
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }
            
            const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
            const sessionCSRF = req.session?.csrfToken;
            
            if (!csrfToken || !sessionCSRF) {
                return res.status(403).json({
                    error: 'CSRF token required',
                    message: 'CSRF token is missing'
                });
            }
            
            if (!this.crypto.verifyCSRFToken(csrfToken, sessionCSRF)) {
                this.logSecurityEvent(req, 'csrf_token_invalid', {
                    userId: req.user?.id,
                    providedToken: csrfToken.substring(0, 8) + '...'
                });
                
                return res.status(403).json({
                    error: 'Invalid CSRF token',
                    message: 'CSRF token verification failed'
                });
            }
            
            next();
        };
    }

    // Input Validation Middleware
    validateRegistration() {
        return [
            body('email')
                .isEmail()
                .normalizeEmail()
                .withMessage('Valid email address is required'),
            body('password')
                .isLength({ min: 8 })
                .withMessage('Password must be at least 8 characters long'),
            body('firstName')
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('First name is required and must be less than 100 characters'),
            body('lastName')
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Last name is required and must be less than 100 characters'),
            body('companyName')
                .trim()
                .isLength({ min: 2, max: 255 })
                .withMessage('Company name is required and must be 2-255 characters'),
            this.handleValidationErrors()
        ];
    }

    validateLogin() {
        return [
            body('email')
                .isEmail()
                .normalizeEmail()
                .withMessage('Valid email address is required'),
            body('password')
                .notEmpty()
                .withMessage('Password is required'),
            this.handleValidationErrors()
        ];
    }

    handleValidationErrors() {
        return (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    errors: errors.array()
                });
            }
            next();
        };
    }

    // Session Management
    async createSession(userId, req) {
        const sessionId = this.crypto.generateSessionId();
        const refreshToken = this.crypto.generateRefreshToken();
        const refreshTokenHash = await this.crypto.hashRefreshToken(refreshToken);
        
        const deviceFingerprint = this.crypto.generateDeviceFingerprint(
            req.get('User-Agent'),
            req.get('Accept-Language'),
            req.get('Accept-Encoding'),
            req.headers
        );
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
        
        await this.db.query(`
            INSERT INTO user_sessions (
                id, user_id, refresh_token_hash, ip_address, user_agent,
                device_fingerprint, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            sessionId,
            userId,
            refreshTokenHash,
            this.getClientIP(req),
            req.get('User-Agent'),
            deviceFingerprint,
            expiresAt
        ]);
        
        return { sessionId, refreshToken };
    }

    // Utility Methods
    async getUserWithCompany(userId) {
        const result = await this.db.query(`
            SELECT u.*, c.name as company_name, c.status as company_status,
                   c.subscription_tier
            FROM users u
            JOIN companies c ON u.company_id = c.id
            WHERE u.id = $1
        `, [userId]);
        
        return result.rows[0];
    }

    async getActiveSession(sessionId) {
        const result = await this.db.query(`
            SELECT * FROM user_sessions
            WHERE id = $1 AND is_active = true AND expires_at > NOW()
        `, [sessionId]);
        
        return result.rows[0];
    }

    async updateSessionActivity(sessionId, ipAddress) {
        await this.db.query(`
            UPDATE user_sessions
            SET last_activity = NOW(), ip_address = $2
            WHERE id = $1
        `, [sessionId, ipAddress]);
    }

    async getApiKeyByPrefix(keyPrefix) {
        const result = await this.db.query(`
            SELECT * FROM api_keys
            WHERE key_prefix = $1 AND is_active = true
        `, [keyPrefix]);
        
        return result.rows[0];
    }

    async updateApiKeyUsage(apiKeyId) {
        await this.db.query(`
            UPDATE api_keys
            SET last_used = NOW(), total_requests = total_requests + 1
            WHERE id = $1
        `, [apiKeyId]);
    }

    async checkApiKeyRateLimit(apiKeyId, limit) {
        // Implement rate limiting logic (use Redis for production)
        // This is a simplified version
        return { allowed: true };
    }

    async isIPAllowed(companyId, clientIP) {
        const result = await this.db.query(`
            SELECT COUNT(*) as count
            FROM company_ip_allowlists
            WHERE company_id = $1 AND is_active = true
        `, [companyId]);
        
        const hasAllowlist = parseInt(result.rows[0].count) > 0;
        
        if (!hasAllowlist) {
            return true; // No allowlist configured, allow all IPs
        }
        
        const ipCheck = await this.db.query(`
            SELECT COUNT(*) as count
            FROM company_ip_allowlists
            WHERE company_id = $1 AND is_active = true AND ip_range >> $2::inet
        `, [companyId, clientIP]);
        
        return parseInt(ipCheck.rows[0].count) > 0;
    }

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    }

    // Logging Methods
    async logAuditEvent(req, action, details = {}) {
        try {
            await this.db.query(`
                INSERT INTO audit_logs (
                    user_id, company_id, action, ip_address, user_agent,
                    success, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                req.user?.id,
                req.user?.companyId,
                action,
                this.getClientIP(req),
                req.get('User-Agent'),
                true,
                JSON.stringify(details)
            ]);
        } catch (error) {
            console.error('Failed to log audit event:', error);
        }
    }

    async logSecurityEvent(req, eventType, details = {}) {
        try {
            await this.db.query(`
                INSERT INTO security_events (
                    event_type, user_id, company_id, ip_address,
                    description, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                eventType,
                req.user?.id,
                req.user?.companyId,
                this.getClientIP(req),
                `Security event: ${eventType}`,
                JSON.stringify(details)
            ]);
        } catch (error) {
            console.error('Failed to log security event:', error);
        }
    }
}

module.exports = AuthMiddleware;