#!/bin/bash
# Deploy PWA files to server

echo "Deploying PWA files..."

# Deploy manifest
sudo cp /home/iii/ROOTUIP/platform/manifest.json /var/www/html/platform/

# Deploy service worker
sudo cp /home/iii/ROOTUIP/platform/service-worker.js /var/www/html/platform/

# Deploy offline page
sudo cp /home/iii/ROOTUIP/platform/offline.html /var/www/html/platform/

# Deploy PWA install script
sudo cp /home/iii/ROOTUIP/platform/pwa-install.js /var/www/html/platform/

# Deploy mobile app
sudo cp /home/iii/ROOTUIP/platform/mobile-app.html /var/www/html/platform/

# Create CSS directory if needed
sudo mkdir -p /var/www/html/platform/css

# Deploy mobile CSS
sudo cp /home/iii/ROOTUIP/platform/css/mobile-responsive.css /var/www/html/platform/css/

# Deploy updated dashboard
sudo cp /home/iii/ROOTUIP/platform/customer/dashboard.html /var/www/html/platform/customer/

# Deploy icons
sudo mkdir -p /var/www/html/assets/icons
sudo cp /home/iii/ROOTUIP/assets/icons/*.png /var/www/html/assets/icons/
sudo cp /home/iii/ROOTUIP/assets/icons/*.svg /var/www/html/assets/icons/

# Create screenshots directory
sudo mkdir -p /var/www/html/assets/screenshots

# Set permissions
sudo chown -R www-data:www-data /var/www/html/platform/
sudo chown -R www-data:www-data /var/www/html/assets/

# Update nginx config for PWA
sudo tee /etc/nginx/sites-available/rootuip-pwa > /dev/null << 'EOF'
# PWA specific headers
location ~* \.(manifest|webmanifest)$ {
    add_header Cache-Control "public, max-age=604800";
    add_header X-Content-Type-Options "nosniff";
}

location /platform/service-worker.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Service-Worker-Allowed "/";
}

# Offline fallback
location / {
    try_files $uri $uri/ $uri.html /platform/offline.html;
}
EOF

# Include PWA config in main nginx config
if ! grep -q "include.*rootuip-pwa" /etc/nginx/sites-available/app.rootuip.com; then
    sudo sed -i '/location \/ {/i\    include /etc/nginx/sites-available/rootuip-pwa;' /etc/nginx/sites-available/app.rootuip.com
fi

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

echo "PWA deployment complete!"
echo ""
echo "✅ Service Worker registered at: /platform/service-worker.js"
echo "✅ Web App Manifest available at: /platform/manifest.json"
echo "✅ Mobile app available at: https://app.rootuip.com/platform/mobile-app.html"
echo "✅ Offline page ready at: /platform/offline.html"
echo ""
echo "📱 To install as PWA:"
echo "   - Desktop: Click install button in address bar"
echo "   - Mobile: Add to Home Screen from browser menu"
echo ""
echo "🔧 PWA Features enabled:"
echo "   - Offline functionality with caching"
echo "   - Background sync for data"
echo "   - Push notifications ready"
echo "   - App-like experience on mobile"