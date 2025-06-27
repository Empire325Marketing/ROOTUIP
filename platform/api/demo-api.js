// ROOTUIP Demo Data API
const express = require('express');
const router = express.Router();
const DemoDataGenerator = require('./demo-data-generator');

// Initialize demo data generator
const generator = new DemoDataGenerator();
let demoData = null;

// Generate initial demo data
function initializeDemoData() {
    console.log('Generating demo data...');
    demoData = generator.generateDemoData();
    console.log(`Generated ${demoData.shipments.length} shipments for ${demoData.companies.length} companies`);
}

// Initialize on startup
initializeDemoData();

// Refresh demo data every hour
setInterval(initializeDemoData, 60 * 60 * 1000);

// API Routes

// Get all demo data
router.get('/all', (req, res) => {
    res.json({
        success: true,
        data: demoData,
        generated: new Date()
    });
});

// Get companies
router.get('/companies', (req, res) => {
    res.json({
        success: true,
        companies: demoData.companies
    });
});

// Get vessels
router.get('/vessels', (req, res) => {
    const { status, carrier, minTEU } = req.query;
    let vessels = demoData.vessels;
    
    if (status) {
        vessels = vessels.filter(v => v.status === status);
    }
    if (carrier) {
        vessels = vessels.filter(v => v.carrier === carrier);
    }
    if (minTEU) {
        vessels = vessels.filter(v => v.teu >= parseInt(minTEU));
    }
    
    res.json({
        success: true,
        vessels: vessels,
        total: vessels.length
    });
});

// Get vessel by ID
router.get('/vessels/:vesselId', (req, res) => {
    const vessel = demoData.vessels.find(v => v.id === req.params.vesselId);
    
    if (!vessel) {
        return res.status(404).json({ error: 'Vessel not found' });
    }
    
    res.json({
        success: true,
        vessel: vessel
    });
});

// Get ports
router.get('/ports', (req, res) => {
    res.json({
        success: true,
        ports: demoData.ports
    });
});

// Get port congestion
router.get('/ports/:portId/congestion', (req, res) => {
    const port = demoData.ports.find(p => p.id === req.params.portId);
    
    if (!port) {
        return res.status(404).json({ error: 'Port not found' });
    }
    
    // Simulate real-time congestion data
    const congestionData = {
        portId: port.id,
        portName: port.name,
        currentLevel: port.congestionLevel + (Math.random() - 0.5) * 0.1, // Add some variance
        vesselsInPort: Math.floor(Math.random() * 30) + 10,
        vesselsWaiting: Math.floor(Math.random() * 15),
        avgWaitTime: Math.floor(port.congestionLevel * 48), // hours
        berthUtilization: port.congestionLevel * 100, // percentage
        forecast: {
            next24h: port.congestionLevel + (Math.random() - 0.5) * 0.05,
            next48h: port.congestionLevel + (Math.random() - 0.5) * 0.1,
            next72h: port.congestionLevel + (Math.random() - 0.5) * 0.15
        },
        lastUpdated: new Date()
    };
    
    res.json({
        success: true,
        congestion: congestionData
    });
});

// Get shipments
router.get('/shipments', (req, res) => {
    const { companyId, status, carrierId, page = 1, limit = 20 } = req.query;
    let shipments = demoData.shipments;
    
    if (companyId) {
        shipments = shipments.filter(s => s.companyId === companyId);
    }
    if (status) {
        shipments = shipments.filter(s => s.status === status);
    }
    if (carrierId) {
        shipments = shipments.filter(s => s.carrier.id === carrierId);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedShipments = shipments.slice(startIndex, endIndex);
    
    res.json({
        success: true,
        shipments: paginatedShipments,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: shipments.length,
            pages: Math.ceil(shipments.length / limit)
        }
    });
});

// Get shipment by ID
router.get('/shipments/:shipmentId', (req, res) => {
    const shipment = demoData.shipments.find(s => s.id === req.params.shipmentId);
    
    if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
    }
    
    res.json({
        success: true,
        shipment: shipment
    });
});

// Track container
router.get('/containers/:containerNumber/track', (req, res) => {
    // Find container across all shipments
    let foundContainer = null;
    let foundShipment = null;
    
    for (const shipment of demoData.shipments) {
        const container = shipment.containers.find(c => c.number === req.params.containerNumber);
        if (container) {
            foundContainer = container;
            foundShipment = shipment;
            break;
        }
    }
    
    if (!foundContainer) {
        return res.status(404).json({ error: 'Container not found' });
    }
    
    // Generate tracking data
    const tracking = {
        container: foundContainer,
        shipment: {
            id: foundShipment.id,
            blNumber: foundShipment.blNumber,
            origin: foundShipment.origin.name,
            destination: foundShipment.destination.name,
            vessel: foundShipment.vessel.name,
            carrier: foundShipment.carrier.name,
            status: foundShipment.status
        },
        currentLocation: foundShipment.status === 'In Transit' 
            ? foundShipment.vessel.position 
            : foundShipment.status === 'Delivered' 
                ? foundShipment.destination 
                : foundShipment.origin,
        milestones: foundShipment.milestones,
        estimatedDelivery: foundShipment.arrivalDate,
        lastUpdate: new Date()
    };
    
    res.json({
        success: true,
        tracking: tracking
    });
});

// Get notifications
router.get('/notifications', (req, res) => {
    const { unreadOnly, limit = 10 } = req.query;
    let notifications = demoData.notifications;
    
    if (unreadOnly === 'true') {
        notifications = notifications.filter(n => !n.read);
    }
    
    res.json({
        success: true,
        notifications: notifications.slice(0, parseInt(limit)),
        unreadCount: notifications.filter(n => !n.read).length
    });
});

// Mark notification as read
router.put('/notifications/:notificationId/read', (req, res) => {
    const notification = demoData.notifications.find(n => n.id === req.params.notificationId);
    
    if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
    }
    
    notification.read = true;
    
    res.json({
        success: true,
        notification: notification
    });
});

// Get analytics
router.get('/analytics', (req, res) => {
    res.json({
        success: true,
        analytics: demoData.analytics
    });
});

// Simulate real-time vessel position updates
router.get('/vessels/:vesselId/position', (req, res) => {
    const vessel = demoData.vessels.find(v => v.id === req.params.vesselId);
    
    if (!vessel) {
        return res.status(404).json({ error: 'Vessel not found' });
    }
    
    // Update vessel position slightly
    vessel.position.lat += (Math.random() - 0.5) * 0.1;
    vessel.position.lon += (Math.random() - 0.5) * 0.1;
    vessel.position.timestamp = new Date();
    vessel.currentSpeed = 15 + Math.random() * 10;
    
    res.json({
        success: true,
        position: vessel.position,
        speed: vessel.currentSpeed,
        course: vessel.course || Math.floor(Math.random() * 360),
        status: vessel.status
    });
});

// Simulate document upload
router.post('/documents/upload', (req, res) => {
    const { shipmentId, documentType, fileName } = req.body;
    
    const document = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        shipmentId: shipmentId,
        type: documentType,
        fileName: fileName,
        uploadDate: new Date(),
        status: 'Processing',
        ocrConfidence: null
    };
    
    // Simulate OCR processing
    setTimeout(() => {
        document.status = 'Processed';
        document.ocrConfidence = 0.95 + Math.random() * 0.04; // 95-99%
    }, 2000);
    
    res.json({
        success: true,
        document: document,
        message: 'Document uploaded successfully. Processing will complete in a few seconds.'
    });
});

// Get D&D risk assessment
router.get('/shipments/:shipmentId/risk', (req, res) => {
    const shipment = demoData.shipments.find(s => s.id === req.params.shipmentId);
    
    if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
    }
    
    // Enhanced risk assessment
    const riskAssessment = {
        shipmentId: shipment.id,
        currentRisk: shipment.ddRisk,
        prediction: {
            next24h: Math.min(shipment.ddRisk.score + 0.1, 1),
            next48h: Math.min(shipment.ddRisk.score + 0.15, 1),
            next72h: Math.min(shipment.ddRisk.score + 0.2, 1)
        },
        factors: {
            portCongestion: {
                origin: shipment.origin.congestionLevel,
                destination: shipment.destination.congestionLevel
            },
            vesselPerformance: {
                onTimeRate: 0.85 + Math.random() * 0.14,
                avgDelay: Math.floor(Math.random() * 12) // hours
            },
            weatherImpact: {
                current: 'Moderate',
                forecast: 'Improving'
            },
            documentation: {
                status: 'Complete',
                customsClearance: shipment.status === 'Delivered' ? 'Cleared' : 'Pending'
            }
        },
        recommendations: [
            'Consider early container pickup to avoid storage charges',
            'Ensure all documentation is submitted 48 hours before arrival',
            'Monitor port congestion levels for potential delays'
        ],
        estimatedCharges: shipment.containers.length * 150 * shipment.ddRisk.score,
        lastUpdated: new Date()
    };
    
    res.json({
        success: true,
        riskAssessment: riskAssessment
    });
});

// Create new demo shipment
router.post('/shipments/create-demo', (req, res) => {
    const { companyId = 'ACME001' } = req.body;
    
    const newShipment = generator.generateShipment(companyId);
    demoData.shipments.unshift(newShipment);
    
    // Create notification
    const notification = {
        id: `notif-${Date.now()}`,
        type: 'booking_confirmed',
        severity: 'info',
        shipmentId: newShipment.id,
        title: 'New Booking Confirmed',
        message: `Booking ${newShipment.blNumber} has been confirmed for ${newShipment.vessel.name}`,
        timestamp: new Date(),
        read: false
    };
    demoData.notifications.unshift(notification);
    
    res.json({
        success: true,
        shipment: newShipment,
        message: 'Demo shipment created successfully'
    });
});

// WebSocket endpoint for real-time updates
router.ws('/realtime', (ws, req) => {
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to demo data stream'
    }));
    
    // Send updates every 5 seconds
    const interval = setInterval(() => {
        // Random vessel position update
        const vessel = demoData.vessels[Math.floor(Math.random() * demoData.vessels.length)];
        vessel.position.lat += (Math.random() - 0.5) * 0.05;
        vessel.position.lon += (Math.random() - 0.5) * 0.05;
        vessel.position.timestamp = new Date();
        
        ws.send(JSON.stringify({
            type: 'vessel:position',
            data: {
                vesselId: vessel.id,
                position: vessel.position,
                speed: vessel.currentSpeed
            }
        }));
        
        // Random notification
        if (Math.random() > 0.8) {
            const shipment = demoData.shipments[Math.floor(Math.random() * Math.min(10, demoData.shipments.length))];
            const notification = {
                type: 'notification',
                data: {
                    title: 'Vessel Update',
                    message: `${shipment.vessel.name} is approaching ${shipment.destination.name}`,
                    severity: 'info',
                    timestamp: new Date()
                }
            };
            ws.send(JSON.stringify(notification));
        }
    }, 5000);
    
    // Cleanup on disconnect
    ws.on('close', () => {
        clearInterval(interval);
    });
});

module.exports = router;