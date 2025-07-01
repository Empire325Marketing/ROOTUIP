#!/bin/bash

# ROOTUIP Production Deployment Script
# VPS: 145.223.73.4
# Domains: rootuip.com, app.rootuip.com
# Critical: HTTPS required for SAML authentication

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_status "Starting ROOTUIP Production Deployment"
print_info "VPS IP: 145.223.73.4"
print_info "Domains: rootuip.com, app.rootuip.com"

# 1. Update system packages
print_status "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# 2. Install required dependencies
print_status "Installing system dependencies..."
apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    ufw \
    fail2ban \
    git \
    build-essential \
    curl \
    software-properties-common

# 3. Install Node.js 18 LTS
if ! command -v node &> /dev/null || [ $(node -v | cut -d'.' -f1 | cut -d'v' -f2) -lt 18 ]; then
    print_status "Installing Node.js 18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node -v)"
fi

# 4. Install PM2 globally
print_status "Installing PM2..."
npm install -g pm2
pm2 startup systemd -u iii --hp /home/iii

# 5. Configure PostgreSQL
print_status "Configuring PostgreSQL..."
sudo -u postgres psql << EOF
-- Create database and user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rootuip_production') THEN
        CREATE DATABASE rootuip_production;
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'rootuip_user') THEN
        CREATE USER rootuip_user WITH ENCRYPTED PASSWORD 'rootuip_secure_2024';
    END IF;
END\$\$;

GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip_user;
\q
EOF

# 6. Configure Redis
print_status "Configuring Redis..."
sed -i 's/^# requirepass.*/requirepass rootuip_redis_2024/' /etc/redis/redis.conf
sed -i 's/^bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

# 7. Set up production environment
print_status "Setting up production environment..."
cd /home/iii/ROOTUIP

# Create necessary directories
mkdir -p logs uploads certificates ml_models /var/www/certbot

# Set proper permissions
chown -R iii:iii /home/iii/ROOTUIP
chmod -R 755 /home/iii/ROOTUIP

# 8. Install Node.js dependencies
print_status "Installing Node.js dependencies..."
sudo -u iii npm install --production

# 9. Stop PM2 processes if running
print_status "Stopping existing PM2 processes..."
sudo -u iii pm2 kill || true

# 10. Configure Nginx
print_status "Configuring Nginx..."

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Copy our configuration
cp nginx-config-rootuip /etc/nginx/sites-available/rootuip

# Remove old symlink if exists
rm -f /etc/nginx/sites-enabled/rootuip

# Create new symlink
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/

# Create directory for Let's Encrypt challenges
mkdir -p /var/www/certbot

# 11. Configure SSL with Let's Encrypt
print_status "Setting up SSL certificates..."
print_warning "CRITICAL: SSL is required for SAML authentication on app.rootuip.com"

# Check DNS resolution
print_status "Checking DNS resolution..."
if host rootuip.com > /dev/null 2>&1; then
    print_info "rootuip.com resolves to: $(host rootuip.com | grep "has address" | awk '{print $4}')"
else
    print_error "rootuip.com DNS not resolving"
fi

if host app.rootuip.com > /dev/null 2>&1; then
    print_info "app.rootuip.com resolves to: $(host app.rootuip.com | grep "has address" | awk '{print $4}')"
else
    print_error "app.rootuip.com DNS not resolving"
fi

# Create self-signed certificates temporarily
print_status "Creating temporary self-signed certificates..."
mkdir -p /etc/letsencrypt/live/rootuip.com
mkdir -p /etc/letsencrypt/live/app.rootuip.com

# Generate self-signed for rootuip.com
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/rootuip.com/privkey.pem \
    -out /etc/letsencrypt/live/rootuip.com/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=ROOTUIP/CN=rootuip.com"

# Generate self-signed for app.rootuip.com
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/letsencrypt/live/app.rootuip.com/privkey.pem \
    -out /etc/letsencrypt/live/app.rootuip.com/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=ROOTUIP/CN=app.rootuip.com"

# Test Nginx configuration
nginx -t

# Start Nginx with self-signed certs
systemctl restart nginx

# Now attempt Let's Encrypt
print_status "Attempting to obtain Let's Encrypt certificates..."
print_info "Make sure DNS is pointing to 145.223.73.4"

# Get certificate for rootuip.com and www.rootuip.com
certbot certonly --webroot -w /var/www/certbot \
    -d rootuip.com -d www.rootuip.com \
    --non-interactive --agree-tos --email admin@rootuip.com \
    --force-renewal || print_warning "Failed to get cert for rootuip.com"

# Get certificate for app.rootuip.com (CRITICAL for SAML)
certbot certonly --webroot -w /var/www/certbot \
    -d app.rootuip.com \
    --non-interactive --agree-tos --email admin@rootuip.com \
    --force-renewal || print_warning "Failed to get cert for app.rootuip.com"

# 12. Configure UFW Firewall
print_status "Configuring firewall..."
ufw --force disable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# Block direct access to Node.js ports from outside
for port in {3000..3012}; do
    ufw deny $port/tcp
done
ufw --force enable

# 13. Configure fail2ban
print_status "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/*error.log
findtime = 600
bantime = 7200
maxretry = 10
EOF

systemctl restart fail2ban
systemctl enable fail2ban

# 14. Start all services with PM2
print_status "Starting all services with PM2..."
cd /home/iii/ROOTUIP
sudo -u iii pm2 start ecosystem.config.js --env production
sudo -u iii pm2 save

# 15. Final Nginx restart
print_status "Final Nginx restart..."
systemctl restart nginx
systemctl enable nginx

# 16. Set up log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/rootuip << EOF
/home/iii/ROOTUIP/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0640 iii iii
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# 17. Create monitoring script
print_status "Creating monitoring script..."
cat > /home/iii/ROOTUIP/monitor-production.sh << 'EOF'
#!/bin/bash
# ROOTUIP Production Monitoring

echo "===== ROOTUIP PRODUCTION STATUS ====="
echo "Time: $(date)"
echo
echo "=== Services Status ==="
pm2 list
echo
echo "=== Nginx Status ==="
systemctl status nginx --no-pager | grep Active
echo
echo "=== SSL Certificates ==="
certbot certificates
echo
echo "=== Domain Accessibility ==="
curl -sI https://rootuip.com | head -n 1
curl -sI https://app.rootuip.com | head -n 1
echo
echo "=== Recent Errors ==="
tail -n 10 /home/iii/ROOTUIP/logs/*error.log 2>/dev/null || echo "No error logs"
echo
echo "=== System Resources ==="
df -h | grep -E "^/dev/"
free -h
echo
echo "=== Active Connections ==="
ss -tunlp | grep -E ":(80|443|3000|3001|3004|3005|3008)"
EOF

chmod +x /home/iii/ROOTUIP/monitor-production.sh

# 18. Create SAML certificate if needed
print_status "Creating SAML certificates..."
mkdir -p /home/iii/ROOTUIP/certificates
cd /home/iii/ROOTUIP/certificates

if [ ! -f saml.crt ]; then
    openssl req -new -x509 -days 3650 -nodes -sha256 \
        -out saml.crt -keyout saml.key \
        -subj "/C=US/ST=State/L=City/O=ROOTUIP/CN=app.rootuip.com"
    chown iii:iii saml.*
    chmod 600 saml.key
    chmod 644 saml.crt
    print_status "SAML certificates created"
fi

# 19. Display deployment summary
print_status "Deployment complete!"
echo
echo "===== DEPLOYMENT SUMMARY ====="
echo "VPS IP: 145.223.73.4"
echo "Main Site: https://rootuip.com"
echo "App Portal: https://app.rootuip.com"
echo "SAML ACS URL: https://app.rootuip.com/saml/acs"
echo
echo "===== SERVICE STATUS ====="
sudo -u iii pm2 list
echo
echo "===== SSL STATUS ====="
certbot certificates
echo
echo "===== CRITICAL NOTES ====="
echo "1. Ensure DNS A records point to 145.223.73.4:"
echo "   - rootuip.com → 145.223.73.4"
echo "   - app.rootuip.com → 145.223.73.4"
echo "   - www.rootuip.com → 145.223.73.4"
echo
echo "2. Update .env file with production credentials"
echo
echo "3. SAML requires HTTPS on app.rootuip.com"
echo
echo "===== USEFUL COMMANDS ====="
echo "Monitor: bash /home/iii/ROOTUIP/monitor-production.sh"
echo "PM2 Status: pm2 status"
echo "PM2 Logs: pm2 logs"
echo "Nginx Logs: tail -f /var/log/nginx/*.log"
echo "Restart All: pm2 restart all"
echo
echo "===== ACCESS URLS ====="
echo "Marketing Site: https://rootuip.com"
echo "Enterprise Login: https://app.rootuip.com/login"
echo "Container Tracking: https://app.rootuip.com/dashboard"
echo
print_status "Platform ready for Fortune 500 demos!"