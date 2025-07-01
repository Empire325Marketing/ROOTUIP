# 🚀 ROOTUIP Enterprise Production Deployment Guide

## Complete Infrastructure Setup for rootuip.com

This guide provides step-by-step instructions for deploying ROOTUIP's enterprise platform to production with enterprise-grade infrastructure, security, and performance.

---

## 📋 **Pre-Deployment Checklist**

### Required Information
- [ ] Production server IP address  
- [ ] Domain registrar access (for DNS configuration)
- [ ] CloudFlare account (optional but recommended)
- [ ] Production API credentials
- [ ] SMTP email service credentials

### Server Requirements
- **Minimum:** 4 CPU cores, 8GB RAM, 100GB SSD
- **Recommended:** 8 CPU cores, 16GB RAM, 200GB SSD
- **Operating System:** Ubuntu 20.04 LTS or newer
- **Network:** Static IP address with full root access

---

## 🎯 **Deployment Overview**

Our enterprise deployment includes:

1. **SSL Certificate & Security** - Let's Encrypt with auto-renewal
2. **Nginx Reverse Proxy** - High-performance web server with rate limiting
3. **PostgreSQL Database** - Enterprise-grade data storage with optimizations
4. **Redis Cache** - In-memory caching for real-time performance
5. **PM2 Process Management** - Application clustering and auto-restart
6. **Monitoring & Alerts** - Health checks and automated notifications
7. **Backup System** - Daily automated backups with retention
8. **CloudFlare CDN** - Global performance and DDoS protection

---

## 🚀 **Step 1: Execute Enterprise Deployment**

Run the comprehensive enterprise deployment script:

```bash
# Make script executable
chmod +x deploy-to-production-enterprise.sh

# Execute deployment (requires root access)
sudo ./deploy-to-production-enterprise.sh
```

**What this script does:**
- ✅ Installs and configures all required software
- ✅ Sets up PostgreSQL database with production optimizations
- ✅ Configures Redis for caching and sessions
- ✅ Creates enterprise security settings
- ✅ Installs SSL certificates with auto-renewal
- ✅ Configures Nginx with performance optimizations
- ✅ Sets up PM2 process management with clustering
- ✅ Creates monitoring and backup systems
- ✅ Optimizes system performance settings

## 📋 Manual Deployment Steps

### 1. DNS Configuration (5 minutes)
Add these A records to your DNS provider:
```
A    rootuip.com         → 145.223.73.4
A    app.rootuip.com     → 145.223.73.4
A    www.rootuip.com     → 145.223.73.4
```

### 2. SSL Certificate Setup (5 minutes)
```bash
# SSH to your VPS
ssh root@145.223.73.4

# Install Certbot
apt update
apt install -y certbot python3-certbot-nginx

# Get SSL certificates
certbot certonly --standalone -d rootuip.com -d app.rootuip.com -d www.rootuip.com
```

### 3. Upload Platform (5 minutes)
```bash
# From your local machine
rsync -avz --exclude 'node_modules' /home/iii/ROOTUIP/ root@145.223.73.4:/var/www/rootuip/
```

### 4. Server Setup (10 minutes)
```bash
# On VPS
cd /var/www/rootuip

# Install dependencies
npm install --production

# Copy production environment
cp .env.production .env

# Set permissions
chown -R www-data:www-data /var/www/rootuip
chmod -R 755 /var/www/rootuip

# Setup services
cp *.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable rootuip-app rootuip-dashboard rootuip-crm
systemctl start rootuip-app rootuip-dashboard rootuip-crm
```

### 5. Nginx Configuration
```bash
# Copy nginx config
cp nginx-production.conf /etc/nginx/sites-available/rootuip
ln -s /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
```

## 🔍 Verification Checklist

### Check Services
```bash
systemctl status rootuip-app
systemctl status rootuip-dashboard
systemctl status rootuip-crm
```

### Test Endpoints
```bash
# Main app
curl https://app.rootuip.com/health

# Landing page
curl https://rootuip.com

# WebSocket
wscat -c wss://app.rootuip.com/ws
```

### Monitor Logs
```bash
# Real-time logs
journalctl -u rootuip-app -f
journalctl -u rootuip-dashboard -f
journalctl -u rootuip-crm -f

# Nginx logs
tail -f /var/log/nginx/app.rootuip.com.access.log
tail -f /var/log/nginx/app.rootuip.com.error.log
```

## 🎯 Post-Deployment Tasks

### 1. Test SAML Authentication
1. Navigate to https://app.rootuip.com/login
2. Click "Login with Microsoft"
3. Verify redirect to Microsoft login
4. Test successful authentication flow

### 2. Database Initialization
```bash
# Create production database
sudo -u postgres psql
CREATE DATABASE uip_production;
CREATE USER uip_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE uip_production TO uip_user;
\q

# Run migrations (if any)
cd /var/www/rootuip
node scripts/init-database.js
```

### 3. Performance Monitoring
```bash
# Install monitoring tools
apt install -y htop iotop nethogs

# Check resource usage
htop
iotop
nethogs

# Monitor response times
while true; do curl -w "%{time_total}\n" -o /dev/null -s https://app.rootuip.com; sleep 5; done
```

### 4. Setup Backups
```bash
# Create backup script
cat > /usr/local/bin/backup-rootuip.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/rootuip"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U uip_user uip_production > $BACKUP_DIR/db_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/rootuip/

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-rootuip.sh

# Add to crontab
echo "0 2 * * * /usr/local/bin/backup-rootuip.sh" | crontab -
```

### 5. Setup Monitoring Alerts
```bash
# Install monitoring
apt install -y monit

# Configure monit
cat > /etc/monit/conf.d/rootuip << 'EOF'
check process rootuip-app with pidfile /var/run/rootuip-app.pid
    start program = "/bin/systemctl start rootuip-app"
    stop program = "/bin/systemctl stop rootuip-app"
    if failed host localhost port 3000 protocol http
        request "/health"
        with timeout 10 seconds
        then restart
    if 5 restarts within 5 cycles then alert

check process nginx with pidfile /var/run/nginx.pid
    start program = "/bin/systemctl start nginx"
    stop program = "/bin/systemctl stop nginx"
    if failed host localhost port 443 then restart
    if 5 restarts within 5 cycles then alert

check system $HOST
    if loadavg (1min) > 4 then alert
    if loadavg (5min) > 2 then alert
    if cpu usage > 95% for 10 cycles then alert
    if memory usage > 75% then alert
    if swap usage > 25% then alert
EOF

systemctl restart monit
```

## 🚨 Troubleshooting

### Service Won't Start
```bash
# Check logs
journalctl -u rootuip-app -n 100

# Check permissions
ls -la /var/www/rootuip

# Check ports
netstat -tlnp | grep -E '3000|3008|3010'
```

### SSL Issues
```bash
# Renew certificates
certbot renew --dry-run
certbot renew

# Check certificate
openssl s_client -connect app.rootuip.com:443 -servername app.rootuip.com
```

### Performance Issues
```bash
# Check resources
free -h
df -h
top

# Check Node.js
pm2 status
pm2 monit
```

## 📞 Support Contacts

- **Technical Issues**: Deploy logs to `/var/log/rootuip/`
- **SSL Problems**: Check certbot logs in `/var/log/letsencrypt/`
- **Application Errors**: Check journalctl for service logs

## 🎉 Success Metrics

After deployment, you should see:
- ✅ HTTPS working on all domains
- ✅ Microsoft SAML login functional
- ✅ Real-time container tracking active
- ✅ ROI calculator capturing leads
- ✅ Sub-2 second page loads
- ✅ All health checks passing

**Remember: Every day without ROOTUIP costs $45,000!**