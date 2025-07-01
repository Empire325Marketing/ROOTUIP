#!/bin/bash

# ROOTUIP Health Monitoring Script
LOG_FILE="/var/log/rootuip/health.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check main application
if curl -f -s http://localhost:3000/api/health > /dev/null; then
    log_message "✅ Main application healthy"
    main_status=0
else
    log_message "❌ Main application unhealthy"
    main_status=1
fi

# Check demo service
if curl -f -s http://localhost:3030/api/health > /dev/null; then
    log_message "✅ Demo service healthy"
    demo_status=0
else
    log_message "❌ Demo service unhealthy"
    demo_status=1
fi

# Check PM2 processes
if pm2 describe rootuip-main | grep -q "online"; then
    log_message "✅ PM2 processes running"
    pm2_status=0
else
    log_message "❌ PM2 processes not running"
    pm2_status=1
fi

# Check disk space
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -lt 80 ]; then
    log_message "✅ Disk usage healthy ($disk_usage%)"
    disk_status=0
else
    log_message "⚠️ Disk usage high ($disk_usage%)"
    disk_status=1
fi

# Overall health
if [ $main_status -eq 0 ] && [ $demo_status -eq 0 ] && [ $pm2_status -eq 0 ]; then
    log_message "✅ Overall system health: HEALTHY"
    exit 0
else
    log_message "❌ Overall system health: UNHEALTHY"
    exit 1
fi
