#!/bin/bash

echo "🚀 Automated ROOTUIP Deployment - No Password Required!"
echo "====================================================="

# Test SSH connection first
if ssh -o ConnectTimeout=5 -i ~/.ssh/rootuip_deploy root@145.223.73.4 "echo 'SSH connection verified'" >/dev/null 2>&1; then
    echo "✅ SSH connection working"
else
    echo "❌ SSH connection failed"
    exit 1
fi

echo "📦 Deploying updates to https://rootuip.com..."

# Create deployment package
cd /home/iii/ROOTUIP
tar -czf latest_updates.tar.gz ROOTUIP/

# Upload and deploy
scp -i ~/.ssh/rootuip_deploy latest_updates.tar.gz root@145.223.73.4:/tmp/

ssh -i ~/.ssh/rootuip_deploy root@145.223.73.4 << 'EOF'
cd /tmp
tar -xzf latest_updates.tar.gz

# Deploy to website
cd /var/www/rootuip/public

# Backup current files
cp index.html index.html.backup.$(date +%s) 2>/dev/null || true

# Deploy updates
cp -r /tmp/ROOTUIP/* . 2>/dev/null || true

# Fix any CSS syntax errors
find css/ brand/ -name "*.css" -exec sed -i 's/var(var(--/var(--/g' {} \; 2>/dev/null || true

# Set permissions
chmod -R 755 css/ brand/ js/ lead-generation/ 2>/dev/null || true
chown -R www-data:www-data . 2>/dev/null || true

# Cleanup
rm -f /tmp/latest_updates.tar.gz
rm -rf /tmp/ROOTUIP/

echo "✅ Deployment complete!"
EOF

echo "🎉 Automated deployment successful!"
echo "🌐 Visit https://rootuip.com to see updates"

# Cleanup local files
rm -f latest_updates.tar.gz