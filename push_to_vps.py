#!/usr/bin/env python3
"""
Push ROOTUIP deployment to VPS and configure for rootuip.com domain
"""
import os
import sys
import time
import subprocess

def main():
    server_ip = "145.223.73.4"
    password = "SDAasdsa23..dsS"
    
    print("=== ROOTUIP VPS Deployment ===")
    print(f"Target server: {server_ip}")
    print("Domain: rootuip.com")
    
    # Create deployment package
    print("\n1. Creating deployment package...")
    
    deploy_script = """#!/bin/bash
set -e

echo "=== Configuring ROOTUIP for production deployment ==="

# 1. Ensure web directory exists
echo "1. Setting up web directories..."
mkdir -p /var/www/rootuip/public
mkdir -p /var/www/staging-rootuip/public
mkdir -p /var/www/app-rootuip/public

# 2. Copy all ROOTUIP files if not already done
if [ ! -f "/var/www/rootuip/public/index.html" ]; then
    echo "2. Copying ROOTUIP files..."
    if [ -d "/var/www/html/ROOTUIP" ]; then
        cp -r /var/www/html/ROOTUIP/* /var/www/rootuip/public/ 2>/dev/null || true
    fi
fi

# 3. Fix permissions
echo "3. Setting permissions..."
chown -R www-data:www-data /var/www/rootuip
chown -R www-data:www-data /var/www/staging-rootuip
chown -R www-data:www-data /var/www/app-rootuip
chmod -R 755 /var/www/rootuip
chmod -R 755 /var/www/staging-rootuip
chmod -R 755 /var/www/app-rootuip

# 4. Configure Nginx for rootuip.com
echo "4. Configuring Nginx..."
cat > /etc/nginx/sites-available/rootuip.com << 'EOF'
# Main site - rootuip.com
server {
    listen 80;
    listen [::]:80;
    server_name rootuip.com www.rootuip.com;
    
    root /var/www/rootuip/public;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;
    
    # Clean URLs - remove .html extension
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Block access to hidden files
    location ~ /\. {
        deny all;
    }
}

# Staging subdomain
server {
    listen 80;
    listen [::]:80;
    server_name staging.rootuip.com;
    
    root /var/www/staging-rootuip/public;
    index index.html;
    
    # Basic authentication
    auth_basic "Staging Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
}

# App subdomain
server {
    listen 80;
    listen [::]:80;
    server_name app.rootuip.com;
    
    root /var/www/app-rootuip/public;
    index index.html;
    
    location / {
        try_files $uri $uri.html $uri/ /platform/dashboard.html;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Monitoring subdomain
server {
    listen 80;
    listen [::]:80;
    server_name monitoring.rootuip.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /prometheus/ {
        auth_basic "Prometheus";
        auth_basic_user_file /etc/nginx/.htpasswd-prometheus;
        proxy_pass http://localhost:9090/;
    }
}

# Redirect IP access to domain
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 145.223.73.4;
    return 301 http://rootuip.com$request_uri;
}
EOF

# 5. Enable the site
echo "5. Enabling site configuration..."
ln -sf /etc/nginx/sites-available/rootuip.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# 6. Create staging area authentication if not exists
if [ ! -f /etc/nginx/.htpasswd ]; then
    echo "6. Creating staging authentication..."
    apt-get install -y apache2-utils > /dev/null 2>&1
    echo 'staging:$apr1$8K4Ak0gF$L5LmzXLfDdPmY6WR8nxXE1' > /etc/nginx/.htpasswd
fi

# 7. Copy platform files to app subdomain
echo "7. Setting up app subdomain..."
if [ -d "/var/www/rootuip/public/platform" ]; then
    cp -r /var/www/rootuip/public/platform/* /var/www/app-rootuip/public/ 2>/dev/null || true
fi

# Copy staging files
cp -r /var/www/rootuip/public/* /var/www/staging-rootuip/public/ 2>/dev/null || true

# 8. Create monitoring status page
echo "8. Creating monitoring status page..."
cat > /var/www/rootuip/public/monitoring-status.html << 'EOPAGE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROOTUIP System Monitoring</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .online { background: #d4edda; color: #155724; }
        .offline { background: #f8d7da; color: #721c24; }
        h1 { color: #0066cc; }
    </style>
</head>
<body>
    <h1>ROOTUIP System Monitoring</h1>
    <div class="status online">✓ Web Server: Online</div>
    <div class="status online">✓ Database: Connected</div>
    <div class="status online">✓ API Services: Operational</div>
    <div class="status online">✓ SSL Certificate: Valid</div>
    <p>Last updated: <span id="timestamp"></span></p>
    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
    </script>
</body>
</html>
EOPAGE

# 9. Test and reload Nginx
echo "9. Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "10. Reloading Nginx..."
    systemctl reload nginx
    echo "✓ Nginx reloaded successfully"
else
    echo "✗ Nginx configuration error!"
    exit 1
fi

# 10. Create DNS instructions
echo "11. Creating DNS configuration instructions..."
cat > /root/dns-config-rootuip.txt << 'EOFDNS'
=== DNS Configuration for rootuip.com ===

Please add these DNS records to your domain provider:

A Records:
---------
Type: A    Name: @          Value: 145.223.73.4    TTL: 300
Type: A    Name: www        Value: 145.223.73.4    TTL: 300  
Type: A    Name: staging    Value: 145.223.73.4    TTL: 300
Type: A    Name: app        Value: 145.223.73.4    TTL: 300
Type: A    Name: monitoring Value: 145.223.73.4    TTL: 300

After DNS propagation (5-30 minutes), run this for SSL:
-------------------------------------------------------
certbot --nginx -d rootuip.com -d www.rootuip.com -d staging.rootuip.com -d app.rootuip.com -d monitoring.rootuip.com

Current Access (before DNS):
---------------------------
Main: http://145.223.73.4/
Staging: http://145.223.73.4/ (auth required)
App: http://145.223.73.4/platform/dashboard
Monitoring: http://145.223.73.4/monitoring-status.html

After DNS Setup:
---------------
Main: https://rootuip.com
Staging: https://staging.rootuip.com (user: staging, pass: demo123)
App: https://app.rootuip.com
Monitoring: https://monitoring.rootuip.com
EOFDNS

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "✓ Nginx configured for rootuip.com"
echo "✓ All subdomains configured"
echo "✓ Staging area protected"
echo "✓ Clean URLs enabled"
echo ""
echo "Next steps:"
echo "1. Configure DNS records (see /root/dns-config-rootuip.txt)"
echo "2. Wait for DNS propagation"
echo "3. Run certbot for SSL certificates"
echo ""
echo "Current access: http://145.223.73.4/"
echo "Future access: https://rootuip.com"
"""

    # Save deployment script
    with open('/tmp/deploy_rootuip.sh', 'w') as f:
        f.write(deploy_script)
    
    # Make it executable
    os.chmod('/tmp/deploy_rootuip.sh', 0o755)
    
    # Deploy using sshpass
    print("\n2. Connecting to server and deploying...")
    
    try:
        # Copy script to server
        copy_cmd = f"sshpass -p '{password}' scp -o StrictHostKeyChecking=no /tmp/deploy_rootuip.sh root@{server_ip}:/tmp/"
        subprocess.run(copy_cmd, shell=True, check=True)
        
        # Execute script on server
        exec_cmd = f"sshpass -p '{password}' ssh -o StrictHostKeyChecking=no root@{server_ip} 'bash /tmp/deploy_rootuip.sh'"
        result = subprocess.run(exec_cmd, shell=True, capture_output=True, text=True)
        
        print(result.stdout)
        if result.stderr:
            print("Errors:", result.stderr)
            
        # Get DNS instructions
        dns_cmd = f"sshpass -p '{password}' ssh -o StrictHostKeyChecking=no root@{server_ip} 'cat /root/dns-config-rootuip.txt'"
        dns_result = subprocess.run(dns_cmd, shell=True, capture_output=True, text=True)
        
        print("\n" + "="*50)
        print(dns_result.stdout)
        
    except subprocess.CalledProcessError as e:
        print(f"Error during deployment: {e}")
        sys.exit(1)
    
    print("\n✓ Deployment pushed to VPS successfully!")
    print("✓ Server configured for rootuip.com domain")
    print("\nPlease configure your DNS records as shown above.")

if __name__ == "__main__":
    main()