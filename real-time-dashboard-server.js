/**
 * ROOTUIP Real-Time Dashboard Server
 * WebSocket server for live container tracking and AI/ML updates
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const MaerskAPISimulator = require('./mock-data/maersk-api-simulator');
const DDRiskPredictor = require('./ai-ml/dd-risk-predictor');
const DocumentProcessorSimulator = require('./ai-ml/document-processor-simulator');

class RealTimeDashboardServer {
    constructor(port = 3008) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        // Initialize simulators
        this.maerskSimulator = new MaerskAPISimulator();
        this.riskPredictor = new DDRiskPredictor();
        this.documentProcessor = new DocumentProcessorSimulator();
        
        // Active connections
        this.clients = new Set();
        
        // Container tracking data
        this.trackedContainers = new Map();
        
        // Setup middleware
        this.setupMiddleware();
        
        // Setup routes
        this.setupRoutes();
        
        // Setup WebSocket handlers
        this.setupWebSocket();
        
        // Start simulation loops
        this.startSimulations();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                connections: this.clients.size,
                trackedContainers: this.trackedContainers.size
            });
        });
        
        // Add user context middleware
        this.app.use((req, res, next) => {
            // Extract user info from proxy headers
            req.userId = req.headers['x-user-id'];
            req.userRoles = req.headers['x-user-roles']?.split(',') || [];
            next();
        });

        // Track container endpoint
        this.app.post('/api/track', async (req, res) => {
            const { containerNumber } = req.body;
            
            if (!containerNumber) {
                return res.status(400).json({ error: 'Container number required' });
            }

            try {
                // Generate tracking data
                const trackingData = this.maerskSimulator.generateTrackingData(containerNumber);
                
                // Get risk prediction
                const containerData = trackingData.containers[0];
                const riskPrediction = await this.riskPredictor.predictDDRisk(containerData);
                
                // Store in tracked containers
                this.trackedContainers.set(containerNumber, {
                    tracking: containerData,
                    risk: riskPrediction,
                    lastUpdate: new Date().toISOString()
                });
                
                // Send update to all connected clients
                this.broadcast({
                    type: 'container_tracked',
                    data: {
                        containerNumber,
                        tracking: containerData,
                        risk: riskPrediction
                    }
                });
                
                res.json({
                    success: true,
                    containerNumber,
                    tracking: containerData,
                    risk: riskPrediction
                });
                
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Process document endpoint
        this.app.post('/api/process-document', async (req, res) => {
            const { type, fileName } = req.body;
            
            try {
                const result = await this.documentProcessor.processDocument({
                    type: type || 'BILL_OF_LADING',
                    fileName: fileName || 'document.pdf'
                });
                
                // Broadcast processing updates
                this.broadcast({
                    type: 'document_processed',
                    data: result
                });
                
                res.json(result);
                
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get all tracked containers
        this.app.get('/api/containers', (req, res) => {
            const containers = Array.from(this.trackedContainers.entries()).map(([number, data]) => ({
                containerNumber: number,
                ...data
            }));
            
            res.json(containers);
        });

        // Get vessel schedules
        this.app.get('/api/vessel-schedules', (req, res) => {
            const schedules = [];
            
            // Generate schedules for random vessels
            for (let i = 0; i < 5; i++) {
                schedules.push(this.maerskSimulator.generateVesselSchedule());
            }
            
            res.json(schedules);
        });

        // Get statistics
        this.app.get('/api/stats', async (req, res) => {
            const containers = Array.from(this.trackedContainers.values());
            
            const stats = {
                totalContainers: containers.length,
                riskDistribution: {
                    critical: containers.filter(c => c.risk.demurrage.riskLevel === 'CRITICAL' || c.risk.detention.riskLevel === 'CRITICAL').length,
                    high: containers.filter(c => c.risk.demurrage.riskLevel === 'HIGH' || c.risk.detention.riskLevel === 'HIGH').length,
                    medium: containers.filter(c => c.risk.demurrage.riskLevel === 'MEDIUM' || c.risk.detention.riskLevel === 'MEDIUM').length,
                    low: containers.filter(c => c.risk.demurrage.riskLevel === 'LOW' || c.risk.detention.riskLevel === 'LOW').length
                },
                totalEstimatedCharges: containers.reduce((sum, c) => 
                    sum + parseFloat(c.risk.demurrage.estimatedCharges.estimatedTotalCharges) + 
                    parseFloat(c.risk.detention.estimatedCharges.estimatedTotalCharges), 0
                ),
                documentProcessing: this.documentProcessor.getProcessingStats(),
                predictions: {
                    total: containers.length,
                    avgConfidence: containers.length > 0 ? 
                        containers.reduce((sum, c) => sum + c.risk.demurrage.confidence, 0) / containers.length : 0,
                    preventionRate: 0.942 // Our target 94.2%
                }
            };
            
            res.json(stats);
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            // Extract user info from headers (set by auth proxy)
            const userId = req.headers['x-user-id'];
            const userRoles = req.headers['x-user-roles']?.split(',') || [];
            
            console.log('New WebSocket connection from user:', userId);
            
            // Add to clients set with user info
            ws.userId = userId;
            ws.userRoles = userRoles;
            this.clients.add(ws);
            
            // Send initial data based on user role
            const isExecutive = userRoles.includes('C_SUITE');
            ws.send(JSON.stringify({
                type: 'connected',
                data: {
                    message: 'Connected to ROOTUIP Real-Time Dashboard',
                    timestamp: new Date().toISOString(),
                    trackedContainers: this.trackedContainers.size,
                    userRole: isExecutive ? 'executive' : 'operations'
                }
            }));

            // Send current tracked containers
            if (this.trackedContainers.size > 0) {
                ws.send(JSON.stringify({
                    type: 'initial_containers',
                    data: Array.from(this.trackedContainers.entries()).map(([number, data]) => ({
                        containerNumber: number,
                        ...data
                    }))
                }));
            }

            // Handle messages from client
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleClientMessage(ws, data);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: { message: error.message }
                    }));
                }
            });

            // Handle disconnect
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log('Client disconnected');
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
    }

    async handleClientMessage(ws, message) {
        switch (message.type) {
            case 'track_container':
                const trackingData = this.maerskSimulator.generateTrackingData(message.containerNumber);
                const containerData = trackingData.containers[0];
                const riskPrediction = await this.riskPredictor.predictDDRisk(containerData);
                
                this.trackedContainers.set(message.containerNumber, {
                    tracking: containerData,
                    risk: riskPrediction,
                    lastUpdate: new Date().toISOString()
                });
                
                // Send to requesting client
                ws.send(JSON.stringify({
                    type: 'container_tracked',
                    data: {
                        containerNumber: message.containerNumber,
                        tracking: containerData,
                        risk: riskPrediction
                    }
                }));
                
                // Broadcast to others
                this.broadcastExcept(ws, {
                    type: 'container_added',
                    data: {
                        containerNumber: message.containerNumber,
                        tracking: containerData,
                        risk: riskPrediction
                    }
                });
                break;

            case 'untrack_container':
                this.trackedContainers.delete(message.containerNumber);
                this.broadcast({
                    type: 'container_removed',
                    data: { containerNumber: message.containerNumber }
                });
                break;

            case 'request_update':
                if (this.trackedContainers.has(message.containerNumber)) {
                    const data = this.trackedContainers.get(message.containerNumber);
                    ws.send(JSON.stringify({
                        type: 'container_update',
                        data: {
                            containerNumber: message.containerNumber,
                            ...data
                        }
                    }));
                }
                break;

            case 'process_document':
                const result = await this.documentProcessor.processDocument(message.document);
                ws.send(JSON.stringify({
                    type: 'document_result',
                    data: result
                }));
                break;

            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: 'Unknown message type' }
                }));
        }
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    broadcastExcept(excludeWs, message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    startSimulations() {
        // Update container statuses every 30 seconds
        setInterval(() => {
            this.updateContainerStatuses();
        }, 30000);

        // Generate alerts every minute
        setInterval(() => {
            this.generateAlerts();
        }, 60000);

        // Update risk predictions every 2 minutes
        setInterval(() => {
            this.updateRiskPredictions();
        }, 120000);

        // Simulate new events every 45 seconds
        setInterval(() => {
            this.simulateNewEvents();
        }, 45000);
    }

    async updateContainerStatuses() {
        for (const [containerNumber, data] of this.trackedContainers.entries()) {
            // Simulate status changes
            const events = data.tracking.events;
            const lastEvent = events[events.length - 1];
            
            // Check if we should add a new event
            if (Math.random() > 0.7 && events.length < 8) {
                const nextEventType = this.getNextEventType(lastEvent.activityName);
                if (nextEventType) {
                    const newEvent = this.generateNewEvent(nextEventType, lastEvent);
                    events.push(newEvent);
                    
                    // Update risk prediction
                    const newRisk = await this.riskPredictor.predictDDRisk(data.tracking);
                    
                    data.risk = newRisk;
                    data.lastUpdate = new Date().toISOString();
                    
                    // Broadcast update
                    this.broadcast({
                        type: 'container_status_update',
                        data: {
                            containerNumber,
                            newEvent,
                            risk: newRisk
                        }
                    });
                }
            }
        }
    }

    getNextEventType(currentStatus) {
        const statusFlow = {
            'Gate In': 'Loaded on Vessel',
            'Loaded on Vessel': 'Vessel Departed',
            'Vessel Departed': 'Vessel Arrived',
            'Vessel Arrived': 'Discharged from Vessel',
            'Discharged from Vessel': Math.random() > 0.3 ? 'Gate Out' : 'Customs Hold',
            'Customs Hold': 'Gate Out',
            'Gate Out': 'Empty Return'
        };
        
        return statusFlow[currentStatus];
    }

    generateNewEvent(eventType, previousEvent) {
        const location = previousEvent.location;
        const baseTime = new Date(previousEvent.eventDateTime);
        
        // Add appropriate time based on event type
        const timeOffsets = {
            'Loaded on Vessel': 24 * 60 * 60 * 1000, // 1 day
            'Vessel Departed': 4 * 60 * 60 * 1000,   // 4 hours
            'Vessel Arrived': 10 * 24 * 60 * 60 * 1000, // 10 days
            'Discharged from Vessel': 1 * 24 * 60 * 60 * 1000, // 1 day
            'Customs Hold': 2 * 24 * 60 * 60 * 1000, // 2 days
            'Gate Out': 3 * 24 * 60 * 60 * 1000,     // 3 days
            'Empty Return': 5 * 24 * 60 * 60 * 1000  // 5 days
        };
        
        const newTime = new Date(baseTime.getTime() + (timeOffsets[eventType] || 24 * 60 * 60 * 1000));
        
        return {
            eventId: require('crypto').randomUUID(),
            eventDateTime: newTime.toISOString(),
            eventClassifierCode: 'ACT',
            activityName: eventType,
            statusCode: this.getStatusCode(eventType),
            description: this.getEventDescription(eventType),
            location: location,
            vessel: previousEvent.vessel,
            voyage: previousEvent.voyage
        };
    }

    getStatusCode(eventType) {
        const codes = {
            'Gate In': 'CGI',
            'Loaded on Vessel': 'LOV',
            'Vessel Departed': 'VDL',
            'Vessel Arrived': 'VAD',
            'Discharged from Vessel': 'DFV',
            'Customs Hold': 'CSH',
            'Gate Out': 'CGO',
            'Empty Return': 'ERT'
        };
        return codes[eventType] || 'UNK';
    }

    getEventDescription(eventType) {
        const descriptions = {
            'Gate In': 'Container received at terminal',
            'Loaded on Vessel': 'Container loaded onto vessel',
            'Vessel Departed': 'Vessel departed from port',
            'Vessel Arrived': 'Vessel arrived at destination port',
            'Discharged from Vessel': 'Container unloaded from vessel',
            'Customs Hold': 'Container held for customs inspection',
            'Gate Out': 'Container released from terminal',
            'Empty Return': 'Empty container returned to depot'
        };
        return descriptions[eventType] || eventType;
    }

    async generateAlerts() {
        const alerts = [];
        
        for (const [containerNumber, data] of this.trackedContainers.entries()) {
            // Check for high risk containers
            if (data.risk.demurrage.riskLevel === 'CRITICAL' || data.risk.detention.riskLevel === 'CRITICAL') {
                alerts.push({
                    id: require('crypto').randomUUID(),
                    type: 'CRITICAL',
                    containerNumber,
                    message: `Critical D&D risk for container ${containerNumber}`,
                    demurrageRisk: data.risk.demurrage.riskScore,
                    detentionRisk: data.risk.detention.riskScore,
                    estimatedCharges: parseFloat(data.risk.demurrage.estimatedCharges.estimatedTotalCharges) + 
                                     parseFloat(data.risk.detention.estimatedCharges.estimatedTotalCharges),
                    timestamp: new Date().toISOString()
                });
            }
            
            // Check for containers approaching free time expiry
            const lastEvent = data.tracking.events[data.tracking.events.length - 1];
            if (lastEvent.activityName === 'Discharged from Vessel') {
                const dischargeDate = new Date(lastEvent.eventDateTime);
                const daysSinceDischarge = (new Date() - dischargeDate) / (24 * 60 * 60 * 1000);
                
                if (daysSinceDischarge >= 3 && daysSinceDischarge < 5) {
                    alerts.push({
                        id: require('crypto').randomUUID(),
                        type: 'WARNING',
                        containerNumber,
                        message: `Container ${containerNumber} approaching demurrage (${Math.floor(5 - daysSinceDischarge)} days remaining)`,
                        daysUntilDemurrage: Math.floor(5 - daysSinceDischarge),
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        if (alerts.length > 0) {
            this.broadcast({
                type: 'alerts',
                data: alerts
            });
        }
    }

    async updateRiskPredictions() {
        for (const [containerNumber, data] of this.trackedContainers.entries()) {
            const newRisk = await this.riskPredictor.predictDDRisk(data.tracking);
            
            // Check if risk has changed significantly
            const oldDemurrageRisk = data.risk.demurrage.riskScore;
            const newDemurrageRisk = newRisk.demurrage.riskScore;
            
            if (Math.abs(oldDemurrageRisk - newDemurrageRisk) > 0.1) {
                data.risk = newRisk;
                data.lastUpdate = new Date().toISOString();
                
                this.broadcast({
                    type: 'risk_update',
                    data: {
                        containerNumber,
                        oldRisk: {
                            demurrage: oldDemurrageRisk,
                            detention: data.risk.detention.riskScore
                        },
                        newRisk: {
                            demurrage: newDemurrageRisk,
                            detention: newRisk.detention.riskScore
                        },
                        risk: newRisk
                    }
                });
            }
        }
    }

    simulateNewEvents() {
        // Randomly add new containers
        if (Math.random() > 0.5 && this.trackedContainers.size < 20) {
            const containerNumber = this.maerskSimulator.generateContainerNumber();
            const trackingData = this.maerskSimulator.generateTrackingData(containerNumber);
            const containerData = trackingData.containers[0];
            
            this.riskPredictor.predictDDRisk(containerData).then(risk => {
                this.trackedContainers.set(containerNumber, {
                    tracking: containerData,
                    risk: risk,
                    lastUpdate: new Date().toISOString()
                });
                
                this.broadcast({
                    type: 'new_container',
                    data: {
                        containerNumber,
                        tracking: containerData,
                        risk: risk
                    }
                });
            });
        }
        
        // Simulate document processing
        if (Math.random() > 0.7) {
            const docTypes = ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'ARRIVAL_NOTICE', 'DELIVERY_ORDER'];
            const docType = docTypes[Math.floor(Math.random() * docTypes.length)];
            
            this.documentProcessor.processDocument({
                type: docType,
                fileName: `${docType.toLowerCase()}_${Date.now()}.pdf`
            }).then(result => {
                this.broadcast({
                    type: 'document_processed',
                    data: result
                });
            });
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`Real-Time Dashboard Server running on port ${this.port}`);
            console.log(`WebSocket endpoint: ws://localhost:${this.port}`);
            console.log(`HTTP API: http://localhost:${this.port}/api`);
        });
    }
}

// Start the server
const server = new RealTimeDashboardServer(3008);
server.start();

module.exports = RealTimeDashboardServer;