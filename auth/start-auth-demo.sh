#!/bin/bash
# Start ROOTUIP Authentication Service in demo mode

cd /home/iii/ROOTUIP/auth
export NODE_ENV=production
export DEMO_MODE=true

echo "Starting ROOTUIP Authentication Service (Demo Mode)..."
echo "API will be available at: http://localhost:3002"
echo "Press Ctrl+C to stop"

node enterprise-auth-demo.js
