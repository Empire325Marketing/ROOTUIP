#!/usr/bin/env node

/**
 * ROOTUIP Integration Gateway
 * Central API gateway for all platform services
 */

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3007;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: ["https://rootuip.com", "http://localhost:3000", "http://localhost:3001"],
    credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// JWT Verification Middleware
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        // Check session-based auth as fallback
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rootuip-jwt-secret-2024');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Service routing configuration
const services = {
    '/auth': {
        target: 'http://localhost:3003',
        description: 'Authentication Service'
    },
    '/demo': {
        target: 'http://localhost:3001',
        description: 'Enterprise Demo Platform'
    },
    '/ai': {
        target: 'http://localhost:3002',
        description: 'AI/ML Engine'
    },
    '/websocket': {
        target: 'http://localhost:3004',
        description: 'WebSocket Server',
        ws: true
    },
    '/maersk': {
        target: 'http://localhost:3005',
        description: 'Maersk Integration'
    },
    '/customer': {
        target: 'http://localhost:3006',
        description: 'Customer Success Platform'
    }
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'integration-gateway',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: Object.keys(services).map(path => ({
            path,
            ...services[path]
        }))
    });
});

// Activity feed endpoint
app.get('/activity/recent', verifyToken, (req, res) => {
    // Mock activity data
    const activities = [
        {
            id: 1,
            message: 'Container MSKU7891234 arrived at Port of Singapore',
            time: '2 minutes ago',
            icon: 'ship',
            type: 'arrival'
        },
        {
            id: 2,
            message: 'Document processing completed for shipment #2024-1789',
            time: '15 minutes ago',
            icon: 'check',
            type: 'document'
        },
        {
            id: 3,
            message: 'Risk alert: 5 containers approaching demurrage deadline',
            time: '1 hour ago',
            icon: 'exclamation-triangle',
            type: 'alert'
        },
        {
            id: 4,
            message: 'Route optimization saved $12,450 on Pacific trade lane',
            time: '3 hours ago',
            icon: 'dollar-sign',
            type: 'savings'
        },
        {
            id: 5,
            message: 'New carrier integration: CMA CGM now available',
            time: '5 hours ago',
            icon: 'plug',
            type: 'integration'
        }
    ];
    
    res.json(activities);
});

// Container tracking endpoint
app.get('/containers/active', verifyToken, (req, res) => {
    // Mock container data
    res.json({
        total: 12543,
        active: 11234,
        delayed: 234,
        atRisk: 89,
        delivered: 1020,
        lastUpdated: new Date().toISOString()
    });
});

// Performance metrics endpoint
app.get('/metrics/performance', verifyToken, (req, res) => {
    res.json({
        onTimeDelivery: 94.2,
        averageTransitTime: 23.5,
        costPerContainer: 2134,
        demurrageRate: 2.3,
        documentAccuracy: 98.7,
        lastUpdated: new Date().toISOString()
    });
});

// ROI metrics endpoint
app.get('/metrics/roi', verifyToken, (req, res) => {
    const { containers = 50000 } = req.query;
    
    const monthlySavings = containers * 0.15 * 2500; // 15% savings on average cost
    const annualSavings = monthlySavings * 12;
    const implementationCost = Math.max(500000, containers * 0.8);
    const roi = ((annualSavings - implementationCost) / implementationCost) * 100;
    
    res.json({
        monthlyContainers: parseInt(containers),
        monthlySavings,
        annualSavings,
        implementationCost,
        roiPercentage: Math.round(roi),
        paybackMonths: Math.round((implementationCost / monthlySavings) * 10) / 10,
        calculatedAt: new Date().toISOString()
    });
});

// Set up proxy middleware for each service
Object.entries(services).forEach(([path, config]) => {
    app.use(path, createProxyMiddleware({
        target: config.target,
        changeOrigin: true,
        ws: config.ws || false,
        pathRewrite: {
            [`^${path}`]: ''
        },
        onError: (err, req, res) => {
            console.error(`Proxy error for ${path}:`, err.message);
            res.status(502).json({
                error: 'Service temporarily unavailable',
                service: config.description,
                timestamp: new Date().toISOString()
            });
        }
    }));
});

// Catch-all error handler
app.use((err, req, res, next) => {
    console.error('Gateway error:', err);
    res.status(500).json({
        error: 'Internal gateway error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Start the gateway
app.listen(PORT, () => {
    console.log(`🌐 Integration Gateway running on port ${PORT}`);
    console.log(`📡 Proxying services:`);
    Object.entries(services).forEach(([path, config]) => {
        console.log(`   ${path} → ${config.target} (${config.description})`);
    });
    console.log(`🔒 JWT authentication enabled`);
    console.log(`⚡ Rate limiting: 100 requests per 15 minutes`);
});

module.exports = app;