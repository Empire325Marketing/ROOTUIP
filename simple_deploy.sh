#!/bin/bash

# Simple Infrastructure Deployment Script
# Run this ON YOUR VPS to deploy the infrastructure platform

echo "Infrastructure Platform Deployment"
echo "================================="

cd /var/www/html

# Create infrastructure directories
echo "Creating directories..."
mkdir -p infrastructure/{cloud,security,data,integration,monitoring}

# Since we can't directly copy, here's what you need to do:
echo ""
echo "MANUAL DEPLOYMENT STEPS:"
echo "======================="
echo ""
echo "1. First, on your local machine, create a simple HTTP server:"
echo "   cd /home/iii/ROOTUIP"
echo "   python3 -m http.server 8000"
echo ""
echo "2. Then, on your VPS, download the files:"
echo "   cd /var/www/html"
echo "   wget -r -np -nH --cut-dirs=3 http://YOUR_LOCAL_IP:8000/infrastructure/"
echo ""
echo "3. Or copy the infrastructure folder manually to your VPS"
echo ""
echo "The infrastructure platform includes:"
echo "- Cloud Architecture Dashboard"
echo "- Security Center" 
echo "- Data Management Platform"
echo "- Integration Platform"
echo "- Monitoring & Observability"
echo ""
echo "Once deployed, access at:"
echo "- http://145.223.73.4/infrastructure/cloud/"
echo "- http://145.223.73.4/infrastructure/security/"
echo "- http://145.223.73.4/infrastructure/data/"
echo "- http://145.223.73.4/infrastructure/integration/"
echo "- http://145.223.73.4/infrastructure/monitoring/"