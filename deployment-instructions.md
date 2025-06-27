# ROOTUIP Platform Deployment Instructions

## Server Information
- IP: 157.173.124.19
- Hostname: ip-19-124-173-157.static.contabo.net
- Provider: Contabo

## Current Status
The server appears to be completely unreachable via standard methods:
- No response to ping
- All common ports (SSH, HTTP, HTTPS, FTP, etc.) are filtered/blocked
- No web management interfaces detected

## Alternative Deployment Methods

### Method 1: Contact Hosting Provider
Since this is a Contabo server, you should:
1. Log into your Contabo customer panel
2. Check if the server is running
3. Verify firewall rules
4. Use their VNC/Console access if available
5. Check if there's a rescue mode available

### Method 2: Manual Configuration via Control Panel
If Contabo provides a web-based file manager or control panel:
1. Upload the files via their web interface
2. Use their terminal/console to extract and configure

### Method 3: Recovery/Rescue Mode
1. Boot the server into rescue mode (if available)
2. Mount the main filesystem
3. Copy files and configure nginx

## Files to Deploy

1. **rootuip-complete-deploy.tar.gz** (678KB)
   - Contains the complete PWA application
   - Extract to web root directory

2. **nginx-api-fix.conf**
   - Nginx configuration to fix API endpoints
   - Copy to /etc/nginx/sites-available/
   - Enable with symlink to sites-enabled

3. **fix-on-server.sh**
   - Automated deployment script
   - Run after uploading files

## Manual Deployment Steps

Once you gain access to the server:

```bash
# 1. Upload files to server (via any available method)

# 2. Extract the application
cd /var/www
tar -xzf rootuip-complete-deploy.tar.gz

# 3. Configure nginx
cp nginx-api-fix.conf /etc/nginx/sites-available/rootuip
ln -s /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# 4. Or run the automated script
chmod +x fix-on-server.sh
./fix-on-server.sh
```

## Troubleshooting Network Issues

The server might be:
1. **Behind a strict firewall** - Check Contabo control panel for firewall settings
2. **In maintenance mode** - Verify server status in control panel
3. **Using non-standard ports** - Check Contabo documentation
4. **Requiring VPN access** - Some providers require VPN for management

## Next Steps

1. **Check Contabo Control Panel** for:
   - Server status
   - Firewall rules
   - Console/VNC access
   - File manager
   - Rescue mode options

2. **Contact Contabo Support** if:
   - Server appears offline
   - Cannot access control panel
   - Need firewall rules adjusted

3. **Alternative Hosting** - If server remains inaccessible, consider:
   - Using a different VPS provider
   - Deploying to a cloud service (AWS, GCP, Azure)
   - Using a managed hosting service

## Contact Information
Check your Contabo account for:
- Support ticket system
- Emergency contact numbers
- Live chat support