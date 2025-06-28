#!/bin/bash

# ROOTUIP ML System Startup Script
# Starts all required ML services with proper port management

echo "Starting ROOTUIP ML System..."
echo "================================"

# Check if ML server is already running on port 3004
if lsof -i :3004 > /dev/null 2>&1; then
    echo "✓ ML server already running on port 3004"
else
    echo "Starting ML server on port 3004..."
    cd /home/iii/ROOTUIP/ml-system
    nohup node ml-processing-server.js > /home/iii/ROOTUIP/logs/ml-server.log 2>&1 &
    sleep 2
    if lsof -i :3004 > /dev/null 2>&1; then
        echo "✓ ML server started successfully"
    else
        echo "✗ Failed to start ML server"
    fi
fi

# Check if Python prediction API is running on port 8000
if lsof -i :8000 > /dev/null 2>&1; then
    echo "✓ Python prediction API already running on port 8000"
else
    echo "Starting Python prediction API on port 8000..."
    cd /home/iii/ROOTUIP/ml-system
    nohup python3 -m uvicorn predict:app --host 0.0.0.0 --port 8000 > /home/iii/ROOTUIP/logs/python-api.log 2>&1 &
    sleep 3
    if lsof -i :8000 > /dev/null 2>&1; then
        echo "✓ Python prediction API started successfully"
    else
        echo "✗ Failed to start Python prediction API"
    fi
fi

# Test the endpoints
echo ""
echo "Testing ML endpoints..."
echo "======================="

# Test ML server health
echo -n "ML Server Health Check: "
if curl -s http://localhost:3004/api/health > /dev/null; then
    echo "✓ Healthy"
else
    echo "✗ Not responding"
fi

# Test Python API health
echo -n "Python API Health Check: "
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✓ Healthy"
else
    echo "✗ Not responding"
fi

# Show running services
echo ""
echo "Running ML Services:"
echo "==================="
ps aux | grep -E "ml-processing-server|uvicorn" | grep -v grep

echo ""
echo "ML System Status:"
echo "================"
echo "ML Server: http://localhost:3004"
echo "Python API: http://localhost:8000"
echo "ML Demo: http://rootuip.com/ml-demo-connected.html"
echo ""
echo "Logs:"
echo "- ML Server: /home/iii/ROOTUIP/logs/ml-server.log"
echo "- Python API: /home/iii/ROOTUIP/logs/python-api.log"
echo ""
echo "To monitor logs:"
echo "tail -f /home/iii/ROOTUIP/logs/ml-server.log"
echo "tail -f /home/iii/ROOTUIP/logs/python-api.log"