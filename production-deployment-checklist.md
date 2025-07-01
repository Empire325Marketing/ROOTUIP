# ROOTUIP Production Deployment Checklist

## Pre-Deployment Checklist

### Infrastructure Preparation
- [ ] VPS server accessible at 145.223.73.4
- [ ] SSH access configured with key-based authentication
- [ ] Domain `rootuip.com` pointing to correct nameservers
- [ ] CloudFlare account set up and ready
- [ ] SSL certificate email address confirmed: admin@rootuip.com

### Code & Dependencies
- [ ] All application code committed to repository
- [ ] Package.json dependencies verified and tested
- [ ] Environment variables template prepared
- [ ] Database migration scripts ready
- [ ] Static assets optimized and compressed

### Security Preparation
- [ ] JWT secrets generated
- [ ] API keys collected and secured
- [ ] Database passwords created
- [ ] Backup encryption keys prepared
- [ ] Firewall rules planned

---

## Deployment Execution

### Step 1: Run Deployment Script
```bash
# Execute the comprehensive deployment script
./deploy-production-complete.sh
```

**Expected Duration**: 15-20 minutes

**What it does**:
- ✅ Updates VPS system packages
- ✅ Installs Node.js 18, PM2, MongoDB, Redis, Nginx
- ✅ Creates application user and directory structure
- ✅ Configures production environment variables
- ✅ Sets up SSL certificates with Let's Encrypt
- ✅ Configures nginx reverse proxy for all subdomains
- ✅ Sets up PM2 clustering and process management
- ✅ Configures automated backups every 6 hours
- ✅ Sets up health monitoring every 5 minutes
- ✅ Enables firewall with secure rules
- ✅ Configures log rotation and system maintenance

### Step 2: Verify Core Services
```bash
# SSH into the server
ssh root@145.223.73.4

# Check service status
systemctl status nginx
systemctl status mongod
systemctl status redis-server
pm2 status

# Test health endpoints
curl http://localhost:3000/api/health
curl http://localhost:3002/api/health
curl http://localhost:3030/api/health
```

### Step 3: Test SSL and Domains
```bash
# Test SSL certificates
openssl s_client -connect rootuip.com:443 -servername rootuip.com
openssl s_client -connect app.rootuip.com:443 -servername app.rootuip.com

# Test all subdomains
curl -I https://rootuip.com/api/health
curl -I https://app.rootuip.com/api/health
curl -I https://api.rootuip.com/api/health
curl -I https://demo.rootuip.com/api/health
curl -I https://customer.rootuip.com/api/health
```

---

## CloudFlare Configuration

### Step 4: Configure DNS Records
1. **Login to CloudFlare Dashboard**
2. **Add A Records** (with Proxy Status ENABLED ☁️):
   ```
   Type    Name        Content         Proxy
   A       @           145.223.73.4    ☁️ Proxied
   A       www         145.223.73.4    ☁️ Proxied
   A       app         145.223.73.4    ☁️ Proxied
   A       api         145.223.73.4    ☁️ Proxied
   A       demo        145.223.73.4    ☁️ Proxied
   A       customer    145.223.73.4    ☁️ Proxied
   ```

### Step 5: Configure SSL/TLS Settings
- [ ] Set encryption mode to **"Full (strict)"**
- [ ] Enable **"Always Use HTTPS"**
- [ ] Configure **HSTS** with 6-month max age
- [ ] Enable **TLS 1.3**

### Step 6: Set Up Security Rules
- [ ] Create firewall rule for API rate limiting (10 req/min)
- [ ] Create firewall rule for auth rate limiting (5 req/min)
- [ ] Enable Bot Fight Mode
- [ ] Configure threat score blocking (>10)

### Step 7: Configure Caching Rules
- [ ] Set API endpoints to bypass cache
- [ ] Configure static assets for long-term caching
- [ ] Set up HTML caching with 4-hour TTL
- [ ] Enable compression and minification

---

## Environment Configuration

### Step 8: Update Production Environment
Edit `/etc/rootuip/.env` on the VPS:

```bash
# Update these critical values:
SMTP_HOST=your_smtp_host
SMTP_USER=your_smtp_user  
SMTP_PASS=your_smtp_password

# Add real API keys
MAERSK_API_KEY=your_maersk_key
MSC_API_KEY=your_msc_key
COSCO_API_KEY=your_cosco_key

# Add monitoring keys
SENTRY_DSN=your_sentry_dsn
NEW_RELIC_LICENSE_KEY=your_newrelic_key
```

### Step 9: Restart Services
```bash
# Restart PM2 processes to pick up new environment
pm2 restart all

# Verify configuration loaded
pm2 logs | grep "Environment loaded"
```

---

## Testing & Validation

### Step 10: Functional Testing

#### Core Platform Tests
- [ ] **Main site loads**: https://rootuip.com
- [ ] **Application loads**: https://app.rootuip.com  
- [ ] **API responds**: https://api.rootuip.com/api/health
- [ ] **Demo works**: https://demo.rootuip.com
- [ ] **Customer portal**: https://customer.rootuip.com

#### API Endpoint Tests
```bash
# Test main API endpoints
curl https://api.rootuip.com/api/version
curl https://api.rootuip.com/api/health

# Test demo endpoints
curl https://demo.rootuip.com/api/health
curl https://demo.rootuip.com/api/demo/status
```

#### Security Tests
```bash
# Test rate limiting
for i in {1..15}; do curl https://api.rootuip.com/api/health; done

# Test HTTPS redirect
curl -I http://rootuip.com

# Test security headers
curl -I https://rootuip.com | grep -E "(Strict-Transport|X-Frame|X-Content)"
```

#### Performance Tests
```bash
# Test compression
curl -H "Accept-Encoding: gzip" -I https://rootuip.com

# Test HTTP/2
curl --http2 -I https://rootuip.com

# Test response times
time curl -s https://rootuip.com/api/health
```

### Step 11: Monitoring Validation
- [ ] **Health checks running**: `/usr/local/bin/rootuip-health-check.sh`
- [ ] **Backup system active**: Check `/var/backups/rootuip`
- [ ] **Log rotation working**: Check `/var/log/rootuip`
- [ ] **SSL auto-renewal**: `certbot certificates`

---

## Go-Live Checklist

### Step 12: Final Pre-Launch
- [ ] All tests passing ✅
- [ ] SSL certificates valid ✅
- [ ] CloudFlare configuration complete ✅
- [ ] Monitoring and alerting active ✅
- [ ] Backup system verified ✅
- [ ] Performance optimized ✅

### Step 13: Launch Validation
- [ ] **DNS propagation complete** (24-48 hours)
- [ ] **All subdomains accessible globally**
- [ ] **Email notifications working**
- [ ] **Analytics tracking active**
- [ ] **Error monitoring functional**

### Step 14: Post-Launch Monitoring
**First 24 Hours**:
- [ ] Monitor error rates and response times
- [ ] Check SSL certificate status
- [ ] Verify backup completion
- [ ] Monitor system resources
- [ ] Review access logs for issues

**First Week**:
- [ ] Review performance metrics
- [ ] Optimize cache hit ratios
- [ ] Fine-tune rate limiting
- [ ] Monitor security events
- [ ] Collect user feedback

---

## Rollback Plan

### If Issues Occur During Deployment

#### Critical Service Failure
```bash
# Stop problematic services
pm2 stop all
systemctl stop nginx

# Restore from backup
cd /var/backups/rootuip
# Find latest backup
ls -la

# Restore application
tar -xzf latest_backup/application.tar.gz -C /var/www/

# Restart services
systemctl start nginx
pm2 resurrect
```

#### Database Issues
```bash
# Stop application
pm2 stop all

# Restore MongoDB from backup
mongorestore --db rootuip_production /var/backups/rootuip/latest/mongodb/rootuip_production

# Restart application
pm2 start all
```

#### SSL Certificate Issues
```bash
# Regenerate certificates
certbot --nginx --force-renewal \
  -d rootuip.com \
  -d www.rootuip.com \
  -d app.rootuip.com \
  -d api.rootuip.com \
  -d demo.rootuip.com \
  -d customer.rootuip.com

# Restart nginx
systemctl restart nginx
```

---

## Maintenance Schedule

### Daily (Automated)
- ✅ Health checks every 5 minutes
- ✅ Log rotation
- ✅ Resource monitoring
- ✅ SSL certificate validation

### Every 6 Hours (Automated)
- ✅ Full system backup
- ✅ Database backup
- ✅ Configuration backup

### Weekly (Manual)
- [ ] Review health check logs
- [ ] Monitor performance metrics
- [ ] Check for system updates
- [ ] Review security logs
- [ ] Verify backup integrity

### Monthly (Manual)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Update dependencies
- [ ] Review and rotate API keys
- [ ] Disaster recovery test

---

## Troubleshooting Common Issues

### Issue: Site Not Loading
**Check**:
1. VPS server status: `systemctl status nginx`
2. DNS resolution: `dig rootuip.com`
3. CloudFlare proxy status
4. SSL certificate validity

**Fix**:
```bash
# Restart nginx
systemctl restart nginx

# Check nginx logs
tail -f /var/log/nginx/error.log

# Test configuration
nginx -t
```

### Issue: API Not Responding
**Check**:
1. PM2 process status: `pm2 status`
2. Application logs: `pm2 logs`
3. Database connectivity
4. Environment variables

**Fix**:
```bash
# Restart API service
pm2 restart rootuip-api

# Check environment
pm2 env 0

# Test database connection
mongosh --eval "db.adminCommand('ping')"
```

### Issue: SSL Certificate Problems
**Check**:
1. Certificate expiration: `certbot certificates`
2. CloudFlare SSL mode
3. Origin certificate validity

**Fix**:
```bash
# Renew certificates
certbot renew --force-renewal

# Restart nginx
systemctl restart nginx
```

### Issue: High Server Load
**Check**:
1. Resource usage: `htop`
2. PM2 memory usage: `pm2 monit`
3. Database performance
4. Log file sizes

**Fix**:
```bash
# Restart PM2 processes
pm2 restart all

# Clean up logs
logrotate -f /etc/logrotate.d/rootuip

# Monitor resources
watch -n 1 'free -h && uptime'
```

---

## Success Criteria

### Technical Metrics
- [ ] **Uptime**: >99.9%
- [ ] **Response Time**: <500ms average
- [ ] **Error Rate**: <0.1%
- [ ] **SSL Score**: A+ rating
- [ ] **Security Headers**: All implemented
- [ ] **Page Speed**: >90 score

### Functional Requirements  
- [ ] All subdomains accessible
- [ ] API endpoints responding correctly
- [ ] Demo platform fully functional
- [ ] Customer portal operational
- [ ] Real-time features working
- [ ] File uploads functioning
- [ ] Email notifications sending

### Security Requirements
- [ ] SSL/TLS encryption enforced
- [ ] Rate limiting active
- [ ] Firewall configured correctly
- [ ] Intrusion detection enabled
- [ ] Security headers implemented
- [ ] Backup encryption working

### Performance Requirements
- [ ] CDN caching optimized
- [ ] Static assets cached properly
- [ ] Database queries optimized
- [ ] Memory usage stable
- [ ] CPU usage within limits
- [ ] Disk space sufficient

---

## Contact Information

### Emergency Contacts
- **Primary Admin**: admin@rootuip.com
- **Technical Lead**: tech@rootuip.com
- **Security Issues**: security@rootuip.com

### Service Providers
- **VPS Provider**: [Your VPS provider support]
- **DNS/CDN**: CloudFlare Support
- **Domain Registrar**: [Your registrar support]

### Monitoring Alerts
- **Email**: admin@rootuip.com
- **Slack**: #rootuip-alerts (if configured)
- **Phone**: [Emergency contact number]

---

**🚀 ROOTUIP Production Deployment Complete!**

**Platform Status**: ✅ LIVE at https://rootuip.com  
**Deployment Date**: [Current Date]  
**Version**: 3.1.0  
**Next Review**: [30 days from deployment]