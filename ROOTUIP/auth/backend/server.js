/**
 * UIP Enterprise Authentication System
 * Production-ready Node.js/Express backend with enterprise security
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const validator = require('validator');
const xss = require('xss');
const winston = require('winston');
const morgan = require('morgan');
const httpStatus = require('http-status');

// Configuration
const config = {
    port: process.env.PORT || 3001,
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'uip_auth',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    bcrypt: {
        saltRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
    },
    email: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    },
    sms: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER
    },
    security: {
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 480, // 8 hours in minutes
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15, // minutes
        passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY) || 60, // minutes
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15, // minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    app: {
        name: 'UIP Enterprise Platform',
        url: process.env.APP_URL || 'https://uip.enterprise.com',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@uip.enterprise.com'
    }
};

// Logger setup
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'uip-auth' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Database connection
const db = new Pool(config.database);

// Email transporter
const emailTransporter = nodemailer.createTransporter(config.email);

// SMS client
const smsClient = config.sms.accountSid ? twilio(config.sms.accountSid, config.sms.authToken) : null;

// Express app setup
const app = express();

// Trust proxy for rate limiting behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            baseUri: ["'self'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-API-Key']
}));

// Basic middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// Rate limiting
const createRateLimit = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
        res.status(httpStatus.TOO_MANY_REQUESTS).json({ error: message });
    }
});

// Global rate limiting
app.use(createRateLimit(
    config.security.rateLimitWindow * 60 * 1000,
    config.security.rateLimitMax,
    'Too many requests from this IP'
));

// Auth endpoint rate limiting
const authRateLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts');
const passwordResetRateLimit = createRateLimit(60 * 60 * 1000, 3, 'Too many password reset attempts');

// Slow down suspicious requests
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500,
    maxDelayMs: 20000
});
app.use(speedLimiter);

// CSRF protection (excluding API endpoints)
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
});

// Utility functions
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return xss(input.trim());
    }
    return input;
};

const validateEmail = (email) => {
    return validator.isEmail(email) && email.length <= 255;
};

const validatePassword = (password, policy = {}) => {
    const defaultPolicy = {
        min_length: 12,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_symbols: true
    };
    
    const rules = { ...defaultPolicy, ...policy };
    const errors = [];
    
    if (password.length < rules.min_length) {
        errors.push(`Password must be at least ${rules.min_length} characters long`);
    }
    
    if (rules.require_uppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (rules.require_lowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (rules.require_numbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (rules.require_symbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    return errors;
};

const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

const hashPassword = async (password, salt) => {
    return await bcrypt.hash(password + salt, config.bcrypt.saltRounds);
};

const verifyPassword = async (password, salt, hash) => {
    return await bcrypt.compare(password + salt, hash);
};

const generateJWT = (payload, expiresIn = config.jwt.expiresIn) => {
    return jwt.sign(payload, config.jwt.secret, { expiresIn });
};

const verifyJWT = (token) => {
    return jwt.verify(token, config.jwt.secret);
};

// Database helper functions
const dbQuery = async (text, params = []) => {
    const client = await db.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
};

const setCompanyContext = async (client, companyId) => {
    await client.query('SET app.current_company_id = $1', [companyId]);
};

// Audit logging function
const logAuditEvent = async (data) => {
    try {
        await dbQuery(`
            SELECT log_user_action($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
            data.companyId, data.userId, data.action, data.resourceType, data.resourceId,
            data.oldValues, data.newValues, data.ipAddress, data.userAgent, data.sessionId,
            data.apiKeyId, data.success, data.errorMessage, data.metadata
        ]);
    } catch (error) {
        logger.error('Failed to log audit event:', error);
    }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const apiKey = req.headers['x-api-key'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (apiKey) {
            // API Key authentication
            const result = await dbQuery(`
                SELECT ak.*, u.id as user_id, u.company_id, u.is_active as user_active
                FROM api_keys ak
                JOIN users u ON ak.user_id = u.id
                WHERE ak.key_hash = $1 AND ak.is_active = true AND ak.expires_at > NOW()
            `, [crypto.createHash('sha256').update(apiKey).digest('hex')]);
            
            if (result.rows.length === 0) {
                return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid API key' });
            }
            
            const apiKeyData = result.rows[0];
            
            if (!apiKeyData.user_active) {
                return res.status(httpStatus.UNAUTHORIZED).json({ error: 'User account is disabled' });
            }
            
            // Update last used
            await dbQuery('UPDATE api_keys SET last_used_at = NOW(), last_used_ip = $1 WHERE id = $2', 
                [req.ip, apiKeyData.id]);
            
            req.user = {
                id: apiKeyData.user_id,
                companyId: apiKeyData.company_id,
                apiKeyId: apiKeyData.id,
                permissions: apiKeyData.permissions
            };
            
        } else if (token) {
            // JWT authentication
            const decoded = verifyJWT(token);
            
            const result = await dbQuery(`
                SELECT u.*, c.name as company_name, r.permissions
                FROM users u
                JOIN companies c ON u.company_id = c.id
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1 AND u.is_active = true
            `, [decoded.userId]);
            
            if (result.rows.length === 0) {
                return res.status(httpStatus.UNAUTHORIZED).json({ error: 'User not found or inactive' });
            }
            
            req.user = {
                ...result.rows[0],
                sessionId: decoded.sessionId
            };
            
            // Update session activity
            await dbQuery('UPDATE user_sessions SET last_activity = NOW() WHERE id = $1', [decoded.sessionId]);
            
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Access token required' });
        }
        
        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid token' });
    }
};

// Permission checking middleware
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissions) {
            return res.status(httpStatus.FORBIDDEN).json({ error: 'Insufficient permissions' });
        }
        
        const permissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
        
        if (!permissions.includes(permission) && !permissions.includes('system.admin')) {
            return res.status(httpStatus.FORBIDDEN).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
};

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Get CSRF token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// User registration
app.post('/api/auth/register', authRateLimit, csrfProtection, async (req, res) => {
    try {
        const { email, password, firstName, lastName, companyName, companyDomain } = req.body;
        
        // Sanitize inputs
        const sanitizedData = {
            email: sanitizeInput(email)?.toLowerCase(),
            firstName: sanitizeInput(firstName),
            lastName: sanitizeInput(lastName),
            companyName: sanitizeInput(companyName),
            companyDomain: sanitizeInput(companyDomain)?.toLowerCase()
        };
        
        // Validation
        if (!validateEmail(sanitizedData.email)) {
            return res.status(httpStatus.BAD_REQUEST).json({ error: 'Invalid email address' });
        }
        
        if (!sanitizedData.firstName || !sanitizedData.lastName) {
            return res.status(httpStatus.BAD_REQUEST).json({ error: 'First name and last name are required' });
        }
        
        if (!sanitizedData.companyName || !sanitizedData.companyDomain) {
            return res.status(httpStatus.BAD_REQUEST).json({ error: 'Company name and domain are required' });
        }
        
        // Check if user already exists
        const existingUser = await dbQuery('SELECT id FROM users WHERE email = $1', [sanitizedData.email]);
        if (existingUser.rows.length > 0) {
            return res.status(httpStatus.CONFLICT).json({ error: 'User already exists' });
        }
        
        // Check if company domain is available
        const existingCompany = await dbQuery('SELECT id FROM companies WHERE domain = $1', [sanitizedData.companyDomain]);
        if (existingCompany.rows.length > 0) {
            return res.status(httpStatus.CONFLICT).json({ error: 'Company domain already taken' });
        }
        
        // Validate password
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            return res.status(httpStatus.BAD_REQUEST).json({ error: passwordErrors.join(', ') });
        }
        
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            // Create company
            const companyResult = await client.query(`
                INSERT INTO companies (name, domain, subdomain)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [sanitizedData.companyName, sanitizedData.companyDomain, sanitizedData.companyDomain]);
            
            const company = companyResult.rows[0];
            
            // Get company admin role
            const roleResult = await client.query(`
                SELECT id FROM roles WHERE name = 'Company Admin' AND is_system_role = true
            `);
            
            const adminRole = roleResult.rows[0];
            
            // Create user
            const salt = generateSecureToken(16);
            const passwordHash = await hashPassword(password, salt);
            const emailVerificationToken = generateSecureToken(32);
            
            const userResult = await client.query(`
                INSERT INTO users (
                    company_id, role_id, email, first_name, last_name,
                    password_hash, password_salt, email_verification_token,
                    email_verification_expires
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                company.id, adminRole.id, sanitizedData.email, sanitizedData.firstName,
                sanitizedData.lastName, passwordHash, salt, emailVerificationToken,
                new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            ]);
            
            const user = userResult.rows[0];
            
            await client.query('COMMIT');
            
            // Send verification email
            if (config.email.auth.user) {
                const verificationUrl = `${config.app.url}/verify-email?token=${emailVerificationToken}`;
                
                await emailTransporter.sendMail({
                    from: `"${config.app.name}" <${config.email.auth.user}>`,
                    to: sanitizedData.email,
                    subject: 'Verify your email address',
                    html: `
                        <h2>Welcome to ${config.app.name}!</h2>
                        <p>Please verify your email address by clicking the link below:</p>
                        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
                        <p>This link will expire in 24 hours.</p>
                        <p>If you didn't create this account, please ignore this email.</p>
                    `
                });
            }
            
            // Log audit event
            await logAuditEvent({
                companyId: company.id,
                userId: user.id,
                action: 'user.register',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: true,
                metadata: { email: sanitizedData.email, companyDomain: sanitizedData.companyDomain }
            });
            
            res.status(httpStatus.CREATED).json({
                message: 'Registration successful. Please check your email to verify your account.',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    emailVerified: false
                }
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Registration failed' });
    }
});

app.listen(config.port, () => {
    logger.info(`UIP Authentication Server running on port ${config.port}`);
});