#!/bin/bash

echo "=== PUSHING ENTIRE ROOTUIP PROJECT TO VPS ==="
echo "From: /home/iii/ROOTUIP"
echo "To: root@145.223.73.4:/home/iii/ROOTUIP"
echo ""

# VPS credentials
VPS_IP="145.223.73.4"
VPS_USER="root"
VPS_PASS='4T(8LORhk0(nmn/G#jii'

# Create the directory on VPS first
echo "Creating /home/iii/ROOTUIP directory on VPS..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "mkdir -p /home/iii/ROOTUIP"

# Use rsync to push everything
echo ""
echo "Starting rsync transfer..."
echo "This will transfer 79,150 files..."
echo ""

# Rsync with progress, excluding .git if needed
sshpass -p "$VPS_PASS" rsync -avz --progress \
    --exclude 'node_modules/*/node_modules' \
    --exclude '.git/objects' \
    --stats \
    /home/iii/ROOTUIP/ \
    $VPS_USER@$VPS_IP:/home/iii/ROOTUIP/

echo ""
echo "=== TRANSFER COMPLETE ==="
echo ""

# Verify the transfer
echo "Verifying transfer on VPS..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "
    echo 'Files transferred to VPS:'
    echo '======================='
    find /home/iii/ROOTUIP -type f | wc -l
    echo ''
    echo 'Directory structure:'
    ls -la /home/iii/ROOTUIP/ | head -20
    echo ''
    echo 'Key files verified:'
    ls -la /home/iii/ROOTUIP/*.js | head -10
"

echo ""
echo "All files have been pushed to VPS at /home/iii/ROOTUIP"
echo "Next steps:"
echo "1. SSH into VPS: ssh root@145.223.73.4"
echo "2. Navigate to: cd /home/iii/ROOTUIP"
echo "3. Install dependencies: npm install"
echo "4. Set up services and deploy"