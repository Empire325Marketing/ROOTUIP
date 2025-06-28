#!/bin/bash
# System Restore Script for ROOTUIP Enterprise Auth

echo "========================================"
echo "ROOTUIP Enterprise Auth System Restore"
echo "========================================"

BACKUP_DATE=${1:-$(date +%Y%m%d)}
BACKUP_DIR="/home/iii/backups"

# Function to check if service is running
check_service() {
    local service_name=$1
    local check_command=$2
    
    echo -n "Checking $service_name... "
    if eval $check_command; then
        echo "✓ Running"
        return 0
    else
        echo "✗ Not running"
        return 1
    fi
}

# Stop all services
echo "Stopping services..."
pm2 stop all 2>/dev/null || true

# Restore authentication service
echo "Restoring authentication service..."
if [ -d "$BACKUP_DIR/fallback" ]; then
    latest_backup=$(ls -t $BACKUP_DIR/fallback/auth-enterprise_* 2>/dev/null | head -1)
    if [ -n "$latest_backup" ]; then
        cp -r "$latest_backup"/* /home/iii/ROOTUIP/auth-enterprise/
        echo "Auth service restored from fallback backup"
    fi
fi

# Restore configuration files
echo "Restoring configuration files..."
cp /home/iii/ROOTUIP/enterprise-auth-complete-schema.sql /home/iii/ROOTUIP/auth-enterprise/ 2>/dev/null || true

# Start authentication service
echo "Starting authentication service..."
cd /home/iii/ROOTUIP/auth-enterprise
pm2 start simple-auth.js --name enterprise-auth 2>/dev/null || {
    echo "PM2 start failed, using direct node start..."
    nohup node simple-auth.js > /tmp/auth-service.log 2>&1 &
    echo $! > /tmp/auth-service.pid
}

# Wait for service to start
sleep 5

# Verify services
echo ""
echo "Verifying system status..."
check_service "Authentication Service" "curl -f -s http://localhost:3003/auth/health > /dev/null"

# Test login functionality
echo ""
echo "Testing authentication..."
login_test=$(curl -s -X POST http://localhost:3003/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@rootuip.com","password":"Demo123456"}')

if echo "$login_test" | grep -q "accessToken"; then
    echo "✓ Authentication test passed"
else
    echo "✗ Authentication test failed"
    echo "Response: $login_test"
fi

echo ""
echo "========================================"
echo "System restore completed"
echo "========================================"
echo ""
echo "Services status:"
echo "- Authentication Service: http://localhost:3003/auth/health"
echo "- Login Page: /home/iii/ROOTUIP/login.html"
echo "- Security Dashboard: /home/iii/ROOTUIP/security-dashboard.html"
echo ""
echo "To check logs: pm2 logs enterprise-auth"
echo "To monitor: pm2 monit"