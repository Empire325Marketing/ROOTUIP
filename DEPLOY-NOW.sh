#!/bin/bash

# ROOTUIP Complete Deployment Script
# This script will deploy everything to production

echo "🚀 ROOTUIP PRODUCTION DEPLOYMENT"
echo "================================"
echo "Target VPS: 167.71.93.182"
echo "Domain: rootuip.com"
echo ""

# Check if we can SSH to VPS
echo "📡 Testing VPS connection..."
echo "Please ensure you have SSH access to root@167.71.93.182"
echo ""
echo "Press ENTER to continue or Ctrl+C to cancel..."
read

# Create final deployment package
echo "📦 Creating deployment package..."

cd /home/iii/ROOTUIP

# Ensure all files are ready
echo "✓ Creating final structure..."

# Create package tarball
tar czf /tmp/rootuip-final.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='*.sqlite' \
    --exclude='*.bak' \
    .

echo "✅ Package created: /tmp/rootuip-final.tar.gz"
echo ""

# Create automated VPS setup script
cat > /tmp/vps-autosetup.sh << 'VPSAUTO'
#!/bin/bash

echo "🚀 ROOTUIP VPS Automated Setup"
echo "============================="

# Step 1: System Updates
echo "📦 Step 1: Updating system packages..."
apt update && apt upgrade -y

# Step 2: Install Node.js
echo "🟢 Step 2: Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Step 3: Install System Dependencies
echo "📦 Step 3: Installing dependencies..."
apt install -y nginx postgresql postgresql-contrib redis-server certbot python3-certbot-nginx git build-essential

# Step 4: Install PM2
echo "🔧 Step 4: Installing PM2..."
npm install -g pm2

# Step 5: Setup PostgreSQL
echo "🗄️ Step 5: Setting up PostgreSQL..."
sudo -u postgres psql << 'PSQL'
CREATE USER rootuip WITH PASSWORD 'SecurePass123!';
CREATE DATABASE rootuip_production OWNER rootuip;
GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip;
\q
PSQL

# Step 6: Configure Redis
echo "🔴 Step 6: Configuring Redis..."
sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# Step 7: Extract Application
echo "📁 Step 7: Setting up application..."
cd /var/www
rm -rf rootuip
mkdir -p rootuip
cd rootuip
tar xzf /tmp/rootuip-final.tar.gz

# Step 8: Install Dependencies
echo "📦 Step 8: Installing Node.js dependencies..."
npm install --production

# Step 9: Configure Nginx
echo "🌐 Step 9: Configuring Nginx..."
cat > /etc/nginx/sites-available/rootuip << 'NGINX'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    root /var/www/rootuip/public;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
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
    }
    
    # Auth Service
    location /auth/ {
        proxy_pass http://localhost:3003/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Demo Platform
    location /demo/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    # AI/ML API
    location /ai/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/xml+rss application/json;
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx
nginx -t

# Reload Nginx
systemctl reload nginx

# Step 10: Start PM2 Services
echo "🚀 Step 10: Starting application services..."
cd /var/www/rootuip
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Step 11: Setup SSL
echo "🔒 Step 11: Setting up SSL certificates..."
certbot --nginx -d rootuip.com -d www.rootuip.com --non-interactive --agree-tos --email admin@rootuip.com --redirect

# Step 12: Final checks
echo "✅ Step 12: Running final checks..."
pm2 list
systemctl status nginx
systemctl status redis-server
systemctl status postgresql

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================"
echo "✅ Application URL: https://rootuip.com"
echo "✅ API Gateway: https://rootuip.com/api/"
echo "✅ Demo Platform: https://rootuip.com/demo/"
echo "✅ WebSocket: wss://rootuip.com/socket.io/"
echo ""
echo "📊 Services Status:"
pm2 status
echo ""
echo "🔍 To monitor logs: pm2 logs"
echo "🔄 To restart services: pm2 restart all"
echo ""
VPSAUTO

# Make script executable
chmod +x /tmp/vps-autosetup.sh

echo "📋 DEPLOYMENT INSTRUCTIONS"
echo "========================="
echo ""
echo "Option 1: Manual Deployment (Recommended)"
echo "-----------------------------------------"
echo "1. Copy files to VPS:"
echo "   scp /tmp/rootuip-final.tar.gz root@167.71.93.182:/tmp/"
echo "   scp /tmp/vps-autosetup.sh root@167.71.93.182:/tmp/"
echo ""
echo "2. SSH to VPS and run setup:"
echo "   ssh root@167.71.93.182"
echo "   chmod +x /tmp/vps-autosetup.sh"
echo "   /tmp/vps-autosetup.sh"
echo ""
echo "Option 2: One-Command Deployment"
echo "---------------------------------"
echo "Run this command to deploy everything:"
echo ""
echo "scp /tmp/rootuip-final.tar.gz /tmp/vps-autosetup.sh root@167.71.93.182:/tmp/ && ssh root@167.71.93.182 'chmod +x /tmp/vps-autosetup.sh && /tmp/vps-autosetup.sh'"
echo ""
echo "⏱️ Estimated deployment time: 15-20 minutes"
echo ""
echo "After deployment, your platform will be available at:"
echo "🌐 https://rootuip.com"
echo ""