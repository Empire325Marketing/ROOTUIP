#!/bin/bash

# ROOTUIP Complete Production Setup Script
# This script sets up everything needed for production deployment

echo "🚀 ROOTUIP Complete Production Setup"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="rootuip.com"
APP_DIR="/var/www/rootuip"
NODE_VERSION="18"

echo -e "${YELLOW}📦 Step 1: System Updates${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}📦 Step 2: Installing Node.js ${NODE_VERSION}${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

echo -e "${YELLOW}📦 Step 3: Installing Global NPM Packages${NC}"
npm install -g pm2 npm@latest

echo -e "${YELLOW}📦 Step 4: Installing System Dependencies${NC}"
apt install -y \
    nginx \
    postgresql postgresql-contrib \
    redis-server \
    certbot python3-certbot-nginx \
    git \
    build-essential \
    htop \
    fail2ban \
    ufw

echo -e "${YELLOW}🔒 Step 5: Configuring Firewall${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

echo -e "${YELLOW}🗄️ Step 6: Setting up PostgreSQL${NC}"
# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32)
echo "Generated DB Password: $DB_PASSWORD" > /root/rootuip-db-credentials.txt
chmod 600 /root/rootuip-db-credentials.txt

sudo -u postgres psql << EOF
-- Create production database and user
CREATE USER rootuip_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
CREATE DATABASE rootuip_production OWNER rootuip_user;
GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip_user;

-- Connect to the database
\c rootuip_production

-- Create schema
CREATE SCHEMA IF NOT EXISTS rootuip;
GRANT ALL ON SCHEMA rootuip TO rootuip_user;

-- Create tables
CREATE TABLE IF NOT EXISTS rootuip.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50),
    company VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rootuip.containers (
    id SERIAL PRIMARY KEY,
    container_number VARCHAR(50) UNIQUE NOT NULL,
    carrier VARCHAR(100),
    status VARCHAR(50),
    location VARCHAR(255),
    eta TIMESTAMP,
    risk_score DECIMAL(3,2),
    user_id INTEGER REFERENCES rootuip.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tracking_data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rootuip.api_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES rootuip.users(id),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    response_time INTEGER,
    ip_address INET,
    user_agent TEXT,
    request_body JSONB,
    response_body JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_containers_user_id ON rootuip.containers(user_id);
CREATE INDEX idx_containers_status ON rootuip.containers(status);
CREATE INDEX idx_api_logs_user_id ON rootuip.api_logs(user_id);
CREATE INDEX idx_api_logs_created_at ON rootuip.api_logs(created_at);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA rootuip TO rootuip_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rootuip TO rootuip_user;

-- Insert admin user
INSERT INTO rootuip.users (email, password_hash, name, role, company) 
VALUES (
    'mjaiii@rootuip.com',
    '\$2b\$12\$KIXxPfE6K5bO5IMfCQvJReOJZL6TszoG3RgJK6u8mKFKqYaD.dVC2',
    'MJ',
    'admin',
    'ROOTUIP'
) ON CONFLICT (email) DO NOTHING;
EOF

echo -e "${GREEN}✅ PostgreSQL configured${NC}"

echo -e "${YELLOW}🔴 Step 7: Configuring Redis${NC}"
# Generate Redis password
REDIS_PASSWORD=$(openssl rand -base64 32)
echo "Generated Redis Password: $REDIS_PASSWORD" >> /root/rootuip-db-credentials.txt

# Configure Redis
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/g" /etc/redis/redis.conf
sed -i "s/supervised no/supervised systemd/g" /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

echo -e "${GREEN}✅ Redis configured${NC}"

echo -e "${YELLOW}📁 Step 8: Creating Application Directory${NC}"
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/uploads
mkdir -p $APP_DIR/certificates
mkdir -p $APP_DIR/public
mkdir -p $APP_DIR/lib

# Set permissions
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

echo -e "${YELLOW}🔐 Step 9: Creating Production .env${NC}"
# Update .env with secure passwords
cat > $APP_DIR/.env << EOF
# ROOTUIP Production Configuration
# Auto-generated on $(date)

# Core Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
APP_NAME=ROOTUIP
APP_URL=https://$DOMAIN
API_URL=https://$DOMAIN/api

# Database Configuration
DATABASE_URL=postgresql://rootuip_user:$DB_PASSWORD@localhost:5432/rootuip_production
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

# Redis Configuration
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0
REDIS_SESSION_DB=1
REDIS_CACHE_DB=2

# Maersk Integration (APPROVED)
MAERSK_CLIENT_ID=your-maersk-client-id
MAERSK_CLIENT_SECRET=your-maersk-client-secret
MAERSK_APP_ID=143b9964-21da-4dcd-9b6b-604215185f7d
MAERSK_API_BASE_URL=https://api.maersk.com
MAERSK_OAUTH_URL=https://api.maersk.com/oauth2/token
MAERSK_PRODUCTION_MODE=true

# Microsoft SAML (Production)
SAML_METADATA_URL=https://login.microsoftonline.com/d6ba3566-e9a2-4ba8-bd23-eb4cc234a6b8/federationmetadata/2007-06/federationmetadata.xml?appid=4b06569e-6521-4764-aac4-4cc27cc35a0e
SAML_ENTITY_ID=https://$DOMAIN/auth/saml
SAML_CONSUMER_SERVICE_URL=https://$DOMAIN/auth/saml/callback
SAML_ISSUER=https://$DOMAIN

# Business Automation
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=notifications@$DOMAIN
SENDGRID_FROM_NAME=ROOTUIP Platform

HUBSPOT_ACCESS_TOKEN=your-hubspot-access-token
HUBSPOT_HUB_ID=243166069

STRIPE_API_KEY=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

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Service Ports
API_GATEWAY_PORT=3007
AUTH_SERVICE_PORT=3003
DEMO_PLATFORM_PORT=3001
AI_ML_ENGINE_PORT=3002
WEBSOCKET_PORT=3004
MAERSK_SERVICE_PORT=3005
CUSTOMER_SUCCESS_PORT=3006

# Monitoring
LOG_LEVEL=info
LOG_DIR=$APP_DIR/logs
ENABLE_ALERTS=true

# Feature Flags
ENABLE_REAL_TIME_TRACKING=true
ENABLE_AI_PREDICTIONS=true
ENABLE_DOCUMENT_PROCESSING=true
ENABLE_MULTI_CARRIER=true
ENABLE_SSO=true
ENABLE_API_RATE_LIMITING=true
ENABLE_WEBHOOK_NOTIFICATIONS=true
EOF

chmod 600 $APP_DIR/.env
chown www-data:www-data $APP_DIR/.env

echo -e "${GREEN}✅ Environment configured${NC}"

echo -e "${YELLOW}🌐 Step 10: Configuring Nginx${NC}"
cat > /etc/nginx/sites-available/rootuip << 'EOF'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rootuip.com www.rootuip.com;
    
    # SSL will be configured by certbot
    
    root /var/www/rootuip/public;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3004/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Authentication
    location /auth/ {
        proxy_pass http://localhost:3003/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static assets
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
}
EOF

ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo -e "${GREEN}✅ Nginx configured${NC}"

echo -e "${YELLOW}🔒 Step 11: Setting up Fail2ban${NC}"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true

[nginx-noproxy]
enabled = true
EOF

systemctl restart fail2ban
systemctl enable fail2ban

echo -e "${GREEN}✅ Security hardening complete${NC}"

echo -e "${YELLOW}📊 Step 12: Setting up Monitoring${NC}"
# Create monitoring script
cat > /usr/local/bin/rootuip-monitor.sh << 'EOF'
#!/bin/bash
# ROOTUIP Health Check Script

# Check services
pm2 status
systemctl status nginx
systemctl status postgresql
systemctl status redis-server

# Check disk space
df -h

# Check memory
free -h

# Check logs for errors
tail -n 50 /var/www/rootuip/logs/error*.log | grep ERROR
EOF

chmod +x /usr/local/bin/rootuip-monitor.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/rootuip-monitor.sh > /var/log/rootuip-monitor.log 2>&1") | crontab -

echo -e "${GREEN}✅ Monitoring configured${NC}"

echo ""
echo -e "${GREEN}✅ Production setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Copy your application files to $APP_DIR"
echo "2. Run: cd $APP_DIR && npm install --production"
echo "3. Run: pm2 start ecosystem.config.js --env production"
echo "4. Run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo -e "${YELLOW}🔐 Credentials saved to:${NC}"
echo "   /root/rootuip-db-credentials.txt"
echo ""
echo -e "${YELLOW}📊 Monitor services:${NC}"
echo "   pm2 monit"
echo "   /usr/local/bin/rootuip-monitor.sh"
echo ""
echo -e "${GREEN}🚀 Your ROOTUIP platform is ready for production!${NC}"