# ROOTUIP Final Launch Checklist & Admin Documentation

## 🚀 Pre-Launch Verification

### ✅ Infrastructure Readiness
- [ ] VPS server accessible at 145.223.73.4
- [ ] All DNS records configured in CloudFlare
- [ ] SSL certificates installed for all domains
- [ ] Firewall rules configured (ports 80, 443, 22)
- [ ] Automated backups scheduled (every 6 hours)
- [ ] Health monitoring active (every 5 minutes)

### ✅ Application Services
- [ ] Main website: https://rootuip.com
- [ ] API gateway: https://api.rootuip.com
- [ ] App portal: https://app.rootuip.com
- [ ] Demo platform: https://demo.rootuip.com
- [ ] Customer portal: https://customer.rootuip.com
- [ ] Status page: https://status.rootuip.com

### ✅ Integrations Configured
- [ ] Google Analytics (G-ROOTUIP2025)
- [ ] HubSpot CRM (Hub ID: 243166069)
- [ ] SendGrid Email (From: notifications@rootuip.com)
- [ ] Stripe Payments (Production API configured)
- [ ] Maersk API (OAuth2 ready)
- [ ] Microsoft SAML SSO (Entity ID: https://rootuip.com/auth/saml)

## 🔐 Admin Credentials & Access

### SSH Access
```bash
# Primary access
ssh root@145.223.73.4

# Emergency access
Contact VPS provider for console access
```

### Application Management
```bash
# View all services
pm2 status

# View logs
pm2 logs [app-name]

# Restart services
pm2 restart all

# Stop services (for maintenance)
pm2 stop all

# Start services
pm2 start all
```

### Database Access
```bash
# MongoDB
mongosh
use rootuip_production

# Redis
redis-cli
AUTH [password from .env]
```

### Service Ports
- Main App: 3000
- API Gateway: 3007
- Demo Platform: 3001
- AI/ML Engine: 3002
- WebSocket: 3004
- Maersk Service: 3005
- Customer Success: 3006

## 📊 Monitoring & Analytics

### Google Analytics 4
- **Tracking ID**: G-ROOTUIP2025
- **Account**: Login with admin@rootuip.com
- **Key Events to Monitor**:
  - User registrations
  - ROI calculator usage
  - Demo bookings
  - Lead captures
  - Container searches

### HubSpot CRM
- **Portal ID**: 8751929
- **Hub ID**: 243166069
- **Access Token**: Configured in .env
- **Key Workflows**:
  - Lead capture → CRM
  - Demo booking → Calendar
  - ROI calculation → Lead scoring

### Uptime Monitoring
Configure one of these services:
- **UptimeRobot**: https://uptimerobot.com
- **StatusCake**: https://www.statuscake.com
- **Pingdom**: https://www.pingdom.com

Monitor these endpoints:
- https://rootuip.com (Main site)
- https://api.rootuip.com/api/health (API health)
- https://demo.rootuip.com/api/health (Demo health)

## 🚨 Emergency Procedures

### Service Down
```bash
# Quick restart
ssh root@145.223.73.4
pm2 restart all

# Check logs
pm2 logs --lines 100

# Manual health check
curl https://rootuip.com/api/health
```

### Database Issues
```bash
# Check MongoDB status
systemctl status mongod

# Restart MongoDB
systemctl restart mongod

# Check Redis
systemctl status redis-server
systemctl restart redis-server
```

### SSL Certificate Issues
```bash
# Check certificates
certbot certificates

# Force renewal
certbot renew --force-renewal
systemctl reload nginx
```

### High Load / Performance Issues
```bash
# Check system resources
htop
df -h

# Check PM2 metrics
pm2 monit

# Scale up workers
pm2 scale rootuip-main +2
```

## 📧 Email Configuration

### SendGrid
- **API Key**: Configured in .env
- **From Email**: notifications@rootuip.com
- **Templates**:
  - Welcome email
  - Password reset
  - Demo confirmation
  - Lead notification

### Email Testing
```bash
# Test email sending
curl -X POST https://api.rootuip.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test Email"}'
```

## 🔄 Regular Maintenance

### Daily Tasks (Automated)
- ✅ Health checks (every 5 minutes)
- ✅ Log rotation
- ✅ Performance monitoring

### Weekly Tasks
- [ ] Review error logs
- [ ] Check disk usage
- [ ] Verify backup integrity
- [ ] Review security logs
- [ ] Update status page

### Monthly Tasks
- [ ] Security audit
- [ ] Update dependencies
- [ ] Performance optimization
- [ ] Backup restoration test
- [ ] SSL certificate check

## 📱 Mobile App Considerations

### PWA Features
- Manifest.json configured
- Service worker enabled
- Offline capability
- Push notifications ready

### Mobile Testing
- iPhone Safari
- Android Chrome
- iPad Safari
- Responsive breakpoints

## 🚀 Launch Day Checklist

### Pre-Launch (T-2 hours)
- [ ] Final health check all services
- [ ] Verify all integrations working
- [ ] Clear all test data
- [ ] Enable production mode
- [ ] Verify SSL certificates

### Launch (T-0)
- [ ] Announce on social media
- [ ] Send launch email to subscribers
- [ ] Enable Google Analytics tracking
- [ ] Start uptime monitoring
- [ ] Monitor error logs

### Post-Launch (T+2 hours)
- [ ] Check all metrics
- [ ] Review user feedback
- [ ] Monitor performance
- [ ] Check email delivery
- [ ] Verify lead capture

### First 24 Hours
- [ ] Monitor error rates
- [ ] Check conversion rates
- [ ] Review performance metrics
- [ ] Respond to user feedback
- [ ] Daily backup verification

## 📞 Support Contacts

### Internal Team
- **Technical Lead**: admin@rootuip.com
- **DevOps**: devops@rootuip.com
- **Support**: support@rootuip.com

### External Services
- **VPS Provider**: [Your provider support]
- **CloudFlare**: https://support.cloudflare.com
- **SendGrid**: https://support.sendgrid.com
- **HubSpot**: https://help.hubspot.com

### Emergency Contacts
- **On-Call Engineer**: [Phone number]
- **Escalation**: [Manager contact]

## 💡 Quick Commands Reference

```bash
# SSH to VPS
ssh root@145.223.73.4

# View all logs
pm2 logs

# Restart everything
pm2 restart all

# Check service health
curl https://rootuip.com/api/health

# Manual backup
/usr/local/bin/rootuip-backup.sh

# View nginx logs
tail -f /var/log/nginx/error.log

# Database backup
mongodump --db rootuip_production

# Clear PM2 logs
pm2 flush

# Update and restart
cd /var/www/rootuip
git pull
npm install
pm2 restart all
```

## ✅ Final Verification

- [ ] All services responding
- [ ] SSL certificates valid
- [ ] Monitoring active
- [ ] Backups running
- [ ] Email sending
- [ ] Analytics tracking
- [ ] CRM integration working
- [ ] Demo platform functional
- [ ] Mobile responsive
- [ ] Performance optimized

---

**Platform Status**: PRODUCTION READY ✅
**Version**: 5.0.0
**Last Updated**: $(date)
**Next Review**: 30 days

**Remember**: Always test in staging before deploying to production!