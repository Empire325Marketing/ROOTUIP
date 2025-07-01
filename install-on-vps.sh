#!/bin/bash

echo "🚀 Installing ROOTUIP on VPS..."

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install system dependencies
apt install -y nginx postgresql postgresql-contrib redis-server certbot python3-certbot-nginx git build-essential

# Install PM2 globally
npm install -g pm2

# Setup PostgreSQL
sudo -u postgres psql << EOF
CREATE USER rootuip WITH PASSWORD 'SecurePass123!';
CREATE DATABASE rootuip_production OWNER rootuip;
GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip;
\q
EOF

# Configure Redis
sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# Setup application directory
cd /var/www/rootuip

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Configure Nginx
cat > /etc/nginx/sites-available/rootuip << 'NGINX'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    root /var/www/rootuip/public;
    index index.html;
    
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Auth Service
    location /auth/ {
        proxy_pass http://localhost:3003/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Demo Platform
    location /demo/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # AI/ML API
    location /ai/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

# Enable Nginx site
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Start PM2 services
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup SSL with Certbot
certbot --nginx -d rootuip.com -d www.rootuip.com --non-interactive --agree-tos --email admin@rootuip.com

echo "✅ Installation complete!"
echo "🌐 Visit https://rootuip.com"
