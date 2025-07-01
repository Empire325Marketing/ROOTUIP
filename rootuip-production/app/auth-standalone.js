const http = require('http');
const crypto = require('crypto');
const url = require('url');

// Simple JSON parser that doesn't break on special characters
function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    return null;
  }
}

// Database - using simple in-memory for now
const users = {
  'demo@rootuip.com': {
    id: '86d649c4-d9ad-4b2d-b554-01e03f9d76ea',
    password: '$2b$12$V3tF7Cmadb6z0MWmxIs6Cuiwpyj4RmW9tMoLTWj0rkcneFXBh06tu',
    firstName: 'Demo',
    lastName: 'User',
    companyId: '2ace5a60-1818-4b87-959e-aea1eb93a3d0'
  }
};

// Simple bcrypt compare (for demo password)
async function comparePassword(password, hash) {
  // For demo purposes, just check if it's the demo password
  return password === 'Demo123!' && hash === users['demo@rootuip.com'].password;
}

// Generate JWT token
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', 'enterprise-secret-key')
    .update(header + '.' + data)
    .digest('base64url');
  
  return header + '.' + data + '.' + signature;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  'Content-Type': 'application/json'
};

// Create server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  
  console.log(`${method} ${path}`);
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // Routes
  if (path === '/health' || path === '/auth/health') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'auth-service-standalone', 
      timestamp: new Date().toISOString() 
    }));
    return;
  }
  
  if (path === '/auth/login' && method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      console.log('Login request body:', body);
      
      const data = parseJSON(body);
      if (!data) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      
      const { email, password } = data;
      console.log('Login attempt for:', email);
      
      const user = users[email];
      if (!user) {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
      }
      
      const validPassword = await comparePassword(password, user.password);
      console.log('Password valid:', validPassword);
      
      if (!validPassword) {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
      }
      
      const token = generateToken({
        userId: user.id,
        email: email,
        companyId: user.companyId
      });
      
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({
        success: true,
        accessToken: token,
        user: {
          id: user.id,
          email: email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: 'admin'
        }
      }));
    });
    return;
  }
  
  if (path === '/auth/login' && method === 'GET') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({ message: 'POST to this endpoint with {email, password}' }));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
const PORT = 3001; // Use standard auth port
server.listen(PORT, () => {
  console.log(`Standalone auth service running on port ${PORT}`);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});