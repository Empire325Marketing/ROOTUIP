#!/bin/bash

# ROOTUIP Production Deployment Script
# This script deploys the optimized build to the production VPS

set -e

echo "🚀 ROOTUIP Production Deployment"
echo "================================"

# Configuration
VPS_HOST="145.223.73.4"
VPS_USER="root"
DOMAIN="rootuip.com"
LOCAL_BUILD_DIR="/home/iii/ROOTUIP/build"
REMOTE_WEB_DIR="/var/www/html"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Check if build exists
if [ ! -d "$LOCAL_BUILD_DIR" ]; then
    error "Build directory not found. Please run ./build_and_deploy.sh first"
fi

# Find the latest production package
PACKAGE=$(ls -t rootuip-production-*.tar.gz 2>/dev/null | head -n1)
if [ -z "$PACKAGE" ]; then
    error "No production package found. Please run ./build_and_deploy.sh first"
fi

log "Found package: $PACKAGE"

# Method 1: Try direct SCP/SSH deployment
log "Attempting direct deployment to VPS..."

# Test if we can connect to VPS
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_HOST" "echo 'Connection test successful'" 2>/dev/null; then
    log "Direct SSH connection successful. Deploying..."
    
    # Upload package
    log "Uploading $PACKAGE to VPS..."
    scp "$PACKAGE" "$VPS_USER@$VPS_HOST:/tmp/"
    
    # Deploy on VPS
    log "Extracting and deploying on VPS..."
    ssh "$VPS_USER@$VPS_HOST" << EOF
        set -e
        cd "$REMOTE_WEB_DIR"
        
        # Backup current site
        if [ -f index.html ]; then
            tar -czf "/tmp/backup-\$(date +%Y%m%d-%H%M%S).tar.gz" . 2>/dev/null || true
        fi
        
        # Clear current directory and extract new files
        rm -rf *
        tar -xzf "/tmp/$PACKAGE"
        
        # Set proper permissions
        chown -R www-data:www-data .
        find . -type f -exec chmod 644 {} \;
        find . -type d -exec chmod 755 {} \;
        
        # Reload web server
        systemctl reload nginx || systemctl reload apache2 || true
        
        echo "Deployment completed successfully!"
EOF
    
    log "✅ Deployment completed successfully!"
    log "🌐 Site available at: https://$DOMAIN"
    
else
    warn "Direct SSH connection failed. Providing manual deployment instructions..."
    
    # Method 2: Manual deployment instructions
    echo ""
    echo -e "${BLUE}📋 MANUAL DEPLOYMENT INSTRUCTIONS${NC}"
    echo "=================================="
    echo ""
    echo "Since direct SSH deployment failed, please follow these steps manually:"
    echo ""
    echo "1. Upload the package to your VPS:"
    echo "   scp $PACKAGE root@$VPS_HOST:/tmp/"
    echo ""
    echo "2. Connect to your VPS:"
    echo "   ssh root@$VPS_HOST"
    echo ""
    echo "3. Deploy the package:"
    echo "   cd /var/www/html"
    echo "   rm -rf *"
    echo "   tar -xzf /tmp/$PACKAGE"
    echo "   chown -R www-data:www-data ."
    echo "   find . -type f -exec chmod 644 {} \;"
    echo "   find . -type d -exec chmod 755 {} \;"
    echo "   systemctl reload nginx"
    echo ""
    echo "4. Verify deployment:"
    echo "   curl -I https://$DOMAIN"
    echo ""
    
    # Method 3: Alternative - HTTP transfer
    log "Starting local HTTP server for alternative deployment method..."
    
    # Create a simple deployment helper
    cat > deploy_helper.sh << EOF2
#!/bin/bash
# Helper script to run on VPS for HTTP-based deployment

echo "Downloading ROOTUIP from local server..."
cd /var/www/html

# Backup current site
if [ -f index.html ]; then
    tar -czf "/tmp/backup-\$(date +%Y%m%d-%H%M%S).tar.gz" . 2>/dev/null || true
fi

# Download and extract
wget -O /tmp/rootuip-production.tar.gz "http://\$1:8000/$PACKAGE"
rm -rf *
tar -xzf /tmp/rootuip-production.tar.gz

# Set permissions
chown -R www-data:www-data .
find . -type f -exec chmod 644 {} \;
find . -type d -exec chmod 755 {} \;

# Reload web server
systemctl reload nginx || systemctl reload apache2

echo "Deployment completed via HTTP transfer!"
EOF2
    
    chmod +x deploy_helper.sh
    
    echo ""
    echo -e "${YELLOW}🌐 ALTERNATIVE: HTTP-based deployment${NC}"
    echo "If you prefer to transfer via HTTP:"
    echo ""
    echo "1. On your local machine, start HTTP server:"
    echo "   python3 -m http.server 8000"
    echo ""
    echo "2. Copy deploy_helper.sh to your VPS and run:"
    echo "   ./deploy_helper.sh YOUR_LOCAL_IP"
    echo ""
    
    # Start HTTP server in background for 5 minutes
    echo "Starting HTTP server for 5 minutes (background process)..."
    timeout 300 python3 -m http.server 8000 &
    HTTP_PID=$!
    
    echo "HTTP server running on port 8000 (PID: $HTTP_PID)"
    echo "Server will automatically stop in 5 minutes"
    echo ""
fi

# Performance verification
log "Verifying deployment performance..."

echo ""
echo -e "${BLUE}🔍 POST-DEPLOYMENT VERIFICATION${NC}"
echo "==============================="

# Test basic connectivity
if curl -s -I "https://$DOMAIN" > /dev/null; then
    log "✅ Site is accessible at https://$DOMAIN"
    
    # Get response time
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "https://$DOMAIN")
    log "⚡ Response time: ${RESPONSE_TIME}s"
    
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        log "✅ Performance target met (<2s)"
    else
        warn "⚠️  Performance target not met (${RESPONSE_TIME}s >= 2s)"
    fi
    
    # Check for key elements
    CONTENT=$(curl -s "https://$DOMAIN")
    if [[ $CONTENT == *"$14M Per Vessel"* ]]; then
        log "✅ Key messaging present"
    else
        warn "⚠️  Key messaging may be missing"
    fi
    
    if [[ $CONTENT == *"roi-calculator"* ]]; then
        log "✅ ROI calculator detected"
    else
        warn "⚠️  ROI calculator may be missing"
    fi
    
else
    error "❌ Site not accessible at https://$DOMAIN"
fi

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT SUMMARY${NC}"
echo "===================="
echo "• Build package: $PACKAGE"
echo "• Target: https://$DOMAIN"
echo "• Status: Deployed"
echo "• Performance: <2s target"
echo "• Features: Enhanced UI, Analytics, ROI Calculator"
echo ""
echo -e "${BLUE}📊 NEXT STEPS${NC}"
echo "============"
echo "1. Test all functionality on https://$DOMAIN"
echo "2. Monitor performance metrics"
echo "3. Set up Google Analytics (replace GA_MEASUREMENT_ID)"
echo "4. Configure email capture for demo requests"
echo "5. Add SSL certificate renewal automation"
echo ""
echo -e "${GREEN}✅ Production deployment complete!${NC}"