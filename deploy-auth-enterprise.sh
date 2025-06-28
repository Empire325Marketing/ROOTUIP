#!/bin/bash

# ROOTUIP Enterprise Authentication Deployment Script
# Deploy to production VPS at 145.223.73.4

set -e

echo "🔐 ROOTUIP Enterprise Authentication Deployment"
echo "============================================="

# Configuration
DEPLOY_USER="root"
DEPLOY_HOST="145.223.73.4"
DEPLOY_PATH="/var/www/rootuip"
SERVICE_NAME="rootuip-auth"
AUTH_PORT="3003"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running from correct directory
if [ ! -f "auth-enterprise/enterprise-auth-complete.js" ]; then
    echo -e "${RED}Error: Must run from ROOTUIP project root${NC}"
    exit 1
fi

echo -e "${YELLOW}Deploying to $DEPLOY_HOST...${NC}"

# Create deployment package
echo "Creating deployment package..."
tar -czf auth-enterprise-deploy.tar.gz \
    auth-enterprise/*.js \
    auth-enterprise/package*.json \
    auth-enterprise/README.md \
    auth-enterprise/jest.config.js \
    auth-enterprise/tests \
    enterprise-auth-complete-schema.sql \
    enterprise-security-dashboard-v2.html \
    enterprise-compliance-dashboard.html \
    login.html

# Transfer files
echo "Transferring files to VPS..."
scp auth-enterprise-deploy.tar.gz $DEPLOY_USER@$DEPLOY_HOST:/tmp/

# Deploy on server
echo "Deploying on server..."
ssh $DEPLOY_USER@$DEPLOY_HOST << 'ENDSSH'
set -e

# Create directories
mkdir -p /var/www/rootuip/auth-enterprise
mkdir -p /var/www/rootuip/logs
mkdir -p /var/www/rootuip/public

# Extract files
cd /tmp
tar -xzf auth-enterprise-deploy.tar.gz

# Move auth service files
mv auth-enterprise/* /var/www/rootuip/auth-enterprise/

# Move SQL schema file
mv enterprise-auth-complete-schema.sql /var/www/rootuip/auth-enterprise/

# Move HTML files to public directory
mv *.html /var/www/rootuip/public/

# Install dependencies
cd /var/www/rootuip/auth-enterprise
npm install --production

# Create environment file if not exists
if [ ! -f .env ]; then
    cat > .env << EOF
PORT=3003
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rootuip
DB_USER=uip_user
DB_PASSWORD=U1Pp@ssw0rd!
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
FRONTEND_URL=https://rootuip.com
EOF
fi

# Setup database if needed
if ! sudo -u postgres psql -d rootuip -c "SELECT 1 FROM users LIMIT 1" &>/dev/null; then
    echo "Setting up database..."
    sudo -u postgres psql -d rootuip < /var/www/rootuip/auth-enterprise/enterprise-auth-complete-schema.sql
fi

# Create systemd service
cat > /etc/systemd/system/rootuip-auth.service << EOF
[Unit]
Description=ROOTUIP Enterprise Authentication Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/auth-enterprise
ExecStart=/usr/bin/node enterprise-auth-complete.js
Restart=always
RestartSec=10
StandardOutput=append:/var/www/rootuip/logs/auth.log
StandardError=append:/var/www/rootuip/logs/auth-error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
systemctl daemon-reload
systemctl enable rootuip-auth
systemctl restart rootuip-auth

# Configure nginx
cat > /etc/nginx/sites-available/auth.rootuip.com << 'EOF'
server {
    listen 80;
    server_name auth.rootuip.com app.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name auth.rootuip.com app.rootuip.com;

    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Auth service endpoints
    location /auth/ {
        proxy_pass http://localhost:3003/auth/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for long-running requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static files
    location / {
        root /var/www/rootuip/public;
        try_files $uri $uri/ /index.html;
        
        # Security headers for static files
        add_header Cache-Control "public, max-age=31536000" always;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3003/health;
        access_log off;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/auth.rootuip.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Set proper permissions
chown -R www-data:www-data /var/www/rootuip
chmod -R 755 /var/www/rootuip
chmod 600 /var/www/rootuip/auth-enterprise/.env

# Create log rotation
cat > /etc/logrotate.d/rootuip-auth << EOF
/var/www/rootuip/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload rootuip-auth >/dev/null 2>&1 || true
    endscript
}
EOF

echo "Deployment complete!"

# Check service status
systemctl status rootuip-auth --no-pager

# Clean up
rm -f /tmp/auth-enterprise-deploy.tar.gz

ENDSSH

# Clean up local package
rm -f auth-enterprise-deploy.tar.gz

echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo "Access points:"
echo "- Auth API: https://auth.rootuip.com/auth/"
echo "- Login: https://app.rootuip.com/login.html"
echo "- Security Dashboard: https://app.rootuip.com/enterprise-security-dashboard-v2.html"
echo "- Compliance Dashboard: https://app.rootuip.com/enterprise-compliance-dashboard.html"
echo ""
echo "Monitor logs:"
echo "  ssh $DEPLOY_USER@$DEPLOY_HOST 'tail -f /var/www/rootuip/logs/auth.log'"
echo ""
echo "Service commands:"
echo "  Start:   ssh $DEPLOY_USER@$DEPLOY_HOST 'systemctl start rootuip-auth'"
echo "  Stop:    ssh $DEPLOY_USER@$DEPLOY_HOST 'systemctl stop rootuip-auth'"
echo "  Restart: ssh $DEPLOY_USER@$DEPLOY_HOST 'systemctl restart rootuip-auth'"
echo "  Status:  ssh $DEPLOY_USER@$DEPLOY_HOST 'systemctl status rootuip-auth'"