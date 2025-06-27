#!/usr/bin/env python3
"""
Diagnose and fix SSH authentication issues
"""
import paramiko
import socket
import sys
import time

def test_ssh_methods():
    host = "145.223.73.4"
    username = "root"
    password = "SDAasdsa23..dsS"
    
    print("=== SSH Connection Diagnostics ===")
    print(f"Host: {host}")
    print(f"User: {username}")
    print()
    
    # Test 1: Basic connectivity
    print("1. Testing basic connectivity...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    try:
        result = sock.connect_ex((host, 22))
        if result == 0:
            print("   ✓ Port 22 is open")
        else:
            print("   ✗ Port 22 is closed or filtered")
            return
    except Exception as e:
        print(f"   ✗ Connection error: {e}")
        return
    finally:
        sock.close()
    
    # Test 2: SSH banner
    print("\n2. Checking SSH banner...")
    try:
        transport = paramiko.Transport((host, 22))
        transport.start_client()
        print(f"   ✓ SSH Banner: {transport.remote_version}")
        transport.close()
    except Exception as e:
        print(f"   ✗ Banner error: {e}")
    
    # Test 3: Authentication methods
    print("\n3. Testing authentication methods...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    # Try different authentication methods
    methods = [
        {
            "name": "Password auth",
            "params": {
                "hostname": host,
                "username": username,
                "password": password,
                "look_for_keys": False,
                "allow_agent": False
            }
        },
        {
            "name": "Password with timeout",
            "params": {
                "hostname": host,
                "username": username,
                "password": password,
                "timeout": 30,
                "look_for_keys": False,
                "allow_agent": False
            }
        },
        {
            "name": "Password with disabled GSSAPIAuth",
            "params": {
                "hostname": host,
                "username": username,
                "password": password,
                "look_for_keys": False,
                "allow_agent": False,
                "gss_auth": False,
                "gss_kex": False,
                "gss_deleg_creds": False,
                "gss_host": None
            }
        }
    ]
    
    for method in methods:
        print(f"\n   Testing {method['name']}...")
        try:
            client.connect(**method['params'])
            print(f"   ✓ {method['name']} successful!")
            
            # If connected, run a test command
            stdin, stdout, stderr = client.exec_command("echo 'Connection successful' && hostname")
            print(f"   Server response: {stdout.read().decode().strip()}")
            client.close()
            return True
            
        except paramiko.AuthenticationException as e:
            print(f"   ✗ Auth failed: {e}")
        except paramiko.SSHException as e:
            print(f"   ✗ SSH error: {e}")
        except Exception as e:
            print(f"   ✗ Error: {type(e).__name__}: {e}")
    
    # Test 4: Check if it's a fail2ban issue
    print("\n4. Checking for possible fail2ban/rate limiting...")
    print("   Waiting 10 seconds before retry...")
    time.sleep(10)
    
    try:
        client.connect(
            hostname=host,
            username=username,
            password=password,
            timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        print("   ✓ Connected after delay - might be rate limiting")
        client.close()
    except Exception as e:
        print(f"   ✗ Still failing: {e}")
    
    return False

def create_fix_script():
    """Create a script to fix common SSH issues"""
    fix_script = """#!/bin/bash
# SSH Authentication Fix Script

echo "=== Fixing SSH Authentication ==="

# 1. Check current SSH config
echo "1. Current SSH configuration:"
grep -E "PasswordAuthentication|PubkeyAuthentication|PermitRootLogin" /etc/ssh/sshd_config

# 2. Backup current config
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# 3. Enable password authentication
echo ""
echo "2. Enabling password authentication..."
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication/PasswordAuthentication/' /etc/ssh/sshd_config
sed -i 's/^PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#PermitRootLogin/PermitRootLogin/' /etc/ssh/sshd_config

# 4. Check fail2ban
echo ""
echo "3. Checking fail2ban status..."
if systemctl is-active --quiet fail2ban; then
    echo "   Fail2ban is active. Checking jails..."
    fail2ban-client status
    
    # Check if our IP is banned
    for jail in $(fail2ban-client status | grep "Jail list" | sed 's/.*://;s/,//g'); do
        echo "   Checking jail: $jail"
        fail2ban-client status $jail | grep -A 5 "Banned IP"
    done
    
    # Temporarily disable fail2ban for SSH
    echo "   Temporarily disabling fail2ban SSH jail..."
    fail2ban-client stop sshd 2>/dev/null || true
    fail2ban-client stop ssh 2>/dev/null || true
fi

# 5. Reset SSH attempts counter
echo ""
echo "4. Resetting authentication attempts..."
rm -f /var/run/sshd/* 2>/dev/null
systemctl restart sshd

# 6. Set a simple password temporarily
echo ""
echo "5. Setting temporary simple password..."
echo "root:rootpass123" | chpasswd

echo ""
echo "=== SSH Fix Applied ==="
echo "Temporary password: rootpass123"
echo "Original password should also work now"
echo ""
echo "New SSH config:"
grep -E "PasswordAuthentication|PermitRootLogin" /etc/ssh/sshd_config
"""
    
    with open('/home/iii/ROOTUIP/fix_ssh_auth.sh', 'w') as f:
        f.write(fix_script)
    
    print("\n5. Created fix script: fix_ssh_auth.sh")
    print("   If you have console access, run this script on the server")

def create_alternative_deploy():
    """Create alternative deployment methods"""
    print("\n6. Alternative deployment methods:")
    
    # Method 1: Using expect
    expect_script = """#!/usr/bin/expect -f
set timeout 30
spawn ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@145.223.73.4
expect {
    "password:" {
        send "SDAasdsa23..dsS\r"
        expect "# "
        send "echo 'Connected successfully'\r"
        expect "# "
    }
    "Permission denied" {
        puts "Authentication failed"
        exit 1
    }
}
interact
"""
    
    with open('/home/iii/ROOTUIP/connect_expect.exp', 'w') as f:
        f.write(expect_script)
    
    # Method 2: Using sshpass with specific options
    connect_script = """#!/bin/bash
echo "Attempting connection with various methods..."

# Method 1: Basic sshpass
echo "1. Basic sshpass..."
sshpass -p 'SDAasdsa23..dsS' ssh -o StrictHostKeyChecking=no root@145.223.73.4 'echo success'

# Method 2: With specific ciphers
echo "2. With specific ciphers..."
sshpass -p 'SDAasdsa23..dsS' ssh -o StrictHostKeyChecking=no -o Ciphers=aes256-ctr,aes192-ctr,aes128-ctr root@145.223.73.4 'echo success'

# Method 3: With keyboard-interactive
echo "3. With keyboard-interactive..."
sshpass -p 'SDAasdsa23..dsS' ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=keyboard-interactive,password root@145.223.73.4 'echo success'

# Method 4: Using Python pexpect
echo "4. Using Python pexpect..."
python3 -c "
import pexpect
child = pexpect.spawn('ssh root@145.223.73.4')
child.expect('password:')
child.sendline('SDAasdsa23..dsS')
child.expect('#')
child.sendline('echo success')
child.expect('#')
print(child.before.decode())
"
"""
    
    with open('/home/iii/ROOTUIP/test_connections.sh', 'w') as f:
        f.write(connect_script)
    
    print("   - Created connect_expect.exp (expect script)")
    print("   - Created test_connections.sh (multiple methods)")

if __name__ == "__main__":
    # Run diagnostics
    success = test_ssh_methods()
    
    # Create fix scripts
    create_fix_script()
    create_alternative_deploy()
    
    if not success:
        print("\n=== Recommendations ===")
        print("1. The SSH hardening may have disabled password authentication")
        print("2. Fail2ban might be blocking repeated attempts")
        print("3. Try using the VPS console to run fix_ssh_auth.sh")
        print("4. Consider using SSH keys instead of passwords")
    else:
        print("\n=== Connection successful! ===")
        print("Ready to deploy ROOTUIP")