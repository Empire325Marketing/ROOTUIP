# ROOTUIP Complete Deployment Guide

## 🌐 DNS Configuration Required

Your server at **145.223.73.4** is ready and configured. To complete the deployment to **rootuip.com**, add these DNS records at your domain registrar:

### A Records to Add:
```
Type    Name         Value           TTL
A       @            145.223.73.4    300
A       www          145.223.73.4    300  
A       staging      145.223.73.4    300
A       app          145.223.73.4    300
A       monitoring   145.223.73.4    300
```

## 📍 Current Access Points (Before DNS)

- **Main Site**: http://145.223.73.4/
- **Monitoring Status**: http://145.223.73.4/monitoring-status.html
- **Grafana Dashboard**: Port 3000 (admin / eOyp71ZeHbwboVCbMVr4gRpGdqbsk1M9DKul6zXK+gI=)
- **Prometheus**: Port 9090 (admin / LVFqWoa5jVUvkwrqbtJcZwm2PS5h70MT4U24WaCrF5w=)

## 🚀 After DNS Configuration

Once DNS records are added and propagated (5-30 minutes), your sites will be accessible at:

- **Production**: https://rootuip.com
- **Staging**: https://staging.rootuip.com (user: `staging`, pass: `demo123`)
- **App Platform**: https://app.rootuip.com
- **Monitoring**: https://monitoring.rootuip.com

## 🔒 SSL Certificate Setup

After DNS is pointing to your server, SSH into the server and run:

```bash
ssh root@145.223.73.4
certbot --nginx -d rootuip.com -d www.rootuip.com -d staging.rootuip.com -d app.rootuip.com -d monitoring.rootuip.com
```

## 📁 Server Configuration

### Nginx Configuration
The server needs this Nginx configuration for rootuip.com. Save as `/etc/nginx/sites-available/rootuip.com`:

```nginx
# Redirect IP to domain
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 145.223.73.4;
    return 301 http://rootuip.com$request_uri;
}

# Main site
server {
    listen 80;
    listen [::]:80;
    server_name rootuip.com www.rootuip.com;
    root /var/www/rootuip/public;
    index index.html;
    
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
    
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/json;
}

# Staging subdomain
server {
    listen 80;
    listen [::]:80;
    server_name staging.rootuip.com;
    root /var/www/staging-rootuip/public;
    index index.html;
    
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
}

# Monitoring subdomain
server {
    listen 80;
    listen [::]:80;
    server_name monitoring.rootuip.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
        auth_basic "Prometheus";
        auth_basic_user_file /etc/nginx/.htpasswd-prometheus;
    }
}
```

Then enable it:
```bash
ln -sf /etc/nginx/sites-available/rootuip.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## ✅ What's Already Configured

1. **Web Server**: Nginx with clean URLs, compression, caching
2. **Monitoring**: Prometheus + Grafana with dashboards
3. **Backups**: Automated daily/weekly/monthly backups
4. **Security**: Fail2ban, UFW firewall, rate limiting
5. **File Structure**: All files in `/var/www/rootuip/public`
6. **Staging Environment**: Password-protected staging area
7. **Performance**: Gzip compression, browser caching, HTTP/2

## 📋 Quick Checklist

- [ ] Add DNS A records for rootuip.com
- [ ] Wait for DNS propagation (check with `nslookup rootuip.com`)
- [ ] Update Nginx configuration for domain
- [ ] Install SSL certificate with certbot
- [ ] Update fail2ban email notifications
- [ ] Test all subdomains

## 🆘 Support Information

- **Server IP**: 145.223.73.4
- **Root Password**: SDAasdsa23..dsS
- **Staging Auth**: staging / demo123
- **Backup Location**: /var/backups/rootuip/
- **Nginx Config**: /etc/nginx/sites-available/
- **Web Root**: /var/www/rootuip/public/

## 🎯 Final Steps Summary

1. **Configure DNS** - Add all A records pointing to 145.223.73.4
2. **Update Nginx** - Apply the rootuip.com configuration
3. **Install SSL** - Run certbot after DNS propagates
4. **Verify** - Test all domains and subdomains

Your ROOTUIP platform is ready for production deployment!