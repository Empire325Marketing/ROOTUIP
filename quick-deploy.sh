#!/bin/bash

# ROOTUIP Quick Deploy Script
# One command to deploy everything to VPS

echo "🚀 ROOTUIP Quick Deploy Starting..."

# Make scripts executable
chmod +x deploy-and-test-vps.sh
chmod +x comprehensive-production-test.sh
chmod +x production-testing-suite.sh

# Run the main deployment
./deploy-and-test-vps.sh

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure CloudFlare DNS if not done"
echo "2. Set up external monitoring (UptimeRobot, etc)"
echo "3. Test all features thoroughly"
echo "4. Monitor logs: ssh root@145.223.73.4 'pm2 logs'"
echo ""
echo "🔗 Access your platform:"
echo "   https://rootuip.com"
echo "   https://api.rootuip.com"
echo "   https://app.rootuip.com"
echo "   https://demo.rootuip.com"
echo "   https://status.rootuip.com"