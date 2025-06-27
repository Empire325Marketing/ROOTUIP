# Security Maintenance Guide

## Daily Tasks

### 1. Check Security Alerts
```bash
# Check fail2ban bans
fail2ban-client status
fail2ban-client status sshd

# Check recent SSH failures
grep "Failed password" /var/log/auth.log | tail -20

# Review security monitoring logs
ls -la /var/log/security-monitor/
tail -f /var/log/security-monitor/fail2ban-monitor.log
```

### 2. Monitor System Resources
```bash
# Check system load
htop

# Check disk usage
df -h

# Check image optimization service
systemctl status image-optimizer.service
```

## Weekly Tasks

### 1. Review Security Logs
```bash
# Generate security report
/usr/local/bin/security-monitor.sh

# Analyze nginx access patterns
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -20

# Check for unusual activity
grep -E "404|403|401" /var/log/nginx/access.log | tail -50
```

### 2. Update Security Rules
```bash
# Review and update fail2ban rules
vim /etc/fail2ban/jail.d/

# Check for new IPs to whitelist
fail2ban-client status sshd | grep "Banned IP"

# Update firewall rules if needed
ufw status numbered
```

### 3. Test Security Configurations
```bash
# Run security test script
bash /root/test_security.sh

# Test rate limiting
ab -n 100 -c 10 http://localhost/

# Verify security headers
curl -I http://localhost | grep -E "X-Frame-Options|X-Content-Type"
```

## Monthly Tasks

### 1. Security Audit
```bash
# Check for security updates
apt update
apt list --upgradable | grep -E "security|fail2ban|nginx"

# Review user accounts
cat /etc/passwd | grep -E "bash$"

# Check for unauthorized SSH keys
find /home -name "authorized_keys" -exec ls -la {} \;
```

### 2. Performance Optimization
```bash
# Analyze image optimization effectiveness
find /var/www/uploads -name "*.webp" | wc -l
du -sh /var/www/uploads

# Review nginx performance
nginx -V
tail -f /var/log/nginx/error.log
```

### 3. Backup Security Configurations
```bash
# Backup security configurations
tar -czf /backup/security-config-$(date +%Y%m%d).tar.gz \
  /etc/fail2ban/ \
  /etc/nginx/conf.d/ \
  /etc/ssh/sshd_config.d/ \
  /etc/ufw/

# Backup security scripts
tar -czf /backup/security-scripts-$(date +%Y%m%d).tar.gz \
  /usr/local/bin/optimize-images.sh \
  /usr/local/bin/security-monitor.sh \
  /usr/local/bin/image-optimizer-daemon.sh
```

## Emergency Procedures

### 1. Under Attack
```bash
# Check current connections
netstat -an | grep :80 | wc -l
netstat -an | grep :443 | wc -l

# Identify attacking IPs
netstat -an | grep :80 | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -nr | head

# Emergency ban specific IP
fail2ban-client set sshd banip <IP>
ufw deny from <IP>

# Enable stricter rate limiting
vim /etc/nginx/conf.d/rate-limiting.conf
# Reduce rate limits temporarily
systemctl reload nginx
```

### 2. Service Recovery
```bash
# If fail2ban stops working
systemctl restart fail2ban
fail2ban-client status

# If nginx has issues
nginx -t
systemctl restart nginx
tail -f /var/log/nginx/error.log

# If image optimizer fails
systemctl restart image-optimizer.service
journalctl -u image-optimizer.service -f
```

### 3. Unban Legitimate User
```bash
# Check if IP is banned
fail2ban-client status sshd | grep <IP>

# Unban IP
fail2ban-client unban <IP>

# Add to whitelist
echo "ignoreip = <IP>" >> /etc/fail2ban/jail.d/whitelist.conf
systemctl restart fail2ban
```

## Security Best Practices

### 1. Regular Updates
- Run system updates weekly
- Update fail2ban rules monthly
- Review security policies quarterly

### 2. Monitoring
- Set up external monitoring service
- Configure email alerts for critical events
- Use log aggregation service

### 3. Access Control
- Use SSH keys only
- Implement IP whitelisting for admin areas
- Regular audit of user permissions

### 4. Backup Strategy
- Daily backup of critical data
- Weekly backup of configurations
- Monthly full system backup
- Test restore procedures quarterly

## Useful Commands Reference

### Fail2ban
```bash
# Status
fail2ban-client status
fail2ban-client status <jail>

# Ban/Unban
fail2ban-client set <jail> banip <IP>
fail2ban-client set <jail> unbanip <IP>

# Reload
fail2ban-client reload
```

### UFW Firewall
```bash
# Status
ufw status verbose
ufw status numbered

# Rules
ufw allow from <IP>
ufw deny from <IP>
ufw delete <rule_number>
```

### Image Optimization
```bash
# Manual optimization
/usr/local/bin/optimize-images.sh /path/to/images

# Check service
systemctl status image-optimizer.service
journalctl -u image-optimizer.service

# Process specific image
convert input.jpg -quality 85 -strip output.jpg
cwebp -q 80 input.jpg -o output.webp
```

### Security Monitoring
```bash
# Run manual check
/usr/local/bin/security-monitor.sh

# View dashboard
http://your-server/security-monitor.html

# Quick status
/root/check-security.sh
```

## Contact Information

For security incidents or questions:
- Email: security@yourdomain.com
- Emergency: +1-XXX-XXX-XXXX
- Documentation: /root/SECURITY_DOCUMENTATION.md