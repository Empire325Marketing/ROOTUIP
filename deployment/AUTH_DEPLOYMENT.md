# ROOTUIP Authentication System Deployment Instructions

## Files to Deploy

1. **Authentication API Service**
   - Source: `/home/iii/ROOTUIP/auth/`
   - Destination: `/var/www/rootuip/auth/`
   - Files: All .js files, package.json, .env.production

2. **Authentication Frontend Pages**
   - Source: `/home/iii/ROOTUIP/deployment/auth/`
   - Destination: `/var/www/rootuip/public/auth/`
   - Files: All .html files

3. **Nginx Configuration**
   - Source: `/home/iii/ROOTUIP/deployment/nginx-auth.conf`
   - Include in: `/etc/nginx/sites-available/app.rootuip.com`

## Manual Deployment Steps

### 1. Copy Files to Server
```bash
# Create directories
sudo mkdir -p /var/www/rootuip/auth
sudo mkdir -p /var/www/rootuip/public/auth

# Copy API files
sudo cp -r /home/iii/ROOTUIP/auth/* /var/www/rootuip/auth/
sudo chown -R www-data:www-data /var/www/rootuip/auth

# Copy frontend files
sudo cp /home/iii/ROOTUIP/deployment/auth/*.html /var/www/rootuip/public/auth/
sudo chown -R www-data:www-data /var/www/rootuip/public/auth
```

### 2. Install Dependencies on Server
```bash
cd /var/www/rootuip/auth
sudo -u www-data npm install --production
```

### 3. Create Systemd Service
```bash
sudo tee /etc/systemd/system/rootuip-auth.service > /dev/null << 'SERVICE'
[Unit]
Description=ROOTUIP Authentication Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/auth
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /var/www/rootuip/auth/enterprise-auth-demo.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable rootuip-auth
sudo systemctl start rootuip-auth
```

### 4. Update Nginx Configuration
Add the contents of `nginx-auth.conf` to your app.rootuip.com server block, then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Test the System
- Login: https://app.rootuip.com/auth/login.html
- Register: https://app.rootuip.com/auth/register.html
- API Health: https://app.rootuip.com/api/auth/health

## Demo Accounts
- Admin: admin@rootuip.com / Admin2025!
- Demo: demo@rootuip.com / Demo2025!
