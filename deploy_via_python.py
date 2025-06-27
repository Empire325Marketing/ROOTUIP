#!/usr/bin/env python3
import os
import base64
import subprocess

print("Deploying Infrastructure Platform to VPS...")

# Read the tar.gz file
with open('infrastructure.tar.gz', 'rb') as f:
    content = f.read()

# Create deployment script
deploy_script = f'''#!/bin/bash
cd /var/www/html

# Create base64 encoded content
cat > infrastructure.b64 << 'EOF'
{base64.b64encode(content).decode()}
EOF

# Decode and extract
base64 -d infrastructure.b64 > infrastructure.tar.gz
tar -xzf infrastructure.tar.gz
rm infrastructure.b64 infrastructure.tar.gz

echo "Infrastructure platform deployed successfully!"
'''

# Write deployment script
with open('deploy_on_vps.sh', 'w') as f:
    f.write(deploy_script)

print("Deployment script created: deploy_on_vps.sh")
print("\nTo deploy:")
print("1. Copy this script to your VPS:")
print("   scp deploy_on_vps.sh root@145.223.73.4:/tmp/")
print("2. SSH to your VPS and run:")
print("   bash /tmp/deploy_on_vps.sh")
print("\nThe infrastructure will be available at:")
print("- http://145.223.73.4/infrastructure/cloud/")
print("- http://145.223.73.4/infrastructure/security/")
print("- http://145.223.73.4/infrastructure/data/")
print("- http://145.223.73.4/infrastructure/integration/")
print("- http://145.223.73.4/infrastructure/monitoring/")