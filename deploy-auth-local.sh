#!/bin/bash
# ROOTUIP Authentication System Local Deployment
# Deploys auth system components that don't require sudo

set -e

echo "🔐 ROOTUIP Authentication System Local Deployment"
echo "==============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_step() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Configuration
AUTH_DIR="/home/iii/ROOTUIP/auth"
API_PORT=3002
JWT_SECRET=$(openssl rand -base64 64)

# Step 1: Ensure we're in the right directory
cd $AUTH_DIR

# Step 2: Install dependencies (already done)
log_success "Node.js dependencies already installed"

# Step 3: Create production environment file
log_step "Creating production environment configuration..."
cat > .env.production << EOF
# ROOTUIP Authentication Service Configuration
NODE_ENV=production
PORT=$API_PORT

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration (using in-memory for now)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rootuip_auth
DB_USER=rootuip_auth_user
DB_PASS=temp_password

# Email Configuration (demo mode)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@rootuip.com
EMAIL_PASS=demo_password

# Application URLs
APP_URL=https://app.rootuip.com
API_URL=https://app.rootuip.com/api

# Security
ALLOWED_ORIGINS=https://rootuip.com,https://app.rootuip.com,https://staging.rootuip.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=5
EOF

chmod 600 .env.production

# Step 4: Create a demo-mode version that uses in-memory database
log_step "Creating demo-mode authentication system..."
cat > enterprise-auth-demo.js << 'EOF'
// ROOTUIP Authentication System - Demo Mode
// Uses in-memory database for testing without PostgreSQL

const fs = require('fs');
const path = require('path');

// Load environment variables
if (fs.existsSync('.env.production')) {
    require('dotenv').config({ path: '.env.production' });
} else if (fs.existsSync('.env')) {
    require('dotenv').config();
}

// Set demo mode
process.env.DEMO_MODE = 'true';

// Load the main authentication system
require('./enterprise-auth-system.js');
EOF

# Step 5: Copy authentication pages to deployment location
log_step "Preparing authentication pages for deployment..."
mkdir -p /home/iii/ROOTUIP/deployment/auth
cp *.html /home/iii/ROOTUIP/deployment/auth/
cp /home/iii/ROOTUIP/enhanced-login.html /home/iii/ROOTUIP/deployment/auth/login.html

# Step 6: Create nginx configuration files
log_step "Creating nginx configuration files..."
cat > /home/iii/ROOTUIP/deployment/nginx-auth.conf << 'EOF'
# ROOTUIP Authentication Configuration
# Add this to your nginx server blocks

# Authentication API proxy
location /api/auth/ {
    proxy_pass http://localhost:3002/api/auth/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # CORS headers
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Credentials true always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    
    if ($request_method = OPTIONS) {
        return 204;
    }
}

# Authentication pages
location /auth/ {
    alias /var/www/rootuip/public/auth/;
    try_files $uri $uri/ =404;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
EOF

# Step 7: Create deployment instructions
log_step "Creating deployment instructions..."
cat > /home/iii/ROOTUIP/deployment/AUTH_DEPLOYMENT.md << 'EOF'
# ROOTUIP Authentication System Deployment Instructions

## Files to Deploy

1. **Authentication API Service**
   - Source: `/home/iii/ROOTUIP/auth/`
   - Destination: `/var/www/rootuip/auth/`
   - Files: All .js files, package.json, .env.production

2. **Authentication Frontend Pages**
   - Source: `/home/iii/ROOTUIP/deployment/auth/`
   - Destination: `/var/www/rootuip/public/auth/`
   - Files: All .html files

3. **Nginx Configuration**
   - Source: `/home/iii/ROOTUIP/deployment/nginx-auth.conf`
   - Include in: `/etc/nginx/sites-available/app.rootuip.com`

## Manual Deployment Steps

### 1. Copy Files to Server
```bash
# Create directories
sudo mkdir -p /var/www/rootuip/auth
sudo mkdir -p /var/www/rootuip/public/auth

# Copy API files
sudo cp -r /home/iii/ROOTUIP/auth/* /var/www/rootuip/auth/
sudo chown -R www-data:www-data /var/www/rootuip/auth

# Copy frontend files
sudo cp /home/iii/ROOTUIP/deployment/auth/*.html /var/www/rootuip/public/auth/
sudo chown -R www-data:www-data /var/www/rootuip/public/auth
```

### 2. Install Dependencies on Server
```bash
cd /var/www/rootuip/auth
sudo -u www-data npm install --production
```

### 3. Create Systemd Service
```bash
sudo tee /etc/systemd/system/rootuip-auth.service > /dev/null << 'SERVICE'
[Unit]
Description=ROOTUIP Authentication Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/auth
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /var/www/rootuip/auth/enterprise-auth-demo.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable rootuip-auth
sudo systemctl start rootuip-auth
```

### 4. Update Nginx Configuration
Add the contents of `nginx-auth.conf` to your app.rootuip.com server block, then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Test the System
- Login: https://app.rootuip.com/auth/login.html
- Register: https://app.rootuip.com/auth/register.html
- API Health: https://app.rootuip.com/api/auth/health

## Demo Accounts
- Admin: admin@rootuip.com / Admin2025!
- Demo: demo@rootuip.com / Demo2025!
EOF

# Step 8: Create a startup script
log_step "Creating startup script..."
cat > start-auth-demo.sh << 'EOF'
#!/bin/bash
# Start ROOTUIP Authentication Service in demo mode

cd /home/iii/ROOTUIP/auth
export NODE_ENV=production
export DEMO_MODE=true

echo "Starting ROOTUIP Authentication Service (Demo Mode)..."
echo "API will be available at: http://localhost:3002"
echo "Press Ctrl+C to stop"

node enterprise-auth-demo.js
EOF
chmod +x start-auth-demo.sh

# Step 9: Test the authentication API locally
log_step "Starting authentication API in demo mode for testing..."
cd $AUTH_DIR

# Start in background for testing
export NODE_ENV=production
export DEMO_MODE=true
node enterprise-auth-demo.js > auth-demo.log 2>&1 &
AUTH_PID=$!

sleep 3

# Test the API
log_step "Testing authentication API..."
if curl -s http://localhost:3002/api/health | grep -q "healthy"; then
    log_success "Authentication API is running successfully!"
else
    log_warning "Authentication API test failed"
fi

# Stop the test instance
kill $AUTH_PID 2>/dev/null

# Step 10: Create deployment package
log_step "Creating deployment package..."
cd /home/iii/ROOTUIP
tar -czf auth-system-deployment.tar.gz \
    auth/*.js \
    auth/package.json \
    auth/.env.production \
    deployment/auth/*.html \
    deployment/nginx-auth.conf \
    deployment/AUTH_DEPLOYMENT.md

log_success "Deployment package created: auth-system-deployment.tar.gz"

# Display summary
echo ""
echo "============================================="
log_success "Authentication System Prepared!"
echo "============================================="
echo ""
echo "📦 DEPLOYMENT PACKAGE CREATED"
echo ""
echo "📁 Files prepared:"
echo "   - Authentication API: /home/iii/ROOTUIP/auth/"
echo "   - Frontend pages: /home/iii/ROOTUIP/deployment/auth/"
echo "   - Nginx config: /home/iii/ROOTUIP/deployment/nginx-auth.conf"
echo "   - Instructions: /home/iii/ROOTUIP/deployment/AUTH_DEPLOYMENT.md"
echo ""
echo "🚀 To deploy to production:"
echo "   1. Review: cat /home/iii/ROOTUIP/deployment/AUTH_DEPLOYMENT.md"
echo "   2. Copy package: auth-system-deployment.tar.gz"
echo "   3. Follow manual deployment steps"
echo ""
echo "🧪 To test locally:"
echo "   cd /home/iii/ROOTUIP/auth"
echo "   ./start-auth-demo.sh"
echo ""
echo "🔐 Demo Accounts:"
echo "   Admin: admin@rootuip.com / Admin2025!"
echo "   User: demo@rootuip.com / Demo2025!"
echo ""
log_warning "Note: Demo mode uses in-memory database. Configure PostgreSQL for production."
echo ""