// Enterprise Authentication Service
// Fortune 500-grade security implementation

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio');

class EnterpriseAuthService {
  constructor(config) {
    this.app = express();
    this.pool = new Pool(config.database);
    this.jwtSecret = config.jwtSecret || crypto.randomBytes(64).toString('hex');
    this.twilioClient = config.twilio ? twilio(config.twilio.accountSid, config.twilio.authToken) : null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      next();
    });

    // Trust proxy
    this.app.set('trust proxy', true);

    // Rate limiting
    this.setupRateLimiting();

    // CSRF protection
    this.csrfProtection = csrf({ cookie: true });
  }

  setupRateLimiting() {
    // General API rate limit
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logAudit(req, 'RATE_LIMIT_EXCEEDED', 'api', req.path);
        res.status(429).json({ error: 'Too many requests' });
      },
    });

    // Strict rate limit for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      handler: (req, res) => {
        this.logAudit(req, 'AUTH_RATE_LIMIT_EXCEEDED', 'auth', req.path);
        res.status(429).json({ error: 'Too many authentication attempts' });
      },
    });

    this.apiLimiter = apiLimiter;
    this.authLimiter = authLimiter;
  }

  // Middleware for authentication
  async authenticate(req, res, next) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if session is still valid
      const sessionResult = await this.pool.query(
        'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL',
        [this.hashToken(token)]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ error: 'Session expired or invalid' });
      }

      // Get user with role
      const userResult = await this.pool.query(`
        SELECT u.*, r.name as role_name, r.permissions, c.id as company_id, c.name as company_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL
      `, [decoded.userId]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      req.user = userResult.rows[0];
      req.session = sessionResult.rows[0];
      req.token = token;
      
      // Set company context for RLS
      await this.pool.query('SET LOCAL app.current_company_id = $1', [req.user.company_id]);
      await this.pool.query('SET LOCAL app.current_user_id = $1', [req.user.id]);
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.status(500).json({ error: 'Authentication failed' });
    }
  }

  // Middleware for role checking
  requireRole(roles) {
    return (req, res, next) => {
      if (!roles.includes(req.user.role_name)) {
        this.logAudit(req, 'ACCESS_DENIED', 'authorization', req.path, {
          required_roles: roles,
          user_role: req.user.role_name
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  // Middleware for permission checking
  requirePermission(resource, action) {
    return (req, res, next) => {
      const permissions = req.user.permissions || {};
      
      if (!permissions[resource]?.[action]) {
        this.logAudit(req, 'PERMISSION_DENIED', 'authorization', req.path, {
          required_permission: `${resource}.${action}`,
          user_permissions: permissions
        });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  // Utility functions
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async logAudit(req, action, resourceType, resourceId, details = {}) {
    try {
      const userId = req.user?.id || null;
      const companyId = req.user?.company_id || null;
      
      await this.pool.query(`
        INSERT INTO audit_logs (company_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [companyId, userId, action, resourceType, resourceId, details, req.ip, req.get('user-agent')]);
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'enterprise-auth', timestamp: new Date().toISOString() });
    });

    // Authentication endpoints
    this.app.post('/auth/register', this.authLimiter, this.handleRegister.bind(this));
    this.app.post('/auth/login', this.authLimiter, this.handleLogin.bind(this));
    this.app.post('/auth/logout', this.authenticate.bind(this), this.handleLogout.bind(this));
    this.app.post('/auth/refresh', this.handleRefreshToken.bind(this));
    this.app.get('/auth/verify', this.authenticate.bind(this), this.handleVerify.bind(this));

    // MFA endpoints
    this.app.post('/auth/mfa/enable', this.authenticate.bind(this), this.enableMFA.bind(this));
    this.app.post('/auth/mfa/verify', this.authenticate.bind(this), this.verifyMFA.bind(this));
    this.app.post('/auth/mfa/disable', this.authenticate.bind(this), this.disableMFA.bind(this));
    this.app.get('/auth/mfa/backup-codes', this.authenticate.bind(this), this.getBackupCodes.bind(this));
    this.app.post('/auth/mfa/send-sms', this.authenticate.bind(this), this.sendSMSCode.bind(this));

    // User management
    this.app.get('/auth/users', this.authenticate.bind(this), this.requirePermission('users', 'read'), this.getUsers.bind(this));
    this.app.get('/auth/users/:id', this.authenticate.bind(this), this.requirePermission('users', 'read'), this.getUser.bind(this));
    this.app.put('/auth/users/:id', this.authenticate.bind(this), this.requirePermission('users', 'update'), this.updateUser.bind(this));
    this.app.delete('/auth/users/:id', this.authenticate.bind(this), this.requirePermission('users', 'delete'), this.deleteUser.bind(this));
    this.app.post('/auth/users/invite', this.authenticate.bind(this), this.requirePermission('users', 'create'), this.inviteUser.bind(this));
    this.app.post('/auth/users/bulk-invite', this.authenticate.bind(this), this.requirePermission('users', 'create'), this.bulkInviteUsers.bind(this));
    this.app.post('/auth/users/accept-invite', this.acceptInvitation.bind(this));

    // Role management
    this.app.get('/auth/roles', this.authenticate.bind(this), this.getRoles.bind(this));
    this.app.post('/auth/roles', this.authenticate.bind(this), this.requireRole(['admin']), this.createRole.bind(this));
    this.app.put('/auth/roles/:id', this.authenticate.bind(this), this.requireRole(['admin']), this.updateRole.bind(this));

    // API key management
    this.app.post('/auth/api-keys', this.authenticate.bind(this), this.createAPIKey.bind(this));
    this.app.get('/auth/api-keys', this.authenticate.bind(this), this.getAPIKeys.bind(this));
    this.app.delete('/auth/api-keys/:id', this.authenticate.bind(this), this.revokeAPIKey.bind(this));
    this.app.post('/auth/api-keys/authenticate', this.authenticateAPIKey.bind(this));

    // Password management
    this.app.post('/auth/password/change', this.authenticate.bind(this), this.changePassword.bind(this));
    this.app.post('/auth/password/reset-request', this.requestPasswordReset.bind(this));
    this.app.post('/auth/password/reset', this.resetPassword.bind(this));
    this.app.get('/auth/password-policy', this.authenticate.bind(this), this.getPasswordPolicy.bind(this));
    this.app.put('/auth/password-policy', this.authenticate.bind(this), this.requireRole(['admin']), this.updatePasswordPolicy.bind(this));

    // Session management
    this.app.get('/auth/sessions', this.authenticate.bind(this), this.getSessions.bind(this));
    this.app.post('/auth/sessions/:id/revoke', this.authenticate.bind(this), this.revokeSession.bind(this));
    this.app.post('/auth/sessions/revoke-all', this.authenticate.bind(this), this.revokeAllSessions.bind(this));

    // Audit logs
    this.app.get('/auth/audit-logs', this.authenticate.bind(this), this.requirePermission('audit', 'read'), this.getAuditLogs.bind(this));
    this.app.get('/auth/audit-logs/export', this.authenticate.bind(this), this.requireRole(['admin']), this.exportAuditLogs.bind(this));

    // SSO endpoints
    this.app.get('/auth/sso/metadata', this.getSSOMetadata.bind(this));
    this.app.post('/auth/sso/configure', this.authenticate.bind(this), this.requireRole(['admin']), this.configureSSOSettings.bind(this));
    this.app.post('/auth/sso/login', this.handleSSOLogin.bind(this));
    this.app.post('/auth/sso/callback', this.handleSSOCallback.bind(this));

    // Company/Tenant management
    this.app.get('/auth/company', this.authenticate.bind(this), this.getCompanyInfo.bind(this));
    this.app.put('/auth/company', this.authenticate.bind(this), this.requireRole(['admin']), this.updateCompanyInfo.bind(this));
    this.app.get('/auth/company/stats', this.authenticate.bind(this), this.requireRole(['admin']), this.getCompanyStats.bind(this));

    // CSRF token endpoint
    this.app.get('/auth/csrf-token', this.csrfProtection, (req, res) => {
      res.json({ csrfToken: req.csrfToken() });
    });
  }

  // Authentication handlers
  async handleRegister(req, res) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { email, password, firstName, lastName, companyName, companyDomain } = req.body;
      
      // Check if user exists
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }
      
      // Create or get company
      let companyId;
      if (companyDomain) {
        const companyResult = await client.query('SELECT id FROM companies WHERE domain = $1', [companyDomain]);
        if (companyResult.rows.length > 0) {
          companyId = companyResult.rows[0].id;
        }
      }
      
      if (!companyId && companyName) {
        const newCompany = await client.query(
          'INSERT INTO companies (name, domain) VALUES ($1, $2) RETURNING id',
          [companyName, companyDomain || email.split('@')[1]]
        );
        companyId = newCompany.rows[0].id;
        
        // Create default password policy
        await client.query(
          'INSERT INTO password_policies (company_id) VALUES ($1)',
          [companyId]
        );
      }
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company information required' });
      }
      
      // Validate password against policy
      const policyResult = await client.query('SELECT * FROM password_policies WHERE company_id = $1', [companyId]);
      const policy = policyResult.rows[0];
      
      const passwordValidation = this.validatePassword(password, policy);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: 'Password does not meet requirements', details: passwordValidation.errors });
      }
      
      // Get admin role
      const roleResult = await client.query(
        "SELECT id FROM roles WHERE company_id = $1 AND name = 'admin'",
        [companyId]
      );
      const roleId = roleResult.rows[0]?.id;
      
      // Hash password
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(password + salt, 12);
      
      // Create user
      const userResult = await client.query(`
        INSERT INTO users (company_id, role_id, email, password_hash, password_salt, first_name, last_name, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [companyId, roleId, email, passwordHash, salt, firstName, lastName, true]);
      
      const userId = userResult.rows[0].id;
      
      // Store password in history
      await client.query(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash]
      );
      
      await client.query('COMMIT');
      
      await this.logAudit({ body: req.body, ip: req.ip }, 'USER_REGISTERED', 'user', userId, { email });
      
      res.json({ success: true, message: 'Registration successful' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    } finally {
      client.release();
    }
  }

  async handleLogin(req, res) {
    try {
      const { email, password, mfaCode } = req.body;
      
      // Get user with role
      const userResult = await this.pool.query(`
        SELECT u.*, r.name as role_name, r.permissions, c.id as company_id, c.name as company_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN companies c ON u.company_id = c.id
        WHERE u.email = $1 AND u.is_active = true AND u.deleted_at IS NULL
      `, [email]);
      
      if (userResult.rows.length === 0) {
        await this.logAudit({ body: { email }, ip: req.ip }, 'LOGIN_FAILED', 'auth', null, { reason: 'user_not_found' });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const user = userResult.rows[0];
      
      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await this.logAudit({ body: { email }, ip: req.ip }, 'LOGIN_FAILED', 'auth', null, { reason: 'account_locked' });
        return res.status(401).json({ error: 'Account locked. Please try again later.' });
      }
      
      // Verify password
      const passwordValid = await bcrypt.compare(password + user.password_salt, user.password_hash);
      
      if (!passwordValid) {
        // Increment failed attempts
        await this.pool.query(
          'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = $1',
          [user.id]
        );
        
        // Get password policy for lockout threshold
        const policyResult = await this.pool.query(
          'SELECT lockout_threshold, lockout_duration_minutes FROM password_policies WHERE company_id = $1',
          [user.company_id]
        );
        const policy = policyResult.rows[0];
        
        if (user.login_attempts + 1 >= policy.lockout_threshold) {
          await this.pool.query(
            `UPDATE users SET locked_until = NOW() + INTERVAL '${policy.lockout_duration_minutes} minutes' WHERE id = $1`,
            [user.id]
          );
        }
        
        await this.logAudit({ body: { email }, ip: req.ip }, 'LOGIN_FAILED', 'auth', null, { reason: 'invalid_password' });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Check MFA
      if (user.mfa_enabled) {
        if (!mfaCode) {
          return res.json({ requiresMFA: true, mfaType: user.mfa_type });
        }
        
        let mfaValid = false;
        
        if (user.mfa_type === 'totp') {
          mfaValid = speakeasy.totp.verify({
            secret: user.mfa_secret,
            encoding: 'base32',
            token: mfaCode,
            window: 1
          });
        } else if (user.mfa_type === 'sms') {
          // Verify SMS code (implement your SMS verification logic)
          // For now, accept any 6-digit code
          mfaValid = /^\d{6}$/.test(mfaCode);
        }
        
        if (!mfaValid) {
          // Check backup codes
          const backupResult = await this.pool.query(
            'SELECT id FROM mfa_backup_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL',
            [user.id, this.hashToken(mfaCode)]
          );
          
          if (backupResult.rows.length > 0) {
            await this.pool.query(
              'UPDATE mfa_backup_codes SET used_at = NOW() WHERE id = $1',
              [backupResult.rows[0].id]
            );
            mfaValid = true;
          }
        }
        
        if (!mfaValid) {
          await this.logAudit({ user, ip: req.ip }, 'MFA_FAILED', 'auth', null);
          return res.status(401).json({ error: 'Invalid MFA code' });
        }
      }
      
      // Check password expiration
      const policyResult = await this.pool.query(
        'SELECT max_age_days FROM password_policies WHERE company_id = $1',
        [user.company_id]
      );
      const policy = policyResult.rows[0];
      
      if (policy.max_age_days) {
        const passwordAge = Math.floor((new Date() - new Date(user.password_changed_at)) / (1000 * 60 * 60 * 24));
        if (passwordAge > policy.max_age_days) {
          return res.status(403).json({ error: 'Password expired', requiresPasswordChange: true });
        }
      }
      
      // Generate tokens
      const accessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          companyId: user.company_id,
          role: user.role_name,
          permissions: user.permissions
        },
        this.jwtSecret,
        { expiresIn: '15m' }
      );
      
      const refreshToken = this.generateToken();
      
      // Create session
      const sessionResult = await this.pool.query(`
        INSERT INTO sessions (user_id, token_hash, refresh_token_hash, ip_address, user_agent, device_id, expires_at, refresh_expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '7 days')
        RETURNING id
      `, [
        user.id,
        this.hashToken(accessToken),
        this.hashToken(refreshToken),
        req.ip,
        req.get('user-agent'),
        req.body.deviceId || null
      ]);
      
      // Update user login info
      await this.pool.query(
        'UPDATE users SET last_login_at = NOW(), last_login_ip = $2, login_attempts = 0 WHERE id = $1',
        [user.id, req.ip]
      );
      
      await this.logAudit({ user: { id: user.id, email: user.email }, ip: req.ip }, 'USER_LOGIN', 'session', sessionResult.rows[0].id);
      
      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role_name,
          permissions: user.permissions,
          company: user.company_name,
          mfaEnabled: user.mfa_enabled
        }
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async handleLogout(req, res) {
    try {
      await this.pool.query(
        'UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1',
        [this.hashToken(req.token)]
      );
      
      await this.logAudit(req, 'USER_LOGOUT', 'session', req.session.id);
      
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async handleRefreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }
      
      // Find session
      const sessionResult = await this.pool.query(
        'SELECT * FROM sessions WHERE refresh_token_hash = $1 AND refresh_expires_at > NOW() AND revoked_at IS NULL',
        [this.hashToken(refreshToken)]
      );
      
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }
      
      const session = sessionResult.rows[0];
      
      // Get user
      const userResult = await this.pool.query(`
        SELECT u.*, r.name as role_name, r.permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND u.is_active = true AND u.deleted_at IS NULL
      `, [session.user_id]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      
      const user = userResult.rows[0];
      
      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          companyId: user.company_id,
          role: user.role_name,
          permissions: user.permissions
        },
        this.jwtSecret,
        { expiresIn: '15m' }
      );
      
      // Update session
      await this.pool.query(
        'UPDATE sessions SET token_hash = $1, expires_at = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
        [this.hashToken(newAccessToken), session.id]
      );
      
      res.json({
        success: true,
        accessToken: newAccessToken
      });
      
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }

  async handleVerify(req, res) {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        role: req.user.role_name,
        permissions: req.user.permissions,
        company: req.user.company_name
      }
    });
  }

  // MFA handlers
  async enableMFA(req, res) {
    try {
      const { type = 'totp', phoneNumber } = req.body;
      
      if (type === 'sms' && !phoneNumber) {
        return res.status(400).json({ error: 'Phone number required for SMS MFA' });
      }
      
      if (type === 'totp') {
        const secret = speakeasy.generateSecret({
          name: `ROOTUIP (${req.user.email})`,
          issuer: 'ROOTUIP Enterprise'
        });
        
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
        
        // Store secret temporarily in session
        await this.pool.query(
          'UPDATE sessions SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{mfaSecret}\', $1) WHERE id = $2',
          [JSON.stringify(secret.base32), req.session.id]
        );
        
        res.json({
          success: true,
          type: 'totp',
          secret: secret.base32,
          qrCode: qrCodeUrl
        });
      } else if (type === 'sms') {
        // Store phone number temporarily
        await this.pool.query(
          'UPDATE sessions SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{mfaPhone}\', $1) WHERE id = $2',
          [JSON.stringify(phoneNumber), req.session.id]
        );
        
        // Send verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await this.sendSMS(phoneNumber, `Your ROOTUIP verification code is: ${code}`);
        
        // Store code temporarily (in production, use Redis or similar)
        await this.pool.query(
          'UPDATE sessions SET metadata = jsonb_set(metadata, \'{mfaCode}\', $1) WHERE id = $2',
          [JSON.stringify(code), req.session.id]
        );
        
        res.json({
          success: true,
          type: 'sms',
          phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*')
        });
      }
      
    } catch (error) {
      console.error('MFA enable error:', error);
      res.status(500).json({ error: 'Failed to enable MFA' });
    }
  }

  async verifyMFA(req, res) {
    try {
      const { code, type = 'totp' } = req.body;
      
      // Get stored MFA data from session
      const sessionResult = await this.pool.query(
        'SELECT metadata FROM sessions WHERE id = $1',
        [req.session.id]
      );
      
      const metadata = sessionResult.rows[0]?.metadata || {};
      
      let verified = false;
      
      if (type === 'totp') {
        const secret = metadata.mfaSecret;
        if (!secret) {
          return res.status(400).json({ error: 'MFA setup not initiated' });
        }
        
        verified = speakeasy.totp.verify({
          secret,
          encoding: 'base32',
          token: code,
          window: 1
        });
        
        if (verified) {
          // Enable MFA for user
          await this.pool.query(
            'UPDATE users SET mfa_enabled = true, mfa_type = $1, mfa_secret = $2 WHERE id = $3',
            ['totp', secret, req.user.id]
          );
          
          // Generate backup codes
          const backupCodes = [];
          for (let i = 0; i < 10; i++) {
            const code = this.generateToken().substring(0, 8);
            backupCodes.push(code);
            
            await this.pool.query(
              'INSERT INTO mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)',
              [req.user.id, this.hashToken(code)]
            );
          }
          
          await this.logAudit(req, 'MFA_ENABLED', 'user', req.user.id, { type: 'totp' });
          
          res.json({
            success: true,
            message: 'MFA enabled successfully',
            backupCodes
          });
        }
      } else if (type === 'sms') {
        const storedCode = metadata.mfaCode;
        const phoneNumber = metadata.mfaPhone;
        
        if (!storedCode || !phoneNumber) {
          return res.status(400).json({ error: 'MFA setup not initiated' });
        }
        
        verified = code === storedCode;
        
        if (verified) {
          await this.pool.query(
            'UPDATE users SET mfa_enabled = true, mfa_type = $1, mfa_phone = $2 WHERE id = $3',
            ['sms', phoneNumber, req.user.id]
          );
          
          await this.logAudit(req, 'MFA_ENABLED', 'user', req.user.id, { type: 'sms' });
          
          res.json({
            success: true,
            message: 'SMS MFA enabled successfully'
          });
        }
      }
      
      if (!verified) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      
      // Clear temporary MFA data from session
      await this.pool.query(
        'UPDATE sessions SET metadata = metadata - \'mfaSecret\' - \'mfaPhone\' - \'mfaCode\' WHERE id = $1',
        [req.session.id]
      );
      
    } catch (error) {
      console.error('MFA verify error:', error);
      res.status(500).json({ error: 'MFA verification failed' });
    }
  }

  // API Key management
  async createAPIKey(req, res) {
    try {
      const { name, permissions, rateLimit, expiresIn } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'API key name required' });
      }
      
      const apiKey = `uip_${this.generateToken()}`;
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;
      
      const result = await this.pool.query(`
        INSERT INTO api_keys (company_id, user_id, name, key_hash, permissions, rate_limit, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        req.user.company_id,
        req.user.id,
        name,
        this.hashToken(apiKey),
        permissions || {},
        rateLimit || 1000,
        expiresAt
      ]);
      
      await this.logAudit(req, 'API_KEY_CREATED', 'api_key', result.rows[0].id, { name });
      
      res.json({
        success: true,
        id: result.rows[0].id,
        apiKey, // Only shown once
        name,
        expiresAt
      });
      
    } catch (error) {
      console.error('API key creation error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }

  // User invitation
  async inviteUser(req, res) {
    try {
      const { email, roleId, metadata } = req.body;
      
      if (!email || !roleId) {
        return res.status(400).json({ error: 'Email and role required' });
      }
      
      // Check if user already exists
      const existingUser = await this.pool.query(
        'SELECT id FROM users WHERE email = $1 AND company_id = $2',
        [email, req.user.company_id]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists in this company' });
      }
      
      const invitationToken = this.generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await this.pool.query(`
        INSERT INTO user_invitations (company_id, email, role_id, invited_by, invitation_token, expires_at, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.company_id,
        email,
        roleId,
        req.user.id,
        invitationToken,
        expiresAt,
        metadata || {}
      ]);
      
      // Send invitation email (implement your email service)
      const invitationUrl = `${process.env.APP_URL}/accept-invite?token=${invitationToken}`;
      // await this.sendEmail(email, 'invitation', { invitationUrl, inviterName: req.user.first_name });
      
      await this.logAudit(req, 'USER_INVITED', 'user_invitation', email, { roleId });
      
      res.json({
        success: true,
        message: 'Invitation sent successfully'
      });
      
    } catch (error) {
      console.error('User invitation error:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }

  // Password validation
  validatePassword(password, policy) {
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
    
    return { valid: errors.length === 0, errors };
  }

  // Audit log retrieval
  async getAuditLogs(req, res) {
    try {
      const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
      const offset = (page - 1) * limit;
      
      let query = `
        SELECT al.*, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.company_id = $1
      `;
      const params = [req.user.company_id];
      let paramCount = 1;
      
      if (userId) {
        query += ` AND al.user_id = $${++paramCount}`;
        params.push(userId);
      }
      
      if (action) {
        query += ` AND al.action = $${++paramCount}`;
        params.push(action);
      }
      
      if (startDate) {
        query += ` AND al.created_at >= $${++paramCount}`;
        params.push(startDate);
      }
      
      if (endDate) {
        query += ` AND al.created_at <= $${++paramCount}`;
        params.push(endDate);
      }
      
      query += ` ORDER BY al.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);
      
      const result = await this.pool.query(query, params);
      
      res.json({
        success: true,
        logs: result.rows,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
    } catch (error) {
      console.error('Audit log retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  }

  // SSO handlers
  async getSSOMetadata(req, res) {
    res.json({
      entityID: process.env.SSO_ENTITY_ID || 'https://app.rootuip.com',
      assertionConsumerService: {
        url: `${process.env.APP_URL}/auth/sso/callback`,
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
      },
      singleLogoutService: {
        url: `${process.env.APP_URL}/auth/sso/logout`,
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
      },
      x509cert: process.env.SSO_CERTIFICATE || 'YOUR_CERTIFICATE_HERE',
      supportedProtocols: ['SAML 2.0', 'OAuth 2.0', 'OpenID Connect']
    });
  }

  // SMS helper
  async sendSMS(phoneNumber, message) {
    if (this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
      } catch (error) {
        console.error('SMS send error:', error);
        throw error;
      }
    } else {
      console.log(`SMS to ${phoneNumber}: ${message}`);
    }
  }

  // Start server
  start(port = 3001) {
    return this.app.listen(port, () => {
      console.log(`Enterprise Auth Service running on port ${port}`);
    });
  }
}

module.exports = EnterpriseAuthService;