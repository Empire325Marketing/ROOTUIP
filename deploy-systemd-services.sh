#!/bin/bash

# ROOTUIP Systemd Services Deployment Script
# Requires sudo privileges

echo "Deploying ROOTUIP Systemd Services"
echo "==================================="

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo: sudo $0"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p /home/iii/ROOTUIP/logs
chown iii:iii /home/iii/ROOTUIP/logs

# Copy service files
echo "Copying service files..."
cp /home/iii/ROOTUIP/systemd/*.service /etc/systemd/system/

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Stop any running processes on our ports
echo "Stopping existing processes..."
pkill -f "ml-server.js" || true
pkill -f "uvicorn api:app" || true
pkill -f "simple-auth.js" || true
pkill -f "api-gateway-database.js" || true

# Wait for ports to be freed
sleep 2

# Enable services
echo "Enabling services..."
systemctl enable ml-server.service
systemctl enable ml-api.service
systemctl enable auth-service.service
systemctl enable api-gateway.service

# Start services
echo "Starting services..."
systemctl start ml-server.service
sleep 2
systemctl start ml-api.service
sleep 2
systemctl start auth-service.service
sleep 2
systemctl start api-gateway.service

# Check status
echo ""
echo "Service Status:"
echo "==============="
systemctl status ml-server.service --no-pager | head -10
echo ""
systemctl status ml-api.service --no-pager | head -10
echo ""
systemctl status auth-service.service --no-pager | head -10
echo ""
systemctl status api-gateway.service --no-pager | head -10

echo ""
echo "Checking ports..."
echo "================="
lsof -i :3003 -i :3004 -i :3006 -i :8000 | grep LISTEN

echo ""
echo "Service Management Commands:"
echo "==========================="
echo "View logs:"
echo "  journalctl -u ml-server -f"
echo "  journalctl -u ml-api -f"
echo "  journalctl -u auth-service -f"
echo "  journalctl -u api-gateway -f"
echo ""
echo "Restart services:"
echo "  sudo systemctl restart ml-server"
echo "  sudo systemctl restart ml-api"
echo "  sudo systemctl restart auth-service"
echo "  sudo systemctl restart api-gateway"
echo ""
echo "Stop services:"
echo "  sudo systemctl stop ml-server ml-api auth-service api-gateway"