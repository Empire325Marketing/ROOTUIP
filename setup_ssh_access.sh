#!/bin/bash

echo "🔑 Setting up permanent SSH access for ROOTUIP deployments..."

# Server details
SERVER_IP="145.223.73.4"
SERVER_USER="root"
SERVER_PASS="SDAasdsa23..dsS"
KEY_FILE="$HOME/.ssh/rootuip_deploy.pub"

echo "1. Installing our public key on the server..."

# Use expect to handle password authentication once
expect << EOF
set timeout 20
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $SERVER_USER@$SERVER_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# Copy our key to authorized_keys
expect << EOF
set timeout 20
spawn scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $KEY_FILE $SERVER_USER@$SERVER_IP:~/.ssh/temp_key.pub
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# Add key to authorized_keys and set permissions
expect << EOF
set timeout 20
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $SERVER_USER@$SERVER_IP "cat ~/.ssh/temp_key.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm ~/.ssh/temp_key.pub && echo 'SSH key installed successfully'"
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

echo "2. Testing SSH key authentication..."
ssh -o PreferredAuthentications=publickey -i ~/.ssh/rootuip_deploy root@$SERVER_IP "echo '✅ SSH Key authentication working!'"

if [ $? -eq 0 ]; then
    echo "✅ SSH setup complete! Key-based authentication is now working."
    echo "🚀 You can now deploy without password prompts."
else
    echo "❌ SSH key setup failed. Manual configuration may be needed."
fi