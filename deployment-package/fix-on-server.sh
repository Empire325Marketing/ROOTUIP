#!/bin/bash
echo "Applying ROOTUIP fixes..."

# Add API endpoints to nginx
sudo tee /etc/nginx/sites-available/rootuip-api.conf > /dev/null < nginx-api-fix.conf

# Include in main config if not already
if ! grep -q "rootuip-api.conf" /etc/nginx/sites-available/app.rootuip.com; then
    sudo sed -i '/server_name/a\    include /etc/nginx/sites-available/rootuip-api.conf;' /etc/nginx/sites-available/app.rootuip.com
fi

# Extract and deploy files if package exists
if [ -f rootuip-complete-deploy.tar.gz ]; then
    echo "Deploying platform files..."
    tar -xzf rootuip-complete-deploy.tar.gz
    sudo cp -r platform/* /var/www/html/platform/ 2>/dev/null
    sudo cp -r assets/* /var/www/html/assets/ 2>/dev/null
    sudo chown -R www-data:www-data /var/www/html/
fi

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Fixes applied! Your platform should now work properly."
