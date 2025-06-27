#!/bin/bash
# ROOTUIP Manual Deployment Script
# Run this on your server after uploading rootuip-deploy.tar.gz

echo "=== ROOTUIP Server Setup for rootuip.com ==="

# 1. Extract files
echo "1. Extracting files..."
cd /tmp
tar -xzf rootuip-deploy.tar.gz

# 2. Deploy to web root
echo "2. Deploying to web root..."
mkdir -p /var/www/rootuip/public
mkdir -p /var/www/staging-rootuip/public
mkdir -p /var/www/app-rootuip/public

# Copy all files
cp -r ROOTUIP/* /var/www/rootuip/public/
cp -r ROOTUIP/* /var/www/staging-rootuip/public/

# Copy platform to app subdomain
if [ -d "ROOTUIP/platform" ]; then
    cp -r ROOTUIP/platform/* /var/www/app-rootuip/public/
fi

# 3. Set permissions
echo "3. Setting permissions..."
chown -R www-data:www-data /var/www/rootuip
chown -R www-data:www-data /var/www/staging-rootuip
chown -R www-data:www-data /var/www/app-rootuip
chmod -R 755 /var/www/rootuip
chmod -R 755 /var/www/staging-rootuip
chmod -R 755 /var/www/app-rootuip

# 4. Configure Nginx
echo "4. Configuring Nginx..."
cat > /etc/nginx/sites-available/rootuip.com << 'EOF'
# Main site and IP redirect
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name rootuip.com www.rootuip.com 145.223.73.4;
    
    root /var/www/rootuip/public;
    index index.html;
    
    # Clean URLs
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/json;
}

# Staging subdomain
server {
    listen 80;
    listen [::]:80;
    server_name staging.rootuip.com;
    
    root /var/www/staging-rootuip/public;
    index index.html;
    
    # Basic auth
    auth_basic "Staging Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
}

# App subdomain
server {
    listen 80;
    listen [::]:80;
    server_name app.rootuip.com;
    
    root /var/www/app-rootuip/public;
    index index.html dashboard.html;
    
    location / {
        try_files $uri $uri.html $uri/ /dashboard.html =404;
    }
}

# Monitoring subdomain
server {
    listen 80;
    listen [::]:80;
    server_name monitoring.rootuip.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
    }
}
EOF

# 5. Create staging password
echo "5. Creating staging password..."
if [ ! -f /etc/nginx/.htpasswd ]; then
    apt-get install -y apache2-utils
    echo 'staging:$apr1$8K4Ak0gF$L5LmzXLfDdPmY6WR8nxXE1' > /etc/nginx/.htpasswd
fi

# 6. Enable site
echo "6. Enabling site..."
ln -sf /etc/nginx/sites-available/rootuip.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 7. Test and reload
echo "7. Testing configuration..."
nginx -t && systemctl reload nginx

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "DNS Configuration Required:"
echo "A    @            145.223.73.4    300"
echo "A    www          145.223.73.4    300"
echo "A    staging      145.223.73.4    300"
echo "A    app          145.223.73.4    300"
echo "A    monitoring   145.223.73.4    300"
echo ""
echo "Access: http://145.223.73.4/ or http://rootuip.com (after DNS)"
echo "Staging: user=staging, pass=demo123"
echo ""
echo "For SSL: certbot --nginx -d rootuip.com -d www.rootuip.com -d staging.rootuip.com -d app.rootuip.com -d monitoring.rootuip.com"