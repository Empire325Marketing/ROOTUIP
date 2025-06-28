// Enterprise Authentication System for Fortune 500 Companies
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const { v4: uuidv4 } = require('uuid');

class EnterpriseAuthSystem {
  constructor(dbConfig) {
    this.app = express();
    this.pool = new Pool(dbConfig);
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeDatabase();
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
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS with credentials
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Rate limiting
    this.setupRateLimiting();

    // CSRF protection for non-API routes
    this.csrfProtection = csrf({ cookie: true });
  }

  setupRateLimiting() {
    // Different limits for different endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per window
      message: 'Too many authentication attempts, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });

    const apiLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'API rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply to specific routes
    this.authLimiter = authLimiter;
    this.apiLimiter = apiLimiter;
  }

  async initializeDatabase() {
    try {
      // Read and execute schema
      const fs = require('fs');
      const schema = fs.readFileSync(__dirname + '/enterprise-auth-schema.sql', 'utf8');
      await this.pool.query(schema);
      console.log('Enterprise authentication database initialized');
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  // Audit logging
  async logAudit(companyId, userId, action, resourceType, resourceId, details, req) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (company_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [companyId, userId, action, resourceType, resourceId, details, req.ip, req.get('user-agent')]
      );
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  // Password validation
  async validatePassword(password, companyId) {
    const policyResult = await this.pool.query(
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

    return { valid: errors.length === 0, errors };
  }

  // Generate secure tokens
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash tokens for storage
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'enterprise-auth', timestamp: new Date().toISOString() });
    });

    // Authentication routes
    this.app.post('/auth/register', this.authLimiter, this.handleRegister.bind(this));
    this.app.post('/auth/login', this.authLimiter, this.handleLogin.bind(this));
    this.app.post('/auth/logout', this.handleLogout.bind(this));
    this.app.post('/auth/refresh', this.handleRefreshToken.bind(this));
    this.app.get('/auth/verify', this.handleVerify.bind(this));

    // MFA routes
    this.app.post('/auth/mfa/enable', this.requireAuth.bind(this), this.enableMFA.bind(this));
    this.app.post('/auth/mfa/verify', this.authLimiter, this.verifyMFA.bind(this));
    this.app.post('/auth/mfa/disable', this.requireAuth.bind(this), this.disableMFA.bind(this));
    this.app.get('/auth/mfa/backup-codes', this.requireAuth.bind(this), this.getBackupCodes.bind(this));

    // User management
    this.app.get('/users', this.requireAuth.bind(this), this.requireRole(['admin']), this.getUsers.bind(this));
    this.app.post('/users/invite', this.requireAuth.bind(this), this.requireRole(['admin']), this.inviteUser.bind(this));
    this.app.post('/users/bulk-invite', this.requireAuth.bind(this), this.requireRole(['admin']), this.bulkInviteUsers.bind(this));
    this.app.put('/users/:id/role', this.requireAuth.bind(this), this.requireRole(['admin']), this.updateUserRole.bind(this));
    this.app.delete('/users/:id', this.requireAuth.bind(this), this.requireRole(['admin']), this.deleteUser.bind(this));

    // API key management
    this.app.post('/api-keys', this.requireAuth.bind(this), this.createAPIKey.bind(this));
    this.app.get('/api-keys', this.requireAuth.bind(this), this.getAPIKeys.bind(this));
    this.app.delete('/api-keys/:id', this.requireAuth.bind(this), this.revokeAPIKey.bind(this));

    // Company/tenant management
    this.app.get('/company', this.requireAuth.bind(this), this.getCompanyInfo.bind(this));
    this.app.put('/company/settings', this.requireAuth.bind(this), this.requireRole(['admin']), this.updateCompanySettings.bind(this));
    this.app.put('/company/password-policy', this.requireAuth.bind(this), this.requireRole(['admin']), this.updatePasswordPolicy.bind(this));

    // Security dashboard
    this.app.get('/security/audit-logs', this.requireAuth.bind(this), this.requireRole(['admin']), this.getAuditLogs.bind(this));
    this.app.get('/security/active-sessions', this.requireAuth.bind(this), this.getActiveSessions.bind(this));
    this.app.post('/security/revoke-session', this.requireAuth.bind(this), this.revokeSession.bind(this));

    // SSO preparation endpoints
    this.app.get('/sso/metadata', this.getSSOMetadata.bind(this));
    this.app.post('/sso/configure', this.requireAuth.bind(this), this.requireRole(['admin']), this.configureSSOSettings.bind(this));
  }

  // Middleware to require authentication
  async requireAuth(req, res, next) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'enterprise-secret-key');
      
      // Check if session is still valid
      const sessionResult = await this.pool.query(
        'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
        [this.hashToken(token)]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ error: 'Session expired or invalid' });
      }

      // Get user details
      const userResult = await this.pool.query(
        'SELECT u.*, c.name as company_name FROM users u JOIN companies c ON u.company_id = c.id WHERE u.id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = userResult.rows[0];
      req.token = token;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Middleware to require specific roles
  requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        this.logAudit(
          req.user.company_id,
          req.user.id,
          'ACCESS_DENIED',
          'endpoint',
          req.path,
          { required_role: allowedRoles, user_role: req.user.role },
          req
        );
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  // User registration
  async handleRegister(req, res) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { email, password, firstName, lastName, companyName, companyDomain } = req.body;

      // Validate password
      let companyId;
      if (companyDomain) {
        const companyResult = await client.query(
          'SELECT id FROM companies WHERE domain = $1',
          [companyDomain]
        );
        companyId = companyResult.rows[0]?.id;
      }

      const passwordValidation = await this.validatePassword(password, companyId);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: 'Password validation failed', details: passwordValidation.errors });
      }

      // Create company if new
      if (!companyId && companyName) {
        const companyResult = await client.query(
          'INSERT INTO companies (name, domain) VALUES ($1, $2) RETURNING id',
          [companyName, companyDomain || email.split('@')[1]]
        );
        companyId = companyResult.rows[0].id;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [companyId, email, passwordHash, firstName, lastName, 'admin'] // First user is admin
      );

      const userId = userResult.rows[0].id;

      // Store password in history
      await client.query(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash]
      );

      await client.query('COMMIT');

      await this.logAudit(companyId, userId, 'USER_REGISTERED', 'user', userId, { email }, req);

      res.json({
        success: true,
        message: 'Registration successful',
        userId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    } finally {
      client.release();
    }
  }

  // User login
  async handleLogin(req, res) {
    try {
      const { email, password, mfaCode } = req.body;

      // Get user
      const userResult = await this.pool.query(
        'SELECT * FROM users WHERE email = $1 AND status = $2',
        [email, 'active']
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = userResult.rows[0];

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(401).json({ error: 'Account locked. Please try again later.' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        // Increment failed attempts
        await this.pool.query(
          'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = $1',
          [user.id]
        );

        // Lock account after 5 failed attempts
        if (user.failed_attempts >= 4) {
          await this.pool.query(
            'UPDATE users SET locked_until = NOW() + INTERVAL \'30 minutes\' WHERE id = $1',
            [user.id]
          );
        }

        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check MFA
      if (user.mfa_enabled) {
        if (!mfaCode) {
          return res.json({ requiresMFA: true });
        }

        const verified = speakeasy.totp.verify({
          secret: user.mfa_secret,
          encoding: 'base32',
          token: mfaCode,
          window: 1
        });

        if (!verified) {
          // Check backup codes
          const backupResult = await this.pool.query(
            'SELECT * FROM mfa_backup_codes WHERE user_id = $1 AND code_hash = $2 AND used = false',
            [user.id, this.hashToken(mfaCode)]
          );

          if (backupResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid MFA code' });
          }

          // Mark backup code as used
          await this.pool.query(
            'UPDATE mfa_backup_codes SET used = true WHERE id = $1',
            [backupResult.rows[0].id]
          );
        }
      }

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, companyId: user.company_id, role: user.role },
        process.env.JWT_SECRET || 'enterprise-secret-key',
        { expiresIn: '15m' }
      );

      const refreshToken = this.generateSecureToken();

      // Create session
      await this.pool.query(
        `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at, refresh_expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '7 days')`,
        [user.id, this.hashToken(accessToken), this.hashToken(refreshToken), req.ip, req.get('user-agent')]
      );

      // Update user last login and reset failed attempts
      await this.pool.query(
        'UPDATE users SET last_login = NOW(), failed_attempts = 0 WHERE id = $1',
        [user.id]
      );

      await this.logAudit(user.company_id, user.id, 'USER_LOGIN', 'session', null, { ip: req.ip }, req);

      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  // Refresh token
  async handleRefreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' });
      }

      // Find session
      const sessionResult = await this.pool.query(
        'SELECT * FROM sessions WHERE refresh_token_hash = $1 AND refresh_expires_at > NOW()',
        [this.hashToken(refreshToken)]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const session = sessionResult.rows[0];

      // Get user
      const userResult = await this.pool.query(
        'SELECT * FROM users WHERE id = $1 AND status = $2',
        [session.user_id, 'active']
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Generate new access token
      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email, companyId: user.company_id, role: user.role },
        process.env.JWT_SECRET || 'enterprise-secret-key',
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

  // Enable MFA
  async enableMFA(req, res) {
    try {
      const secret = speakeasy.generateSecret({
        name: `ROOTUIP (${req.user.email})`
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Store secret temporarily (user must verify before it's permanently enabled)
      req.session = req.session || {};
      req.session.mfaSecret = secret.base32;

      res.json({
        success: true,
        secret: secret.base32,
        qrCode: qrCodeUrl
      });

    } catch (error) {
      console.error('MFA setup error:', error);
      res.status(500).json({ error: 'MFA setup failed' });
    }
  }

  // Verify MFA
  async verifyMFA(req, res) {
    try {
      const { token } = req.body;
      const secret = req.session?.mfaSecret || req.user.mfa_secret;

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1
      });

      if (!verified) {
        return res.status(400).json({ error: 'Invalid MFA code' });
      }

      // If this is setup verification, enable MFA
      if (req.session?.mfaSecret) {
        await this.pool.query(
          'UPDATE users SET mfa_secret = $1, mfa_enabled = true WHERE id = $2',
          [secret, req.user.id]
        );

        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
          const code = crypto.randomBytes(4).toString('hex');
          backupCodes.push(code);
          
          await this.pool.query(
            'INSERT INTO mfa_backup_codes (user_id, code_hash) VALUES ($1, $2)',
            [req.user.id, this.hashToken(code)]
          );
        }

        await this.logAudit(req.user.company_id, req.user.id, 'MFA_ENABLED', 'user', req.user.id, {}, req);

        return res.json({
          success: true,
          message: 'MFA enabled successfully',
          backupCodes
        });
      }

      res.json({ success: true, message: 'MFA verified' });

    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({ error: 'MFA verification failed' });
    }
  }

  // Create API key
  async createAPIKey(req, res) {
    try {
      const { name, permissions, expiresIn } = req.body;

      const apiKey = `uip_${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

      await this.pool.query(
        `INSERT INTO api_keys (company_id, user_id, name, key_hash, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.company_id, req.user.id, name, this.hashToken(apiKey), permissions || {}, expiresAt]
      );

      await this.logAudit(req.user.company_id, req.user.id, 'API_KEY_CREATED', 'api_key', name, {}, req);

      res.json({
        success: true,
        apiKey, // Only shown once
        name,
        expiresAt
      });

    } catch (error) {
      console.error('API key creation error:', error);
      res.status(500).json({ error: 'API key creation failed' });
    }
  }

  // Get audit logs
  async getAuditLogs(req, res) {
    try {
      const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;
      
      let query = 'SELECT al.*, u.email as user_email FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.company_id = $1';
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

      query += ' ORDER BY al.created_at DESC LIMIT $' + (++paramCount) + ' OFFSET $' + (++paramCount);
      params.push(limit, (page - 1) * limit);

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

  // SSO metadata (SAML preparation)
  getSSOMetadata(req, res) {
    const metadata = {
      entityID: 'https://app.rootuip.com',
      assertionConsumerService: {
        url: 'https://app.rootuip.com/sso/callback',
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
      },
      singleLogoutService: {
        url: 'https://app.rootuip.com/sso/logout',
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
      },
      x509cert: 'MIICert...', // Would be actual certificate in production
      supportedProtocols: ['SAML 2.0', 'OAuth 2.0', 'OpenID Connect']
    };

    res.json(metadata);
  }

  // Logout
  async handleLogout(req, res) {
    try {
      if (req.token) {
        await this.pool.query(
          'DELETE FROM sessions WHERE token_hash = $1',
          [this.hashToken(req.token)]
        );

        await this.logAudit(req.user.company_id, req.user.id, 'USER_LOGOUT', 'session', null, {}, req);
      }

      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  // Verify token
  async handleVerify(req, res) {
    // This will only be called if requireAuth middleware passes
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        role: req.user.role,
        company: req.user.company_name
      }
    });
  }

  // Start server
  start(port = 3001) {
    this.app.listen(port, () => {
      console.log(`Enterprise Auth System running on port ${port}`);
    });
  }
}

module.exports = EnterpriseAuthSystem;