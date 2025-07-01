#!/usr/bin/env node

/**
 * ROOTUIP Enhanced Real-Time WebSocket Server
 * Central hub for all real-time communications
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const { logger } = require('./lib/monitoring');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.WEBSOCKET_PORT || 3005;

// Redis clients for pub/sub
const publisher = new Redis({
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD
});

const subscriber = new Redis({
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD
});

// Configure Socket.IO with clustering support
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ["https://rootuip.com"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6, // 1MB
    perMessageDeflate: {
        threshold: 1024 // Compress messages larger than 1KB
    }
});

// Connection tracking
const connections = new Map();
const roomStats = new Map();

// Message types for real-time updates
const MESSAGE_TYPES = {
    // Container tracking
    CONTAINER_UPDATE: 'container:update',
    CONTAINER_STATUS: 'container:status',
    CONTAINER_LOCATION: 'container:location',
    CONTAINER_ETA: 'container:eta',
    
    // AI/ML predictions
    RISK_SCORE_UPDATE: 'risk:update',
    PREDICTION_UPDATE: 'prediction:update',
    ANOMALY_DETECTED: 'anomaly:detected',
    
    // Alerts and notifications
    CRITICAL_ALERT: 'alert:critical',
    WARNING_ALERT: 'alert:warning',
    INFO_NOTIFICATION: 'notification:info',
    
    // Performance metrics
    METRICS_UPDATE: 'metrics:update',
    KPI_UPDATE: 'kpi:update',
    SYSTEM_STATUS: 'system:status',
    
    // Collaboration
    USER_ACTIVITY: 'user:activity',
    DATA_SYNC: 'data:sync',
    PRESENCE_UPDATE: 'presence:update'
};

// Authentication middleware for Socket.IO
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return next(new Error('Authentication required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.userRole = decoded.role;
        socket.permissions = decoded.permissions;
        
        logger.info('WebSocket authenticated', { 
            userId: socket.userId, 
            email: socket.userEmail 
        });
        
        next();
    } catch (error) {
        logger.error('WebSocket authentication failed', { error: error.message });
        next(new Error('Authentication failed'));
    }
});

// Connection handler
io.on('connection', (socket) => {
    const connectionInfo = {
        id: socket.id,
        userId: socket.userId,
        email: socket.userEmail,
        role: socket.userRole,
        connectedAt: new Date(),
        rooms: new Set(['global'])
    };
    
    connections.set(socket.id, connectionInfo);
    
    logger.info('WebSocket client connected', {
        socketId: socket.id,
        userId: socket.userId,
        totalConnections: connections.size
    });
    
    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    
    // Join role-based room
    socket.join(`role:${socket.userRole}`);
    
    // Send connection acknowledgment
    socket.emit('connected', {
        socketId: socket.id,
        userId: socket.userId,
        serverTime: new Date().toISOString()
    });
    
    // Handle room subscriptions
    socket.on('subscribe', (data) => {
        const { rooms } = data;
        const allowedRooms = filterAllowedRooms(rooms, socket.permissions);
        
        allowedRooms.forEach(room => {
            socket.join(room);
            connectionInfo.rooms.add(room);
            updateRoomStats(room, 1);
            
            logger.info('Client subscribed to room', {
                socketId: socket.id,
                room
            });
        });
        
        socket.emit('subscribed', { rooms: allowedRooms });
    });
    
    // Handle unsubscribe
    socket.on('unsubscribe', (data) => {
        const { rooms } = data;
        
        rooms.forEach(room => {
            socket.leave(room);
            connectionInfo.rooms.delete(room);
            updateRoomStats(room, -1);
        });
    });
    
    // Handle container tracking
    socket.on('track:container', async (data) => {
        const { containerNumber } = data;
        
        // Join container-specific room
        socket.join(`container:${containerNumber}`);
        connectionInfo.rooms.add(`container:${containerNumber}`);
        
        // Send initial container data
        const containerData = await getContainerData(containerNumber);
        socket.emit(MESSAGE_TYPES.CONTAINER_UPDATE, containerData);
        
        logger.info('Client tracking container', {
            socketId: socket.id,
            containerNumber
        });
    });
    
    // Handle presence updates for collaboration
    socket.on('presence:update', (data) => {
        const presenceData = {
            userId: socket.userId,
            email: socket.userEmail,
            status: data.status,
            activity: data.activity,
            timestamp: new Date().toISOString()
        };
        
        // Broadcast to relevant rooms
        socket.rooms.forEach(room => {
            if (room.startsWith('container:') || room.startsWith('dashboard:')) {
                socket.to(room).emit(MESSAGE_TYPES.PRESENCE_UPDATE, presenceData);
            }
        });
    });
    
    // Handle custom events from clients
    socket.on('broadcast', (data) => {
        if (hasPermission(socket, 'broadcast')) {
            const { room, event, payload } = data;
            io.to(room).emit(event, {
                ...payload,
                broadcastedBy: socket.userId,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
        const connectionInfo = connections.get(socket.id);
        
        if (connectionInfo) {
            connectionInfo.rooms.forEach(room => {
                updateRoomStats(room, -1);
            });
        }
        
        connections.delete(socket.id);
        
        logger.info('WebSocket client disconnected', {
            socketId: socket.id,
            userId: socket.userId,
            reason,
            totalConnections: connections.size
        });
    });
    
    // Error handling
    socket.on('error', (error) => {
        logger.error('WebSocket error', {
            socketId: socket.id,
            error: error.message
        });
    });
});

// Redis pub/sub for inter-service communication
subscriber.on('message', (channel, message) => {
    try {
        const data = JSON.parse(message);
        
        logger.debug('Redis message received', { channel, type: data.type });
        
        switch (channel) {
            case 'realtime:containers':
                handleContainerUpdate(data);
                break;
            case 'realtime:predictions':
                handlePredictionUpdate(data);
                break;
            case 'realtime:alerts':
                handleAlertUpdate(data);
                break;
            case 'realtime:metrics':
                handleMetricsUpdate(data);
                break;
            case 'realtime:notifications':
                handleNotification(data);
                break;
        }
    } catch (error) {
        logger.error('Error processing Redis message', { error: error.message });
    }
});

// Subscribe to Redis channels
subscriber.subscribe(
    'realtime:containers',
    'realtime:predictions',
    'realtime:alerts',
    'realtime:metrics',
    'realtime:notifications'
);

// Handler functions for different update types
function handleContainerUpdate(data) {
    const { containerNumber, update } = data;
    const room = `container:${containerNumber}`;
    
    io.to(room).emit(MESSAGE_TYPES.CONTAINER_UPDATE, {
        containerNumber,
        ...update,
        timestamp: new Date().toISOString()
    });
    
    // Also notify dashboard subscribers
    io.to('dashboard:operations').emit(MESSAGE_TYPES.CONTAINER_STATUS, {
        containerNumber,
        status: update.status,
        location: update.location,
        timestamp: new Date().toISOString()
    });
}

function handlePredictionUpdate(data) {
    const { containerNumber, predictions } = data;
    
    // Send to container room
    io.to(`container:${containerNumber}`).emit(MESSAGE_TYPES.PREDICTION_UPDATE, {
        containerNumber,
        predictions,
        timestamp: new Date().toISOString()
    });
    
    // Check for risk alerts
    if (predictions.riskScore > 0.7) {
        io.to('alerts:high-risk').emit(MESSAGE_TYPES.CRITICAL_ALERT, {
            type: 'high_risk_container',
            containerNumber,
            riskScore: predictions.riskScore,
            message: `High risk detected for container ${containerNumber}`,
            timestamp: new Date().toISOString()
        });
    }
}

function handleAlertUpdate(data) {
    const { severity, message, details } = data;
    
    let eventType;
    let rooms = ['alerts:all'];
    
    switch (severity) {
        case 'critical':
            eventType = MESSAGE_TYPES.CRITICAL_ALERT;
            rooms.push('alerts:critical', 'role:admin', 'role:executive');
            break;
        case 'warning':
            eventType = MESSAGE_TYPES.WARNING_ALERT;
            rooms.push('alerts:warning', 'role:operations');
            break;
        default:
            eventType = MESSAGE_TYPES.INFO_NOTIFICATION;
    }
    
    rooms.forEach(room => {
        io.to(room).emit(eventType, {
            severity,
            message,
            details,
            timestamp: new Date().toISOString()
        });
    });
}

function handleMetricsUpdate(data) {
    const { metrics, kpis } = data;
    
    // Send to dashboard subscribers
    io.to('dashboard:executive').emit(MESSAGE_TYPES.METRICS_UPDATE, {
        metrics,
        timestamp: new Date().toISOString()
    });
    
    io.to('dashboard:operations').emit(MESSAGE_TYPES.KPI_UPDATE, {
        kpis,
        timestamp: new Date().toISOString()
    });
}

function handleNotification(data) {
    const { userId, type, message, details } = data;
    
    if (userId) {
        // Personal notification
        io.to(`user:${userId}`).emit(MESSAGE_TYPES.INFO_NOTIFICATION, {
            type,
            message,
            details,
            timestamp: new Date().toISOString()
        });
    } else {
        // Broadcast notification
        io.emit(MESSAGE_TYPES.INFO_NOTIFICATION, {
            type,
            message,
            details,
            timestamp: new Date().toISOString()
        });
    }
}

// Helper functions
function filterAllowedRooms(rooms, permissions) {
    return rooms.filter(room => {
        if (permissions.includes('*')) return true;
        
        if (room.startsWith('container:')) {
            return permissions.includes('view_containers');
        }
        if (room.startsWith('dashboard:')) {
            return permissions.includes('view_dashboard');
        }
        if (room.startsWith('alerts:')) {
            return permissions.includes('view_alerts');
        }
        
        return true;
    });
}

function hasPermission(socket, permission) {
    return socket.permissions.includes('*') || socket.permissions.includes(permission);
}

function updateRoomStats(room, delta) {
    const current = roomStats.get(room) || 0;
    const updated = Math.max(0, current + delta);
    
    if (updated === 0) {
        roomStats.delete(room);
    } else {
        roomStats.set(room, updated);
    }
}

async function getContainerData(containerNumber) {
    // This would fetch from database/cache
    return {
        containerNumber,
        status: 'in_transit',
        location: 'Singapore Port',
        eta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        riskScore: 0.23
    };
}

// API endpoints for server stats
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        connections: connections.size,
        rooms: roomStats.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/stats', (req, res) => {
    const stats = {
        totalConnections: connections.size,
        connectionsByRole: {},
        activeRooms: {},
        uptime: process.uptime()
    };
    
    // Count connections by role
    connections.forEach(conn => {
        stats.connectionsByRole[conn.role] = (stats.connectionsByRole[conn.role] || 0) + 1;
    });
    
    // Get room statistics
    roomStats.forEach((count, room) => {
        stats.activeRooms[room] = count;
    });
    
    res.json(stats);
});

// Start server
server.listen(PORT, () => {
    logger.info(`🚀 Enhanced WebSocket server running on port ${PORT}`);
    logger.info('📡 Real-time features activated');
    logger.info('🔄 Redis pub/sub connected');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing WebSocket server');
    
    io.close(() => {
        logger.info('WebSocket server closed');
        publisher.quit();
        subscriber.quit();
        process.exit(0);
    });
});

module.exports = { io, publisher };