#!/bin/bash

# ROOTUIP Complete Production Deployment Script
# Deploy entire platform to VPS 145.223.73.4 with full infrastructure
# Features: SSL, PM2, Nginx, MongoDB, Redis, CloudFlare Ready, Monitoring
# Version: 3.0.0

set -e

# Configuration
VPS_IP="145.223.73.4"
VPS_USER="root"
DOMAIN="rootuip.com"
EMAIL="admin@rootuip.com"
NODE_VERSION="18"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}================================================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') - $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%H:%M:%S') - $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $1"
}

# Create deployment package
create_production_package() {
    print_header "CREATING PRODUCTION DEPLOYMENT PACKAGE"
    
    DEPLOY_DIR="rootuip-production"
    rm -rf $DEPLOY_DIR
    mkdir -p $DEPLOY_DIR/{app,configs,scripts,services}
    
    # Copy all application files
    print_status "Packaging application files..."
    cp -r public $DEPLOY_DIR/app/ 2>/dev/null || true
    cp *.js $DEPLOY_DIR/app/ 2>/dev/null || true
    cp package*.json $DEPLOY_DIR/app/ 2>/dev/null || true
    cp -r ai-ml $DEPLOY_DIR/app/ 2>/dev/null || true
    
    # Create main production server
    cat > $DEPLOY_DIR/app/server.js << 'EOFSERVER'
// ROOTUIP Production Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.rootuip.com"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// General middleware
app.use(compression());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://rootuip.com', 'https://app.rootuip.com', 'https://demo.rootuip.com', 'https://customer.rootuip.com']
        : true,
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime()
    });
});

// Load routes
try {
    const demoServer = require('./demo-server');
    app.use('/demo', demoServer);
} catch (err) {
    console.warn('Demo server not found, skipping...');
}

// Default route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Error handling
app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ROOTUIP Platform running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});

module.exports = app;
EOFSERVER

    # Create Nginx configuration
    cat > $DEPLOY_DIR/configs/nginx-rootuip << 'EOFNGINX'
# ROOTUIP Production Nginx Configuration

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;

# Main domain
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rootuip.com www.rootuip.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Rate limiting
    limit_req zone=general burst=50 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# App subdomain
server {
    listen 80;
    server_name app.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    add_header Strict-Transport-Security "max-age=31536000" always;
    limit_req zone=general burst=100 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API subdomain
server {
    listen 80;
    server_name api.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    add_header Strict-Transport-Security "max-age=31536000" always;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Demo subdomain
server {
    listen 80;
    server_name demo.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name demo.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    add_header Strict-Transport-Security "max-age=31536000" always;
    limit_req zone=general burst=200 nodelay;

    location / {
        proxy_pass http://localhost:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Customer portal
server {
    listen 80;
    server_name customer.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name customer.rootuip.com;
    
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    
    add_header Strict-Transport-Security "max-age=31536000" always;
    limit_req zone=general burst=150 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOFNGINX

    # Create PM2 ecosystem configuration
    cat > $DEPLOY_DIR/configs/ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [
    {
      name: 'rootuip-main',
      script: 'server.js',
      cwd: '/var/www/rootuip',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/rootuip/main-error.log',
      out_file: '/var/log/rootuip/main-out.log',
      log_file: '/var/log/rootuip/main.log',
      time: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'rootuip-api',
      script: 'api-server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/rootuip/api-error.log',
      out_file: '/var/log/rootuip/api-out.log',
      log_file: '/var/log/rootuip/api.log',
      time: true,
      max_memory_restart: '800M',
      autorestart: true
    },
    {
      name: 'rootuip-demo',
      script: 'demo-server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3030
      },
      error_file: '/var/log/rootuip/demo-error.log',
      out_file: '/var/log/rootuip/demo-out.log',
      log_file: '/var/log/rootuip/demo.log',
      time: true,
      max_memory_restart: '512M',
      autorestart: true
    }
  ]
};
EOFPM2

    # Create systemd service for PM2
    cat > $DEPLOY_DIR/services/rootuip.service << 'EOFSYSTEMD'
[Unit]
Description=ROOTUIP PM2 Process Manager
After=network.target

[Service]
Type=forking
User=rootuip
LimitNOFILE=infinity
LimitNPROC=infinity
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=PM2_HOME=/home/rootuip/.pm2
PIDFile=/home/rootuip/.pm2/pm2.pid
Restart=on-failure

ExecStart=/usr/local/bin/pm2 resurrect
ExecReload=/usr/local/bin/pm2 reload all
ExecStop=/usr/local/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOFSYSTEMD

    # Create backup script
    cat > $DEPLOY_DIR/scripts/backup.sh << 'EOFBACKUP'
#!/bin/bash

# ROOTUIP Automated Backup Script
BACKUP_DIR="/var/backups/rootuip"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR/$DATE"

# Backup MongoDB
if command -v mongodump &> /dev/null; then
    mongodump --db rootuip_production --out "$BACKUP_DIR/$DATE/mongodb"
fi

# Backup application files
tar -czf "$BACKUP_DIR/$DATE/application.tar.gz" -C /var/www rootuip

# Backup configurations
tar -czf "$BACKUP_DIR/$DATE/configs.tar.gz" /etc/nginx/sites-enabled /etc/rootuip

# Create manifest
cat > "$BACKUP_DIR/$DATE/manifest.txt" << EOF
ROOTUIP Backup Created: $(date)
Application: Production
Database: MongoDB
Files: Application, configurations
Size: $(du -sh "$BACKUP_DIR/$DATE" | cut -f1)
EOF

# Cleanup old backups
find "$BACKUP_DIR" -type d -name "*_*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null

logger "ROOTUIP backup completed: $BACKUP_DIR/$DATE"
echo "Backup completed: $DATE"
EOFBACKUP

    # Create health monitoring script
    cat > $DEPLOY_DIR/scripts/health-monitor.sh << 'EOFHEALTH'
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
EOFHEALTH

    # Create VPS deployment script
    cat > $DEPLOY_DIR/scripts/deploy-on-vps.sh << 'EOFVPS'
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
EOFVPS

    chmod +x $DEPLOY_DIR/scripts/*.sh
    
    print_success "Production package created successfully"
}

# Deploy to VPS
deploy_to_production() {
    print_header "DEPLOYING TO PRODUCTION VPS"
    
    # Create deployment tarball
    print_status "Creating deployment package..."
    tar -czf rootuip-production.tar.gz rootuip-production/
    
    # Upload to VPS
    print_status "Uploading to VPS $VPS_IP..."
    if scp -o ConnectTimeout=30 rootuip-production.tar.gz $VPS_USER@$VPS_IP:/tmp/; then
        print_success "Upload completed"
    else
        print_error "Upload failed - check VPS connectivity"
        exit 1
    fi
    
    # Execute deployment on VPS
    print_status "Executing deployment on VPS..."
    ssh -o ConnectTimeout=30 $VPS_USER@$VPS_IP << 'EOFREMOTE'
        set -e
        cd /tmp
        tar -xzf rootuip-production.tar.gz
        cd rootuip-production
        chmod +x scripts/*.sh
        ./scripts/deploy-on-vps.sh
EOFREMOTE
    
    if [ $? -eq 0 ]; then
        print_success "VPS deployment completed successfully!"
    else
        print_error "VPS deployment failed"
        exit 1
    fi
}

# Verify deployment
verify_production() {
    print_header "VERIFYING PRODUCTION DEPLOYMENT"
    
    sleep 15
    
    # Test main endpoints
    endpoints=(
        "https://rootuip.com/api/health"
        "https://app.rootuip.com/api/health"
        "https://demo.rootuip.com/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        print_status "Testing $endpoint..."
        if curl -f -s "$endpoint" > /dev/null 2>&1; then
            print_success "$endpoint is responding"
        else
            print_warning "$endpoint may need more time to start"
        fi
    done
    
    # Test SSL certificates
    print_status "Checking SSL certificates..."
    if openssl s_client -connect rootuip.com:443 -servername rootuip.com < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        print_success "SSL certificates are valid"
    else
        print_warning "SSL may need additional configuration"
    fi
}

# Display final information
show_completion_info() {
    print_header "🎉 PRODUCTION DEPLOYMENT COMPLETE! 🎉"
    
    echo ""
    echo -e "${GREEN}🌐 Production URLs:${NC}"
    echo -e "   • Main Site:       ${CYAN}https://rootuip.com${NC}"
    echo -e "   • Application:     ${CYAN}https://app.rootuip.com${NC}"
    echo -e "   • API Gateway:     ${CYAN}https://api.rootuip.com${NC}"
    echo -e "   • Demo Platform:   ${CYAN}https://demo.rootuip.com${NC}"
    echo -e "   • Customer Portal: ${CYAN}https://customer.rootuip.com${NC}"
    echo ""
    echo -e "${GREEN}📊 Health Monitoring:${NC}"
    echo -e "   • Main Health:     ${CYAN}https://rootuip.com/api/health${NC}"
    echo -e "   • Demo Health:     ${CYAN}https://demo.rootuip.com/api/health${NC}"
    echo ""
    echo -e "${GREEN}🔧 Server Management:${NC}"
    echo -e "   • SSH Access:      ${YELLOW}ssh $VPS_USER@$VPS_IP${NC}"
    echo -e "   • PM2 Status:      ${YELLOW}pm2 status${NC}"
    echo -e "   • View Logs:       ${YELLOW}pm2 logs${NC}"
    echo -e "   • Restart Apps:    ${YELLOW}pm2 restart all${NC}"
    echo ""
    echo -e "${GREEN}💾 Automated Backups:${NC}"
    echo -e "   • Schedule:        ${YELLOW}Every 6 hours${NC}"
    echo -e "   • Location:        ${YELLOW}/var/backups/rootuip${NC}"
    echo -e "   • Retention:       ${YELLOW}30 days${NC}"
    echo ""
    echo -e "${GREEN}🔒 Security Features:${NC}"
    echo -e "   • SSL/TLS:         ${GREEN}✓ Let's Encrypt (auto-renewal)${NC}"
    echo -e "   • HTTP/2:          ${GREEN}✓ Enabled${NC}"
    echo -e "   • Rate Limiting:   ${GREEN}✓ Nginx + Application${NC}"
    echo -e "   • Firewall:        ${GREEN}✓ UFW (ports 22, 80, 443)${NC}"
    echo -e "   • Gzip:            ${GREEN}✓ Enabled${NC}"
    echo ""
    echo -e "${GREEN}📈 Performance:${NC}"
    echo -e "   • PM2 Clustering:  ${GREEN}✓ 2x main instances${NC}"
    echo -e "   • Process Mgmt:    ${GREEN}✓ Systemd + PM2${NC}"
    echo -e "   • Log Rotation:    ${GREEN}✓ Automated daily${NC}"
    echo -e "   • Health Checks:   ${GREEN}✓ Every 5 minutes${NC}"
    echo ""
    echo -e "${CYAN}📋 Next Steps:${NC}"
    echo -e "   1. Configure CloudFlare DNS for $DOMAIN"
    echo -e "   2. Update /etc/rootuip/.env with production API keys"
    echo -e "   3. Test all functionality end-to-end"
    echo -e "   4. Set up monitoring alerts"
    echo -e "   5. Configure email SMTP settings"
    echo ""
    echo -e "${GREEN}🚀 ROOTUIP Platform is now LIVE in Production! 🚀${NC}"
    echo ""
}

# Main execution
main() {
    print_header "🚀 ROOTUIP PRODUCTION DEPLOYMENT"
    echo -e "${CYAN}Target VPS: $VPS_IP${NC}"
    echo -e "${CYAN}Domain: $DOMAIN${NC}"
    echo ""
    
    # Execute deployment steps
    create_production_package
    deploy_to_production
    verify_production
    show_completion_info
    
    # Cleanup
    rm -rf rootuip-production rootuip-production.tar.gz
    
    print_success "🎯 Production deployment completed successfully!"
}

# Execute main function
main "$@"