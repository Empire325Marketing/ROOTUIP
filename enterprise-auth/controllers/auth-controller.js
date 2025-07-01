// ROOTUIP Enterprise Authentication Controller
// Complete authentication endpoints with JWT, MFA, and session management

const jwt = require('jsonwebtoken');
const SecurityConfig = require('../config/security-config');
const CryptoUtils = require('../utils/crypto-utils');
const AuthMiddleware = require('../middleware/auth-middleware');

class AuthController {
    constructor(database) {
        this.db = database;
        this.config = SecurityConfig;
        this.crypto = CryptoUtils;
        this.authMiddleware = new AuthMiddleware(database);
    }

    // User Registration
    async register(req, res) {
        const { email, password, firstName, lastName, companyName, companyDomain, inviteToken } = req.body;

        try {
            // Check if registration via invite or new company
            let companyId;
            let userRole = 'admin'; // Default for new company

            if (inviteToken) {
                // Validate invite token and get company
                const invite = await this.validateInviteToken(inviteToken);
                if (!invite) {
                    return res.status(400).json({
                        error: 'Invalid invite',
                        message: 'Invite token is invalid or expired'
                    });
                }
                companyId = invite.company_id;
                userRole = invite.role || 'viewer';
            } else {
                // Create new company
                const companyResult = await this.db.query(`
                    INSERT INTO companies (name, domain, status, subscription_tier)
                    VALUES ($1, $2, 'active', 'standard')
                    RETURNING id
                `, [companyName, companyDomain]);
                
                companyId = companyResult.rows[0].id;
            }

            // Check if user already exists
            const existingUser = await this.db.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );

            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    error: 'User exists',
                    message: 'An account with this email already exists'
                });
            }

            // Get password policy for company
            const company = await this.db.query('SELECT subscription_tier FROM companies WHERE id = $1', [companyId]);
            const passwordPolicy = this.config.getPasswordPolicy(company.rows[0].subscription_tier);

            // Validate password against policy
            const passwordValidation = this.crypto.validatePassword(password, passwordPolicy);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    error: 'Password validation failed',
                    message: 'Password does not meet security requirements',
                    errors: passwordValidation.errors
                });
            }

            // Hash password
            const passwordHash = await this.crypto.hashPassword(password);

            // Generate email verification token
            const emailVerificationToken = this.crypto.generateEmailVerificationToken(email);

            // Create user
            const userResult = await this.db.query(`
                INSERT INTO users (
                    company_id, email, password_hash, first_name, last_name, role,
                    email_verification_token, email_verification_expires
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, email, first_name, last_name, role
            `, [
                companyId,
                email.toLowerCase(),
                passwordHash,
                firstName,
                lastName,
                userRole,
                emailVerificationToken,
                new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            ]);

            const user = userResult.rows[0];

            // Store password in history
            await this.db.query(`
                INSERT INTO password_history (user_id, password_hash)
                VALUES ($1, $2)
            `, [user.id, passwordHash]);

            // Log registration
            await this.authMiddleware.logAuditEvent(req, 'user.registered', {
                userId: user.id,
                companyId,
                email: user.email,
                role: userRole
            });

            // Send verification email (implementation depends on email service)
            await this.sendVerificationEmail(user.email, emailVerificationToken);

            res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: {
                    userId: user.id,
                    email: user.email,
                    emailVerificationRequired: true
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            
            await this.authMiddleware.logAuditEvent(req, 'user.registration_failed', {
                email,
                error: error.message
            });

            res.status(500).json({
                error: 'Registration failed',
                message: 'Unable to create account'
            });
        }
    }

    // User Login
    async login(req, res) {
        const { email, password, mfaToken, rememberMe } = req.body;

        try {
            // Get user with company info
            const userResult = await this.db.query(`
                SELECT u.*, c.name as company_name, c.subscription_tier, c.enforce_mfa,
                       c.status as company_status, c.session_timeout_minutes
                FROM users u
                JOIN companies c ON u.company_id = c.id
                WHERE u.email = $1
            `, [email.toLowerCase()]);

            if (userResult.rows.length === 0) {
                await this.logLoginAttempt(email, req.ip, false, 'user_not_found');
                return res.status(401).json({
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            }

            const user = userResult.rows[0];

            // Check if user account is active
            if (user.status !== 'active') {
                await this.logLoginAttempt(email, req.ip, false, 'account_inactive');
                return res.status(401).json({
                    error: 'Account inactive',
                    message: 'Your account has been deactivated'
                });
            }

            // Check if user is locked
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
                await this.logLoginAttempt(email, req.ip, false, 'account_locked');
                return res.status(401).json({
                    error: 'Account locked',
                    message: 'Account is temporarily locked due to failed login attempts'
                });
            }

            // Check if company is active
            if (user.company_status !== 'active') {
                await this.logLoginAttempt(email, req.ip, false, 'company_inactive');
                return res.status(401).json({
                    error: 'Company inactive',
                    message: 'Your company account is not active'
                });
            }

            // Verify password
            const passwordValid = await this.crypto.verifyPassword(password, user.password_hash);
            if (!passwordValid) {
                // Increment failed attempts
                await this.incrementFailedAttempts(user.id);
                await this.logLoginAttempt(email, req.ip, false, 'invalid_password');
                
                return res.status(401).json({
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
            }

            // Check if MFA is required
            const mfaRequired = user.enforce_mfa || user.mfa_enabled;
            if (mfaRequired && !mfaToken) {
                return res.status(200).json({
                    mfaRequired: true,
                    message: 'Multi-factor authentication required'
                });
            }

            // Verify MFA token if provided
            if (mfaRequired && mfaToken) {
                const mfaValid = this.crypto.verifyMFAToken(mfaToken, user.mfa_secret);
                if (!mfaValid) {
                    // Check backup codes
                    const backupCodeValid = await this.crypto.verifyMFABackupCode(
                        mfaToken, 
                        user.mfa_backup_codes || []
                    );
                    
                    if (!backupCodeValid) {
                        await this.logLoginAttempt(email, req.ip, false, 'mfa_failed');
                        return res.status(401).json({
                            error: 'Invalid MFA token',
                            message: 'Multi-factor authentication failed'
                        });
                    }

                    // Remove used backup code
                    await this.removeUsedBackupCode(user.id, mfaToken);
                }
            }

            // Reset failed attempts on successful login
            await this.resetFailedAttempts(user.id);

            // Check concurrent session limits
            const sessionCount = await this.getActiveSessionCount(user.id);
            if (sessionCount >= user.max_concurrent_sessions) {
                // Revoke oldest session
                await this.revokeOldestSession(user.id);
            }

            // Create session
            const { sessionId, refreshToken } = await this.authMiddleware.createSession(user.id, req);

            // Generate access token
            const accessToken = this.generateAccessToken(user, sessionId);

            // Update user login info
            await this.db.query(`
                UPDATE users 
                SET last_login = NOW(), last_login_ip = $2, current_session_id = $3,
                    concurrent_sessions = concurrent_sessions + 1
                WHERE id = $1
            `, [user.id, req.ip, sessionId]);

            // Log successful login
            await this.logLoginAttempt(email, req.ip, true, null, user.id);
            await this.authMiddleware.logAuditEvent(req, 'auth.login.success', {
                userId: user.id,
                sessionId,
                mfaUsed: mfaRequired
            });

            // Set secure cookie if remember me
            if (rememberMe) {
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
                });
            }

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    accessToken,
                    refreshToken: rememberMe ? undefined : refreshToken, // Don't return if using cookie
                    expiresIn: this.config.jwt.accessTokenExpiry,
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        role: user.role,
                        companyId: user.company_id,
                        companyName: user.company_name
                    }
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            await this.logLoginAttempt(email, req.ip, false, 'system_error');
            
            res.status(500).json({
                error: 'Login failed',
                message: 'Unable to authenticate user'
            });
        }
    }

    // Token Refresh
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            const cookieToken = req.cookies.refreshToken;
            const token = refreshToken || cookieToken;

            if (!token) {
                return res.status(401).json({
                    error: 'Refresh token required',
                    message: 'No refresh token provided'
                });
            }

            // Hash the refresh token
            const tokenHash = await this.crypto.hashRefreshToken(token);

            // Find session with this refresh token
            const sessionResult = await this.db.query(`
                SELECT s.*, u.id as user_id, u.email, u.role, u.company_id,
                       c.name as company_name, c.subscription_tier
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                JOIN companies c ON u.company_id = c.id
                WHERE s.refresh_token_hash = $1 AND s.is_active = true AND s.expires_at > NOW()
            `, [tokenHash]);

            if (sessionResult.rows.length === 0) {
                return res.status(401).json({
                    error: 'Invalid refresh token',
                    message: 'Refresh token is invalid or expired'
                });
            }

            const session = sessionResult.rows[0];

            // Generate new access token
            const newAccessToken = this.generateAccessToken(session, session.id);

            // Update session activity
            await this.authMiddleware.updateSessionActivity(session.id, req.ip);

            // Log token refresh
            await this.authMiddleware.logAuditEvent(req, 'auth.token_refreshed', {
                userId: session.user_id,
                sessionId: session.id
            });

            res.json({
                success: true,
                data: {
                    accessToken: newAccessToken,
                    expiresIn: this.config.jwt.accessTokenExpiry
                }
            });

        } catch (error) {
            console.error('Token refresh error:', error);
            
            res.status(500).json({
                error: 'Token refresh failed',
                message: 'Unable to refresh authentication token'
            });
        }
    }

    // User Logout
    async logout(req, res) {
        try {
            const { sessionId } = req.user;

            if (sessionId) {
                // Revoke session
                await this.db.query(`
                    UPDATE user_sessions 
                    SET is_active = false, revoked_at = NOW(), revoked_reason = 'user_logout'
                    WHERE id = $1
                `, [sessionId]);

                // Update user concurrent session count
                await this.db.query(`
                    UPDATE users 
                    SET concurrent_sessions = GREATEST(0, concurrent_sessions - 1)
                    WHERE id = $1
                `, [req.user.id]);
            }

            // Clear refresh token cookie
            res.clearCookie('refreshToken');

            // Log logout
            await this.authMiddleware.logAuditEvent(req, 'auth.logout', {
                userId: req.user.id,
                sessionId
            });

            res.json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error) {
            console.error('Logout error:', error);
            
            res.status(500).json({
                error: 'Logout failed',
                message: 'Unable to logout user'
            });
        }
    }

    // Setup MFA
    async setupMFA(req, res) {
        try {
            const userId = req.user.id;

            // Generate MFA secret
            const secret = this.crypto.generateMFASecret();

            // Generate QR code
            const qrCodeDataUrl = await this.crypto.generateMFAQRCode(secret, req.user.email);

            // Generate backup codes
            const backupCodes = this.crypto.generateMFABackupCodes();
            const hashedBackupCodes = await Promise.all(
                backupCodes.map(code => this.crypto.hashMFABackupCode(code))
            );

            // Store MFA secret (but don't enable yet)
            await this.db.query(`
                UPDATE users 
                SET mfa_secret = $1, mfa_backup_codes = $2, mfa_setup_completed = false
                WHERE id = $3
            `, [secret.base32, hashedBackupCodes, userId]);

            // Log MFA setup initiation
            await this.authMiddleware.logAuditEvent(req, 'auth.mfa_setup_initiated', {
                userId
            });

            res.json({
                success: true,
                data: {
                    secret: secret.base32,
                    qrCode: qrCodeDataUrl,
                    backupCodes: backupCodes
                }
            });

        } catch (error) {
            console.error('MFA setup error:', error);
            
            res.status(500).json({
                error: 'MFA setup failed',
                message: 'Unable to setup multi-factor authentication'
            });
        }
    }

    // Verify and Enable MFA
    async verifyMFA(req, res) {
        try {
            const { token } = req.body;
            const userId = req.user.id;

            // Get user's MFA secret
            const userResult = await this.db.query(
                'SELECT mfa_secret FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0 || !userResult.rows[0].mfa_secret) {
                return res.status(400).json({
                    error: 'MFA not configured',
                    message: 'Multi-factor authentication has not been set up'
                });
            }

            const secret = userResult.rows[0].mfa_secret;

            // Verify token
            const isValid = this.crypto.verifyMFAToken(token, secret);
            if (!isValid) {
                return res.status(400).json({
                    error: 'Invalid token',
                    message: 'The provided MFA token is invalid'
                });
            }

            // Enable MFA
            await this.db.query(`
                UPDATE users 
                SET mfa_enabled = true, mfa_setup_completed = true
                WHERE id = $1
            `, [userId]);

            // Log MFA enablement
            await this.authMiddleware.logAuditEvent(req, 'auth.mfa_enabled', {
                userId
            });

            res.json({
                success: true,
                message: 'Multi-factor authentication enabled successfully'
            });

        } catch (error) {
            console.error('MFA verification error:', error);
            
            res.status(500).json({
                error: 'MFA verification failed',
                message: 'Unable to verify multi-factor authentication'
            });
        }
    }

    // Disable MFA
    async disableMFA(req, res) {
        try {
            const { password, mfaToken } = req.body;
            const userId = req.user.id;

            // Verify password
            const userResult = await this.db.query(
                'SELECT password_hash, mfa_secret FROM users WHERE id = $1',
                [userId]
            );

            const user = userResult.rows[0];
            const passwordValid = await this.crypto.verifyPassword(password, user.password_hash);
            
            if (!passwordValid) {
                return res.status(401).json({
                    error: 'Invalid password',
                    message: 'Password verification failed'
                });
            }

            // Verify MFA token
            const mfaValid = this.crypto.verifyMFAToken(mfaToken, user.mfa_secret);
            if (!mfaValid) {
                return res.status(401).json({
                    error: 'Invalid MFA token',
                    message: 'MFA token verification failed'
                });
            }

            // Disable MFA
            await this.db.query(`
                UPDATE users 
                SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL,
                    mfa_setup_completed = false
                WHERE id = $1
            `, [userId]);

            // Log MFA disablement
            await this.authMiddleware.logAuditEvent(req, 'auth.mfa_disabled', {
                userId
            });

            res.json({
                success: true,
                message: 'Multi-factor authentication disabled successfully'
            });

        } catch (error) {
            console.error('MFA disable error:', error);
            
            res.status(500).json({
                error: 'MFA disable failed',
                message: 'Unable to disable multi-factor authentication'
            });
        }
    }

    // Helper Methods

    generateAccessToken(user, sessionId) {
        return jwt.sign(
            {
                userId: user.id || user.user_id,
                email: user.email,
                role: user.role,
                companyId: user.company_id,
                sessionId
            },
            this.config.jwt.accessTokenSecret,
            {
                expiresIn: this.config.jwt.accessTokenExpiry,
                issuer: this.config.jwt.issuer,
                audience: this.config.jwt.audience,
                algorithm: this.config.jwt.algorithm
            }
        );
    }

    async validateInviteToken(token) {
        const result = await this.db.query(`
            SELECT company_id, role, expires_at
            FROM user_invites
            WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL
        `, [token]);

        return result.rows[0] || null;
    }

    async logLoginAttempt(email, ipAddress, success, failureReason, userId = null) {
        try {
            await this.db.query(`
                INSERT INTO login_attempts (
                    email, ip_address, success, failure_reason, user_id, timestamp
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, [email, ipAddress, success, failureReason, userId]);
        } catch (error) {
            console.error('Failed to log login attempt:', error);
        }
    }

    async incrementFailedAttempts(userId) {
        const result = await this.db.query(`
            UPDATE users 
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE 
                    WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
                    ELSE locked_until
                END
            WHERE id = $1
            RETURNING failed_login_attempts
        `, [userId]);

        const attempts = result.rows[0].failed_login_attempts;
        
        if (attempts >= 5) {
            await this.authMiddleware.logSecurityEvent({ ip: '0.0.0.0' }, 'account_locked', {
                userId,
                attempts
            });
        }
    }

    async resetFailedAttempts(userId) {
        await this.db.query(`
            UPDATE users 
            SET failed_login_attempts = 0, locked_until = NULL
            WHERE id = $1
        `, [userId]);
    }

    async getActiveSessionCount(userId) {
        const result = await this.db.query(`
            SELECT COUNT(*) as count
            FROM user_sessions
            WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
        `, [userId]);

        return parseInt(result.rows[0].count);
    }

    async revokeOldestSession(userId) {
        await this.db.query(`
            UPDATE user_sessions
            SET is_active = false, revoked_at = NOW(), revoked_reason = 'session_limit_exceeded'
            WHERE id = (
                SELECT id FROM user_sessions
                WHERE user_id = $1 AND is_active = true
                ORDER BY created_at ASC
                LIMIT 1
            )
        `, [userId]);
    }

    async removeUsedBackupCode(userId, usedCode) {
        const userResult = await this.db.query(
            'SELECT mfa_backup_codes FROM users WHERE id = $1',
            [userId]
        );

        const backupCodes = userResult.rows[0].mfa_backup_codes || [];
        const normalizedUsedCode = usedCode.replace(/-/g, '').toLowerCase();
        const usedCodeHash = await this.crypto.hashMFABackupCode(normalizedUsedCode);

        const updatedCodes = backupCodes.filter(hash => hash !== usedCodeHash);

        await this.db.query(
            'UPDATE users SET mfa_backup_codes = $1 WHERE id = $2',
            [updatedCodes, userId]
        );
    }

    async sendVerificationEmail(email, token) {
        // Implementation depends on email service (SendGrid, SES, etc.)
        console.log(`Email verification token for ${email}: ${token}`);
        // TODO: Implement actual email sending
    }
}

module.exports = AuthController;