#!/bin/bash

echo "=== NGINX DEBUGGING ==="
echo ""
echo "1. Checking what files exist in the nginx root:"
ls -la /home/iii/ROOTUIP/ROOTUIP/*.html | wc -l
echo "files found"
echo ""
echo "2. Testing specific files:"
echo -n "index.html: "
curl -s -o /dev/null -w "%{http_code}" https://rootuip.com/index.html
echo ""
echo -n "ml-demo.html: "
curl -s -o /dev/null -w "%{http_code}" https://rootuip.com/ml-demo.html
echo ""
echo -n "test-nginx.html: "
curl -s -o /dev/null -w "%{http_code}" https://rootuip.com/test-nginx.html
echo ""
echo ""
echo "3. The problem:"
echo "- index.html returns 200 (works)"
echo "- ml-demo.html returns 404 (doesn't work)"
echo "- Both files exist in the same directory with same permissions"
echo ""
echo "4. This suggests:"
echo "- Either nginx needs to be reloaded: sudo systemctl reload nginx"
echo "- Or there's a caching issue"
echo "- Or there's another server block handling HTTPS that we can't see"
echo ""
echo "5. To fix, try:"
echo "   sudo systemctl reload nginx"
echo ""
echo "6. If that doesn't work, there might be a reverse proxy or CDN in front"
echo "   that's caching the 404 responses."