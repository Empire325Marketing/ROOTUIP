#!/bin/bash

# Health check configuration
AUTH_URL="http://localhost:3003/auth/health"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
CHECK_INTERVAL=60  # seconds
FAILURE_THRESHOLD=3
LOG_FILE="/home/iii/ROOTUIP/monitoring/logs/health-check.log"

# Initialize
failure_count=0

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    local message="$1"
    local severity="$2"
    
    # Log the alert
    log_message "ALERT [$severity]: $message"
    
    # Send webhook if configured
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"Auth Service Alert [$severity]: $message\",\"severity\":\"$severity\"}" \
            2>/dev/null
    fi
}

# Main monitoring loop
while true; do
    # Perform health check
    response=$(curl -s -w "\n%{http_code}" "$AUTH_URL" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        if [ $failure_count -gt 0 ]; then
            log_message "Service recovered after $failure_count failures"
            send_alert "Auth service has recovered" "info"
        fi
        failure_count=0
        log_message "Health check passed"
    else
        failure_count=$((failure_count + 1))
        log_message "Health check failed (attempt $failure_count/$FAILURE_THRESHOLD)"
        
        if [ $failure_count -ge $FAILURE_THRESHOLD ]; then
            send_alert "Auth service is down! Failed $failure_count consecutive health checks" "critical"
        fi
    fi
    
    sleep $CHECK_INTERVAL
done
