#!/bin/bash

# Single upload deployment script for ROOTUIP fixes
echo "📦 Creating deployment package..."
cd /home/iii/ROOTUIP

# Create archive with all fixes
tar -czf rootuip_fixes.tar.gz \
    ROOTUIP/css/ \
    ROOTUIP/brand/ \
    ROOTUIP/js/ \
    ROOTUIP/lead-generation/ \
    ROOTUIP/index.html

echo "🚀 Uploading fixes to server..."
sshpass -p 'SDAasdsa23..dsS' scp -o StrictHostKeyChecking=no rootuip_fixes.tar.gz root@145.223.73.4:/tmp/

echo "📂 Extracting and deploying on server..."
sshpass -p 'SDAasdsa23..dsS' ssh -o StrictHostKeyChecking=no root@145.223.73.4 << 'EOF'
cd /tmp
tar -xzf rootuip_fixes.tar.gz

# Backup current files
cd /var/www/rootuip/public
cp index.html index.html.backup.$(date +%s) 2>/dev/null || true

# Deploy fixes
cp -r /tmp/ROOTUIP/css/* ./css/ 2>/dev/null || cp -r /tmp/ROOTUIP/css ./
cp -r /tmp/ROOTUIP/brand/* ./brand/ 2>/dev/null || cp -r /tmp/ROOTUIP/brand ./
cp -r /tmp/ROOTUIP/js/* ./js/ 2>/dev/null || cp -r /tmp/ROOTUIP/js ./
cp -r /tmp/ROOTUIP/lead-generation/* ./lead-generation/ 2>/dev/null || cp -r /tmp/ROOTUIP/lead-generation ./
cp /tmp/ROOTUIP/index.html ./

# Set permissions
chmod -R 755 .
chown -R www-data:www-data .

# Cleanup
rm -f /tmp/rootuip_fixes.tar.gz
rm -rf /tmp/ROOTUIP/

echo "✅ Deployment complete!"
EOF

echo "🎉 All fixes deployed successfully!"
echo "🌐 Visit https://rootuip.com to see the fixes"