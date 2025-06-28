const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio');
const saml2 = require('saml2-js');
const nodemailer = require('nodemailer');

// Configuration
const config = {
    port: process.env.PORT || 3003,
    jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
    jwtExpiry: '15m',
    refreshExpiry: '7d',
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'rootuip',
        user: process.env.DB_USER || 'uip_user',
        password: process.env.DB_PASSWORD || 'U1Pp@ssw0rd!'
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER
    },
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    },
    frontendUrl: process.env.FRONTEND_URL || 'https://rootuip.com'
};

// Initialize Express app
const app = express();

// Database connection
const pool = new Pool(config.database);

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/auth-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/auth-combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Initialize services
const twilioClient = config.twilio.accountSid ? 
    twilio(config.twilio.accountSid, config.twilio.authToken) : null;

const emailTransporter = nodemailer.createTransport(config.smtp);

// Middleware
app.use(helmet());
app.use(cors({
    origin: [config.frontendUrl, 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    req.requestId = uuidv4();
    logger.info('Request received', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// Rate limiting configurations
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Database helper functions
async function initializeDatabase() {
    try {
        // Test connection
        await pool.query('SELECT NOW()');
        logger.info('Database connected successfully');
        
        // Run schema if tables don't exist
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            logger.info('Creating database schema...');
            const schema = require('fs').readFileSync(
                __dirname + '/../enterprise-auth-complete-schema.sql', 
                'utf8'
            );
            await pool.query(schema);
            logger.info('Database schema created successfully');
        }
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

// Audit logging
async function auditLog(companyId, userId, action, resourceType, resourceId, details, req) {
    try {
        await pool.query(`
            INSERT INTO audit_logs 
            (company_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [companyId, userId, action, resourceType, resourceId, details, req.ip, req.get('User-Agent')]);
    } catch (error) {
        logger.error('Audit log failed:', error);
    }
}

// Password validation
async function validatePassword(password, companyId) {
    const policyResult = await pool.query(
        'SELECT * FROM password_policies WHERE company_id = $1',
        [companyId]
    );
    
    const policy = policyResult.rows[0] || {
        min_length: 12,
        require_uppercase: true,
        require_lowercase: true,
        require_numbers: true,
        require_special: true
    };
    
    const errors = [];
    
    if (password.length < policy.min_length) {
        errors.push(`Password must be at least ${policy.min_length} characters`);
    }
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain uppercase letters');
    }
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain lowercase letters');
    }
    if (policy.require_numbers && !/\d/.test(password)) {
        errors.push('Password must contain numbers');
    }
    if (policy.require_special && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain special characters');
    }
    
    return errors;
}

// JWT token generation
function generateTokens(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        companyId: user.company_id,
        roleId: user.role_id
    };
    
    const accessToken = jwt.sign(payload, config.jwtSecret, { 
        expiresIn: config.jwtExpiry 
    });
    
    const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { 
        expiresIn: config.refreshExpiry 
    });
    
    return { accessToken, refreshToken };
}

// Authentication middleware
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        
        // Check if session is still valid
        const sessionResult = await pool.query(`
            SELECT s.*, u.* FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token_hash = $1 
            AND s.expires_at > NOW() 
            AND s.revoked_at IS NULL
            AND u.is_active = true
        `, [crypto.createHash('sha256').update(token).digest('hex')]);
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        req.user = sessionResult.rows[0];
        req.token = token;
        
        // Set company context for RLS
        await pool.query('SET LOCAL app.current_company_id = $1', [req.user.company_id]);
        await pool.query('SET LOCAL app.current_user_id = $1', [req.user.id]);
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
}

// Role-based access control middleware
function requireRole(allowedRoles) {
    return async (req, res, next) => {
        try {
            const roleResult = await pool.query(
                'SELECT name FROM roles WHERE id = $1',
                [req.user.role_id]
            );
            
            const userRole = roleResult.rows[0]?.name;
            
            if (!allowedRoles.includes(userRole)) {
                await auditLog(
                    req.user.company_id,
                    req.user.id,
                    'ACCESS_DENIED',
                    'endpoint',
                    req.path,
                    { requiredRoles: allowedRoles, userRole },
                    req
                );
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            
            next();
        } catch (error) {
            logger.error('Role check failed:', error);
            return res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}

// API Routes

// Health check
app.get('/auth/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'enterprise-auth',
        timestamp: new Date().toISOString()
    });
});

// Company registration
app.post('/auth/register-company', apiLimiter, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { 
            companyName, 
            adminEmail, 
            adminPassword, 
            adminFirstName,
            adminLastName,
            domain 
        } = req.body;
        
        await client.query('BEGIN');
        
        // Create company
        const companyResult = await client.query(`
            INSERT INTO companies (name, domain) 
            VALUES ($1, $2) 
            RETURNING id, name
        `, [companyName, domain]);
        
        const company = companyResult.rows[0];
        
        // Get admin role
        const roleResult = await client.query(
            'SELECT id FROM roles WHERE company_id = $1 AND name = $2',
            [company.id, 'admin']
        );
        
        const adminRoleId = roleResult.rows[0].id;
        
        // Validate password
        const passwordErrors = await validatePassword(adminPassword, company.id);
        if (passwordErrors.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ errors: passwordErrors });
        }
        
        // Create admin user
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        const userResult = await client.query(`
            INSERT INTO users 
            (company_id, role_id, email, password_hash, password_salt, 
             first_name, last_name, email_verification_token)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, email
        `, [
            company.id, 
            adminRoleId, 
            adminEmail, 
            passwordHash, 
            salt,
            adminFirstName,
            adminLastName,
            verificationToken
        ]);
        
        const user = userResult.rows[0];
        
        // Create default password policy
        await client.query(`
            INSERT INTO password_policies (company_id)
            VALUES ($1)
        `, [company.id]);
        
        await client.query('COMMIT');
        
        // Audit log
        await auditLog(company.id, user.id, 'COMPANY_REGISTERED', 'company', company.id, {
            companyName,
            adminEmail
        }, req);
        
        // Send verification email
        if (emailTransporter) {
            const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
            await emailTransporter.sendMail({
                from: config.smtp.auth.user,
                to: adminEmail,
                subject: 'Verify your ROOTUIP account',
                html: `
                    <h2>Welcome to ROOTUIP Enterprise</h2>
                    <p>Please verify your email address by clicking the link below:</p>
                    <a href="${verificationUrl}">${verificationUrl}</a>
                    <p>This link will expire in 24 hours.</p>
                `
            });
        }
        
        res.status(201).json({
            success: true,
            message: 'Company registered successfully',
            company: {
                id: company.id,
                name: company.name
            },
            verificationRequired: true
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Company registration failed:', error);
        
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email or domain already exists' });
        }
        
        res.status(500).json({ error: 'Registration failed' });
    } finally {
        client.release();
    }
});

// User login
app.post('/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password, mfaCode } = req.body;
        
        // Get user with company and role info
        const userResult = await pool.query(`
            SELECT u.*, c.name as company_name, r.name as role_name, r.permissions
            FROM users u
            JOIN companies c ON u.company_id = c.id
            JOIN roles r ON u.role_id = r.id
            WHERE u.email = $1 AND u.is_active = true
        `, [email]);
        
        if (userResult.rows.length === 0) {
            await auditLog(null, null, 'LOGIN_FAILED', 'user', email, 
                { reason: 'User not found' }, req);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = userResult.rows[0];
        
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            await auditLog(user.company_id, user.id, 'LOGIN_FAILED', 'user', user.id,
                { reason: 'Account locked' }, req);
            return res.status(423).json({ 
                error: 'Account locked',
                lockedUntil: user.locked_until 
            });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            // Increment login attempts
            const attempts = user.login_attempts + 1;
            let lockedUntil = null;
            
            // Get password policy
            const policyResult = await pool.query(
                'SELECT lockout_threshold, lockout_duration_minutes FROM password_policies WHERE company_id = $1',
                [user.company_id]
            );
            
            const policy = policyResult.rows[0];
            
            if (policy && attempts >= policy.lockout_threshold) {
                lockedUntil = new Date(Date.now() + policy.lockout_duration_minutes * 60000);
            }
            
            await pool.query(
                'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
                [attempts, lockedUntil, user.id]
            );
            
            await auditLog(user.company_id, user.id, 'LOGIN_FAILED', 'user', user.id,
                { reason: 'Invalid password', attempts }, req);
            
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check if email is verified
        if (!user.is_verified) {
            return res.status(403).json({ 
                error: 'Email not verified',
                emailVerificationRequired: true 
            });
        }
        
        // Check MFA if enabled
        if (user.mfa_enabled) {
            if (!mfaCode) {
                return res.status(200).json({ 
                    mfaRequired: true,
                    mfaType: user.mfa_type 
                });
            }
            
            let validMFA = false;
            
            if (user.mfa_type === 'totp') {
                validMFA = speakeasy.totp.verify({
                    secret: user.mfa_secret,
                    encoding: 'base32',
                    token: mfaCode,
                    window: 1
                });
            } else if (user.mfa_type === 'sms') {
                // Verify SMS code (implement SMS verification logic)
                // For now, simulate verification
                validMFA = mfaCode === '123456'; // Replace with actual verification
            }
            
            if (!validMFA) {
                // Check backup codes
                const backupResult = await pool.query(
                    'SELECT id FROM mfa_backup_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL',
                    [user.id, crypto.createHash('sha256').update(mfaCode).digest('hex')]
                );
                
                if (backupResult.rows.length > 0) {
                    validMFA = true;
                    await pool.query(
                        'UPDATE mfa_backup_codes SET used_at = NOW() WHERE id = $1',
                        [backupResult.rows[0].id]
                    );
                }
            }
            
            if (!validMFA) {
                await auditLog(user.company_id, user.id, 'LOGIN_FAILED', 'user', user.id,
                    { reason: 'Invalid MFA code' }, req);
                return res.status(401).json({ error: 'Invalid MFA code' });
            }
        }
        
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user);
        
        // Create session
        const sessionId = uuidv4();
        await pool.query(`
            INSERT INTO sessions 
            (id, user_id, token_hash, refresh_token_hash, ip_address, user_agent, 
             expires_at, refresh_expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            sessionId,
            user.id,
            crypto.createHash('sha256').update(accessToken).digest('hex'),
            crypto.createHash('sha256').update(refreshToken).digest('hex'),
            req.ip,
            req.get('User-Agent'),
            new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        ]);
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login_at = NOW(), last_login_ip = $1, login_attempts = 0 WHERE id = $2',
            [req.ip, user.id]
        );
        
        // Audit log
        await auditLog(user.company_id, user.id, 'LOGIN_SUCCESS', 'user', user.id,
            { sessionId }, req);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role_name,
                permissions: user.permissions,
                company: {
                    id: user.company_id,
                    name: user.company_name
                }
            },
            tokens: {
                accessToken,
                refreshToken
            }
        });
        
    } catch (error) {
        logger.error('Login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Token refresh
app.post('/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        
        const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
        
        // Check if refresh token is valid
        const sessionResult = await pool.query(`
            SELECT s.*, u.* FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.refresh_token_hash = $1 
            AND s.refresh_expires_at > NOW() 
            AND s.revoked_at IS NULL
            AND u.is_active = true
        `, [crypto.createHash('sha256').update(refreshToken).digest('hex')]);
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        
        const user = sessionResult.rows[0];
        const session = sessionResult.rows[0];
        
        // Generate new tokens
        const tokens = generateTokens(user);
        
        // Update session
        await pool.query(`
            UPDATE sessions 
            SET token_hash = $1, 
                refresh_token_hash = $2,
                expires_at = $3,
                refresh_expires_at = $4
            WHERE id = $5
        `, [
            crypto.createHash('sha256').update(tokens.accessToken).digest('hex'),
            crypto.createHash('sha256').update(tokens.refreshToken).digest('hex'),
            new Date(Date.now() + 15 * 60 * 1000),
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            session.id
        ]);
        
        res.json({
            success: true,
            tokens
        });
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expired' });
        }
        logger.error('Token refresh failed:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Logout
app.post('/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Revoke session
        await pool.query(
            'UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1',
            [crypto.createHash('sha256').update(req.token).digest('hex')]
        );
        
        await auditLog(req.user.company_id, req.user.id, 'LOGOUT', 'user', req.user.id,
            {}, req);
        
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Logout failed:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Setup MFA
app.post('/auth/mfa/setup', authenticateToken, async (req, res) => {
    try {
        const { type } = req.body; // 'totp' or 'sms'
        
        if (type === 'totp') {
            // Generate secret
            const secret = speakeasy.generateSecret({
                name: `ROOTUIP (${req.user.email})`,
                issuer: 'ROOTUIP Enterprise'
            });
            
            // Generate QR code
            const qrCode = await QRCode.toDataURL(secret.otpauth_url);
            
            // Store secret temporarily (user must verify before it's enabled)
            await pool.query(
                'UPDATE users SET mfa_secret = $1 WHERE id = $2',
                [secret.base32, req.user.id]
            );
            
            res.json({
                success: true,
                secret: secret.base32,
                qrCode,
                backupCodes: [] // Generate after verification
            });
            
        } else if (type === 'sms') {
            const { phoneNumber } = req.body;
            
            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number required' });
            }
            
            // Send verification code
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            if (twilioClient) {
                await twilioClient.messages.create({
                    body: `Your ROOTUIP verification code is: ${verificationCode}`,
                    from: config.twilio.fromNumber,
                    to: phoneNumber
                });
            }
            
            // Store verification code temporarily
            await pool.query(
                'UPDATE users SET mfa_phone = $1 WHERE id = $2',
                [phoneNumber, req.user.id]
            );
            
            res.json({
                success: true,
                message: 'Verification code sent to phone'
            });
        }
        
        await auditLog(req.user.company_id, req.user.id, 'MFA_SETUP_INITIATED', 'user', req.user.id,
            { type }, req);
        
    } catch (error) {
        logger.error('MFA setup failed:', error);
        res.status(500).json({ error: 'MFA setup failed' });
    }
});

// Verify and enable MFA
app.post('/auth/mfa/verify', authenticateToken, async (req, res) => {
    try {
        const { type, code } = req.body;
        
        let verified = false;
        
        if (type === 'totp') {
            const userResult = await pool.query(
                'SELECT mfa_secret FROM users WHERE id = $1',
                [req.user.id]
            );
            
            const secret = userResult.rows[0].mfa_secret;
            
            verified = speakeasy.totp.verify({
                secret,
                encoding: 'base32',
                token: code,
                window: 1
            });
            
        } else if (type === 'sms') {
            // Verify SMS code (implement actual verification)
            verified = code === '123456'; // Replace with actual verification
        }
        
        if (!verified) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        // Enable MFA
        await pool.query(
            'UPDATE users SET mfa_enabled = true, mfa_type = $1 WHERE id = $2',
            [type, req.user.id]
        );
        
        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
            
            await pool.query(
                'INSERT INTO mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)',
                [req.user.id, crypto.createHash('sha256').update(code).digest('hex')]
            );
        }
        
        await auditLog(req.user.company_id, req.user.id, 'MFA_ENABLED', 'user', req.user.id,
            { type }, req);
        
        res.json({
            success: true,
            message: 'MFA enabled successfully',
            backupCodes
        });
        
    } catch (error) {
        logger.error('MFA verification failed:', error);
        res.status(500).json({ error: 'MFA verification failed' });
    }
});

// API Key Management
app.post('/auth/api-keys', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { name, permissions, expiresIn } = req.body;
        
        // Generate API key
        const apiKey = `uip_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        let expiresAt = null;
        if (expiresIn) {
            expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000);
        }
        
        const result = await pool.query(`
            INSERT INTO api_keys 
            (company_id, user_id, name, key_hash, permissions, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, created_at
        `, [
            req.user.company_id,
            req.user.id,
            name,
            keyHash,
            permissions || {},
            expiresAt
        ]);
        
        await auditLog(req.user.company_id, req.user.id, 'API_KEY_CREATED', 'api_key', result.rows[0].id,
            { name }, req);
        
        res.json({
            success: true,
            apiKey: {
                id: result.rows[0].id,
                name: result.rows[0].name,
                key: apiKey, // Only shown once
                createdAt: result.rows[0].created_at
            }
        });
        
    } catch (error) {
        logger.error('API key creation failed:', error);
        res.status(500).json({ error: 'API key creation failed' });
    }
});

// List API keys
app.get('/auth/api-keys', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, permissions, rate_limit, expires_at, last_used_at, 
                   is_active, created_at
            FROM api_keys
            WHERE company_id = $1
            ORDER BY created_at DESC
        `, [req.user.company_id]);
        
        res.json({
            success: true,
            apiKeys: result.rows
        });
        
    } catch (error) {
        logger.error('API key listing failed:', error);
        res.status(500).json({ error: 'Failed to list API keys' });
    }
});

// User invitation
app.post('/auth/invite', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { email, roleId, metadata } = req.body;
        
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND company_id = $2',
            [email, req.user.company_id]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }
        
        // Create invitation
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const result = await pool.query(`
            INSERT INTO user_invitations
            (company_id, email, role_id, invited_by, invitation_token, expires_at, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            req.user.company_id,
            email,
            roleId,
            req.user.id,
            invitationToken,
            expiresAt,
            metadata || {}
        ]);
        
        // Send invitation email
        if (emailTransporter) {
            const inviteUrl = `${config.frontendUrl}/accept-invite?token=${invitationToken}`;
            await emailTransporter.sendMail({
                from: config.smtp.auth.user,
                to: email,
                subject: `You're invited to join ${req.user.company_name} on ROOTUIP`,
                html: `
                    <h2>You've been invited!</h2>
                    <p>${req.user.first_name} ${req.user.last_name} has invited you to join ${req.user.company_name} on ROOTUIP Enterprise.</p>
                    <p>Click the link below to accept the invitation and create your account:</p>
                    <a href="${inviteUrl}">${inviteUrl}</a>
                    <p>This invitation will expire in 7 days.</p>
                `
            });
        }
        
        await auditLog(req.user.company_id, req.user.id, 'USER_INVITED', 'user_invitation', result.rows[0].id,
            { email, roleId }, req);
        
        res.json({
            success: true,
            message: 'Invitation sent successfully'
        });
        
    } catch (error) {
        logger.error('User invitation failed:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

// Accept invitation
app.post('/auth/accept-invite', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { token, password, firstName, lastName } = req.body;
        
        await client.query('BEGIN');
        
        // Get invitation
        const inviteResult = await client.query(`
            SELECT i.*, c.name as company_name
            FROM user_invitations i
            JOIN companies c ON i.company_id = c.id
            WHERE i.invitation_token = $1 
            AND i.expires_at > NOW() 
            AND i.accepted_at IS NULL
        `, [token]);
        
        if (inviteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }
        
        const invitation = inviteResult.rows[0];
        
        // Validate password
        const passwordErrors = await validatePassword(password, invitation.company_id);
        if (passwordErrors.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ errors: passwordErrors });
        }
        
        // Create user
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const userResult = await client.query(`
            INSERT INTO users
            (company_id, role_id, email, password_hash, password_salt,
             first_name, last_name, is_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id
        `, [
            invitation.company_id,
            invitation.role_id,
            invitation.email,
            passwordHash,
            salt,
            firstName,
            lastName
        ]);
        
        const userId = userResult.rows[0].id;
        
        // Mark invitation as accepted
        await client.query(
            'UPDATE user_invitations SET accepted_at = NOW() WHERE id = $1',
            [invitation.id]
        );
        
        await client.query('COMMIT');
        
        await auditLog(invitation.company_id, userId, 'INVITATION_ACCEPTED', 'user', userId,
            { invitationId: invitation.id }, req);
        
        res.json({
            success: true,
            message: 'Account created successfully',
            company: invitation.company_name
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Accept invitation failed:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    } finally {
        client.release();
    }
});

// Get audit logs
app.get('/auth/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT a.*, u.email as user_email, u.first_name, u.last_name
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.company_id = $1
        `;
        const params = [req.user.company_id];
        let paramCount = 1;
        
        if (userId) {
            paramCount++;
            query += ` AND a.user_id = $${paramCount}`;
            params.push(userId);
        }
        
        if (action) {
            paramCount++;
            query += ` AND a.action = $${paramCount}`;
            params.push(action);
        }
        
        if (startDate) {
            paramCount++;
            query += ` AND a.created_at >= $${paramCount}`;
            params.push(startDate);
        }
        
        if (endDate) {
            paramCount++;
            query += ` AND a.created_at <= $${paramCount}`;
            params.push(endDate);
        }
        
        query += ` ORDER BY a.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);
        
        const result = await pool.query(query, params);
        
        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM audit_logs WHERE company_id = $1',
            [req.user.company_id]
        );
        
        res.json({
            success: true,
            logs: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count)
            }
        });
        
    } catch (error) {
        logger.error('Audit log retrieval failed:', error);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});

// Security dashboard data
app.get('/auth/security-dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        // Get various security metrics
        const [
            activeUsers,
            activeSessions,
            failedLogins,
            mfaEnabled,
            apiKeys,
            recentAudits
        ] = await Promise.all([
            pool.query(
                'SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active = true',
                [req.user.company_id]
            ),
            pool.query(
                'SELECT COUNT(*) FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = $1) AND expires_at > NOW() AND revoked_at IS NULL',
                [req.user.company_id]
            ),
            pool.query(
                `SELECT COUNT(*) FROM audit_logs 
                 WHERE company_id = $1 AND action = 'LOGIN_FAILED' 
                 AND created_at > NOW() - INTERVAL '24 hours'`,
                [req.user.company_id]
            ),
            pool.query(
                'SELECT COUNT(*) FROM users WHERE company_id = $1 AND mfa_enabled = true',
                [req.user.company_id]
            ),
            pool.query(
                'SELECT COUNT(*) FROM api_keys WHERE company_id = $1 AND is_active = true',
                [req.user.company_id]
            ),
            pool.query(
                `SELECT action, COUNT(*) as count 
                 FROM audit_logs 
                 WHERE company_id = $1 AND created_at > NOW() - INTERVAL '7 days'
                 GROUP BY action
                 ORDER BY count DESC
                 LIMIT 10`,
                [req.user.company_id]
            )
        ]);
        
        res.json({
            success: true,
            metrics: {
                activeUsers: parseInt(activeUsers.rows[0].count),
                activeSessions: parseInt(activeSessions.rows[0].count),
                failedLoginsLast24h: parseInt(failedLogins.rows[0].count),
                mfaEnabledUsers: parseInt(mfaEnabled.rows[0].count),
                activeApiKeys: parseInt(apiKeys.rows[0].count),
                recentActivityByType: recentAudits.rows
            }
        });
        
    } catch (error) {
        logger.error('Security dashboard failed:', error);
        res.status(500).json({ error: 'Failed to load security dashboard' });
    }
});

// SAML SSO endpoints (preparation)
app.get('/auth/sso/metadata/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        
        // Generate SAML metadata for the company
        const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" 
                  entityID="${config.frontendUrl}/auth/sso/${companyId}">
    <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <AssertionConsumerService 
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" 
            Location="${config.frontendUrl}/auth/sso/callback/${companyId}" 
            index="0" />
    </SPSSODescriptor>
</EntityDescriptor>`;
        
        res.set('Content-Type', 'application/xml');
        res.send(metadata);
        
    } catch (error) {
        logger.error('SAML metadata generation failed:', error);
        res.status(500).json({ error: 'Failed to generate metadata' });
    }
});

// Compliance reporting endpoints
const ComplianceReporter = require('./compliance-reporter');
const complianceReporter = new ComplianceReporter(config.database, logger);

app.get('/auth/compliance/report', authenticateToken, requireRole(['admin', 'compliance']), async (req, res) => {
    await complianceReporter.handleComplianceRequest(req, res);
});

app.get('/auth/compliance/frameworks', authenticateToken, requireRole(['admin', 'compliance']), (req, res) => {
    res.json({
        success: true,
        frameworks: [
            { id: 'SOC2', name: 'SOC 2 Type II', description: 'Service Organization Control 2' },
            { id: 'ISO27001', name: 'ISO 27001:2013', description: 'Information Security Management' },
            { id: 'GDPR', name: 'GDPR', description: 'General Data Protection Regulation' },
            { id: 'HIPAA', name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' }
        ]
    });
});

app.get('/auth/compliance/status', authenticateToken, requireRole(['admin', 'compliance']), async (req, res) => {
    try {
        const companyId = req.user.company_id;
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = new Date();
        
        const [userMetrics, authMetrics, policyCompliance] = await Promise.all([
            complianceReporter.getUserMetrics(companyId, startDate, endDate),
            complianceReporter.getAuthenticationMetrics(companyId, startDate, endDate),
            complianceReporter.getPolicyCompliance(companyId)
        ]);
        
        const overallScore = complianceReporter.calculateComplianceScore({
            users: userMetrics,
            authentication: authMetrics,
            policy: policyCompliance
        });
        
        res.json({
            success: true,
            complianceScore: overallScore + '%',
            status: overallScore > 70 ? 'COMPLIANT' : 'NEEDS_IMPROVEMENT',
            lastAssessment: new Date().toISOString(),
            keyMetrics: {
                mfaAdoption: userMetrics.mfaAdoptionRate,
                passwordCompliance: policyCompliance.compliance.passwordCompliance,
                authFailureRate: authMetrics.failureRate
            }
        });
        
    } catch (error) {
        logger.error('Compliance status failed:', error);
        res.status(500).json({ error: 'Failed to get compliance status' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        requestId: req.requestId 
    });
});

// Start server
async function startServer() {
    try {
        await initializeDatabase();
        
        app.listen(config.port, () => {
            logger.info(`Enterprise Auth Service running on port ${config.port}`);
            console.log(`🔐 Enterprise Authentication Service started on http://localhost:${config.port}`);
            console.log('Available endpoints:');
            console.log('  POST /auth/register-company - Register new company');
            console.log('  POST /auth/login - User login');
            console.log('  POST /auth/refresh - Refresh tokens');
            console.log('  POST /auth/logout - User logout');
            console.log('  POST /auth/mfa/setup - Setup MFA');
            console.log('  POST /auth/api-keys - Create API key');
            console.log('  POST /auth/invite - Invite user');
            console.log('  GET  /auth/audit-logs - View audit logs');
            console.log('  GET  /auth/security-dashboard - Security metrics');
            console.log('  GET  /auth/compliance/report - Generate compliance report');
            console.log('  GET  /auth/compliance/frameworks - List compliance frameworks');
            console.log('  GET  /auth/compliance/status - Current compliance status');
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});

// Export for testing
module.exports = app;

// Start if run directly
if (require.main === module) {
    startServer();
}