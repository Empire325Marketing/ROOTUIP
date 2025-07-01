#!/bin/bash

# Quick SSL Setup for ROOTUIP
# Run this after DNS is properly configured

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_status "Quick SSL Setup for ROOTUIP"

# Check DNS
print_status "Checking DNS records..."
VPS_IP="145.223.73.4"

check_dns() {
    local domain=$1
    local ip=$(dig +short $domain @8.8.8.8 | tail -n1)
    
    if [ "$ip" = "$VPS_IP" ]; then
        print_status "✓ $domain → $ip (correct)"
        return 0
    else
        print_error "✗ $domain → $ip (should be $VPS_IP)"
        return 1
    fi
}

DNS_OK=true
check_dns "rootuip.com" || DNS_OK=false
check_dns "www.rootuip.com" || DNS_OK=false
check_dns "app.rootuip.com" || DNS_OK=false

if [ "$DNS_OK" = false ]; then
    print_error "DNS not properly configured. Please update DNS records to point to $VPS_IP"
    print_warning "Continuing with self-signed certificates..."
else
    print_status "DNS properly configured, obtaining Let's Encrypt certificates..."
    
    # Ensure webroot exists
    mkdir -p /var/www/certbot
    
    # Get certificates
    print_status "Getting certificate for rootuip.com and www.rootuip.com..."
    certbot certonly --webroot -w /var/www/certbot \
        -d rootuip.com -d www.rootuip.com \
        --non-interactive --agree-tos --email admin@rootuip.com \
        --force-renewal
    
    print_status "Getting certificate for app.rootuip.com (CRITICAL for SAML)..."
    certbot certonly --webroot -w /var/www/certbot \
        -d app.rootuip.com \
        --non-interactive --agree-tos --email admin@rootuip.com \
        --force-renewal
    
    # Update Nginx to use the new certificates
    print_status "Reloading Nginx with new certificates..."
    nginx -t && systemctl reload nginx
    
    # Set up auto-renewal
    print_status "Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet --no-self-upgrade --post-hook 'systemctl reload nginx'") | crontab -
    
    print_status "SSL certificates obtained successfully!"
    
    # Test the sites
    print_status "Testing HTTPS access..."
    echo
    echo "Testing https://rootuip.com..."
    curl -sI https://rootuip.com | head -n 1
    echo
    echo "Testing https://app.rootuip.com..."
    curl -sI https://app.rootuip.com | head -n 1
    echo
    
    print_status "SSL setup complete!"
    echo
    echo "===== NEXT STEPS ====="
    echo "1. Update Microsoft Entra SAML configuration with:"
    echo "   - Entity ID: https://app.rootuip.com"
    echo "   - Reply URL: https://app.rootuip.com/saml/acs"
    echo "   - Sign-on URL: https://app.rootuip.com/login"
    echo
    echo "2. Test enterprise login at: https://app.rootuip.com/login"
    echo
    echo "3. Access marketing site at: https://rootuip.com"
fi