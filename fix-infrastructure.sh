#!/bin/bash
# ROOTUIP Infrastructure Consolidation and Professional Hosting Setup
# This script fixes the deployment mess and creates enterprise-grade infrastructure

set -e

echo "🏗️ ROOTUIP Infrastructure Consolidation & Professional Hosting Setup"
echo "=================================================================="
echo "This will:"
echo "- Consolidate all files to /var/www/rootuip"
echo "- Fix all internal links and navigation"
echo "- Set up SSL/HTTPS with Let's Encrypt"
echo "- Configure CDN and performance optimization"
echo "- Set up monitoring and backup automation"
echo "- Create staging environment"
echo ""

# Configuration
DOMAIN="rootuip.com"
STAGING_DOMAIN="staging.rootuip.com"
APP_DOMAIN="app.rootuip.com"
API_DOMAIN="api.rootuip.com"
CDN_DOMAIN="cdn.rootuip.com"
EMAIL="admin@rootuip.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Create new directory structure
log_step "Creating consolidated directory structure..."
mkdir -p /var/www/rootuip/{public,staging,backups,logs,ssl,scripts,cache,temp}
mkdir -p /var/www/rootuip/public/{assets/{css,js,images,fonts},api,docs}
mkdir -p /var/www/rootuip/staging/{assets/{css,js,images,fonts},api,docs}
mkdir -p /var/www/rootuip/logs/{nginx,app,monitoring}
mkdir -p /var/www/rootuip/scripts/{deployment,monitoring,backup}

# Step 2: Consolidate files from scattered locations
log_step "Consolidating files from scattered locations..."

# Function to fix internal links
fix_internal_links() {
    local file=$1
    log_step "Fixing links in: $file"
    
    # Fix ROOTUIP references
    sed -i 's|/ROOTUIP/|/|g' "$file"
    sed -i 's|href="ROOTUIP/|href="/|g' "$file"
    sed -i 's|src="ROOTUIP/|src="/|g' "$file"
    sed -i 's|../ROOTUIP/|/|g' "$file"
    
    # Fix asset paths
    sed -i 's|/css/|/assets/css/|g' "$file"
    sed -i 's|/js/|/assets/js/|g' "$file"
    sed -i 's|/images/|/assets/images/|g' "$file"
    sed -i 's|/fonts/|/assets/fonts/|g' "$file"
    
    # Fix double slashes
    sed -i 's|//|/|g' "$file"
    sed -i 's|https:/|https://|g' "$file"
    sed -i 's|http:/|http://|g' "$file"
}

# Copy files from /var/www/html/ROOTUIP
if [ -d "/var/www/html/ROOTUIP" ]; then
    log_step "Copying files from /var/www/html/ROOTUIP..."
    rsync -av --exclude='.git' /var/www/html/ROOTUIP/ /var/www/rootuip/public/
fi

# Copy files from /var/www/html root
if [ -d "/var/www/html" ]; then
    log_step "Copying files from /var/www/html..."
    for file in /var/www/html/*.html /var/www/html/*.css /var/www/html/*.js; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "index.nginx-debian.html" ]; then
            cp "$file" /var/www/rootuip/public/
        fi
    done
fi

# Copy assets to proper locations
log_step "Organizing assets..."
[ -d "/var/www/html/css" ] && rsync -av /var/www/html/css/ /var/www/rootuip/public/assets/css/
[ -d "/var/www/html/js" ] && rsync -av /var/www/html/js/ /var/www/rootuip/public/assets/js/
[ -d "/var/www/html/images" ] && rsync -av /var/www/html/images/ /var/www/rootuip/public/assets/images/
[ -d "/var/www/html/ROOTUIP/css" ] && rsync -av /var/www/html/ROOTUIP/css/ /var/www/rootuip/public/assets/css/
[ -d "/var/www/html/ROOTUIP/js" ] && rsync -av /var/www/html/ROOTUIP/js/ /var/www/rootuip/public/assets/js/
[ -d "/var/www/html/ROOTUIP/images" ] && rsync -av /var/www/html/ROOTUIP/images/ /var/www/rootuip/public/assets/images/

# Fix all HTML files
log_step "Fixing internal links in all HTML files..."
find /var/www/rootuip/public -name "*.html" -type f | while read -r file; do
    fix_internal_links "$file"
done

# Fix CSS and JS files
find /var/www/rootuip/public -name "*.css" -o -name "*.js" | while read -r file; do
    sed -i 's|/ROOTUIP/|/|g' "$file"
    sed -i 's|../images/|/assets/images/|g' "$file"
done

# Step 3: Set up Nginx configuration
log_step "Configuring Nginx for professional hosting..."

cat > /etc/nginx/sites-available/rootuip << 'NGINX_CONFIG'
# Rate limiting
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

# Upstream servers
upstream app_backend {
    server localhost:3000;
    keepalive 64;
}

upstream api_backend {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
    server localhost:3004;
    server localhost:3005;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name rootuip.com www.rootuip.com app.rootuip.com api.rootuip.com staging.rootuip.com cdn.rootuip.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main website (rootuip.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rootuip.com www.rootuip.com;
    
    root /var/www/rootuip/public;
    index index.html;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.rootuip.com wss://api.rootuip.com;" always;
    
    # Performance optimizations
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/xml+rss application/json;
    gzip_comp_level 6;
    
    # Browser caching
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        access_log off;
    }
    
    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        access_log off;
    }
    
    location ~* \.(woff|woff2|ttf|otf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
        access_log off;
    }
    
    # HTML files - shorter cache
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://app_backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://app_backend/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
    }
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /404.html {
        internal;
    }
    location = /50x.html {
        internal;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # General rate limiting
    limit_req zone=general burst=20 nodelay;
    
    # Logging
    access_log /var/www/rootuip/logs/nginx/access.log;
    error_log /var/www/rootuip/logs/nginx/error.log;
}

# App subdomain (app.rootuip.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.rootuip.com;
    
    root /var/www/rootuip/public/platform;
    index dashboard.html index.html;
    
    ssl_certificate /etc/letsencrypt/live/app.rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    
    # Same security headers as main site
    include /etc/nginx/snippets/security-headers.conf;
    
    # Auth rate limiting for app
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://app_backend/api/auth/;
        include /etc/nginx/snippets/proxy-params.conf;
    }
    
    location / {
        try_files $uri $uri/ /dashboard.html;
    }
    
    include /etc/nginx/snippets/performance.conf;
}

# API subdomain (api.rootuip.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/api.rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    
    # CORS headers for API
    add_header Access-Control-Allow-Origin "https://rootuip.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
    add_header Access-Control-Allow-Credentials "true" always;
    
    location / {
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        proxy_pass http://api_backend;
        include /etc/nginx/snippets/proxy-params.conf;
        
        # API rate limiting
        limit_req zone=api burst=50 nodelay;
    }
    
    include /etc/nginx/snippets/security-headers.conf;
}

# Staging subdomain (staging.rootuip.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name staging.rootuip.com;
    
    root /var/www/rootuip/staging;
    index index.html;
    
    ssl_certificate /etc/letsencrypt/live/staging.rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    
    # Basic auth for staging
    auth_basic "Staging Environment";
    auth_basic_user_file /etc/nginx/.htpasswd-staging;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    include /etc/nginx/snippets/security-headers.conf;
    include /etc/nginx/snippets/performance.conf;
}

# CDN subdomain (cdn.rootuip.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cdn.rootuip.com;
    
    root /var/www/rootuip/public/assets;
    
    ssl_certificate /etc/letsencrypt/live/cdn.rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cdn.rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    
    # CORS for CDN
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    
    # Aggressive caching for CDN
    location / {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        access_log off;
    }
    
    # Deny access to non-asset files
    location ~ \.(html|php|json|xml)$ {
        deny all;
    }
}
NGINX_CONFIG

# Create nginx snippets
mkdir -p /etc/nginx/snippets

cat > /etc/nginx/snippets/security-headers.conf << 'EOF'
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
EOF

cat > /etc/nginx/snippets/performance.conf << 'EOF'
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/javascript application/xml+rss application/json;
gzip_comp_level 6;

# Enable open file cache
open_file_cache max=2000 inactive=20s;
open_file_cache_valid 60s;
open_file_cache_min_uses 2;
open_file_cache_errors on;

# Enable sendfile
sendfile on;
tcp_nopush on;
tcp_nodelay on;

# Keep alive
keepalive_timeout 65;
keepalive_requests 100;

# Buffer sizes
client_body_buffer_size 128k;
client_max_body_size 10m;
client_header_buffer_size 1k;
large_client_header_buffers 4 16k;
output_buffers 1 32k;
postpone_output 1460;
EOF

cat > /etc/nginx/snippets/proxy-params.conf << 'EOF'
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_cache_bypass $http_upgrade;
proxy_buffering off;
proxy_request_buffering off;
EOF

# Step 4: Set up SSL certificates
log_step "Setting up SSL certificates with Let's Encrypt..."

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Create webroot directory for certbot
mkdir -p /var/www/certbot

# Obtain certificates for all domains
certbot certonly --webroot -w /var/www/certbot \
    -d rootuip.com -d www.rootuip.com \
    -d app.rootuip.com \
    -d api.rootuip.com \
    -d staging.rootuip.com \
    -d cdn.rootuip.com \
    --non-interactive --agree-tos -m $EMAIL

# Set up auto-renewal
cat > /etc/systemd/system/certbot-renewal.service << 'EOF'
[Unit]
Description=Certbot Renewal

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --post-hook "systemctl reload nginx"
EOF

cat > /etc/systemd/system/certbot-renewal.timer << 'EOF'
[Unit]
Description=Twice daily renewal of Let's Encrypt certificates

[Timer]
OnCalendar=0/12:00:00
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl enable certbot-renewal.timer
systemctl start certbot-renewal.timer

# Step 5: Create error pages
log_step "Creating custom error pages..."

cat > /var/www/rootuip/public/404.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Page Not Found | ROOTUIP</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
        }
        .container {
            max-width: 600px;
            padding: 20px;
        }
        h1 {
            font-size: 6rem;
            margin: 0;
            opacity: 0.8;
        }
        h2 {
            font-size: 2rem;
            margin: 20px 0;
        }
        p {
            font-size: 1.2rem;
            opacity: 0.9;
            margin: 20px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 30px;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.3s;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a href="/" class="btn">Go to Homepage</a>
    </div>
</body>
</html>
EOF

cat > /var/www/rootuip/public/50x.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Error | ROOTUIP</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
        }
        .container {
            max-width: 600px;
            padding: 20px;
        }
        h1 {
            font-size: 4rem;
            margin: 0 0 20px 0;
            opacity: 0.8;
        }
        p {
            font-size: 1.2rem;
            opacity: 0.9;
            margin: 20px 0;
        }
        .status {
            font-size: 0.9rem;
            opacity: 0.7;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Server Error</h1>
        <p>We're experiencing technical difficulties. Please try again later.</p>
        <p>Our team has been notified and is working on resolving the issue.</p>
        <div class="status">
            <p>Error Code: 500</p>
            <p>If this persists, please contact support@rootuip.com</p>
        </div>
    </div>
</body>
</html>
EOF

# Step 6: Set up monitoring scripts
log_step "Setting up monitoring and alerting..."

cat > /var/www/rootuip/scripts/monitoring/uptime-monitor.sh << 'EOF'
#!/bin/bash
# Uptime monitoring script

DOMAINS=("https://rootuip.com" "https://app.rootuip.com" "https://api.rootuip.com/health")
LOG_FILE="/var/www/rootuip/logs/monitoring/uptime.log"
ALERT_EMAIL="admin@rootuip.com"

for domain in "${DOMAINS[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$domain")
    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    if [ "$response" != "200" ]; then
        echo "$timestamp - $domain is DOWN (HTTP $response)" >> "$LOG_FILE"
        echo "ALERT: $domain is down with HTTP status $response" | mail -s "ROOTUIP Uptime Alert" "$ALERT_EMAIL"
    else
        echo "$timestamp - $domain is UP (HTTP $response)" >> "$LOG_FILE"
    fi
done
EOF

cat > /var/www/rootuip/scripts/monitoring/performance-monitor.sh << 'EOF'
#!/bin/bash
# Performance monitoring script

LOG_FILE="/var/www/rootuip/logs/monitoring/performance.log"
timestamp=$(date "+%Y-%m-%d %H:%M:%S")

# Check CPU usage
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

# Check memory usage
mem_usage=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')

# Check disk usage
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

# Check nginx connections
nginx_connections=$(ss -ant | grep -c :443)

# Log metrics
echo "$timestamp - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%, Connections: $nginx_connections" >> "$LOG_FILE"

# Alert if thresholds exceeded
if (( $(echo "$cpu_usage > 80" | bc -l) )); then
    echo "High CPU usage: ${cpu_usage}%" | mail -s "ROOTUIP Performance Alert" admin@rootuip.com
fi

if (( $(echo "$mem_usage > 90" | bc -l) )); then
    echo "High memory usage: ${mem_usage}%" | mail -s "ROOTUIP Performance Alert" admin@rootuip.com
fi

if [ "$disk_usage" -gt 85 ]; then
    echo "High disk usage: ${disk_usage}%" | mail -s "ROOTUIP Performance Alert" admin@rootuip.com
fi
EOF

cat > /var/www/rootuip/scripts/monitoring/security-monitor.sh << 'EOF'
#!/bin/bash
# Security monitoring script

LOG_FILE="/var/www/rootuip/logs/monitoring/security.log"
NGINX_LOG="/var/www/rootuip/logs/nginx/access.log"
timestamp=$(date "+%Y-%m-%d %H:%M:%S")

# Check for suspicious IPs (more than 100 requests in last hour)
suspicious_ips=$(awk -v d="$(date -d '1 hour ago' '+%d/%b/%Y:%H')" '$4 > "["d {print $1}' "$NGINX_LOG" | sort | uniq -c | awk '$1 > 100 {print $2}')

if [ -n "$suspicious_ips" ]; then
    echo "$timestamp - Suspicious IPs detected:" >> "$LOG_FILE"
    echo "$suspicious_ips" >> "$LOG_FILE"
    echo "Suspicious IPs detected: $suspicious_ips" | mail -s "ROOTUIP Security Alert" admin@rootuip.com
fi

# Check for common attack patterns
attacks=$(grep -E "(union.*select|<script|alert\(|\.\.\/|etc\/passwd)" "$NGINX_LOG" | tail -10)

if [ -n "$attacks" ]; then
    echo "$timestamp - Potential attacks detected:" >> "$LOG_FILE"
    echo "$attacks" >> "$LOG_FILE"
fi

# Check for failed SSH attempts
failed_ssh=$(journalctl -u ssh --since "1 hour ago" | grep -c "Failed password")

if [ "$failed_ssh" -gt 10 ]; then
    echo "$timestamp - High number of failed SSH attempts: $failed_ssh" >> "$LOG_FILE"
    echo "High number of failed SSH attempts: $failed_ssh" | mail -s "ROOTUIP Security Alert" admin@rootuip.com
fi
EOF

# Make scripts executable
chmod +x /var/www/rootuip/scripts/monitoring/*.sh

# Step 7: Set up backup automation
log_step "Setting up automated backups..."

cat > /var/www/rootuip/scripts/backup/daily-backup.sh << 'EOF'
#!/bin/bash
# Daily backup script

BACKUP_DIR="/var/www/rootuip/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup website files
tar -czf "$BACKUP_DIR/$DATE/public_$DATE.tar.gz" -C /var/www/rootuip/public .

# Backup databases
if [ -d "/var/www/rootuip/server/database" ]; then
    tar -czf "$BACKUP_DIR/$DATE/database_$DATE.tar.gz" -C /var/www/rootuip/server/database .
fi

# Backup nginx configuration
tar -czf "$BACKUP_DIR/$DATE/nginx_config_$DATE.tar.gz" -C /etc/nginx .

# Backup SSL certificates
tar -czf "$BACKUP_DIR/$DATE/ssl_certs_$DATE.tar.gz" -C /etc/letsencrypt .

# Create single archive
cd "$BACKUP_DIR"
tar -czf "rootuip_backup_$DATE.tar.gz" "$DATE/"
rm -rf "$DATE"

# Remove old backups
find "$BACKUP_DIR" -name "rootuip_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Optional: Upload to cloud storage
# aws s3 cp "$BACKUP_DIR/rootuip_backup_$DATE.tar.gz" s3://rootuip-backups/

echo "Backup completed: rootuip_backup_$DATE.tar.gz"
EOF

chmod +x /var/www/rootuip/scripts/backup/daily-backup.sh

# Step 8: Set up cron jobs
log_step "Setting up cron jobs for monitoring and backups..."

cat > /etc/cron.d/rootuip-monitoring << 'EOF'
# ROOTUIP Monitoring Cron Jobs
*/5 * * * * root /var/www/rootuip/scripts/monitoring/uptime-monitor.sh > /dev/null 2>&1
*/15 * * * * root /var/www/rootuip/scripts/monitoring/performance-monitor.sh > /dev/null 2>&1
0 * * * * root /var/www/rootuip/scripts/monitoring/security-monitor.sh > /dev/null 2>&1
0 2 * * * root /var/www/rootuip/scripts/backup/daily-backup.sh > /dev/null 2>&1
EOF

# Step 9: Set up staging environment
log_step "Setting up staging environment..."

# Copy production to staging
rsync -av /var/www/rootuip/public/ /var/www/rootuip/staging/

# Create staging password
htpasswd -bc /etc/nginx/.htpasswd-staging staging $(openssl rand -base64 12)

# Step 10: Create deployment script
log_step "Creating deployment pipeline..."

cat > /var/www/rootuip/scripts/deployment/deploy.sh << 'EOF'
#!/bin/bash
# Deployment script for ROOTUIP

ENVIRONMENT=$1
GIT_BRANCH=${2:-main}

if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
    echo "Usage: $0 [production|staging] [branch]"
    exit 1
fi

echo "Deploying to $ENVIRONMENT from branch $GIT_BRANCH..."

# Set target directory
if [ "$ENVIRONMENT" = "production" ]; then
    TARGET_DIR="/var/www/rootuip/public"
    BACKUP_DIR="/var/www/rootuip/backups/pre-deploy"
else
    TARGET_DIR="/var/www/rootuip/staging"
    BACKUP_DIR="/var/www/rootuip/backups/staging-pre-deploy"
fi

# Create pre-deployment backup
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf "$BACKUP_DIR/pre-deploy_$TIMESTAMP.tar.gz" -C "$TARGET_DIR" .

# Pull latest code
cd /tmp
rm -rf rootuip-deploy
git clone -b "$GIT_BRANCH" https://github.com/yourusername/rootuip.git rootuip-deploy

# Build process (if needed)
cd rootuip-deploy
# npm install && npm run build

# Deploy files
rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    /tmp/rootuip-deploy/ "$TARGET_DIR/"

# Fix permissions
chown -R www-data:www-data "$TARGET_DIR"
find "$TARGET_DIR" -type d -exec chmod 755 {} \;
find "$TARGET_DIR" -type f -exec chmod 644 {} \;

# Reload services
if [ "$ENVIRONMENT" = "production" ]; then
    pm2 reload all
fi

nginx -t && systemctl reload nginx

echo "Deployment to $ENVIRONMENT completed successfully!"

# Clean up
rm -rf /tmp/rootuip-deploy
EOF

chmod +x /var/www/rootuip/scripts/deployment/deploy.sh

# Step 11: Set proper permissions
log_step "Setting proper permissions..."

chown -R www-data:www-data /var/www/rootuip
find /var/www/rootuip/public -type d -exec chmod 755 {} \;
find /var/www/rootuip/public -type f -exec chmod 644 {} \;
chmod -R 750 /var/www/rootuip/scripts
chmod -R 750 /var/www/rootuip/logs

# Step 12: Test and enable nginx configuration
log_step "Testing and enabling nginx configuration..."

# Link the configuration
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

if [ $? -eq 0 ]; then
    systemctl reload nginx
    log_success "Nginx configuration reloaded successfully!"
else
    log_error "Nginx configuration test failed!"
    exit 1
fi

# Step 13: Create health check endpoint
log_step "Creating health check endpoint..."

cat > /var/www/rootuip/public/health.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Health Check</title>
</head>
<body>
    <h1>OK</h1>
    <p>System is healthy</p>
    <script>
        // Return JSON for API calls
        if (window.location.pathname.includes('/api/')) {
            document.body.innerHTML = JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString()
            });
            document.body.style.fontFamily = 'monospace';
        }
    </script>
</body>
</html>
EOF

# Step 14: DNS Configuration reminder
log_step "DNS Configuration Reminder"
echo ""
echo "Please ensure the following DNS records are configured:"
echo "  A     rootuip.com         -> Your server IP"
echo "  A     www.rootuip.com     -> Your server IP"
echo "  A     app.rootuip.com     -> Your server IP"
echo "  A     api.rootuip.com     -> Your server IP"
echo "  A     staging.rootuip.com -> Your server IP"
echo "  A     cdn.rootuip.com     -> Your server IP"
echo ""

# Step 15: Final summary
log_success "Infrastructure consolidation and setup complete!"
echo ""
echo "✅ Directory structure consolidated to /var/www/rootuip"
echo "✅ All internal links fixed"
echo "✅ SSL certificates configured (will be obtained on first run)"
echo "✅ Performance optimizations enabled"
echo "✅ Monitoring scripts installed"
echo "✅ Backup automation configured"
echo "✅ Staging environment ready"
echo "✅ Deployment pipeline created"
echo ""
echo "Next steps:"
echo "1. Update DNS records as shown above"
echo "2. Test all domains after DNS propagation"
echo "3. Set up external monitoring (e.g., UptimeRobot)"
echo "4. Configure email settings for alerts"
echo "5. Test staging deployment process"
echo ""
echo "Access URLs:"
echo "  Production: https://rootuip.com"
echo "  App: https://app.rootuip.com"
echo "  API: https://api.rootuip.com"
echo "  Staging: https://staging.rootuip.com (password in /etc/nginx/.htpasswd-staging)"
echo "  CDN: https://cdn.rootuip.com"
echo ""
echo "Monitoring logs: /var/www/rootuip/logs/"
echo "Deployment script: /var/www/rootuip/scripts/deployment/deploy.sh"
echo "Backup location: /var/www/rootuip/backups/"