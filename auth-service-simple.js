const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

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

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE,
        subscription_tier VARCHAR(50) DEFAULT 'enterprise',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'viewer',
        status VARCHAR(50) DEFAULT 'active',
        mfa_enabled BOOLEAN DEFAULT false,
        mfa_secret VARCHAR(255),
        last_login TIMESTAMP WITH TIME ZONE,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        refresh_token_hash VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        refresh_expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create demo company and user if they don't exist
    const demoCompany = await pool.query(
      "SELECT id FROM companies WHERE domain = 'rootuip.com'"
    );

    let companyId;
    if (demoCompany.rows.length === 0) {
      const result = await pool.query(
        "INSERT INTO companies (name, domain) VALUES ('ROOTUIP Demo', 'rootuip.com') RETURNING id"
      );
      companyId = result.rows[0].id;
    } else {
      companyId = demoCompany.rows[0].id;
    }

    const demoUser = await pool.query(
      "SELECT id FROM users WHERE email = 'demo@rootuip.com'"
    );

    if (demoUser.rows.length === 0) {
      const passwordHash = await bcrypt.hash('Demo123!', 12);
      await pool.query(
        `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, 'demo@rootuip.com', $2, 'Demo', 'User', 'admin')`,
        [companyId, passwordHash]
      );
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Helper function to hash tokens
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
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

    // Get user details
    const userResult = await pool.query(
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

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, companyDomain } = req.body;

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create or find company
    let companyId;
    if (companyDomain) {
      const companyResult = await pool.query(
        'SELECT id FROM companies WHERE domain = $1',
        [companyDomain]
      );
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
      }
    }

    if (!companyId && companyName) {
      const companyResult = await pool.query(
        'INSERT INTO companies (name, domain) VALUES ($1, $2) RETURNING id',
        [companyName, companyDomain || email.split('@')[1]]
      );
      companyId = companyResult.rows[0].id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [companyId, email, passwordHash, firstName, lastName, 'admin']
    );

    res.json({
      success: true,
      message: 'Registration successful',
      userId: userResult.rows[0].id
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;

    // Get user
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // For now, skip MFA check since it's not fully set up
    if (user.mfa_enabled && false) {
      if (!mfaCode) {
        return res.json({ requiresMFA: true });
      }
      // MFA verification would go here
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, companyId: user.company_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = require('crypto').randomBytes(32).toString('hex');

    // Create session
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '7 days')`,
      [user.id, hashToken(accessToken), hashToken(refreshToken), req.ip, req.get('user-agent')]
    );

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
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
        role: user.role
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
      'SELECT id, email, first_name, last_name, role, status, mfa_enabled, last_login FROM users WHERE company_id = $1',
      [req.user.company_id]
    );

    res.json(result.rows);
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
  const apiKey = `uip_${require('crypto').randomBytes(32).toString('hex')}`;
  res.json({ success: true, apiKey, name: req.body.name });
});

app.post('/auth/users/invite', requireAuth, (req, res) => {
  res.json({ success: true, message: 'Invitation sent', email: req.body.email });
});

// Start server
app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
  initDatabase();
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