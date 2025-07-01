#!/bin/bash

VPS_IP="145.223.73.4"
VPS_USER="root"
VPS_PASS='4T(8LORhk0(nmn/G#jii'

sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP << 'DEPLOY_EOF'
cd /home/iii/ROOTUIP

echo "Installing missing dependencies..."
npm install speakeasy qrcode express-session connect-redis

echo ""
echo "Starting minimal services..."
pm2 delete all 2>/dev/null || true

# Just start the API gateway for now
pm2 start api-gateway-new.js --name "rootuip-api" -i 2

# Create a simple server for static files
cat > simple-static-server.js << 'JS_EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing-page.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'platform/dashboard.html'));
});

app.listen(8080, () => {
    console.log('Static server running on port 8080');
});
JS_EOF

pm2 start simple-static-server.js --name "rootuip-static"

# Update nginx to use the static server
cat > /etc/nginx/sites-available/rootuip-simple << 'NGINX_EOF'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX_EOF

# Enable the simple config
rm -f /etc/nginx/sites-enabled/rootuip*
ln -sf /etc/nginx/sites-available/rootuip-simple /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

pm2 save

echo ""
echo "=== DEPLOYMENT STATUS ==="
pm2 list
echo ""
echo "Site should be accessible at: http://rootuip.com"
echo ""

# Test the deployment
echo "Testing deployment..."
curl -I http://localhost:8080
DEPLOY_EOF