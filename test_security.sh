#!/bin/bash

# Security Configuration Testing Script
# This script tests all security configurations

echo "=== Security Configuration Testing ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
    fi
}

# 1. Test Fail2ban
echo "1. Testing Fail2ban Configuration..."
systemctl is-active --quiet fail2ban
test_result $? "Fail2ban service is running"

fail2ban-client status sshd &>/dev/null
test_result $? "SSH jail is active"

fail2ban-client status nginx-req-limit &>/dev/null
test_result $? "Nginx rate limit jail is active"

# 2. Test UFW Firewall
echo ""
echo "2. Testing UFW Firewall..."
ufw status | grep -q "Status: active"
test_result $? "UFW is active"

ufw status | grep -q "22/tcp.*LIMIT"
test_result $? "SSH port is rate limited"

# 3. Test SSH Hardening
echo ""
echo "3. Testing SSH Hardening..."
sshd -T | grep -q "permitrootlogin prohibit-password"
test_result $? "Root login restricted to key authentication"

sshd -T | grep -q "passwordauthentication no"
test_result $? "Password authentication disabled"

sshd -T | grep -q "maxauthtries 3"
test_result $? "Max auth tries set to 3"

# 4. Test Nginx Security Headers
echo ""
echo "4. Testing Nginx Security Headers..."
nginx -t &>/dev/null
test_result $? "Nginx configuration is valid"

curl -s -I http://localhost | grep -q "X-Frame-Options"
test_result $? "X-Frame-Options header present"

curl -s -I http://localhost | grep -q "X-Content-Type-Options"
test_result $? "X-Content-Type-Options header present"

# 5. Test Image Optimization
echo ""
echo "5. Testing Image Optimization..."
which convert &>/dev/null
test_result $? "ImageMagick installed"

which jpegoptim &>/dev/null
test_result $? "jpegoptim installed"

which cwebp &>/dev/null
test_result $? "WebP tools installed"

systemctl is-active --quiet image-optimizer.service
test_result $? "Image optimizer service is running"

# 6. Test Rate Limiting
echo ""
echo "6. Testing Rate Limiting..."
grep -q "limit_req_zone" /etc/nginx/conf.d/rate-limiting.conf
test_result $? "Rate limiting zones configured"

# 7. Test CORS Configuration
echo ""
echo "7. Testing CORS Configuration..."
grep -q "Access-Control-Allow-Origin" /etc/nginx/conf.d/cors.conf
test_result $? "CORS headers configured"

# 8. Test Security Monitoring
echo ""
echo "8. Testing Security Monitoring..."
[ -f /usr/local/bin/security-monitor.sh ]
test_result $? "Security monitoring script exists"

[ -x /usr/local/bin/security-monitor.sh ]
test_result $? "Security monitoring script is executable"

crontab -l | grep -q "security-monitor.sh"
test_result $? "Security monitoring cron job configured"

# 9. Test Log Files
echo ""
echo "9. Testing Log Files..."
[ -d /var/log/security-monitor ]
test_result $? "Security monitor log directory exists"

# 10. Test Documentation
echo ""
echo "10. Testing Documentation..."
[ -f /root/SECURITY_DOCUMENTATION.md ]
test_result $? "Security documentation exists"

echo ""
echo "=== Security Testing Complete ==="

# Summary
echo ""
echo "Security Checklist:"
echo "- [ ] Update email addresses in fail2ban configuration"
echo "- [ ] Add trusted IPs to whitelist"
echo "- [ ] Configure SSL certificate"
echo "- [ ] Test image optimization with sample uploads"
echo "- [ ] Review and customize CORS origins"
echo "- [ ] Set up log rotation policies"
echo "- [ ] Configure backup procedures"
echo "- [ ] Schedule regular security audits"