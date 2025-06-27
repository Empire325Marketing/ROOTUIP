#!/bin/bash

# Security Hardening and Image Optimization Script
# This script implements comprehensive security measures and image optimization

set -e

echo "=== Starting Security Hardening and Image Optimization ==="

# Update system packages
echo "1. Updating system packages..."
apt-get update
apt-get upgrade -y

# 1. Install and Configure fail2ban
echo "2. Installing and configuring fail2ban..."
apt-get install -y fail2ban

# Create fail2ban configuration directory
mkdir -p /etc/fail2ban/jail.d/

# Configure SSH jail
cat > /etc/fail2ban/jail.d/ssh.conf << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
ignoreip = 127.0.0.1/8 ::1
EOF

# Configure Nginx jail for DDoS and brute force protection
cat > /etc/fail2ban/jail.d/nginx.conf << 'EOF'
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
findtime = 600

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 10
bantime = 3600
findtime = 60

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400
findtime = 600

[nginx-noproxy]
enabled = true
port = http,https
filter = nginx-noproxy
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400
findtime = 60

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
findtime = 60
EOF

# Create custom application jail
cat > /etc/fail2ban/jail.d/custom-app.conf << 'EOF'
[custom-app-auth]
enabled = true
port = http,https
filter = custom-app-auth
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600
findtime = 600
action = iptables-multiport[name=custom-app, port="http,https", protocol=tcp]
         sendmail-whois[name=custom-app, sender=fail2ban@example.com, dest=admin@example.com]
EOF

# Create custom filter for application
cat > /etc/fail2ban/filter.d/custom-app-auth.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* "POST /api/auth/login.*" 401
            ^<HOST> .* "POST /platform/auth/login.*" 401
            ^<HOST> .* "GET /api/.*" 403
ignoreregex =
EOF

# Configure email alerts
cat > /etc/fail2ban/jail.d/defaults.conf << 'EOF'
[DEFAULT]
destemail = admin@example.com
sender = fail2ban@example.com
mta = sendmail
action = %(action_mwl)s
EOF

# Configure whitelisting
cat > /etc/fail2ban/jail.d/whitelist.conf << 'EOF'
[DEFAULT]
# Add your trusted IPs here
ignoreip = 127.0.0.1/8 ::1
           10.0.0.0/8
           172.16.0.0/12
           192.168.0.0/16
EOF

# 2. Install and configure image optimization tools
echo "3. Installing image optimization tools..."
apt-get install -y imagemagick jpegoptim optipng pngquant webp gifsicle

# Create image optimization script
cat > /usr/local/bin/optimize-images.sh << 'EOF'
#!/bin/bash

# Image optimization script
# Usage: optimize-images.sh <directory>

UPLOAD_DIR="${1:-/var/www/uploads}"
QUALITY=85
WEBP_QUALITY=80

# Function to optimize JPEG images
optimize_jpeg() {
    local file="$1"
    jpegoptim --max="$QUALITY" --strip-all --all-progressive "$file"
}

# Function to optimize PNG images
optimize_png() {
    local file="$1"
    pngquant --quality=65-80 --skip-if-larger --strip --force --output "$file" "$file"
    optipng -o2 -strip all "$file"
}

# Function to optimize GIF images
optimize_gif() {
    local file="$1"
    gifsicle --batch --optimize=3 "$file"
}

# Function to create WebP versions
create_webp() {
    local file="$1"
    local webp_file="${file%.*}.webp"
    cwebp -q "$WEBP_QUALITY" "$file" -o "$webp_file" 2>/dev/null
}

# Function to generate responsive images
generate_responsive() {
    local file="$1"
    local basename=$(basename "$file")
    local dirname=$(dirname "$file")
    local filename="${basename%.*}"
    local extension="${basename##*.}"
    
    # Generate different sizes
    for size in 320 640 768 1024 1366 1920; do
        local output="${dirname}/${filename}-${size}w.${extension}"
        convert "$file" -resize "${size}x>" -quality "$QUALITY" "$output"
        
        # Also create WebP version
        create_webp "$output"
    done
}

# Main optimization loop
find "$UPLOAD_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" \) -print0 | while IFS= read -r -d '' file; do
    echo "Optimizing: $file"
    
    case "${file,,}" in
        *.jpg|*.jpeg)
            optimize_jpeg "$file"
            create_webp "$file"
            generate_responsive "$file"
            ;;
        *.png)
            optimize_png "$file"
            create_webp "$file"
            generate_responsive "$file"
            ;;
        *.gif)
            optimize_gif "$file"
            ;;
    esac
done

echo "Image optimization complete!"
EOF

chmod +x /usr/local/bin/optimize-images.sh

# Create systemd service for image optimization on upload
cat > /etc/systemd/system/image-optimizer.service << 'EOF'
[Unit]
Description=Image Optimization Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/image-optimizer-daemon.sh
Restart=always
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF

# Create image optimizer daemon
cat > /usr/local/bin/image-optimizer-daemon.sh << 'EOF'
#!/bin/bash

WATCH_DIR="/var/www/uploads"
PROCESSED_DIR="/var/www/uploads/.processed"

mkdir -p "$PROCESSED_DIR"

inotifywait -m -r -e create -e moved_to "$WATCH_DIR" --format '%w%f' | while read file; do
    # Skip if already processed
    if [[ "$file" == *"/.processed/"* ]]; then
        continue
    fi
    
    # Check if it's an image
    if [[ "$file" =~ \.(jpg|jpeg|png|gif|JPG|JPEG|PNG|GIF)$ ]]; then
        echo "New image detected: $file"
        /usr/local/bin/optimize-images.sh "$(dirname "$file")"
        
        # Mark as processed
        touch "$PROCESSED_DIR/$(basename "$file").done"
    fi
done
EOF

chmod +x /usr/local/bin/image-optimizer-daemon.sh

# Install inotify-tools
apt-get install -y inotify-tools

# 3. Configure Nginx for lazy loading and responsive images
echo "4. Configuring Nginx for image optimization..."

# Create Nginx configuration for images
cat > /etc/nginx/conf.d/image-optimization.conf << 'EOF'
# Image optimization and caching configuration

# Enable gzip compression for images
gzip_types image/svg+xml;

# Cache configuration for images
location ~* \.(jpg|jpeg|png|gif|webp|svg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary "Accept";
    
    # Try to serve WebP images to supported browsers
    if ($http_accept ~* "webp") {
        set $webp_suffix ".webp";
    }
    
    # Check if WebP version exists and serve it
    try_files $uri$webp_suffix $uri =404;
}

# Lazy loading configuration
location /js/lazy-load.js {
    alias /var/www/html/js/lazy-load.js;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
EOF

# Create lazy loading JavaScript
cat > /var/www/html/js/lazy-load.js << 'EOF'
// Lazy loading implementation
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
});

// Responsive image loading
function loadResponsiveImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;
    
    if (srcset) {
        img.srcset = srcset;
    }
    img.src = src;
}
EOF

# 4. Configure UFW firewall
echo "5. Configuring UFW firewall..."
apt-get install -y ufw

# Configure UFW rules
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw limit 22/tcp
ufw --force enable

# 5. Harden SSH configuration
echo "6. Hardening SSH configuration..."
cat > /etc/ssh/sshd_config.d/hardening.conf << 'EOF'
# SSH Hardening Configuration
Protocol 2
PermitRootLogin prohibit-password
PasswordAuthentication no
PermitEmptyPasswords no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 60
X11Forwarding no
AllowUsers root
EOF

# 6. Configure Nginx security headers
echo "7. Configuring Nginx security headers..."
cat > /etc/nginx/conf.d/security-headers.conf << 'EOF'
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Hide Nginx version
server_tokens off;

# Prevent clickjacking
add_header X-Frame-Options DENY;

# Enable HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
EOF

# 7. Configure rate limiting
echo "8. Configuring rate limiting..."
cat > /etc/nginx/conf.d/rate-limiting.conf << 'EOF'
# Rate limiting configuration
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

# Connection limiting
limit_conn_zone $binary_remote_addr zone=addr:10m;

# Apply rate limiting to locations
limit_req zone=general burst=20 nodelay;
limit_conn addr 10;
EOF

# 8. Configure CORS policies
echo "9. Configuring CORS policies..."
cat > /etc/nginx/conf.d/cors.conf << 'EOF'
# CORS configuration
map $http_origin $cors_header {
    default "";
    ~^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$ $http_origin;
    ~^https?://([a-zA-Z0-9-]+\.)?yourdomain\.com$ $http_origin;
}

# CORS headers
add_header 'Access-Control-Allow-Origin' $cors_header always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
EOF

# 9. Create security monitoring script
echo "10. Creating security monitoring..."
cat > /usr/local/bin/security-monitor.sh << 'EOF'
#!/bin/bash

# Security monitoring script
LOG_DIR="/var/log/security-monitor"
mkdir -p "$LOG_DIR"

# Monitor failed SSH attempts
monitor_ssh() {
    echo "[$(date)] SSH Failed Attempts:" >> "$LOG_DIR/ssh-monitor.log"
    grep "Failed password" /var/log/auth.log | tail -20 >> "$LOG_DIR/ssh-monitor.log"
}

# Monitor fail2ban bans
monitor_fail2ban() {
    echo "[$(date)] Fail2ban Bans:" >> "$LOG_DIR/fail2ban-monitor.log"
    fail2ban-client status | grep "Jail list" -A 1 >> "$LOG_DIR/fail2ban-monitor.log"
    
    # Get detailed status for each jail
    for jail in $(fail2ban-client status | grep "Jail list" | sed 's/.*://;s/,//g'); do
        echo "Jail: $jail" >> "$LOG_DIR/fail2ban-monitor.log"
        fail2ban-client status "$jail" | grep -E "Currently|Total" >> "$LOG_DIR/fail2ban-monitor.log"
    done
}

# Monitor firewall blocks
monitor_firewall() {
    echo "[$(date)] UFW Status:" >> "$LOG_DIR/firewall-monitor.log"
    ufw status verbose >> "$LOG_DIR/firewall-monitor.log"
}

# Monitor Nginx errors
monitor_nginx() {
    echo "[$(date)] Recent Nginx Errors:" >> "$LOG_DIR/nginx-monitor.log"
    tail -50 /var/log/nginx/error.log >> "$LOG_DIR/nginx-monitor.log"
}

# Run all monitors
monitor_ssh
monitor_fail2ban
monitor_firewall
monitor_nginx

echo "Security monitoring complete. Logs saved to $LOG_DIR"
EOF

chmod +x /usr/local/bin/security-monitor.sh

# Create cron job for monitoring
echo "*/15 * * * * /usr/local/bin/security-monitor.sh" | crontab -

# 10. Restart services
echo "11. Restarting services..."
systemctl restart ssh
systemctl restart fail2ban
systemctl restart nginx
systemctl enable image-optimizer.service
systemctl start image-optimizer.service

# Create documentation
echo "12. Creating security documentation..."
cat > /root/SECURITY_DOCUMENTATION.md << 'EOF'
# Security Hardening Documentation

## Overview
This document describes the security measures implemented on this server.

## 1. Fail2ban Configuration

### SSH Protection
- Maximum 3 login attempts allowed
- Ban time: 1 hour
- Find time: 10 minutes
- Log location: /var/log/auth.log

### Nginx Protection
- HTTP Auth: Max 5 attempts, 1 hour ban
- Bad bots: Max 2 attempts, 24 hour ban
- Request limiting: Max 10 attempts, 10 minute ban
- DDoS protection enabled

### Custom Application Jail
- Monitors failed API authentication attempts
- Email alerts configured for bans
- Log location: /var/log/nginx/access.log

### Whitelisted IPs
- Localhost (127.0.0.1)
- Private networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)

## 2. Image Optimization

### Tools Installed
- ImageMagick: General image processing
- jpegoptim: JPEG optimization
- optipng/pngquant: PNG optimization
- cwebp: WebP conversion
- gifsicle: GIF optimization

### Optimization Features
- Automatic optimization on upload
- WebP conversion for modern browsers
- Responsive image generation (320w to 1920w)
- Quality settings: JPEG 85%, WebP 80%

### Optimization Script
- Location: /usr/local/bin/optimize-images.sh
- Systemd service: image-optimizer.service
- Watch directory: /var/www/uploads

## 3. Firewall Configuration (UFW)

### Allowed Ports
- SSH (22): Rate limited
- HTTP (80): Open
- HTTPS (443): Open

### Default Policies
- Incoming: Deny
- Outgoing: Allow

## 4. SSH Hardening

### Security Measures
- Protocol 2 only
- Root login: Key authentication only
- Password authentication: Disabled
- Max auth tries: 3
- Login grace time: 60 seconds
- X11 forwarding: Disabled

## 5. Nginx Security Headers

### Headers Configured
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: HSTS enabled
- Content-Security-Policy: Configured
- Permissions-Policy: Camera, microphone, geolocation denied

## 6. Rate Limiting

### Zones Configured
- General: 10 requests/second
- Login: 5 requests/minute
- API: 30 requests/second
- Connection limit: 10 per IP

## 7. CORS Configuration

### Allowed Origins
- localhost (all ports)
- Your production domain

### Allowed Methods
- GET, POST, PUT, DELETE, OPTIONS

## 8. Security Monitoring

### Monitoring Script
- Location: /usr/local/bin/security-monitor.sh
- Runs every 15 minutes via cron
- Logs location: /var/log/security-monitor/

### Monitored Items
- SSH failed attempts
- Fail2ban bans
- Firewall status
- Nginx errors

## 9. Log Locations

- SSH logs: /var/log/auth.log
- Fail2ban logs: /var/log/fail2ban.log
- Nginx logs: /var/log/nginx/
- Security monitor logs: /var/log/security-monitor/

## 10. Maintenance Commands

### Check fail2ban status
```bash
fail2ban-client status
fail2ban-client status sshd
```

### Check firewall status
```bash
ufw status verbose
```

### Run security monitoring
```bash
/usr/local/bin/security-monitor.sh
```

### Optimize images manually
```bash
/usr/local/bin/optimize-images.sh /path/to/images
```

### View recent bans
```bash
tail -f /var/log/fail2ban.log
```

## 11. Email Configuration

To receive email alerts, update the following files with your email:
- /etc/fail2ban/jail.d/defaults.conf
- /etc/fail2ban/jail.d/custom-app.conf

## 12. Emergency Procedures

### Unban an IP
```bash
fail2ban-client unban <IP>
```

### Disable firewall (emergency only)
```bash
ufw disable
```

### Add IP to whitelist
1. Edit /etc/fail2ban/jail.d/whitelist.conf
2. Add IP to ignoreip list
3. Restart fail2ban: systemctl restart fail2ban
EOF

echo "=== Security Hardening Complete ==="
echo "Documentation saved to /root/SECURITY_DOCUMENTATION.md"
echo ""
echo "IMPORTANT NOTES:"
echo "1. Update email addresses in fail2ban configuration for alerts"
echo "2. Add your trusted IPs to the whitelist"
echo "3. Test all configurations before production use"
echo "4. Review security logs regularly"
echo ""
echo "Monitor security events with: /usr/local/bin/security-monitor.sh"