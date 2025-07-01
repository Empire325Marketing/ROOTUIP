#!/bin/bash

# ROOTUIP Microservices Fix Script
# Resolves auth-service and api-gateway issues

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log "Starting ROOTUIP Microservices Fix..."

# Step 1: Fix path-to-regexp issue in api-gateway
log "Step 1: Fixing api-gateway path-to-regexp issue..."

# Update api-gateway dependencies
cd /home/rootuip/api-gateway || cd api-gateway || { error "api-gateway directory not found"; exit 1; }

# Create updated package.json with correct dependencies
cat > package.json <<'EOF'
{
  "name": "rootuip-api-gateway",
  "version": "1.0.0",
  "description": "ROOTUIP API Gateway Service",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-rate-limit": "^6.7.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.3",
    "axios": "^1.4.0",
    "winston": "^3.8.2",
    "jsonwebtoken": "^9.0.0",
    "http-proxy-middleware": "^2.0.6"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOF

# Install dependencies
npm install

# Fix api-gateway index.js
cat > index.js <<'EOF'
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'api-gateway',
        timestamp: new Date().toISOString() 
    });
});

// JWT verification middleware
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token && req.path !== '/api/auth/login' && req.path !== '/api/auth/register') {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            req.user = decoded;
        } catch (error) {
            return res.status(403).json({ error: 'Invalid token' });
        }
    }
    
    next();
};

// Service routes configuration
const services = {
    '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true
    },
    '/api/containers': {
        target: 'http://localhost:3002',
        changeOrigin: true
    },
    '/api/tracking': {
        target: 'http://localhost:3003',
        changeOrigin: true
    },
    '/api/alerts': {
        target: 'http://localhost:3004',
        changeOrigin: true
    },
    '/api/reports': {
        target: 'http://localhost:3005',
        changeOrigin: true
    },
    '/api/integration': {
        target: 'http://localhost:3006',
        changeOrigin: true
    },
    '/api/analytics': {
        target: 'http://localhost:3007',
        changeOrigin: true
    }
};

// Setup proxy routes
Object.keys(services).forEach(path => {
    app.use(path, verifyToken, createProxyMiddleware({
        target: services[path].target,
        changeOrigin: services[path].changeOrigin,
        pathRewrite: { [`^${path}`]: '' },
        onError: (err, req, res) => {
            console.error(`Proxy error for ${path}:`, err.message);
            res.status(503).json({ 
                error: 'Service temporarily unavailable',
                service: path 
            });
        }
    }));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('API Gateway Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log('Proxying to services:', Object.keys(services));
});
EOF

# Step 2: Fix auth-service database connection
log "Step 2: Fixing auth-service database connection..."

cd ../auth-service || cd /home/rootuip/auth-service || { error "auth-service directory not found"; exit 1; }

# Create updated auth-service with proper database connection
cat > index.js <<'EOF'
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// Middleware
app.use(helmet());
app.use(express.json());

// Database connection with retry logic
let pool;
const maxRetries = 5;
let retryCount = 0;

const connectDatabase = async () => {
    try {
        pool = new Pool({
            connectionString: process.env.AUTH_DATABASE_URL || 
                'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_auth',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        // Test connection
        await pool.query('SELECT 1');
        console.log('Connected to auth database');
        retryCount = 0;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        retryCount++;
        
        if (retryCount < maxRetries) {
            console.log(`Retrying database connection (${retryCount}/${maxRetries})...`);
            setTimeout(connectDatabase, 5000);
        } else {
            console.error('Max retries reached. Exiting...');
            process.exit(1);
        }
    }
};

// Initialize database connection
connectDatabase();

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.'
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            service: 'auth-service',
            database: 'connected',
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy', 
            service: 'auth-service',
            database: 'disconnected',
            error: error.message 
        });
    }
});

// Register endpoint
app.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, firstName, lastName, companyId } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Check if user exists
        const userExists = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (userExists.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, company_id) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, email, first_name, last_name, role`,
            [email, passwordHash, firstName, lastName, companyId]
        );
        
        const user = result.rows[0];
        
        // Generate JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint
app.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Get user
        const result = await pool.query(
            `SELECT id, email, password_hash, first_name, last_name, role, is_active, 
                    login_attempts, locked_until
             FROM users WHERE email = $1`,
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(423).json({ 
                error: 'Account is locked. Please try again later.' 
            });
        }
        
        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            // Increment login attempts
            const attempts = user.login_attempts + 1;
            let lockedUntil = null;
            
            if (attempts >= 5) {
                // Lock account for 30 minutes
                lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            }
            
            await pool.query(
                'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
                [attempts, lockedUntil, user.id]
            );
            
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Reset login attempts and update last login
        await pool.query(
            'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
            [user.id]
        );
        
        // Generate JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // Create session
        await pool.query(
            'INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [
                user.id, 
                bcrypt.hashSync(token, 10),
                req.ip,
                req.get('user-agent'),
                new Date(Date.now() + 24 * 60 * 60 * 1000)
            ]
        );
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            },
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify token endpoint
app.post('/verify', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Check if user still exists and is active
        const result = await pool.query(
            'SELECT id, email, role, is_active FROM users WHERE id = $1',
            [decoded.id]
        );
        
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        res.json({ 
            valid: true, 
            user: decoded 
        });
        
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Logout endpoint
app.post('/logout', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            
            // Invalidate all sessions for the user
            await pool.query(
                'DELETE FROM sessions WHERE user_id = $1',
                [decoded.id]
            );
        }
        
        res.json({ message: 'Logout successful' });
        
    } catch (error) {
        res.json({ message: 'Logout successful' });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Auth Service Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
EOF

# Update auth-service package.json
cat > package.json <<'EOF'
{
  "name": "rootuip-auth-service",
  "version": "1.0.0",
  "description": "ROOTUIP Authentication Service",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.11.0",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.7.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOF

npm install

# Step 3: Create service health check script
log "Step 3: Creating service health check script..."

cd ..
cat > check-services.sh <<'EOF'
#!/bin/bash

# Service health check script
services=(
    "api-gateway:3000"
    "auth-service:3001"
    "container-service:3002"
    "tracking-service:3003"
    "alerts-service:3004"
    "reports-service:3005"
    "integration-service:3006"
    "analytics-service:3007"
)

echo "Checking ROOTUIP services..."
echo "=========================="

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    
    if curl -s -f "http://localhost:$port/health" > /dev/null; then
        echo "✓ $name (port $port): OK"
    else
        echo "✗ $name (port $port): FAILED"
    fi
done

echo ""
echo "Database connections:"
/usr/local/bin/rootuip-db-health.sh
EOF

chmod +x check-services.sh

# Step 4: Create PM2 ecosystem file
log "Step 4: Creating PM2 ecosystem configuration..."

cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: './api-gateway/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        API_GATEWAY_PORT: 3000
      }
    },
    {
      name: 'auth-service',
      script: './auth-service/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        AUTH_SERVICE_PORT: 3001,
        AUTH_DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_auth'
      }
    },
    {
      name: 'container-service',
      script: './container-service/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        CONTAINER_SERVICE_PORT: 3002,
        DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform'
      }
    },
    {
      name: 'tracking-service',
      script: './tracking-service/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        TRACKING_SERVICE_PORT: 3003,
        DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform'
      }
    },
    {
      name: 'alerts-service',
      script: './alerts-service/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        ALERTS_SERVICE_PORT: 3004,
        DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform'
      }
    },
    {
      name: 'reports-service',
      script: './reports-service/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        REPORTS_SERVICE_PORT: 3005,
        DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform'
      }
    },
    {
      name: 'integration-service',
      script: './integration-service/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        INTEGRATION_SERVICE_PORT: 3006,
        INTEGRATION_DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_integration'
      }
    },
    {
      name: 'analytics-service',
      script: './analytics-service/index.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        ANALYTICS_SERVICE_PORT: 3007,
        DATABASE_URL: 'postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform'
      }
    }
  ]
};
EOF

# Step 5: Create .env.production file
log "Step 5: Creating production environment file..."

cat > .env.production <<'EOF'
# Database Configuration
DATABASE_URL=postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform
AUTH_DATABASE_URL=postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_auth
INTEGRATION_DATABASE_URL=postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_integration

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
JWT_EXPIRY=24h

# Service Ports
API_GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
CONTAINER_SERVICE_PORT=3002
TRACKING_SERVICE_PORT=3003
ALERTS_SERVICE_PORT=3004
REPORTS_SERVICE_PORT=3005
INTEGRATION_SERVICE_PORT=3006
ANALYTICS_SERVICE_PORT=3007

# CORS Configuration
CORS_ORIGIN=https://rootuip.com

# Node Environment
NODE_ENV=production

# Logging
LOG_LEVEL=info

# API Keys (to be filled)
MAERSK_CLIENT_ID=
MAERSK_CLIENT_SECRET=
SENDGRID_API_KEY=
HUBSPOT_ACCESS_TOKEN=
STRIPE_SECRET_KEY=
EOF

log "Microservices fixes completed!"
echo ""
echo "=== Next Steps ==="
echo "1. Run the database setup script: sudo ./database-infrastructure-setup.sh"
echo "2. Start services with PM2: pm2 start ecosystem.config.js"
echo "3. Check service health: ./check-services.sh"
echo "4. Configure Nginx to proxy to API Gateway on port 3000"
echo ""
echo "=== Service Architecture ==="
echo "API Gateway (3000) → Auth Service (3001)"
echo "                   → Container Service (3002)"
echo "                   → Tracking Service (3003)"
echo "                   → Alerts Service (3004)"
echo "                   → Reports Service (3005)"
echo "                   → Integration Service (3006)"
echo "                   → Analytics Service (3007)"