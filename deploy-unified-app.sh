#!/bin/bash

# ROOTUIP Unified Application Deployment Script
# This script deploys the complete unified platform to the VPS

echo "🚀 ROOTUIP Unified Application Deployment"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Configuration
VPS_IP="167.71.93.182"
DOMAIN="rootuip.com"
APP_DIR="/var/www/rootuip"
NGINX_CONFIG="/etc/nginx/sites-available/rootuip"

echo "📋 Deployment Configuration:"
echo "   VPS: $VPS_IP"
echo "   Domain: $DOMAIN"
echo "   App Directory: $APP_DIR"
echo ""

# Create deployment package
echo "📦 Creating deployment package..."
cd /home/iii/ROOTUIP
tar czf /tmp/rootuip-unified-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='*.sqlite' \
    --exclude='certificates' \
    .

echo "✅ Package created: /tmp/rootuip-unified-deploy.tar.gz"
echo ""

# Display deployment instructions
cat << 'EOF'
📋 Manual Deployment Steps:
==========================

1. Copy files to VPS:
   scp /tmp/rootuip-unified-deploy.tar.gz root@167.71.93.182:/tmp/

2. SSH to VPS:
   ssh root@167.71.93.182

3. On the VPS, run these commands:

   # Stop existing services
   pm2 stop all
   
   # Backup existing installation
   mv /var/www/rootuip /var/www/rootuip.backup.$(date +%Y%m%d_%H%M%S)
   
   # Create fresh directory
   mkdir -p /var/www/rootuip
   cd /var/www/rootuip
   
   # Extract new files
   tar xzf /tmp/rootuip-unified-deploy.tar.gz
   
   # Install dependencies
   npm install
   
   # Create necessary directories
   mkdir -p logs
   mkdir -p uploads
   mkdir -p public/assets/css
   mkdir -p public/assets/js
   mkdir -p public/assets/images
   
   # Set permissions
   chown -R www-data:www-data /var/www/rootuip
   chmod -R 755 /var/www/rootuip
   
   # Copy Nginx configuration
   cp nginx-unified.conf /etc/nginx/sites-available/rootuip
   ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
   
   # Test Nginx configuration
   nginx -t
   
   # Reload Nginx
   systemctl reload nginx
   
   # Start all services with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   
   # Monitor services
   pm2 monit

4. SSL Certificate Setup (if not already done):
   certbot --nginx -d rootuip.com -d www.rootuip.com

5. Test the deployment:
   - Visit https://rootuip.com (landing page)
   - Click "Login" to access the unified application
   - Test authentication flow
   - Verify all dashboard features work
   - Check WebSocket connections
   - Test API endpoints

🔍 Troubleshooting Commands:
===========================
- Check service status: pm2 status
- View logs: pm2 logs
- Restart a service: pm2 restart [service-name]
- Check Nginx logs: tail -f /var/log/nginx/error.log
- Test API gateway: curl http://localhost:3007/health

📱 Application Features:
======================
✅ Unified login page with SSO options
✅ JWT-based authentication
✅ Single-page application with client-side routing
✅ Real-time dashboard updates via WebSocket
✅ Container tracking interface
✅ Executive analytics dashboard
✅ ROI calculator integration
✅ Role-based access control
✅ Responsive mobile design

🔐 Login Credentials:
===================
Primary Admin:
- Email: mjaiii@rootuip.com
- Password: rootuip2024

Demo Executive:
- Email: demo-executive@rootuip.com
- Password: demo123

Demo Operations:
- Email: demo-operations@rootuip.com
- Password: demo456

EOF

echo ""
echo "✅ Deployment script complete!"
echo "📋 Follow the manual steps above to complete deployment"