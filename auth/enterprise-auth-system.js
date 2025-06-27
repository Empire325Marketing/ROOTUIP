// Enterprise Authentication System for ROOTUIP
// Professional-grade authentication with email verification, JWT, and session management

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://rootuip.com', 'https://app.rootuip.com'],
    credentials: true
}));

// Environment configuration
const config = {
    jwt: {
        secret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        user: process.env.EMAIL_USER || 'noreply@rootuip.com',
        pass: process.env.EMAIL_PASS || ''
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'rootuip_auth',
        user: process.env.DB_USER || 'rootuip',
        pass: process.env.DB_PASS || ''
    },
    app: {
        url: process.env.APP_URL || 'https://app.rootuip.com',
        name: 'ROOTUIP Platform'
    }
};

// In-memory database for demo (replace with PostgreSQL/MySQL in production)
const db = {
    users: new Map(),
    verificationTokens: new Map(),
    refreshTokens: new Map(),
    passwordResetTokens: new Map(),
    loginAttempts: new Map(),
    sessions: new Map(),
    mfaSecrets: new Map(),
    auditLog: []
};

// Email transporter
const emailTransporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
        user: config.email.user,
        pass: config.email.pass
    }
});

// Rate limiting configurations
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP'
});

// Apply rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', generalLimiter);

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Middleware for role-based access control
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// Helper functions
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateSecurePassword = () => {
    return crypto.randomBytes(12).toString('base64');
};

const hashPassword = async (password) => {
    return bcrypt.hash(password, 12);
};

const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);

    if (password.length < minLength) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!hasUpperCase || !hasLowerCase) {
        return { valid: false, message: 'Password must contain both uppercase and lowercase letters' };
    }
    if (!hasNumbers) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!hasSpecialChar) {
        return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
    }
    return { valid: true };
};

const logAuditEvent = (userId, action, details, ip) => {
    db.auditLog.push({
        id: crypto.randomUUID(),
        userId,
        action,
        details,
        ip,
        timestamp: new Date().toISOString()
    });
};

// Email templates
const emailTemplates = {
    verification: (name, verificationLink) => ({
        subject: 'Verify your ROOTUIP account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">ROOTUIP Platform</h1>
                </div>
                <div style="padding: 30px; background: #f8f9fa;">
                    <h2>Welcome ${name}!</h2>
                    <p>Thank you for registering with ROOTUIP. Please verify your email address to activate your account.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}" style="background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        ROOTUIP - Enterprise Ocean Freight Intelligence<br>
                        © 2025 ROOTUIP. All rights reserved.
                    </p>
                </div>
            </div>
        `
    }),
    
    passwordReset: (name, resetLink) => ({
        subject: 'Reset your ROOTUIP password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">ROOTUIP Platform</h1>
                </div>
                <div style="padding: 30px; background: #f8f9fa;">
                    <h2>Password Reset Request</h2>
                    <p>Hi ${name},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        ROOTUIP - Enterprise Ocean Freight Intelligence<br>
                        © 2025 ROOTUIP. All rights reserved.
                    </p>
                </div>
            </div>
        `
    }),
    
    loginAlert: (name, ip, userAgent, timestamp) => ({
        subject: 'New login to your ROOTUIP account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">ROOTUIP Platform</h1>
                </div>
                <div style="padding: 30px; background: #f8f9fa;">
                    <h2>New Login Detected</h2>
                    <p>Hi ${name},</p>
                    <p>We detected a new login to your account:</p>
                    <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp}</p>
                        <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ip}</p>
                        <p style="margin: 5px 0;"><strong>Device:</strong> ${userAgent}</p>
                    </div>
                    <p>If this was you, no action is needed. If you don't recognize this activity, please reset your password immediately.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${config.app.url}/security" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Security Settings</a>
                    </div>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        ROOTUIP - Enterprise Ocean Freight Intelligence<br>
                        © 2025 ROOTUIP. All rights reserved.
                    </p>
                </div>
            </div>
        `
    })
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ROOTUIP Authentication Service',
        timestamp: new Date().toISOString()
    });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, company, role = 'viewer' } = req.body;

        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Check if user exists
        if (db.users.has(email)) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Create user
        const userId = crypto.randomUUID();
        const hashedPassword = await hashPassword(password);
        const verificationToken = generateVerificationToken();

        const user = {
            id: userId,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            company,
            role,
            verified: false,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            mfaEnabled: false,
            locked: false,
            loginAttempts: 0
        };

        db.users.set(email, user);
        db.verificationTokens.set(verificationToken, {
            userId,
            email,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        // Send verification email
        const verificationLink = `${config.app.url}/verify-email?token=${verificationToken}`;
        const emailContent = emailTemplates.verification(firstName, verificationLink);
        
        await emailTransporter.sendMail({
            from: `"${config.app.name}" <${config.email.user}>`,
            to: email,
            subject: emailContent.subject,
            html: emailContent.html
        });

        // Log registration
        logAuditEvent(userId, 'REGISTER', { email }, req.ip);

        res.status(201).json({
            message: 'Registration successful. Please check your email to verify your account.',
            userId
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Email verification
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Verification token required' });
        }

        const tokenData = db.verificationTokens.get(token);
        if (!tokenData) {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        if (new Date() > new Date(tokenData.expiresAt)) {
            db.verificationTokens.delete(token);
            return res.status(400).json({ error: 'Verification token expired' });
        }

        // Update user
        const user = db.users.get(tokenData.email);
        user.verified = true;
        user.verifiedAt = new Date().toISOString();
        db.users.set(tokenData.email, user);

        // Clean up token
        db.verificationTokens.delete(token);

        // Log verification
        logAuditEvent(user.id, 'EMAIL_VERIFIED', { email: user.email }, req.ip);

        res.json({ message: 'Email verified successfully' });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Email verification failed' });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, mfaCode } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = db.users.get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if account is locked
        if (user.locked) {
            return res.status(403).json({ error: 'Account locked. Please contact support.' });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            // Increment login attempts
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= 5) {
                user.locked = true;
                user.lockedAt = new Date().toISOString();
            }
            db.users.set(email, user);
            
            logAuditEvent(user.id, 'LOGIN_FAILED', { reason: 'Invalid password' }, req.ip);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if email is verified
        if (!user.verified) {
            return res.status(403).json({ error: 'Please verify your email before logging in' });
        }

        // Check MFA if enabled
        if (user.mfaEnabled) {
            if (!mfaCode) {
                return res.status(200).json({ mfaRequired: true });
            }

            const mfaSecret = db.mfaSecrets.get(user.id);
            const verified = speakeasy.totp.verify({
                secret: mfaSecret,
                encoding: 'base32',
                token: mfaCode,
                window: 2
            });

            if (!verified) {
                logAuditEvent(user.id, 'MFA_FAILED', {}, req.ip);
                return res.status(401).json({ error: 'Invalid MFA code' });
            }
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            config.jwt.secret,
            { expiresIn: config.jwt.refreshExpiresIn }
        );

        // Store refresh token
        db.refreshTokens.set(refreshToken, {
            userId: user.id,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        // Update user
        user.lastLogin = new Date().toISOString();
        user.loginAttempts = 0;
        db.users.set(email, user);

        // Create session
        const sessionId = crypto.randomUUID();
        db.sessions.set(sessionId, {
            userId: user.id,
            createdAt: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Send login alert email
        const emailContent = emailTemplates.loginAlert(
            user.firstName,
            req.ip,
            req.headers['user-agent'],
            new Date().toLocaleString()
        );
        
        emailTransporter.sendMail({
            from: `"${config.app.name}" <${config.email.user}>`,
            to: email,
            subject: emailContent.subject,
            html: emailContent.html
        }).catch(console.error); // Don't block login if email fails

        // Log successful login
        logAuditEvent(user.id, 'LOGIN_SUCCESS', {}, req.ip);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                company: user.company,
                mfaEnabled: user.mfaEnabled
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const tokenData = db.refreshTokens.get(refreshToken);
        if (!tokenData) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        if (new Date() > new Date(tokenData.expiresAt)) {
            db.refreshTokens.delete(refreshToken);
            return res.status(401).json({ error: 'Refresh token expired' });
        }

        // Get user
        const user = Array.from(db.users.values()).find(u => u.id === tokenData.userId);
        if (!user || user.locked) {
            return res.status(403).json({ error: 'Account not accessible' });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({ accessToken });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        const { refreshToken } = req.body;

        // Remove refresh token if provided
        if (refreshToken) {
            db.refreshTokens.delete(refreshToken);
        }

        // Log logout
        logAuditEvent(req.user.id, 'LOGOUT', {}, req.ip);

        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Password reset request
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const user = db.users.get(email);
        if (!user) {
            // Don't reveal if user exists
            return res.json({ message: 'If the email exists, a password reset link has been sent' });
        }

        // Generate reset token
        const resetToken = generateVerificationToken();
        db.passwordResetTokens.set(resetToken, {
            userId: user.id,
            email,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        });

        // Send reset email
        const resetLink = `${config.app.url}/reset-password?token=${resetToken}`;
        const emailContent = emailTemplates.passwordReset(user.firstName, resetLink);
        
        await emailTransporter.sendMail({
            from: `"${config.app.name}" <${config.email.user}>`,
            to: email,
            subject: emailContent.subject,
            html: emailContent.html
        });

        // Log password reset request
        logAuditEvent(user.id, 'PASSWORD_RESET_REQUEST', {}, req.ip);

        res.json({ message: 'If the email exists, a password reset link has been sent' });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Password reset request failed' });
    }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password required' });
        }

        const tokenData = db.passwordResetTokens.get(token);
        if (!tokenData) {
            return res.status(400).json({ error: 'Invalid reset token' });
        }

        if (new Date() > new Date(tokenData.expiresAt)) {
            db.passwordResetTokens.delete(token);
            return res.status(400).json({ error: 'Reset token expired' });
        }

        // Validate new password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Update password
        const user = db.users.get(tokenData.email);
        user.password = await hashPassword(password);
        user.passwordChangedAt = new Date().toISOString();
        user.locked = false;
        user.loginAttempts = 0;
        db.users.set(tokenData.email, user);

        // Clean up token
        db.passwordResetTokens.delete(token);

        // Invalidate all refresh tokens for this user
        for (const [token, data] of db.refreshTokens.entries()) {
            if (data.userId === user.id) {
                db.refreshTokens.delete(token);
            }
        }

        // Log password reset
        logAuditEvent(user.id, 'PASSWORD_RESET', {}, req.ip);

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// Enable MFA
app.post('/api/auth/mfa/enable', authenticateToken, async (req, res) => {
    try {
        const user = Array.from(db.users.values()).find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `ROOTUIP (${user.email})`,
            issuer: 'ROOTUIP Platform'
        });

        // Store secret temporarily
        db.mfaSecrets.set(user.id, secret.base32);

        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            secret: secret.base32,
            qrCode: qrCodeUrl
        });

    } catch (error) {
        console.error('MFA enable error:', error);
        res.status(500).json({ error: 'Failed to enable MFA' });
    }
});

// Verify and confirm MFA
app.post('/api/auth/mfa/verify', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'MFA code required' });
        }

        const user = Array.from(db.users.values()).find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const secret = db.mfaSecrets.get(user.id);
        if (!secret) {
            return res.status(400).json({ error: 'MFA not initialized' });
        }

        const verified = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 2
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid MFA code' });
        }

        // Enable MFA for user
        user.mfaEnabled = true;
        user.mfaEnabledAt = new Date().toISOString();
        db.users.set(user.email, user);

        // Generate backup codes
        const backupCodes = Array.from({ length: 8 }, () => 
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );

        // Log MFA enablement
        logAuditEvent(user.id, 'MFA_ENABLED', {}, req.ip);

        res.json({
            message: 'MFA enabled successfully',
            backupCodes
        });

    } catch (error) {
        console.error('MFA verify error:', error);
        res.status(500).json({ error: 'MFA verification failed' });
    }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const user = Array.from(db.users.values()).find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            company: user.company,
            role: user.role,
            verified: user.verified,
            mfaEnabled: user.mfaEnabled,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, company } = req.body;
        
        const user = Array.from(db.users.values()).find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update allowed fields
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (company) user.company = company;

        db.users.set(user.email, user);

        // Log profile update
        logAuditEvent(user.id, 'PROFILE_UPDATED', { fields: Object.keys(req.body) }, req.ip);

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                company: user.company,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        const user = Array.from(db.users.values()).find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Validate new password
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        // Update password
        user.password = await hashPassword(newPassword);
        user.passwordChangedAt = new Date().toISOString();
        db.users.set(user.email, user);

        // Log password change
        logAuditEvent(user.id, 'PASSWORD_CHANGED', {}, req.ip);

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Get audit logs (admin only)
app.get('/api/auth/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId, action, limit = 100, offset = 0 } = req.query;
        
        let logs = [...db.auditLog];
        
        // Filter by userId if provided
        if (userId) {
            logs = logs.filter(log => log.userId === userId);
        }
        
        // Filter by action if provided
        if (action) {
            logs = logs.filter(log => log.action === action);
        }
        
        // Sort by timestamp descending
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Paginate
        const paginatedLogs = logs.slice(offset, offset + limit);
        
        res.json({
            logs: paginatedLogs,
            total: logs.length,
            limit,
            offset
        });

    } catch (error) {
        console.error('Audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Admin: List users
app.get('/api/auth/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const users = Array.from(db.users.values()).map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            company: user.company,
            role: user.role,
            verified: user.verified,
            mfaEnabled: user.mfaEnabled,
            locked: user.locked,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        }));

        res.json({ users });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// Admin: Update user role
app.put('/api/auth/admin/users/:userId/role', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!['admin', 'operations', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = Array.from(db.users.values()).find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.role = role;
        db.users.set(user.email, user);

        // Log role change
        logAuditEvent(req.user.id, 'USER_ROLE_CHANGED', { targetUserId: userId, newRole: role }, req.ip);

        res.json({ message: 'User role updated successfully' });

    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// Admin: Lock/unlock user
app.put('/api/auth/admin/users/:userId/lock', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { locked } = req.body;

        const user = Array.from(db.users.values()).find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.locked = locked;
        if (locked) {
            user.lockedAt = new Date().toISOString();
        } else {
            user.loginAttempts = 0;
        }
        db.users.set(user.email, user);

        // Log lock/unlock
        logAuditEvent(req.user.id, locked ? 'USER_LOCKED' : 'USER_UNLOCKED', { targetUserId: userId }, req.ip);

        res.json({ message: `User ${locked ? 'locked' : 'unlocked'} successfully` });

    } catch (error) {
        console.error('Lock user error:', error);
        res.status(500).json({ error: 'Failed to update user lock status' });
    }
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`ROOTUIP Authentication Service running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`JWT Secret: ${config.jwt.secret.substring(0, 10)}...`);
});

module.exports = app;