/**
 * Multi-Factor Authentication Routes
 * TOTP and SMS-based MFA implementation
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const twilio = require('twilio');
const httpStatus = require('http-status');

const router = express.Router();

// Rate limiting for MFA endpoints
const mfaRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many MFA attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// SMS rate limiting (more restrictive)
const smsRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 SMS per hour
    message: { error: 'Too many SMS requests, please try again later.' }
});

// Setup TOTP (Time-based One-Time Password)
router.post('/setup-totp', mfaRateLimit, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const userId = req.user.id;
        const userEmail = req.user.email;
        const companyName = req.user.company_name || 'UIP Enterprise';

        // Check if MFA is already enabled
        const userResult = await req.db.query(`
            SELECT mfa_enabled, mfa_secret FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        if (user.mfa_enabled) {
            return res.status(httpStatus.CONFLICT).json({ 
                error: 'MFA is already enabled for this account' 
            });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `${companyName} (${userEmail})`,
            issuer: 'UIP Enterprise Platform',
            length: 32
        });

        // Store temporary secret (not yet activated)
        await req.db.query(`
            UPDATE users 
            SET mfa_secret = $1, updated_at = NOW()
            WHERE id = $2
        `, [secret.base32, userId]);

        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        // Log MFA setup initiation
        await req.logAudit({
            companyId: req.user.company_id,
            userId: userId,
            action: 'mfa.setup_initiated',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { method: 'totp' }
        });

        res.json({
            success: true,
            secret: secret.base32,
            qrCode: qrCodeUrl,
            manualEntryKey: secret.base32,
            instructions: {
                step1: 'Install an authenticator app (Google Authenticator, Authy, etc.)',
                step2: 'Scan the QR code or manually enter the key',
                step3: 'Enter the 6-digit code from your app to complete setup'
            }
        });

    } catch (error) {
        req.logger.error('TOTP setup error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to setup TOTP' });
    }
});

// Verify and enable TOTP
router.post('/verify-totp', mfaRateLimit, [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit TOTP code required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const { token } = req.body;
        const userId = req.user.id;

        // Get user's MFA secret
        const userResult = await req.db.query(`
            SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        if (!user.mfa_secret) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'MFA setup not initiated. Please setup TOTP first.' 
            });
        }

        // Verify TOTP token
        const verified = speakeasy.totp.verify({
            secret: user.mfa_secret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow 2 time steps of variance (60 seconds each way)
        });

        if (!verified) {
            await req.logAudit({
                companyId: req.user.company_id,
                userId: userId,
                action: 'mfa.verification_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid TOTP code',
                metadata: { method: 'totp' }
            });

            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Invalid TOTP code. Please try again.' 
            });
        }

        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex'));
        }

        // Hash backup codes for storage
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => req.bcrypt.hash(code, 10))
        );

        // Enable MFA and store backup codes
        await req.db.query(`
            UPDATE users 
            SET mfa_enabled = true, mfa_backup_codes = $1, updated_at = NOW()
            WHERE id = $2
        `, [JSON.stringify(hashedBackupCodes), userId]);

        // Log successful MFA setup
        await req.logAudit({
            companyId: req.user.company_id,
            userId: userId,
            action: 'mfa.enabled',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { method: 'totp', backupCodesGenerated: 10 }
        });

        res.json({
            success: true,
            message: 'TOTP verification successful. MFA is now enabled.',
            backupCodes: backupCodes,
            warning: 'Save these backup codes in a secure location. They can be used to access your account if you lose your authenticator device.'
        });

    } catch (error) {
        req.logger.error('TOTP verification error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to verify TOTP' });
    }
});

// Disable MFA
router.post('/disable-mfa', mfaRateLimit, [
    body('password').isLength({ min: 1 }).withMessage('Current password required'),
    body('confirmationCode').optional().isLength({ min: 6, max: 6 }).withMessage('6-digit confirmation code required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const { password, confirmationCode } = req.body;
        const userId = req.user.id;

        // Get user details
        const userResult = await req.db.query(`
            SELECT password_hash, password_salt, mfa_enabled, mfa_secret, company_id
            FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        if (!user.mfa_enabled) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'MFA is not enabled for this account' 
            });
        }

        // Verify current password
        const isValidPassword = await req.bcrypt.compare(password + user.password_salt, user.password_hash);
        if (!isValidPassword) {
            await req.logAudit({
                companyId: user.company_id,
                userId: userId,
                action: 'mfa.disable_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid password',
                metadata: { reason: 'invalid_password' }
            });

            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid password' });
        }

        // Verify MFA code (additional security)
        if (confirmationCode) {
            const verified = speakeasy.totp.verify({
                secret: user.mfa_secret,
                encoding: 'base32',
                token: confirmationCode,
                window: 2
            });

            if (!verified) {
                await req.logAudit({
                    companyId: user.company_id,
                    userId: userId,
                    action: 'mfa.disable_failed',
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    success: false,
                    errorMessage: 'Invalid MFA code',
                    metadata: { reason: 'invalid_mfa_code' }
                });

                return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid MFA code' });
            }
        }

        // Disable MFA
        await req.db.query(`
            UPDATE users 
            SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL, updated_at = NOW()
            WHERE id = $1
        `, [userId]);

        // Invalidate all active sessions for security
        await req.db.query(`
            UPDATE user_sessions 
            SET is_active = false, updated_at = NOW()
            WHERE user_id = $1 AND is_active = true
        `, [userId]);

        // Log MFA disabled
        await req.logAudit({
            companyId: user.company_id,
            userId: userId,
            action: 'mfa.disabled',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { sessionsInvalidated: true }
        });

        res.json({
            success: true,
            message: 'MFA has been disabled. All active sessions have been terminated for security.',
            requiresReauth: true
        });

    } catch (error) {
        req.logger.error('MFA disable error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to disable MFA' });
    }
});

// Generate new backup codes
router.post('/regenerate-backup-codes', mfaRateLimit, [
    body('mfaCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('6-digit MFA code required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const { mfaCode } = req.body;
        const userId = req.user.id;

        // Get user's MFA details
        const userResult = await req.db.query(`
            SELECT mfa_enabled, mfa_secret, company_id FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        if (!user.mfa_enabled) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'MFA is not enabled for this account' 
            });
        }

        // Verify MFA code
        const verified = speakeasy.totp.verify({
            secret: user.mfa_secret,
            encoding: 'base32',
            token: mfaCode,
            window: 2
        });

        if (!verified) {
            await req.logAudit({
                companyId: user.company_id,
                userId: userId,
                action: 'mfa.backup_codes_regeneration_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid MFA code'
            });

            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid MFA code' });
        }

        // Generate new backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex'));
        }

        // Hash backup codes for storage
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => req.bcrypt.hash(code, 10))
        );

        // Update backup codes
        await req.db.query(`
            UPDATE users 
            SET mfa_backup_codes = $1, updated_at = NOW()
            WHERE id = $2
        `, [JSON.stringify(hashedBackupCodes), userId]);

        // Log backup codes regeneration
        await req.logAudit({
            companyId: user.company_id,
            userId: userId,
            action: 'mfa.backup_codes_regenerated',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { codesGenerated: 10 }
        });

        res.json({
            success: true,
            backupCodes: backupCodes,
            message: 'New backup codes generated successfully.',
            warning: 'Your old backup codes are no longer valid. Save these new codes in a secure location.'
        });

    } catch (error) {
        req.logger.error('Backup codes regeneration error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to regenerate backup codes' });
    }
});

// Verify backup code
router.post('/verify-backup-code', mfaRateLimit, [
    body('backupCode').isLength({ min: 8, max: 8 }).withMessage('8-character backup code required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { backupCode, email } = req.body;

        // Get user with backup codes
        const userResult = await req.db.query(`
            SELECT id, mfa_backup_codes, company_id, first_name, last_name, role_id
            FROM users 
            WHERE email = $1 AND mfa_enabled = true AND is_active = true
        `, [email]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];
        const backupCodes = JSON.parse(user.mfa_backup_codes || '[]');

        if (backupCodes.length === 0) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'No backup codes available for this account' 
            });
        }

        // Check backup code against all stored codes
        let codeIndex = -1;
        let validCode = false;

        for (let i = 0; i < backupCodes.length; i++) {
            if (await req.bcrypt.compare(backupCode, backupCodes[i])) {
                validCode = true;
                codeIndex = i;
                break;
            }
        }

        if (!validCode) {
            await req.logAudit({
                companyId: user.company_id,
                userId: user.id,
                action: 'mfa.backup_code_failed',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Invalid backup code',
                metadata: { email }
            });

            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid backup code' });
        }

        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        
        await req.db.query(`
            UPDATE users 
            SET mfa_backup_codes = $1, updated_at = NOW()
            WHERE id = $2
        `, [JSON.stringify(backupCodes), user.id]);

        // Create emergency session (shorter duration)
        const sessionId = crypto.randomUUID();
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const refreshToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours only

        await req.db.query(`
            INSERT INTO user_sessions (
                id, user_id, session_token, refresh_token, ip_address, 
                user_agent, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [sessionId, user.id, sessionToken, refreshToken, req.ip, req.get('User-Agent'), expiresAt]);

        // Get user permissions
        const roleResult = await req.db.query(`
            SELECT permissions FROM roles WHERE id = $1
        `, [user.role_id]);

        const permissions = roleResult.rows[0]?.permissions || [];

        // Generate JWT
        const tokenPayload = {
            userId: user.id,
            companyId: user.company_id,
            roleId: user.role_id,
            sessionId: sessionId,
            permissions: permissions,
            emergencyAccess: true
        };

        const accessToken = req.jwt.sign(tokenPayload, process.env.JWT_SECRET, { 
            expiresIn: '2h',
            issuer: 'uip-auth',
            audience: 'uip-platform'
        });

        // Log successful backup code usage
        await req.logAudit({
            companyId: user.company_id,
            userId: user.id,
            action: 'mfa.backup_code_used',
            sessionId: sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { 
                email, 
                remainingBackupCodes: backupCodes.length,
                emergencyAccess: true
            }
        });

        res.json({
            success: true,
            accessToken,
            refreshToken,
            expiresAt: expiresAt.toISOString(),
            emergencyAccess: true,
            remainingBackupCodes: backupCodes.length,
            message: backupCodes.length === 0 ? 
                'This was your last backup code. Please generate new backup codes immediately.' :
                `You have ${backupCodes.length} backup codes remaining.`,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name
            }
        });

    } catch (error) {
        req.logger.error('Backup code verification error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to verify backup code' });
    }
});

// Setup SMS MFA (future enhancement)
router.post('/setup-sms', smsRateLimit, [
    body('phoneNumber').isMobilePhone().withMessage('Valid phone number required')
], async (req, res) => {
    try {
        // This is a placeholder for SMS MFA implementation
        // Would require Twilio or similar SMS service
        
        res.status(httpStatus.NOT_IMPLEMENTED).json({ 
            error: 'SMS MFA is not yet implemented',
            message: 'Please use TOTP authentication for now'
        });
        
    } catch (error) {
        req.logger.error('SMS MFA setup error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to setup SMS MFA' });
    }
});

// Get MFA status
router.get('/status', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const userId = req.user.id;

        const userResult = await req.db.query(`
            SELECT mfa_enabled, mfa_backup_codes, phone, phone_verified
            FROM users WHERE id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        const backupCodes = JSON.parse(user.mfa_backup_codes || '[]');

        res.json({
            success: true,
            mfaEnabled: user.mfa_enabled,
            methods: {
                totp: user.mfa_enabled,
                sms: false, // Not yet implemented
                backupCodes: user.mfa_enabled
            },
            backupCodesCount: backupCodes.length,
            phoneNumber: user.phone,
            phoneVerified: user.phone_verified
        });

    } catch (error) {
        req.logger.error('MFA status error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get MFA status' });
    }
});

module.exports = router;