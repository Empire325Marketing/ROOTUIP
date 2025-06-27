#!/usr/bin/env python3
"""
PWA Deployment Script for ROOTUIP
Deploys PWA files and configures nginx to fix loading issues
"""

import os
import sys
import subprocess
import time
from pathlib import Path

SERVER = "157.173.124.19"
USER = "iii"
FILES = ["pwa-complete-deploy.tar.gz", "extract-complete-pwa.sh"]

def test_connection(port=22):
    """Test SSH connection to server"""
    print(f"Testing connection to {USER}@{SERVER}:{port}...")
    try:
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", 
             "-o", "StrictHostKeyChecking=no", f"{USER}@{SERVER}", "echo OK"],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0
    except:
        return False

def deploy_files(port=22):
    """Deploy PWA files to server"""
    # Check files exist
    for file in FILES:
        if not Path(file).exists():
            print(f"❌ Missing file: {file}")
            return False
    
    # Test connection
    if not test_connection(port):
        print(f"❌ Cannot connect to server on port {port}")
        print("\nTroubleshooting:")
        print("1. Check if server is online: ping", SERVER)
        print("2. Try different port: python3 deploy_pwa_via_python.py 2222")
        print("3. Check firewall settings")
        print("4. Use VPS provider's console")
        return False
    
    print("✅ Connection successful!")
    
    # Upload files
    print("\n📤 Uploading files...")
    for file in FILES:
        print(f"   Uploading {file}...")
        result = subprocess.run(
            ["scp", "-P", str(port), file, f"{USER}@{SERVER}:~/"],
            capture_output=True
        )
        if result.returncode != 0:
            print(f"❌ Failed to upload {file}")
            return False
    
    print("✅ Files uploaded successfully!")
    
    # Execute deployment
    print("\n🚀 Running deployment script...")
    commands = [
        "chmod +x extract-complete-pwa.sh",
        "./extract-complete-pwa.sh"
    ]
    
    result = subprocess.run(
        ["ssh", "-p", str(port), f"{USER}@{SERVER}", " && ".join(commands)],
        capture_output=True, text=True
    )
    
    print(result.stdout)
    if result.stderr:
        print("Errors:", result.stderr)
    
    if result.returncode == 0:
        print("\n✅ Deployment completed successfully!")
        print("\n🔗 Test URLs:")
        print("   Dashboard: https://app.rootuip.com/platform/customer/dashboard.html")
        print("   Mobile App: https://app.rootuip.com/platform/mobile-app.html") 
        print("   API Test: https://app.rootuip.com/api/metrics")
        print("\n📱 PWA features enabled:")
        print("   - Offline support")
        print("   - App installation")
        print("   - API responses (fixes loading issue)")
        return True
    else:
        print("\n⚠️  Deployment encountered issues")
        print("Run manually: ssh", f"{USER}@{SERVER}", "./extract-complete-pwa.sh")
        return False

def create_local_test():
    """Create local test to verify API responses"""
    test_html = """<!DOCTYPE html>
<html>
<head>
    <title>API Test</title>
</head>
<body>
    <h1>ROOTUIP API Test</h1>
    <button onclick="testAPI()">Test API</button>
    <pre id="result"></pre>
    
    <script>
    async function testAPI() {
        const result = document.getElementById('result');
        result.textContent = 'Testing...\\n\\n';
        
        const endpoints = [
            '/api/metrics',
            '/api/notifications', 
            '/api/shipments',
            '/api/ping'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch('https://app.rootuip.com' + endpoint);
                const data = await response.json();
                result.textContent += `${endpoint}: ${JSON.stringify(data, null, 2)}\\n\\n`;
            } catch (error) {
                result.textContent += `${endpoint}: ERROR - ${error.message}\\n\\n`;
            }
        }
    }
    </script>
</body>
</html>"""
    
    with open("test-api.html", "w") as f:
        f.write(test_html)
    print("\n📝 Created test-api.html - Open in browser to test API endpoints")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 22
    
    print("PWA Deployment for ROOTUIP")
    print("=" * 30)
    
    if deploy_files(port):
        create_local_test()
    else:
        print("\n❌ Deployment failed")
        print("See PWA_DEPLOYMENT_GUIDE.md for manual steps")