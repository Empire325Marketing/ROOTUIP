#!/bin/bash

echo "Deploying PWA files..."

# Create local package
cd /home/iii/ROOTUIP
tar -czf pwa-deploy.tar.gz \
    platform/manifest.json \
    platform/service-worker.js \
    platform/offline.html \
    platform/pwa-install.js \
    platform/mobile-app.html \
    platform/css/mobile-responsive.css \
    platform/customer/dashboard.html \
    assets/icons/*.png \
    assets/icons/*.svg

# Try deployment with timeout
timeout 30 scp pwa-deploy.tar.gz iii@157.173.124.19:~/ && echo "Upload successful" || echo "Upload failed"

# Create extraction script
cat > extract-pwa.sh << 'EOF'
#!/bin/bash
cd ~
tar -xzf pwa-deploy.tar.gz
sudo mkdir -p /var/www/html/platform/css
sudo mkdir -p /var/www/html/assets/icons
sudo cp platform/*.json /var/www/html/platform/
sudo cp platform/*.js /var/www/html/platform/
sudo cp platform/*.html /var/www/html/platform/
sudo cp platform/css/*.css /var/www/html/platform/css/
sudo cp platform/customer/dashboard.html /var/www/html/platform/customer/
sudo cp assets/icons/*.png /var/www/html/assets/icons/
sudo cp assets/icons/*.svg /var/www/html/assets/icons/
sudo chown -R www-data:www-data /var/www/html/platform/
sudo chown -R www-data:www-data /var/www/html/assets/
echo "PWA deployment complete!"
EOF

# Try to copy extraction script
timeout 30 scp extract-pwa.sh iii@157.173.124.19:~/ && echo "Script upload successful" || echo "Script upload failed"

echo "Deployment package created: pwa-deploy.tar.gz"
echo "Extraction script created: extract-pwa.sh"
echo ""
echo "To complete deployment manually:"
echo "1. Copy pwa-deploy.tar.gz to server"
echo "2. Copy extract-pwa.sh to server"
echo "3. SSH to server and run: ./extract-pwa.sh"