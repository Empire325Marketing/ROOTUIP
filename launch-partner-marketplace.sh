#!/bin/bash

# ROOTUIP Partner Marketplace Launcher
# Start all marketplace services

echo "🌐 Starting ROOTUIP Partner Marketplace..."
echo "==========================================="

# Set environment
export NODE_ENV=production
export PORT=8090

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create required directories
echo -e "${BLUE}Setting up directories...${NC}"
mkdir -p partner-marketplace/data
mkdir -p partner-marketplace/logs
mkdir -p partner-marketplace/uploads

# Start marketplace services
echo -e "${BLUE}Starting marketplace services...${NC}"

# Start the marketplace server
cd partner-marketplace

# Create a simple Express server to serve the marketplace
cat > marketplace-server.js << 'EOF'
const express = require('express');
const path = require('path');
const { IntegrationMarketplace, PartnerManager } = require('./core/marketplace-core');
const PartnerAPI = require('./developer-platform/partner-api');
const SandboxEnvironment = require('./developer-platform/sandbox-environment');
const CertificationSystem = require('./certification/certification-system');
const AnalyticsPlatform = require('./analytics/analytics-platform');
const RevenueSharingSystem = require('./revenue/revenue-sharing-system');

const app = express();
const PORT = process.env.PORT || 8090;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// Initialize systems
const marketplace = new IntegrationMarketplace();
const partnerManager = new PartnerManager();
const partnerAPI = new PartnerAPI(marketplace, partnerManager);
const sandbox = new SandboxEnvironment();
const certification = new CertificationSystem();
const analytics = new AnalyticsPlatform();
const revenueSharing = new RevenueSharingSystem();

// API Routes
app.use('/api/partner', partnerAPI.setupRoutes());

// Marketplace UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'marketplace-interface.html'));
});

// Partner Portal
app.get('/partner-portal.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'partner-portal.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ROOTUIP Partner Marketplace',
        timestamp: new Date(),
        systems: {
            marketplace: 'active',
            partnerAPI: 'active',
            sandbox: 'active',
            certification: 'active',
            analytics: 'active',
            revenueSharing: 'active'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n✅ Partner Marketplace running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/partner/docs`);
    console.log(`🏪 Marketplace: http://localhost:${PORT}`);
    console.log(`👥 Partner Portal: http://localhost:${PORT}/partner-portal.html`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down marketplace...');
    process.exit(0);
});
EOF

# Start the server
echo -e "${GREEN}Starting marketplace server...${NC}"
node marketplace-server.js &
MARKETPLACE_PID=$!

# Wait for server to start
sleep 3

# Check if server is running
if curl -s http://localhost:8090/health > /dev/null; then
    echo -e "${GREEN}✅ Partner Marketplace is running!${NC}"
    echo ""
    echo "Access the marketplace at:"
    echo -e "${BLUE}🏪 Marketplace: ${NC}http://localhost:8090"
    echo -e "${BLUE}👥 Partner Portal: ${NC}http://localhost:8090/partner-portal.html"
    echo -e "${BLUE}📚 API Docs: ${NC}http://localhost:8090/api/partner/docs"
    echo ""
    echo "Features available:"
    echo "• Browse integration marketplace"
    echo "• Partner developer portal"
    echo "• API documentation and testing"
    echo "• Sandbox environment"
    echo "• Certification system"
    echo "• Analytics dashboard"
    echo "• Revenue sharing management"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the marketplace${NC}"
    
    # Keep the script running
    wait $MARKETPLACE_PID
else
    echo -e "${YELLOW}⚠️  Failed to start marketplace server${NC}"
    kill $MARKETPLACE_PID 2>/dev/null
    exit 1
fi