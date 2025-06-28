#!/bin/bash

# Deploy GUI files to proper location

echo "Deploying GUI files..."

# Create deployment package
cd /home/iii/ROOTUIP
tar -czf gui-deploy.tar.gz platform-navigator.html roi-calculator-gui.html platform/api-test-center.html

# Use Python to deploy
python3 << 'EOF'
import subprocess
import time

# Read the tar file
with open('/home/iii/ROOTUIP/gui-deploy.tar.gz', 'rb') as f:
    tar_content = f.read()

# Command to extract in the right location
commands = [
    'cd /var/www/rootuip/public && tar -xzf - << "EOFTAR"',
    tar_content.hex(),
    'EOFTAR'
]

# Execute via SSH
ssh_command = [
    'sshpass', '-p', 'Empire@325',
    'ssh', '-o', 'StrictHostKeyChecking=no',
    'root@app.rootuip.com',
    f'cd /var/www/rootuip/public && echo "{tar_content.hex()}" | xxd -r -p | tar -xzf -'
]

try:
    result = subprocess.run(ssh_command, capture_output=True, text=True, timeout=30)
    print("Deploy result:", result.stdout)
    if result.stderr:
        print("Deploy errors:", result.stderr)
except Exception as e:
    print(f"Deploy error: {e}")

# Also try direct copy approach
print("\nTrying direct copy approach...")
files = [
    ('platform-navigator.html', '/var/www/rootuip/public/platform-navigator.html'),
    ('roi-calculator-gui.html', '/var/www/rootuip/public/roi-calculator-gui.html'),
    ('platform/api-test-center.html', '/var/www/rootuip/public/platform/api-test-center.html')
]

for src, dst in files:
    scp_cmd = [
        'sshpass', '-p', 'Empire@325',
        'scp', '-o', 'StrictHostKeyChecking=no',
        f'/home/iii/ROOTUIP/{src}',
        f'root@app.rootuip.com:{dst}'
    ]
    try:
        result = subprocess.run(scp_cmd, capture_output=True, text=True, timeout=30)
        print(f"Copied {src}: {result.returncode}")
    except Exception as e:
        print(f"Copy error for {src}: {e}")

EOF

echo "Deployment complete!"