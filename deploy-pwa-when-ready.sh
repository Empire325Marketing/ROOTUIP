#!/bin/bash

# PWA Deployment Script - Run when server is accessible
# Usage: ./deploy-pwa-when-ready.sh [optional-port]

SERVER="157.173.124.19"
USER="iii"
PORT="${1:-22}"  # Default to port 22, or use first argument

echo "PWA Deployment Script for ROOTUIP"
echo "================================="
echo "Server: $USER@$SERVER:$PORT"
echo ""

# Function to test SSH connection
test_connection() {
    echo -n "Testing SSH connection... "
    if ssh -p "$PORT" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$USER@$SERVER" "echo 'Connected'" 2>/dev/null; then
        echo "SUCCESS"
        return 0
    else
        echo "FAILED"
        return 1
    fi
}

# Test connection
if ! test_connection; then
    echo ""
    echo "❌ Cannot connect to server on port $PORT"
    echo ""
    echo "Alternative options:"
    echo "1. Try different port: ./deploy-pwa-when-ready.sh 2222"
    echo "2. Check if server is online: ping $SERVER"
    echo "3. Use VPS provider's web console"
    echo "4. See PWA_DEPLOYMENT_GUIDE.md for manual steps"
    exit 1
fi

echo ""
echo "✅ Connection successful! Starting deployment..."
echo ""

# Check if files exist locally
if [ ! -f "pwa-complete-deploy.tar.gz" ] || [ ! -f "extract-complete-pwa.sh" ]; then
    echo "❌ Missing deployment files in current directory"
    echo "Required files:"
    echo "  - pwa-complete-deploy.tar.gz"
    echo "  - extract-complete-pwa.sh"
    exit 1
fi

# Upload files
echo "📤 Uploading deployment files..."
if scp -P "$PORT" pwa-complete-deploy.tar.gz extract-complete-pwa.sh "$USER@$SERVER:~/"; then
    echo "✅ Files uploaded successfully"
else
    echo "❌ Failed to upload files"
    exit 1
fi

# Execute deployment script
echo ""
echo "🚀 Running deployment script on server..."
ssh -p "$PORT" "$USER@$SERVER" "chmod +x extract-complete-pwa.sh && ./extract-complete-pwa.sh"

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment completed successfully!"
    echo ""
    echo "🔗 Test these URLs:"
    echo "   - Dashboard: https://app.rootuip.com/platform/customer/dashboard.html"
    echo "   - Mobile App: https://app.rootuip.com/platform/mobile-app.html"
    echo "   - API Test: https://app.rootuip.com/api/metrics"
    echo ""
    echo "📱 The PWA features are now enabled:"
    echo "   - Offline support"
    echo "   - App installation prompt"
    echo "   - Push notifications ready"
    echo "   - API responses configured (fixes loading issue)"
else
    echo ""
    echo "⚠️  Deployment script encountered issues"
    echo "Check the server logs or run manually:"
    echo "ssh -p $PORT $USER@$SERVER"
    echo "./extract-complete-pwa.sh"
fi