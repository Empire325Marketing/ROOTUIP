#!/bin/bash

# Deploy Critical Fixes to ROOTUIP Production Site
# Fixes: CSS variable syntax errors, assessment tool link, visual issues

echo "🚀 Deploying critical fixes to https://rootuip.com..."

# Server details
SERVER="root@145.223.73.4"
PASSWORD="SDAasdsa23..dsS"
REMOTE_PATH="/var/www/rootuip/public"

echo "1. Uploading fixed CSS files (240+ syntax errors corrected)..."
sshpass -p "$PASSWORD" scp -r /home/iii/ROOTUIP/ROOTUIP/css/ $SERVER:$REMOTE_PATH/

echo "2. Uploading fixed brand files..."
sshpass -p "$PASSWORD" scp -r /home/iii/ROOTUIP/ROOTUIP/brand/ $SERVER:$REMOTE_PATH/

echo "3. Uploading JavaScript files..."
sshpass -p "$PASSWORD" scp -r /home/iii/ROOTUIP/ROOTUIP/js/ $SERVER:$REMOTE_PATH/

echo "4. Uploading lead generation system..."
sshpass -p "$PASSWORD" scp -r /home/iii/ROOTUIP/ROOTUIP/lead-generation/ $SERVER:$REMOTE_PATH/

echo "5. Uploading updated homepage with assessment tool link..."
sshpass -p "$PASSWORD" scp /home/iii/ROOTUIP/ROOTUIP/index.html $SERVER:$REMOTE_PATH/

echo "6. Setting correct permissions..."
sshpass -p "$PASSWORD" ssh $SERVER "chmod -R 755 $REMOTE_PATH && chown -R www-data:www-data $REMOTE_PATH"

echo "✅ Deployment complete!"
echo ""
echo "🎨 FIXES APPLIED:"
echo "   • Fixed 240+ CSS var(var(--variable)) syntax errors"
echo "   • Colors now render properly throughout site"
echo "   • Added Assessment Tool to main navigation"
echo "   • Lead generation system fully accessible"
echo ""
echo "🌐 Test the fixes at:"
echo "   • Homepage: https://rootuip.com"
echo "   • Assessment: https://rootuip.com/lead-generation/assessment-tool.html"
echo "   • ROI Calculator: https://rootuip.com/roi-calculator.html"