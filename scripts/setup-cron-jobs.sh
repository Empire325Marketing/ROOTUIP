#!/bin/bash

# ROOTUIP Cron Jobs Setup
# Sets up automated tasks for the platform

echo "Setting up ROOTUIP Automated Tasks"
echo "=================================="

# Check if running as the correct user
if [ "$USER" != "iii" ]; then
    echo "Please run as user 'iii'"
    exit 1
fi

# Backup existing crontab
crontab -l > /tmp/existing_cron_backup 2>/dev/null

# Create new cron jobs
cat > /tmp/rootuip_cron << 'EOF'
# ROOTUIP Automated Tasks

# Daily backup at 2 AM
0 2 * * * /home/iii/ROOTUIP/scripts/backup-system.sh >> /home/iii/ROOTUIP/logs/backup.log 2>&1

# Hourly metrics summary
0 * * * * /home/iii/ROOTUIP/scripts/generate-metrics-report.sh >> /home/iii/ROOTUIP/logs/metrics.log 2>&1

# Check services every 5 minutes
*/5 * * * * /home/iii/ROOTUIP/scripts/health-check.sh >> /home/iii/ROOTUIP/logs/health-check.log 2>&1

# Clean up old logs weekly (Sunday at 3 AM)
0 3 * * 0 find /home/iii/ROOTUIP/logs -name "*.log" -mtime +30 -exec gzip {} \;

# SSL certificate renewal check (daily at noon)
0 12 * * * /usr/bin/certbot renew --quiet

# Database optimization (weekly on Sunday at 4 AM)
0 4 * * 0 psql -U uip_user -d rootuip -c "VACUUM ANALYZE;" >> /home/iii/ROOTUIP/logs/db-maintenance.log 2>&1

# ML model performance report (daily at 8 AM)
0 8 * * * /home/iii/ROOTUIP/scripts/ml-performance-report.sh >> /home/iii/ROOTUIP/logs/ml-report.log 2>&1

EOF

# Install new crontab
crontab /tmp/rootuip_cron

echo "Cron jobs installed successfully!"
echo ""
echo "Scheduled tasks:"
echo "- Daily backup: 2:00 AM"
echo "- Hourly metrics: Every hour"
echo "- Health checks: Every 5 minutes"
echo "- Log cleanup: Weekly (Sunday 3 AM)"
echo "- SSL renewal: Daily at noon"
echo "- DB optimization: Weekly (Sunday 4 AM)"
echo "- ML reports: Daily at 8 AM"
echo ""
echo "View cron jobs: crontab -l"
echo "Edit cron jobs: crontab -e"
echo ""
echo "Logs location: /home/iii/ROOTUIP/logs/"