#!/bin/bash

# ROOTUIP Health Check Script
# Monitors service health and restarts if needed

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ML_URL="http://localhost:3004/ml/health"
PYTHON_URL="http://localhost:8000/health"
AUTH_URL="http://localhost:3003/health"
GATEWAY_URL="http://localhost:3006/health"

# Check function
check_service() {
    local name=$1
    local url=$2
    local service=$3
    
    if curl -s -f --max-time 5 "$url" > /dev/null 2>&1; then
        echo "[$TIMESTAMP] $name: OK"
        return 0
    else
        echo "[$TIMESTAMP] $name: FAILED - Attempting restart"
        
        # Try to restart the service
        if [ -n "$service" ]; then
            sudo systemctl restart "$service"
            sleep 5
            
            # Check again
            if curl -s -f --max-time 5 "$url" > /dev/null 2>&1; then
                echo "[$TIMESTAMP] $name: RECOVERED after restart"
                
                # Send alert (configure your notification method)
                # echo "Service $name recovered after restart" | mail -s "ROOTUIP Alert" admin@rootuip.com
                
                return 1
            else
                echo "[$TIMESTAMP] $name: CRITICAL - Restart failed"
                
                # Send critical alert
                # echo "Service $name is down and restart failed!" | mail -s "ROOTUIP CRITICAL" admin@rootuip.com
                
                return 2
            fi
        fi
        return 2
    fi
}

# Run health checks
echo "[$TIMESTAMP] Starting health checks..."

check_service "ML Server" "$ML_URL" "ml-server"
ML_STATUS=$?

check_service "Python API" "$PYTHON_URL" "ml-api"
PYTHON_STATUS=$?

check_service "Auth Service" "$AUTH_URL" "auth-service"
AUTH_STATUS=$?

check_service "API Gateway" "$GATEWAY_URL" "api-gateway"
GATEWAY_STATUS=$?

# Overall status
if [ $ML_STATUS -eq 0 ] && [ $PYTHON_STATUS -eq 0 ] && [ $AUTH_STATUS -le 1 ] && [ $GATEWAY_STATUS -le 1 ]; then
    echo "[$TIMESTAMP] All systems operational"
    exit 0
else
    echo "[$TIMESTAMP] System degraded - check logs"
    exit 1
fi