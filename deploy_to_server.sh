#!/bin/bash
# Quick deploy script for ROOTUIP

echo "🚀 Deploying ROOTUIP to server..."

# Create archive
tar -czf rootuip-latest.tar.gz ROOTUIP/

# Upload to server
echo "Uploading files..."
sshpass -p 'test123' scp rootuip-latest.tar.gz root@145.223.73.4:/tmp/

# Deploy on server
echo "Deploying..."
sshpass -p 'test123' ssh root@145.223.73.4 '/root/fast-deploy.sh'

echo "✅ Deployment complete!"
echo "View at: http://rootuip.com"

# Cleanup
rm rootuip-latest.tar.gz