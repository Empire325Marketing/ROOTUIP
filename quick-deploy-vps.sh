#!/bin/bash

echo "=== Quick ROOTUIP VPS Deployment ==="
echo ""

VPS_IP="145.223.73.4"
VPS_USER="root"
VPS_PASS='4T(8LORhk0(nmn/G#jii'

# Execute deployment commands on VPS
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP << 'EOF'
cd /home/iii/ROOTUIP

echo "1. Installing core dependencies..."
npm install express body-parser cors dotenv jsonwebtoken bcryptjs pg redis express-rate-limit

echo ""
echo "2. Starting core services with PM2..."
pm2 delete all 2>/dev/null || true

# Start API Gateway
pm2 start api-gateway-new.js --name "rootuip-api" --env production

# Start Auth Service  
pm2 start enterprise-auth-system.js --name "rootuip-auth" --env production

# Start Business Operations
pm2 start business-operations-server.js --name "rootuip-business" --env production

# Save PM2 config
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "3. Setting up Nginx for main site..."

# Update main nginx config
cat > /etc/nginx/sites-available/rootuip-main << 'NGINX_EOF'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    root /home/iii/ROOTUIP;
    index landing-page.html index.html;
    
    location / {
        try_files $uri $uri/ /landing-page.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /auth/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /assets/ {
        alias /home/iii/ROOTUIP/assets/;
        expires 30d;
    }
    
    location /platform/ {
        alias /home/iii/ROOTUIP/platform/;
        try_files $uri $uri/ /platform/dashboard.html;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/rootuip-main /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "4. Services Status:"
pm2 status

echo ""
echo "=== QUICK DEPLOYMENT COMPLETE ==="
echo "Main site: http://rootuip.com"
echo "API endpoint: http://rootuip.com/api/"
echo "Platform: http://rootuip.com/platform/"
echo ""
echo "To check logs: pm2 logs"
echo "To monitor: pm2 monit"
EOF