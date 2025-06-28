/**
 * ROOTUIP Security Middleware Configuration
 * Implements rate limiting, security headers, and request validation
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting configurations
const rateLimiters = {
    // General API rate limit
    general: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: req.rateLimit.resetTime
            });
        }
    }),

    // Strict rate limit for auth endpoints
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per 15 minutes
        skipSuccessfulRequests: true,
        message: 'Too many authentication attempts, please try again later.',
        standardHeaders: true,
        legacyHeaders: false
    }),

    // ML prediction rate limit
    mlPrediction: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 50, // 50 predictions per minute
        message: 'ML prediction rate limit exceeded.',
        standardHeaders: true,
        legacyHeaders: false
    }),

    // Document processing rate limit
    documentProcessing: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 20, // 20 documents per minute
        message: 'Document processing rate limit exceeded.',
        standardHeaders: true,
        legacyHeaders: false
    }),

    // Premium tier rate limit
    premium: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 1000, // 1000 requests per minute
        message: 'Premium rate limit exceeded.',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use API key for premium users
            return req.headers['x-api-key'] || req.ip;
        }
    })
};

// Security headers configuration
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.rootuip.com", "wss://"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://rootuip.com',
            'https://www.rootuip.com',
            'https://app.rootuip.com',
            'http://localhost:3000',
            'http://localhost:3001'
        ];
        
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};

// Request validation middleware
const validateRequest = (req, res, next) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
        /(\.\.\/)/, // Path traversal
        /(<script|<iframe|javascript:)/i, // XSS attempts
        /(union.*select|drop.*table|insert.*into|delete.*from)/i, // SQL injection
        /(\$where|\$ne|\$gt|\$lt)/i // NoSQL injection
    ];
    
    const requestString = JSON.stringify(req.body) + JSON.stringify(req.query) + req.path;
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestString)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'Request contains invalid characters or patterns'
            });
        }
    }
    
    next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'Missing API key',
            message: 'X-API-Key header is required'
        });
    }
    
    // In production, validate against database
    // For now, check format
    if (!/^[a-zA-Z0-9]{32,}$/.test(apiKey)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid API key',
            message: 'API key format is invalid'
        });
    }
    
    next();
};

// Apply security middleware
const applySecurityMiddleware = (app) => {
    // Basic security headers
    app.use(securityHeaders);
    
    // CORS
    app.use(cors(corsOptions));
    
    // Body parsing security
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Prevent NoSQL injection
    app.use(mongoSanitize());
    
    // Prevent XSS attacks
    app.use(xss());
    
    // Prevent HTTP Parameter Pollution
    app.use(hpp());
    
    // Request validation
    app.use(validateRequest);
    
    // Trust proxy (for accurate rate limiting behind reverse proxy)
    app.set('trust proxy', 1);
    
    // Apply rate limiting to specific routes
    app.use('/api/', rateLimiters.general);
    app.use('/auth/', rateLimiters.auth);
    app.use('/ml/predict-dd-risk', rateLimiters.mlPrediction);
    app.use('/ml/process-document', rateLimiters.documentProcessing);
    
    // Log security events
    app.use((req, res, next) => {
        // Log suspicious activities
        if (res.statusCode === 429) {
            console.log(`[SECURITY] Rate limit exceeded: ${req.ip} - ${req.path}`);
        }
        next();
    });
};

module.exports = {
    rateLimiters,
    securityHeaders,
    corsOptions,
    validateRequest,
    validateApiKey,
    applySecurityMiddleware
};