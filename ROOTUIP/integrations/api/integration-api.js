/**
 * Integration API Endpoints
 * RESTful API for container tracking, webhooks, and integration management
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const httpStatus = require('http-status');
const winston = require('winston');
const DemoDataGenerator = require('../demo-data/demo-generator');
const DataProcessingPipeline = require('../data-processing/pipeline');
const MaerskConnector = require('../carriers/maersk-connector');
const MSCConnector = require('../carriers/msc-connector');
const GenericCarrierConnector = require('../carriers/generic-carrier-template');

// Initialize services
const demoGenerator = new DemoDataGenerator();
const dataPipeline = new DataProcessingPipeline({
    database: {
        // Database configuration
    }
});

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'integration-api' },
    transports: [
        new winston.transports.File({ filename: 'logs/api-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/api.log' }),
        new winston.transports.Console()
    ]
});

// Carrier connectors registry
const carrierConnectors = new Map();

// Initialize carrier connectors
async function initializeConnectors(req) {
    const companyId = req.user?.company_id;
    
    // Initialize demo connectors for testing
    if (!carrierConnectors.has('maersk')) {
        carrierConnectors.set('maersk', new MaerskConnector({
            companyId: companyId,
            integrationId: 'demo-maersk',
            clientId: process.env.MAERSK_CLIENT_ID || 'demo',
            clientSecret: process.env.MAERSK_CLIENT_SECRET || 'demo',
            database: req.db
        }));
    }
    
    if (!carrierConnectors.has('msc')) {
        carrierConnectors.set('msc', new MSCConnector({
            companyId: companyId,
            integrationId: 'demo-msc',
            username: process.env.MSC_USERNAME || 'demo',
            password: process.env.MSC_PASSWORD || 'demo',
            database: req.db
        }));
    }
}

// Container Status Lookup
router.get('/containers/:containerNumber', [
    param('containerNumber').matches(/^[A-Z]{4}\d{7}$/).withMessage('Invalid container number format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { containerNumber } = req.params;
        const { realtime } = req.query;

        // Check cache first
        const cachedData = await getCachedContainerStatus(req.db, containerNumber);
        
        if (cachedData && !realtime) {
            return res.json({
                success: true,
                source: 'cache',
                data: cachedData,
                timestamp: new Date().toISOString()
            });
        }

        // For demo, generate realistic data
        if (process.env.DEMO_MODE === 'true') {
            const trackingData = demoGenerator.generateContainerTracking({
                containerNumber: containerNumber
            });
            
            // Process through pipeline
            await dataPipeline.enqueue(trackingData, 'high');
            
            return res.json({
                success: true,
                source: 'demo',
                data: trackingData,
                timestamp: new Date().toISOString()
            });
        }

        // Real carrier lookup
        await initializeConnectors(req);
        
        // Determine carrier from container prefix
        const carrier = detectCarrierFromContainer(containerNumber);
        const connector = carrierConnectors.get(carrier);
        
        if (!connector) {
            return res.status(httpStatus.NOT_FOUND).json({
                error: 'Carrier not supported',
                carrier: carrier
            });
        }

        // Fetch real-time data
        const trackingData = await connector.fetchContainerStatus(containerNumber);
        
        res.json({
            success: true,
            source: 'live',
            carrier: carrier,
            data: trackingData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Container lookup error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to retrieve container status',
            message: error.message
        });
    }
});

// Bulk Container Retrieval
router.post('/containers/bulk', [
    body('containerNumbers').isArray({ min: 1, max: 100 }).withMessage('Container numbers array required (1-100)'),
    body('containerNumbers.*').matches(/^[A-Z]{4}\d{7}$/).withMessage('Invalid container number format')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { containerNumbers } = req.body;
        const results = [];
        const errors = [];

        // Process containers in parallel batches
        const batchSize = 10;
        for (let i = 0; i < containerNumbers.length; i += batchSize) {
            const batch = containerNumbers.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (containerNumber) => {
                try {
                    // For demo mode
                    if (process.env.DEMO_MODE === 'true') {
                        const trackingData = demoGenerator.generateContainerTracking({
                            containerNumber: containerNumber
                        });
                        
                        results.push({
                            containerNumber,
                            status: 'success',
                            data: trackingData
                        });
                    } else {
                        // Real lookup would go here
                        const cachedData = await getCachedContainerStatus(req.db, containerNumber);
                        if (cachedData) {
                            results.push({
                                containerNumber,
                                status: 'success',
                                data: cachedData
                            });
                        } else {
                            errors.push({
                                containerNumber,
                                error: 'No data available'
                            });
                        }
                    }
                } catch (error) {
                    errors.push({
                        containerNumber,
                        error: error.message
                    });
                }
            });
            
            await Promise.all(batchPromises);
        }

        res.json({
            success: true,
            processed: containerNumbers.length,
            successful: results.length,
            failed: errors.length,
            results: results,
            errors: errors,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Bulk container lookup error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to process bulk container lookup',
            message: error.message
        });
    }
});

// D&D Charges Retrieval
router.get('/charges', [
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('carrier').optional().isString(),
    query('status').optional().isIn(['pending', 'invoiced', 'paid', 'disputed', 'waived']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const {
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days
            endDate = new Date(),
            carrier,
            status,
            page = 1,
            limit = 50
        } = req.query;

        // For demo mode
        if (process.env.DEMO_MODE === 'true') {
            const allCharges = demoGenerator.generateDDChargeHistory(30);
            
            // Apply filters
            let filteredCharges = allCharges;
            
            if (carrier) {
                filteredCharges = filteredCharges.filter(c => c.carrier === carrier);
            }
            
            if (status) {
                filteredCharges = filteredCharges.filter(c => c.status === status);
            }
            
            // Pagination
            const startIndex = (page - 1) * limit;
            const paginatedCharges = filteredCharges.slice(startIndex, startIndex + limit);
            
            // Calculate summary
            const summary = {
                totalCharges: filteredCharges.length,
                totalAmount: filteredCharges.reduce((sum, c) => sum + c.amount, 0),
                byType: {
                    demurrage: filteredCharges.filter(c => c.type === 'demurrage').length,
                    detention: filteredCharges.filter(c => c.type === 'detention').length
                },
                byStatus: {
                    pending: filteredCharges.filter(c => c.status === 'pending').length,
                    invoiced: filteredCharges.filter(c => c.status === 'invoiced').length,
                    paid: filteredCharges.filter(c => c.status === 'paid').length,
                    disputed: filteredCharges.filter(c => c.status === 'disputed').length,
                    waived: filteredCharges.filter(c => c.status === 'waived').length
                }
            };
            
            return res.json({
                success: true,
                summary: summary,
                charges: paginatedCharges,
                pagination: {
                    page: page,
                    limit: limit,
                    total: filteredCharges.length,
                    pages: Math.ceil(filteredCharges.length / limit)
                },
                timestamp: new Date().toISOString()
            });
        }

        // Real implementation would query database
        const charges = await getChargesFromDatabase(req.db, {
            companyId: req.user.company_id,
            startDate,
            endDate,
            carrier,
            status,
            page,
            limit
        });

        res.json(charges);

    } catch (error) {
        logger.error('Charges retrieval error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to retrieve charges',
            message: error.message
        });
    }
});

// Webhook Registration
router.post('/webhooks', [
    body('url').isURL().withMessage('Valid URL required'),
    body('events').isArray({ min: 1 }).withMessage('At least one event type required'),
    body('events.*').isIn(['container.update', 'charge.new', 'charge.update', 'dispute.update']),
    body('carriers').optional().isArray(),
    body('secret').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { url, events, carriers, secret } = req.body;
        const webhookId = require('crypto').randomUUID();
        
        // Store webhook configuration
        await req.db.query(`
            INSERT INTO webhooks (
                id, company_id, url, events, carriers, secret, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, true)
        `, [
            webhookId,
            req.user.company_id,
            url,
            JSON.stringify(events),
            JSON.stringify(carriers || []),
            secret || generateWebhookSecret()
        ]);

        // Test webhook with sample payload
        const testResult = await testWebhook(url, {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            data: {
                message: 'Webhook successfully registered'
            }
        }, secret);

        res.status(httpStatus.CREATED).json({
            success: true,
            webhookId: webhookId,
            url: url,
            events: events,
            carriers: carriers || 'all',
            testResult: testResult,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Webhook registration error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to register webhook',
            message: error.message
        });
    }
});

// Webhook Management
router.get('/webhooks', async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT id, url, events, carriers, is_active, created_at, last_triggered
            FROM webhooks
            WHERE company_id = $1
            ORDER BY created_at DESC
        `, [req.user.company_id]);

        res.json({
            success: true,
            webhooks: result.rows,
            total: result.rows.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Webhook list error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to retrieve webhooks',
            message: error.message
        });
    }
});

// Delete Webhook
router.delete('/webhooks/:webhookId', [
    param('webhookId').isUUID().withMessage('Valid webhook ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { webhookId } = req.params;

        const result = await req.db.query(`
            DELETE FROM webhooks
            WHERE id = $1 AND company_id = $2
            RETURNING id
        `, [webhookId, req.user.company_id]);

        if (result.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({
                error: 'Webhook not found'
            });
        }

        res.json({
            success: true,
            message: 'Webhook deleted successfully',
            webhookId: webhookId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Webhook deletion error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to delete webhook',
            message: error.message
        });
    }
});

// Integration Health Check
router.get('/health', async (req, res) => {
    try {
        const metrics = demoGenerator.generateIntegrationMetrics();
        const pipelineMetrics = dataPipeline.getMetrics();
        
        const overallHealth = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            carriers: metrics,
            pipeline: pipelineMetrics,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                apiVersion: '1.0.0'
            }
        };

        res.json(overallHealth);

    } catch (error) {
        logger.error('Health check error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Integration Configuration
router.get('/integrations', async (req, res) => {
    try {
        const result = await req.db.query(`
            SELECT 
                id, carrier, integration_type, status, 
                last_sync, error_count, success_count, metrics
            FROM carrier_integrations
            WHERE company_id = $1
            ORDER BY carrier
        `, [req.user.company_id]);

        const integrations = result.rows.map(row => ({
            ...row,
            metrics: JSON.parse(row.metrics || '{}')
        }));

        res.json({
            success: true,
            integrations: integrations,
            total: integrations.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Integration list error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to retrieve integrations',
            message: error.message
        });
    }
});

// Test Integration Connection
router.post('/integrations/:carrier/test', [
    param('carrier').isString().withMessage('Carrier required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        const { carrier } = req.params;
        
        await initializeConnectors(req);
        const connector = carrierConnectors.get(carrier);
        
        if (!connector) {
            return res.status(httpStatus.NOT_FOUND).json({
                error: 'Carrier not supported',
                carrier: carrier
            });
        }

        // Test connection
        const startTime = Date.now();
        let testResult;
        
        try {
            await connector.connect();
            const healthStatus = await connector.getHealthStatus();
            
            testResult = {
                success: true,
                status: 'connected',
                responseTime: Date.now() - startTime,
                health: healthStatus
            };
        } catch (error) {
            testResult = {
                success: false,
                status: 'failed',
                responseTime: Date.now() - startTime,
                error: error.message
            };
        }

        res.json({
            success: true,
            carrier: carrier,
            test: testResult,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Integration test error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to test integration',
            message: error.message
        });
    }
});

// Live Events Stream (Server-Sent Events)
router.get('/events/stream', async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    
    // Generate live events
    const interval = setInterval(() => {
        if (process.env.DEMO_MODE === 'true') {
            const event = demoGenerator.generateLiveEvent();
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
    }, 3000 + Math.random() * 5000); // Random interval 3-8 seconds
    
    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(interval);
    });
});

// Helper functions
async function getCachedContainerStatus(db, containerNumber) {
    try {
        const result = await db.query(`
            SELECT data FROM container_tracking
            WHERE container_number = $1
            AND updated_at > NOW() - INTERVAL '1 hour'
            ORDER BY updated_at DESC
            LIMIT 1
        `, [containerNumber]);
        
        return result.rows.length > 0 ? JSON.parse(result.rows[0].data) : null;
    } catch (error) {
        logger.error('Cache lookup error:', error);
        return null;
    }
}

function detectCarrierFromContainer(containerNumber) {
    const prefix = containerNumber.substring(0, 4);
    const carrierPrefixes = {
        'MAEU': 'maersk',
        'MSKU': 'maersk',
        'MSCU': 'msc',
        'MEDU': 'msc',
        'CMAU': 'cma-cgm',
        'CGMU': 'cma-cgm',
        'HLCU': 'hapag-lloyd',
        'COSU': 'cosco',
        'ONEU': 'one'
    };
    
    return carrierPrefixes[prefix] || 'unknown';
}

async function getChargesFromDatabase(db, filters) {
    // Implementation would query actual database
    // For now, return empty result
    return {
        success: true,
        charges: [],
        summary: {
            totalCharges: 0,
            totalAmount: 0
        },
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total: 0,
            pages: 0
        }
    };
}

function generateWebhookSecret() {
    return require('crypto').randomBytes(32).toString('hex');
}

async function testWebhook(url, payload, secret) {
    try {
        const axios = require('axios');
        const signature = secret ? 
            require('crypto').createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex') : 
            null;
        
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-UIP-Signature': signature,
                'X-UIP-Timestamp': new Date().toISOString()
            },
            timeout: 5000
        });
        
        return {
            success: true,
            statusCode: response.status,
            responseTime: response.headers['x-response-time'] || 'N/A'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = router;