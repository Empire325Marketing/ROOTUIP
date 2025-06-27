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
