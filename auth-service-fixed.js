const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const port = 3001;

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'uip_auth',
  user: 'uip_user',
  password: 'uip_secure_2024',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Trust proxy for proper IP handling
app.set('trust proxy', true);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'enterprise-secret-key';

// Helper function to hash tokens
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Helper function to generate salt
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// Initialize demo user
async function initDemoUser() {
  try {
    // Check if demo company exists
    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE domain = 'rootuip.com'"
    );

    let companyId;
    if (companyResult.rows.length === 0) {
      // Create demo company
      const newCompany = await pool.query(
        "INSERT INTO companies (name, domain, settings) VALUES ($1, $2, $3) RETURNING id",
        ['ROOTUIP Demo', 'rootuip.com', {}]
      );
      companyId = newCompany.rows[0].id;
      console.log('Created demo company:', companyId);
    } else {
      companyId = companyResult.rows[0].id;
    }

    // Check if admin role exists
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = 'admin' AND company_id = $1",
      [companyId]
    );

    let roleId;
    if (roleResult.rows.length === 0) {
      // Create admin role
      const newRole = await pool.query(
        "INSERT INTO roles (company_id, name, description, permissions) VALUES ($1, $2, $3, $4) RETURNING id",
        [companyId, 'admin', 'Administrator', {}]
      );
      roleId = newRole.rows[0].id;
      console.log('Created admin role:', roleId);
    } else {
      roleId = roleResult.rows[0].id;
    }

    // Check if demo user exists
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'demo@rootuip.com'"
    );

    if (userResult.rows.length === 0) {
      // Create demo user
      const salt = generateSalt();
      const passwordHash = await bcrypt.hash('Demo123!' + salt, 12);
      
      await pool.query(
        `INSERT INTO users (company_id, role_id, email, first_name, last_name, password_hash, password_salt, email_verified, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [companyId, roleId, 'demo@rootuip.com', 'Demo', 'User', passwordHash, salt, true, true]
      );
      console.log('Created demo user: demo@rootuip.com');
    }

    console.log('Demo data initialization complete');
  } catch (error) {
    console.error('Demo data initialization error:', error);
  }
}

// Authentication middleware
async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session is still valid
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
      [hashToken(token)]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // Get user details with role
    const userResult = await pool.query(
      `SELECT u.*, c.name as company_name, r.name as role_name 
       FROM users u 
       JOIN companies c ON u.company_id = c.id 
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = userResult.rows[0];
    req.user.role = req.user.role_name; // For compatibility
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
});

// Register
app.post('/auth/register', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { email, password, firstName, lastName, companyName, companyDomain } = req.body;

    // Check if user exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create or find company
    let companyId;
    let roleId;
    
    if (companyDomain) {
      const companyResult = await client.query(
        'SELECT id FROM companies WHERE domain = $1',
        [companyDomain]
      );
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
        // Get admin role for existing company
        const roleResult = await client.query(
          "SELECT id FROM roles WHERE company_id = $1 AND name = 'admin'",
          [companyId]
        );
        roleId = roleResult.rows[0]?.id;
      }
    }

    if (!companyId && companyName) {
      // Create new company
      const companyResult = await client.query(
        'INSERT INTO companies (name, domain, settings) VALUES ($1, $2, $3) RETURNING id',
        [companyName, companyDomain || email.split('@')[1], {}]
      );
      companyId = companyResult.rows[0].id;
      
      // Create admin role for new company
      const roleResult = await client.query(
        "INSERT INTO roles (company_id, name, description, permissions) VALUES ($1, $2, $3, $4) RETURNING id",
        [companyId, 'admin', 'Administrator', {}]
      );
      roleId = roleResult.rows[0].id;
    }

    // Hash password without salt for simplicity
    const salt = '';
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (company_id, role_id, email, first_name, last_name, password_hash, password_salt, email_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [companyId, roleId, email, firstName, lastName, passwordHash, salt, true, true]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Registration successful',
      userId: userResult.rows[0].id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;

    // Get user with role
    const userResult = await pool.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(401).json({ error: 'Account locked. Please try again later.' });
    }

    // Verify password with salt
    const passwordToCheck = user.password_salt ? password + user.password_salt : password;
    const validPassword = await bcrypt.compare(passwordToCheck, user.password_hash);
    if (!validPassword) {
      // Increment failed attempts
      await pool.query(
        'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = $1',
        [user.id]
      );

      // Lock account after 5 failed attempts
      if (user.login_attempts >= 4) {
        await pool.query(
          "UPDATE users SET locked_until = NOW() + INTERVAL '30 minutes' WHERE id = $1",
          [user.id]
        );
      }

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check MFA if enabled
    if (user.mfa_enabled && mfaCode) {
      // For demo, accept any 6-digit code
      if (!/^\d{6}$/.test(mfaCode)) {
        return res.status(401).json({ error: 'Invalid MFA code' });
      }
    } else if (user.mfa_enabled) {
      return res.json({ requiresMFA: true });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, companyId: user.company_id, role: user.role_name },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');

    // Create session
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(accessToken), hashToken(refreshToken), req.ip, req.get('user-agent')]
    );

    // Update last login and reset attempts
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $2, login_attempts = 0 WHERE id = $1',
      [user.id, req.ip]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (company_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user.company_id, user.id, 'USER_LOGIN', 'session', null, {}, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
app.get('/auth/verify', requireAuth, (req, res) => {
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
});

// Get users (admin only)
app.get('/auth/users', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, r.name as role, 
              u.is_active as status, u.mfa_enabled, u.last_login_at as last_login
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.company_id = $1`,
      [req.user.company_id]
    );

    // Transform is_active to status for compatibility
    const users = result.rows.map(user => ({
      ...user,
      status: user.status ? 'active' : 'inactive'
    }));

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// Get audit logs
app.get('/auth/security/audit-logs', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { limit = 50 } = req.query;
    
    const result = await pool.query(
      `SELECT al.*, u.email as user_email 
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       WHERE al.company_id = $1 
       ORDER BY al.created_at DESC 
       LIMIT $2`,
      [req.user.company_id, limit]
    );

    res.json({
      success: true,
      logs: result.rows
    });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// Get active sessions
app.get('/auth/security/active-sessions', requireAuth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
      ? `SELECT s.*, u.email as user_email 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE u.company_id = $1 AND s.expires_at > NOW()`
      : `SELECT * FROM sessions WHERE user_id = $1 AND expires_at > NOW()`;
    
    const params = req.user.role === 'admin' ? [req.user.company_id] : [req.user.id];
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Active sessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

// SSO metadata
app.get('/auth/sso/metadata', (req, res) => {
  res.json({
    entityID: 'https://app.rootuip.com',
    assertionConsumerService: {
      url: 'https://app.rootuip.com/sso/callback',
      binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
    },
    singleLogoutService: {
      url: 'https://app.rootuip.com/sso/logout',
      binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
    },
    x509cert: 'MIICert...',
    supportedProtocols: ['SAML 2.0', 'OAuth 2.0', 'OpenID Connect']
  });
});

// Placeholder routes for enterprise features
app.post('/auth/mfa/enable', requireAuth, (req, res) => {
  res.json({ 
    success: true, 
    message: 'MFA setup initiated',
    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    secret: 'DEMO-SECRET-KEY'
  });
});

app.post('/auth/mfa/verify', requireAuth, (req, res) => {
  res.json({ success: true, message: 'MFA verified' });
});

app.post('/auth/api-keys', requireAuth, (req, res) => {
  const apiKey = `uip_${crypto.randomBytes(32).toString('hex')}`;
  res.json({ success: true, apiKey, name: req.body.name });
});

app.post('/auth/users/invite', requireAuth, (req, res) => {
  res.json({ success: true, message: 'Invitation sent', email: req.body.email });
});

// Start server
app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
  initDemoUser();
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to the database');
    console.log('Database connected successfully:', res.rows[0]);
  }
});

process.on('SIGINT', () => {
  console.log('Shutting down auth service...');
  pool.end();
  process.exit(0);
});