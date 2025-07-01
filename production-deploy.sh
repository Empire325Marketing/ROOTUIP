#!/bin/bash

echo "🚀 ROOTUIP Production Deployment Script"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Production server details
PROD_SERVER="145.223.73.4"
PROD_USER="root"
PROD_PATH="/var/www/rootuip"

# Step 1: Build production bundle
echo -e "${BLUE}Step 1: Preparing production build...${NC}"

# Create production env file
cat > .env.production <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://rootuip_user:secure_password@localhost:5432/rootuip
JWT_SECRET=rootuip-production-jwt-secret-2024
SESSION_SECRET=rootuip-production-session-secret-2024
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys (Production)
SENDGRID_API_KEY=your-sendgrid-api-key
HUBSPOT_API_KEY=your-hubspot-access-token
HUBSPOT_PORTAL_ID=243166069
GA_TRACKING_ID=G-PM3MT7XSM2
MIXPANEL_TOKEN=1b472f2de0a81debfb0e9f67efa0c2fe
INTERCOM_APP_ID=ui3wazlf
INTERCOM_SECRET=XinC_BzUZLMjZ286sblzSC1qSALjBNYqp7D19tjTCaE

# OAuth Configuration
MAERSK_CLIENT_ID=your_maersk_client_id
MAERSK_CLIENT_SECRET=your_maersk_client_secret
EOF

# Step 2: Deploy to production
echo -e "${BLUE}Step 2: Deploying to production server...${NC}"

# Create deployment package
tar -czf rootuip-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='tmp' \
    *.js *.html *.json *.sh *.md .env.production

# Transfer to production
echo -e "${YELLOW}Transferring files to ${PROD_SERVER}...${NC}"
scp rootuip-deploy.tar.gz ${PROD_USER}@${PROD_SERVER}:/tmp/

# Execute deployment on production server
echo -e "${BLUE}Step 3: Setting up production environment...${NC}"

ssh ${PROD_USER}@${PROD_SERVER} << 'ENDSSH'
# Colors for remote output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Installing system dependencies...${NC}"

# Update system
apt-get update
apt-get install -y nginx postgresql redis-server certbot python3-certbot-nginx

# Install Node.js 18 if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
fi

# Install PM2 globally
npm install -g pm2

# Create application directory
mkdir -p /var/www/rootuip
cd /var/www/rootuip

# Extract deployment package
tar -xzf /tmp/rootuip-deploy.tar.gz
rm /tmp/rootuip-deploy.tar.gz

# Move production env
mv .env.production .env

# Install dependencies
echo -e "${BLUE}Installing Node.js dependencies...${NC}"
npm install --production

# Setup PostgreSQL
echo -e "${BLUE}Setting up PostgreSQL database...${NC}"
sudo -u postgres psql << EOF
CREATE DATABASE IF NOT EXISTS rootuip;
CREATE USER IF NOT EXISTS rootuip_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE rootuip TO rootuip_user;
EOF

# Start Redis
systemctl start redis-server
systemctl enable redis-server

# Configure Nginx
echo -e "${BLUE}Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/rootuip << 'EONGINX'
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=roi_limit:10m rate=5r/s;

server {
    listen 80;
    server_name app.rootuip.com api.rootuip.com business.rootuip.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.rootuip.com;
    
    # SSL configuration will be added by certbot
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Root directory
    root /var/www/rootuip;
    
    # ROI Calculator (main landing)
    location / {
        limit_req zone=roi_limit burst=5 nodelay;
        try_files /enterprise-roi-calculator.html =404;
    }
    
    # Revenue Dashboard
    location /dashboard {
        try_files /analytics-revenue-dashboard.html =404;
    }
    
    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        # Route to appropriate service
        location ~ ^/api/(enterprise-leads|email-sequences|contracts|analytics) {
            proxy_pass http://localhost:3006;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        location ~ ^/api/(customers|support|workflows|intercom) {
            proxy_pass http://localhost:3007;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        location ~ ^/api/auth {
            proxy_pass http://localhost:3008;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
    
    # Static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|doc|docx)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EONGINX

# Enable site
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Start application with PM2
echo -e "${BLUE}Starting application services...${NC}"
pm2 delete all 2>/dev/null || true

pm2 start enterprise-sales-automation.js --name "sales-engine" --env production
pm2 start customer-success-platform.js --name "customer-success" --env production  
pm2 start enterprise-auth-saml.js --name "enterprise-auth" --env production

# Save PM2 configuration
pm2 save
pm2 startup systemd -u root --hp /root

# Setup SSL certificates
echo -e "${YELLOW}Setting up SSL certificates...${NC}"
certbot --nginx -d app.rootuip.com -d api.rootuip.com -d business.rootuip.com --non-interactive --agree-tos --email admin@rootuip.com || true

# Create monitoring script
cat > /var/www/rootuip/monitor.sh << 'EOMONITOR'
#!/bin/bash
# Simple monitoring script

check_service() {
    if pm2 show $1 | grep -q "online"; then
        echo "✓ $1 is running"
    else
        echo "✗ $1 is down - restarting..."
        pm2 restart $1
    fi
}

echo "ROOTUIP Service Status Check"
echo "============================"
check_service "sales-engine"
check_service "customer-success"
check_service "enterprise-auth"

# Check disk space
echo ""
echo "Disk Usage:"
df -h | grep -E '^/dev/'

# Check memory
echo ""
echo "Memory Usage:"
free -h

# Check database
echo ""
echo "Database Status:"
sudo -u postgres pg_isready && echo "✓ PostgreSQL is running" || echo "✗ PostgreSQL is down"

# Check Redis
echo ""
redis-cli ping > /dev/null 2>&1 && echo "✓ Redis is running" || echo "✗ Redis is down"
EOMONITOR

chmod +x /var/www/rootuip/monitor.sh

# Setup cron for monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/rootuip/monitor.sh >> /var/log/rootuip-monitor.log 2>&1") | crontab -

echo -e "${GREEN}✅ Production deployment complete!${NC}"
ENDSSH

# Step 4: Verify deployment
echo -e "${BLUE}Step 4: Verifying deployment...${NC}"

# Test endpoints
echo -e "${YELLOW}Testing API endpoints...${NC}"

# Test sales API
curl -s -o /dev/null -w "%{http_code}" http://${PROD_SERVER}:3006/health && \
    echo -e "${GREEN}✓ Sales Engine API is running${NC}" || \
    echo -e "${RED}✗ Sales Engine API is not responding${NC}"

# Test customer success API
curl -s -o /dev/null -w "%{http_code}" http://${PROD_SERVER}:3007/health && \
    echo -e "${GREEN}✓ Customer Success API is running${NC}" || \
    echo -e "${RED}✗ Customer Success API is not responding${NC}"

# Test auth API
curl -s -o /dev/null -w "%{http_code}" http://${PROD_SERVER}:3008/health && \
    echo -e "${GREEN}✓ Enterprise Auth API is running${NC}" || \
    echo -e "${RED}✗ Enterprise Auth API is not responding${NC}"

# Display final status
echo ""
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo ""
echo "📊 Access Points:"
echo "- ROI Calculator: https://app.rootuip.com"
echo "- Revenue Dashboard: https://app.rootuip.com/dashboard"
echo "- API Documentation: https://api.rootuip.com/docs"
echo ""
echo "🔍 Monitoring:"
echo "- PM2 Dashboard: ssh ${PROD_USER}@${PROD_SERVER} 'pm2 monit'"
echo "- Service Status: ssh ${PROD_USER}@${PROD_SERVER} '/var/www/rootuip/monitor.sh'"
echo ""
echo "📈 Next Steps:"
echo "1. Update DNS records to point to ${PROD_SERVER}"
echo "2. Test SAML authentication flow"
echo "3. Begin enterprise outreach campaign"
echo "4. Monitor analytics dashboard for conversions"

# Cleanup
rm -f rootuip-deploy.tar.gz .env.production

echo ""
echo -e "${YELLOW}Ready to convert Fortune 500 prospects into $500K+ contracts!${NC}"