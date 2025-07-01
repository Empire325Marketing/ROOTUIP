#!/bin/bash

# ROOTUIP Deploy to Domain Script
# Deploys all files to rootuip.com

echo "======================================"
echo "Deploying ROOTUIP to Domain"
echo "======================================"

VPS_IP="145.223.73.4"
DOMAIN="rootuip.com"

# Deploy HTML files to web root
echo "Deploying HTML files..."
scp ROOTUIP/*.html root@$VPS_IP:/var/www/$DOMAIN/

# Deploy platform subdirectory
echo "Deploying platform files..."
ssh root@$VPS_IP "mkdir -p /var/www/$DOMAIN/platform"
scp ROOTUIP/platform/*.html root@$VPS_IP:/var/www/$DOMAIN/platform/

# Deploy static assets
echo "Deploying static assets..."
ssh root@$VPS_IP "mkdir -p /var/www/$DOMAIN/static"

# Deploy monitoring and scripts
echo "Deploying backend services..."
scp -r middleware scripts monitoring nginx root@$VPS_IP:/home/rootuip/platform/

# Update Nginx configuration
echo "Updating Nginx configuration..."
ssh root@$VPS_IP << 'EOF'
cat > /etc/nginx/sites-available/rootuip.com << 'NGINX'
server {
    listen 80;
    server_name rootuip.com www.rootuip.com;
    
    root /var/www/rootuip.com;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
    
    # ML API proxy
    location /ml/ {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Python API proxy
    location /api/python/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Auth service proxy
    location /auth/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Monitoring API
    location /monitoring/ {
        proxy_pass http://localhost:3006/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health/all {
        proxy_pass http://localhost:3006/metrics;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    # Static files
    location /static/ {
        alias /var/www/rootuip.com/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    # Platform subdirectory
    location /platform/ {
        alias /var/www/rootuip.com/platform/;
    }
    
    # Default location
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

# Enable the site
ln -sf /etc/nginx/sites-available/rootuip.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx
EOF

# Set permissions
echo "Setting permissions..."
ssh root@$VPS_IP "chown -R www-data:www-data /var/www/$DOMAIN"
ssh root@$VPS_IP "chmod -R 755 /var/www/$DOMAIN"

# Start services
echo "Starting backend services..."
ssh root@$VPS_IP << 'EOF'
cd /home/rootuip/platform

# Install dependencies
cd middleware && npm install && cd ..
cd monitoring && npm install && cd ..

# Start monitoring service (if not already running)
if ! pgrep -f "start-monitoring.js" > /dev/null; then
    nohup node monitoring/start-monitoring.js > /var/log/monitoring.log 2>&1 &
    echo "Monitoring service started"
fi

# Check ML server
if ! curl -s http://localhost:3004/ml/health > /dev/null; then
    echo "ML server not responding on port 3004"
fi

# Check Python API
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "Python API not responding on port 8000"
fi
EOF

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "Access your platform at:"
echo "- Main: http://$DOMAIN"
echo "- ML Demo: http://$DOMAIN/ml-demo.html"
echo "- Enterprise Monitor: http://$DOMAIN/enterprise-monitor.html"
echo "- Status Page: http://$DOMAIN/status-page.html"
echo "- API Docs: http://$DOMAIN/api-docs.html"
echo ""
echo "Backend services:"
echo "- ML API: http://$DOMAIN/ml/"
echo "- Monitoring: http://$DOMAIN/monitoring/"
echo "- Health Check: http://$DOMAIN/health/all"
echo ""
echo "Note: HTTPS requires SSL certificate setup"