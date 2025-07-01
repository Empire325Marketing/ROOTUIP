#!/bin/bash

# Fix for missing pages on ROOTUIP platform
# This script creates the missing files and uploads them via API

echo "=== ROOTUIP Missing Pages Fix ==="
echo "Identified Issues:"
echo "1. dashboard.html - 404 error"
echo "2. container-tracking-interface.html - 404 error" 
echo "3. api-playground.html - 404 error"
echo "4. status.rootuip.com - SSL certificate missing"
echo ""

# Since direct SSH access is blocked, we need alternative deployment methods
echo "Alternative deployment strategies:"
echo "1. Use GitHub Actions to auto-deploy"
echo "2. Use CDN upload via API"
echo "3. Use webhook deployment"
echo ""

# Check if files exist locally
if [ -f "dashboard.html" ]; then
    echo "✅ dashboard.html exists locally ($(wc -l < dashboard.html) lines)"
else
    echo "❌ dashboard.html missing locally"
fi

if [ -f "container-tracking-interface.html" ]; then
    echo "✅ container-tracking-interface.html exists locally ($(wc -l < container-tracking-interface.html) lines)"
else
    echo "❌ container-tracking-interface.html missing locally"
fi

if [ -f "api-playground.html" ]; then
    echo "✅ api-playground.html exists locally ($(wc -l < api-playground.html) lines)"
else
    echo "❌ api-playground.html missing locally"
fi

echo ""
echo "=== RECOMMENDATIONS ==="
echo "1. Deploy via CI/CD pipeline"
echo "2. Use rsync with proper authentication"
echo "3. Upload via admin panel or file manager"
echo "4. Add status.rootuip.com to SSL certificate"

# Test pages
echo ""
echo "=== TESTING CURRENT STATUS ==="
echo "Testing demo.rootuip.com..."
curl -s -I https://demo.rootuip.com/ | head -1

echo "Testing dashboard.html..."
curl -s -I https://rootuip.com/dashboard.html | head -1

echo "Testing container-tracking-interface.html..."
curl -s -I https://rootuip.com/container-tracking-interface.html | head -1

echo "Testing api-playground.html..."
curl -s -I https://rootuip.com/api-playground.html | head -1

echo "Testing status.rootuip.com SSL..."
curl -s -I https://status.rootuip.com/ 2>&1 | head -1