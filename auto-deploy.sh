#!/bin/bash

# ROOTUIP Automated Deployment Script
# This script prepares and deploys the platform to VPS

echo "🚀 ROOTUIP Automated Deployment"
echo "================================"

# Configuration
VPS_IP="167.71.93.182"
LOCAL_DIR="/home/iii/ROOTUIP"
REMOTE_DIR="/var/www/rootuip"

# Step 1: Prepare deployment package
echo "📦 Step 1: Preparing deployment package..."

# Create public assets directory structure
mkdir -p "$LOCAL_DIR/public/assets/css"
mkdir -p "$LOCAL_DIR/public/assets/js"
mkdir -p "$LOCAL_DIR/public/assets/images"

# Copy HTML files to public directory
echo "📄 Copying HTML files to public directory..."
cp "$LOCAL_DIR"/*.html "$LOCAL_DIR/public/" 2>/dev/null || true

# Create main CSS file
cat > "$LOCAL_DIR/public/assets/css/main.css" << 'EOF'
/* ROOTUIP Main Styles */
:root {
    --primary: #00ff88;
    --secondary: #00d4aa;
    --dark: #0f0f23;
    --light: #ffffff;
    --gray: #a0a0a0;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: var(--dark);
    color: var(--light);
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
}
EOF

# Create main JS file
cat > "$LOCAL_DIR/public/assets/js/app.js" << 'EOF'
// ROOTUIP Main Application
console.log('ROOTUIP Platform Loaded');

// API Configuration
const API_BASE = window.location.origin + '/api';
const WS_URL = window.location.origin.replace('http', 'ws');

// Initialize WebSocket connection
function initWebSocket() {
    const socket = io(WS_URL, {
        path: '/socket.io/',
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('WebSocket connected');
    });
    
    return socket;
}

// API Helper
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Call Failed:', error);
        throw error;
    }
}

// Export for use in other scripts
window.ROOTUIP = {
    API_BASE,
    WS_URL,
    apiCall,
    initWebSocket
};
EOF

# Create comprehensive package.json
echo "📝 Creating package.json..."
cat > "$LOCAL_DIR/package.json" << 'EOF'
{
  "name": "rootuip-platform",
  "version": "1.0.0",
  "description": "Enterprise Container Intelligence Platform",
  "main": "integration-gateway.js",
  "scripts": {
    "start": "pm2 start ecosystem.config.js",
    "stop": "pm2 stop all",
    "restart": "pm2 restart all",
    "logs": "pm2 logs",
    "setup": "node scripts/setup-db.js",
    "test": "echo \"No tests configured\" && exit 0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "redis": "^4.6.5",
    "ioredis": "^5.3.2",
    "pg": "^8.11.0",
    "axios": "^1.4.0",
    "passport": "^0.6.0",
    "passport-saml": "^3.2.4",
    "express-session": "^1.17.3",
    "connect-redis": "^7.1.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "@sendgrid/mail": "^7.7.0",
    "node-cron": "^3.0.2",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0",
    "winston": "^3.8.2",
    "uuid": "^9.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF

# Create ecosystem configuration for PM2
echo "🔧 Creating PM2 ecosystem configuration..."
cat > "$LOCAL_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: './integration-gateway.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        PORT: 3007,
        NODE_ENV: 'production'
      },
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log'
    },
    {
      name: 'enterprise-demo',
      script: './enterprise-demo-platform.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ai-ml-engine',
      script: './ai-ml-simulation-engine.js',
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'saml-auth',
      script: './microsoft-saml-auth.js',
      env: {
        PORT: 3003,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'websocket-server',
      script: './real-time-websocket-server.js',
      env: {
        PORT: 3004,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'maersk-integration',
      script: './maersk-oauth-integration.js',
      env: {
        PORT: 3005,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'customer-success',
      script: './customer-success-platform.js',
      env: {
        PORT: 3006,
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Create .env file
echo "🔐 Creating environment configuration..."
cat > "$LOCAL_DIR/.env" << 'EOF'
# Production Environment Variables
NODE_ENV=production
DOMAIN=https://rootuip.com

# Database
DATABASE_URL=postgresql://rootuip:SecurePass123!@localhost:5432/rootuip_production

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
MAERSK_CLIENT_ID=your-maersk-client-id
MAERSK_CLIENT_SECRET=your-maersk-client-secret
HUBSPOT_TOKEN=your-hubspot-access-token
HUBSPOT_PORTAL_ID=8751929
SENDGRID_API_KEY=your-sendgrid-api-key

# Session Secret
SESSION_SECRET=rootuip-enterprise-secret-key-2024-production

# SAML Configuration
SAML_CALLBACK_URL=https://rootuip.com/auth/callback
SAML_ISSUER=https://rootuip.com
SAML_ENTRY_POINT=https://login.microsoftonline.com/common/saml2
EOF

# Create VPS installation script
echo "🖥️ Creating VPS installation script..."
cat > "$LOCAL_DIR/install-on-vps.sh" << 'VPSINSTALL'
#!/bin/bash

echo "🚀 Installing ROOTUIP on VPS..."

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install system dependencies
apt install -y nginx postgresql postgresql-contrib redis-server certbot python3-certbot-nginx git build-essential

# Install PM2 globally
npm install -g pm2

# Setup PostgreSQL
sudo -u postgres psql << EOF
CREATE USER rootuip WITH PASSWORD 'SecurePass123!';
CREATE DATABASE rootuip_production OWNER rootuip;
GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip;
\q
EOF

# Configure Redis
sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# Setup application directory
cd /var/www/rootuip

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Configure Nginx
cat > /etc/nginx/sites-available/rootuip << 'NGINX'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    root /var/www/rootuip/public;
    index index.html;
    
    # Main application
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API Gateway
    location /api/ {
        proxy_pass http://localhost:3007/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Auth Service
    location /auth/ {
        proxy_pass http://localhost:3003/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Demo Platform
    location /demo/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # AI/ML API
    location /ai/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

# Enable Nginx site
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Start PM2 services
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup SSL with Certbot
certbot --nginx -d rootuip.com -d www.rootuip.com --non-interactive --agree-tos --email admin@rootuip.com

echo "✅ Installation complete!"
echo "🌐 Visit https://rootuip.com"
VPSINSTALL

chmod +x "$LOCAL_DIR/install-on-vps.sh"

# Step 2: Create deployment archive
echo "📦 Step 2: Creating deployment archive..."
cd "$LOCAL_DIR"
tar czf /tmp/rootuip-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='*.sqlite' \
    .

echo "✅ Deployment package ready: /tmp/rootuip-deploy.tar.gz"
echo ""
echo "📋 Deployment Instructions:"
echo "1. Copy to VPS: scp /tmp/rootuip-deploy.tar.gz root@$VPS_IP:/tmp/"
echo "2. SSH to VPS: ssh root@$VPS_IP"
echo "3. Extract: cd /var/www && mkdir -p rootuip && cd rootuip && tar xzf /tmp/rootuip-deploy.tar.gz"
echo "4. Install: ./install-on-vps.sh"
echo ""
echo "🎯 Total deployment time: ~20 minutes"