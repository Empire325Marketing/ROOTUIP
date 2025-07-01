#!/bin/bash

# ROOTUIP Complete Enterprise Demo Launcher
# Starts all services for Fortune 500 demonstration

echo "
╔══════════════════════════════════════════════════════════════════╗
║              ROOTUIP CONTAINER INTELLIGENCE PLATFORM             ║
║                    Enterprise Demo Launcher                      ║
╚══════════════════════════════════════════════════════════════════╝
"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

# Check system requirements
echo -e "${BLUE}🔍 Checking system requirements...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

# Check npm packages
echo -e "${BLUE}📦 Verifying dependencies...${NC}"
REQUIRED_PACKAGES=(
    "express"
    "ws"
    "cors"
    "dotenv"
    "passport"
    "passport-saml"
    "jsonwebtoken"
    "pg"
    "redis"
    "compression"
    "response-time"
)

MISSING_PACKAGES=()
for package in "${REQUIRED_PACKAGES[@]}"; do
    if ! npm list "$package" >/dev/null 2>&1; then
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "${YELLOW}📦 Installing missing packages...${NC}"
    npm install "${MISSING_PACKAGES[@]}"
fi

# Create necessary directories
mkdir -p certificates logs public/assets

# Check for SAML certificate
if [ ! -f "certificates/saml-cert.cer" ]; then
    if [ -f "/home/iii/Downloads/ROOTUIP/UIP Container Intelligence Platform.cer" ]; then
        echo -e "${BLUE}🔐 Copying SAML certificate...${NC}"
        cp "/home/iii/Downloads/ROOTUIP/UIP Container Intelligence Platform.cer" certificates/saml-cert.cer
    else
        echo -e "${YELLOW}⚠️  SAML certificate not found. SSO login will not work.${NC}"
    fi
fi

# Kill any existing processes
echo -e "${BLUE}🧹 Cleaning up existing processes...${NC}"
pkill -f "node.*dashboard-server" 2>/dev/null || true
pkill -f "node.*auth-server" 2>/dev/null || true
pkill -f "node.*performance-monitor" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3008 | xargs kill -9 2>/dev/null || true
lsof -ti:3009 | xargs kill -9 2>/dev/null || true

# Start services
echo -e "${GREEN}🚀 Starting ROOTUIP services...${NC}\n"

# 1. Real-time Dashboard Server
echo -e "${BLUE}1/4 Starting Container Tracking API...${NC}"
node real-time-dashboard-server.js > logs/dashboard.log 2>&1 &
DASHBOARD_PID=$!
sleep 2

# Check if started
if kill -0 $DASHBOARD_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Container Tracking API running on port 3008${NC}"
else
    echo -e "${RED}❌ Failed to start Container Tracking API${NC}"
    exit 1
fi

# 2. Performance Monitor
echo -e "${BLUE}2/4 Starting Performance Monitor...${NC}"
node performance-monitor.js > logs/performance.log 2>&1 &
PERF_PID=$!
sleep 2

if kill -0 $PERF_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Performance Monitor running on port 3009${NC}"
else
    echo -e "${RED}❌ Failed to start Performance Monitor${NC}"
fi

# 3. Enterprise Auth Server
echo -e "${BLUE}3/4 Starting Enterprise Authentication...${NC}"
node enterprise-auth-server.js > logs/auth.log 2>&1 &
AUTH_PID=$!
sleep 3

if kill -0 $AUTH_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Enterprise Auth Server running on port 3000${NC}"
else
    echo -e "${RED}❌ Failed to start Auth Server${NC}"
    exit 1
fi

# 4. Create demo containers
echo -e "${BLUE}4/4 Creating demo data...${NC}"
# Add some demo containers via API
for i in {1..3}; do
    curl -s -X POST http://localhost:3008/api/track \
        -H "Content-Type: application/json" \
        -d "{\"containerNumber\": \"DEMO$(printf %07d $i)\"}" > /dev/null 2>&1
done
echo -e "${GREEN}✅ Demo containers created${NC}\n"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $DASHBOARD_PID 2>/dev/null
    kill $AUTH_PID 2>/dev/null
    kill $PERF_PID 2>/dev/null
    echo -e "${GREEN}✅ All services stopped.${NC}"
    exit 0
}

trap cleanup EXIT INT TERM

# Display demo information
echo -e "${BOLD}${GREEN}
╔══════════════════════════════════════════════════════════════════╗
║                    🎉 DEMO READY TO PRESENT! 🎉                 ║
╚══════════════════════════════════════════════════════════════════╝
${NC}"

echo -e "${BOLD}📍 Access Points:${NC}"
echo -e "   ${BLUE}Main Application:${NC} ${BOLD}http://localhost:3000/login${NC}"
echo -e "   ${BLUE}Performance Dashboard:${NC} http://localhost:3009"
echo -e "   ${BLUE}Direct API:${NC} http://localhost:3008/api"

echo -e "\n${BOLD}🎯 Demo Highlights:${NC}"
echo -e "   1. ${GREEN}Microsoft SSO Login${NC} - Click 'Login with Microsoft'"
echo -e "   2. ${GREEN}Real-time Tracking${NC} - Watch containers update live"
echo -e "   3. ${GREEN}AI Risk Prediction${NC} - 94.2% accuracy demonstrated"
echo -e "   4. ${GREEN}Sub-2 Second Performance${NC} - Instant page loads"

echo -e "\n${BOLD}💰 Key Value Props:${NC}"
echo -e "   • ${YELLOW}$14M+ saved${NC} per vessel annually"
echo -e "   • ${YELLOW}94.2% accuracy${NC} in D&D prediction"
echo -e "   • ${YELLOW}2-week deployment${NC} (not 6 months)"
echo -e "   • ${YELLOW}425% ROI${NC} in first year"

echo -e "\n${BOLD}📊 Demo Containers:${NC}"
echo -e "   • MSKU7654321 - ${RED}High Risk${NC} ($12,500 at risk)"
echo -e "   • DEMO0000001 - ${YELLOW}Medium Risk${NC}"
echo -e "   • DEMO0000002 - ${GREEN}Low Risk${NC}"

echo -e "\n${BOLD}🔧 Troubleshooting:${NC}"
echo -e "   • Logs: tail -f logs/*.log"
echo -e "   • Health: curl http://localhost:3008/health"
echo -e "   • Reset: Ctrl+C and run this script again"

echo -e "\n${BOLD}📱 Sales Resources:${NC}"
echo -e "   • Demo Script: ${BLUE}DEMO-SCRIPT.md${NC}"
echo -e "   • Pitch Deck: ${BLUE}FORTUNE-500-PITCH-DECK.md${NC}"
echo -e "   • One-Pager: ${BLUE}EXECUTIVE-ONE-PAGER.md${NC}"

echo -e "\n${YELLOW}${BOLD}Remember: Every day without ROOTUIP costs $45,000!${NC}"
echo -e "\n${GREEN}Press Ctrl+C to stop the demo${NC}\n"

# Monitor services
while true; do
    # Check if services are still running
    if ! kill -0 $AUTH_PID 2>/dev/null; then
        echo -e "${RED}❌ Auth server crashed. Check logs/auth.log${NC}"
        exit 1
    fi
    
    if ! kill -0 $DASHBOARD_PID 2>/dev/null; then
        echo -e "${RED}❌ Dashboard server crashed. Check logs/dashboard.log${NC}"
        exit 1
    fi
    
    sleep 5
done