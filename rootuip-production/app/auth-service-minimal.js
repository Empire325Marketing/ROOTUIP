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
  password: 'uip_secure_2024'
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

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'enterprise-secret-key';

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
});

app.get('/auth/health', (req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
});

// GET endpoints for testing
app.get('/auth/login', (req, res) => {
  res.json({ message: 'POST to this endpoint with {email, password}' });
});

app.get('/auth/register', (req, res) => {
  res.json({ message: 'POST to this endpoint with {email, password, firstName, lastName}' });
});

// Simple login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    // Get user - simplified query
    const userResult = await pool.query(
      'SELECT id, company_id, email, first_name, last_name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log('User found:', user.email);

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', validPassword);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, companyId: user.company_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Register endpoint
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Get company - use ROOTUIP Demo or create one
    let companyId;
    const companyResult = await pool.query("SELECT id FROM companies WHERE domain = 'rootuip.com'");
    if (companyResult.rows.length > 0) {
      companyId = companyResult.rows[0].id;
    } else {
      // Create default company
      const newCompany = await pool.query(
        "INSERT INTO companies (name, domain) VALUES ('ROOTUIP Demo', 'rootuip.com') RETURNING id"
      );
      companyId = newCompany.rows[0].id;
    }

    // Get or create admin role
    let roleId;
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE company_id = $1 AND name = 'admin' LIMIT 1",
      [companyId]
    );
    if (roleResult.rows.length > 0) {
      roleId = roleResult.rows[0].id;
    } else {
      // Create admin role
      const newRole = await pool.query(
        "INSERT INTO roles (company_id, name, description, permissions) VALUES ($1, 'admin', 'Administrator', '{}') RETURNING id"
      , [companyId]);
      roleId = newRole.rows[0].id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    await pool.query(
      `INSERT INTO users (company_id, role_id, email, first_name, last_name, password_hash, password_salt, email_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, '', true, true)`,
      [companyId, roleId, email, firstName, lastName, passwordHash]
    );

    res.json({ success: true, message: 'Registration successful' });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Verify token
app.get('/auth/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, userId: decoded.userId, email: decoded.email });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Placeholder endpoints
app.get('/auth/users', (req, res) => {
  res.json([]);
});

app.get('/auth/security/audit-logs', (req, res) => {
  res.json({ success: true, logs: [] });
});

app.get('/auth/security/active-sessions', (req, res) => {
  res.json([]);
});

app.get('/auth/sso/metadata', (req, res) => {
  res.json({
    entityID: 'https://app.rootuip.com',
    supportedProtocols: ['SAML 2.0', 'OAuth 2.0', 'OpenID Connect']
  });
});

app.post('/auth/mfa/enable', (req, res) => {
  res.json({ 
    success: true,
    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    secret: 'DEMO-SECRET'
  });
});

app.post('/auth/mfa/verify', (req, res) => {
  res.json({ success: true });
});

app.post('/auth/api-keys', (req, res) => {
  res.json({ success: true, apiKey: 'uip_demo_key_' + Date.now() });
});

app.post('/auth/users/invite', (req, res) => {
  res.json({ success: true, message: 'Invitation sent' });
});

// Start server
app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0].now);
  }
});