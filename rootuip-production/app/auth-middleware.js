// JWT Authentication Middleware for ROOTUIP APIs
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

class AuthMiddleware {
    constructor() {
        // Use environment variable or generate a strong secret
        this.JWT_SECRET = process.env.JWT_SECRET || this.generateSecret();
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
        
        // Store API keys (in production, use database)
        this.apiKeys = new Map();
        
        // Initialize with a default API key for testing
        this.createApiKey('default', 'rootuip-default-key-2024');
    }
    
    generateSecret() {
        // Generate a cryptographically secure random secret
        const crypto = require('crypto');
        return crypto.randomBytes(64).toString('hex');
    }
    
    // Create API key for a client
    async createApiKey(clientName, apiKey) {
        const hashedKey = await bcrypt.hash(apiKey, 10);
        this.apiKeys.set(clientName, {
            key: hashedKey,
            created: new Date(),
            permissions: ['read', 'write']
        });
        
        console.log(`API Key created for ${clientName}`);
        console.log(`Use this key in your requests: ${apiKey}`);
        
        return apiKey;
    }
    
    // Generate JWT token
    generateToken(payload) {
        return jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.JWT_EXPIRES_IN,
            issuer: 'rootuip.com',
            audience: 'rootuip-api'
        });
    }
    
    // Verify JWT token
    verifyToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET, {
                issuer: 'rootuip.com',
                audience: 'rootuip-api'
            });
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    
    // JWT Authentication Middleware
    authenticate() {
        return async (req, res, next) => {
            try {
                // Check for Bearer token in Authorization header
                const authHeader = req.headers.authorization;
                
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        message: 'Please provide a valid Bearer token'
                    });
                }
                
                const token = authHeader.substring(7);
                const decoded = this.verifyToken(token);
                
                // Add user info to request
                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({
                    error: 'Authentication failed',
                    message: error.message
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
                
                // Verify API key
                let validKey = false;
                for (const [client, data] of this.apiKeys) {
                    if (await bcrypt.compare(apiKey, data.key)) {
                        req.client = client;
                        req.permissions = data.permissions;
                        validKey = true;
                        break;
                    }
                }
                
                if (!validKey) {
                    return res.status(401).json({
                        error: 'Invalid API key',
                        message: 'The provided API key is not valid'
                    });
                }
                
                next();
            } catch (error) {
                return res.status(500).json({
                    error: 'Authentication error',
                    message: error.message
                });
            }
        };
    }
    
    // Rate limiting middleware
    createRateLimiter(options = {}) {
        const defaults = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        };
        
        return rateLimit({ ...defaults, ...options });
    }
    
    // Specific rate limiters for different endpoints
    getRateLimiters() {
        return {
            // Strict limit for auth endpoints
            auth: this.createRateLimiter({
                windowMs: 15 * 60 * 1000,
                max: 5,
                message: 'Too many authentication attempts, please try again later.'
            }),
            
            // Standard limit for API endpoints
            api: this.createRateLimiter({
                windowMs: 15 * 60 * 1000,
                max: 100
            }),
            
            // Relaxed limit for public endpoints
            public: this.createRateLimiter({
                windowMs: 15 * 60 * 1000,
                max: 200
            }),
            
            // Very strict limit for expensive operations
            expensive: this.createRateLimiter({
                windowMs: 60 * 60 * 1000, // 1 hour
                max: 10,
                message: 'Rate limit exceeded for resource-intensive operations.'
            })
        };
    }
    
    // Input validation middleware
    validateInput(schema) {
        return (req, res, next) => {
            const errors = [];
            
            // Basic validation example - in production use Joi or Yup
            for (const [field, rules] of Object.entries(schema)) {
                const value = req.body[field];
                
                if (rules.required && !value) {
                    errors.push(`${field} is required`);
                }
                
                if (rules.type && value && typeof value !== rules.type) {
                    errors.push(`${field} must be of type ${rules.type}`);
                }
                
                if (rules.minLength && value && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                
                if (rules.maxLength && value && value.length > rules.maxLength) {
                    errors.push(`${field} must not exceed ${rules.maxLength} characters`);
                }
                
                if (rules.pattern && value && !rules.pattern.test(value)) {
                    errors.push(`${field} has invalid format`);
                }
            }
            
            if (errors.length > 0) {
                return res.status(400).json({
                    error: 'Validation failed',
                    errors
                });
            }
            
            next();
        };
    }
    
    // Sanitize input to prevent XSS
    sanitizeInput() {
        return (req, res, next) => {
            const sanitize = (obj) => {
                for (const key in obj) {
                    if (typeof obj[key] === 'string') {
                        // Remove script tags and encode HTML entities
                        obj[key] = obj[key]
                            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#x27;')
                            .replace(/\//g, '&#x2F;');
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        sanitize(obj[key]);
                    }
                }
            };
            
            if (req.body) sanitize(req.body);
            if (req.query) sanitize(req.query);
            if (req.params) sanitize(req.params);
            
            next();
        };
    }
    
    // CORS configuration
    getCorsOptions() {
        return {
            origin: function (origin, callback) {
                const allowedOrigins = [
                    'https://rootuip.com',
                    'https://www.rootuip.com',
                    'https://demo.rootuip.com',
                    'https://sales.rootuip.com',
                    'http://localhost:3000',
                    'http://localhost:3018'
                ];
                
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin) return callback(null, true);
                
                if (allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            optionsSuccessStatus: 200,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
        };
    }
    
    // Permission checking middleware
    checkPermission(requiredPermission) {
        return (req, res, next) => {
            const userPermissions = req.user?.permissions || req.permissions || [];
            
            if (!userPermissions.includes(requiredPermission)) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: `This action requires ${requiredPermission} permission`
                });
            }
            
            next();
        };
    }
    
    // Logging middleware for security monitoring
    securityLogger() {
        return (req, res, next) => {
            const log = {
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                authenticated: !!req.user || !!req.client
            };
            
            // In production, send to logging service
            console.log('Security Log:', JSON.stringify(log));
            
            next();
        };
    }
}

module.exports = AuthMiddleware;