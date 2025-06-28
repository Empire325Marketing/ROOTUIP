# Fix 404 Errors - Complete Solution

## The Problem
- `app.rootuip.com` is not configured in nginx, causing all URLs to return 404
- The main domain `rootuip.com` serves files from `/home/iii/ROOTUIP/ROOTUIP/`
- Our services are running but not accessible via the domain

## Quick Solution (Use Main Domain)

Since `app.rootuip.com` isn't configured, I've copied all files to the main domain's directory. 

### Access the demos via these URLs:
- **ML Demo**: https://rootuip.com/ml-demo.html
- **Login**: https://rootuip.com/login.html
- **Simple Login**: https://rootuip.com/simple-login.html
- **Security Dashboard**: https://rootuip.com/enterprise-security-dashboard.html
- **Monitoring Dashboard**: https://rootuip.com/monitoring-dashboard.html

### To enable API access, update nginx:

```bash
# 1. Edit the nginx config
sudo nano /etc/nginx/sites-available/default

# 2. Add the location blocks from update-main-nginx.conf before the closing }
# (The file contains the ML and Auth proxy configurations)

# 3. Test the configuration
sudo nginx -t

# 4. Reload nginx
sudo systemctl reload nginx
```

## Alternative Solution (Configure app.rootuip.com)

If you prefer to use `app.rootuip.com`:

```bash
# 1. Get SSL certificate for the subdomain
sudo certbot --nginx -d app.rootuip.com

# 2. Copy the nginx configuration
sudo cp /home/iii/ROOTUIP/app.rootuip.com.nginx /etc/nginx/sites-available/app.rootuip.com

# 3. Enable the site
sudo ln -s /etc/nginx/sites-available/app.rootuip.com /etc/nginx/sites-enabled/

# 4. Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Service Status

All services are running correctly:
- **Static Server** (Port 3000): ✅ Healthy
- **Auth Service** (Port 3003): ✅ Healthy  
- **ML System** (Port 3004): ✅ Healthy

## Files Copied

I've copied all necessary files to `/home/iii/ROOTUIP/ROOTUIP/` so they're accessible via the main domain:
- ml-demo.html
- login.html
- simple-login.html
- enterprise-security-dashboard.html
- monitoring-dashboard.html

The ML demo has been updated to use the current domain dynamically, so it will work on either `rootuip.com` or `app.rootuip.com`.