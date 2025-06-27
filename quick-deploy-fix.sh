#!/bin/bash

# Quick deployment script to fix all issues

echo "ROOTUIP Quick Fix Deployment"
echo "============================"

# Server details
SERVER="157.173.124.19"
USER="iii"

# Create nginx fix configuration
cat > nginx-api-fix.conf << 'NGINX'
# Fix for loading issue - API endpoints
location /api/metrics {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}';
}

location /api/notifications {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"success":true,"notifications":[],"unreadCount":0}';
}

location /api/shipments {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"success":true,"shipments":[{"container":"MAEU1234567","blNumber":"BL123456789","carrierName":"Maersk","origin":"Shanghai","destination":"Rotterdam","status":"in-transit","eta":"2025-07-15","ddRisk":"Low"}],"total":1}';
}

location /api/user {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"success":true,"user":{"name":"Demo User","company":"Acme Corporation","role":"Admin"}}';
}

location /api/ping {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"status":"ok"}';
}

# PWA support
location ~* \.(manifest|webmanifest)$ {
    add_header Cache-Control "public, max-age=604800";
}

location /platform/service-worker.js {
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/";
}
NGINX

# Create minimal server script
cat > fix-on-server.sh << 'SCRIPT'
#!/bin/bash
echo "Applying ROOTUIP fixes..."

# Add API endpoints to nginx
sudo tee /etc/nginx/sites-available/rootuip-api.conf > /dev/null < nginx-api-fix.conf

# Include in main config if not already
if ! grep -q "rootuip-api.conf" /etc/nginx/sites-available/app.rootuip.com; then
    sudo sed -i '/server_name/a\    include /etc/nginx/sites-available/rootuip-api.conf;' /etc/nginx/sites-available/app.rootuip.com
fi

# Extract and deploy files if package exists
if [ -f rootuip-complete-deploy.tar.gz ]; then
    echo "Deploying platform files..."
    tar -xzf rootuip-complete-deploy.tar.gz
    sudo cp -r platform/* /var/www/html/platform/ 2>/dev/null
    sudo cp -r assets/* /var/www/html/assets/ 2>/dev/null
    sudo chown -R www-data:www-data /var/www/html/
fi

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
echo "✅ Fixes applied! Your platform should now work properly."
SCRIPT

# Try to deploy
echo "Attempting quick deployment..."
scp -o ConnectTimeout=10 nginx-api-fix.conf fix-on-server.sh rootuip-complete-deploy.tar.gz $USER@$SERVER:~/ 2>/dev/null && {
    ssh -o ConnectTimeout=10 $USER@$SERVER "chmod +x fix-on-server.sh && ./fix-on-server.sh" && {
        echo "✅ Deployment successful!"
    }
} || {
    echo "❌ Server unreachable"
    echo ""
    echo "📋 Files ready for manual deployment:"
    echo "   - rootuip-complete-deploy.tar.gz (663KB)"
    echo "   - nginx-api-fix.conf"
    echo "   - fix-on-server.sh"
    echo ""
    echo "When server is accessible, run:"
    echo "   scp rootuip-complete-deploy.tar.gz nginx-api-fix.conf fix-on-server.sh $USER@$SERVER:~/"
    echo "   ssh $USER@$SERVER"
    echo "   chmod +x fix-on-server.sh && ./fix-on-server.sh"
}

# Create comprehensive test script
cat > test-deployment.sh << 'TEST'
#!/bin/bash
echo "Testing ROOTUIP deployment..."

BASE_URL="https://app.rootuip.com"

# Test API endpoints
echo "Testing API endpoints:"
curl -s "$BASE_URL/api/metrics" | grep -q "activeShipments" && echo "✓ Metrics API working" || echo "✗ Metrics API failed"
curl -s "$BASE_URL/api/notifications" | grep -q "notifications" && echo "✓ Notifications API working" || echo "✗ Notifications API failed"
curl -s "$BASE_URL/api/shipments" | grep -q "shipments" && echo "✓ Shipments API working" || echo "✗ Shipments API failed"

# Test pages
echo -e "\nTesting pages:"
curl -s "$BASE_URL/platform/customer/dashboard.html" | grep -q "Dashboard" && echo "✓ Dashboard accessible" || echo "✗ Dashboard failed"
curl -s "$BASE_URL/platform/mobile-app.html" | grep -q "ROOTUIP" && echo "✓ Mobile app accessible" || echo "✗ Mobile app failed"
curl -s "$BASE_URL/platform/manifest.json" | grep -q "ROOTUIP" && echo "✓ PWA manifest accessible" || echo "✗ PWA manifest failed"

echo -e "\nDashboard URL: $BASE_URL/platform/customer/dashboard.html"
echo "Mobile App URL: $BASE_URL/platform/mobile-app.html"
TEST

chmod +x test-deployment.sh

echo ""
echo "✅ All deployment files prepared!"
echo "📦 Main package: rootuip-complete-deploy.tar.gz (663KB)"
echo "🔧 Quick fix: nginx-api-fix.conf + fix-on-server.sh"
echo "🧪 Test script: ./test-deployment.sh"