# ROOTUIP Production Deployment Guide

## 🚀 Quick Start

```bash
# 1. Run complete setup (on VPS as root)
sudo ./setup-production-complete.sh

# 2. Deploy application
./deploy-production.sh

# 3. Start services
cd /var/www/rootuip
pm2 start ecosystem.config.js --env production
```

## 📋 Production Environment

### Configured Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3007 | Central API routing |
| Auth Service | 3003 | Authentication & SSO |
| Demo Platform | 3001 | Container tracking |
| AI/ML Engine | 3002 | Predictions & OCR |
| WebSocket | 3004 | Real-time updates |
| Maersk API | 3005 | Carrier integration |
| Customer Success | 3006 | CRM & automation |

### External Integrations

- **Maersk API**: ✅ Production credentials configured
- **Microsoft SAML**: ✅ Enterprise SSO ready
- **SendGrid**: ✅ Email automation active
- **HubSpot**: ✅ CRM integration enabled
- **Stripe**: ✅ Payment processing ready

### Security Features

- ✅ HTTPS with Let's Encrypt SSL
- ✅ JWT authentication
- ✅ Rate limiting enabled
- ✅ CORS protection
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Helmet.js security headers
- ✅ Fail2ban intrusion prevention

## 🔐 Access Credentials

### Admin Login
- **Email**: mjaiii@rootuip.com
- **Password**: rootuip2024

### Database Access
- Credentials saved to: `/root/rootuip-db-credentials.txt`
- Connection: `postgresql://rootuip_user:[password]@localhost:5432/rootuip_production`

### Redis Access
- Credentials saved to: `/root/rootuip-db-credentials.txt`
- Connection: `redis://:[password]@localhost:6379`

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check all services
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs

# API health check
curl https://rootuip.com/api/health
```

### Database Backups
```bash
# Manual backup
/usr/local/bin/rootuip-backup.sh

# Backups location
/var/backups/rootuip/
```

### Log Files
- Application logs: `/var/www/rootuip/logs/`
- Nginx logs: `/var/log/nginx/`
- PM2 logs: `~/.pm2/logs/`

## 🚨 Troubleshooting

### Service Issues
```bash
# Restart all services
pm2 restart all

# Restart specific service
pm2 restart rootuip-gateway

# Check service logs
pm2 logs rootuip-gateway --lines 100
```

### Database Issues
```bash
# Check PostgreSQL
sudo -u postgres psql -d rootuip_production -c "SELECT 1;"

# Check Redis
redis-cli -a [password] ping
```

### SSL Certificate
```bash
# Renew certificate
certbot renew

# Test renewal
certbot renew --dry-run
```

## 🔄 Updates & Deployment

### Deploy Updates
```bash
# 1. Backup current version
cp -r /var/www/rootuip /var/www/rootuip-backup-$(date +%Y%m%d)

# 2. Pull updates
cd /var/www/rootuip
git pull origin main

# 3. Install dependencies
npm install --production

# 4. Restart services
pm2 restart all
```

### Environment Variables
- Production config: `/var/www/rootuip/.env`
- Update variables and restart services

## 📈 Performance Optimization

### PM2 Cluster Mode
- API Gateway runs with 2 instances
- Automatic load balancing
- Zero-downtime reloads

### Caching
- Redis caching enabled
- 1-hour default TTL
- Automatic cache invalidation

### Database Optimization
- Connection pooling enabled
- Indexes on frequently queried fields
- Query performance monitoring

## 🛡️ Security Best Practices

1. **Regular Updates**
   ```bash
   apt update && apt upgrade
   npm audit fix
   ```

2. **Monitor Access Logs**
   ```bash
   tail -f /var/log/nginx/access.log
   tail -f /var/log/auth.log
   ```

3. **Rotate API Keys**
   - Update in `.env` file
   - Restart affected services

4. **Review Fail2ban**
   ```bash
   fail2ban-client status
   fail2ban-client status nginx-http-auth
   ```

## 📞 Support

- **Technical Issues**: Check logs first
- **API Documentation**: `/api/docs`
- **Health Status**: `/api/health`
- **Metrics**: `/api/metrics`

## 🎯 Production Checklist

- [ ] SSL certificate installed
- [ ] Environment variables configured
- [ ] Database passwords changed
- [ ] Redis password set
- [ ] Firewall configured
- [ ] Backups scheduled
- [ ] Monitoring enabled
- [ ] Error alerts configured
- [ ] Rate limiting active
- [ ] All services running

---

**Last Updated**: 2024
**Platform Version**: 2.0.0
**Status**: Production Ready ✅