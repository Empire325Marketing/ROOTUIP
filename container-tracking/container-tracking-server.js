// ROOTUIP Container Tracking Server
// Main server integrating all container tracking components

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Import tracking components
const ContainerTracker = require('./tracking/container-tracker');
const DDRiskAnalyzer = require('./analytics/dd-risk-analyzer');
const WebhookHandler = require('./data-processing/webhook-handler');

class ContainerTrackingServer {
    constructor(config) {
        this.config = config || {};
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Initialize tracking components
        this.containerTracker = new ContainerTracker({
            ...this.config,
            websocket: this.io
        });
        
        this.riskAnalyzer = new DDRiskAnalyzer(this.config.riskAnalysis);
        
        this.webhookHandler = new WebhookHandler({
            ...this.config.webhooks,
            websocket: this.io
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // CORS
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
            credentials: true
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files
        this.app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                components: {
                    containerTracker: 'operational',
                    riskAnalyzer: 'operational',
                    webhookHandler: 'operational'
                }
            });
        });

        // Dashboard redirect
        this.app.get('/', (req, res) => {
            res.redirect('/dashboard/tracking-dashboard.html');
        });

        // Container tracking endpoints
        this.setupTrackingRoutes();

        // Risk analysis endpoints
        this.setupRiskAnalysisRoutes();

        // Analytics endpoints
        this.setupAnalyticsRoutes();

        // Webhook endpoints
        this.setupWebhookRoutes();
    }

    setupTrackingRoutes() {
        const router = express.Router();

        // Track a single container
        router.post('/track', async (req, res) => {
            try {
                const { containerNumber, preferredCarrier, realTimeUpdates = true, generatePredictions = true } = req.body;

                if (!containerNumber) {
                    return res.status(400).json({
                        error: 'Container number is required',
                        message: 'Please provide a valid container number'
                    });
                }

                const result = await this.containerTracker.trackContainer(containerNumber, {
                    preferredCarrier,
                    realTimeUpdates,
                    generatePredictions
                });

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('Track container error:', error);
                res.status(500).json({
                    error: 'Tracking failed',
                    message: error.message
                });
            }
        });

        // Get tracking status
        router.get('/status/:containerNumber', async (req, res) => {
            try {
                const { containerNumber } = req.params;
                const result = await this.containerTracker.getTrackingStatus(containerNumber);

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('Get tracking status error:', error);
                
                if (error.message.includes('not being tracked')) {
                    res.status(404).json({
                        error: 'Container not found',
                        message: error.message
                    });
                } else {
                    res.status(500).json({
                        error: 'Failed to get tracking status',
                        message: error.message
                    });
                }
            }
        });

        // Refresh tracking data
        router.post('/refresh/:containerNumber', async (req, res) => {
            try {
                const { containerNumber } = req.params;
                const { forceRefresh = false } = req.body;

                const result = await this.containerTracker.refreshTrackingData(containerNumber, forceRefresh);

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('Refresh tracking error:', error);
                res.status(500).json({
                    error: 'Refresh failed',
                    message: error.message
                });
            }
        });

        // Stop tracking
        router.delete('/track/:containerNumber', async (req, res) => {
            try {
                const { containerNumber } = req.params;
                const result = await this.containerTracker.stopTracking(containerNumber);

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('Stop tracking error:', error);
                res.status(500).json({
                    error: 'Failed to stop tracking',
                    message: error.message
                });
            }
        });

        // Batch tracking
        router.post('/track/batch', async (req, res) => {
            try {
                const { containerNumbers, options = {} } = req.body;

                if (!Array.isArray(containerNumbers) || containerNumbers.length === 0) {
                    return res.status(400).json({
                        error: 'Container numbers required',
                        message: 'Please provide an array of container numbers'
                    });
                }

                const result = await this.containerTracker.trackMultipleContainers(containerNumbers, options);

                res.json({
                    success: true,
                    data: result
                });

            } catch (error) {
                console.error('Batch tracking error:', error);
                res.status(500).json({
                    error: 'Batch tracking failed',
                    message: error.message
                });
            }
        });

        // Get tracking statistics
        router.get('/statistics', (req, res) => {
            try {
                const stats = this.containerTracker.getStatistics();
                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                console.error('Get statistics error:', error);
                res.status(500).json({
                    error: 'Failed to get statistics',
                    message: error.message
                });
            }
        });

        this.app.use('/api/tracking', router);
    }

    setupRiskAnalysisRoutes() {
        const router = express.Router();

        // Analyze D&D risk for a container
        router.post('/analyze', async (req, res) => {
            try {
                const { containerData, options = {} } = req.body;

                if (!containerData || !containerData.containerNumber) {
                    return res.status(400).json({
                        error: 'Container data required',
                        message: 'Please provide valid container data with container number'
                    });
                }

                const analysis = await this.riskAnalyzer.analyzeRisk(containerData, options);

                res.json({
                    success: true,
                    data: analysis
                });

            } catch (error) {
                console.error('Risk analysis error:', error);
                res.status(500).json({
                    error: 'Risk analysis failed',
                    message: error.message
                });
            }
        });

        // Batch risk analysis
        router.post('/analyze/batch', async (req, res) => {
            try {
                const { containers, options = {} } = req.body;

                if (!Array.isArray(containers) || containers.length === 0) {
                    return res.status(400).json({
                        error: 'Containers required',
                        message: 'Please provide an array of container data'
                    });
                }

                const results = await this.riskAnalyzer.analyzeBatchRisk(containers, options);

                res.json({
                    success: true,
                    data: results
                });

            } catch (error) {
                console.error('Batch risk analysis error:', error);
                res.status(500).json({
                    error: 'Batch risk analysis failed',
                    message: error.message
                });
            }
        });

        // Get risk analysis statistics
        router.get('/statistics', (req, res) => {
            try {
                const stats = this.riskAnalyzer.getStatistics();
                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                console.error('Get risk statistics error:', error);
                res.status(500).json({
                    error: 'Failed to get risk statistics',
                    message: error.message
                });
            }
        });

        this.app.use('/api/risk', router);
    }

    setupAnalyticsRoutes() {
        const router = express.Router();

        // Get overall analytics
        router.get('/overview', async (req, res) => {
            try {
                const { timeframe = '30d' } = req.query;
                
                // Mock analytics data - would come from database
                const analytics = {
                    totalContainers: 1247,
                    activeShipments: 892,
                    onTimePerformance: 87.3,
                    avgDelayDays: 1.4,
                    riskDistribution: {
                        LOW: 45,
                        MEDIUM: 30,
                        HIGH: 20,
                        CRITICAL: 5
                    },
                    carrierPerformance: [
                        { carrier: 'MAEU', onTime: 89.2, volume: 342 },
                        { carrier: 'MSCU', onTime: 85.7, volume: 289 },
                        { carrier: 'CMDU', onTime: 84.1, volume: 267 },
                        { carrier: 'HLCU', onTime: 87.6, volume: 349 }
                    ],
                    timeframe: timeframe,
                    lastUpdated: new Date().toISOString()
                };

                res.json({
                    success: true,
                    data: analytics
                });

            } catch (error) {
                console.error('Analytics overview error:', error);
                res.status(500).json({
                    error: 'Failed to get analytics',
                    message: error.message
                });
            }
        });

        // Get carrier performance metrics
        router.get('/carriers', async (req, res) => {
            try {
                const { timeframe = '30d' } = req.query;

                // Mock carrier performance data
                const carrierMetrics = {
                    MAEU: {
                        name: 'Maersk',
                        totalContainers: 342,
                        onTimePerformance: 89.2,
                        avgDelay: 1.1,
                        ddIncidentRate: 12.3,
                        customerSatisfaction: 4.2
                    },
                    MSCU: {
                        name: 'MSC',
                        totalContainers: 289,
                        onTimePerformance: 85.7,
                        avgDelay: 1.6,
                        ddIncidentRate: 15.8,
                        customerSatisfaction: 3.9
                    },
                    CMDU: {
                        name: 'CMA CGM',
                        totalContainers: 267,
                        onTimePerformance: 84.1,
                        avgDelay: 1.8,
                        ddIncidentRate: 17.2,
                        customerSatisfaction: 3.8
                    },
                    HLCU: {
                        name: 'Hapag-Lloyd',
                        totalContainers: 349,
                        onTimePerformance: 87.6,
                        avgDelay: 1.3,
                        ddIncidentRate: 13.7,
                        customerSatisfaction: 4.0
                    }
                };

                res.json({
                    success: true,
                    data: {
                        carriers: carrierMetrics,
                        timeframe: timeframe,
                        lastUpdated: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Carrier analytics error:', error);
                res.status(500).json({
                    error: 'Failed to get carrier analytics',
                    message: error.message
                });
            }
        });

        // Get port performance metrics
        router.get('/ports', async (req, res) => {
            try {
                const { timeframe = '30d' } = req.query;

                // Mock port performance data
                const portMetrics = [
                    {
                        code: 'USLAX',
                        name: 'Los Angeles',
                        country: 'US',
                        totalContainers: 423,
                        avgDwellTime: 6.8,
                        congestionLevel: 'HIGH',
                        efficiency: 65,
                        ddRate: 28.3
                    },
                    {
                        code: 'NLRTM',
                        name: 'Rotterdam',
                        country: 'NL',
                        totalContainers: 387,
                        avgDwellTime: 2.5,
                        congestionLevel: 'LOW',
                        efficiency: 92,
                        ddRate: 8.1
                    },
                    {
                        code: 'SGSIN',
                        name: 'Singapore',
                        country: 'SG',
                        totalContainers: 356,
                        avgDwellTime: 1.8,
                        congestionLevel: 'LOW',
                        efficiency: 95,
                        ddRate: 5.2
                    },
                    {
                        code: 'CNSHA',
                        name: 'Shanghai',
                        country: 'CN',
                        totalContainers: 298,
                        avgDwellTime: 3.2,
                        congestionLevel: 'MEDIUM',
                        efficiency: 82,
                        ddRate: 12.4
                    }
                ];

                res.json({
                    success: true,
                    data: {
                        ports: portMetrics,
                        timeframe: timeframe,
                        lastUpdated: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Port analytics error:', error);
                res.status(500).json({
                    error: 'Failed to get port analytics',
                    message: error.message
                });
            }
        });

        this.app.use('/api/analytics', router);
    }

    setupWebhookRoutes() {
        // Webhook endpoints are handled by WebhookHandler
        // Just add a status endpoint here
        this.app.get('/api/webhooks/status', (req, res) => {
            try {
                const stats = this.webhookHandler.getStatistics();
                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                console.error('Webhook status error:', error);
                res.status(500).json({
                    error: 'Failed to get webhook status',
                    message: error.message
                });
            }
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);

            // Send initial data
            socket.emit('connection_established', {
                message: 'Connected to ROOTUIP Container Tracking',
                timestamp: new Date().toISOString()
            });

            // Handle client requests
            socket.on('subscribe_container', (containerNumber) => {
                socket.join(`container_${containerNumber}`);
                console.log(`Client ${socket.id} subscribed to container ${containerNumber}`);
            });

            socket.on('unsubscribe_container', (containerNumber) => {
                socket.leave(`container_${containerNumber}`);
                console.log(`Client ${socket.id} unsubscribed from container ${containerNumber}`);
            });

            socket.on('get_tracking_status', async (containerNumber, callback) => {
                try {
                    const status = await this.containerTracker.getTrackingStatus(containerNumber);
                    callback({ success: true, data: status });
                } catch (error) {
                    callback({ success: false, error: error.message });
                }
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });

        // Set up container tracker event listeners
        this.containerTracker.on('tracking_started', (data) => {
            this.io.emit('tracking_started', data);
        });

        this.containerTracker.on('tracking_updated', (data) => {
            this.io.to(`container_${data.containerNumber}`).emit('container_update', data);
        });

        this.containerTracker.on('real_time_update', (data) => {
            this.io.to(`container_${data.containerNumber}`).emit('real_time_update', data);
        });

        this.containerTracker.on('alert_triggered', (data) => {
            this.io.emit('alert', data);
        });

        this.containerTracker.on('tracking_stopped', (data) => {
            this.io.emit('tracking_stopped', data);
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: 'The requested endpoint does not exist'
            });
        });

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);

            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            this.shutdown();
        });

        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down gracefully');
            this.shutdown();
        });
    }

    async shutdown() {
        console.log('[ContainerTrackingServer] Shutting down...');

        // Close WebSocket connections
        this.io.close();

        // Shutdown tracking components
        await this.containerTracker.shutdown();

        // Close server
        this.server.close(() => {
            console.log('[ContainerTrackingServer] Server closed');
            process.exit(0);
        });
    }

    start(port = process.env.PORT || 3031) {
        this.server.listen(port, () => {
            console.log(`
🚀 ROOTUIP Container Tracking System
📡 Server running on port ${port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}

🔗 URLs:
📊 Dashboard: http://localhost:${port}/dashboard/tracking-dashboard.html
📋 API Health: http://localhost:${port}/api/health
🔄 WebSocket: ws://localhost:${port}

📡 API Endpoints:
🚛 Container Tracking:
   POST /api/tracking/track              - Track container
   GET  /api/tracking/status/:container  - Get tracking status
   POST /api/tracking/refresh/:container - Refresh data
   POST /api/tracking/track/batch        - Batch tracking

⚠️  Risk Analysis:
   POST /api/risk/analyze               - Analyze D&D risk
   POST /api/risk/analyze/batch         - Batch risk analysis

📊 Analytics:
   GET  /api/analytics/overview         - Overall metrics
   GET  /api/analytics/carriers         - Carrier performance
   GET  /api/analytics/ports            - Port performance

🔌 Webhooks:
   POST /webhooks/maersk               - Maersk updates
   POST /webhooks/msc                  - MSC updates
   POST /webhooks/cmacgm               - CMA CGM updates
   POST /webhooks/hapag-lloyd          - Hapag-Lloyd updates

🔐 Features:
✅ Real-time container tracking
✅ Multi-carrier integration (Maersk, MSC, CMA CGM, Hapag-Lloyd)
✅ D&D risk scoring and predictions
✅ Interactive world map dashboard
✅ Live webhook processing
✅ WebSocket real-time updates
✅ Comprehensive analytics
✅ Duplicate detection
✅ Data normalization
✅ Predictive ETA calculations
✅ Alert system

🚢 Carriers Supported:
• Maersk (MAEU) - Track & Trace API
• MSC (MSCU) - Container tracking API
• CMA CGM (CMDU) - Vessel schedules API
• Hapag-Lloyd (HLCU) - EDI processing

💡 Demo Mode: Ready with simulated data for sales demonstrations
            `);
        });
    }
}

// Create and start server if this file is run directly
if (require.main === module) {
    const config = {
        carriers: {
            maersk: {
                enabled: process.env.MAERSK_ENABLED === 'true',
                clientId: process.env.MAERSK_CLIENT_ID,
                clientSecret: process.env.MAERSK_CLIENT_SECRET,
                rateLimit: 100
            },
            msc: {
                enabled: process.env.MSC_ENABLED === 'true',
                username: process.env.MSC_USERNAME,
                password: process.env.MSC_PASSWORD,
                rateLimit: 80
            },
            cmacgm: {
                enabled: process.env.CMACGM_ENABLED === 'true',
                apiKey: process.env.CMACGM_API_KEY,
                apiSecret: process.env.CMACGM_API_SECRET,
                rateLimit: 60
            },
            hapagLloyd: {
                enabled: process.env.HAPAG_LLOYD_ENABLED === 'true',
                clientId: process.env.HAPAG_LLOYD_CLIENT_ID,
                clientSecret: process.env.HAPAG_LLOYD_CLIENT_SECRET,
                ediEnabled: process.env.HAPAG_LLOYD_EDI_ENABLED === 'true',
                rateLimit: 50
            }
        },
        webhooks: {
            maersk: {
                webhookSecret: process.env.MAERSK_WEBHOOK_SECRET
            },
            msc: {
                webhookSecret: process.env.MSC_WEBHOOK_SECRET
            },
            cmacgm: {
                webhookSecret: process.env.CMACGM_WEBHOOK_SECRET
            },
            hapagLloyd: {
                webhookSecret: process.env.HAPAG_LLOYD_WEBHOOK_SECRET
            }
        },
        webhookPort: 3030,
        webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3030',
        updateInterval: 1800000, // 30 minutes
        refreshInterval: 1800000, // 30 minutes
        healthCheckInterval: 300000 // 5 minutes
    };

    const server = new ContainerTrackingServer(config);
    server.start();
}

module.exports = ContainerTrackingServer;