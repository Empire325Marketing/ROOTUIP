#!/bin/bash
# Hostinger Quick Deploy Script
# Run this after fixing SSH

echo "🚀 Hostinger ROOTUIP Deployment"

# Create archive
echo "Creating deployment package..."
cd /home/iii/ROOTUIP
tar -czf /tmp/rootuip-hostinger.tar.gz ROOTUIP/

# Try to connect
echo "Attempting to deploy to Hostinger VPS..."

# Method 1: Try with sshpass
if command -v sshpass &> /dev/null; then
    echo "Using sshpass method..."
    sshpass -p 'SDAasdsa23..dsS' scp -o StrictHostKeyChecking=no /tmp/rootuip-hostinger.tar.gz root@145.223.73.4:/tmp/
    
    sshpass -p 'SDAasdsa23..dsS' ssh -o StrictHostKeyChecking=no root@145.223.73.4 << 'DEPLOY'
# Extract and deploy
cd /tmp
tar -xzf rootuip-hostinger.tar.gz
mkdir -p /var/www/rootuip/public
cp -r ROOTUIP/* /var/www/rootuip/public/
cp -r ROOTUIP/* /var/www/staging-rootuip/public/
cp -r ROOTUIP/platform/* /var/www/app-rootuip/public/ 2>/dev/null || true
chown -R www-data:www-data /var/www/
chmod -R 755 /var/www/

# Configure Nginx
cat > /etc/nginx/sites-available/rootuip << 'EOF'
server {
    listen 80 default_server;
    server_name rootuip.com www.rootuip.com 145.223.73.4;
    root /var/www/rootuip/public;
    index index.html;
    location / { try_files $uri $uri.html $uri/ =404; }
    gzip on;
}

server {
    listen 80;
    server_name staging.rootuip.com;
    root /var/www/staging-rootuip/public;
    auth_basic "Staging";
    auth_basic_user_file /etc/nginx/.htpasswd;
    location / { try_files $uri $uri.html $uri/ =404; }
}

server {
    listen 80;
    server_name app.rootuip.com;
    root /var/www/app-rootuip/public;
    location / { try_files $uri $uri.html $uri/ =404; }
}
EOF

ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
systemctl reload nginx
echo "✅ Deployment complete!"
DEPLOY

else
    echo "sshpass not found. Manual deployment needed."
    echo "Files prepared at: /tmp/rootuip-hostinger.tar.gz"
fi

echo ""
echo "📋 Next Steps:"
echo "1. If deployment failed, use Hostinger's Browser Terminal"
echo "2. Configure DNS in Hostinger hPanel"
echo "3. Your site will be live at rootuip.com"