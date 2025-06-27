#!/usr/bin/env python3
import os
import subprocess
import time

def deploy_pwa():
    """Deploy PWA files to server"""
    print("Starting PWA deployment...")
    
    files_to_deploy = [
        ('pwa-deploy.tar.gz', '~/'),
        ('extract-pwa.sh', '~/')
    ]
    
    server = 'iii@157.173.124.19'
    
    for local_file, remote_path in files_to_deploy:
        print(f"Deploying {local_file}...")
        cmd = f'scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no {local_file} {server}:{remote_path}'
        
        try:
            result = subprocess.run(cmd, shell=True, timeout=15, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✓ {local_file} deployed successfully")
            else:
                print(f"✗ Failed to deploy {local_file}: {result.stderr}")
        except subprocess.TimeoutExpired:
            print(f"✗ Timeout deploying {local_file}")
        except Exception as e:
            print(f"✗ Error deploying {local_file}: {e}")
    
    # Try to execute extraction
    print("\nAttempting to run extraction script...")
    ssh_cmd = f'ssh -o ConnectTimeout=10 {server} "chmod +x extract-pwa.sh && ./extract-pwa.sh"'
    
    try:
        result = subprocess.run(ssh_cmd, shell=True, timeout=20, capture_output=True, text=True)
        if result.returncode == 0:
            print("✓ PWA deployment completed successfully!")
            print(result.stdout)
        else:
            print("✗ Failed to run extraction script")
            print("Manual execution required: SSH to server and run ./extract-pwa.sh")
    except:
        print("✗ Could not execute extraction script automatically")
        print("Manual execution required: SSH to server and run ./extract-pwa.sh")

if __name__ == "__main__":
    os.chdir('/home/iii/ROOTUIP')
    deploy_pwa()
    
    print("\n" + "="*50)
    print("DEPLOYMENT SUMMARY")
    print("="*50)
    print("Package created: pwa-deploy.tar.gz (46KB)")
    print("Contains: 18 files (7 PWA files + 11 icons)")
    print("")
    print("If automatic deployment failed:")
    print("1. Manually copy pwa-deploy.tar.gz to server")
    print("2. SSH to server and run: ./extract-pwa.sh")
    print("")
    print("PWA URLs:")
    print("- Dashboard: https://app.rootuip.com/platform/customer/dashboard.html")
    print("- Mobile App: https://app.rootuip.com/platform/mobile-app.html")
    print("- Offline Page: https://app.rootuip.com/platform/offline.html")