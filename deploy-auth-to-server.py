#!/usr/bin/env python3
"""
ROOTUIP Authentication System Server Deployment
Deploys the authentication system to the production server
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

# Colors for output
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'

def log_step(message):
    print(f"{BLUE}[DEPLOY] {message}{NC}")

def log_success(message):
    print(f"{GREEN}✅ {message}{NC}")

def log_warning(message):
    print(f"{YELLOW}⚠️  {message}{NC}")

def log_error(message):
    print(f"{RED}❌ {message}{NC}")

def run_command(cmd, shell=True, check=True):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(cmd, shell=shell, capture_output=True, text=True, check=check)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        log_error(f"Command failed: {cmd}")
        log_error(f"Error: {e.stderr}")
        return None

def main():
    print("🔐 ROOTUIP Authentication System Server Deployment")
    print("=" * 50)
    print()
    
    # Paths
    source_dir = Path("/home/iii/ROOTUIP")
    auth_dir = source_dir / "auth"
    deployment_dir = source_dir / "deployment"
    
    # Server paths
    server_auth_dir = Path("/var/www/rootuip/auth")
    server_public_dir = Path("/var/www/rootuip/public/auth")
    
    # Step 1: Create server directories
    log_step("Creating server directories...")
    commands = [
        f"sudo mkdir -p {server_auth_dir}",
        f"sudo mkdir -p {server_public_dir}",
        "sudo mkdir -p /var/www/rootuip/logs/app"
    ]
    
    for cmd in commands:
        if run_command(cmd) is not None:
            log_success(f"Created: {cmd.split()[-1]}")
    
    # Step 2: Copy authentication API files
    log_step("Copying authentication API files...")
    files_to_copy = [
        (auth_dir / "enterprise-auth-system.js", server_auth_dir),
        (auth_dir / "enterprise-auth-demo.js", server_auth_dir),
        (auth_dir / "package.json", server_auth_dir),
        (auth_dir / ".env.production", server_auth_dir / ".env"),
        (auth_dir / "start-auth-demo.sh", server_auth_dir)
    ]
    
    for src, dst_dir in files_to_copy:
        if src.exists():
            dst = dst_dir / src.name if dst_dir.is_dir() else dst_dir
            run_command(f"sudo cp {src} {dst}")
            log_success(f"Copied: {src.name}")
    
    # Step 3: Copy frontend files
    log_step("Copying authentication frontend files...")
    html_files = [
        (deployment_dir / "auth" / "login.html", server_public_dir),
        (deployment_dir / "auth" / "register.html", server_public_dir),
        (deployment_dir / "auth" / "verify-email.html", server_public_dir)
    ]
    
    for src, dst_dir in html_files:
        if src.exists():
            run_command(f"sudo cp {src} {dst_dir}")
            log_success(f"Copied: {src.name}")
    
    # Step 4: Set permissions
    log_step("Setting permissions...")
    run_command(f"sudo chown -R www-data:www-data {server_auth_dir}")
    run_command(f"sudo chown -R www-data:www-data {server_public_dir}")
    run_command(f"sudo chmod 600 {server_auth_dir}/.env")
    log_success("Permissions set")
    
    # Step 5: Install npm dependencies
    log_step("Installing npm dependencies...")
    install_cmd = f"cd {server_auth_dir} && sudo -u www-data npm install --production"
    if run_command(install_cmd):
        log_success("Dependencies installed")
    
    # Step 6: Create systemd service
    log_step("Creating systemd service...")
    service_content = f"""[Unit]
Description=ROOTUIP Authentication Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory={server_auth_dir}
Environment=NODE_ENV=production
Environment=DEMO_MODE=true
ExecStart=/usr/bin/node {server_auth_dir}/enterprise-auth-demo.js
Restart=always
RestartSec=10
StandardOutput=append:/var/www/rootuip/logs/app/auth.log
StandardError=append:/var/www/rootuip/logs/app/auth-error.log

[Install]
WantedBy=multi-user.target"""
    
    service_file = "/tmp/rootuip-auth.service"
    with open(service_file, 'w') as f:
        f.write(service_content)
    
    run_command(f"sudo cp {service_file} /etc/systemd/system/")
    run_command("sudo systemctl daemon-reload")
    log_success("Systemd service created")
    
    # Step 7: Update nginx configuration
    log_step("Updating nginx configuration...")
    nginx_insert = """
    # Authentication API proxy
    location /api/auth/ {
        proxy_pass http://localhost:3002/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
    
    # Authentication pages
    location /auth/ {
        alias /var/www/rootuip/public/auth/;
        try_files $uri $uri/ =404;
    }"""
    
    # Check if nginx config exists for app.rootuip.com
    app_config = "/etc/nginx/sites-available/app.rootuip.com"
    if os.path.exists(app_config):
        log_warning("Please manually add authentication routes to nginx config")
        log_warning(f"Edit: {app_config}")
        log_warning("Add the location blocks before the closing }")
    
    # Step 8: Start the service
    log_step("Starting authentication service...")
    run_command("sudo systemctl enable rootuip-auth")
    run_command("sudo systemctl stop rootuip-auth", check=False)  # Stop if running
    run_command("sudo systemctl start rootuip-auth")
    
    # Check service status
    status = run_command("sudo systemctl is-active rootuip-auth")
    if status == "active":
        log_success("Authentication service started successfully!")
    else:
        log_warning("Service may not have started correctly")
        run_command("sudo journalctl -u rootuip-auth -n 20")
    
    # Step 9: Test nginx and reload
    log_step("Testing nginx configuration...")
    if run_command("sudo nginx -t"):
        run_command("sudo systemctl reload nginx")
        log_success("Nginx reloaded")
    
    # Step 10: Test the deployment
    log_step("Testing authentication API...")
    import time
    time.sleep(2)  # Give service time to start
    
    test_url = "http://localhost:3002/api/health"
    test_result = run_command(f"curl -s {test_url}", check=False)
    if test_result and "healthy" in test_result:
        log_success("Authentication API is responding!")
    else:
        log_warning("API test failed - check logs: sudo journalctl -u rootuip-auth -f")
    
    # Summary
    print()
    print("=" * 50)
    log_success("Authentication System Deployed!")
    print("=" * 50)
    print()
    print("📋 DEPLOYMENT SUMMARY:")
    print()
    print("🔐 Authentication Pages:")
    print("   Login: https://app.rootuip.com/auth/login.html")
    print("   Register: https://app.rootuip.com/auth/register.html")
    print("   API: https://app.rootuip.com/api/auth/health")
    print()
    print("📊 Service Status:")
    print(f"   Status: {run_command('sudo systemctl is-active rootuip-auth', check=False)}")
    print("   Logs: sudo journalctl -u rootuip-auth -f")
    print()
    print("🔑 Demo Accounts:")
    print("   Admin: admin@rootuip.com / Admin2025!")
    print("   Demo: demo@rootuip.com / Demo2025!")
    print()
    log_warning("Note: Running in demo mode with in-memory database")
    log_warning("Configure PostgreSQL and email settings for production")
    print()

if __name__ == "__main__":
    main()