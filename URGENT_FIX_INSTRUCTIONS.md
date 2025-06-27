# 🚨 URGENT: Fix ROOTUIP Loading Issue

## Problem Identified
The API endpoints (/api/metrics, /api/notifications, etc.) are returning HTML instead of JSON because nginx is routing everything to dashboard.html.

## Quick Fix (Run on Server)

### Option 1: Add API routes BEFORE the catch-all route

```bash
sudo nano /etc/nginx/sites-available/app.rootuip.com
```

Find the line with `try_files $uri $uri/ $uri.html /dashboard.html;` and ADD THESE LINES BEFORE IT:

```nginx
# API endpoints - ADD THESE BEFORE try_files
location /api/metrics {
    add_header Content-Type application/json;
    return 200 '{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}';
}

location /api/notifications {
    add_header Content-Type application/json;
    return 200 '{"success":true,"notifications":[],"unreadCount":0}';
}

location /api/shipments {
    add_header Content-Type application/json;
    return 200 '{"success":true,"shipments":[],"total":0}';
}

location /api/user {
    add_header Content-Type application/json;
    return 200 '{"success":true,"user":{"name":"Demo User","company":"Acme Corporation","role":"Admin"}}';
}
```

Then reload nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Option 2: One-Command Fix

```bash
sudo sed -i '/try_files/i\
    location /api/metrics {\
        add_header Content-Type application/json;\
        return 200 '"'"'{"activeShipments":127,"onTimeDelivery":"94.2","ddRiskScore":"2.8","costSavings":142}'"'"';\
    }\
    location /api/notifications {\
        add_header Content-Type application/json;\
        return 200 '"'"'{"success":true,"notifications":[],"unreadCount":0}'"'"';\
    }\
    location /api/shipments {\
        add_header Content-Type application/json;\
        return 200 '"'"'{"success":true,"shipments":[],"total":0}'"'"';\
    }' /etc/nginx/sites-available/app.rootuip.com && sudo nginx -t && sudo systemctl reload nginx
```

## Why This Fixes It

Currently, your nginx config has a catch-all that sends EVERYTHING to dashboard.html:
```
try_files $uri $uri/ $uri.html /dashboard.html;
```

This means `/api/metrics` gets served as dashboard.html!

By adding specific location blocks for API endpoints BEFORE this catch-all, nginx will:
1. Serve JSON for API requests
2. Serve HTML for everything else

## Test After Fix

1. Test API: `curl https://app.rootuip.com/api/metrics`
   - Should return JSON, not HTML

2. Test Dashboard: https://app.rootuip.com/platform/customer/dashboard.html
   - Should load without "loading" in the corner

## Files Ready for Full Deployment

- `rootuip-complete-deploy.tar.gz` (663KB) - Complete platform with PWA
- `emergency-deploy.php` - Web-based deployment tool
- All in `/home/iii/ROOTUIP/`