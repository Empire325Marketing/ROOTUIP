#!/bin/bash

# PWA Deployment Script
# This script deploys PWA files to the server at 157.173.124.19

SERVER="157.173.124.19"
USER="iii"
REMOTE_BASE="/var/www/html"

echo "Starting PWA deployment to $USER@$SERVER..."

# Create necessary directories on the server
echo "Creating directories on server..."
ssh $USER@$SERVER "mkdir -p $REMOTE_BASE/platform $REMOTE_BASE/platform/css $REMOTE_BASE/platform/customer $REMOTE_BASE/assets/icons"

# Deploy individual files
echo "Deploying manifest.json..."
scp /home/iii/ROOTUIP/platform/manifest.json $USER@$SERVER:$REMOTE_BASE/platform/

echo "Deploying service-worker.js..."
scp /home/iii/ROOTUIP/platform/service-worker.js $USER@$SERVER:$REMOTE_BASE/platform/

echo "Deploying offline.html..."
scp /home/iii/ROOTUIP/platform/offline.html $USER@$SERVER:$REMOTE_BASE/platform/

echo "Deploying pwa-install.js..."
scp /home/iii/ROOTUIP/platform/pwa-install.js $USER@$SERVER:$REMOTE_BASE/platform/

echo "Deploying mobile-app.html..."
scp /home/iii/ROOTUIP/platform/mobile-app.html $USER@$SERVER:$REMOTE_BASE/platform/

echo "Deploying mobile-responsive.css..."
scp /home/iii/ROOTUIP/platform/css/mobile-responsive.css $USER@$SERVER:$REMOTE_BASE/platform/css/

echo "Deploying customer dashboard.html..."
scp /home/iii/ROOTUIP/platform/customer/dashboard.html $USER@$SERVER:$REMOTE_BASE/platform/customer/

# Deploy all PNG and SVG files from assets/icons
echo "Deploying PNG and SVG icons..."
scp /home/iii/ROOTUIP/assets/icons/*.png $USER@$SERVER:$REMOTE_BASE/assets/icons/ 2>/dev/null
scp /home/iii/ROOTUIP/assets/icons/*.svg $USER@$SERVER:$REMOTE_BASE/assets/icons/ 2>/dev/null

echo "PWA deployment completed!"