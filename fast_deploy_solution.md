# 🚀 ROOTUIP Fast Deployment Solution

## Problem Identified
SSH port 22 is currently blocked/filtered, likely due to:
1. Security hardening script that was run earlier
2. Fail2ban blocking repeated login attempts
3. Firewall rules restricting access

## Immediate Solution via VPS Console

### Step 1: Access VPS Console
Use your VPS provider's web console (not SSH) to access the server directly.

### Step 2: Run This Command
Once in the console, paste and run:
```bash
# Fix SSH access
systemctl stop fail2ban
ufw allow 22/tcp
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd

# Quick deploy
cd /var/www/rootuip/public
```

### Step 3: Fast Deployment Script
I've created an optimized deployment system for instant updates:

```bash
#!/bin/bash
# Save as: /root/fast-deploy.sh

# Function to pull and deploy updates
deploy_update() {
    echo "🚀 Fast Deploy Starting..."
    
    # Download latest code
    cd /tmp
    wget -O rootuip-latest.tar.gz "YOUR_DEPLOYMENT_URL"
    
    # Backup current
    cp -r /var/www/rootuip/public /var/www/rootuip/backup-$(date +%s)
    
    # Deploy new version
    tar -xzf rootuip-latest.tar.gz
    rsync -av --delete ROOTUIP/ /var/www/rootuip/public/
    
    # Fix permissions
    chown -R www-data:www-data /var/www/rootuip
    
    # Clear caches
    redis-cli FLUSHDB 2>/dev/null || true
    
    # Reload services
    systemctl reload nginx
    
    echo "✅ Deployment complete!"
}

# Run deployment
deploy_update
```

## Alternative: Direct File Upload

Since SSH is blocked, use your VPS provider's file manager or console upload:

1. **Upload these files** to the server:
   - `rootuip-deploy.tar.gz` (created earlier)
   - This script to deploy it:

```bash
#!/bin/bash
# Run in VPS console
cd /tmp
tar -xzf rootuip-deploy.tar.gz
cp -r ROOTUIP/* /var/www/rootuip/public/
chown -R www-data:www-data /var/www/rootuip
systemctl reload nginx
echo "✅ Deployed successfully!"
```

## Fastest Future Deployments

### Option 1: GitHub Actions (Recommended)
```yaml
name: Deploy to ROOTUIP
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: 145.223.73.4
          username: root
          password: ${{ secrets.SERVER_PASSWORD }}
          script: |
            cd /var/www/rootuip/public
            git pull origin main
            systemctl reload nginx
```

### Option 2: Webhook Deployment
Create `/var/www/rootuip/deploy-webhook.php`:
```php
<?php
// Secure webhook for instant deployments
$secret = 'your-secret-key';

if ($_SERVER['HTTP_X_HUB_SIGNATURE'] === 'sha1=' . hash_hmac('sha1', file_get_contents('php://input'), $secret)) {
    exec('cd /var/www/rootuip/public && git pull origin main 2>&1', $output);
    echo implode("\n", $output);
}
```

### Option 3: One-Line Deploy Command
After fixing SSH, use this for instant updates:
```bash
# On your local machine
alias deploy-rootuip='tar -czf - ROOTUIP/ | ssh root@145.223.73.4 "cd /var/www/rootuip && tar -xzf - --strip-components=1 -C public/"'

# Usage
deploy-rootuip  # Instant deployment!
```

## Current Status
- **Website**: Should be running at http://145.223.73.4/
- **Files**: Located in `/var/www/rootuip/public/`
- **Nginx**: Configured and running
- **Issue**: SSH access blocked - needs console fix

## Next Steps
1. Use VPS console to fix SSH access
2. Run the deployment commands
3. Set up one of the fast deployment methods
4. Configure DNS for rootuip.com

The server is ready - just needs SSH access restored via console!