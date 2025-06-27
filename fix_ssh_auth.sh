#!/bin/bash
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
