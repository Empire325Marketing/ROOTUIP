// ROOTUIP Integration Server
const express = require('express');
const cors = require('cors');
const { router: integrationAPI, integrationService } = require('./integration-api');

const app = express();
const PORT = process.env.PORT || 3011;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount integration API
app.use('/api/integrations', integrationAPI);

// Start webhook server
integrationService.startWebhookServer(3100);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'ROOTUIP Integration Service',
        version: '1.0.0',
        endpoints: {
            carriers: '/api/integrations/carriers',
            tracking: '/api/integrations/track/:trackingNumber',
            schedules: '/api/integrations/schedules',
            health: '/api/integrations/health'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Integration Service running on port ${PORT}`);
    console.log(`Webhook server running on port 3100`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down integration service...');
    await integrationService.shutdown();
    process.exit(0);
});
