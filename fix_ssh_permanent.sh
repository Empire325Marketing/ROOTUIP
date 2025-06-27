#!/bin/bash

echo "🔧 Fixing SSH Connection Issues Permanently"
echo "==========================================="

# Clear any SSH agent keys that might be causing conflicts
echo "1. Clearing SSH agent and known hosts..."
ssh-add -D 2>/dev/null || true
ssh-keygen -f "$HOME/.ssh/known_hosts" -R "145.223.73.4" 2>/dev/null || true

echo "2. Creating minimal SSH client config..."
cat > ~/.ssh/config_rootuip << 'EOF'
Host rootuip-deploy
    HostName 145.223.73.4
    User root
    IdentityFile ~/.ssh/rootuip_deploy
    IdentitiesOnly yes
    PubkeyAuthentication yes
    PreferredAuthentications publickey,password
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    ServerAliveInterval 60
    ServerAliveCountMax 3
    MaxAuthTries 1
    ConnectionAttempts 1
EOF

echo "3. Testing current SSH access with password..."
if sshpass -p 'SDAasdsa23..dsS' ssh -F ~/.ssh/config_rootuip -o PreferredAuthentications=password -o PubkeyAuthentication=no rootuip-deploy "echo 'Password auth working'" 2>/dev/null; then
    echo "✅ Password authentication working"
    
    echo "4. Installing SSH key manually..."
    # Create the key installation command
    KEY_CONTENT=$(cat ~/.ssh/rootuip_deploy.pub)
    sshpass -p 'SDAasdsa23..dsS' ssh -F ~/.ssh/config_rootuip -o PreferredAuthentications=password -o PubkeyAuthentication=no rootuip-deploy << EOF
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo '$KEY_CONTENT' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# Remove any duplicate keys
sort ~/.ssh/authorized_keys | uniq > ~/.ssh/authorized_keys.tmp
mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys
echo "SSH key installed successfully"
EOF
    
    echo "5. Testing SSH key authentication..."
    if ssh -F ~/.ssh/config_rootuip -o PreferredAuthentications=publickey rootuip-deploy "echo '✅ SSH Key authentication working!'" 2>/dev/null; then
        echo "✅ SUCCESS: SSH key authentication is now working!"
        
        # Update main SSH config
        echo "6. Updating main SSH config..."
        cp ~/.ssh/config ~/.ssh/config.backup
        grep -v "Host rootuip-deploy" ~/.ssh/config > ~/.ssh/config.tmp || true
        cat ~/.ssh/config_rootuip >> ~/.ssh/config.tmp
        mv ~/.ssh/config.tmp ~/.ssh/config
        
        echo "7. Creating deployment script with fixed SSH..."
        cat > ~/deploy_with_ssh.sh << 'DEPLOY_EOF'
#!/bin/bash
echo "🚀 Deploying to ROOTUIP with SSH keys..."

# Upload fixes
scp -F ~/.ssh/config_rootuip /home/iii/ROOTUIP/rootuip_fixes.tar.gz rootuip-deploy:/tmp/

# Deploy on server
ssh -F ~/.ssh/config_rootuip rootuip-deploy << 'SERVER_EOF'
cd /tmp
tar -xzf rootuip_fixes.tar.gz
cd /var/www/rootuip/public

# Backup current files
cp index.html index.html.backup.$(date +%s) 2>/dev/null || true

# Deploy fixes
cp -r /tmp/ROOTUIP/css/* ./css/ 2>/dev/null || cp -r /tmp/ROOTUIP/css ./
cp -r /tmp/ROOTUIP/brand/* ./brand/ 2>/dev/null || cp -r /tmp/ROOTUIP/brand ./
cp -r /tmp/ROOTUIP/js/* ./js/ 2>/dev/null || cp -r /tmp/ROOTUIP/js ./
cp -r /tmp/ROOTUIP/lead-generation/* ./lead-generation/ 2>/dev/null || cp -r /tmp/ROOTUIP/lead-generation ./
cp /tmp/ROOTUIP/index.html ./

# Set permissions
chmod -R 755 .
chown -R www-data:www-data .

# Cleanup
rm -f /tmp/rootuip_fixes.tar.gz
rm -rf /tmp/ROOTUIP/

echo "✅ Deployment complete!"
SERVER_EOF

echo "🎉 Deployment successful! Visit https://rootuip.com"
DEPLOY_EOF
        chmod +x ~/deploy_with_ssh.sh
        
        echo ""
        echo "🎉 SSH SETUP COMPLETE!"
        echo "====================="
        echo "✅ SSH key authentication working"
        echo "✅ Deployment script ready: ~/deploy_with_ssh.sh"
        echo "✅ Future deployments will be passwordless"
        echo ""
        echo "Test with: ssh -F ~/.ssh/config_rootuip rootuip-deploy 'echo SSH working'"
        
    else
        echo "❌ SSH key authentication failed"
    fi
else
    echo "❌ Password authentication failed - check credentials"
fi