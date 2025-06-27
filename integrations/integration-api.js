// ROOTUIP Integration API
// RESTful API for carrier integration services

const express = require('express');
const router = express.Router();
const { createIntegrationService } = require('./integration-service');
const multer = require('multer');
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize integration service
const integrationService = createIntegrationService({
    monitoring: true
});

// Middleware for API authentication
const authenticateAPI = (req, res, next) => {
    // This should integrate with the auth system
    // For now, just check for API key
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    
    // TODO: Validate API key against database
    next();
};

// Apply authentication to all routes
router.use(authenticateAPI);

// Carrier Management Endpoints

// List all available carriers
router.get('/carriers', (req, res) => {
    const carriers = integrationService.registry.listIntegrations();
    const detailed = carriers.map(carrierId => {
        const docs = integrationService.getCarrierDocumentation(carrierId);
        const connected = integrationService.isCarrierConnected(carrierId);
        
        return {
            carrierId,
            name: docs.name,
            connected,
            supportedFeatures: docs.supportedFeatures,
            authRequired: docs.authRequired
        };
    });
    
    res.json({
        total: detailed.length,
        carriers: detailed
    });
});

// Get carrier details
router.get('/carriers/:carrierId', (req, res) => {
    const { carrierId } = req.params;
    
    try {
        const docs = integrationService.getCarrierDocumentation(carrierId);
        const connected = integrationService.isCarrierConnected(carrierId);
        
        const response = {
            ...docs,
            carrierId,
            connected
        };
        
        if (connected) {
            const integration = integrationService.getIntegration(carrierId);
            response.metrics = integration.getMetrics();
            response.lastHealthCheck = integration.lastHealthCheck;
        }
        
        res.json(response);
    } catch (error) {
        res.status(404).json({ error: 'Carrier not found' });
    }
});

// Connect to a carrier
router.post('/carriers/:carrierId/connect', async (req, res) => {
    const { carrierId } = req.params;
    const config = req.body;
    
    try {
        const result = await integrationService.initializeCarrier(carrierId, config);
        res.json({
            success: true,
            message: `Successfully connected to ${carrierId}`,
            ...result
        });
    } catch (error) {
        res.status(400).json({ 
            error: 'Failed to connect to carrier',
            details: error.message 
        });
    }
});

// Disconnect from a carrier
router.post('/carriers/:carrierId/disconnect', async (req, res) => {
    const { carrierId } = req.params;
    
    try {
        const integration = integrationService.getIntegration(carrierId);
        await integration.disconnect();
        integrationService.integrations.delete(carrierId);
        
        res.json({
            success: true,
            message: `Disconnected from ${carrierId}`
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Test carrier connection
router.post('/carriers/:carrierId/test', async (req, res) => {
    const { carrierId } = req.params;
    
    try {
        const integration = integrationService.getIntegration(carrierId);
        const health = await integration.healthCheck();
        
        res.json({
            success: health.status === 'healthy',
            health
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Tracking Endpoints

// Track single shipment
router.get('/track/:trackingNumber', async (req, res) => {
    const { trackingNumber } = req.params;
    const { carrierId, type = 'auto' } = req.query;
    
    try {
        const result = await integrationService.trackShipment(
            trackingNumber,
            carrierId,
            type
        );
        
        res.json({
            success: true,
            trackingNumber,
            data: result
        });
    } catch (error) {
        res.status(404).json({ 
            error: 'Tracking information not found',
            details: error.message 
        });
    }
});

// Track multiple shipments
router.post('/track/bulk', async (req, res) => {
    const { trackingNumbers, carrierId } = req.body;
    
    if (!Array.isArray(trackingNumbers)) {
        return res.status(400).json({ error: 'trackingNumbers must be an array' });
    }
    
    try {
        const results = await integrationService.bulkTrackContainers(
            trackingNumbers,
            carrierId
        );
        
        const successful = results.filter(r => !r.error);
        const failed = results.filter(r => r.error);
        
        res.json({
            success: true,
            total: results.length,
            successful: successful.length,
            failed: failed.length,
            results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Schedule Endpoints

// Search schedules
router.get('/schedules', async (req, res) => {
    const { origin, destination, date, carriers } = req.query;
    
    if (!origin || !destination) {
        return res.status(400).json({ 
            error: 'Origin and destination are required' 
        });
    }
    
    try {
        const carrierIds = carriers ? carriers.split(',') : null;
        const schedules = await integrationService.getSchedules(
            origin,
            destination,
            date || new Date().toISOString().split('T')[0],
            carrierIds
        );
        
        res.json({
            success: true,
            origin,
            destination,
            date,
            total: schedules.reduce((sum, c) => sum + c.schedules.length, 0),
            carriers: schedules
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Booking Endpoints (if carrier supports it)

// Create booking
router.post('/bookings', async (req, res) => {
    const { carrierId, bookingData } = req.body;
    
    if (!carrierId || !bookingData) {
        return res.status(400).json({ 
            error: 'carrierId and bookingData are required' 
        });
    }
    
    try {
        const integration = integrationService.getIntegration(carrierId);
        
        if (!integration.createBooking) {
            return res.status(400).json({ 
                error: 'Carrier does not support booking creation' 
            });
        }
        
        const result = await integration.createBooking(bookingData);
        
        res.json({
            success: true,
            booking: result
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get booking
router.get('/bookings/:bookingNumber', async (req, res) => {
    const { bookingNumber } = req.params;
    const { carrierId } = req.query;
    
    if (!carrierId) {
        return res.status(400).json({ error: 'carrierId is required' });
    }
    
    try {
        const integration = integrationService.getIntegration(carrierId);
        
        if (!integration.getBooking) {
            return res.status(400).json({ 
                error: 'Carrier does not support booking retrieval' 
            });
        }
        
        const result = await integration.getBooking(bookingNumber);
        
        res.json({
            success: true,
            booking: result
        });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// Document Endpoints

// Get bill of lading
router.get('/documents/bill-of-lading/:blNumber', async (req, res) => {
    const { blNumber } = req.params;
    const { carrierId } = req.query;
    
    if (!carrierId) {
        return res.status(400).json({ error: 'carrierId is required' });
    }
    
    try {
        const integration = integrationService.getIntegration(carrierId);
        
        if (!integration.getBillOfLading) {
            return res.status(400).json({ 
                error: 'Carrier does not support document retrieval' 
            });
        }
        
        const document = await integration.getBillOfLading(blNumber);
        
        res.set('Content-Type', document.contentType);
        res.set('Content-Disposition', `attachment; filename="BL-${blNumber}.pdf"`);
        res.send(document.content);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// File Upload Endpoints (for carriers using file-based integration)

// Upload tracking file
router.post('/upload/tracking', upload.single('file'), async (req, res) => {
    const { carrierId } = req.body;
    const file = req.file;
    
    if (!file || !carrierId) {
        return res.status(400).json({ 
            error: 'File and carrierId are required' 
        });
    }
    
    try {
        const integration = integrationService.getIntegration(carrierId);
        
        if (!integration.uploadFile) {
            return res.status(400).json({ 
                error: 'Carrier does not support file uploads' 
            });
        }
        
        const result = await integration.uploadFile(file, 'tracking');
        
        res.json({
            success: true,
            result
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Analytics Endpoints

// Get integration metrics
router.get('/analytics/metrics', (req, res) => {
    const integrations = integrationService.getActiveIntegrations();
    
    const metrics = {
        totalIntegrations: integrations.length,
        connectedIntegrations: integrations.filter(i => i.connected).length,
        totalRequests: integrations.reduce((sum, i) => sum + i.metrics.totalRequests, 0),
        averageSuccessRate: integrations.length > 0 ?
            integrations.reduce((sum, i) => {
                const rate = i.metrics.totalRequests > 0 ?
                    (i.metrics.successfulRequests / i.metrics.totalRequests) : 0;
                return sum + rate;
            }, 0) / integrations.length : 0,
        integrations: integrations
    };
    
    res.json(metrics);
});

// Get integration events
router.get('/analytics/events', (req, res) => {
    const { carrierId, type, limit = 100 } = req.query;
    
    // This would typically query from a database
    // For now, return mock data
    res.json({
        events: [],
        total: 0
    });
});

// Health check
router.get('/health', (req, res) => {
    const integrations = integrationService.getActiveIntegrations();
    
    res.json({
        status: 'healthy',
        service: 'ROOTUIP Integration API',
        timestamp: new Date().toISOString(),
        integrations: {
            total: integrations.length,
            connected: integrations.filter(i => i.connected).length
        }
    });
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Integration API Error:', error);
    
    res.status(error.status || 500).json({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Export router and service
module.exports = {
    router,
    integrationService
};