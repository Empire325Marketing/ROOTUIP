# ROOTUIP Production Deployment Commands

## VPS Details
- **IP**: 145.223.73.4
- **Main Domain**: https://rootuip.com
- **App Domain**: https://app.rootuip.com (SAML Auth)
- **OS**: Ubuntu

## Quick Deployment Steps

### 1. Connect to VPS
```bash
ssh root@145.223.73.4
```

### 2. Clone/Update Repository
```bash
cd /home/iii
# If not cloned yet:
git clone https://github.com/your-repo/ROOTUIP.git
# Or update:
cd ROOTUIP && git pull
```

### 3. Run Main Deployment Script
```bash
cd /home/iii/ROOTUIP
sudo bash deploy-rootuip-production.sh
```

### 4. Update Environment Variables
```bash
# Copy production environment
cp .env.production .env

# Edit with your actual API keys
nano .env
```

### 5. Set Up SSL (After DNS Propagation)
```bash
# Run this after DNS records point to 145.223.73.4
sudo bash quick-ssl-setup.sh
```

## DNS Configuration Required

Add these A records to your DNS provider:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | 145.223.73.4 | 300 |
| A | www | 145.223.73.4 | 300 |
| A | app | 145.223.73.4 | 300 |

## Manual Commands (If Needed)

### Start Services
```bash
cd /home/iii/ROOTUIP
pm2 start ecosystem.config.js --env production
pm2 save
```

### Configure Nginx
```bash
sudo cp nginx-config-rootuip /etc/nginx/sites-available/rootuip
sudo ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Get SSL Certificates
```bash
# For rootuip.com and www
sudo certbot certonly --webroot -w /var/www/certbot \
  -d rootuip.com -d www.rootuip.com \
  --non-interactive --agree-tos --email admin@rootuip.com

# For app.rootuip.com (CRITICAL for SAML)
sudo certbot certonly --webroot -w /var/www/certbot \
  -d app.rootuip.com \
  --non-interactive --agree-tos --email admin@rootuip.com
```

### Configure Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## Monitoring Commands

### Check All Services
```bash
pm2 status
```

### View Logs
```bash
pm2 logs
```

### Monitor Resources
```bash
pm2 monit
```

### Check Nginx
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Test HTTPS
```bash
curl -I https://rootuip.com
curl -I https://app.rootuip.com
```

### Full System Check
```bash
bash /home/iii/ROOTUIP/monitor-production.sh
```

## Troubleshooting

### Services Not Starting
```bash
# Check logs
pm2 logs --lines 100

# Restart all
pm2 restart all

# Check ports
sudo netstat -tlnp | grep -E ":(3000|3001|3004|3005|3008)"
```

### SSL Issues
```bash
# Check certificates
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

### Nginx Issues
```bash
# Check configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx
```

## Microsoft SAML Configuration

Update your Microsoft Entra ID app with:

- **Entity ID**: https://app.rootuip.com
- **Reply URL (ACS)**: https://app.rootuip.com/saml/acs
- **Sign-on URL**: https://app.rootuip.com/login

## Expected URLs After Deployment

- Marketing Site: https://rootuip.com
- ROI Calculator: https://rootuip.com/roi-calculator.html
- Enterprise Login: https://app.rootuip.com/login
- Dashboard: https://app.rootuip.com/dashboard
- Container Tracking: https://app.rootuip.com/tracking

## Support

For issues, check:
1. PM2 logs: `pm2 logs`
2. Nginx logs: `/var/log/nginx/`
3. App logs: `/home/iii/ROOTUIP/logs/`