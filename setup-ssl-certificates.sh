#!/bin/bash

# ROOTUIP SSL Certificate Setup Script
# Sets up Let's Encrypt SSL certificates for rootuip.com and app.rootuip.com

echo "ROOTUIP SSL Certificate Setup"
echo "============================="

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo: sudo $0"
    exit 1
fi

# Ensure nginx is running
systemctl start nginx

echo ""
echo "Current SSL Status:"
echo "=================="
certbot certificates

echo ""
echo "Setting up SSL for ROOTUIP domains..."
echo "===================================="

# Setup SSL for main domain and app subdomain
certbot --nginx \
    -d rootuip.com \
    -d www.rootuip.com \
    -d app.rootuip.com \
    --non-interactive \
    --agree-tos \
    --email admin@rootuip.com \
    --redirect

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL certificates installed successfully!"
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    echo ""
    echo "SSL Configuration Complete!"
    echo "=========================="
    echo "✓ https://rootuip.com"
    echo "✓ https://www.rootuip.com"
    echo "✓ https://app.rootuip.com"
    
    # Set up auto-renewal
    echo ""
    echo "Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    echo "✓ Auto-renewal configured (daily at noon)"
    
else
    echo ""
    echo "❌ SSL setup failed!"
    echo "Common issues:"
    echo "1. Domain not pointing to this server (145.223.73.4)"
    echo "2. Firewall blocking port 80/443"
    echo "3. Nginx configuration issues"
    echo ""
    echo "To check DNS:"
    echo "dig rootuip.com +short"
    echo "dig app.rootuip.com +short"
fi

echo ""
echo "To test SSL configuration:"
echo "========================="
echo "curl -I https://rootuip.com"
echo "curl -I https://app.rootuip.com"
echo ""
echo "To view certificate details:"
echo "certbot certificates"
echo ""
echo "To manually renew:"
echo "sudo certbot renew"