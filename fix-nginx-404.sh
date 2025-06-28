#!/bin/bash

echo "ROOTUIP Nginx 404 Fix Script"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}DIAGNOSIS:${NC}"
echo "1. Nginx is configured for rootuip.com but NOT for app.rootuip.com"
echo "2. Services are running on ports 3001-3004 but may not be the correct ones"
echo "3. No nginx error log exists for app.rootuip.com (domain not configured)"
echo ""

echo -e "${YELLOW}CURRENT STATUS:${NC}"
echo "- Nginx document root: /home/iii/ROOTUIP/ROOTUIP"
echo "- Configured domains: rootuip.com, www.rootuip.com"
echo "- Missing domain: app.rootuip.com"
echo ""

echo -e "${YELLOW}SERVICES RUNNING:${NC}"
echo "- Port 3001: Next.js server (should be auth service)"
echo "- Port 3002: enterprise-auth-demo.js"
echo "- Port 3003: simple-auth.js (auth-enterprise/simple-auth.js)"
echo "- Port 3004: Unknown node service"
echo "- Port 3005: NOT RUNNING"
echo ""

echo -e "${GREEN}SOLUTION:${NC}"
echo "The nginx configuration file has been created at:"
echo "  /home/iii/ROOTUIP/app.rootuip.com.nginx.conf"
echo ""
echo "To fix the 404 errors, run these commands:"
echo ""
echo -e "${GREEN}Step 1: Copy nginx config${NC}"
echo "  sudo cp /home/iii/ROOTUIP/app.rootuip.com.nginx.conf /etc/nginx/sites-available/app.rootuip.com"
echo ""
echo -e "${GREEN}Step 2: Enable the site${NC}"
echo "  sudo ln -s /etc/nginx/sites-available/app.rootuip.com /etc/nginx/sites-enabled/"
echo ""
echo -e "${GREEN}Step 3: Test nginx config${NC}"
echo "  sudo nginx -t"
echo ""
echo -e "${GREEN}Step 4: Reload nginx${NC}"
echo "  sudo systemctl reload nginx"
echo ""

echo -e "${YELLOW}TESTING AFTER FIX:${NC}"
echo "1. Test static files:"
echo "   curl -I http://app.rootuip.com/"
echo "   curl -I http://app.rootuip.com/index.html"
echo ""
echo "2. Test API endpoints:"
echo "   curl http://app.rootuip.com/auth/health"
echo "   curl http://app.rootuip.com/integrations/health"
echo ""

echo -e "${YELLOW}ADDITIONAL ISSUES TO ADDRESS:${NC}"
echo "1. The auth service on port 3001 appears to be a Next.js app, not the auth API"
echo "2. You may need to stop the Next.js server and start auth-service-fixed.js:"
echo "   - Find Next.js PID: ps aux | grep 327337"
echo "   - Kill it: kill 327337"
echo "   - Start auth service: cd /home/iii/ROOTUIP && node auth-service-fixed.js &"
echo ""
echo "3. The workflow service (port 3005) is not running"
echo ""

echo -e "${GREEN}Quick test commands:${NC}"
echo "# Test if services are responding correctly:"
echo "curl -s http://localhost:3001/ | head -n 5"
echo "curl -s http://localhost:3002/ | head -n 5"
echo "curl -s http://localhost:3003/ | head -n 5"
echo "curl -s http://localhost:3004/ | head -n 5"