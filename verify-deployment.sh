#!/bin/bash

# ROOTUIP Deployment Verification Script

echo "🔍 ROOTUIP Deployment Verification"
echo "=================================="
echo ""

# Check if services are accessible
echo "📡 Checking service endpoints..."
echo ""

# Function to check URL
check_url() {
    local url=$1
    local name=$2
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
        echo "✅ $name: $url (HTTP $response)"
    else
        echo "❌ $name: $url (HTTP $response or unreachable)"
    fi
}

# Check main endpoints
check_url "http://rootuip.com" "Main Site"
check_url "https://rootuip.com" "HTTPS Site"
check_url "https://rootuip.com/api/health" "API Gateway"
check_url "https://rootuip.com/demo/" "Demo Platform"
check_url "https://rootuip.com/auth/login" "Auth Service"

echo ""
echo "📊 Service Status on VPS:"
echo "ssh root@167.71.93.182 'pm2 list'"
echo ""
echo "📋 To view logs:"
echo "ssh root@167.71.93.182 'pm2 logs'"
echo ""
echo "🔄 To restart services:"
echo "ssh root@167.71.93.182 'pm2 restart all'"
echo ""