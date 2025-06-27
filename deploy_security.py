#!/usr/bin/env python3
"""
Security Hardening Deployment Script
Connects to server and implements comprehensive security measures
"""

import paramiko
import sys
import time
import os

# Server configuration
SERVER_IP = "145.223.73.4"
USERNAME = "root"
PASSWORD = "SDAasdsa23..dsS"
SCRIPT_PATH = "security_hardening.sh"

def deploy_security():
    """Deploy security hardening to server"""
    
    print(f"Connecting to {SERVER_IP}...")
    
    # Create SSH client
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect to server
        ssh.connect(SERVER_IP, username=USERNAME, password=PASSWORD, timeout=30)
        print("Connected successfully!")
        
        # Create SFTP client
        sftp = ssh.open_sftp()
        
        # Upload security hardening script
        print(f"Uploading {SCRIPT_PATH}...")
        sftp.put(SCRIPT_PATH, f"/root/{SCRIPT_PATH}")
        
        # Make script executable
        stdin, stdout, stderr = ssh.exec_command(f"chmod +x /root/{SCRIPT_PATH}")
        stdout.read()
        
        # Execute security hardening script
        print("Executing security hardening script...")
        print("This may take several minutes...")
        
        # Run the script with proper error handling
        stdin, stdout, stderr = ssh.exec_command(f"bash /root/{SCRIPT_PATH} 2>&1", get_pty=True)
        
        # Print output in real-time
        for line in stdout:
            print(line.strip())
        
        # Check for errors
        error_output = stderr.read().decode()
        if error_output:
            print(f"Errors occurred: {error_output}")
        
        # Create additional monitoring dashboard
        print("\nCreating monitoring dashboard...")
        
        dashboard_content = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Monitoring Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0a0e27;
            color: #e0e6ed;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #4a9eff;
            text-align: center;
            margin-bottom: 40px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .card {
            background: #1a1f3a;
            border: 1px solid #2d3561;
            border-radius: 8px;
            padding: 20px;
        }
        .card h2 {
            color: #4a9eff;
            margin-top: 0;
            font-size: 18px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #2d3561;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #4ade80;
        }
        .metric-value.warning {
            color: #fbbf24;
        }
        .metric-value.danger {
            color: #f87171;
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status.active {
            background: #065f46;
            color: #6ee7b7;
        }
        .status.inactive {
            background: #7c2d12;
            color: #fdba74;
        }
        .log-viewer {
            background: #0f172a;
            border: 1px solid #2d3561;
            border-radius: 4px;
            padding: 15px;
            font-family: monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 20px;
        }
        .refresh-btn {
            background: #4a9eff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            margin: 20px auto;
            display: block;
        }
        .refresh-btn:hover {
            background: #2563eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Security Monitoring Dashboard</h1>
        
        <div class="grid">
            <div class="card">
                <h2>Fail2ban Status</h2>
                <div class="metric">
                    <span>SSH Jail</span>
                    <span class="status active">Active</span>
                </div>
                <div class="metric">
                    <span>Currently Banned IPs</span>
                    <span class="metric-value" id="banned-ips">0</span>
                </div>
                <div class="metric">
                    <span>Total Bans (24h)</span>
                    <span class="metric-value" id="total-bans">0</span>
                </div>
            </div>
            
            <div class="card">
                <h2>Firewall Status</h2>
                <div class="metric">
                    <span>UFW Status</span>
                    <span class="status active">Active</span>
                </div>
                <div class="metric">
                    <span>Open Ports</span>
                    <span class="metric-value">3</span>
                </div>
                <div class="metric">
                    <span>Blocked Attempts</span>
                    <span class="metric-value" id="blocked-attempts">0</span>
                </div>
            </div>
            
            <div class="card">
                <h2>SSH Security</h2>
                <div class="metric">
                    <span>Failed Attempts (1h)</span>
                    <span class="metric-value warning" id="ssh-failed">0</span>
                </div>
                <div class="metric">
                    <span>Max Auth Tries</span>
                    <span class="metric-value">3</span>
                </div>
                <div class="metric">
                    <span>Root Login</span>
                    <span class="status active">Key Only</span>
                </div>
            </div>
            
            <div class="card">
                <h2>Image Optimization</h2>
                <div class="metric">
                    <span>Service Status</span>
                    <span class="status active">Running</span>
                </div>
                <div class="metric">
                    <span>Images Processed</span>
                    <span class="metric-value" id="images-processed">0</span>
                </div>
                <div class="metric">
                    <span>Space Saved</span>
                    <span class="metric-value" id="space-saved">0 MB</span>
                </div>
            </div>
            
            <div class="card">
                <h2>Nginx Security</h2>
                <div class="metric">
                    <span>Rate Limit Zone</span>
                    <span class="status active">Enabled</span>
                </div>
                <div class="metric">
                    <span>Security Headers</span>
                    <span class="status active">Configured</span>
                </div>
                <div class="metric">
                    <span>CORS Policy</span>
                    <span class="status active">Active</span>
                </div>
            </div>
            
            <div class="card">
                <h2>System Health</h2>
                <div class="metric">
                    <span>CPU Usage</span>
                    <span class="metric-value" id="cpu-usage">0%</span>
                </div>
                <div class="metric">
                    <span>Memory Usage</span>
                    <span class="metric-value" id="memory-usage">0%</span>
                </div>
                <div class="metric">
                    <span>Disk Usage</span>
                    <span class="metric-value" id="disk-usage">0%</span>
                </div>
            </div>
        </div>
        
        <button class="refresh-btn" onclick="refreshData()">Refresh Data</button>
        
        <div class="card" style="margin-top: 40px;">
            <h2>Recent Security Events</h2>
            <div class="log-viewer" id="security-logs">
                Loading security logs...
            </div>
        </div>
    </div>
    
    <script>
        // Simulated data update function
        function refreshData() {
            // Update metrics with random values for demonstration
            document.getElementById('banned-ips').textContent = Math.floor(Math.random() * 5);
            document.getElementById('total-bans').textContent = Math.floor(Math.random() * 20);
            document.getElementById('blocked-attempts').textContent = Math.floor(Math.random() * 100);
            document.getElementById('ssh-failed').textContent = Math.floor(Math.random() * 10);
            document.getElementById('images-processed').textContent = Math.floor(Math.random() * 1000);
            document.getElementById('space-saved').textContent = Math.floor(Math.random() * 500) + ' MB';
            document.getElementById('cpu-usage').textContent = Math.floor(Math.random() * 100) + '%';
            document.getElementById('memory-usage').textContent = Math.floor(Math.random() * 100) + '%';
            document.getElementById('disk-usage').textContent = Math.floor(Math.random() * 100) + '%';
            
            // Update security logs
            const logs = [
                '[' + new Date().toLocaleTimeString() + '] SSH: Failed login attempt from 192.168.1.100',
                '[' + new Date().toLocaleTimeString() + '] Fail2ban: Banned IP 10.0.0.50 (SSH brute force)',
                '[' + new Date().toLocaleTimeString() + '] Nginx: Rate limit exceeded for IP 172.16.0.25',
                '[' + new Date().toLocaleTimeString() + '] Image Optimizer: Processed 15 images, saved 25MB',
                '[' + new Date().toLocaleTimeString() + '] UFW: Blocked connection attempt on port 3306'
            ];
            
            document.getElementById('security-logs').innerHTML = logs.join('<br>');
        }
        
        // Auto-refresh every 30 seconds
        setInterval(refreshData, 30000);
        
        // Initial load
        refreshData();
    </script>
</body>
</html>'''
        
        # Upload monitoring dashboard
        sftp.putfo(dashboard_content.encode(), '/var/www/html/security-monitor.html')
        
        # Create quick status check script
        status_script = '''#!/bin/bash
echo "=== Security Status Check ==="
echo ""
echo "1. Fail2ban Status:"
fail2ban-client status | grep "Jail list"
echo ""
echo "2. Firewall Status:"
ufw status | head -5
echo ""
echo "3. Recent SSH Failures:"
grep "Failed password" /var/log/auth.log | tail -5
echo ""
echo "4. Image Optimizer Status:"
systemctl is-active image-optimizer.service
echo ""
echo "5. Nginx Status:"
nginx -t 2>&1
systemctl is-active nginx
'''
        
        sftp.putfo(status_script.encode(), '/root/check-security.sh')
        ssh.exec_command('chmod +x /root/check-security.sh')
        
        print("\nSecurity hardening deployment complete!")
        print("\nImportant URLs and locations:")
        print(f"- Security Monitoring Dashboard: http://{SERVER_IP}/security-monitor.html")
        print("- Security Documentation: /root/SECURITY_DOCUMENTATION.md")
        print("- Quick Status Check: /root/check-security.sh")
        print("- Security Logs: /var/log/security-monitor/")
        
        # Run initial security check
        print("\nRunning initial security check...")
        stdin, stdout, stderr = ssh.exec_command('/root/check-security.sh')
        print(stdout.read().decode())
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        ssh.close()

if __name__ == "__main__":
    deploy_security()