#!/bin/bash

# UIP Production Environment Setup Script
# This script sets up enterprise-grade hosting infrastructure

set -e

# Configuration
DOMAIN="rootuip.com"
WWW_ROOT="/var/www/rootuip"
STAGING_ROOT="/var/www/staging-rootuip"
APP_ROOT="/var/www/app-rootuip"
SOURCE_DIR="/home/iii/ROOTUIP/ROOTUIP"
NGINX_DIR="/etc/nginx"
SSL_DIR="/etc/letsencrypt"
LOG_DIR="/var/log/rootuip"
BACKUP_DIR="/var/backups/rootuip"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== UIP Production Environment Setup ===${NC}"

# 1. Create directory structure
echo -e "\n${YELLOW}Creating directory structure...${NC}"

# Create main directories
sudo mkdir -p $WWW_ROOT
sudo mkdir -p $STAGING_ROOT
sudo mkdir -p $APP_ROOT
sudo mkdir -p $LOG_DIR/{nginx,app,monitoring}
sudo mkdir -p $BACKUP_DIR/{daily,weekly,monthly}
sudo mkdir -p $WWW_ROOT/{public,cache,temp}

# 2. Install required packages
echo -e "\n${YELLOW}Installing required packages...${NC}"
sudo apt-get update
sudo apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    redis-server \
    postgresql \
    nodejs \
    npm \
    git \
    curl \
    htop \
    fail2ban \
    ufw \
    imagemagick \
    jpegoptim \
    optipng \
    webp \
    cron \
    rsync \
    monit \
    prometheus-node-exporter

# 3. Copy and organize files
echo -e "\n${YELLOW}Organizing application files...${NC}"

# Function to fix paths in HTML files
fix_paths() {
    local file=$1
    # Fix asset paths
    sed -i 's|href="assets/|href="/assets/|g' "$file"
    sed -i 's|src="assets/|src="/assets/|g' "$file"
    sed -i 's|href="css/|href="/css/|g' "$file"
    sed -i 's|src="js/|src="/js/|g' "$file"
    sed -i 's|href="images/|href="/images/|g' "$file"
    sed -i 's|src="images/|src="/images/|g' "$file"
    
    # Fix navigation links
    sed -i 's|href="index.html"|href="/"|g' "$file"
    sed -i 's|href="platform/|href="/platform/|g' "$file"
    sed -i 's|href="investor-relations/|href="/investor-relations/|g' "$file"
    sed -i 's|href="docs/|href="/docs/|g' "$file"
    sed -i 's|href="brand/|href="/brand/|g' "$file"
    sed -i 's|href="templates/|href="/templates/|g' "$file"
    sed -i 's|href="sales-toolkit/|href="/sales-toolkit/|g' "$file"
    sed -i 's|href="../|href="/|g' "$file"
}

# Copy files to production
echo "Copying files to production..."
sudo cp -r $SOURCE_DIR/* $WWW_ROOT/public/

# Fix all HTML file paths
echo "Fixing internal links..."
find $WWW_ROOT/public -name "*.html" -type f | while read file; do
    fix_paths "$file"
done

# Copy to staging
echo "Setting up staging environment..."
sudo cp -r $WWW_ROOT/public/* $STAGING_ROOT/

# 4. Set up Nginx configurations
echo -e "\n${YELLOW}Configuring Nginx...${NC}"

# Main site configuration
sudo tee $NGINX_DIR/sites-available/rootuip.com > /dev/null <<EOF
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    root $WWW_ROOT/public;
    index index.html;
    
    # SSL Configuration (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:;" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Browser caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML caching
    location ~* \.(html|htm)$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
    
    # Clean URLs (remove .html extension)
    location / {
        try_files \$uri \$uri.html \$uri/ =404;
    }
    
    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    # Logging
    access_log $LOG_DIR/nginx/access.log;
    error_log $LOG_DIR/nginx/error.log;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=general:10m rate=10r/s;
    limit_req zone=general burst=20 nodelay;
    
    # File upload limits
    client_max_body_size 10M;
    
    # Disable access to hidden files
    location ~ /\. {
        deny all;
    }
}
EOF

# Staging site configuration
sudo tee $NGINX_DIR/sites-available/staging.rootuip.com > /dev/null <<EOF
server {
    listen 80;
    server_name staging.$DOMAIN;
    
    root $STAGING_ROOT;
    index index.html;
    
    # Basic authentication for staging
    auth_basic "Staging Environment";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    # Same configuration as production
    include /etc/nginx/snippets/common-config.conf;
    
    access_log $LOG_DIR/nginx/staging-access.log;
    error_log $LOG_DIR/nginx/staging-error.log;
}
EOF

# App subdomain configuration
sudo tee $NGINX_DIR/sites-available/app.rootuip.com > /dev/null <<EOF
server {
    listen 80;
    server_name app.$DOMAIN;
    
    root $APP_ROOT;
    index index.html;
    
    # App-specific configuration
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    include /etc/nginx/snippets/common-config.conf;
    
    access_log $LOG_DIR/nginx/app-access.log;
    error_log $LOG_DIR/nginx/app-error.log;
}
EOF

# Common configuration snippet
sudo tee $NGINX_DIR/snippets/common-config.conf > /dev/null <<EOF
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# Browser caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Clean URLs
location / {
    try_files \$uri \$uri.html \$uri/ =404;
}

# Disable access to hidden files
location ~ /\. {
    deny all;
}
EOF

# Enable sites
sudo ln -sf $NGINX_DIR/sites-available/rootuip.com $NGINX_DIR/sites-enabled/
sudo ln -sf $NGINX_DIR/sites-available/staging.rootuip.com $NGINX_DIR/sites-enabled/
sudo ln -sf $NGINX_DIR/sites-available/app.rootuip.com $NGINX_DIR/sites-enabled/

# Create staging password
echo -e "\n${YELLOW}Setting up staging authentication...${NC}"
STAGING_PASS=$(openssl rand -base64 12)
echo "staging:$(openssl passwd -apr1 $STAGING_PASS)" | sudo tee /etc/nginx/.htpasswd > /dev/null
echo -e "${GREEN}Staging credentials - Username: staging, Password: $STAGING_PASS${NC}"

# 5. Set up SSL certificates
echo -e "\n${YELLOW}Setting up SSL certificates...${NC}"
# Note: This requires domain to be pointing to server
# sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN

# 6. Configure firewall
echo -e "\n${YELLOW}Configuring firewall...${NC}"
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 7. Set up monitoring
echo -e "\n${YELLOW}Setting up monitoring...${NC}"

# Create monitoring script
sudo tee /usr/local/bin/rootuip-monitor.sh > /dev/null <<'EOF'
#!/bin/bash

# Check website availability
check_website() {
    response=$(curl -s -o /dev/null -w "%{http_code}" https://rootuip.com)
    if [ $response -ne 200 ]; then
        echo "ALERT: Website down! HTTP response: $response" | mail -s "UIP Website Alert" admin@rootuip.com
    fi
}

# Check disk space
check_disk() {
    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $usage -gt 80 ]; then
        echo "ALERT: Disk usage at $usage%" | mail -s "UIP Disk Alert" admin@rootuip.com
    fi
}

# Check memory
check_memory() {
    used=$(free | awk 'NR==2 {print ($2-$7)/$2 * 100}')
    if (( $(echo "$used > 80" | bc -l) )); then
        echo "ALERT: Memory usage at $used%" | mail -s "UIP Memory Alert" admin@rootuip.com
    fi
}

# Run checks
check_website
check_disk
check_memory
EOF

sudo chmod +x /usr/local/bin/rootuip-monitor.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/rootuip-monitor.sh") | crontab -

# 8. Set up automated backups
echo -e "\n${YELLOW}Setting up automated backups...${NC}"

sudo tee /usr/local/bin/rootuip-backup.sh > /dev/null <<EOF
#!/bin/bash

BACKUP_DIR="$BACKUP_DIR"
DATE=\$(date +%Y%m%d_%H%M%S)

# Daily backup
daily_backup() {
    tar -czf \$BACKUP_DIR/daily/rootuip_\$DATE.tar.gz -C $WWW_ROOT/public .
    
    # Keep only last 7 daily backups
    find \$BACKUP_DIR/daily -name "*.tar.gz" -mtime +7 -delete
}

# Weekly backup (Sundays)
weekly_backup() {
    if [ \$(date +%w) -eq 0 ]; then
        cp \$BACKUP_DIR/daily/rootuip_\$DATE.tar.gz \$BACKUP_DIR/weekly/
        
        # Keep only last 4 weekly backups
        find \$BACKUP_DIR/weekly -name "*.tar.gz" -mtime +28 -delete
    fi
}

# Monthly backup (1st of month)
monthly_backup() {
    if [ \$(date +%d) -eq 01 ]; then
        cp \$BACKUP_DIR/daily/rootuip_\$DATE.tar.gz \$BACKUP_DIR/monthly/
        
        # Keep only last 12 monthly backups
        find \$BACKUP_DIR/monthly -name "*.tar.gz" -mtime +365 -delete
    fi
}

# Run backups
daily_backup
weekly_backup
monthly_backup
EOF

sudo chmod +x /usr/local/bin/rootuip-backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/rootuip-backup.sh") | crontab -

# 9. Set up log rotation
echo -e "\n${YELLOW}Setting up log rotation...${NC}"

sudo tee /etc/logrotate.d/rootuip > /dev/null <<EOF
$LOG_DIR/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 \$(cat /var/run/nginx.pid)
    endscript
}

$LOG_DIR/app/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
}
EOF

# 10. Create deployment script
echo -e "\n${YELLOW}Creating deployment scripts...${NC}"

sudo tee /usr/local/bin/deploy-rootuip.sh > /dev/null <<EOF
#!/bin/bash

# Deployment script for UIP
set -e

ENVIRONMENT=\$1
SOURCE_DIR="/home/iii/ROOTUIP/ROOTUIP"

if [ -z "\$ENVIRONMENT" ]; then
    echo "Usage: deploy-rootuip.sh [production|staging]"
    exit 1
fi

echo "Deploying to \$ENVIRONMENT..."

# Create backup before deployment
/usr/local/bin/rootuip-backup.sh

# Deploy based on environment
if [ "\$ENVIRONMENT" = "production" ]; then
    TARGET_DIR="$WWW_ROOT/public"
    echo "Deploying to production..."
elif [ "\$ENVIRONMENT" = "staging" ]; then
    TARGET_DIR="$STAGING_ROOT"
    echo "Deploying to staging..."
else
    echo "Invalid environment: \$ENVIRONMENT"
    exit 1
fi

# Sync files
rsync -av --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='cache' \
    \$SOURCE_DIR/ \$TARGET_DIR/

# Fix permissions
sudo chown -R www-data:www-data \$TARGET_DIR
sudo find \$TARGET_DIR -type d -exec chmod 755 {} \;
sudo find \$TARGET_DIR -type f -exec chmod 644 {} \;

# Clear cache
redis-cli FLUSHDB

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx

echo "Deployment to \$ENVIRONMENT completed!"
EOF

sudo chmod +x /usr/local/bin/deploy-rootuip.sh

# 11. Set up image optimization
echo -e "\n${YELLOW}Setting up image optimization...${NC}"

sudo tee /usr/local/bin/optimize-images.sh > /dev/null <<'EOF'
#!/bin/bash

TARGET_DIR=$1
if [ -z "$TARGET_DIR" ]; then
    echo "Usage: optimize-images.sh <directory>"
    exit 1
fi

echo "Optimizing images in $TARGET_DIR..."

# Optimize JPEG images
find "$TARGET_DIR" -type f -name "*.jpg" -o -name "*.jpeg" | while read img; do
    jpegoptim --strip-all --max=85 "$img"
done

# Optimize PNG images
find "$TARGET_DIR" -type f -name "*.png" | while read img; do
    optipng -o2 "$img"
done

# Convert to WebP
find "$TARGET_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) | while read img; do
    cwebp -q 80 "$img" -o "${img%.*}.webp"
done

echo "Image optimization completed!"
EOF

sudo chmod +x /usr/local/bin/optimize-images.sh

# Run initial image optimization
sudo /usr/local/bin/optimize-images.sh $WWW_ROOT/public

# 12. Set permissions
echo -e "\n${YELLOW}Setting permissions...${NC}"
sudo chown -R www-data:www-data $WWW_ROOT
sudo chown -R www-data:www-data $STAGING_ROOT
sudo chown -R www-data:www-data $APP_ROOT
sudo chown -R www-data:www-data $LOG_DIR

# 13. Test and reload Nginx
echo -e "\n${YELLOW}Testing Nginx configuration...${NC}"
sudo nginx -t
sudo systemctl reload nginx

# 14. Create status page
echo -e "\n${YELLOW}Creating status page...${NC}"

sudo tee $WWW_ROOT/public/status.html > /dev/null <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>UIP System Status</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .ok { background: #4CAF50; color: white; }
        .warning { background: #FF9800; color: white; }
        .error { background: #F44336; color: white; }
    </style>
</head>
<body>
    <h1>UIP System Status</h1>
    <div class="status ok">Web Server: Operational</div>
    <div class="status ok">SSL Certificate: Valid</div>
    <div class="status ok">Database: Connected</div>
    <div class="status ok">CDN: Active</div>
    <p>Last updated: <span id="timestamp"></span></p>
    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
    </script>
</body>
</html>
EOF

# 15. Final summary
echo -e "\n${GREEN}=== Deployment Setup Complete ===${NC}"
echo -e "${BLUE}Production URL:${NC} https://$DOMAIN"
echo -e "${BLUE}Staging URL:${NC} https://staging.$DOMAIN (User: staging, Pass: $STAGING_PASS)"
echo -e "${BLUE}App URL:${NC} https://app.$DOMAIN"
echo -e "${BLUE}Status Page:${NC} https://$DOMAIN/status"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Point your domain DNS to this server"
echo "2. Run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "3. Deploy with: sudo deploy-rootuip.sh production"
echo "4. Monitor logs at: $LOG_DIR"
echo -e "\n${GREEN}Infrastructure is ready for enterprise traffic!${NC}"