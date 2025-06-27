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
