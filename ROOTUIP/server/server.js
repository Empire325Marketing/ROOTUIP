const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// Import route handlers
const leadRoutes = require('./routes/lead-capture');
const analyticsRoutes = require('./routes/analytics');
const integrationRoutes = require('./routes/integrations');
const realTimeRoutes = require('./routes/realtime');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: ['https://rootuip.com', 'https://www.rootuip.com', 'http://localhost'],
    credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/api/static', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/leads', leadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/realtime', realTimeRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

// WebSocket connections for real-time features
const connectedClients = new Set();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from:', req.connection.remoteAddress);
    connectedClients.add(ws);
    
    // Send initial connection message
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to ROOTUIP real-time server',
        timestamp: new Date().toISOString()
    }));
    
    // Handle client messages
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('Received WebSocket message:', message);
            
            // Echo back for testing
            ws.send(JSON.stringify({
                type: 'echo',
                originalMessage: message,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('WebSocket message parsing error:', error);
        }
    });
    
    // Handle connection close
    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log('WebSocket connection closed');
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws);
    });
});

// Broadcast function for real-time updates
global.broadcastToClients = (data) => {
    const message = JSON.stringify(data);
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

// Start periodic real-time data broadcasting
setInterval(() => {
    const realtimeData = {
        type: 'container_tracking',
        data: {
            containersTracked: Math.floor(Math.random() * 1000) + 5000,
            activeShipments: Math.floor(Math.random() * 500) + 1200,
            costsSaved: Math.floor(Math.random() * 100000) + 500000,
            timestamp: new Date().toISOString()
        }
    };
    
    global.broadcastToClients(realtimeData);
}, 5000); // Update every 5 seconds

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'API endpoint not found'
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ROOTUIP Backend Server running on port ${PORT}`);
    console.log(`📡 WebSocket server available at ws://localhost:${PORT}/ws`);
    console.log(`🌐 API available at http://localhost:${PORT}/api`);
});