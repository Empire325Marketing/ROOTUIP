#!/bin/bash

# PWA Deployment Script using rsync
# This script deploys PWA files to the server at 157.173.124.19

SERVER="157.173.124.19"
USER="iii"
REMOTE_BASE="/var/www/html"

echo "Starting PWA deployment to $USER@$SERVER using rsync..."

# Create necessary directories on the server
echo "Creating directories on server..."
ssh $USER@$SERVER "mkdir -p $REMOTE_BASE/platform $REMOTE_BASE/platform/css $REMOTE_BASE/platform/customer $REMOTE_BASE/assets/icons"

# Deploy files using rsync (more efficient and reliable)
echo "Deploying platform files..."
rsync -avz --progress \
  /home/iii/ROOTUIP/platform/manifest.json \
  /home/iii/ROOTUIP/platform/service-worker.js \
  /home/iii/ROOTUIP/platform/offline.html \
  /home/iii/ROOTUIP/platform/pwa-install.js \
  /home/iii/ROOTUIP/platform/mobile-app.html \
  $USER@$SERVER:$REMOTE_BASE/platform/

echo "Deploying CSS files..."
rsync -avz --progress \
  /home/iii/ROOTUIP/platform/css/mobile-responsive.css \
  $USER@$SERVER:$REMOTE_BASE/platform/css/

echo "Deploying customer dashboard..."
rsync -avz --progress \
  /home/iii/ROOTUIP/platform/customer/dashboard.html \
  $USER@$SERVER:$REMOTE_BASE/platform/customer/

echo "Deploying icons..."
rsync -avz --progress \
  --include="*.png" \
  --include="*.svg" \
  --exclude="*" \
  /home/iii/ROOTUIP/assets/icons/ \
  $USER@$SERVER:$REMOTE_BASE/assets/icons/

echo "PWA deployment completed!"