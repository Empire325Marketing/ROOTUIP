#!/bin/bash

# ROOTUIP Quality Control System Launcher
# Start the data quality and validation system

echo "🛡️ Starting ROOTUIP Quality Control System..."
echo "============================================"

# Set environment
export NODE_ENV=production
export PORT=8095

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create required directories
echo -e "${BLUE}Setting up directories...${NC}"
mkdir -p quality-control/logs
mkdir -p quality-control/reports
mkdir -p quality-control/corrections

# Start quality control server
cd quality-control

# Create a simple Express server for the quality control system
cat > quality-server.js << 'EOF'
const express = require('express');
const path = require('path');
const QualityControlSystem = require('./quality-control-system');

const app = express();
const PORT = process.env.PORT || 8095;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize Quality Control System
const qualityControl = new QualityControlSystem();

// API Routes
app.post('/api/validate', async (req, res) => {
    try {
        const { dataType, data, options } = req.body;
        const validation = await qualityControl.validateData(dataType, data, options);
        res.json(validation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json(qualityControl.getSystemStatus());
});

app.get('/api/report', async (req, res) => {
    try {
        const report = await qualityControl.generateQualityReport(req.query);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/approval/:id', async (req, res) => {
    try {
        const { decision, reviewer } = req.body;
        const result = await qualityControl.processApproval(req.params.id, decision, reviewer);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Quality Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'quality-dashboard.html'));
});

// WebSocket for real-time updates
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Quality control events
qualityControl.on('validation:completed', (validation) => {
    io.emit('validation:update', validation);
});

qualityControl.on('correction:completed', (execution) => {
    io.emit('correction:update', execution);
});

qualityControl.on('health:updated', (health) => {
    io.emit('health:update', health);
});

qualityControl.on('critical:violation', (violation) => {
    io.emit('alert:critical', violation);
});

qualityControl.on('approval:required', (approval) => {
    io.emit('approval:required', approval);
});

// Socket connection
io.on('connection', (socket) => {
    console.log('Dashboard connected');
    
    // Send current status
    socket.emit('status:update', qualityControl.getSystemStatus());
    
    socket.on('disconnect', () => {
        console.log('Dashboard disconnected');
    });
});

// Start server
http.listen(PORT, () => {
    console.log(`\n✅ Quality Control System running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📡 API Endpoint: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down quality control system...');
    await qualityControl.shutdown();
    process.exit(0);
});

// Demo data validation
setTimeout(() => {
    console.log('\n📋 Running demo validation...');
    
    // Validate container data
    qualityControl.validateData('container', {
        containerId: 'MAEU1234567',  // Missing check digit
        status: 'in_transit',
        location: {
            latitude: 1.290270,
            longitude: 103.851959,
            timestamp: new Date()
        },
        weight: 25000
    }, { autoCorrect: true }).then(result => {
        console.log('Container validation:', result.overallValid ? 'PASSED' : 'FAILED');
    });
    
    // Validate shipment data
    qualityControl.validateData('shipment', {
        shipmentId: 'SHIP-2024-123456',
        origin: {
            port: 'SHA',  // Invalid port code
            country: 'CN',
            date: new Date()
        },
        destination: {
            port: 'USOAK',
            country: 'US',
            eta: new Date(Date.now() - 86400000)  // ETA in the past
        },
        cargo: {
            description: 'Electronics',
            hsCode: '8471.30',  // Contains dot
            value: 50000,
            currency: 'USD'
        }
    }, { autoCorrect: true }).then(result => {
        console.log('Shipment validation:', result.overallValid ? 'PASSED' : 'FAILED');
    });
    
}, 3000);
EOF

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm init -y > /dev/null 2>&1
    npm install express socket.io uuid > /dev/null 2>&1
fi

# Start the server
echo -e "${GREEN}Starting quality control server...${NC}"
node quality-server.js &
QC_PID=$!

# Wait for server to start
sleep 3

# Check if server is running
if curl -s http://localhost:8095/api/status > /dev/null; then
    echo -e "${GREEN}✅ Quality Control System is running!${NC}"
    echo ""
    echo "Access the system at:"
    echo -e "${BLUE}📊 Dashboard: ${NC}http://localhost:8095"
    echo -e "${BLUE}📡 API Status: ${NC}http://localhost:8095/api/status"
    echo -e "${BLUE}📈 Reports: ${NC}http://localhost:8095/api/report"
    echo ""
    echo "Features available:"
    echo "• Real-time data validation"
    echo "• Automated error correction"
    echo "• Business rule compliance"
    echo "• Integration quality monitoring"
    echo "• Data anomaly detection"
    echo "• Quality metrics dashboard"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the quality control system${NC}"
    
    # Keep the script running
    wait $QC_PID
else
    echo -e "${YELLOW}⚠️  Failed to start quality control server${NC}"
    kill $QC_PID 2>/dev/null
    exit 1
fi