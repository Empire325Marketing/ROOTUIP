# ROOTUIP Deployment Quick Reference

## Primary Login Credentials
- **Email**: mjaiii@rootuip.com
- **Password**: rootuip2024
- **Role**: Full Admin Access

## Quick Deployment Commands

### 1. Create deployment package:
```bash
cd /home/iii/ROOTUIP
./deploy-unified-app.sh
```

### 2. Copy to VPS:
```bash
scp /tmp/rootuip-unified-deploy.tar.gz root@167.71.93.182:/tmp/
```

### 3. On VPS, deploy:
```bash
ssh root@167.71.93.182
cd /var/www/rootuip
tar xzf /tmp/rootuip-unified-deploy.tar.gz
npm install
pm2 restart all
```

## Service Ports
- API Gateway: 3007
- Auth Service: 3003
- Demo Platform: 3001
- AI/ML Engine: 3002
- WebSocket: 3004
- Maersk Integration: 3005
- Customer Success: 3006

## Access URLs
- Main Site: https://rootuip.com
- Login Page: https://rootuip.com/app.html
- API Health: https://rootuip.com/api/health

## Testing the Deployment
1. Visit https://rootuip.com
2. Click "Login" button
3. Use credentials: mjaiii@rootuip.com / rootuip2024
4. Verify dashboard loads with real-time data
5. Test navigation between features

## Monitoring
```bash
pm2 status        # Check service status
pm2 logs         # View all logs
pm2 monit        # Real-time monitoring
```

## Quick Fixes
- Services not starting: `pm2 resurrect`
- Nginx issues: `nginx -t && systemctl reload nginx`
- Permission issues: `chown -R www-data:www-data /var/www/rootuip`