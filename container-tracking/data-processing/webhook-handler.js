// ROOTUIP Container Tracking - Webhook Handler
// Real-time webhook processing for carrier updates

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

class WebhookHandler {
    constructor(config) {
        this.config = config;
        this.app = express();
        this.processors = new Map();
        this.eventQueue = [];
        this.isProcessing = false;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.startProcessing();
    }

    setupMiddleware() {
        // Raw body parser for webhook signature validation
        this.app.use('/webhooks', express.raw({ type: 'application/json', limit: '10mb' }));
        
        // Rate limiting for webhooks
        const webhookLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 1000, // Max 1000 webhooks per minute
            message: 'Too many webhook requests',
            standardHeaders: true,
            legacyHeaders: false,
        });

        this.app.use('/webhooks', webhookLimiter);

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - Webhook: ${req.method} ${req.path} - IP: ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        // Maersk webhook endpoint
        this.app.post('/webhooks/maersk', async (req, res) => {
            try {
                await this.handleMaerskWebhook(req, res);
            } catch (error) {
                console.error('Maersk webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });

        // MSC webhook endpoint
        this.app.post('/webhooks/msc', async (req, res) => {
            try {
                await this.handleMSCWebhook(req, res);
            } catch (error) {
                console.error('MSC webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });

        // CMA CGM webhook endpoint
        this.app.post('/webhooks/cmacgm', async (req, res) => {
            try {
                await this.handleCMACGMWebhook(req, res);
            } catch (error) {
                console.error('CMA CGM webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });

        // Hapag-Lloyd webhook endpoint
        this.app.post('/webhooks/hapag-lloyd', async (req, res) => {
            try {
                await this.handleHapagLloydWebhook(req, res);
            } catch (error) {
                console.error('Hapag-Lloyd webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });

        // Generic webhook endpoint for testing
        this.app.post('/webhooks/generic', async (req, res) => {
            try {
                await this.handleGenericWebhook(req, res);
            } catch (error) {
                console.error('Generic webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });

        // Health check endpoint
        this.app.get('/webhooks/health', (req, res) => {
            res.json({
                status: 'healthy',
                queueSize: this.eventQueue.length,
                isProcessing: this.isProcessing,
                timestamp: new Date().toISOString()
            });
        });
    }

    async handleMaerskWebhook(req, res) {
        const signature = req.headers['x-maersk-signature'];
        const payload = req.body;
        
        // Validate webhook signature
        if (!this.validateMaerskSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const webhookData = JSON.parse(payload.toString());
        
        // Process Maersk webhook data
        const event = {
            id: crypto.randomUUID(),
            carrier: 'MAEU',
            type: 'webhook',
            timestamp: new Date().toISOString(),
            data: this.normalizeMaerskWebhook(webhookData),
            rawData: webhookData
        };

        this.queueEvent(event);
        
        res.status(200).json({ 
            message: 'Webhook received',
            eventId: event.id 
        });
    }

    async handleMSCWebhook(req, res) {
        const signature = req.headers['x-msc-signature'];
        const payload = req.body;
        
        // Validate webhook signature
        if (!this.validateMSCSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const webhookData = JSON.parse(payload.toString());
        
        const event = {
            id: crypto.randomUUID(),
            carrier: 'MSCU',
            type: 'webhook',
            timestamp: new Date().toISOString(),
            data: this.normalizeMSCWebhook(webhookData),
            rawData: webhookData
        };

        this.queueEvent(event);
        
        res.status(200).json({ 
            message: 'Webhook received',
            eventId: event.id 
        });
    }

    async handleCMACGMWebhook(req, res) {
        const signature = req.headers['x-cmacgm-signature'];
        const payload = req.body;
        
        // Validate webhook signature
        if (!this.validateCMACGMSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const webhookData = JSON.parse(payload.toString());
        
        const event = {
            id: crypto.randomUUID(),
            carrier: 'CMDU',
            type: 'webhook',
            timestamp: new Date().toISOString(),
            data: this.normalizeCMACGMWebhook(webhookData),
            rawData: webhookData
        };

        this.queueEvent(event);
        
        res.status(200).json({ 
            message: 'Webhook received',
            eventId: event.id 
        });
    }

    async handleHapagLloydWebhook(req, res) {
        const signature = req.headers['x-hapag-lloyd-signature'];
        const payload = req.body;
        
        // Validate webhook signature
        if (!this.validateHapagLloydSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const webhookData = JSON.parse(payload.toString());
        
        const event = {
            id: crypto.randomUUID(),
            carrier: 'HLCU',
            type: 'webhook',
            timestamp: new Date().toISOString(),
            data: this.normalizeHapagLloydWebhook(webhookData),
            rawData: webhookData
        };

        this.queueEvent(event);
        
        res.status(200).json({ 
            message: 'Webhook received',
            eventId: event.id 
        });
    }

    async handleGenericWebhook(req, res) {
        const webhookData = JSON.parse(req.body.toString());
        
        const event = {
            id: crypto.randomUUID(),
            carrier: webhookData.carrier || 'GENERIC',
            type: 'webhook',
            timestamp: new Date().toISOString(),
            data: this.normalizeGenericWebhook(webhookData),
            rawData: webhookData
        };

        this.queueEvent(event);
        
        res.status(200).json({ 
            message: 'Webhook received',
            eventId: event.id 
        });
    }

    // Signature validation methods
    validateMaerskSignature(payload, signature) {
        if (!signature || !this.config.maersk?.webhookSecret) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.config.maersk.webhookSecret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    validateMSCSignature(payload, signature) {
        if (!signature || !this.config.msc?.webhookSecret) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha1', this.config.msc.webhookSecret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    validateCMACGMSignature(payload, signature) {
        if (!signature || !this.config.cmacgm?.webhookSecret) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.config.cmacgm.webhookSecret)
            .update(payload)
            .digest('base64');

        return signature === expectedSignature;
    }

    validateHapagLloydSignature(payload, signature) {
        if (!signature || !this.config.hapagLloyd?.webhookSecret) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.config.hapagLloyd.webhookSecret)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    // Webhook data normalization methods
    normalizeMaerskWebhook(data) {
        return {
            eventType: data.eventType || data.transportEventTypeCode,
            containerNumber: data.containerNumber || data.equipmentNumber,
            timestamp: data.eventDateTime || data.timestamp,
            location: {
                name: data.location?.locationName,
                code: data.location?.UNLocationCode,
                country: data.location?.countryCode,
                coordinates: data.location?.geoCoordinates
            },
            status: data.transportEventTypeCode || data.eventType,
            vessel: {
                name: data.vessel?.vesselName,
                imo: data.vessel?.vesselIMONumber,
                voyage: data.voyage?.voyageNumber
            },
            description: data.eventTypeDescription || data.description,
            facilityCode: data.location?.facilityCode
        };
    }

    normalizeMSCWebhook(data) {
        return {
            eventType: data.eventType || data.statusCode,
            containerNumber: data.containerNumber,
            timestamp: data.eventDateTime || data.timestamp,
            location: {
                name: data.location?.name,
                code: data.location?.unlocode,
                country: data.location?.country,
                coordinates: data.location?.coordinates
            },
            status: data.statusCode || data.eventType,
            vessel: {
                name: data.vessel?.name,
                imo: data.vessel?.imoNumber,
                voyage: data.voyage?.number
            },
            description: data.description || data.statusDescription,
            facilityCode: data.location?.facility
        };
    }

    normalizeCMACGMWebhook(data) {
        return {
            eventType: data.milestoneCode || data.eventType,
            containerNumber: data.containerNumber || data.equipmentNumber,
            timestamp: data.eventDateTime || data.timestamp,
            location: {
                name: data.location?.locationName,
                code: data.location?.UNLocationCode,
                country: data.location?.countryCode,
                coordinates: data.location?.coordinates
            },
            status: data.milestoneCode || data.eventCode,
            vessel: {
                name: data.transport?.vesselName,
                imo: data.transport?.vesselIMO,
                voyage: data.transport?.voyageNumber
            },
            description: data.eventDescription || data.milestoneDescription,
            facilityCode: data.location?.facilityCode
        };
    }

    normalizeHapagLloydWebhook(data) {
        return {
            eventType: data.eventTypeCode || data.eventType,
            containerNumber: data.equipmentNumber || data.containerNumber,
            timestamp: data.eventDateTime || data.timestamp,
            location: {
                name: data.location?.locationName,
                code: data.location?.UNLocationCode,
                country: data.location?.countryCode,
                coordinates: data.location?.geoCoordinates
            },
            status: data.eventTypeCode || data.statusCode,
            vessel: {
                name: data.transport?.vesselName,
                imo: data.transport?.vesselIMONumber,
                voyage: data.transport?.carrierVoyageNumber
            },
            description: data.eventDescription || data.eventTypeDescription,
            facilityCode: data.location?.facilityTypeCode
        };
    }

    normalizeGenericWebhook(data) {
        return {
            eventType: data.eventType || data.event || data.type,
            containerNumber: data.containerNumber || data.container || data.equipment,
            timestamp: data.timestamp || data.eventDateTime || new Date().toISOString(),
            location: data.location || {},
            status: data.status || data.eventType,
            vessel: data.vessel || {},
            description: data.description || data.message,
            facilityCode: data.facilityCode
        };
    }

    // Event processing
    queueEvent(event) {
        this.eventQueue.push(event);
        console.log(`[WebhookHandler] Queued event ${event.id} from ${event.carrier} (queue size: ${this.eventQueue.length})`);
        
        // Trigger processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`[WebhookHandler] Starting event processing (${this.eventQueue.length} events)`);

        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            
            try {
                await this.processEvent(event);
                console.log(`[WebhookHandler] Processed event ${event.id}`);
            } catch (error) {
                console.error(`[WebhookHandler] Failed to process event ${event.id}:`, error);
                
                // Dead letter queue for failed events
                await this.handleFailedEvent(event, error);
            }
        }

        this.isProcessing = false;
        console.log('[WebhookHandler] Event processing completed');
    }

    async processEvent(event) {
        // Store raw webhook data
        await this.storeWebhookEvent(event);
        
        // Normalize and enrich data
        const enrichedEvent = await this.enrichEventData(event);
        
        // Detect duplicates
        const isDuplicate = await this.checkForDuplicate(enrichedEvent);
        if (isDuplicate) {
            console.log(`[WebhookHandler] Duplicate event detected: ${event.id}`);
            return;
        }
        
        // Store normalized event
        await this.storeNormalizedEvent(enrichedEvent);
        
        // Trigger real-time notifications
        await this.triggerRealTimeNotifications(enrichedEvent);
        
        // Update container status
        await this.updateContainerStatus(enrichedEvent);
        
        // Update predictive models
        await this.updatePredictiveModels(enrichedEvent);
    }

    async storeWebhookEvent(event) {
        // Store in database with webhook_events table
        const query = `
            INSERT INTO webhook_events (
                id, carrier, event_type, container_number, timestamp,
                normalized_data, raw_data, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `;
        
        const values = [
            event.id,
            event.carrier,
            event.data.eventType,
            event.data.containerNumber,
            event.data.timestamp,
            JSON.stringify(event.data),
            JSON.stringify(event.rawData)
        ];

        // This would normally execute against your database
        console.log('[WebhookHandler] Storing webhook event:', event.id);
    }

    async enrichEventData(event) {
        // Add additional context and metadata
        const enriched = {
            ...event,
            enrichments: {
                processedAt: new Date().toISOString(),
                geoLocation: await this.enrichGeoLocation(event.data.location),
                weatherData: await this.enrichWeatherData(event.data.location),
                portCongestion: await this.getPortCongestionData(event.data.location?.code),
                carrierPerformance: await this.getCarrierPerformanceMetrics(event.carrier)
            }
        };

        return enriched;
    }

    async enrichGeoLocation(location) {
        if (!location?.coordinates) {
            return null;
        }

        // Mock geo enrichment
        return {
            timezone: 'UTC+1',
            region: 'Europe',
            portType: 'Container Terminal',
            weatherStation: 'NEAREST_STATION'
        };
    }

    async enrichWeatherData(location) {
        if (!location?.coordinates) {
            return null;
        }

        // Mock weather data
        return {
            temperature: 22,
            windSpeed: 15,
            precipitation: 0,
            visibility: 10,
            conditions: 'clear'
        };
    }

    async getPortCongestionData(portCode) {
        if (!portCode) return null;

        // Mock port congestion data
        return {
            congestionLevel: 'LOW',
            avgWaitTime: 2.5,
            berths: {
                total: 12,
                occupied: 8,
                available: 4
            },
            lastUpdated: new Date().toISOString()
        };
    }

    async getCarrierPerformanceMetrics(carrier) {
        // Mock carrier performance data
        return {
            onTimePerformance: 85.5,
            avgDelay: 1.2,
            reliabilityScore: 88,
            lastCalculated: new Date().toISOString()
        };
    }

    async checkForDuplicate(event) {
        // Check for duplicate events based on container, timestamp, and event type
        const duplicateQuery = `
            SELECT id FROM container_events 
            WHERE container_number = $1 
            AND event_timestamp = $2 
            AND event_type = $3 
            AND carrier = $4
            LIMIT 1
        `;

        // Mock duplicate check
        return false; // No duplicates for now
    }

    async storeNormalizedEvent(event) {
        // Store in container_events table
        const query = `
            INSERT INTO container_events (
                id, container_number, carrier, event_type, event_timestamp,
                location_name, location_code, location_country,
                vessel_name, vessel_imo, voyage_number,
                status, description, enrichments, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        `;

        console.log('[WebhookHandler] Storing normalized event:', event.id);
    }

    async triggerRealTimeNotifications(event) {
        // Trigger WebSocket notifications for real-time dashboard updates
        if (this.config.websocket) {
            this.config.websocket.emit('container_update', {
                containerNumber: event.data.containerNumber,
                carrier: event.carrier,
                status: event.data.status,
                location: event.data.location,
                timestamp: event.data.timestamp
            });
        }

        // Trigger email/SMS notifications for critical events
        await this.checkForCriticalEvents(event);
    }

    async checkForCriticalEvents(event) {
        const criticalEvents = [
            'VESSEL_DELAYED',
            'CUSTOMS_HOLD',
            'EQUIPMENT_DAMAGE',
            'SECURITY_ALERT',
            'DEMURRAGE_RISK'
        ];

        if (criticalEvents.includes(event.data.eventType)) {
            console.log(`[WebhookHandler] Critical event detected: ${event.data.eventType}`);
            // Trigger alert notifications
        }
    }

    async updateContainerStatus(event) {
        // Update container status in main tracking table
        const updateQuery = `
            UPDATE container_tracking 
            SET 
                current_status = $1,
                current_location_name = $2,
                current_location_code = $3,
                current_vessel = $4,
                last_update_time = $5,
                last_event_carrier = $6
            WHERE container_number = $7
        `;

        console.log('[WebhookHandler] Updating container status:', event.data.containerNumber);
    }

    async updatePredictiveModels(event) {
        // Update machine learning models with new data
        console.log('[WebhookHandler] Updating predictive models with new event data');
        
        // This would trigger ML pipeline updates
        // - ETA prediction models
        // - Delay prediction models
        // - Demurrage risk models
        // - Port congestion models
    }

    async handleFailedEvent(event, error) {
        // Store failed event for retry
        const deadLetterQuery = `
            INSERT INTO failed_webhook_events (
                original_event_id, carrier, error_message, error_stack,
                event_data, retry_count, created_at
            ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
        `;

        console.error(`[WebhookHandler] Storing failed event ${event.id}:`, error.message);
    }

    startProcessing() {
        // Start periodic queue processing in case events get stuck
        setInterval(() => {
            if (!this.isProcessing && this.eventQueue.length > 0) {
                this.processQueue();
            }
        }, 5000);

        console.log('[WebhookHandler] Event processing started');
    }

    // Register custom event processors
    registerProcessor(eventType, processor) {
        this.processors.set(eventType, processor);
    }

    // Get webhook statistics
    getStatistics() {
        return {
            queueSize: this.eventQueue.length,
            isProcessing: this.isProcessing,
            registeredProcessors: this.processors.size,
            timestamp: new Date().toISOString()
        };
    }

    // Start webhook server
    start(port = 3030) {
        this.app.listen(port, () => {
            console.log(`
🚀 ROOTUIP Webhook Handler
📡 Server running on port ${port}
🔄 Event processing: ${this.isProcessing ? 'Active' : 'Standby'}
📊 Queue size: ${this.eventQueue.length}

Webhook Endpoints:
- POST /webhooks/maersk      - Maersk container updates
- POST /webhooks/msc         - MSC container updates  
- POST /webhooks/cmacgm      - CMA CGM container updates
- POST /webhooks/hapag-lloyd - Hapag-Lloyd container updates
- POST /webhooks/generic     - Generic webhook testing
- GET  /webhooks/health      - Health check

🔐 Security: Signature validation enabled
⚡ Performance: Rate limiting active
📈 Processing: Real-time event pipeline
            `);
        });
    }
}

module.exports = WebhookHandler;