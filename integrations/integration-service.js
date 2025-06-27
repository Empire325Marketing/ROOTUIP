// ROOTUIP Integration Service
// Central service for managing all carrier integrations

const express = require('express');
const { IntegrationRegistry, RateLimiterManager } = require('./integration-framework');
const { MaerskConnector, MaerskTransformer } = require('./carriers/maersk-adapter');
const { MSCConnector, MSCTransformer } = require('./carriers/msc-adapter');
const { createGenericAdapter } = require('./carriers/generic-adapter');
const EventEmitter = require('events');

class IntegrationService extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = config;
        this.registry = new IntegrationRegistry();
        this.rateLimiterManager = new RateLimiterManager();
        this.integrations = new Map();
        this.webhookHandlers = new Map();
        
        // Register built-in carriers
        this.registerBuiltInCarriers();
        
        // Initialize Express app for webhooks
        this.app = express();
        this.setupWebhookEndpoints();
    }
    
    registerBuiltInCarriers() {
        // Register Maersk
        this.registry.register('MAEU', MaerskConnector, MaerskTransformer);
        
        // Register MSC
        this.registry.register('MSCU', MSCConnector, MSCTransformer);
        
        // Register common carriers with generic adapter
        const commonCarriers = [
            {
                carrierId: 'CMDU',
                carrierName: 'CMA CGM',
                authMethod: 'api-key',
                baseUrl: 'https://api.cma-cgm.com/v1'
            },
            {
                carrierId: 'HLCU',
                carrierName: 'Hapag-Lloyd',
                authMethod: 'oauth2',
                baseUrl: 'https://api.hapag-lloyd.com/v1'
            },
            {
                carrierId: 'ONEY',
                carrierName: 'Ocean Network Express',
                authMethod: 'basic',
                baseUrl: 'https://api.one-line.com/v1'
            },
            {
                carrierId: 'COSU',
                carrierName: 'COSCO Shipping',
                authMethod: 'api-key',
                baseUrl: 'https://api.cosco.com/v1'
            },
            {
                carrierId: 'EGLV',
                carrierName: 'Evergreen Line',
                authMethod: 'api-key',
                baseUrl: 'https://api.evergreen-line.com/v1'
            }
        ];
        
        commonCarriers.forEach(carrier => {
            this.registry.register(carrier.carrierId, 
                (config) => createGenericAdapter({ ...carrier, ...config })
            );
        });
    }
    
    // Initialize a carrier integration
    async initializeCarrier(carrierId, config) {
        try {
            // Create integration instance
            const integration = this.registry.createIntegration(carrierId, config);
            
            // Set up event listeners
            integration.on('request', (data) => this.handleIntegrationEvent('request', carrierId, data));
            integration.on('response', (data) => this.handleIntegrationEvent('response', carrierId, data));
            integration.on('error', (error) => this.handleIntegrationEvent('error', carrierId, error));
            integration.on('rate-limit', (data) => this.handleIntegrationEvent('rate-limit', carrierId, data));
            
            // Test connection
            const connected = await integration.connect();
            
            if (connected) {
                this.integrations.set(carrierId, integration);
                this.emit('carrier-connected', { carrierId, name: integration.name });
                return { success: true, carrierId };
            } else {
                throw new Error('Failed to connect to carrier');
            }
            
        } catch (error) {
            this.emit('carrier-error', { carrierId, error: error.message });
            throw error;
        }
    }
    
    // Get integration instance
    getIntegration(carrierId) {
        const integration = this.integrations.get(carrierId);
        if (!integration) {
            throw new Error(`No active integration for carrier: ${carrierId}`);
        }
        return integration;
    }
    
    // Check if carrier is connected
    isCarrierConnected(carrierId) {
        const integration = this.integrations.get(carrierId);
        return integration ? integration.isConnected() : false;
    }
    
    // Get all active integrations
    getActiveIntegrations() {
        const active = [];
        this.integrations.forEach((integration, carrierId) => {
            active.push({
                carrierId,
                name: integration.name,
                connected: integration.isConnected(),
                metrics: integration.getMetrics()
            });
        });
        return active;
    }
    
    // Track shipment across carriers
    async trackShipment(trackingNumber, carrierId = null, type = 'auto') {
        // If carrier specified, use that integration
        if (carrierId) {
            const integration = this.getIntegration(carrierId);
            return integration.trackShipment(trackingNumber, type);
        }
        
        // Otherwise, try to detect carrier from tracking number
        const detectedCarrier = this.detectCarrierFromTracking(trackingNumber);
        if (detectedCarrier) {
            const integration = this.getIntegration(detectedCarrier);
            return integration.trackShipment(trackingNumber, type);
        }
        
        // Try all connected carriers
        const results = [];
        for (const [carrierId, integration] of this.integrations) {
            try {
                const result = await integration.trackShipment(trackingNumber, type);
                if (result && result.status) {
                    results.push({
                        carrierId,
                        carrierName: integration.name,
                        data: result
                    });
                }
            } catch (error) {
                // Continue to next carrier
                this.emit('tracking-error', { carrierId, trackingNumber, error: error.message });
            }
        }
        
        if (results.length === 0) {
            throw new Error('Tracking number not found in any connected carrier');
        }
        
        return results.length === 1 ? results[0] : results;
    }
    
    // Detect carrier from tracking number format
    detectCarrierFromTracking(trackingNumber) {
        const patterns = {
            'MAEU': /^MAEU\d{7}$/,
            'MSCU': /^MSCU\d{7}$/,
            'CMDU': /^CMDU\d{7}$/,
            'HLCU': /^HLCU\d{7}$/,
            'ONEY': /^ONEY\d{7}$/,
            'COSU': /^COSU\d{7}$/,
            'EGLV': /^EGLV\d{7}$/
        };
        
        for (const [carrierId, pattern] of Object.entries(patterns)) {
            if (pattern.test(trackingNumber)) {
                return carrierId;
            }
        }
        
        return null;
    }
    
    // Get schedules from multiple carriers
    async getSchedules(origin, destination, date, carrierIds = null) {
        const carriers = carrierIds || Array.from(this.integrations.keys());
        const schedules = [];
        
        const promises = carriers.map(async (carrierId) => {
            try {
                const integration = this.getIntegration(carrierId);
                const result = await integration.getSchedule(origin, destination, date);
                
                return {
                    carrierId,
                    carrierName: integration.name,
                    schedules: Array.isArray(result) ? result : [result]
                };
            } catch (error) {
                this.emit('schedule-error', { carrierId, error: error.message });
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => r !== null);
    }
    
    // Handle integration events
    handleIntegrationEvent(eventType, carrierId, data) {
        this.emit('integration-event', {
            type: eventType,
            carrierId,
            timestamp: new Date().toISOString(),
            data
        });
        
        // Log to monitoring system
        if (this.config.monitoring) {
            this.logToMonitoring(eventType, carrierId, data);
        }
    }
    
    // Set up webhook endpoints
    setupWebhookEndpoints() {
        this.app.use(express.json());
        this.app.use(express.raw({ type: 'application/xml' }));
        
        // Generic webhook endpoint
        this.app.post('/webhooks/:carrierId', async (req, res) => {
            const { carrierId } = req.params;
            const signature = req.headers['x-webhook-signature'];
            
            try {
                const integration = this.getIntegration(carrierId);
                const result = await integration.handleWebhook(req.body, signature);
                
                this.emit('webhook-received', {
                    carrierId,
                    timestamp: new Date().toISOString(),
                    data: result
                });
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const integrations = this.getActiveIntegrations();
            res.json({
                status: 'healthy',
                integrations: integrations.length,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    // Start webhook server
    startWebhookServer(port = 3100) {
        this.webhookServer = this.app.listen(port, () => {
            this.emit('webhook-server-started', { port });
        });
        return this.webhookServer;
    }
    
    // Stop webhook server
    stopWebhookServer() {
        if (this.webhookServer) {
            this.webhookServer.close();
            this.emit('webhook-server-stopped');
        }
    }
    
    // Bulk operations
    async bulkTrackContainers(containerNumbers, carrierId = null) {
        const batchSize = 20; // Process in batches
        const results = [];
        
        for (let i = 0; i < containerNumbers.length; i += batchSize) {
            const batch = containerNumbers.slice(i, i + batchSize);
            const batchPromises = batch.map(containerNumber => 
                this.trackShipment(containerNumber, carrierId, 'container')
                    .catch(error => ({ containerNumber, error: error.message }))
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        return results;
    }
    
    // Get carrier-specific documentation
    getCarrierDocumentation(carrierId) {
        const docs = {
            'MAEU': {
                name: 'Maersk Line',
                apiDocs: 'https://developer.maersk.com',
                supportedFeatures: ['tracking', 'booking', 'schedule', 'documents'],
                authRequired: ['consumerKey', 'consumerSecret', 'customerId']
            },
            'MSCU': {
                name: 'Mediterranean Shipping Company',
                apiDocs: 'https://api.msc.com/docs',
                supportedFeatures: ['tracking', 'booking', 'schedule', 'rates'],
                authRequired: ['username', 'password', 'accountNumber']
            }
        };
        
        return docs[carrierId] || {
            name: carrierId,
            supportedFeatures: ['tracking'],
            authRequired: ['apiKey']
        };
    }
    
    // Monitoring integration
    logToMonitoring(eventType, carrierId, data) {
        // Implement monitoring integration (e.g., CloudWatch, Datadog)
        console.log(`[${eventType}] ${carrierId}:`, data);
    }
    
    // Clean up
    async shutdown() {
        // Disconnect all integrations
        for (const [carrierId, integration] of this.integrations) {
            await integration.disconnect();
        }
        
        // Stop webhook server
        this.stopWebhookServer();
        
        this.emit('shutdown');
    }
}

// Create singleton instance
let serviceInstance = null;

function createIntegrationService(config) {
    if (!serviceInstance) {
        serviceInstance = new IntegrationService(config);
    }
    return serviceInstance;
}

function getIntegrationService() {
    if (!serviceInstance) {
        throw new Error('Integration service not initialized');
    }
    return serviceInstance;
}

module.exports = {
    IntegrationService,
    createIntegrationService,
    getIntegrationService
};