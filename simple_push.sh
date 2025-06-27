#!/bin/bash

echo "=== Simple ROOTUIP Push to VPS ==="

# Create tar archive
echo "Creating archive..."
cd /home/iii/ROOTUIP
tar -czf /tmp/rootuip.tar.gz ROOTUIP/

# Create simple deployment script
cat > /tmp/simple_deploy.sh << 'EOF'
#!/bin/bash
echo "Deploying ROOTUIP..."
cd /tmp
tar -xzf rootuip.tar.gz
mkdir -p /var/www/rootuip/public
cp -r ROOTUIP/* /var/www/rootuip/public/
chown -R www-data:www-data /var/www/rootuip
echo "Files deployed to /var/www/rootuip/public"

# Configure Nginx
cat > /etc/nginx/sites-available/rootuip << 'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name rootuip.com www.rootuip.com 145.223.73.4;
    root /var/www/rootuip/public;
    index index.html;
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "Nginx configured for rootuip.com"
EOF

# Push to server
echo "Pushing to server..."
sshpass -p 'SDAasdsa23..dsS' scp -o StrictHostKeyChecking=no /tmp/rootuip.tar.gz /tmp/simple_deploy.sh root@145.223.73.4:/tmp/

echo "Executing deployment..."
sshpass -p 'SDAasdsa23..dsS' ssh -o StrictHostKeyChecking=no root@145.223.73.4 'bash /tmp/simple_deploy.sh'

echo "Done! Server configured for rootuip.com"
echo "Access at: http://145.223.73.4/ or http://rootuip.com (after DNS)"