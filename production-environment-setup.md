# ROOTUIP Production Environment Configuration Guide

## Environment Variables Configuration

### Primary Environment File: `/etc/rootuip/.env`

```bash
# ROOTUIP Production Environment Configuration
# Created: $(date)
# Version: 3.0.0

#############################################
# CORE APPLICATION SETTINGS
#############################################
NODE_ENV=production
PORT=3000
APP_NAME=ROOTUIP
APP_VERSION=3.0.0
APP_URL=https://rootuip.com

#############################################
# DOMAIN CONFIGURATION
#############################################
DOMAIN=rootuip.com
API_URL=https://api.rootuip.com
APP_URL=https://app.rootuip.com
DEMO_URL=https://demo.rootuip.com
CUSTOMER_URL=https://customer.rootuip.com
CDN_URL=https://cdn.rootuip.com

#############################################
# DATABASE CONFIGURATION
#############################################
# MongoDB
MONGODB_URI=mongodb://localhost:27017/rootuip_production
MONGODB_MAX_CONNECTIONS=100
MONGODB_TIMEOUT=30000

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password_here
REDIS_TTL=3600
REDIS_MAX_CONNECTIONS=50

#############################################
# AUTHENTICATION & SECURITY
#############################################
# JWT Configuration
JWT_SECRET=your_jwt_secret_256_bit_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_token_secret_here
JWT_REFRESH_EXPIRES_IN=30d

# Session Configuration
SESSION_SECRET=your_session_secret_here
SESSION_MAX_AGE=86400000
CSRF_SECRET=your_csrf_secret_here

# Password Hashing
BCRYPT_ROUNDS=12
PASSWORD_MIN_LENGTH=8
PASSWORD_MAX_ATTEMPTS=5

# API Security
API_KEY_HEADER=X-API-Key
API_RATE_LIMIT=100
API_RATE_WINDOW=900000

#############################################
# EMAIL CONFIGURATION
#############################################
# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@rootuip.com
SMTP_PASS=your_app_specific_password_here
EMAIL_FROM=noreply@rootuip.com
EMAIL_REPLY_TO=support@rootuip.com

# Email Templates
EMAIL_TEMPLATE_DIR=/var/www/rootuip/templates/email
SUPPORT_EMAIL=support@rootuip.com
ADMIN_EMAIL=admin@rootuip.com

#############################################
# EXTERNAL API INTEGRATIONS
#############################################
# Shipping Line APIs
MAERSK_API_KEY=your_maersk_api_key_here
MAERSK_API_URL=https://api.maersk.com/v1
MAERSK_RATE_LIMIT=1000

MSC_API_KEY=your_msc_api_key_here
MSC_API_URL=https://api.msc.com/v1
MSC_RATE_LIMIT=500

COSCO_API_KEY=your_cosco_api_key_here
COSCO_API_URL=https://api.cosco.com/v1
COSCO_RATE_LIMIT=300

CMA_CGM_API_KEY=your_cma_cgm_api_key_here
CMA_CGM_API_URL=https://api.cma-cgm.com/v1

HAPAG_LLOYD_API_KEY=your_hapag_lloyd_api_key_here
HAPAG_LLOYD_API_URL=https://api.hapag-lloyd.com/v1

# Port & Terminal APIs
PORT_API_KEY=your_port_api_key_here
TERMINAL_API_KEY=your_terminal_api_key_here

#############################################
# ANALYTICS & MONITORING
#############################################
# Analytics Services
GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
MIXPANEL_TOKEN=your_mixpanel_token_here
SEGMENT_WRITE_KEY=your_segment_key_here

# Error Tracking
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=3.0.0

# Performance Monitoring
NEW_RELIC_LICENSE_KEY=your_new_relic_key_here
NEW_RELIC_APP_NAME=ROOTUIP-Production

# Custom Analytics
ANALYTICS_API_KEY=your_internal_analytics_key_here
METRICS_ENDPOINT=https://metrics.rootuip.com/api/v1

#############################################
# FILE STORAGE & UPLOADS
#############################################
# Local Storage
UPLOAD_PATH=/var/www/rootuip/uploads
UPLOAD_MAX_SIZE=52428800
UPLOAD_ALLOWED_TYPES=pdf,jpg,jpeg,png,tiff,doc,docx,xls,xlsx

# AWS S3 (if using cloud storage)
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET=rootuip-production-files
AWS_S3_URL=https://rootuip-production-files.s3.amazonaws.com

# CloudFlare R2 (alternative)
CF_R2_ACCESS_KEY=your_r2_access_key_here
CF_R2_SECRET_KEY=your_r2_secret_key_here
CF_R2_BUCKET=rootuip-files

#############################################
# RATE LIMITING & PERFORMANCE
#############################################
# API Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_SUCCESSFUL=true

# Slow Down Protection
SLOW_DOWN_WINDOW=900000
SLOW_DOWN_DELAY_AFTER=50
SLOW_DOWN_DELAY_MS=500

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=1000
STATIC_CACHE_TTL=86400

# Performance Settings
MAX_CONNECTIONS=1000
CONNECTION_TIMEOUT=30000
KEEP_ALIVE_TIMEOUT=5000
HEADERS_TIMEOUT=60000

#############################################
# LOGGING CONFIGURATION
#############################################
# Log Levels: error, warn, info, debug
LOG_LEVEL=info
LOG_FILE=/var/log/rootuip/app.log
LOG_MAX_SIZE=100mb
LOG_MAX_FILES=10
LOG_DATE_PATTERN=YYYY-MM-DD

# Error Logging
ERROR_LOG_FILE=/var/log/rootuip/error.log
ACCESS_LOG_FILE=/var/log/rootuip/access.log

# Debug Settings
DEBUG_MODE=false
VERBOSE_LOGGING=false

#############################################
# BACKUP & DISASTER RECOVERY
#############################################
# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 */6 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_LOCATION=/var/backups/rootuip
BACKUP_COMPRESS=true

# Database Backup
DB_BACKUP_ENABLED=true
DB_BACKUP_ENCRYPTION=true
DB_BACKUP_KEY=your_backup_encryption_key_here

#############################################
# FEATURE FLAGS
#############################################
# Core Features
ENABLE_REAL_TIME_TRACKING=true
ENABLE_AI_PREDICTIONS=true
ENABLE_ADVANCED_ANALYTICS=true
ENABLE_DOCUMENT_OCR=true
ENABLE_ROUTE_OPTIMIZATION=true

# Experimental Features
ENABLE_BLOCKCHAIN_TRACKING=false
ENABLE_IOT_SENSORS=false
ENABLE_AR_VISUALIZATION=false

# API Features
ENABLE_WEBHOOK_NOTIFICATIONS=true
ENABLE_BULK_OPERATIONS=true
ENABLE_BATCH_PROCESSING=true

# Demo Features
DEMO_MODE=false
DEMO_AUTO_RESET=true
DEMO_RATE_LIMIT=1000

#############################################
# NOTIFICATION SETTINGS
#############################################
# Push Notifications
PUSH_NOTIFICATION_ENABLED=true
FIREBASE_SERVER_KEY=your_firebase_server_key_here
WEBPUSH_VAPID_PUBLIC=your_vapid_public_key_here
WEBPUSH_VAPID_PRIVATE=your_vapid_private_key_here

# SMS Notifications
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Slack Integration
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
SLACK_CHANNEL=#rootuip-alerts

#############################################
# PAYMENT PROCESSING
#############################################
# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key_here
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_MODE=live

#############################################
# COMPLIANCE & REGULATORY
#############################################
# GDPR Compliance
GDPR_ENABLED=true
DATA_RETENTION_DAYS=2555
COOKIE_CONSENT_REQUIRED=true

# SOC2 Compliance
AUDIT_LOGGING=true
ACCESS_LOGGING=true
CHANGE_LOGGING=true

# Industry Compliance
IMO_COMPLIANCE=true
ISPS_COMPLIANCE=true
CUSTOMS_INTEGRATION=true

#############################################
# CLUSTER & SCALING
#############################################
# PM2 Cluster Settings
CLUSTER_ENABLED=true
CLUSTER_WORKERS=2
CLUSTER_MAX_MEMORY=1024

# Load Balancer
LB_HEALTH_CHECK=/api/health
LB_TIMEOUT=30000
LB_RETRIES=3

# Auto Scaling
AUTO_SCALE_ENABLED=false
AUTO_SCALE_MIN_INSTANCES=2
AUTO_SCALE_MAX_INSTANCES=10
AUTO_SCALE_TARGET_CPU=70

#############################################
# DEVELOPMENT & TESTING
#############################################
# Testing
TEST_DATABASE_URL=mongodb://localhost:27017/rootuip_test
TEST_REDIS_URL=redis://localhost:6379/1
JEST_TIMEOUT=30000

# Development
DEV_TOOLS_ENABLED=false
HOT_RELOAD=false
SOURCEMAPS=false

#############################################
# MISCELLANEOUS
#############################################
# Timezone
TZ=UTC
LOCALE=en-US

# API Versioning
API_VERSION=v1
API_DEPRECATED_WARNING=true

# Client Settings
CLIENT_MAX_BODY_SIZE=50mb
CLIENT_TIMEOUT=60000

# Search & Indexing
ELASTICSEARCH_URL=http://localhost:9200
SEARCH_INDEX_NAME=rootuip_search

# Cron Jobs
CRON_ENABLED=true
CLEANUP_SCHEDULE=0 2 * * *
METRICS_SCHEDULE=*/15 * * * *
HEALTH_CHECK_SCHEDULE=*/5 * * * *
```

## Database Configuration

### MongoDB Setup

```bash
# /etc/mongod.conf
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

security:
  authorization: enabled

replication:
  replSetName: "rootuip-replica"
```

### Redis Configuration

```bash
# /etc/redis/redis.conf
bind 127.0.0.1
port 6379
requirepass your_redis_password_here
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## SSL Certificate Management

### Let's Encrypt Auto-Renewal

```bash
# /etc/cron.d/certbot-renewal
0 3 * * 0 root certbot renew --quiet --post-hook "systemctl reload nginx"
```

### Certificate Monitoring Script

```bash
#!/bin/bash
# /usr/local/bin/ssl-monitor.sh

DOMAINS=("rootuip.com" "app.rootuip.com" "api.rootuip.com" "demo.rootuip.com" "customer.rootuip.com")
ALERT_EMAIL="admin@rootuip.com"
WARN_DAYS=30

for domain in "${DOMAINS[@]}"; do
    expiry_date=$(openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    expiry_epoch=$(date -d "$expiry_date" +%s)
    current_epoch=$(date +%s)
    days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))
    
    if [ $days_until_expiry -lt $WARN_DAYS ]; then
        echo "WARNING: SSL certificate for $domain expires in $days_until_expiry days" | \
        mail -s "SSL Certificate Expiry Warning" $ALERT_EMAIL
    fi
done
```

## Performance Monitoring

### System Resource Monitoring

```bash
#!/bin/bash
# /usr/local/bin/resource-monitor.sh

# CPU Usage
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')

# Memory Usage
memory_usage=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')

# Disk Usage
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

# Load Average
load_average=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')

# Log metrics
echo "$(date): CPU: ${cpu_usage}%, Memory: ${memory_usage}%, Disk: ${disk_usage}%, Load: ${load_average}" >> /var/log/rootuip/system-metrics.log

# Alert if thresholds exceeded
if (( $(echo "$cpu_usage > 80" | bc -l) )); then
    echo "High CPU usage: ${cpu_usage}%" | mail -s "ROOTUIP System Alert" admin@rootuip.com
fi

if (( $(echo "$memory_usage > 85" | bc -l) )); then
    echo "High memory usage: ${memory_usage}%" | mail -s "ROOTUIP System Alert" admin@rootuip.com
fi

if [ "$disk_usage" -gt 85 ]; then
    echo "High disk usage: ${disk_usage}%" | mail -s "ROOTUIP System Alert" admin@rootuip.com
fi
```

## Security Configuration

### Fail2Ban Setup

```bash
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/access.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/access.log
maxretry = 5

[rootuip-auth]
enabled = true
filter = rootuip-auth
logpath = /var/log/rootuip/auth.log
maxretry = 3
bantime = 1800
```

### UFW Firewall Rules

```bash
#!/bin/bash
# Firewall setup script

# Reset firewall
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Essential services
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# MongoDB (local only)
ufw allow from 127.0.0.1 to any port 27017

# Redis (local only)
ufw allow from 127.0.0.1 to any port 6379

# Application monitoring
ufw allow from 127.0.0.1 to any port 3000:3030

# Enable firewall
ufw --force enable

# Status
ufw status verbose
```

## Log Management

### Logrotate Configuration

```bash
# /etc/logrotate.d/rootuip
/var/log/rootuip/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 rootuip rootuip
    postrotate
        sudo -u rootuip pm2 reloadLogs
        systemctl reload nginx
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
```

### Log Analysis Script

```bash
#!/bin/bash
# /usr/local/bin/log-analyzer.sh

LOG_DIR="/var/log/rootuip"
REPORT_FILE="/var/log/rootuip/daily-report.txt"
DATE=$(date '+%Y-%m-%d')

echo "ROOTUIP Daily Log Report - $DATE" > $REPORT_FILE
echo "======================================" >> $REPORT_FILE

# Error count
echo "Error Summary:" >> $REPORT_FILE
grep -c "ERROR" $LOG_DIR/*.log >> $REPORT_FILE

# Top error messages
echo -e "\nTop Errors:" >> $REPORT_FILE
grep "ERROR" $LOG_DIR/*.log | head -10 >> $REPORT_FILE

# Performance metrics
echo -e "\nPerformance Summary:" >> $REPORT_FILE
grep "response_time" $LOG_DIR/*.log | awk '{sum+=$NF; count++} END {print "Average response time:", sum/count "ms"}' >> $REPORT_FILE

# User activity
echo -e "\nUser Activity:" >> $REPORT_FILE
grep "user_login" $LOG_DIR/*.log | wc -l | xargs echo "Total logins:" >> $REPORT_FILE

# Send report
mail -s "ROOTUIP Daily Report - $DATE" admin@rootuip.com < $REPORT_FILE
```

## Backup and Recovery

### Automated Backup Script

```bash
#!/bin/bash
# /usr/local/bin/backup-system.sh

BACKUP_DIR="/var/backups/rootuip"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Database backup
echo "Backing up MongoDB..."
mongodump --db rootuip_production --out "$BACKUP_DIR/$DATE/mongodb"

# Redis backup
echo "Backing up Redis..."
redis-cli --rdb "$BACKUP_DIR/$DATE/redis-dump.rdb"

# Application files
echo "Backing up application..."
tar -czf "$BACKUP_DIR/$DATE/application.tar.gz" -C /var/www rootuip

# Configuration files
echo "Backing up configurations..."
tar -czf "$BACKUP_DIR/$DATE/configs.tar.gz" \
    /etc/nginx/sites-enabled \
    /etc/rootuip \
    /etc/ssl/certs \
    /etc/letsencrypt

# System logs
echo "Backing up logs..."
tar -czf "$BACKUP_DIR/$DATE/logs.tar.gz" /var/log/rootuip

# SSL certificates
echo "Backing up SSL certificates..."
tar -czf "$BACKUP_DIR/$DATE/ssl.tar.gz" /etc/letsencrypt

# Create manifest
cat > "$BACKUP_DIR/$DATE/manifest.json" << EOF
{
  "backup_id": "$DATE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": [
    "mongodb",
    "redis", 
    "application",
    "configurations",
    "logs",
    "ssl_certificates"
  ],
  "size": "$(du -sh "$BACKUP_DIR/$DATE" | cut -f1)",
  "retention_until": "$(date -d "+$RETENTION_DAYS days" +%Y-%m-%d)"
}
EOF

# Cleanup old backups
find "$BACKUP_DIR" -type d -name "*_*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null

# Log completion
logger "ROOTUIP backup completed: $BACKUP_DIR/$DATE"
echo "Backup completed successfully: $DATE"

# Optional: Upload to cloud storage
# aws s3 sync "$BACKUP_DIR/$DATE" s3://rootuip-backups/$DATE/
```

## Health Check & Monitoring

### Comprehensive Health Check

```bash
#!/bin/bash
# /usr/local/bin/health-check-comprehensive.sh

HEALTH_LOG="/var/log/rootuip/health-comprehensive.log"
ALERT_EMAIL="admin@rootuip.com"
CRITICAL_ISSUES=0

log_check() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$HEALTH_LOG"
}

# Application health checks
check_app_health() {
    endpoints=(
        "http://localhost:3000/api/health"
        "http://localhost:3030/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$endpoint" --max-time 10 > /dev/null; then
            log_check "✅ Application healthy: $endpoint"
        else
            log_check "❌ Application unhealthy: $endpoint"
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
        fi
    done
}

# Database connectivity
check_databases() {
    # MongoDB
    if mongosh --eval "db.adminCommand('ping')" rootuip_production &>/dev/null; then
        log_check "✅ MongoDB accessible"
    else
        log_check "❌ MongoDB not accessible"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
    
    # Redis
    if redis-cli ping | grep -q "PONG"; then
        log_check "✅ Redis accessible"
    else
        log_check "❌ Redis not accessible"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
}

# SSL certificate validity
check_ssl_certificates() {
    domains=("rootuip.com" "app.rootuip.com" "api.rootuip.com" "demo.rootuip.com")
    
    for domain in "${domains[@]}"; do
        expiry=$(openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | \
                openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
        
        if [ $? -eq 0 ]; then
            expiry_epoch=$(date -d "$expiry" +%s)
            current_epoch=$(date +%s)
            days_left=$(( ($expiry_epoch - $current_epoch) / 86400 ))
            
            if [ $days_left -gt 30 ]; then
                log_check "✅ SSL certificate valid for $domain ($days_left days)"
            else
                log_check "⚠️ SSL certificate expires soon for $domain ($days_left days)"
            fi
        else
            log_check "❌ Cannot check SSL certificate for $domain"
        fi
    done
}

# System resources
check_system_resources() {
    # CPU
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    if (( $(echo "$cpu_usage < 80" | bc -l) )); then
        log_check "✅ CPU usage normal ($cpu_usage%)"
    else
        log_check "⚠️ High CPU usage ($cpu_usage%)"
    fi
    
    # Memory
    memory_usage=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
    if (( $(echo "$memory_usage < 85" | bc -l) )); then
        log_check "✅ Memory usage normal ($memory_usage%)"
    else
        log_check "⚠️ High memory usage ($memory_usage%)"
    fi
    
    # Disk
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        log_check "✅ Disk usage normal ($disk_usage%)"
    else
        log_check "⚠️ High disk usage ($disk_usage%)"
    fi
}

# PM2 process monitoring
check_pm2_processes() {
    processes=("rootuip-main" "rootuip-demo")
    
    for process in "${processes[@]}"; do
        if pm2 describe "$process" | grep -q "online"; then
            log_check "✅ PM2 process $process running"
        else
            log_check "❌ PM2 process $process not running"
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
        fi
    done
}

# Run all checks
log_check "=== Starting comprehensive health check ==="
check_app_health
check_databases
check_ssl_certificates  
check_system_resources
check_pm2_processes

# Summary
if [ $CRITICAL_ISSUES -eq 0 ]; then
    log_check "✅ Overall health: HEALTHY (0 critical issues)"
    exit 0
else
    log_check "❌ Overall health: UNHEALTHY ($CRITICAL_ISSUES critical issues)"
    
    # Send alert
    tail -50 "$HEALTH_LOG" | mail -s "ROOTUIP Health Alert - $CRITICAL_ISSUES Critical Issues" "$ALERT_EMAIL"
    exit 1
fi
```

---

## Quick Setup Commands

```bash
# 1. Set secure permissions
sudo chmod 600 /etc/rootuip/.env
sudo chown root:root /etc/rootuip/.env

# 2. Generate secure secrets
openssl rand -base64 64  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET
openssl rand -base64 32  # For CSRF_SECRET

# 3. Test configuration
source /etc/rootuip/.env && node -e "console.log('Environment loaded successfully')"

# 4. Restart services
sudo systemctl restart rootuip
sudo systemctl restart nginx

# 5. Verify health
curl -f https://rootuip.com/api/health
```

**🔐 Remember to update all placeholder values with your actual production credentials and API keys!**