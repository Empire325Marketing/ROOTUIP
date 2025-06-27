#!/bin/bash

# Infrastructure Platform Deployment Script
# Run this script to deploy the infrastructure platform to your VPS

echo "Infrastructure Platform Deployment"
echo "================================="

# Set variables
VPS_HOST="145.223.73.4"
VPS_USER="root"
VPS_PATH="/var/www/html"

# Create archive
echo "Creating infrastructure archive..."
cd /home/iii/ROOTUIP
tar -czf infrastructure.tar.gz infrastructure/

echo ""
echo "To deploy, run the following commands manually:"
echo ""
echo "1. Copy the archive to your VPS:"
echo "   scp infrastructure.tar.gz ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"
echo ""
echo "2. SSH into your VPS:"
echo "   ssh ${VPS_USER}@${VPS_HOST}"
echo ""
echo "3. Extract the archive on the VPS:"
echo "   cd ${VPS_PATH}"
echo "   tar -xzf infrastructure.tar.gz"
echo "   rm infrastructure.tar.gz"
echo ""
echo "4. Your infrastructure platform will be available at:"
echo "   - Cloud Architecture: http://${VPS_HOST}/infrastructure/cloud/"
echo "   - Security Center: http://${VPS_HOST}/infrastructure/security/"
echo "   - Data Management: http://${VPS_HOST}/infrastructure/data/"
echo "   - Integration Platform: http://${VPS_HOST}/infrastructure/integration/"
echo "   - Monitoring Dashboard: http://${VPS_HOST}/infrastructure/monitoring/"
echo ""
echo "Archive created at: $(pwd)/infrastructure.tar.gz"