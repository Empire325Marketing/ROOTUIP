// Authentication Middleware for ROOTUIP Services
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'uip-secret-key-2024';

class AuthMiddleware {
  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Create JWT token
  static createToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  // Middleware for Express apps
  static expressAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = AuthMiddleware.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  }

  // Middleware for raw Node.js HTTP
  static async httpAuth(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No token provided' }));
      return false;
    }

    const decoded = AuthMiddleware.verifyToken(token);
    if (!decoded) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid token' }));
      return false;
    }

    req.user = decoded;
    return true;
  }

  // Verify with auth service
  static async verifyWithAuthService(token) {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/auth/verify',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(res.statusCode === 200 ? result.user : null);
          } catch (error) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.end();
    });
  }

  // Session management
  static sessions = new Map();

  static createSession(userId, userData) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      userId,
      userData,
      createdAt: new Date(),
      lastAccess: new Date()
    };
    
    AuthMiddleware.sessions.set(sessionId, session);
    
    // Clean up old sessions periodically
    setTimeout(() => {
      AuthMiddleware.sessions.delete(sessionId);
    }, 24 * 60 * 60 * 1000); // 24 hours

    return sessionId;
  }

  static getSession(sessionId) {
    const session = AuthMiddleware.sessions.get(sessionId);
    if (session) {
      session.lastAccess = new Date();
      return session;
    }
    return null;
  }

  static deleteSession(sessionId) {
    return AuthMiddleware.sessions.delete(sessionId);
  }
}

module.exports = AuthMiddleware;