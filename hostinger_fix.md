# 🚀 Hostinger Quick Fix Guide

## Step 1: Access Hostinger Terminal

1. **Log into hPanel** (Hostinger's control panel)
2. Go to **VPS** → **Server Management**
3. Click **Browser terminal** or **SSH Terminal**
4. Login with:
   - Username: `root`
   - Password: `SDAasdsa23..dsS`

## Step 2: Run These Commands in Terminal

Copy and paste this entire block:

```bash
# Fix SSH access
systemctl stop fail2ban 2>/dev/null || true
fail2ban-client unban --all 2>/dev/null || true
ufw disable
iptables -F
iptables -X
iptables -P INPUT ACCEPT
iptables -P OUTPUT ACCEPT
iptables -P FORWARD ACCEPT

# Enable password auth
echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config
echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/#PasswordAuthentication no/g' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin no/#PermitRootLogin no/g' /etc/ssh/sshd_config
systemctl restart sshd

# Quick check
echo "SSH Fixed! Current website status:"
ls -la /var/www/rootuip/public/ | head -5
```

## Step 3: Deploy ROOTUIP 

After SSH is fixed, run this to deploy everything:

```bash
# Create deployment directory
mkdir -p /var/www/rootuip/public
mkdir -p /var/www/staging-rootuip/public
mkdir -p /var/www/app-rootuip/public

# Configure Nginx for rootuip.com
cat > /etc/nginx/sites-available/rootuip << 'EOF'
server {
    listen 80 default_server;
    server_name rootuip.com www.rootuip.com 145.223.73.4;
    root /var/www/rootuip/public;
    index index.html;
    
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
    
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public";
    }
    
    gzip on;
    gzip_types text/css text/javascript application/javascript;
}

server {
    listen 80;
    server_name staging.rootuip.com;
    root /var/www/staging-rootuip/public;
    auth_basic "Staging";
    auth_basic_user_file /etc/nginx/.htpasswd;
    location / {
        try_files $uri $uri.html $uri/ =404;
    }
}

server {
    listen 80;
    server_name app.rootuip.com;
    root /var/www/app-rootuip/public;
    location / {
        try_files $uri $uri.html $uri/ /platform/dashboard.html =404;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "Ready for file upload!"
```

## Step 4: Upload Files (Choose One Method)

### Option A: Via Hostinger File Manager
1. In hPanel, go to **File Manager**
2. Navigate to `/var/www/rootuip/public`
3. Upload your ROOTUIP files

### Option B: Via Terminal (After SSH Fix)
From your local machine:
```bash
cd /home/iii/ROOTUIP
tar -czf rootuip.tar.gz ROOTUIP/
scp rootuip.tar.gz root@145.223.73.4:/tmp/
ssh root@145.223.73.4 'cd /tmp && tar -xzf rootuip.tar.gz && cp -r ROOTUIP/* /var/www/rootuip/public/ && chown -R www-data:www-data /var/www/rootuip'
```

## Step 5: Configure DNS in Hostinger

1. Go to **Domains** in hPanel
2. Select **rootuip.com**
3. Click **DNS Zone Editor**
4. Add these records:
   ```
   Type    Name    Value           TTL
   A       @       145.223.73.4    14400
   A       www     145.223.73.4    14400
   A       staging 145.223.73.4    14400
   A       app     145.223.73.4    14400
   ```

## That's it! Your site will be live at rootuip.com

Need help? The Hostinger terminal is the key - just paste the commands there!