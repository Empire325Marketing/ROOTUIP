#!/bin/bash

# ROOTUIP Compliance Management System Launcher
# Start the comprehensive compliance and audit system

echo "🛡️ Starting ROOTUIP Compliance Management System..."
echo "=================================================="

# Set environment
export NODE_ENV=production
export PORT=3008

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create required directories
echo -e "${BLUE}Setting up directories...${NC}"
mkdir -p compliance/audit-logs
mkdir -p compliance/reports
mkdir -p compliance/evidence

# Navigate to compliance directory
cd compliance

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm init -y > /dev/null 2>&1
    npm install express socket.io uuid node-cron > /dev/null 2>&1
fi

# Start the compliance server
echo -e "${GREEN}Starting compliance server...${NC}"
node compliance-server.js &
COMPLIANCE_PID=$!

# Wait for server to start
sleep 3

# Check if server is running
if curl -s http://localhost:3008/api/compliance/status > /dev/null; then
    echo -e "${GREEN}✅ Compliance Management System is running!${NC}"
    echo ""
    echo "Access the system at:"
    echo -e "${BLUE}🛡️  Dashboard: ${NC}http://localhost:3008"
    echo -e "${BLUE}📊 API Status: ${NC}http://localhost:3008/api/compliance/status"
    echo -e "${BLUE}🔐 Security: ${NC}http://localhost:3008/api/security/status"
    echo -e "${BLUE}📝 Audit: ${NC}http://localhost:3008/api/audit/status"
    echo ""
    echo "Key Features:"
    echo "• SOC 2 Type II compliance framework"
    echo "• GDPR compliance with data protection"
    echo "• ISO 27001 security compliance preparation"
    echo "• Tamper-proof blockchain audit logging"
    echo "• Automated compliance checking"
    echo "• Real-time compliance monitoring"
    echo "• Penetration testing framework"
    echo "• Incident response procedures"
    echo "• Evidence collection and reporting"
    echo ""
    echo "Compliance Frameworks:"
    echo "• SOC 2 Type II - Trust Service Criteria"
    echo "• GDPR - Data Protection & Privacy"
    echo "• ISO 27001 - Information Security"
    echo "• Industry Regulations - Customs & Maritime"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the compliance system${NC}"
    
    # Keep the script running
    wait $COMPLIANCE_PID
else
    echo -e "${YELLOW}⚠️  Failed to start compliance server${NC}"
    kill $COMPLIANCE_PID 2>/dev/null
    exit 1
fi