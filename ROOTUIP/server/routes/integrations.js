const express = require('express');
const router = express.Router();

// Mock container tracking data
const generateContainerData = () => ({
    containers: [
        {
            id: 'MSKU7750847',
            status: 'In Transit',
            location: 'Los Angeles, CA',
            eta: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            carrier: 'MSC',
            progress: 65
        },
        {
            id: 'HLBU5647382',
            status: 'At Port',
            location: 'Long Beach, CA',
            eta: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
            carrier: 'Hapag-Lloyd',
            progress: 85
        },
        {
            id: 'MAKU9876543',
            status: 'Delayed',
            location: 'Oakland, CA',
            eta: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            carrier: 'Maersk',
            progress: 45
        }
    ],
    metrics: {
        totalContainers: 1247,
        inTransit: 892,
        atPort: 156,
        delayed: 67,
        delivered: 132
    }
});

// Get container tracking status
router.get('/containers', (req, res) => {
    const data = generateContainerData();
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data
    });
});

// Get specific container details
router.get('/containers/:containerId', (req, res) => {
    const { containerId } = req.params;
    
    // Mock detailed container data
    const containerDetails = {
        id: containerId,
        status: 'In Transit',
        currentLocation: {
            port: 'Los Angeles, CA',
            coordinates: { lat: 33.7701, lng: -118.1937 },
            lastUpdate: new Date().toISOString()
        },
        route: [
            { location: 'Shanghai, China', timestamp: '2025-06-20T08:00:00Z', status: 'Departed' },
            { location: 'Yokohama, Japan', timestamp: '2025-06-22T14:30:00Z', status: 'Transited' },
            { location: 'Los Angeles, CA', timestamp: '2025-06-26T12:15:00Z', status: 'Current' },
            { location: 'Chicago, IL', timestamp: '2025-06-29T09:00:00Z', status: 'Estimated' }
        ],
        cargo: {
            type: 'Electronics',
            weight: '24,500 kg',
            value: '$1,250,000'
        },
        demurrage: {
            freeTime: '5 days',
            charges: '$0',
            daysUsed: 2
        }
    };
    
    res.json({
        success: true,
        container: containerDetails
    });
});

// Get carrier API status
router.get('/carriers/status', (req, res) => {
    const carrierStatus = [
        {
            name: 'Maersk',
            status: 'Connected',
            lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            containers: 487,
            apiHealth: 98.5
        },
        {
            name: 'MSC',
            status: 'Connected',
            lastSync: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            containers: 356,
            apiHealth: 99.2
        },
        {
            name: 'Hapag-Lloyd',
            status: 'Connected',
            lastSync: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
            containers: 289,
            apiHealth: 97.8
        },
        {
            name: 'COSCO',
            status: 'Connecting',
            lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            containers: 115,
            apiHealth: 85.4
        }
    ];
    
    res.json({
        success: true,
        carriers: carrierStatus,
        totalContainers: carrierStatus.reduce((sum, carrier) => sum + carrier.containers, 0)
    });
});

// Simulate integration metrics
router.get('/metrics', (req, res) => {
    const metrics = {
        totalIntegrations: 12,
        activeConnections: 11,
        dataPoints: 45892,
        lastHourUpdates: 1247,
        apiCalls: {
            total: 89567,
            successful: 88234,
            failed: 1333,
            successRate: 98.5
        },
        savings: {
            costSaved: 2450000,
            timeReduced: 1847,
            documentsAutomated: 12456
        }
    };
    
    res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;