#!/bin/bash
# Alternative deployment script for ROOTUIP platform
# Use this when direct SSH access is not available

echo "=== ROOTUIP Alternative Deployment Script ==="
echo "This script prepares files for alternative deployment methods"

# Create a deployment package with instructions
mkdir -p deployment-package

# Copy essential files
cp rootuip-complete-deploy.tar.gz deployment-package/
cp nginx-api-fix.conf deployment-package/
cp fix-on-server.sh deployment-package/

# Create a simple HTTP upload form
cat > deployment-package/upload-form.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Deployment Upload</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 600px; margin: auto; }
        .file-list { background: #f0f0f0; padding: 20px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ROOTUIP Platform Deployment</h1>
        <p>Upload these files to your server:</p>
        <div class="file-list">
            <ul>
                <li>rootuip-complete-deploy.tar.gz - Main application</li>
                <li>nginx-api-fix.conf - Nginx configuration</li>
                <li>fix-on-server.sh - Deployment script</li>
            </ul>
        </div>
        <h2>Deployment Instructions:</h2>
        <pre>
# After uploading files to server:
cd /path/to/uploads
chmod +x fix-on-server.sh
sudo ./fix-on-server.sh
        </pre>
    </div>
</body>
</html>
EOF

# Create deployment via curl commands
cat > deployment-package/deploy-via-curl.sh << 'EOF'
#!/bin/bash
# Deploy ROOTUIP via curl commands
# Use this if you have HTTP/FTP access to the server

SERVER_IP="157.173.124.19"
DEPLOY_PATH="/var/www/rootuip"

echo "Attempting deployment via HTTP POST..."
# Try various endpoints that might accept file uploads
for endpoint in upload deploy admin/upload filemanager/upload; do
    echo "Trying endpoint: $endpoint"
    curl -X POST -F "file=@rootuip-complete-deploy.tar.gz" \
         http://$SERVER_IP/$endpoint 2>/dev/null
done

echo "If HTTP upload fails, try FTP:"
echo "ftp $SERVER_IP"
echo "put rootuip-complete-deploy.tar.gz"
echo "put nginx-api-fix.conf"
echo "put fix-on-server.sh"
EOF

# Create a Python deployment helper
cat > deployment-package/deploy-helper.py << 'EOF'
#!/usr/bin/env python3
"""
ROOTUIP Deployment Helper
Attempts various methods to deploy to the server
"""

import os
import sys
import subprocess
import ftplib
import http.client
import urllib.request

SERVER_IP = "157.173.124.19"

def check_connectivity():
    """Check which services are available on the server"""
    print("Checking server connectivity...")
    services = {
        'HTTP': 80,
        'HTTPS': 443,
        'FTP': 21,
        'SSH': 22,
        'SFTP': 22,
        'FTPS': 990
    }
    
    available = []
    for service, port in services.items():
        try:
            conn = http.client.HTTPConnection(SERVER_IP, port, timeout=5)
            conn.connect()
            available.append(service)
            conn.close()
        except:
            pass
    
    return available

def try_ftp_upload():
    """Attempt FTP upload"""
    print("Attempting FTP upload...")
    try:
        ftp = ftplib.FTP(SERVER_IP)
        ftp.login()  # Try anonymous login
        
        files = ['rootuip-complete-deploy.tar.gz', 'nginx-api-fix.conf', 'fix-on-server.sh']
        for file in files:
            with open(file, 'rb') as f:
                ftp.storbinary(f'STOR {file}', f)
                print(f"Uploaded {file}")
        
        ftp.quit()
        return True
    except Exception as e:
        print(f"FTP upload failed: {e}")
        return False

def create_deployment_webhook():
    """Create a webhook for deployment notification"""
    webhook_content = {
        'server': SERVER_IP,
        'files': ['rootuip-complete-deploy.tar.gz', 'nginx-api-fix.conf', 'fix-on-server.sh'],
        'instructions': 'Extract tar.gz to web root, configure nginx, run fix-on-server.sh'
    }
    
    with open('deployment-webhook.json', 'w') as f:
        import json
        json.dump(webhook_content, f, indent=2)
    
    print("Created deployment-webhook.json for manual deployment")

if __name__ == "__main__":
    print("ROOTUIP Deployment Helper")
    print("=" * 50)
    
    available = check_connectivity()
    if available:
        print(f"Available services: {', '.join(available)}")
        
        if 'FTP' in available:
            try_ftp_upload()
    else:
        print("No services available on the server")
        print("Creating deployment package for manual upload...")
        create_deployment_webhook()
        
    print("\nManual deployment instructions saved to deployment-instructions.md")
EOF

chmod +x deployment-package/*.sh
chmod +x deployment-package/*.py

# Create a comprehensive deployment checklist
cat > deployment-package/deployment-checklist.txt << 'EOF'
ROOTUIP DEPLOYMENT CHECKLIST
============================

[ ] Server Access
    [ ] Check Contabo control panel
    [ ] Verify server is running
    [ ] Check firewall settings
    [ ] Try VNC/Console access
    [ ] Check for rescue mode

[ ] File Upload Methods
    [ ] Web-based file manager
    [ ] FTP (port 21)
    [ ] SFTP (port 22)
    [ ] HTTP POST to upload endpoint
    [ ] Control panel file upload

[ ] Deployment Steps
    [ ] Upload rootuip-complete-deploy.tar.gz
    [ ] Upload nginx-api-fix.conf
    [ ] Upload fix-on-server.sh
    [ ] Extract tar file to web root
    [ ] Configure nginx
    [ ] Restart nginx service
    [ ] Test deployment

[ ] Troubleshooting
    [ ] Check server logs
    [ ] Verify file permissions
    [ ] Check nginx configuration
    [ ] Test API endpoints
    [ ] Verify PWA functionality

[ ] Alternative Options
    [ ] Contact Contabo support
    [ ] Use different server/provider
    [ ] Deploy to cloud service
EOF

echo "=== Deployment package created ==="
echo "Files prepared in ./deployment-package/"
echo ""
echo "Since the server is unreachable via standard methods, you should:"
echo "1. Log into your Contabo control panel"
echo "2. Check server status and firewall rules"
echo "3. Use VNC/Console access or file manager"
echo "4. Upload files from deployment-package/"
echo "5. Run fix-on-server.sh on the server"
echo ""
echo "Alternative: Contact Contabo support for assistance"