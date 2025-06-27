#!/bin/bash

echo "=== Deploying ROOTUIP to VPS ==="
echo "Server: 145.223.73.4"
echo "Domain: rootuip.com"

# Create expect script for SSH interaction
cat > /tmp/deploy_expect.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 300
set password "SDAasdsa23..dsS"

spawn ssh -o StrictHostKeyChecking=no root@145.223.73.4

expect {
    "password:" {
        send "$password\r"
        expect "# "
    }
    "Permission denied" {
        puts "ERROR: Authentication failed"
        exit 1
    }
}

# Configure for rootuip.com
send "echo '=== Configuring for rootuip.com ==='\r"
expect "# "

# Update Nginx configuration
send "cat > /etc/nginx/sites-available/rootuip.com << 'EOCONF'
server {
    listen 80;
    listen [::]:80;
    server_name rootuip.com www.rootuip.com;
    root /var/www/rootuip/public;
    index index.html;
    
    location / {
        try_files \$uri \$uri.html \$uri/ =404;
    }
    
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 30d;
        add_header Cache-Control \"public, immutable\";
    }
    
    gzip on;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
}

server {
    listen 80;
    listen [::]:80;
    server_name staging.rootuip.com;
    root /var/www/staging-rootuip/public;
    index index.html;
    
    auth_basic \"Staging Area\";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        try_files \$uri \$uri.html \$uri/ =404;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name app.rootuip.com;
    root /var/www/app-rootuip/public;
    index index.html;
    
    location / {
        try_files \$uri \$uri.html \$uri/ /platform/dashboard.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name monitoring.rootuip.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
    
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
    }
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 145.223.73.4;
    return 301 http://rootuip.com\$request_uri;
}
EOCONF\r"
expect "# "

# Enable site
send "ln -sf /etc/nginx/sites-available/rootuip.com /etc/nginx/sites-enabled/\r"
expect "# "

# Test and reload
send "nginx -t && systemctl reload nginx\r"
expect "# "

# Create DNS instructions
send "cat > /root/ROOTUIP_DNS_SETUP.txt << 'EOFDNS'
=== ROOTUIP DNS Configuration ===

Add these DNS records at your domain provider:

A Records:
Type: A    Name: @          Value: 145.223.73.4    TTL: 300
Type: A    Name: www        Value: 145.223.73.4    TTL: 300
Type: A    Name: staging    Value: 145.223.73.4    TTL: 300
Type: A    Name: app        Value: 145.223.73.4    TTL: 300
Type: A    Name: monitoring Value: 145.223.73.4    TTL: 300

After DNS propagates, run:
certbot --nginx -d rootuip.com -d www.rootuip.com -d staging.rootuip.com -d app.rootuip.com -d monitoring.rootuip.com

Access URLs:
- Production: https://rootuip.com
- Staging: https://staging.rootuip.com (user: staging, pass: demo123)
- App: https://app.rootuip.com
- Monitoring: https://monitoring.rootuip.com
EOFDNS\r"
expect "# "

send "echo 'Configuration complete!'\r"
expect "# "
send "exit\r"
expect eof
EOF

# Run expect script
chmod +x /tmp/deploy_expect.exp
expect /tmp/deploy_expect.exp

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Configure DNS records for rootuip.com"
echo "2. Point all A records to 145.223.73.4"
echo "3. Wait for DNS propagation (5-30 minutes)"
echo "4. Run certbot for SSL certificates"
echo ""
echo "The server is now configured for rootuip.com!"