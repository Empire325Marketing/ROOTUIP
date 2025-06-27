// ROOTUIP API Server Setup
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
const platformApi = require('./platform-api');
const demoApi = require('./demo-api');
const dataInterfacesApi = require('./data-interfaces-api');
const dataPipeline = require('./data-pipeline');

// Mount API routes
app.use('/api', platformApi);
app.use('/api/demo', demoApi);
app.use('/api/data', dataInterfacesApi);
app.use('/api/pipeline', dataPipeline);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date(),
        apis: {
            platform: 'active',
            demo: 'active',
            dataInterfaces: 'active',
            pipeline: 'active'
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        path: req.path 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`ROOTUIP API Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Platform API: http://localhost:${PORT}/api`);
    console.log(`Demo API: http://localhost:${PORT}/api/demo`);
});