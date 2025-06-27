#!/bin/bash
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
