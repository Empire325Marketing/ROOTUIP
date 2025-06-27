#!/usr/bin/env python3
import os
import json

# Read all infrastructure HTML files
infrastructure_files = {}

dirs = ['cloud', 'security', 'data', 'integration', 'monitoring']
for dir_name in dirs:
    file_path = f'infrastructure/{dir_name}/index.html'
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            infrastructure_files[f'{dir_name}/index.html'] = f.read()

# Create a deployment script with embedded content
deployment_script = '''#!/bin/bash
echo "Creating infrastructure directories..."
cd /var/www/html
mkdir -p infrastructure/{cloud,security,data,integration,monitoring}

'''

for file_path, content in infrastructure_files.items():
    # Escape the content for bash
    escaped_content = content.replace("'", "'\"'\"'").replace('$', '\\$').replace('`', '\\`')
    deployment_script += f"""
echo "Creating {file_path}..."
cat > 'infrastructure/{file_path}' << 'ENDOFFILE'
{content}
ENDOFFILE

"""

deployment_script += '''
echo "Infrastructure platform deployed successfully!"
echo "Available at:"
echo "- http://145.223.73.4/infrastructure/cloud/"
echo "- http://145.223.73.4/infrastructure/security/"
echo "- http://145.223.73.4/infrastructure/data/"
echo "- http://145.223.73.4/infrastructure/integration/"
echo "- http://145.223.73.4/infrastructure/monitoring/"
'''

# Write the deployment script
with open('direct_deploy.sh', 'w') as f:
    f.write(deployment_script)

print("Direct deployment script created: direct_deploy.sh")
print(f"Script size: {len(deployment_script)} bytes")
print("\nThis script contains all infrastructure files embedded.")
print("Copy and run it on your VPS to deploy.")