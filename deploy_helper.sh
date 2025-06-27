#!/bin/bash
# Helper script to run on VPS for HTTP-based deployment

echo "Downloading ROOTUIP from local server..."
cd /var/www/html

# Backup current site
if [ -f index.html ]; then
    tar -czf "/tmp/backup-$(date +%Y%m%d-%H%M%S).tar.gz" . 2>/dev/null || true
fi

# Download and extract
wget -O /tmp/rootuip-production.tar.gz "http://$1:8000/rootuip-production-20250625-174659.tar.gz"
rm -rf *
tar -xzf /tmp/rootuip-production.tar.gz

# Set permissions
chown -R www-data:www-data .
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;

# Reload web server
systemctl reload nginx || systemctl reload apache2

echo "Deployment completed via HTTP transfer!"
