#!/bin/bash
# Quick fix for "loading" issue on ROOTUIP pages

echo "Applying quick fix for loading issue..."

# Create a simple nginx config to return static API responses
cat > /tmp/api-static-responses.conf << 'EOF'
# Static API responses to fix loading issue
location /api/metrics {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142,"timestamp":"2025-06-27T10:00:00Z"}';
}

location /api/notifications {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"success":true,"notifications":[{"id":1,"type":"info","title":"Welcome to ROOTUIP","message":"Your platform is ready","timestamp":"2025-06-27T10:00:00Z","read":false}],"unreadCount":1}';
}

location /api/shipments {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"success":true,"shipments":[{"container":"MAEU1234567","blNumber":"BL123456789","carrier":"MAEU","carrierName":"Maersk","origin":"Shanghai","destination":"Rotterdam","status":"in-transit","eta":"2025-07-15","ddRisk":"Low","route":"asia-europe"}],"total":1}';
}

location /api/user {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"success":true,"user":{"name":"Demo User","company":"Acme Corporation","role":"Admin"}}';
}

location /api/ping {
    add_header Content-Type application/json;
    add_header Access-Control-Allow-Origin *;
    return 200 '{"status":"ok","timestamp":"2025-06-27T10:00:00Z"}';
}
EOF

echo "To apply this fix on your server:"
echo ""
echo "1. SSH to your server:"
echo "   ssh iii@157.173.124.19"
echo ""
echo "2. Create the API responses config:"
echo "   sudo nano /etc/nginx/sites-available/api-responses.conf"
echo "   (Paste the content from /tmp/api-static-responses.conf)"
echo ""
echo "3. Include it in your main nginx config:"
echo "   sudo nano /etc/nginx/sites-available/app.rootuip.com"
echo "   Add this line inside the server block:"
echo "   include /etc/nginx/sites-available/api-responses.conf;"
echo ""
echo "4. Test and reload nginx:"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "This will make the pages load properly with demo data instead of showing 'loading'."

# Also create a one-liner fix
echo ""
echo "========================================="
echo "ALTERNATIVE: One-line fix (run on server as sudo):"
echo "========================================="
echo ""
echo 'echo "location /api/metrics { add_header Content-Type application/json; return 200 '"'"'{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}'"'"'; }" >> /etc/nginx/sites-available/app.rootuip.com && nginx -t && systemctl reload nginx'