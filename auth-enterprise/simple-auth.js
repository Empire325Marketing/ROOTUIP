const http = require('http');
const crypto = require('crypto');
const url = require('url');
const querystring = require('querystring');

// In-memory user store (for demo purposes)
const users = {
  'demo@rootuip.com': {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'demo@rootuip.com',
    password: 'Demo123456',
    role: 'admin',
    company: 'ROOTUIP Demo',
    companyId: '987e6543-e89b-12d3-a456-426614174000'
  },
  'admin@rootuip.com': {
    id: '223e4567-e89b-12d3-a456-426614174001',
    email: 'admin@rootuip.com',
    password: 'Admin123456',
    role: 'admin',
    company: 'ROOTUIP Enterprise',
    companyId: '987e6543-e89b-12d3-a456-426614174001'
  }
};

// In-memory session store
const sessions = {};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

const server = http.createServer((req, res) => {
  setCORSHeaders(res);

  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/auth/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'enterprise-auth',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Login endpoint
  if (pathname === '/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        // Parse JSON carefully
        let data;
        try {
          data = JSON.parse(body);
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          console.error('Body received:', body);
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid JSON format' }));
          return;
        }

        const user = users[data.email];

        if (user && user.password === data.password) {
          const accessToken = generateToken();
          const refreshToken = generateToken();
          
          sessions[accessToken] = {
            userId: user.id,
            email: user.email,
            role: user.role,
            company: user.company,
            companyId: user.companyId,
            expires: new Date(Date.now() + 3600000) // 1 hour
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            accessToken,
            refreshToken,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              company: user.company
            }
          }));
        } else {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (err) {
        console.error('Login error:', err);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // Verify token endpoint
  if (pathname === '/auth/verify' && req.method === 'GET') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'No token provided' }));
      return;
    }

    const session = sessions[token];
    if (session && session.expires > new Date()) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        valid: true,
        user: {
          id: session.userId,
          email: session.email,
          role: session.role,
          company: session.company
        }
      }));
    } else {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid or expired token' }));
    }
    return;
  }

  // Security dashboard API endpoints
  if (pathname.startsWith('/auth/api/') && req.method === 'GET') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = sessions[token];

    if (!session || session.expires <= new Date()) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Mock data for security dashboard
    if (pathname === '/auth/api/users') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        users: [
          { id: '1', email: 'admin@rootuip.com', role: 'admin', status: 'active', lastLogin: new Date().toISOString() },
          { id: '2', email: 'user@rootuip.com', role: 'user', status: 'active', lastLogin: new Date().toISOString() }
        ],
        total: 2
      }));
      return;
    }

    if (pathname === '/auth/api/stats') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        totalUsers: 156,
        activeSessions: 23,
        apiKeys: 12,
        securityScore: 92
      }));
      return;
    }

    if (pathname === '/auth/api/audit-logs') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        logs: [
          { id: '1', action: 'LOGIN', user: 'admin@rootuip.com', timestamp: new Date().toISOString(), ip: '192.168.1.1' },
          { id: '2', action: 'USER_CREATED', user: 'admin@rootuip.com', timestamp: new Date().toISOString(), ip: '192.168.1.1' }
        ],
        total: 2
      }));
      return;
    }
  }

  // Default 404 response
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Not Found');
});

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Enterprise Auth Service running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /auth/health');
  console.log('  POST /auth/login');
  console.log('  GET  /auth/verify');
  console.log('  GET  /auth/api/users');
  console.log('  GET  /auth/api/stats');
  console.log('  GET  /auth/api/audit-logs');
});
