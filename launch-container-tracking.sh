#!/bin/bash

# ROOTUIP Container Tracking System Launcher
# Starts the real-time dashboard server and serves the web interface

echo "🚀 Starting ROOTUIP Container Tracking System..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install express ws cors dotenv
fi

# Kill any existing processes on our ports
echo -e "${BLUE}🔍 Checking for existing processes...${NC}"
lsof -ti:3008 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Start the real-time dashboard server
echo -e "${GREEN}🚀 Starting Real-Time Dashboard Server on port 3008...${NC}"
node real-time-dashboard-server.js &
DASHBOARD_PID=$!

# Give the server time to start
sleep 2

# Start a simple HTTP server for the web interface
echo -e "${GREEN}🌐 Starting Web Interface on port 8080...${NC}"
python3 -m http.server 8080 --directory . &
WEB_PID=$!

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $DASHBOARD_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    echo -e "${GREEN}✅ Services stopped.${NC}"
    exit 0
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Display access information
echo -e "\n${GREEN}✅ ROOTUIP Container Tracking System is running!${NC}"
echo -e "\n📍 Access Points:"
echo -e "   ${BLUE}Web Interface:${NC} http://localhost:8080/container-tracking-interface.html"
echo -e "   ${BLUE}API Endpoint:${NC} http://localhost:3008/api"
echo -e "   ${BLUE}WebSocket:${NC} ws://localhost:3008"
echo -e "\n📊 Available API Endpoints:"
echo -e "   POST /api/track - Track a container"
echo -e "   GET  /api/containers - Get all tracked containers"
echo -e "   GET  /api/stats - Get platform statistics"
echo -e "   GET  /api/vessel-schedules - Get vessel schedules"
echo -e "   POST /api/process-document - Process shipping documents"
echo -e "\n${YELLOW}Press Ctrl+C to stop the services${NC}"

# Keep the script running
while true; do
    sleep 1
done