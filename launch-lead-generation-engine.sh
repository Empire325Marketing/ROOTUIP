#!/bin/bash

echo "🚀 Launching ROOTUIP Lead Generation Engine"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Kill existing processes
echo -e "${BLUE}Stopping existing lead generation services...${NC}"
pkill -f "enterprise-lead-generation-engine.js" 2>/dev/null
pkill -f "sales-enablement-dashboard.js" 2>/dev/null

# Install required dependencies if not present
echo -e "${BLUE}Checking dependencies...${NC}"
if ! npm list handlebars &>/dev/null; then
    echo -e "${YELLOW}Installing missing dependencies...${NC}"
    npm install handlebars pdfkit --legacy-peer-deps
fi

# Start Lead Generation Engine
echo -e "${GREEN}Starting Lead Generation Engine...${NC}"
echo -e "${CYAN}Starting Lead Capture & Automation System...${NC}"
PORT=3020 node enterprise-lead-generation-engine.js &
LEAD_ENGINE_PID=$!
sleep 3

# Start Sales Enablement Platform  
echo -e "${CYAN}Starting Sales Enablement Platform...${NC}"
PORT=3021 node sales-enablement-dashboard.js &
SALES_PLATFORM_PID=$!
sleep 3

# Start Lead Dashboard Server
echo -e "${CYAN}Starting Lead Dashboard...${NC}"
python3 -m http.server 8085 --directory /home/iii/ROOTUIP &
DASHBOARD_PID=$!
sleep 2

# Import CRM Integration
echo -e "${BLUE}Integrating CRM systems...${NC}"
node -e "
const CRMIntegration = require('./enterprise-crm-integration.js');
const crm = new CRMIntegration();
console.log('CRM Integration Engine initialized');
" &
sleep 2

# Health check all services
echo -e "${BLUE}Performing health checks...${NC}"

declare -A services=(
    ["Lead Generation Engine"]="http://localhost:3020/health"
    ["Sales Enablement Platform"]="http://localhost:3021/health"
)

all_healthy=true
for service in "${!services[@]}"; do
    url="${services[$service]}"
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $service: Healthy${NC}"
    else
        echo -e "${RED}✗ $service: Unhealthy${NC}"
        all_healthy=false
    fi
done

echo ""
echo -e "${GREEN}🎉 ROOTUIP Lead Generation Engine Launched!${NC}"
echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}📊 System Status: ALL SYSTEMS OPERATIONAL${NC}"
else
    echo -e "${YELLOW}⚠️  System Status: Some services need attention${NC}"
fi

echo ""
echo "🌐 Access Points:"
echo -e "${CYAN}Lead Dashboard:${NC} http://localhost:8085/enterprise-lead-dashboard.html"
echo -e "${CYAN}Lead Generation API:${NC} http://localhost:3020"
echo -e "${CYAN}Sales Enablement API:${NC} http://localhost:3021"
echo ""

echo "🔧 Lead Generation Services:"
echo -e "${BLUE}Lead Capture & Automation:${NC} http://localhost:3020 (PID: $LEAD_ENGINE_PID)"
echo -e "${BLUE}Sales Enablement Platform:${NC} http://localhost:3021 (PID: $SALES_PLATFORM_PID)"
echo ""

echo "💼 Lead Generation Capabilities:"
echo "• ROI calculator lead capture with database storage"
echo "• Progressive profiling for enterprise qualification"
echo "• Demo booking system with calendar integration"
echo "• Assessment tool with automated lead scoring"
echo "• Form abandonment recovery with email automation"
echo ""

echo "🤖 CRM Integration Features:"
echo "• Salesforce/HubSpot integration for lead management"
echo "• Automatic lead creation with qualification scoring"
echo "• Activity tracking and engagement monitoring"
echo "• Pipeline progression automation"
echo "• Attribution reporting for marketing campaigns"
echo ""

echo "✉️ Email Automation Sequences:"
echo "• ROI calculator follow-up sequence (7 emails)"
echo "• Demo booking confirmation and preparation"
echo "• No-show recovery and rescheduling"
echo "• Technical evaluation nurture sequence"
echo "• Executive decision-maker targeted content"
echo ""

echo "🎯 Lead Qualification Engine:"
echo "• Company size and revenue qualification"
echo "• Budget authority and timeline scoring"
echo "• Pain point identification and matching"
echo "• Technical requirements assessment"
echo "• Decision-maker identification and mapping"
echo ""

echo "📈 Sales Enablement Tools:"
echo "• Lead intelligence dashboard for sales team"
echo "• Prospect preparation materials auto-generation"
echo "• Custom demo environment setup"
echo "• Proposal template population"
echo "• Contract generation and e-signature integration"
echo ""

echo "🎯 API Endpoints:"
echo "• POST /api/leads/capture - Capture new leads"
echo "• POST /api/leads/:id/profile - Progressive profiling"
echo "• POST /api/leads/:id/demo - Schedule demos"
echo "• GET /api/sales/leads/:id/intelligence - Lead intelligence"
echo "• POST /api/sales/leads/:id/materials - Generate materials"
echo ""

echo -e "${YELLOW}💰 Ready to convert Fortune 500 prospects into $500K+ contracts!${NC}"
echo ""
echo "Press Ctrl+C to stop all services..."

# Keep the script running and monitor services
while true; do
    sleep 30
    
    # Quick health check
    if ! curl -s -f http://localhost:3020/health > /dev/null 2>&1; then
        echo -e "${RED}$(date): Warning - Lead Generation Engine appears down${NC}"
    fi
    
    if ! curl -s -f http://localhost:3021/health > /dev/null 2>&1; then
        echo -e "${RED}$(date): Warning - Sales Enablement Platform appears down${NC}"
    fi
done

# Cleanup on exit
trap 'echo -e "\n${YELLOW}Stopping all services...${NC}"; kill $LEAD_ENGINE_PID $SALES_PLATFORM_PID $DASHBOARD_PID 2>/dev/null; exit' INT