#!/bin/bash

# VPS Analysis Script
echo "=== VPS Structure Analysis for ROOTUIP Deployment ==="
echo "Server: 145.223.73.4"
echo "Date: $(date)"
echo ""

# SSH connection details
SSH_USER="root"
SSH_HOST="145.223.73.4"
SSH_PASS='4T(8LORhk0(nmn/G#jii'

# Create a temporary expect script for SSH
cat > /tmp/vps_analyze.exp << 'EOF'
#!/usr/bin/expect -f

set timeout 30
set host [lindex $argv 0]
set user [lindex $argv 1]
set password [lindex $argv 2]

spawn ssh -o StrictHostKeyChecking=no $user@$host

expect {
    "password:" {
        send "$password\r"
        expect "~]#"
    }
    timeout {
        puts "Connection timeout"
        exit 1
    }
}

# Analysis commands
send "echo '=== Current Directory Structure ==='\r"
expect "~]#"

send "pwd\r"
expect "~]#"

send "echo '=== Root Directory Contents ==='\r"
expect "~]#"

send "ls -la /root/\r"
expect "~]#"

send "echo '=== Web Root Directory ==='\r"
expect "~]#"

send "ls -la /var/www/\r"
expect "~]#"

send "echo '=== Nginx Sites ==='\r"
expect "~]#"

send "ls -la /etc/nginx/sites-available/\r"
expect "~]#"

send "ls -la /etc/nginx/sites-enabled/\r"
expect "~]#"

send "echo '=== Running Services ==='\r"
expect "~]#"

send "systemctl list-units --type=service --state=running | grep -E '(node|npm|pm2|nginx|mysql|postgres|redis)'\r"
expect "~]#"

send "echo '=== PM2 Processes ==='\r"
expect "~]#"

send "pm2 list 2>/dev/null || echo 'PM2 not installed'\r"
expect "~]#"

send "echo '=== Node.js Apps Running ==='\r"
expect "~]#"

send "ps aux | grep node | grep -v grep\r"
expect "~]#"

send "echo '=== Database Status ==='\r"
expect "~]#"

send "systemctl status postgresql 2>/dev/null | head -5 || echo 'PostgreSQL not found'\r"
expect "~]#"

send "systemctl status mysql 2>/dev/null | head -5 || echo 'MySQL not found'\r"
expect "~]#"

send "echo '=== SSL Certificates ==='\r"
expect "~]#"

send "ls -la /etc/letsencrypt/live/ 2>/dev/null || echo 'No Let's Encrypt certificates'\r"
expect "~]#"

send "echo '=== ROOTUIP Specific Directories ==='\r"
expect "~]#"

send "find /root -name '*rootuip*' -type d 2>/dev/null | head -20\r"
expect "~]#"

send "find /var/www -name '*rootuip*' -type d 2>/dev/null | head -20\r"
expect "~]#"

send "echo '=== Environment Files ==='\r"
expect "~]#"

send "find /root -name '.env*' -type f 2>/dev/null | head -10\r"
expect "~]#"

send "echo '=== Nginx Configuration for rootuip.com ==='\r"
expect "~]#"

send "cat /etc/nginx/sites-available/rootuip.com 2>/dev/null | head -30 || echo 'Not found'\r"
expect "~]#"

send "echo '=== Disk Usage ==='\r"
expect "~]#"

send "df -h\r"
expect "~]#"

send "echo '=== Memory Usage ==='\r"
expect "~]#"

send "free -h\r"
expect "~]#"

send "exit\r"
expect eof
EOF

chmod +x /tmp/vps_analyze.exp

# Run the analysis
echo "Connecting to VPS and analyzing structure..."
/tmp/vps_analyze.exp "$SSH_HOST" "$SSH_USER" "$SSH_PASS" > vps_analysis_output.txt 2>&1

# Clean up expect script
rm -f /tmp/vps_analyze.exp

# Process and display results
echo ""
echo "=== Analysis Results ==="
cat vps_analysis_output.txt | sed -n '/=== Current Directory Structure ===/,$p' | sed 's/\r//g'

echo ""
echo "=== Summary of Local ROOTUIP Structure ==="
echo ""
echo "Main directories in /home/iii/ROOTUIP:"
find /home/iii/ROOTUIP -maxdepth 1 -type d | grep -v "^\.$" | sort | sed 's|/home/iii/ROOTUIP/||' | grep -v "^$"

echo ""
echo "Total files to deploy:"
find /home/iii/ROOTUIP -type f -name "*.js" -o -name "*.html" -o -name "*.json" | grep -v node_modules | wc -l

echo ""
echo "=== Deployment Recommendations ==="
echo "1. The VPS appears to have the following structure:"
echo "   - Web root: /var/www/html or /var/www/rootuip.com"
echo "   - Nginx configs: /etc/nginx/sites-available/"
echo "   - SSL certs: /etc/letsencrypt/live/"
echo ""
echo "2. Suggested deployment structure:"
echo "   - Static files (HTML, CSS, JS): /var/www/rootuip.com/public/"
echo "   - Node.js apps: /var/www/rootuip.com/apps/"
echo "   - APIs: /var/www/rootuip.com/api/"
echo "   - Database configs: /var/www/rootuip.com/config/"
echo ""
echo "3. Services to deploy:"
echo "   - Main API Gateway"
echo "   - Authentication Service"
echo "   - ML Processing Service"
echo "   - Integration Services"
echo "   - Real-time Dashboard"
echo "   - Monitoring System"

echo ""
echo "Full analysis saved to: vps_analysis_output.txt"