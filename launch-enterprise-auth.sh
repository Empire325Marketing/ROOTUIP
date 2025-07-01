#!/bin/bash

# ROOTUIP Enterprise Authentication System Launcher
# Starts the SAML auth server and container tracking backend

echo "🚀 Starting ROOTUIP Enterprise Authentication System..."

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
echo -e "${YELLOW}📦 Checking dependencies...${NC}"

# Check for required packages
PACKAGES=(
    "express"
    "express-session"
    "passport"
    "passport-saml"
    "jsonwebtoken"
    "cors"
    "cookie-parser"
    "http-proxy-middleware"
    "ws"
    "dotenv"
)

MISSING_PACKAGES=()
for package in "${PACKAGES[@]}"; do
    if ! npm list "$package" >/dev/null 2>&1; then
        MISSING_PACKAGES+=("$package")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
    echo -e "${YELLOW}📦 Installing missing packages: ${MISSING_PACKAGES[*]}${NC}"
    npm install "${MISSING_PACKAGES[@]}"
fi

# Create certificates directory
if [ ! -d "certificates" ]; then
    echo -e "${BLUE}📁 Creating certificates directory...${NC}"
    mkdir -p certificates
fi

# Copy SAML certificate
if [ -f "/home/iii/Downloads/ROOTUIP/UIP Container Intelligence Platform.cer" ]; then
    echo -e "${BLUE}🔐 Copying SAML certificate...${NC}"
    cp "/home/iii/Downloads/ROOTUIP/UIP Container Intelligence Platform.cer" certificates/saml-cert.cer
else
    echo -e "${YELLOW}⚠️  SAML certificate not found at expected location${NC}"
fi

# Kill any existing processes on our ports
echo -e "${BLUE}🔍 Checking for existing processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3008 | xargs kill -9 2>/dev/null || true

# Start the real-time dashboard server
echo -e "${GREEN}🚀 Starting Real-Time Dashboard Server on port 3008...${NC}"
node real-time-dashboard-server.js &
DASHBOARD_PID=$!

# Give the dashboard server time to start
sleep 2

# Start the enterprise auth server
echo -e "${GREEN}🔐 Starting Enterprise Auth Server on port 3000...${NC}"
node enterprise-auth-server.js &
AUTH_PID=$!

# Give the auth server time to start
sleep 2

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $DASHBOARD_PID 2>/dev/null
    kill $AUTH_PID 2>/dev/null
    echo -e "${GREEN}✅ Services stopped.${NC}"
    exit 0
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Display access information
echo -e "\n${GREEN}✅ ROOTUIP Enterprise Authentication System is running!${NC}"
echo -e "\n📍 Access Points:"
echo -e "   ${BLUE}Login Page:${NC} http://localhost:3000/login"
echo -e "   ${BLUE}Dashboard:${NC} http://localhost:3000/dashboard"
echo -e "   ${BLUE}SAML Metadata:${NC} http://localhost:3000/saml/metadata"
echo -e "\n🔐 Authentication Flow:"
echo -e "   1. Visit /login"
echo -e "   2. Click 'Login with Microsoft'"
echo -e "   3. Authenticate with Microsoft Entra ID"
echo -e "   4. Redirected to role-based dashboard"
echo -e "\n📊 Role-Based Access:"
echo -e "   - C-Suite: Executive dashboard with financial analytics"
echo -e "   - Operations: Container tracking interface"
echo -e "\n⚙️  API Endpoints:"
echo -e "   GET  /api/user - Get current user info"
echo -e "   POST /api/refresh-token - Refresh JWT token"
echo -e "   GET  /logout - Logout and clear sessions"
echo -e "\n${YELLOW}Press Ctrl+C to stop the services${NC}"

# Monitor services
while true; do
    # Check if services are still running
    if ! kill -0 $DASHBOARD_PID 2>/dev/null; then
        echo -e "${RED}❌ Dashboard server crashed. Restarting...${NC}"
        node real-time-dashboard-server.js &
        DASHBOARD_PID=$!
    fi
    
    if ! kill -0 $AUTH_PID 2>/dev/null; then
        echo -e "${RED}❌ Auth server crashed. Restarting...${NC}"
        node enterprise-auth-server.js &
        AUTH_PID=$!
    fi
    
    sleep 5
done