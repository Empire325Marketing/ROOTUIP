// ROOTUIP Platform API
const express = require('express');
const router = express.Router();

// Enable CORS
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    next();
});

// Metrics endpoint
router.get('/metrics', (req, res) => {
    res.json({
        activeShipments: Math.floor(Math.random() * 50) + 100,
        onTimeDelivery: (90 + Math.random() * 8).toFixed(1),
        ddRiskScore: (1 + Math.random() * 4).toFixed(1),
        costSavings: Math.floor(Math.random() * 100) + 100,
        timestamp: new Date()
    });
});

// Shipments endpoint
router.get('/shipments', (req, res) => {
    const shipments = [
        {
            container: 'MAEU1234567',
            blNumber: 'BL123456789',
            carrier: 'MAEU',
            carrierName: 'Maersk',
            origin: 'Shanghai',
            destination: 'Rotterdam',
            status: 'in-transit',
            eta: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
            ddRisk: 'Low',
            route: 'asia-europe'
        },
        {
            container: 'MSCU7654321',
            blNumber: 'BL987654321',
            carrier: 'MSCU',
            carrierName: 'MSC',
            origin: 'Singapore',
            destination: 'Los Angeles',
            status: 'at-port',
            eta: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            ddRisk: 'Medium',
            route: 'transpacific'
        },
        {
            container: 'CMDU2468135',
            blNumber: 'BL135792468',
            carrier: 'CMDU',
            carrierName: 'CMA CGM',
            origin: 'Hamburg',
            destination: 'New York',
            status: 'delayed',
            eta: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            ddRisk: 'High',
            route: 'transatlantic'
        }
    ];
    
    res.json({
        success: true,
        shipments: shipments,
        total: shipments.length
    });
});

// Notifications endpoint
router.get('/notifications', (req, res) => {
    const notifications = [
        {
            id: 1,
            type: 'warning',
            title: 'Potential Delay - CMDU2468135',
            message: 'Weather conditions may affect arrival at New York port',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            read: false
        },
        {
            id: 2,
            type: 'success',
            title: 'Document Processed - BL123456789',
            message: 'Bill of Lading automatically processed and validated',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            read: false
        },
        {
            id: 3,
            type: 'info',
            title: 'Rate Update - Transpacific Routes',
            message: 'New competitive rates available for Asia-US shipments',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            read: true
        }
    ];
    
    res.json({
        success: true,
        notifications: notifications,
        unreadCount: notifications.filter(n => !n.read).length
    });
});

// User info endpoint
router.get('/user', (req, res) => {
    res.json({
        success: true,
        user: {
            id: 'user-001',
            name: 'John Doe',
            email: 'john@acmecorp.com',
            company: 'Acme Corporation',
            companyId: 'ACME001',
            role: 'Admin',
            permissions: ['view_all', 'edit_all', 'manage_users']
        }
    });
});

// Company info endpoint
router.get('/company/:companyId', (req, res) => {
    res.json({
        success: true,
        company: {
            id: req.params.companyId || 'ACME001',
            name: 'Acme Corporation',
            industry: 'Manufacturing',
            size: '1001-5000',
            annualTEU: 12000,
            primaryRoutes: ['transpacific', 'asia-europe'],
            logo: 'AC'
        }
    });
});

// Ping endpoint for connection check
router.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = router;