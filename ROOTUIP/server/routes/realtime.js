const express = require('express');
const router = express.Router();

// Real-time data streams
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial data
    const sendData = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    // Send periodic updates
    const interval = setInterval(() => {
        const realtimeData = {
            timestamp: new Date().toISOString(),
            metrics: {
                containersTracked: Math.floor(Math.random() * 100) + 5000,
                activeShipments: Math.floor(Math.random() * 50) + 1200,
                costsSaved: Math.floor(Math.random() * 10000) + 500000,
                apiCalls: Math.floor(Math.random() * 20) + 100
            },
            alerts: [
                {
                    type: 'delay',
                    container: 'MSKU' + Math.floor(Math.random() * 9999999),
                    message: 'Container delayed 2 hours due to port congestion'
                }
            ]
        };
        
        sendData(realtimeData);
    }, 2000);
    
    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(interval);
    });
    
    req.on('end', () => {
        clearInterval(interval);
    });
});

// Get current system status
router.get('/status', (req, res) => {
    const systemStatus = {
        overall: 'operational',
        services: {
            api: { status: 'operational', responseTime: '45ms' },
            database: { status: 'operational', responseTime: '12ms' },
            integrations: { status: 'operational', activeConnections: 11 },
            websockets: { status: 'operational', connectedClients: 23 }
        },
        metrics: {
            uptime: '99.8%',
            requestsPerSecond: 127,
            averageResponseTime: '38ms',
            errorRate: '0.2%'
        },
        timestamp: new Date().toISOString()
    };
    
    res.json({
        success: true,
        status: systemStatus
    });
});

// Live container movements
router.get('/movements', (req, res) => {
    const movements = [];
    
    for (let i = 0; i < 10; i++) {
        movements.push({
            containerId: 'CONT' + Math.floor(Math.random() * 9999999),
            from: ['Shanghai', 'Rotterdam', 'Hamburg', 'Singapore'][Math.floor(Math.random() * 4)],
            to: ['Los Angeles', 'New York', 'Miami', 'Seattle'][Math.floor(Math.random() * 4)],
            status: ['Departed', 'In Transit', 'Arrived'][Math.floor(Math.random() * 3)],
            timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
        });
    }
    
    res.json({
        success: true,
        movements,
        count: movements.length
    });
});

module.exports = router;