#!/bin/bash

# VPS deployment script for rootuip.com
# This script should be run ON YOUR VPS after SSHing into it

echo "=== ROOTUIP VPS Deployment Script ==="
echo "This script will set up your website on the VPS"
echo ""

# Update system
echo "1. Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install nginx if not already installed
echo "2. Installing nginx..."
sudo apt install nginx -y

# Clone or update the repository
echo "3. Setting up website files..."
cd /var/www
if [ -d "ROOTUIP" ]; then
    echo "Repository exists, pulling latest changes..."
    cd ROOTUIP
    git pull
else
    echo "Cloning repository..."
    sudo git clone https://github.com/Empire325Marketing/ROOTUIP.git
    cd ROOTUIP
fi

# Set proper permissions
echo "4. Setting permissions..."
sudo chown -R www-data:www-data /var/www/ROOTUIP
sudo chmod -R 755 /var/www/ROOTUIP

# Configure nginx
echo "5. Configuring nginx..."
sudo bash -c 'cat > /etc/nginx/sites-available/rootuip.com << EOF
server {
    listen 80;
    listen [::]:80;
    
    server_name rootuip.com www.rootuip.com;
    root /var/www/ROOTUIP/ROOTUIP;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF'

# Enable the site
echo "6. Enabling website..."
sudo ln -sf /etc/nginx/sites-available/rootuip.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "7. Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "8. Reloading nginx..."
sudo systemctl reload nginx

# Configure firewall
echo "9. Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Show status
echo ""
echo "=== Deployment Complete! ==="
echo "Your website should now be accessible at:"
echo "  - http://rootuip.com"
echo "  - http://www.rootuip.com"
echo ""
echo "Firewall status:"
sudo ufw status
echo ""
echo "Nginx status:"
sudo systemctl status nginx --no-pager