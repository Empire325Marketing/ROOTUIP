// ROOTUIP Customer Dashboard API
const express = require('express');
const router = express.Router();

// Middleware for customer authentication
const authenticateCustomer = (req, res, next) => {
    // Check if user is authenticated and has customer role
    if (!req.user || !req.user.companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Apply authentication to all routes
router.use(authenticateCustomer);

// Company metrics endpoint
router.get('/metrics', async (req, res) => {
    const { companyId } = req.user;
    const { period = '30d' } = req.query;
    
    try {
        // In production, fetch from database
        const metrics = await getCompanyMetrics(companyId, period);
        res.json({
            success: true,
            metrics: {
                activeShipments: metrics.activeShipments,
                onTimeDelivery: metrics.onTimeDelivery,
                ddRiskScore: metrics.ddRiskScore,
                costSavings: metrics.costSavings,
                changes: {
                    activeShipments: { value: 12, trend: 'up' },
                    onTimeDelivery: { value: 2.1, trend: 'up' },
                    ddRiskScore: { value: -0.5, trend: 'down' },
                    costSavings: { value: 18, trend: 'up' }
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// Shipments endpoint
router.get('/shipments', async (req, res) => {
    const { companyId } = req.user;
    const { 
        status, 
        carrier, 
        route,
        page = 1, 
        limit = 20,
        sort = 'eta',
        order = 'asc' 
    } = req.query;
    
    try {
        const shipments = await getCompanyShipments(companyId, {
            status,
            carrier,
            route,
            page: parseInt(page),
            limit: parseInt(limit),
            sort,
            order
        });
        
        res.json({
            success: true,
            shipments: shipments.data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: shipments.total,
                pages: Math.ceil(shipments.total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

// Single shipment details
router.get('/shipments/:containerNumber', async (req, res) => {
    const { companyId } = req.user;
    const { containerNumber } = req.params;
    
    try {
        const shipment = await getShipmentDetails(companyId, containerNumber);
        
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        res.json({
            success: true,
            shipment: {
                ...shipment,
                timeline: await getShipmentTimeline(containerNumber),
                documents: await getShipmentDocuments(containerNumber),
                ddAnalysis: await getDDAnalysis(containerNumber)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shipment details' });
    }
});

// Analytics data for charts
router.get('/analytics/volume-trend', async (req, res) => {
    const { companyId } = req.user;
    const { period = '30d', groupBy = 'week' } = req.query;
    
    try {
        const data = await getVolumeTrend(companyId, period, groupBy);
        res.json({
            success: true,
            data: data.map(item => ({
                label: item.label,
                value: item.shipmentCount,
                date: item.date
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch volume trend' });
    }
});

// Carrier performance data
router.get('/analytics/carrier-performance', async (req, res) => {
    const { companyId } = req.user;
    const { period = '30d' } = req.query;
    
    try {
        const data = await getCarrierPerformance(companyId, period);
        res.json({
            success: true,
            data: data.map(carrier => ({
                carrierId: carrier.id,
                carrierName: carrier.name,
                onTimeRate: carrier.onTimeRate,
                totalShipments: carrier.totalShipments,
                avgTransitTime: carrier.avgTransitTime
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch carrier performance' });
    }
});

// Alerts and notifications
router.get('/alerts', async (req, res) => {
    const { companyId } = req.user;
    const { unreadOnly = false, limit = 10 } = req.query;
    
    try {
        const alerts = await getCompanyAlerts(companyId, {
            unreadOnly: unreadOnly === 'true',
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            alerts: alerts.map(alert => ({
                id: alert.id,
                type: alert.type,
                title: alert.title,
                message: alert.message,
                timestamp: alert.timestamp,
                read: alert.read,
                shipmentId: alert.shipmentId
            })),
            unreadCount: alerts.filter(a => !a.read).length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// Mark alert as read
router.put('/alerts/:alertId/read', async (req, res) => {
    const { companyId } = req.user;
    const { alertId } = req.params;
    
    try {
        await markAlertAsRead(companyId, alertId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update alert' });
    }
});

// Cost analysis
router.get('/analytics/cost-analysis', async (req, res) => {
    const { companyId } = req.user;
    const { period = '30d' } = req.query;
    
    try {
        const analysis = await getCostAnalysis(companyId, period);
        res.json({
            success: true,
            analysis: {
                totalSpend: analysis.totalSpend,
                savings: analysis.savings,
                savingsPercentage: analysis.savingsPercentage,
                breakdown: {
                    freight: analysis.freight,
                    demurrage: analysis.demurrage,
                    detention: analysis.detention,
                    documentation: analysis.documentation
                },
                topRoutes: analysis.topRoutes,
                topCarriers: analysis.topCarriers
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cost analysis' });
    }
});

// Document processing status
router.get('/documents/processing-status', async (req, res) => {
    const { companyId } = req.user;
    
    try {
        const status = await getDocumentProcessingStatus(companyId);
        res.json({
            success: true,
            status: {
                pending: status.pending,
                processing: status.processing,
                completed: status.completed,
                failed: status.failed,
                avgProcessingTime: status.avgProcessingTime,
                accuracy: status.accuracy
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch document status' });
    }
});

// Quick actions - Track new shipment
router.post('/track-shipment', async (req, res) => {
    const { companyId } = req.user;
    const { trackingNumber, carrier } = req.body;
    
    try {
        const result = await addShipmentTracking(companyId, {
            trackingNumber,
            carrier
        });
        
        res.json({
            success: true,
            shipment: result
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Export report
router.post('/reports/export', async (req, res) => {
    const { companyId } = req.user;
    const { reportType, period, format = 'pdf' } = req.body;
    
    try {
        const report = await generateReport(companyId, {
            type: reportType,
            period,
            format
        });
        
        res.json({
            success: true,
            downloadUrl: report.url,
            expiresAt: report.expiresAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Helper functions (in production, these would query the database)
async function getCompanyMetrics(companyId, period) {
    // Simulated data - replace with actual database queries
    return {
        activeShipments: 127,
        onTimeDelivery: 94.2,
        ddRiskScore: 2.8,
        costSavings: 142000
    };
}

async function getCompanyShipments(companyId, filters) {
    // Simulated shipment data
    const allShipments = [
        {
            containerNumber: 'MAEU1234567',
            blNumber: 'BL123456789',
            carrier: 'MAEU',
            carrierName: 'Maersk',
            origin: 'Shanghai',
            destination: 'Rotterdam',
            status: 'in-transit',
            eta: new Date('2025-07-15'),
            ddRisk: 'Low',
            route: 'asia-europe',
            vessel: 'Maersk Elba',
            voyage: 'ME123W'
        },
        {
            containerNumber: 'MSCU7654321',
            blNumber: 'BL987654321',
            carrier: 'MSCU',
            carrierName: 'MSC',
            origin: 'Singapore',
            destination: 'Los Angeles',
            status: 'at-port',
            eta: new Date('2025-07-10'),
            ddRisk: 'Medium',
            route: 'transpacific',
            vessel: 'MSC Oscar',
            voyage: 'MO456E'
        }
    ];
    
    // Apply filters
    let filtered = allShipments;
    if (filters.status) {
        filtered = filtered.filter(s => s.status === filters.status);
    }
    if (filters.carrier) {
        filtered = filtered.filter(s => s.carrier === filters.carrier);
    }
    
    return {
        data: filtered,
        total: filtered.length
    };
}

async function getShipmentDetails(companyId, containerNumber) {
    // In production, fetch from database
    return {
        containerNumber,
        blNumber: 'BL123456789',
        carrier: 'MAEU',
        carrierName: 'Maersk',
        origin: {
            port: 'Shanghai',
            country: 'China',
            departureDate: new Date('2025-06-01')
        },
        destination: {
            port: 'Rotterdam',
            country: 'Netherlands',
            arrivalDate: new Date('2025-07-15')
        },
        currentLocation: {
            latitude: 35.6762,
            longitude: 139.6503,
            description: 'Pacific Ocean - 500nm from Tokyo'
        },
        status: 'in-transit',
        ddRiskScore: 2.5,
        cargoDetails: {
            description: 'Electronics',
            weight: '24,500 kg',
            volume: '58 CBM',
            hazmat: false
        }
    };
}

async function getShipmentTimeline(containerNumber) {
    return [
        {
            event: 'Container loaded',
            location: 'Shanghai Port',
            timestamp: new Date('2025-06-01T10:00:00Z'),
            status: 'completed'
        },
        {
            event: 'Vessel departed',
            location: 'Shanghai Port',
            timestamp: new Date('2025-06-02T14:00:00Z'),
            status: 'completed'
        },
        {
            event: 'In transit',
            location: 'Pacific Ocean',
            timestamp: new Date(),
            status: 'current'
        },
        {
            event: 'Expected arrival',
            location: 'Rotterdam Port',
            timestamp: new Date('2025-07-15T08:00:00Z'),
            status: 'pending'
        }
    ];
}

async function getCompanyAlerts(companyId, options) {
    return [
        {
            id: '1',
            type: 'warning',
            title: 'Potential Delay - CMDU2468135',
            message: 'Weather conditions may affect arrival at New York port',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            read: false,
            shipmentId: 'CMDU2468135'
        },
        {
            id: '2',
            type: 'success',
            title: 'Document Processed - BL123456789',
            message: 'Bill of Lading automatically processed and validated',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            read: true,
            shipmentId: 'MAEU1234567'
        }
    ];
}

module.exports = router;