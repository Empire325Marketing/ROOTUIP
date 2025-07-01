// ROOTUIP Real-time Container Tracking Server
// Production-ready WebSocket server with carrier API integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const CarrierAPIIntegration = require('./carrier-api-integration');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const jwt = require('jsonwebtoken');

class RealTimeTrackingServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: process.env.CORS_ORIGIN || "https://app.rootuip.com",
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        this.port = process.env.PORT || 3008;
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/realtime-tracking.log' }),
                new winston.transports.Console()
            ]
        });
        
        this.carrierAPI = new CarrierAPIIntegration();
        this.activeConnections = new Map();
        this.connectionStats = {
            total: 0,
            active: 0,
            companies: new Set(),
            lastActivity: Date.now()
        };
        
        this.setupMiddleware();
        this.setupAuthentication();
        this.setupWebSocket();
        this.setupRoutes();
        this.startRealTimeUpdates();
        this.setupHealthChecks();
    }
    
    setupMiddleware() {
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", "wss:"]
                }
            }
        }));
        
        this.app.use(cors({
            origin: process.env.CORS_ORIGIN || "https://app.rootuip.com",
            credentials: true
        }));
        
        this.app.use(express.json({ limit: '10mb' }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // limit each IP to 1000 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use(limiter);
        
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            next();
        });
    }
    
    setupAuthentication() {
        // JWT middleware for API routes
        this.authenticateJWT = (req, res, next) => {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ error: 'Access token required' });
            }
            
            jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
                if (err) {
                    return res.status(403).json({ error: 'Invalid or expired token' });
                }
                req.user = user;
                next();
            });
        };
        
        // WebSocket authentication
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentication token required'));
            }
            
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return next(new Error('Invalid authentication token'));
                }
                
                socket.userId = decoded.userId;
                socket.companyId = decoded.companyId;
                socket.role = decoded.role;
                next();
            });
        });
    }
    
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            this.handleNewConnection(socket);
            
            socket.on('subscribe_containers', (data) => {
                this.handleContainerSubscription(socket, data);
            });
            
            socket.on('unsubscribe_containers', (data) => {
                this.handleContainerUnsubscription(socket, data);
            });
            
            socket.on('request_container_update', (data) => {
                this.handleManualUpdate(socket, data);
            });
            
            socket.on('get_real_time_stats', () => {
                this.sendRealTimeStats(socket);
            });
            
            socket.on('disconnect', () => {
                this.handleDisconnection(socket);
            });
            
            socket.on('error', (error) => {
                this.logger.error('WebSocket error:', error);
            });
        });
    }
    
    handleNewConnection(socket) {
        const connectionInfo = {
            socketId: socket.id,
            userId: socket.userId,
            companyId: socket.companyId,
            role: socket.role,
            connectedAt: Date.now(),
            subscribedContainers: new Set(),
            lastActivity: Date.now()
        };
        
        this.activeConnections.set(socket.id, connectionInfo);
        this.updateConnectionStats();
        
        // Join company room
        socket.join(`company:${socket.companyId}`);
        
        this.logger.info('New WebSocket connection', {
            socketId: socket.id,
            userId: socket.userId,
            companyId: socket.companyId,
            totalConnections: this.activeConnections.size
        });
        
        // Send initial data
        this.sendInitialData(socket);
    }
    
    async sendInitialData(socket) {
        try {
            const companyContainers = await this.getCompanyContainers(socket.companyId);
            const activeAlerts = await this.getActiveAlerts(socket.companyId);
            
            socket.emit('initial_data', {
                containers: companyContainers,
                alerts: activeAlerts,
                connectionTime: Date.now()
            });
        } catch (error) {
            this.logger.error('Failed to send initial data:', error);
            socket.emit('error', { message: 'Failed to load initial data' });
        }
    }
    
    async getCompanyContainers(companyId) {
        const query = `
            SELECT 
                c.*,
                COUNT(a.id) as alert_count,
                MAX(a.severity) as max_alert_severity
            FROM containers c
            LEFT JOIN alerts a ON c.id = a.container_id AND a.status = 'active'
            WHERE c.company_id = $1 
            AND c.status IN ('In Transit', 'At Port', 'Loading', 'Discharged')
            GROUP BY c.id
            ORDER BY c.estimated_arrival ASC
        `;
        
        const result = await this.db.query(query, [companyId]);
        return result.rows;
    }
    
    async getActiveAlerts(companyId) {
        const query = `
            SELECT a.*, c.container_number
            FROM alerts a
            JOIN containers c ON a.container_id = c.id
            WHERE a.company_id = $1 AND a.status = 'active'
            ORDER BY a.severity DESC, a.created_at DESC
        `;
        
        const result = await this.db.query(query, [companyId]);
        return result.rows;
    }
    
    handleContainerSubscription(socket, data) {
        const connection = this.activeConnections.get(socket.id);
        if (!connection) return;
        
        const { containerNumbers } = data;
        
        if (Array.isArray(containerNumbers)) {
            containerNumbers.forEach(containerNumber => {
                connection.subscribedContainers.add(containerNumber);
                socket.join(`container:${containerNumber}`);
            });
            
            this.logger.info('Container subscription', {
                socketId: socket.id,
                containerNumbers,
                totalSubscriptions: connection.subscribedContainers.size
            });
            
            socket.emit('subscription_confirmed', {
                containers: Array.from(connection.subscribedContainers)
            });
        }
    }
    
    handleContainerUnsubscription(socket, data) {
        const connection = this.activeConnections.get(socket.id);
        if (!connection) return;
        
        const { containerNumbers } = data;
        
        if (Array.isArray(containerNumbers)) {
            containerNumbers.forEach(containerNumber => {
                connection.subscribedContainers.delete(containerNumber);
                socket.leave(`container:${containerNumber}`);
            });
            
            socket.emit('unsubscription_confirmed', {
                containers: Array.from(connection.subscribedContainers)
            });
        }
    }
    
    async handleManualUpdate(socket, data) {
        try {
            const { containerNumber } = data;
            const connection = this.activeConnections.get(socket.id);
            
            if (!connection) return;
            
            // Verify user has access to this container
            const hasAccess = await this.verifyContainerAccess(
                containerNumber, 
                connection.companyId
            );
            
            if (!hasAccess) {
                socket.emit('error', { message: 'Access denied to container' });
                return;
            }
            
            // Trigger manual update
            socket.emit('update_initiated', { containerNumber });
            
            // Get container info and trigger update
            const containerInfo = await this.getContainerInfo(containerNumber);
            if (containerInfo && containerInfo.carrier_code) {
                this.carrierAPI.processContainerUpdate(containerInfo)
                    .then(() => {
                        socket.emit('update_completed', { containerNumber });
                    })
                    .catch(error => {
                        socket.emit('update_failed', { 
                            containerNumber, 
                            error: error.message 
                        });
                    });
            }
            
        } catch (error) {
            this.logger.error('Manual update failed:', error);
            socket.emit('error', { message: 'Update request failed' });
        }
    }
    
    async verifyContainerAccess(containerNumber, companyId) {
        const query = 'SELECT id FROM containers WHERE container_number = $1 AND company_id = $2';
        const result = await this.db.query(query, [containerNumber, companyId]);
        return result.rows.length > 0;
    }
    
    async getContainerInfo(containerNumber) {
        const query = 'SELECT * FROM containers WHERE container_number = $1';
        const result = await this.db.query(query, [containerNumber]);
        return result.rows[0];
    }
    
    sendRealTimeStats(socket) {
        const connection = this.activeConnections.get(socket.id);
        if (!connection) return;
        
        const stats = {
            connectionCount: this.activeConnections.size,
            subscribedContainers: connection.subscribedContainers.size,
            serverUptime: Date.now() - this.serverStartTime,
            lastUpdate: this.connectionStats.lastActivity
        };
        
        socket.emit('real_time_stats', stats);
    }
    
    handleDisconnection(socket) {
        const connection = this.activeConnections.get(socket.id);
        
        if (connection) {
            this.activeConnections.delete(socket.id);
            this.updateConnectionStats();
            
            this.logger.info('WebSocket disconnection', {
                socketId: socket.id,
                userId: connection.userId,
                companyId: connection.companyId,
                sessionDuration: Date.now() - connection.connectedAt,
                totalConnections: this.activeConnections.size
            });
        }
    }
    
    updateConnectionStats() {
        this.connectionStats.active = this.activeConnections.size;
        this.connectionStats.companies.clear();
        
        for (const connection of this.activeConnections.values()) {
            this.connectionStats.companies.add(connection.companyId);
        }
        
        this.connectionStats.lastActivity = Date.now();
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                connections: this.connectionStats.active,
                companies: this.connectionStats.companies.size,
                uptime: Date.now() - this.serverStartTime
            });
        });
        
        // WebSocket connection stats (protected)
        this.app.get('/api/websocket/stats', this.authenticateJWT, (req, res) => {
            res.json({
                ...this.connectionStats,
                companies: this.connectionStats.companies.size
            });
        });
        
        // Manual container update trigger
        this.app.post('/api/containers/:containerNumber/update', 
            this.authenticateJWT, 
            async (req, res) => {
                try {
                    const { containerNumber } = req.params;
                    
                    const hasAccess = await this.verifyContainerAccess(
                        containerNumber, 
                        req.user.companyId
                    );
                    
                    if (!hasAccess) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    
                    const containerInfo = await this.getContainerInfo(containerNumber);
                    if (!containerInfo) {
                        return res.status(404).json({ error: 'Container not found' });
                    }
                    
                    // Trigger update
                    this.carrierAPI.processContainerUpdate(containerInfo);
                    
                    res.json({ 
                        success: true, 
                        message: 'Update initiated',
                        containerNumber 
                    });
                    
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
        
        // Get real-time container data
        this.app.get('/api/containers/:containerNumber/realtime', 
            this.authenticateJWT,
            async (req, res) => {
                try {
                    const { containerNumber } = req.params;
                    
                    const hasAccess = await this.verifyContainerAccess(
                        containerNumber, 
                        req.user.companyId
                    );
                    
                    if (!hasAccess) {
                        return res.status(403).json({ error: 'Access denied' });
                    }
                    
                    const containerData = await this.getContainerWithEvents(containerNumber);
                    res.json(containerData);
                    
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
        
        // Setup carrier API routes
        this.carrierAPI.setupRoutes(this.app);
    }
    
    async getContainerWithEvents(containerNumber) {
        const containerQuery = 'SELECT * FROM containers WHERE container_number = $1';
        const eventsQuery = `
            SELECT * FROM container_events 
            WHERE container_id = (SELECT id FROM containers WHERE container_number = $1)
            ORDER BY event_timestamp DESC 
            LIMIT 50
        `;
        
        const [containerResult, eventsResult] = await Promise.all([
            this.db.query(containerQuery, [containerNumber]),
            this.db.query(eventsQuery, [containerNumber])
        ]);
        
        return {
            container: containerResult.rows[0],
            events: eventsResult.rows,
            lastUpdate: Date.now()
        };
    }
    
    startRealTimeUpdates() {
        this.logger.info('Starting real-time update system');
        
        // Subscribe to Redis pub/sub for real-time updates
        const subscriber = this.redis.duplicate();
        
        subscriber.psubscribe('company:*:updates', (err, count) => {
            if (err) {
                this.logger.error('Redis subscription error:', err);
            } else {
                this.logger.info(`Subscribed to ${count} Redis channels`);
            }
        });
        
        subscriber.on('pmessage', (pattern, channel, message) => {
            try {
                const updateData = JSON.parse(message);
                this.broadcastUpdate(updateData);
            } catch (error) {
                this.logger.error('Failed to process Redis message:', error);
            }
        });
        
        // Periodic connection cleanup
        setInterval(() => {
            this.cleanupStaleConnections();
        }, 60000); // Every minute
        
        // Broadcast system stats every 30 seconds
        setInterval(() => {
            this.broadcastSystemStats();
        }, 30000);
    }
    
    broadcastUpdate(updateData) {
        const { type, companyId, containerNumber, data } = updateData;
        
        // Broadcast to company room
        this.io.to(`company:${companyId}`).emit('container_update', {
            type,
            containerNumber,
            data,
            timestamp: updateData.timestamp
        });
        
        // Broadcast to specific container subscribers
        this.io.to(`container:${containerNumber}`).emit('container_data', {
            containerNumber,
            data,
            timestamp: updateData.timestamp
        });
        
        this.logger.info('Broadcasted update', {
            type,
            companyId,
            containerNumber,
            timestamp: updateData.timestamp
        });
    }
    
    cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        
        for (const [socketId, connection] of this.activeConnections.entries()) {
            if (now - connection.lastActivity > staleThreshold) {
                this.logger.warn('Removing stale connection', { socketId });
                this.activeConnections.delete(socketId);
            }
        }
        
        this.updateConnectionStats();
    }
    
    broadcastSystemStats() {
        const stats = {
            connections: this.connectionStats.active,
            companies: this.connectionStats.companies.size,
            timestamp: Date.now(),
            serverLoad: process.cpuUsage(),
            memoryUsage: process.memoryUsage()
        };
        
        this.io.emit('system_stats', stats);
    }
    
    setupHealthChecks() {
        // Database health check
        setInterval(async () => {
            try {
                await this.db.query('SELECT 1');
            } catch (error) {
                this.logger.error('Database health check failed:', error);
            }
        }, 30000);
        
        // Redis health check
        setInterval(async () => {
            try {
                await this.redis.ping();
            } catch (error) {
                this.logger.error('Redis health check failed:', error);
            }
        }, 30000);
    }
    
    start() {
        this.serverStartTime = Date.now();
        
        this.server.listen(this.port, () => {
            this.logger.info(`Real-time tracking server running on port ${this.port}`);
            console.log(`🚀 ROOTUIP Real-time Tracking Server`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   WebSocket: Enabled`);
            console.log(`   Carrier APIs: ${this.carrierAPI ? 'Enabled' : 'Disabled'}`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down server...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Start server if called directly
if (require.main === module) {
    const server = new RealTimeTrackingServer();
    server.start();
}

module.exports = RealTimeTrackingServer;