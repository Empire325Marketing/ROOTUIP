#!/bin/bash

# Server Connection Diagnostic Script
SERVER="157.173.124.19"
USER="iii"

echo "ROOTUIP Server Connection Diagnostics"
echo "===================================="
echo "Target: $USER@$SERVER"
echo ""

# 1. Basic connectivity
echo "1. Testing basic network connectivity..."
if ping -c 3 -W 2 $SERVER > /dev/null 2>&1; then
    echo "   ✅ Ping successful - server is reachable"
else
    echo "   ❌ Ping failed - server unreachable"
    echo "   Possible issues:"
    echo "   - Server is down"
    echo "   - Firewall blocking ICMP"
    echo "   - Network routing issue"
fi

# 2. Port scanning
echo ""
echo "2. Checking common SSH ports..."
for port in 22 2222 2022 22022; do
    echo -n "   Port $port: "
    if timeout 2 bash -c "echo >/dev/tcp/$SERVER/$port" 2>/dev/null; then
        echo "OPEN"
        # Try SSH handshake
        if timeout 5 ssh -p $port -o StrictHostKeyChecking=no -o PasswordAuthentication=no $USER@$SERVER "echo 'SSH OK'" 2>/dev/null; then
            echo "      ✅ SSH responding on port $port"
            WORKING_PORT=$port
        else
            echo "      ⚠️  Port open but SSH not responding properly"
        fi
    else
        echo "CLOSED/FILTERED"
    fi
done

# 3. DNS check
echo ""
echo "3. DNS Resolution..."
if host $SERVER > /dev/null 2>&1; then
    echo "   ✅ DNS resolves correctly"
    host $SERVER | grep "has address"
else
    echo "   ⚠️  DNS resolution issues"
fi

# 4. Traceroute (first 10 hops)
echo ""
echo "4. Network path (first 10 hops)..."
traceroute -m 10 -w 2 $SERVER 2>/dev/null | head -15 || echo "   Traceroute not available"

# 5. Recommendations
echo ""
echo "5. Recommendations:"
echo "   ========================"

if [ ! -z "$WORKING_PORT" ]; then
    echo "   ✅ SSH is available on port $WORKING_PORT"
    echo "   Run: ./deploy-pwa-when-ready.sh $WORKING_PORT"
else
    echo "   ❌ No SSH access detected"
    echo ""
    echo "   Options:"
    echo "   1. Contact your VPS provider - server may be down"
    echo "   2. Check if SSH is on a custom port"
    echo "   3. Use provider's web console/VNC"
    echo "   4. Check firewall rules"
    echo "   5. Verify your IP isn't blocked"
fi

echo ""
echo "6. Alternative deployment:"
echo "   - Use your VPS provider's file manager"
echo "   - Upload: pwa-complete-deploy.tar.gz and extract-complete-pwa.sh"
echo "   - Run: ./extract-complete-pwa.sh via web terminal"