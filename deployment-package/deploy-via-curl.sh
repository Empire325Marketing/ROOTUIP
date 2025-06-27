#!/bin/bash
# Deploy ROOTUIP via curl commands
# Use this if you have HTTP/FTP access to the server

SERVER_IP="157.173.124.19"
DEPLOY_PATH="/var/www/rootuip"

echo "Attempting deployment via HTTP POST..."
# Try various endpoints that might accept file uploads
for endpoint in upload deploy admin/upload filemanager/upload; do
    echo "Trying endpoint: $endpoint"
    curl -X POST -F "file=@rootuip-complete-deploy.tar.gz" \
         http://$SERVER_IP/$endpoint 2>/dev/null
done

echo "If HTTP upload fails, try FTP:"
echo "ftp $SERVER_IP"
echo "put rootuip-complete-deploy.tar.gz"
echo "put nginx-api-fix.conf"
echo "put fix-on-server.sh"
