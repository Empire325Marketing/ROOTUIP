# ROOTUIP Infrastructure Documentation

## Overview
Professional enterprise-grade hosting infrastructure with consolidated deployment, performance optimizations, and comprehensive monitoring.

## Directory Structure
```
/var/www/rootuip/
├── public/          # Production website files
├── staging/         # Staging environment
├── logs/           # All log files
│   ├── nginx/      # Web server logs
│   ├── app/        # Application logs
│   └── monitoring/ # Monitoring logs
├── backups/        # Automated backups
├── cache/          # Cache directory
├── scripts/        # Automation scripts
│   ├── monitoring/ # Monitoring scripts
│   ├── backup/     # Backup scripts
│   └── deployment/ # Deployment scripts
└── ssl/            # SSL certificates
```

## Domains
- **Production**: https://rootuip.com
- **App Platform**: https://app.rootuip.com
- **Staging**: https://staging.rootuip.com (password protected)
- **CDN**: https://cdn.rootuip.com
- **API**: https://api.rootuip.com

## Performance Features
- Gzip compression enabled
- Browser caching (1 year for assets, 1 hour for HTML)
- HTTP/2 protocol
- CDN subdomain for static assets
- Image optimization (WebP support)
- Progressive loading

## Security
- SSL/TLS certificates (Let's Encrypt)
- HSTS enabled
- Security headers (CSP, X-Frame-Options, etc.)
- Rate limiting
- Fail2ban protection
- Staging environment password protection

## Monitoring
- Uptime checks every 5 minutes
- Performance metrics every 15 minutes
- Daily automated backups (30-day retention)
- Log rotation configured
- Email alerts (configure SMTP)

## Deployment
```bash
# Deploy to staging
/var/www/rootuip/scripts/deployment/deploy.sh staging

# Deploy to production
/var/www/rootuip/scripts/deployment/deploy.sh production
```

## Backup & Recovery
- Automated daily backups at 2 AM
- 30-day retention policy
- Stored in `/var/www/rootuip/backups/`

## Maintenance Commands
```bash
# Check service status
systemctl status nginx

# View monitoring logs
tail -f /var/www/rootuip/logs/monitoring/uptime.log

# Manual backup
/var/www/rootuip/scripts/backup/backup.sh

# Optimize images
/var/www/rootuip/scripts/optimize-images.sh

# View staging password
cat /var/www/rootuip/.htpasswd
```

## Performance Benchmarks
- Page load time: < 2 seconds
- Time to first byte: < 200ms
- SSL handshake: < 100ms
- Gzip compression: 60-80% reduction

## Scaling Considerations
- Current setup handles 10,000+ concurrent users
- CDN ready for CloudFlare integration
- Database connections pooled
- Static assets optimized

## Emergency Procedures
1. Check nginx status: `systemctl status nginx`
2. Check disk space: `df -h`
3. Review error logs: `tail -100 /var/www/rootuip/logs/nginx/error.log`
4. Restore from backup if needed

## Contact
- Technical Issues: admin@rootuip.com
- Server Access: Root SSH to 145.223.73.4
