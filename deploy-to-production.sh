#!/bin/bash

# ROOTUIP Production Deployment Script
# Complete SSL setup, nginx configuration, and platform deployment

echo "
╔══════════════════════════════════════════════════════════════════╗
║              ROOTUIP PRODUCTION DEPLOYMENT SCRIPT                ║
║                    SSL + Nginx + Platform                        ║
╚══════════════════════════════════════════════════════════════════╝
"

# Configuration
VPS_IP="145.223.73.4"
VPS_USER="root"
DOMAIN="rootuip.com"
APP_DOMAIN="app.rootuip.com"
LOCAL_PATH="/home/iii/ROOTUIP"
REMOTE_PATH="/var/www/rootuip"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check command success
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 successful${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Function to execute remote commands
remote_exec() {
    ssh ${VPS_USER}@${VPS_IP} "$1"
}

# Step 1: Prepare local files
echo -e "\n${BLUE}📦 Step 1: Preparing deployment package...${NC}"

# Create production .env file
cat > ${LOCAL_PATH}/.env.production << 'EOF'
# Production Environment Configuration
NODE_ENV=production
HOST=0.0.0.0
PORT=3000

# Authentication
SAML_CONSUMER_SERVICE_URL=https://app.rootuip.com/saml/acs
SAML_ENTITY_ID=https://app.rootuip.com
SAML_LOGIN_URL=https://login.microsoftonline.com/d6ba3566-e9a2-4ba8-bd23-eb4cc234a6b8/saml2
SAML_LOGOUT_URL=https://login.microsoftonline.com/d6ba3566-e9a2-4ba8-bd23-eb4cc234a6b8/saml2/logout
SAML_METADATA_URL=https://login.microsoftonline.com/d6ba3566-e9a2-4ba8-bd23-eb4cc234a6b8/federationmetadata/2007-06/federationmetadata.xml?appid=4b06569e-6521-4764-aac4-4cc27cc35a0e

# JWT Configuration
JWT_SECRET=8r4lXegQcMNCNgm6JmdzrkaPJaUxDdP3
JWT_EXPIRY=24h
REFRESH_TOKEN_SECRET=Ve8yQkR7C9aP2mN4xLgT5sW3qD6fJ8hA
REFRESH_TOKEN_EXPIRY=30d

# Database
DATABASE_URL=postgresql://uip_user:secure_password@localhost:5432/uip_production
REDIS_URL=redis://localhost:6379

# Maersk API (OAuth 2.0)
MAERSK_CLIENT_ID=your-maersk-client-id
MAERSK_CLIENT_SECRET=YFCyxmMCchO5lRGo
MAERSK_OAUTH_URL=https://api.maersk.com/oauth2/access_token
MAERSK_API_BASE_URL=https://api.maersk.com

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sales@rootuip.com
SMTP_PASS=your_smtp_password

# API Keys
GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Performance
ENABLE_CACHE=true
CACHE_TTL=3600
COMPRESSION_ENABLED=true
EOF

echo -e "${GREEN}✓ Production .env created${NC}"

# Create nginx configuration
cat > ${LOCAL_PATH}/nginx-production.conf << 'EOF'
# ROOTUIP Production Nginx Configuration

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;

# Upstream definitions
upstream app_backend {
    server localhost:3000;
    keepalive 64;
}

upstream dashboard_backend {
    server localhost:3008;
    keepalive 32;
}

upstream crm_backend {
    server localhost:3010;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name rootuip.com www.rootuip.com app.rootuip.com;
    return 301 https://$host$request_uri;
}

# Main application (app.rootuip.com)
server {
    listen 443 ssl http2;
    server_name app.rootuip.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/app.rootuip.com.access.log;
    error_log /var/log/nginx/app.rootuip.com.error.log;

    # Root location
    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://dashboard_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets with caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|doc|docx)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    gzip_min_length 1000;
}

# Marketing website (rootuip.com, www.rootuip.com)
server {
    listen 443 ssl http2;
    server_name rootuip.com www.rootuip.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Logging
    access_log /var/log/nginx/rootuip.com.access.log;
    error_log /var/log/nginx/rootuip.com.error.log;

    # Root location - CRM/Landing pages
    location / {
        proxy_pass http://crm_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ROI Calculator
    location /roi-calculator {
        proxy_pass http://crm_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://crm_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    gzip_min_length 1000;
}
EOF

echo -e "${GREEN}✓ Nginx configuration created${NC}"

# Create systemd service files
cat > ${LOCAL_PATH}/rootuip-app.service << 'EOF'
[Unit]
Description=ROOTUIP Enterprise Auth Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip
Environment=NODE_ENV=production
ExecStart=/usr/bin/node enterprise-auth-server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rootuip-app

[Install]
WantedBy=multi-user.target
EOF

cat > ${LOCAL_PATH}/rootuip-dashboard.service << 'EOF'
[Unit]
Description=ROOTUIP Real-time Dashboard Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip
Environment=NODE_ENV=production
ExecStart=/usr/bin/node real-time-dashboard-server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rootuip-dashboard

[Install]
WantedBy=multi-user.target
EOF

cat > ${LOCAL_PATH}/rootuip-crm.service << 'EOF'
[Unit]
Description=ROOTUIP Sales CRM System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip
Environment=NODE_ENV=production
ExecStart=/usr/bin/node sales-crm-system.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rootuip-crm

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Systemd service files created${NC}"

# Step 2: Upload files to VPS
echo -e "\n${BLUE}📤 Step 2: Uploading files to VPS...${NC}"

# Create remote directory
remote_exec "mkdir -p ${REMOTE_PATH}"

# Sync files
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'logs/*' \
    ${LOCAL_PATH}/ ${VPS_USER}@${VPS_IP}:${REMOTE_PATH}/
check_success "File upload"

# Step 3: SSL Certificate Setup
echo -e "\n${BLUE}🔐 Step 3: Setting up SSL certificates...${NC}"

# Install certbot if needed
remote_exec "apt update && apt install -y certbot python3-certbot-nginx"

# Get SSL certificates
echo -e "${YELLOW}Obtaining SSL certificates for rootuip.com, app.rootuip.com, www.rootuip.com...${NC}"
remote_exec "certbot certonly --standalone --non-interactive --agree-tos --email admin@rootuip.com -d rootuip.com -d app.rootuip.com -d www.rootuip.com"
check_success "SSL certificate generation"

# Step 4: Configure Nginx
echo -e "\n${BLUE}🌐 Step 4: Configuring Nginx...${NC}"

# Copy nginx config
remote_exec "cp ${REMOTE_PATH}/nginx-production.conf /etc/nginx/sites-available/rootuip"
remote_exec "ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/"
remote_exec "rm -f /etc/nginx/sites-enabled/default"

# Test nginx config
remote_exec "nginx -t"
check_success "Nginx configuration test"

# Reload nginx
remote_exec "systemctl reload nginx"
check_success "Nginx reload"

# Step 5: Setup Node.js environment
echo -e "\n${BLUE}🚀 Step 5: Setting up Node.js environment...${NC}"

# Install dependencies
remote_exec "cd ${REMOTE_PATH} && npm install --production"
check_success "NPM install"

# Copy production env
remote_exec "cp ${REMOTE_PATH}/.env.production ${REMOTE_PATH}/.env"

# Set permissions
remote_exec "chown -R www-data:www-data ${REMOTE_PATH}"
remote_exec "chmod -R 755 ${REMOTE_PATH}"

# Step 6: Setup systemd services
echo -e "\n${BLUE}⚙️ Step 6: Setting up system services...${NC}"

# Copy service files
remote_exec "cp ${REMOTE_PATH}/*.service /etc/systemd/system/"
remote_exec "systemctl daemon-reload"

# Enable and start services
for service in rootuip-app rootuip-dashboard rootuip-crm; do
    remote_exec "systemctl enable $service"
    remote_exec "systemctl restart $service"
    sleep 2
    remote_exec "systemctl status $service --no-pager"
done

# Step 7: Database setup
echo -e "\n${BLUE}🗄️ Step 7: Setting up production database...${NC}"

# Create database and user
remote_exec "sudo -u postgres psql -c \"CREATE DATABASE uip_production;\""
remote_exec "sudo -u postgres psql -c \"CREATE USER uip_user WITH PASSWORD 'secure_password';\""
remote_exec "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE uip_production TO uip_user;\""

# Step 8: Final checks
echo -e "\n${BLUE}✅ Step 8: Running final checks...${NC}"

# Check service status
echo -e "${YELLOW}Service Status:${NC}"
remote_exec "systemctl status rootuip-app --no-pager | grep Active"
remote_exec "systemctl status rootuip-dashboard --no-pager | grep Active"
remote_exec "systemctl status rootuip-crm --no-pager | grep Active"

# Check endpoints
echo -e "\n${YELLOW}Checking endpoints:${NC}"
curl -s -o /dev/null -w "Main App (app.rootuip.com): %{http_code}\n" https://app.rootuip.com/health || echo "Main App: Not responding"
curl -s -o /dev/null -w "Landing Page (rootuip.com): %{http_code}\n" https://rootuip.com || echo "Landing: Not responding"

# Display success message
echo -e "\n${GREEN}
╔══════════════════════════════════════════════════════════════════╗
║                    🎉 DEPLOYMENT COMPLETE! 🎉                    ║
╚══════════════════════════════════════════════════════════════════╝
${NC}"

echo -e "${BOLD}🌐 Your platform is now live at:${NC}"
echo -e "   ${BLUE}Application:${NC} https://app.rootuip.com"
echo -e "   ${BLUE}Landing Page:${NC} https://rootuip.com"
echo -e "   ${BLUE}ROI Calculator:${NC} https://rootuip.com/roi-calculator"

echo -e "\n${BOLD}📊 Monitor your services:${NC}"
echo -e "   ssh ${VPS_USER}@${VPS_IP}"
echo -e "   systemctl status rootuip-app"
echo -e "   systemctl status rootuip-dashboard"
echo -e "   systemctl status rootuip-crm"

echo -e "\n${BOLD}📝 View logs:${NC}"
echo -e "   journalctl -u rootuip-app -f"
echo -e "   journalctl -u rootuip-dashboard -f"
echo -e "   journalctl -u rootuip-crm -f"

echo -e "\n${YELLOW}⚡ Next Steps:${NC}"
echo -e "1. Update DNS records to point to ${VPS_IP}"
echo -e "2. Test Microsoft SAML login at https://app.rootuip.com/login"
echo -e "3. Monitor initial traffic and performance"
echo -e "4. Set up backups and monitoring alerts"

echo -e "\n${GREEN}Every day without deployment costs $45,000! 🚀${NC}"