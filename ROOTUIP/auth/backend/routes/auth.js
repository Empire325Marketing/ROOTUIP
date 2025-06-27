/**
 * Authentication Routes
 * Complete authentication endpoints for enterprise users
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const winston = require('winston');
const httpStatus = require('http-status');

const router = express.Router();

// Rate limiting for auth endpoints
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const passwordResetRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: { error: 'Too many password reset attempts, please try again later.' }
});

// Login endpoint
router.post('/login', authRateLimit, [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
    body('mfaCode').optional().isLength({ min: 6, max: 6 }).withMessage('MFA code must be 6 digits')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { email, password, mfaCode } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        // Log login attempt
        await req.db.query(`
            INSERT INTO login_attempts (email, ip_address, user_agent, success, created_at)
            VALUES ($1, $2, $3, false, NOW())
        `, [email, ipAddress, userAgent]);

        // Get user with company and role information
        const userResult = await req.db.query(`
            SELECT u.*, c.name as company_name, c.mfa_required, c.password_policy,
                   r.name as role_name, r.permissions
            FROM users u
            JOIN companies c ON u.company_id = c.id
            JOIN roles r ON u.role_id = r.id
            WHERE u.email = $1 AND u.is_active = true AND u.deleted_at IS NULL
        `, [email]);

        if (userResult.rows.length === 0) {
            await req.logAudit({
                action: 'auth.login_failed',
                ipAddress,
                userAgent,
                success: false,
                errorMessage: 'Invalid credentials',
                metadata: { email, reason: 'user_not_found' }
            });
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Check if user is locked out
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            const lockoutEnd = new Date(user.locked_until);
            await req.logAudit({
                companyId: user.company_id,
                userId: user.id,
                action: 'auth.login_failed',
                ipAddress,
                userAgent,
                success: false,
                errorMessage: 'Account locked',
                metadata: { email, reason: 'account_locked', lockoutEnd }
            });
            return res.status(httpStatus.LOCKED).json({ 
                error: 'Account is locked due to too many failed attempts',
                lockoutEnd: lockoutEnd.toISOString()
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password + user.password_salt, user.password_hash);
        
        if (!isValidPassword) {
            // Increment login attempts
            const newAttempts = user.login_attempts + 1;
            const lockoutTime = newAttempts >= 5 ? 
                new Date(Date.now() + 15 * 60 * 1000) : // 15 minutes lockout
                null;

            await req.db.query(`
                UPDATE users 
                SET login_attempts = $1, locked_until = $2, updated_at = NOW()
                WHERE id = $3
            `, [newAttempts, lockoutTime, user.id]);

            await req.logAudit({
                companyId: user.company_id,
                userId: user.id,
                action: 'auth.login_failed',
                ipAddress,
                userAgent,
                success: false,
                errorMessage: 'Invalid password',
                metadata: { email, attempts: newAttempts }
            });

            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid credentials' });
        }

        // Check if MFA is required
        const mfaRequired = user.mfa_enabled || user.company_mfa_required;
        
        if (mfaRequired && !mfaCode) {
            return res.status(httpStatus.PRECONDITION_REQUIRED).json({ 
                error: 'MFA code required',
                mfaRequired: true 
            });
        }

        if (mfaRequired && mfaCode) {
            // Verify TOTP code
            const verified = speakeasy.totp.verify({
                secret: user.mfa_secret,
                encoding: 'base32',
                token: mfaCode,
                window: 2 // Allow 2 time steps of variance
            });

            if (!verified) {
                await req.logAudit({
                    companyId: user.company_id,
                    userId: user.id,
                    action: 'auth.mfa_failed',
                    ipAddress,
                    userAgent,
                    success: false,
                    errorMessage: 'Invalid MFA code',
                    metadata: { email }
                });
                return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid MFA code' });
            }
        }

        // Check if password needs to be changed
        if (user.must_change_password) {
            return res.status(httpStatus.PRECONDITION_REQUIRED).json({
                error: 'Password change required',
                mustChangePassword: true,
                userId: user.id
            });
        }

        // Create session
        const sessionId = crypto.randomUUID();
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const refreshToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

        await req.db.query(`
            INSERT INTO user_sessions (
                id, user_id, session_token, refresh_token, ip_address, 
                user_agent, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [sessionId, user.id, sessionToken, refreshToken, ipAddress, userAgent, expiresAt]);

        // Generate JWT
        const tokenPayload = {
            userId: user.id,
            companyId: user.company_id,
            roleId: user.role_id,
            sessionId: sessionId,
            permissions: user.permissions
        };

        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { 
            expiresIn: '8h',
            issuer: 'uip-auth',
            audience: 'uip-platform'
        });

        // Reset login attempts and update last login
        await req.db.query(`
            UPDATE users 
            SET login_attempts = 0, locked_until = NULL, last_login_at = NOW(), 
                last_login_ip = $1, updated_at = NOW()
            WHERE id = $2
        `, [ipAddress, user.id]);

        // Update successful login attempt
        await req.db.query(`
            UPDATE login_attempts 
            SET success = true 
            WHERE email = $1 AND ip_address = $2 AND created_at > NOW() - INTERVAL '1 minute'
        `, [email, ipAddress]);

        // Log successful login
        await req.logAudit({
            companyId: user.company_id,
            userId: user.id,
            action: 'auth.login_success',
            ipAddress,
            userAgent,
            sessionId,
            success: true,
            metadata: { email, mfaUsed: mfaRequired }
        });

        // Set secure cookie
        res.cookie('session_token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({
            success: true,
            accessToken,
            refreshToken,
            expiresAt: expiresAt.toISOString(),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role_name,
                company: user.company_name,
                emailVerified: user.email_verified,
                mfaEnabled: user.mfa_enabled
            }
        });

    } catch (error) {
        req.logger.error('Login error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Login failed' });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const sessionToken = req.cookies.session_token || req.body.sessionToken;
        
        if (sessionToken) {
            // Deactivate session
            await req.db.query(`
                UPDATE user_sessions 
                SET is_active = false, updated_at = NOW()
                WHERE session_token = $1
            `, [sessionToken]);
            
            // Get session info for audit log
            const sessionResult = await req.db.query(`
                SELECT user_id, id FROM user_sessions WHERE session_token = $1
            `, [sessionToken]);
            
            if (sessionResult.rows.length > 0) {
                const session = sessionResult.rows[0];
                await req.logAudit({
                    userId: session.user_id,
                    action: 'auth.logout',
                    sessionId: session.id,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    success: true
                });
            }
        }

        // Clear session cookie
        res.clearCookie('session_token');
        res.json({ success: true, message: 'Logged out successfully' });

    } catch (error) {
        req.logger.error('Logout error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Logout failed' });
    }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(httpStatus.BAD_REQUEST).json({ error: 'Refresh token required' });
        }

        // Verify refresh token
        const sessionResult = await req.db.query(`
            SELECT s.*, u.company_id, u.role_id, r.permissions
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE s.refresh_token = $1 AND s.is_active = true AND s.expires_at > NOW()
        `, [refreshToken]);

        if (sessionResult.rows.length === 0) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid refresh token' });
        }

        const session = sessionResult.rows[0];

        // Generate new access token
        const tokenPayload = {
            userId: session.user_id,
            companyId: session.company_id,
            roleId: session.role_id,
            sessionId: session.id,
            permissions: session.permissions
        };

        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { 
            expiresIn: '8h',
            issuer: 'uip-auth',
            audience: 'uip-platform'
        });

        // Update session activity
        await req.db.query(`
            UPDATE user_sessions 
            SET last_activity = NOW()
            WHERE id = $1
        `, [session.id]);

        res.json({
            success: true,
            accessToken,
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        });

    } catch (error) {
        req.logger.error('Token refresh error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Token refresh failed' });
    }
});

// Email verification endpoint
router.post('/verify-email', [
    body('token').isLength({ min: 32, max: 64 }).withMessage('Valid verification token required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { token } = req.body;

        // Find user with valid token
        const userResult = await req.db.query(`
            UPDATE users 
            SET email_verified = true, email_verification_token = NULL, 
                email_verification_expires = NULL, updated_at = NOW()
            WHERE email_verification_token = $1 
                AND email_verification_expires > NOW()
                AND email_verified = false
            RETURNING id, email, company_id
        `, [token]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Invalid or expired verification token' 
            });
        }

        const user = userResult.rows[0];

        // Log verification
        await req.logAudit({
            companyId: user.company_id,
            userId: user.id,
            action: 'auth.email_verified',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { email: user.email }
        });

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        req.logger.error('Email verification error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Email verification failed' });
    }
});

// Resend verification email
router.post('/resend-verification', passwordResetRateLimit, [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { email } = req.body;

        // Find unverified user
        const userResult = await req.db.query(`
            SELECT id, email, first_name, company_id
            FROM users 
            WHERE email = $1 AND email_verified = false AND is_active = true
        `, [email]);

        if (userResult.rows.length === 0) {
            // Don't reveal if email exists
            return res.json({
                success: true,
                message: 'If the email exists and is unverified, a verification email has been sent.'
            });
        }

        const user = userResult.rows[0];

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await req.db.query(`
            UPDATE users 
            SET email_verification_token = $1, email_verification_expires = $2, updated_at = NOW()
            WHERE id = $3
        `, [verificationToken, expiresAt, user.id]);

        // Send verification email
        const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
        
        await req.emailTransporter.sendMail({
            from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verify your email address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e40af;">Verify Your Email Address</h2>
                    <p>Hi ${user.first_name},</p>
                    <p>Please verify your email address by clicking the button below:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Verify Email Address
                        </a>
                    </div>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't request this verification, please ignore this email.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
                    <p style="font-size: 12px; color: #666;">
                        This email was sent from ${process.env.APP_NAME}. 
                        If you have questions, contact us at ${process.env.SUPPORT_EMAIL}.
                    </p>
                </div>
            `
        });

        await req.logAudit({
            companyId: user.company_id,
            userId: user.id,
            action: 'auth.verification_resent',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { email }
        });

        res.json({
            success: true,
            message: 'Verification email sent successfully'
        });

    } catch (error) {
        req.logger.error('Resend verification error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to resend verification email' });
    }
});

module.exports = router;