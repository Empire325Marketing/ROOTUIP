#!/bin/bash

echo "🚀 Launching ROOTUIP Job Processing System..."
echo ""
echo "This system provides:"
echo "- Distributed job queue management with Redis"
echo "- Background processing for large datasets"
echo "- ML model training and inference"
echo "- Real-time monitoring dashboard"
echo ""

# Check if Redis is running
echo "Checking Redis connection..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redis is not running. Please start Redis first:"
    echo "   sudo service redis-server start"
    echo "   or"
    echo "   redis-server"
    exit 1
fi

echo "✅ Redis is running"
echo ""

# Start the job processing system
echo "Starting job processing system on port 8083..."
node launch-job-processor.js