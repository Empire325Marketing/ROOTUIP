/**
 * Password Management Routes
 * Password reset, change, and security functions
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const validator = require('validator');
const httpStatus = require('http-status');

const router = express.Router();

// Rate limiting for password operations
const passwordResetRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour per IP
    message: { error: 'Too many password reset attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const passwordChangeRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Too many password change attempts, please try again later.' }
});

// Password validation function
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
    
    // Check for common weak patterns
    if (/(.)\1{2,}/.test(password)) {
        errors.push('Password cannot contain more than 2 consecutive identical characters');
    }
    
    if (/^(?:password|123456|qwerty|admin|login|welcome)/i.test(password)) {
        errors.push('Password cannot start with common weak patterns');
    }
    
    return errors;
};

// Check password history
const checkPasswordHistory = async (db, userId, newPasswordHash, historyCount = 5) => {
    const historyResult = await db.query(`
        SELECT password_history FROM users WHERE id = $1
    `, [userId]);
    
    if (historyResult.rows.length === 0) return false;
    
    const passwordHistory = JSON.parse(historyResult.rows[0].password_history || '[]');
    
    for (const oldHash of passwordHistory.slice(0, historyCount)) {
        if (await bcrypt.compare(newPasswordHash, oldHash)) {
            return true; // Password was used before
        }
    }
    
    return false;
};

// Update password history
const updatePasswordHistory = async (db, userId, passwordHash, maxHistory = 5) => {
    const historyResult = await db.query(`
        SELECT password_history FROM users WHERE id = $1
    `, [userId]);
    
    let passwordHistory = [];
    if (historyResult.rows.length > 0) {
        passwordHistory = JSON.parse(historyResult.rows[0].password_history || '[]');
    }
    
    // Add new password to history
    passwordHistory.unshift(passwordHash);
    
    // Keep only the specified number of passwords
    passwordHistory = passwordHistory.slice(0, maxHistory);
    
    await db.query(`
        UPDATE users 
        SET password_history = $1, updated_at = NOW()
        WHERE id = $2
    `, [JSON.stringify(passwordHistory), userId]);
};

// Request password reset
router.post('/reset-request', passwordResetRateLimit, [
    body('email').isEmail().normalizeEmail().withMessage('Valid email address required')
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

        // Always return success to prevent email enumeration
        const successResponse = {
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        };

        // Check if user exists and is active
        const userResult = await req.db.query(`
            SELECT u.id, u.first_name, u.email, u.company_id, c.name as company_name
            FROM users u
            JOIN companies c ON u.company_id = c.id
            WHERE u.email = $1 AND u.is_active = true AND u.deleted_at IS NULL
        `, [email]);

        if (userResult.rows.length === 0) {
            // Still log the attempt for security monitoring
            await req.logAudit({
                action: 'password.reset_request_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'User not found',
                metadata: { email, reason: 'user_not_found' }
            });
            
            return res.json(successResponse);
        }

        const user = userResult.rows[0];

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store reset token
        await req.db.query(`
            INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
        `, [user.id, resetToken, expiresAt, req.ip, req.get('User-Agent')]);

        // Send reset email
        const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
        
        await req.emailTransporter.sendMail({
            from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e40af; margin: 0;">${user.company_name}</h1>
                        <p style="color: #666; margin: 5px 0;">UIP Enterprise Platform</p>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 30px; border-radius: 8px; border-left: 4px solid #1e40af;">
                        <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
                        <p>Hi ${user.first_name},</p>
                        <p>We received a request to reset your password for your UIP Enterprise Platform account.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                                Reset Your Password
                            </a>
                        </div>
                        
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
                            <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ Security Information</h4>
                            <ul style="color: #856404; margin: 0; padding-left: 20px;">
                                <li>This link will expire in 1 hour</li>
                                <li>Request made from IP: ${req.ip}</li>
                                <li>If you didn't request this reset, please ignore this email</li>
                            </ul>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">
                            If the button doesn't work, copy and paste this link into your browser:<br>
                            <a href="${resetUrl}" style="color: #1e40af; word-break: break-all;">${resetUrl}</a>
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
                        <p style="font-size: 12px; color: #666;">
                            This email was sent from ${process.env.APP_NAME}.<br>
                            If you have questions, contact us at ${process.env.SUPPORT_EMAIL}.
                        </p>
                    </div>
                </div>
            `
        });

        // Log successful password reset request
        await req.logAudit({
            companyId: user.company_id,
            userId: user.id,
            action: 'password.reset_requested',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { email, tokenExpires: expiresAt.toISOString() }
        });

        res.json(successResponse);

    } catch (error) {
        req.logger.error('Password reset request error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to process password reset request' 
        });
    }
});

// Verify reset token
router.post('/reset-verify', [
    body('token').isLength({ min: 32, max: 64 }).withMessage('Valid reset token required')
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

        // Verify token exists and is not expired
        const tokenResult = await req.db.query(`
            SELECT prt.*, u.email, u.first_name, u.company_id, c.password_policy
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            JOIN companies c ON u.company_id = c.id
            WHERE prt.token = $1 AND prt.expires_at > NOW() AND prt.used_at IS NULL
        `, [token]);

        if (tokenResult.rows.length === 0) {
            await req.logAudit({
                action: 'password.reset_token_invalid',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid or expired token',
                metadata: { token: token.substring(0, 8) + '...' }
            });

            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Invalid or expired reset token' 
            });
        }

        const tokenData = tokenResult.rows[0];

        res.json({
            success: true,
            valid: true,
            email: tokenData.email,
            firstName: tokenData.first_name,
            passwordPolicy: tokenData.password_policy
        });

    } catch (error) {
        req.logger.error('Password reset token verification error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to verify reset token' 
        });
    }
});

// Complete password reset
router.post('/reset-complete', passwordChangeRateLimit, [
    body('token').isLength({ min: 32, max: 64 }).withMessage('Valid reset token required'),
    body('newPassword').isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { token, newPassword } = req.body;

        // Get token and user information
        const tokenResult = await req.db.query(`
            SELECT prt.*, u.id as user_id, u.email, u.company_id, c.password_policy
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            JOIN companies c ON u.company_id = c.id
            WHERE prt.token = $1 AND prt.expires_at > NOW() AND prt.used_at IS NULL
        `, [token]);

        if (tokenResult.rows.length === 0) {
            await req.logAudit({
                action: 'password.reset_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid or expired token',
                metadata: { token: token.substring(0, 8) + '...' }
            });

            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Invalid or expired reset token' 
            });
        }

        const tokenData = tokenResult.rows[0];
        const passwordPolicy = tokenData.password_policy || {};

        // Validate new password against policy
        const passwordErrors = validatePassword(newPassword, passwordPolicy);
        if (passwordErrors.length > 0) {
            await req.logAudit({
                companyId: tokenData.company_id,
                userId: tokenData.user_id,
                action: 'password.reset_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Password policy violation',
                metadata: { errors: passwordErrors }
            });

            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Password does not meet security requirements',
                details: passwordErrors
            });
        }

        const client = await req.db.connect();
        try {
            await client.query('BEGIN');

            // Generate new salt and hash password
            const salt = crypto.randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(newPassword + salt, 12);

            // Check password history
            const isReused = await checkPasswordHistory(client, tokenData.user_id, passwordHash, passwordPolicy.history_count);
            if (isReused) {
                await client.query('ROLLBACK');
                
                await req.logAudit({
                    companyId: tokenData.company_id,
                    userId: tokenData.user_id,
                    action: 'password.reset_failed',
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    success: false,
                    errorMessage: 'Password reuse detected',
                    metadata: { email: tokenData.email }
                });

                return res.status(httpStatus.BAD_REQUEST).json({ 
                    error: 'Cannot reuse previous passwords' 
                });
            }

            // Update password
            await client.query(`
                UPDATE users 
                SET password_hash = $1, password_salt = $2, password_changed_at = NOW(),
                    must_change_password = false, login_attempts = 0, locked_until = NULL,
                    updated_at = NOW()
                WHERE id = $3
            `, [passwordHash, salt, tokenData.user_id]);

            // Update password history
            await updatePasswordHistory(client, tokenData.user_id, passwordHash, passwordPolicy.history_count);

            // Mark token as used
            await client.query(`
                UPDATE password_reset_tokens 
                SET used_at = NOW()
                WHERE id = $1
            `, [tokenData.id]);

            // Invalidate all existing sessions for security
            await client.query(`
                UPDATE user_sessions 
                SET is_active = false, updated_at = NOW()
                WHERE user_id = $1 AND is_active = true
            `, [tokenData.user_id]);

            await client.query('COMMIT');

            // Send confirmation email
            await req.emailTransporter.sendMail({
                from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
                to: tokenData.email,
                subject: 'Password Successfully Reset',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; text-align: center;">
                            <h2 style="color: #065f46; margin: 0;">✅ Password Reset Successful</h2>
                            <p style="color: #047857; margin: 10px 0 0 0;">Your password has been successfully reset.</p>
                        </div>
                        
                        <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
                            <h3 style="color: #1e293b; margin-top: 0;">Security Information</h3>
                            <ul style="color: #475569;">
                                <li>Reset completed at: ${new Date().toLocaleString()}</li>
                                <li>From IP address: ${req.ip}</li>
                                <li>All existing sessions have been terminated</li>
                            </ul>
                        </div>
                        
                        <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px;">
                            <p style="color: #92400e; margin: 0;">
                                <strong>If you didn't reset your password,</strong> please contact our support team immediately at ${process.env.SUPPORT_EMAIL}.
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.APP_URL}/login" style="display: inline-block; padding: 12px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                                Login to Your Account
                            </a>
                        </div>
                    </div>
                `
            });

            // Log successful password reset
            await req.logAudit({
                companyId: tokenData.company_id,
                userId: tokenData.user_id,
                action: 'password.reset_completed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: true,
                metadata: { 
                    email: tokenData.email,
                    sessionsInvalidated: true,
                    tokenUsed: tokenData.id
                }
            });

            res.json({
                success: true,
                message: 'Password has been reset successfully. All existing sessions have been terminated for security.'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        req.logger.error('Password reset completion error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to reset password' 
        });
    }
});

// Change password (authenticated user)
router.post('/change', passwordChangeRateLimit, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 12 }).withMessage('New password must be at least 12 characters long')
], async (req, res) => {
    try {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // Get user's current password and company policy
        const userResult = await req.db.query(`
            SELECT u.password_hash, u.password_salt, u.company_id, c.password_policy
            FROM users u
            JOIN companies c ON u.company_id = c.id
            WHERE u.id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        const passwordPolicy = user.password_policy || {};

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword + user.password_salt, user.password_hash);
        if (!isCurrentPasswordValid) {
            await req.logAudit({
                companyId: user.company_id,
                userId: userId,
                action: 'password.change_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid current password'
            });

            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Current password is incorrect' });
        }

        // Validate new password
        const passwordErrors = validatePassword(newPassword, passwordPolicy);
        if (passwordErrors.length > 0) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'New password does not meet security requirements',
                details: passwordErrors
            });
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword + user.password_salt, user.password_hash);
        if (isSamePassword) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'New password must be different from current password' 
            });
        }

        const client = await req.db.connect();
        try {
            await client.query('BEGIN');

            // Generate new salt and hash
            const newSalt = crypto.randomBytes(16).toString('hex');
            const newPasswordHash = await bcrypt.hash(newPassword + newSalt, 12);

            // Check password history
            const isReused = await checkPasswordHistory(client, userId, newPasswordHash, passwordPolicy.history_count);
            if (isReused) {
                await client.query('ROLLBACK');
                return res.status(httpStatus.BAD_REQUEST).json({ 
                    error: 'Cannot reuse previous passwords' 
                });
            }

            // Update password
            await client.query(`
                UPDATE users 
                SET password_hash = $1, password_salt = $2, password_changed_at = NOW(),
                    must_change_password = false, updated_at = NOW()
                WHERE id = $3
            `, [newPasswordHash, newSalt, userId]);

            // Update password history
            await updatePasswordHistory(client, userId, newPasswordHash, passwordPolicy.history_count);

            await client.query('COMMIT');

            // Log successful password change
            await req.logAudit({
                companyId: user.company_id,
                userId: userId,
                action: 'password.changed',
                sessionId: req.user.sessionId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: true
            });

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        req.logger.error('Password change error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to change password' 
        });
    }
});

// Get password policy
router.get('/policy', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const companyResult = await req.db.query(`
            SELECT password_policy FROM companies WHERE id = $1
        `, [req.user.company_id]);

        if (companyResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'Company not found' });
        }

        const passwordPolicy = companyResult.rows[0].password_policy || {};

        res.json({
            success: true,
            policy: {
                minLength: passwordPolicy.min_length || 12,
                requireUppercase: passwordPolicy.require_uppercase !== false,
                requireLowercase: passwordPolicy.require_lowercase !== false,
                requireNumbers: passwordPolicy.require_numbers !== false,
                requireSymbols: passwordPolicy.require_symbols !== false,
                historyCount: passwordPolicy.history_count || 5,
                maxAgeDays: passwordPolicy.max_age_days || 90
            }
        });

    } catch (error) {
        req.logger.error('Password policy error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to get password policy' 
        });
    }
});

module.exports = router;