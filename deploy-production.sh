#!/bin/bash

# ROOTUIP Production Deployment Script
# Deploys the platform with all production configurations

echo "🚀 ROOTUIP Production Deployment"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
VPS_IP="167.71.93.182"
DEPLOY_USER="root"
DEPLOY_PATH="/var/www/rootuip"
BACKUP_PATH="/var/www/rootuip-backup-$(date +%Y%m%d_%H%M%S)"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production file not found${NC}"
    echo "Please ensure .env.production exists in the current directory"
    exit 1
fi

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
tar czf /tmp/rootuip-production.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='*.sqlite' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.development' \
    .

echo -e "${GREEN}✅ Package created${NC}"

# Create production PM2 ecosystem file
echo -e "${YELLOW}🔧 Creating PM2 ecosystem configuration...${NC}"
cat > ecosystem.production.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'rootuip-gateway',
      script: './integration-gateway.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.API_GATEWAY_PORT || 3007
      },
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '1G'
    },
    {
      name: 'rootuip-auth',
      script: './auth-unified.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.AUTH_SERVICE_PORT || 3003
      },
      error_file: './logs/auth-error.log',
      out_file: './logs/auth-out.log'
    },
    {
      name: 'rootuip-demo',
      script: './enterprise-demo-platform.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.DEMO_PLATFORM_PORT || 3001
      },
      error_file: './logs/demo-error.log',
      out_file: './logs/demo-out.log'
    },
    {
      name: 'rootuip-ai',
      script: './ai-ml-simulation-engine.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.AI_ML_ENGINE_PORT || 3002
      },
      error_file: './logs/ai-error.log',
      out_file: './logs/ai-out.log'
    },
    {
      name: 'rootuip-websocket',
      script: './real-time-websocket-server.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.WEBSOCKET_PORT || 3004
      },
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log'
    },
    {
      name: 'rootuip-maersk',
      script: './maersk-oauth-integration.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.MAERSK_SERVICE_PORT || 3005
      },
      error_file: './logs/maersk-error.log',
      out_file: './logs/maersk-out.log'
    },
    {
      name: 'rootuip-customer',
      script: './customer-success-platform.js',
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.CUSTOMER_SUCCESS_PORT || 3006
      },
      error_file: './logs/customer-error.log',
      out_file: './logs/customer-out.log'
    }
  ]
};
EOF

# Create deployment instructions
cat << EOF

${YELLOW}📋 Production Deployment Instructions${NC}
=====================================

1. ${YELLOW}Copy files to VPS:${NC}
   scp /tmp/rootuip-production.tar.gz ${DEPLOY_USER}@${VPS_IP}:/tmp/
   scp .env.production ${DEPLOY_USER}@${VPS_IP}:/tmp/
   scp ecosystem.production.js ${DEPLOY_USER}@${VPS_IP}:/tmp/

2. ${YELLOW}SSH to VPS:${NC}
   ssh ${DEPLOY_USER}@${VPS_IP}

3. ${YELLOW}On the VPS, run these commands:${NC}

   # Stop existing services
   cd ${DEPLOY_PATH}
   pm2 stop all
   pm2 delete all
   
   # Backup current deployment
   sudo mv ${DEPLOY_PATH} ${BACKUP_PATH}
   
   # Create fresh directory
   sudo mkdir -p ${DEPLOY_PATH}
   cd ${DEPLOY_PATH}
   
   # Extract new files
   sudo tar xzf /tmp/rootuip-production.tar.gz
   
   # Copy production files
   sudo cp /tmp/.env.production .env
   sudo cp /tmp/ecosystem.production.js ecosystem.config.js
   
   # Set permissions
   sudo chown -R www-data:www-data ${DEPLOY_PATH}
   sudo chmod -R 755 ${DEPLOY_PATH}
   sudo chmod 600 .env
   
   # Install dependencies
   npm install --production
   
   # Create required directories
   mkdir -p logs uploads certificates
   
   # Setup database (if first time)
   # sudo ./setup-production-db.sh
   
   # Start services with PM2
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   
   # Setup Nginx (if not done)
   sudo cp nginx-unified.conf /etc/nginx/sites-available/rootuip
   sudo ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   
   # Setup SSL (if not done)
   sudo certbot --nginx -d rootuip.com -d www.rootuip.com

4. ${YELLOW}Verify deployment:${NC}
   # Check services
   pm2 status
   pm2 logs
   
   # Test endpoints
   curl http://localhost:3007/health
   curl http://localhost:3003/health
   
   # Check website
   curl -I https://rootuip.com

5. ${YELLOW}Monitor services:${NC}
   pm2 monit

${GREEN}✅ Production Security Checklist:${NC}
================================
□ Environment variables loaded from .env file
□ Database passwords changed from defaults
□ Redis password configured
□ SSL certificates installed
□ Firewall configured (ports 80, 443, 22 only)
□ SSH key authentication enabled
□ Root login disabled
□ Fail2ban installed
□ Regular backups configured
□ Monitoring alerts setup

${YELLOW}🔥 Production Endpoints:${NC}
======================
Main Site: https://rootuip.com
Login: https://rootuip.com/app.html
API Gateway: https://rootuip.com/api
Health Check: https://rootuip.com/api/health

${YELLOW}📊 Monitoring Commands:${NC}
=====================
View logs: pm2 logs
View metrics: pm2 monit
Restart service: pm2 restart [app-name]
View status: pm2 status
System resources: htop

${RED}⚠️  Important Notes:${NC}
==================
1. Always backup before deployment
2. Test in staging environment first
3. Monitor logs after deployment
4. Keep .env.production secure
5. Rotate API keys regularly

EOF

echo -e "${GREEN}✅ Production deployment script ready!${NC}"
echo "Follow the instructions above to deploy to production."