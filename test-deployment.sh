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
