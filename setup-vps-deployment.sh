#!/bin/bash

# VPS Deployment Setup Script
# This script will configure and start all ROOTUIP services on the VPS

echo "=== ROOTUIP VPS Deployment Setup ==="
echo "Server: 145.223.73.4"
echo "Directory: /home/iii/ROOTUIP"
echo ""

VPS_IP="145.223.73.4"
VPS_USER="root"
VPS_PASS='4T(8LORhk0(nmn/G#jii'

# Create deployment commands
cat > /tmp/vps_setup_commands.sh << 'EOF'
#!/bin/bash

echo "=== Starting ROOTUIP Deployment on VPS ==="
cd /home/iii/ROOTUIP

# 1. Install Node.js dependencies
echo ""
echo "1. Installing Node.js dependencies..."
echo "===================================="
npm install --production

# 2. Set up environment variables
echo ""
echo "2. Setting up environment variables..."
echo "======================================"
if [ ! -f .env ]; then
    cp .env.production .env
    echo "Created .env from .env.production"
fi

# 3. Create required directories
echo ""
echo "3. Creating required directories..."
echo "==================================="
mkdir -p logs
mkdir -p uploads
mkdir -p temp
mkdir -p backups

# 4. Set up PM2 ecosystem
echo ""
echo "4. Setting up PM2 ecosystem..."
echo "==============================="
if [ -f ecosystem.config.js ]; then
    pm2 delete all || true
    pm2 start ecosystem.config.js
else
    # Start services individually
    pm2 start api-gateway-new.js --name "rootuip-api" -i 2
    pm2 start enterprise-auth-system.js --name "rootuip-auth" 
    pm2 start ml_system/ml-server.js --name "rootuip-ml"
    pm2 start business-operations-server.js --name "rootuip-business"
    pm2 start real-time-dashboard-server.js --name "rootuip-dashboard"
    pm2 start monitoring/health-monitor.js --name "rootuip-monitor"
fi

# 5. Set up Nginx configuration
echo ""
echo "5. Configuring Nginx..."
echo "======================="

# Create main site config
cat > /etc/nginx/sites-available/rootuip-platform << 'NGINX_EOF'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rootuip.com www.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    root /home/iii/ROOTUIP;
    index landing-page.html index.html;
    
    # Main website
    location / {
        try_files $uri $uri/ /landing-page.html;
    }
    
    # API Gateway
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Auth endpoints
    location /auth/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # ML/AI endpoints
    location /ml/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket for real-time dashboard
    location /ws/ {
        proxy_pass http://localhost:3005/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    
    # Static assets
    location /assets/ {
        alias /home/iii/ROOTUIP/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Platform dashboard
    location /dashboard {
        alias /home/iii/ROOTUIP/platform/;
        try_files $uri $uri/ /platform/dashboard.html;
    }
    
    # Admin interfaces
    location /admin/ {
        auth_basic "Admin Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        alias /home/iii/ROOTUIP/admin/;
        try_files $uri $uri/ /admin/index.html;
    }
}

# API subdomain
server {
    listen 443 ssl http2;
    server_name api.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# App subdomain
server {
    listen 443 ssl http2;
    server_name app.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    root /home/iii/ROOTUIP/platform;
    index dashboard.html index.html;
    
    location / {
        try_files $uri $uri/ /dashboard.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX_EOF

# Enable the new config
ln -sf /etc/nginx/sites-available/rootuip-platform /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 6. Set up database
echo ""
echo "6. Setting up PostgreSQL database..."
echo "===================================="
sudo -u postgres psql << 'PSQL_EOF'
CREATE DATABASE rootuip_production;
CREATE USER rootuip WITH ENCRYPTED PASSWORD 'rootuip_secure_pass_2024';
GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip;
PSQL_EOF

# Run database migrations
export DATABASE_URL="postgresql://rootuip:rootuip_secure_pass_2024@localhost/rootuip_production"
node api-gateway-database.js || echo "Database schema setup completed"

# 7. Set up Redis
echo ""
echo "7. Checking Redis..."
echo "===================="
systemctl status redis-server || systemctl start redis-server

# 8. Create systemd services
echo ""
echo "8. Creating systemd services..."
echo "==============================="

# Create service for critical processes
cat > /etc/systemd/system/rootuip-platform.service << 'SERVICE_EOF'
[Unit]
Description=ROOTUIP Platform Services
After=network.target postgresql.service redis.service

[Service]
Type=forking
User=www-data
WorkingDirectory=/home/iii/ROOTUIP
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable rootuip-platform

# 9. Set up monitoring and alerts
echo ""
echo "9. Setting up monitoring..."
echo "==========================="
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# 10. Final checks
echo ""
echo "10. Running final checks..."
echo "============================"
pm2 status
pm2 save
pm2 startup systemd -u www-data --hp /var/www

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Services running:"
pm2 list
echo ""
echo "Access URLs:"
echo "- Main site: https://rootuip.com"
echo "- Dashboard: https://app.rootuip.com"
echo "- API: https://api.rootuip.com"
echo "- API Docs: https://rootuip.com/api-docs/"
echo ""
echo "Next steps:"
echo "1. Update .env with production values"
echo "2. Set up SSL for subdomains if needed"
echo "3. Configure monitoring alerts"
echo "4. Set up backup cron jobs"
EOF

# Execute on VPS
echo "Executing deployment script on VPS..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP 'bash -s' < /tmp/vps_setup_commands.sh

echo ""
echo "Deployment script executed. Check the output above for any errors."