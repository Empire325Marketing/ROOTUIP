#!/bin/bash

# VPS Deployment Script
set -e

echo "🚀 Starting ROOTUIP production deployment on VPS..."

# Update system
apt update && apt upgrade -y

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Install other packages
apt install -y nginx certbot python3-certbot-nginx redis-server \
    mongodb-org htop ufw fail2ban logrotate

# Create application user
if ! id "rootuip" &>/dev/null; then
    useradd -r -s /bin/bash -m -d /home/rootuip rootuip
    usermod -aG www-data rootuip
fi

# Create directories
mkdir -p /var/www/rootuip
mkdir -p /var/log/rootuip
mkdir -p /var/backups/rootuip
mkdir -p /etc/rootuip

# Set permissions
chown -R rootuip:www-data /var/www/rootuip
chown -R rootuip:rootuip /var/log/rootuip
chmod 755 /var/www/rootuip
chmod 755 /var/log/rootuip

# Copy application files
cp -r app/* /var/www/rootuip/
cd /var/www/rootuip

# Install dependencies
npm install --production

# Set up environment
cat > /etc/rootuip/.env << 'ENVEOF'
NODE_ENV=production
PORT=3000
DOMAIN=rootuip.com
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)
MONGODB_URI=mongodb://localhost:27017/rootuip_production
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@rootuip.com
SMTP_PASS=your_password_here
EMAIL_FROM=noreply@rootuip.com
MAX_FILE_SIZE=50MB
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
ENVEOF

chmod 600 /etc/rootuip/.env
chown root:root /etc/rootuip/.env

# Configure nginx
cp configs/nginx-rootuip /etc/nginx/sites-available/rootuip
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t

# Setup SSL certificates
certbot --nginx \
    -d rootuip.com \
    -d www.rootuip.com \
    -d app.rootuip.com \
    -d api.rootuip.com \
    -d demo.rootuip.com \
    -d customer.rootuip.com \
    --email admin@rootuip.com \
    --agree-tos \
    --non-interactive

# Setup firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Start services
systemctl restart nginx
systemctl enable nginx
systemctl start redis-server
systemctl enable redis-server
systemctl start mongod
systemctl enable mongod

# Install systemd service
cp services/rootuip.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable rootuip

# Start PM2 as rootuip user
sudo -u rootuip pm2 start configs/ecosystem.config.js
sudo -u rootuip pm2 save
sudo -u rootuip pm2 startup

# Install backup script
cp scripts/backup.sh /usr/local/bin/rootuip-backup.sh
chmod +x /usr/local/bin/rootuip-backup.sh

# Setup crontab
crontab -u rootuip << 'EOFCRON'
# Health check every 5 minutes
*/5 * * * * /var/www/rootuip/scripts/health-monitor.sh

# Backup every 6 hours
0 */6 * * * /usr/local/bin/rootuip-backup.sh

# SSL renewal check weekly
0 3 * * 0 certbot renew --quiet
EOFCRON

# Setup log rotation
cat > /etc/logrotate.d/rootuip << 'EOFLOG'
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
    endscript
}
EOFLOG

systemctl start rootuip

echo "✅ ROOTUIP production deployment completed!"
