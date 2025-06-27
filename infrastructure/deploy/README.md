# ROOTUIP Enterprise Infrastructure Deployment

## 🚀 Quick Start

```bash
sudo bash /home/iii/ROOTUIP/infrastructure/deploy/DEPLOY-MASTER.sh
```

Select option 1 for complete production setup.

## 📋 Pre-Deployment Checklist

- [ ] Domain registered and DNS access available
- [ ] Server with Ubuntu 20.04+ (4GB RAM minimum)
- [ ] Root/sudo access to server
- [ ] Email account for alerts
- [ ] GitHub repository (optional for CI/CD)

## 🏗️ Infrastructure Components

### 1. **Production Environment** (`setup-production.sh`)
- Nginx web server with HTTP/2
- SSL certificates via Let's Encrypt
- Clean URL routing (no .html extensions)
- Organized directory structure
- Automated deployment scripts
- Security headers and rate limiting

### 2. **Performance Optimization** (`performance-config.sh`)
- Gzip/Brotli compression
- Browser caching strategies
- Redis caching layer
- CDN integration ready
- Service worker for offline support
- Critical CSS extraction
- Progressive image loading

### 3. **Monitoring & Alerts** (`monitoring-setup.sh`)
- Prometheus metrics collection
- Grafana dashboards
- Custom alert rules
- Log aggregation with Loki
- Uptime monitoring
- Performance tracking
- Security monitoring with fail2ban

### 4. **Staging Environment** (`staging-environment.sh`)
- Separate staging subdomain
- CI/CD pipeline ready
- Automated testing
- Rollback capabilities
- Email testing with Mailhog
- Password-protected access

### 5. **Master Deployment** (`DEPLOY-MASTER.sh`)
- One-click full setup
- Interactive menu system
- System status monitoring
- Backup automation
- Security hardening

## 🌐 DNS Configuration

Add these records to your domain:

```
A     @         YOUR_SERVER_IP    300
A     www       YOUR_SERVER_IP    300
A     app       YOUR_SERVER_IP    300
A     staging   YOUR_SERVER_IP    300
```

## 🔒 SSL Setup

After DNS propagation (5-30 minutes):

```bash
sudo certbot --nginx -d rootuip.com -d www.rootuip.com
```

## 📁 Directory Structure

```
/var/www/
├── rootuip/                 # Production
│   ├── public/             # Web root
│   ├── cache/              # Cache files
│   └── logs/               # Application logs
├── staging-rootuip/         # Staging
│   ├── current/            # Active release
│   ├── releases/           # Previous releases
│   └── shared/             # Shared files
└── app-rootuip/            # App subdomain
```

## 🚀 Deployment Commands

### Deploy to Production
```bash
sudo /usr/local/bin/deploy-rootuip.sh production
# or
sudo rootuip deploy
```

### Deploy to Staging
```bash
sudo /usr/local/bin/deploy-rootuip.sh staging
```

### Rollback
```bash
sudo /usr/local/bin/rollback-staging.sh
# or
sudo rootuip rollback
```

### Quick Management
```bash
# View status
sudo rootuip status

# View logs
sudo rootuip logs

# Create backup
sudo rootuip backup

# Run monitoring check
sudo rootuip monitor
```

## 📊 Monitoring Access

### Grafana Dashboard
- URL: `https://monitoring.rootuip.com`
- Username: `admin`
- Password: Check `/etc/grafana/grafana.ini`

### Prometheus Metrics
- URL: `https://monitoring.rootuip.com/prometheus`
- Username: `prometheus`
- Password: Provided during setup

### Status Pages
- System Status: `https://rootuip.com/status`
- Monitoring Status: `https://rootuip.com/monitoring-status`

## 🔧 Troubleshooting

### Check Service Status
```bash
sudo systemctl status nginx
sudo systemctl status redis
sudo systemctl status prometheus
sudo systemctl status grafana-server
```

### View Logs
```bash
# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Application logs
sudo tail -f /var/log/rootuip/app/error.log

# Monitoring logs
sudo journalctl -u prometheus -f
```

### Test Configuration
```bash
# Test Nginx config
sudo nginx -t

# Test SSL
curl -I https://rootuip.com

# Test monitoring
curl http://localhost:9090/metrics
```

## 🛡️ Security Features

- **Firewall**: UFW configured for ports 22, 80, 443
- **Fail2ban**: Protects against brute force
- **SSL/TLS**: A+ rating configuration
- **Headers**: Security headers implemented
- **Rate Limiting**: DDoS protection
- **Monitoring**: Real-time threat detection

## 📈 Performance Features

- **HTTP/2**: Enabled for all sites
- **Compression**: Gzip/Brotli active
- **Caching**: Multi-layer caching strategy
- **CDN Ready**: Easy CloudFlare integration
- **Optimization**: Image compression and WebP
- **PWA**: Service worker for offline mode

## 🔄 Backup Strategy

### Automated Backups
- **Daily**: Last 7 days retained
- **Weekly**: Last 4 weeks retained
- **Monthly**: Last 12 months retained

### Manual Backup
```bash
sudo /usr/local/bin/rootuip-backup.sh
```

### Restore from Backup
```bash
# List available backups
ls -la /var/backups/rootuip/

# Restore specific backup
tar -xzf /var/backups/rootuip/daily/rootuip_20250625_020000.tar.gz -C /var/www/rootuip/public/
```

## 📝 Configuration Files

- **Nginx**: `/etc/nginx/sites-available/rootuip.com`
- **Redis**: `/etc/redis/redis.conf`
- **Prometheus**: `/etc/prometheus/prometheus.yml`
- **Alerts**: `/etc/prometheus/alerts/alerts.yml`
- **Environment**: `/var/www/rootuip/.env`

## 🚨 Emergency Procedures

### Site Down
1. Check server status: `sudo rootuip status`
2. Restart Nginx: `sudo systemctl restart nginx`
3. Check logs: `sudo tail -100 /var/log/nginx/error.log`
4. Rollback if needed: `sudo rootuip rollback`

### High Load
1. Check metrics: Visit Grafana dashboard
2. Clear cache: `redis-cli FLUSHDB`
3. Restart services: `sudo systemctl restart nginx redis`
4. Scale up server if needed

### Security Incident
1. Check fail2ban: `sudo fail2ban-client status`
2. Review logs: `sudo grep "401\|403" /var/log/nginx/access.log`
3. Block IPs: `sudo ufw deny from MALICIOUS_IP`
4. Update passwords and review access

## 📞 Support

For infrastructure issues:
- Check monitoring dashboard first
- Review logs for specific errors
- Consult this documentation
- Contact: admin@rootuip.com

---

Last Updated: 2025-06-26
Version: 1.0.0