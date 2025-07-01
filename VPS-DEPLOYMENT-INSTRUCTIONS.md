# ROOTUIP VPS Deployment Instructions

## Quick Deployment Steps for VPS 145.223.73.4

### Prerequisites
- SSH access to VPS as root or sudo user
- Ubuntu 20.04 LTS or higher
- At least 4GB RAM and 2 CPU cores

### Step 1: Connect to VPS
```bash
ssh root@145.223.73.4
# or
ssh your-username@145.223.73.4
```

### Step 2: Clone or Upload Project Files
```bash
# If using git
git clone https://github.com/your-repo/ROOTUIP.git
cd ROOTUIP

# Or upload files via SCP from local machine
scp -r /home/iii/ROOTUIP/* root@145.223.73.4:/home/rootuip/
```

### Step 3: Execute Combined Deployment Script
```bash
# Make script executable
chmod +x deploy-database-and-fix-services.sh

# Run the deployment
sudo ./deploy-database-and-fix-services.sh
```

### Step 4: Verify Deployment
After deployment completes, verify everything is working:

```bash
# Check database connections
sudo /usr/local/bin/rootuip-db-health.sh

# Check service status
pm2 status

# Monitor services in real-time
pm2 monit

# View service logs
pm2 logs
```

### Step 5: Configure Production Environment

1. **Update Environment Variables**
   ```bash
   nano .env.production
   ```
   Add your production API keys:
   - MAERSK_CLIENT_ID
   - MAERSK_CLIENT_SECRET
   - SENDGRID_API_KEY
   - HUBSPOT_ACCESS_TOKEN
   - STRIPE_SECRET_KEY

2. **Restart Services**
   ```bash
   pm2 restart all
   ```

3. **Configure SSL**
   ```bash
   sudo certbot --nginx -d api.rootuip.com -d rootuip.com
   ```

### Step 6: DNS Configuration
Update your DNS records:
- `A` record for `rootuip.com` → `145.223.73.4`
- `A` record for `api.rootuip.com` → `145.223.73.4`
- `A` record for `www.rootuip.com` → `145.223.73.4`

### Alternative: Manual Deployment

If you prefer to run scripts separately:

1. **Database Setup Only**
   ```bash
   sudo ./database-infrastructure-setup.sh
   ```

2. **Microservices Fix Only**
   ```bash
   ./fix-microservices.sh
   ```

3. **Start Services Manually**
   ```bash
   pm2 start ecosystem.config.js
   ```

### Troubleshooting

**Database Connection Issues**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql@15-main

# Check pgBouncer status
sudo systemctl status pgbouncer

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

**Service Issues**
```bash
# Restart specific service
pm2 restart api-gateway

# View detailed logs
pm2 logs api-gateway --lines 100

# Clear logs
pm2 flush
```

**Port Conflicts**
```bash
# Check what's using a port
sudo lsof -i :3000

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:3000)
```

### Production Checklist

- [ ] Database infrastructure deployed
- [ ] All microservices running
- [ ] Nginx configured for API Gateway
- [ ] SSL certificates installed
- [ ] Environment variables configured
- [ ] DNS records updated
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] User flow tested successfully

### Support

If you encounter issues:
1. Check service logs: `pm2 logs`
2. Check database health: `sudo /usr/local/bin/rootuip-db-health.sh`
3. Review nginx error logs: `sudo tail -f /var/log/nginx/error.log`

## Complete in 10 Minutes! 🚀