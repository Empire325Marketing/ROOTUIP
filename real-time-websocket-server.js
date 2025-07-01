#!/usr/bin/env node

/**
 * ROOTUIP Real-Time WebSocket Server
 * Enterprise-grade real-time communication hub
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["https://rootuip.com", "https://app.rootuip.com", "https://api.rootuip.com"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.REALTIME_PORT || 3020;

// Redis setup for pub/sub
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const redisSubscriber = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Real-time data storage
const realTimeData = {
    containers: new Map(),
    alerts: [],
    metrics: {
        performance: {},
        business: {},
        system: {}
    },
    users: new Set(),
    notifications: []
};

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        await redisSubscriber.connect();
        console.log('✅ Redis connected for real-time messaging');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    realTimeData.users.add(socket.id);

    // Send initial data
    socket.emit('initial-data', {
        containers: Array.from(realTimeData.containers.values()),
        alerts: realTimeData.alerts,
        metrics: realTimeData.metrics,
        notifications: realTimeData.notifications
    });

    // Handle client subscriptions
    socket.on('subscribe', (channels) => {
        if (Array.isArray(channels)) {
            channels.forEach(channel => {
                socket.join(channel);
                console.log(`📡 Client ${socket.id} subscribed to ${channel}`);
            });
        }
    });

    // Handle container tracking requests
    socket.on('track-container', (containerId) => {
        socket.join(`container-${containerId}`);
        if (realTimeData.containers.has(containerId)) {
            socket.emit('container-update', realTimeData.containers.get(containerId));
        }
    });

    // Handle dashboard metrics subscription
    socket.on('subscribe-metrics', (metricTypes) => {
        metricTypes.forEach(type => {
            socket.join(`metrics-${type}`);
        });
        socket.emit('metrics-update', realTimeData.metrics);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        realTimeData.users.delete(socket.id);
    });

    // Handle ping for connection testing
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// Redis pub/sub message handling
redisSubscriber.subscribe('container-updates', (message) => {
    try {
        const data = JSON.parse(message);
        realTimeData.containers.set(data.id, data);
        io.to(`container-${data.id}`).emit('container-update', data);
        io.to('dashboard').emit('container-list-update', Array.from(realTimeData.containers.values()));
    } catch (error) {
        console.error('Error processing container update:', error);
    }
});

redisSubscriber.subscribe('alerts', (message) => {
    try {
        const alert = JSON.parse(message);
        realTimeData.alerts.unshift(alert);
        if (realTimeData.alerts.length > 100) realTimeData.alerts.pop();
        
        io.emit('alert', alert);
        console.log(`🚨 Alert broadcast: ${alert.type} - ${alert.message}`);
    } catch (error) {
        console.error('Error processing alert:', error);
    }
});

redisSubscriber.subscribe('metrics-update', (message) => {
    try {
        const metrics = JSON.parse(message);
        Object.assign(realTimeData.metrics, metrics);
        io.to('metrics-performance').emit('performance-update', metrics.performance);
        io.to('metrics-business').emit('business-update', metrics.business);
        io.to('metrics-system').emit('system-update', metrics.system);
    } catch (error) {
        console.error('Error processing metrics update:', error);
    }
});

redisSubscriber.subscribe('notifications', (message) => {
    try {
        const notification = JSON.parse(message);
        realTimeData.notifications.unshift(notification);
        if (realTimeData.notifications.length > 50) realTimeData.notifications.pop();
        
        if (notification.userId) {
            io.to(notification.userId).emit('notification', notification);
        } else {
            io.emit('broadcast-notification', notification);
        }
    } catch (error) {
        console.error('Error processing notification:', error);
    }
});

// REST API endpoints for external services
app.get('/api/realtime/status', (req, res) => {
    res.json({
        status: 'online',
        connectedUsers: realTimeData.users.size,
        containers: realTimeData.containers.size,
        alerts: realTimeData.alerts.length,
        uptime: process.uptime()
    });
});

app.post('/api/realtime/container-update', async (req, res) => {
    try {
        const containerData = req.body;
        await redisClient.publish('container-updates', JSON.stringify(containerData));
        res.json({ success: true, message: 'Container update published' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/realtime/alert', async (req, res) => {
    try {
        const alert = {
            id: `alert-${Date.now()}`,
            timestamp: new Date().toISOString(),
            ...req.body
        };
        await redisClient.publish('alerts', JSON.stringify(alert));
        res.json({ success: true, alertId: alert.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/realtime/metrics', async (req, res) => {
    try {
        const metrics = req.body;
        await redisClient.publish('metrics-update', JSON.stringify(metrics));
        res.json({ success: true, message: 'Metrics update published' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/realtime/notification', async (req, res) => {
    try {
        const notification = {
            id: `notif-${Date.now()}`,
            timestamp: new Date().toISOString(),
            ...req.body
        };
        await redisClient.publish('notifications', JSON.stringify(notification));
        res.json({ success: true, notificationId: notification.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'real-time-websocket-server',
        connectedUsers: realTimeData.users.size,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Simulated real-time data generation for demo
function generateDemoData() {
    // Generate container updates
    const containerIds = ['MSKU1234567', 'MSCU2345678', 'HLBU3456789', 'EVGU4567890'];
    
    setInterval(async () => {
        const containerId = containerIds[Math.floor(Math.random() * containerIds.length)];
        const statuses = ['In Transit', 'At Port', 'Loading', 'Unloading', 'Customs', 'Delivered'];
        const locations = ['Singapore Port', 'Los Angeles Port', 'Rotterdam Port', 'Hamburg Port', 'Shanghai Port'];
        
        const containerUpdate = {
            id: containerId,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            location: locations[Math.floor(Math.random() * locations.length)],
            latitude: (Math.random() * 180 - 90).toFixed(6),
            longitude: (Math.random() * 360 - 180).toFixed(6),
            lastUpdate: new Date().toISOString(),
            eta: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            demurrageRisk: Math.random(),
            temperature: (Math.random() * 30 + 10).toFixed(1),
            humidity: (Math.random() * 40 + 40).toFixed(1)
        };

        try {
            await redisClient.publish('container-updates', JSON.stringify(containerUpdate));
        } catch (error) {
            console.error('Error publishing demo container update:', error);
        }
    }, 30000); // Every 30 seconds

    // Generate performance metrics
    setInterval(async () => {
        const metrics = {
            performance: {
                cpuUsage: Math.random() * 100,
                memoryUsage: Math.random() * 100,
                responseTime: Math.random() * 1000,
                throughput: Math.random() * 1000 + 500,
                errorRate: Math.random() * 5
            },
            business: {
                revenue: Math.random() * 100000 + 2000000,
                containers: Math.floor(Math.random() * 100) + 1200,
                onTimeDelivery: Math.random() * 10 + 90,
                customerSatisfaction: Math.random() * 5 + 95,
                costSavings: Math.random() * 50000 + 800000
            },
            system: {
                activeUsers: Math.floor(Math.random() * 50) + 100,
                apiCalls: Math.floor(Math.random() * 1000) + 5000,
                databaseConnections: Math.floor(Math.random() * 20) + 30,
                queueSize: Math.floor(Math.random() * 100),
                uptime: 99.9 + Math.random() * 0.1
            }
        };

        try {
            await redisClient.publish('metrics-update', JSON.stringify(metrics));
        } catch (error) {
            console.error('Error publishing demo metrics:', error);
        }
    }, 10000); // Every 10 seconds

    // Generate random alerts
    setInterval(async () => {
        if (Math.random() < 0.3) { // 30% chance every minute
            const alertTypes = ['warning', 'critical', 'info', 'success'];
            const messages = [
                'Container MSKU1234567 approaching demurrage threshold',
                'High API response time detected',
                'New container arrived at Singapore Port',
                'System performance optimal',
                'Critical: Container temperature exceeded limits',
                'Payment processed successfully',
                'Customer satisfaction score updated'
            ];

            const alert = {
                type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
                message: messages[Math.floor(Math.random() * messages.length)],
                source: 'system',
                priority: Math.floor(Math.random() * 3) + 1
            };

            try {
                await redisClient.publish('alerts', JSON.stringify(alert));
            } catch (error) {
                console.error('Error publishing demo alert:', error);
            }
        }
    }, 60000); // Every minute
}

// Start demo data generation
setTimeout(generateDemoData, 5000); // Start after 5 seconds

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        redisClient.quit();
        redisSubscriber.quit();
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Real-Time WebSocket Server running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`⚡ Real-time features activated`);
});

module.exports = { app, server, io };