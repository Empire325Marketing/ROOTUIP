/**
 * ROOTUIP Partner API
 * RESTful API for partner integrations
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

class PartnerAPI {
    constructor(marketplace, partnerManager) {
        this.marketplace = marketplace;
        this.partnerManager = partnerManager;
        
        // API versions
        this.versions = {
            v1: {
                endpoints: this.getV1Endpoints(),
                deprecated: false,
                sunset: null
            },
            v2: {
                endpoints: this.getV2Endpoints(),
                deprecated: false,
                sunset: null
            }
        };
        
        // Rate limiting configuration
        this.rateLimits = {
            default: { requests: 1000, window: 3600000 }, // 1000/hour
            tracking: { requests: 10000, window: 3600000 }, // 10k/hour
            booking: { requests: 100, window: 3600000 }, // 100/hour
            webhook: { requests: 5000, window: 3600000 } // 5k/hour
        };
        
        // Webhook events
        this.webhookEvents = {
            // Container events
            'container.status_changed': 'Container status update',
            'container.location_updated': 'Container location update',
            'container.eta_changed': 'Container ETA modification',
            'container.milestone_reached': 'Container milestone event',
            
            // Shipment events
            'shipment.created': 'New shipment created',
            'shipment.booked': 'Shipment booking confirmed',
            'shipment.departed': 'Shipment departed origin',
            'shipment.arrived': 'Shipment arrived destination',
            'shipment.delivered': 'Shipment delivered',
            'shipment.exception': 'Shipment exception occurred',
            
            // Document events
            'document.uploaded': 'Document uploaded',
            'document.validated': 'Document validated',
            'document.rejected': 'Document rejected',
            
            // Integration events
            'integration.installed': 'Integration installed by customer',
            'integration.uninstalled': 'Integration uninstalled',
            'integration.error': 'Integration error occurred',
            
            // Business events
            'invoice.created': 'Invoice generated',
            'payment.received': 'Payment received',
            'alert.triggered': 'Alert triggered'
        };
        
        this.setupRoutes();
    }
    
    setupRoutes() {
        // API documentation
        router.get('/docs', (req, res) => {
            res.json({
                title: 'ROOTUIP Partner API',
                version: 'v2',
                description: 'RESTful API for logistics partner integrations',
                baseUrl: 'https://api.rootuip.com/partner',
                authentication: 'OAuth2 or API Key',
                documentation: 'https://developers.rootuip.com',
                support: 'partners@rootuip.com'
            });
        });
        
        // Authentication middleware
        router.use(this.authenticateRequest.bind(this));
        
        // Version routing
        router.use('/v1', this.setupV1Routes());
        router.use('/v2', this.setupV2Routes());
        
        return router;
    }
    
    // V2 API Routes (Latest)
    setupV2Routes() {
        const v2Router = express.Router();
        
        // Container Tracking
        v2Router.get('/containers/:containerId', this.getContainer.bind(this));
        v2Router.get('/containers/:containerId/events', this.getContainerEvents.bind(this));
        v2Router.get('/containers/:containerId/documents', this.getContainerDocuments.bind(this));
        v2Router.post('/containers/:containerId/updates', this.updateContainer.bind(this));
        
        // Shipment Management
        v2Router.get('/shipments', this.listShipments.bind(this));
        v2Router.get('/shipments/:shipmentId', this.getShipment.bind(this));
        v2Router.post('/shipments', this.createShipment.bind(this));
        v2Router.put('/shipments/:shipmentId', this.updateShipment.bind(this));
        v2Router.post('/shipments/:shipmentId/documents', this.uploadDocument.bind(this));
        
        // Booking
        v2Router.post('/bookings/quote', this.getQuote.bind(this));
        v2Router.post('/bookings', this.createBooking.bind(this));
        v2Router.get('/bookings/:bookingId', this.getBooking.bind(this));
        v2Router.put('/bookings/:bookingId/confirm', this.confirmBooking.bind(this));
        v2Router.delete('/bookings/:bookingId', this.cancelBooking.bind(this));
        
        // Webhooks
        v2Router.get('/webhooks', this.listWebhooks.bind(this));
        v2Router.post('/webhooks', this.createWebhook.bind(this));
        v2Router.put('/webhooks/:webhookId', this.updateWebhook.bind(this));
        v2Router.delete('/webhooks/:webhookId', this.deleteWebhook.bind(this));
        v2Router.post('/webhooks/:webhookId/test', this.testWebhook.bind(this));
        
        // Analytics
        v2Router.get('/analytics/usage', this.getUsageAnalytics.bind(this));
        v2Router.get('/analytics/performance', this.getPerformanceAnalytics.bind(this));
        v2Router.get('/analytics/revenue', this.getRevenueAnalytics.bind(this));
        
        // Partner Management
        v2Router.get('/profile', this.getPartnerProfile.bind(this));
        v2Router.put('/profile', this.updatePartnerProfile.bind(this));
        v2Router.get('/integrations', this.listPartnerIntegrations.bind(this));
        v2Router.post('/integrations', this.createIntegration.bind(this));
        
        return v2Router;
    }
    
    // V1 API Routes (Legacy)
    setupV1Routes() {
        const v1Router = express.Router();
        
        // Basic container tracking
        v1Router.get('/track/:containerId', this.v1TrackContainer.bind(this));
        v1Router.get('/shipments', this.v1ListShipments.bind(this));
        
        return v1Router;
    }
    
    // Authentication middleware
    async authenticateRequest(req, res, next) {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        
        try {
            let authenticated = false;
            let partner = null;
            
            // OAuth2 Bearer token
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                partner = await this.validateOAuthToken(token);
                authenticated = !!partner;
            }
            // API Key authentication
            else if (apiKey) {
                partner = await this.validateAPIKey(apiKey);
                authenticated = !!partner;
            }
            
            if (!authenticated) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or missing authentication credentials'
                });
            }
            
            // Check rate limits
            const rateLimitOk = await this.checkRateLimit(partner, req.path);
            if (!rateLimitOk) {
                return res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded',
                    retryAfter: 3600
                });
            }
            
            req.partner = partner;
            next();
            
        } catch (error) {
            res.status(401).json({
                error: 'Unauthorized',
                message: error.message
            });
        }
    }
    
    // Container endpoints
    async getContainer(req, res) {
        try {
            const { containerId } = req.params;
            
            // Mock container data
            const container = {
                containerId,
                shipmentId: 'SHIP-2024-001',
                status: 'in_transit',
                location: {
                    port: 'SGSIN',
                    portName: 'Singapore',
                    latitude: 1.290270,
                    longitude: 103.851959,
                    updatedAt: new Date()
                },
                vessel: {
                    name: 'MAERSK COLUMBUS',
                    imo: '9619907',
                    voyage: 'W243'
                },
                origin: {
                    port: 'CNSHA',
                    portName: 'Shanghai',
                    departureDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                },
                destination: {
                    port: 'USOAK',
                    portName: 'Oakland',
                    eta: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                },
                milestones: [
                    { event: 'gate_in', location: 'CNSHA', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
                    { event: 'loaded', location: 'CNSHA', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    { event: 'departed', location: 'CNSHA', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    { event: 'transshipment', location: 'SGSIN', timestamp: new Date() }
                ],
                cargo: {
                    description: 'Electronics',
                    weight: 18500,
                    weightUnit: 'kg',
                    containerType: '40HC'
                }
            };
            
            // Log API usage
            await this.logAPIUsage(req.partner, 'getContainer', { containerId });
            
            res.json(container);
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getContainerEvents(req, res) {
        try {
            const { containerId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            
            // Mock events
            const events = [
                {
                    id: 'evt-001',
                    containerId,
                    type: 'status_change',
                    timestamp: new Date(),
                    data: {
                        previousStatus: 'at_port',
                        newStatus: 'in_transit',
                        location: 'SGSIN'
                    }
                },
                {
                    id: 'evt-002',
                    containerId,
                    type: 'location_update',
                    timestamp: new Date(Date.now() - 3600000),
                    data: {
                        latitude: 1.290270,
                        longitude: 103.851959,
                        speed: 18.5,
                        heading: 245
                    }
                }
            ];
            
            res.json({
                events,
                pagination: {
                    total: events.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: false
                }
            });
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    // Shipment endpoints
    async createShipment(req, res) {
        try {
            const shipmentData = req.body;
            
            // Validate shipment data
            const validation = this.validateShipmentData(shipmentData);
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Invalid shipment data',
                    details: validation.errors
                });
            }
            
            // Create shipment
            const shipment = {
                id: `SHIP-${Date.now()}`,
                partnerId: req.partner.id,
                reference: shipmentData.reference,
                status: 'draft',
                origin: shipmentData.origin,
                destination: shipmentData.destination,
                cargo: shipmentData.cargo,
                documents: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Emit webhook event
            await this.emitWebhookEvent('shipment.created', shipment, req.partner);
            
            res.status(201).json(shipment);
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    // Booking endpoints
    async getQuote(req, res) {
        try {
            const quoteRequest = req.body;
            
            // Generate quote based on request
            const quote = {
                id: `QUOTE-${Date.now()}`,
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
                origin: quoteRequest.origin,
                destination: quoteRequest.destination,
                cargo: quoteRequest.cargo,
                services: [
                    {
                        type: 'ocean-freight',
                        carrier: 'Maersk Line',
                        transitTime: 28,
                        price: {
                            amount: 2500,
                            currency: 'USD',
                            per: 'container'
                        },
                        schedule: {
                            departure: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                            arrival: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
                        }
                    },
                    {
                        type: 'ocean-freight-express',
                        carrier: 'Maersk Line',
                        transitTime: 21,
                        price: {
                            amount: 3200,
                            currency: 'USD',
                            per: 'container'
                        },
                        schedule: {
                            departure: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                            arrival: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000)
                        }
                    }
                ],
                additionalCharges: [
                    { type: 'documentation', amount: 150, currency: 'USD' },
                    { type: 'customs-clearance', amount: 350, currency: 'USD' }
                ]
            };
            
            res.json(quote);
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    // Webhook management
    async createWebhook(req, res) {
        try {
            const { url, events, secret } = req.body;
            
            // Validate webhook URL
            if (!this.isValidWebhookUrl(url)) {
                return res.status(400).json({
                    error: 'Invalid webhook URL'
                });
            }
            
            // Validate events
            const validEvents = events.filter(e => this.webhookEvents[e]);
            if (validEvents.length === 0) {
                return res.status(400).json({
                    error: 'No valid events specified'
                });
            }
            
            const webhook = {
                id: uuidv4(),
                partnerId: req.partner.id,
                url,
                events: validEvents,
                secret: secret || this.generateWebhookSecret(),
                status: 'active',
                createdAt: new Date(),
                lastDelivery: null,
                deliveryStats: {
                    successful: 0,
                    failed: 0
                }
            };
            
            // Store webhook (in production, this would be in database)
            req.partner.webhooks = req.partner.webhooks || [];
            req.partner.webhooks.push(webhook);
            
            res.status(201).json(webhook);
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async testWebhook(req, res) {
        try {
            const { webhookId } = req.params;
            
            // Send test event to webhook
            const testEvent = {
                id: 'test-event',
                type: 'test',
                timestamp: new Date(),
                data: {
                    message: 'This is a test webhook event'
                }
            };
            
            // In production, this would actually send the webhook
            res.json({
                success: true,
                event: testEvent,
                message: 'Test webhook sent successfully'
            });
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    // Analytics endpoints
    async getUsageAnalytics(req, res) {
        try {
            const { period = '30d' } = req.query;
            
            // Mock analytics data
            const analytics = {
                period,
                summary: {
                    totalRequests: 45678,
                    uniqueContainers: 1234,
                    activeShipments: 567,
                    apiCalls: {
                        tracking: 35000,
                        booking: 5000,
                        documents: 5678
                    }
                },
                daily: this.generateDailyAnalytics(30),
                topEndpoints: [
                    { endpoint: '/containers/:id', calls: 25000, avgResponseTime: 145 },
                    { endpoint: '/shipments', calls: 10000, avgResponseTime: 234 },
                    { endpoint: '/bookings/quote', calls: 5000, avgResponseTime: 567 }
                ],
                errorRate: 0.2,
                availability: 99.95
            };
            
            res.json(analytics);
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    async getRevenueAnalytics(req, res) {
        try {
            const { period = '30d' } = req.query;
            
            const revenue = {
                period,
                summary: {
                    totalRevenue: 15750.50,
                    pendingPayout: 3250.00,
                    lastPayout: {
                        amount: 12500.50,
                        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                },
                breakdown: {
                    transactionFees: 8500.00,
                    subscriptionShare: 5250.50,
                    bonuses: 2000.00
                },
                transactions: [
                    { date: new Date(), type: 'booking', amount: 125.00, status: 'completed' },
                    { date: new Date(), type: 'tracking', amount: 2.50, status: 'completed' }
                ]
            };
            
            res.json(revenue);
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    // Helper methods
    async validateOAuthToken(token) {
        // Mock OAuth validation
        if (token === 'valid-token') {
            return { id: 'partner-123', name: 'Test Partner' };
        }
        return null;
    }
    
    async validateAPIKey(apiKey) {
        // Mock API key validation
        if (apiKey === 'valid-api-key') {
            return { id: 'partner-123', name: 'Test Partner' };
        }
        return null;
    }
    
    async checkRateLimit(partner, endpoint) {
        // Simplified rate limiting
        return true;
    }
    
    async logAPIUsage(partner, endpoint, params) {
        // Log API usage for analytics
        console.log(`API Usage: ${partner.id} - ${endpoint}`, params);
    }
    
    validateShipmentData(data) {
        const errors = [];
        
        if (!data.origin || !data.origin.port) {
            errors.push('Origin port is required');
        }
        if (!data.destination || !data.destination.port) {
            errors.push('Destination port is required');
        }
        if (!data.cargo || !data.cargo.type) {
            errors.push('Cargo type is required');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    isValidWebhookUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    generateWebhookSecret() {
        return 'whsec_' + Buffer.from(Math.random().toString()).toString('base64');
    }
    
    async emitWebhookEvent(eventType, data, partner) {
        // In production, this would send webhooks to registered URLs
        console.log(`Webhook event: ${eventType}`, data);
    }
    
    generateDailyAnalytics(days) {
        const analytics = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            analytics.push({
                date: date.toISOString().split('T')[0],
                requests: Math.floor(Math.random() * 2000) + 1000,
                containers: Math.floor(Math.random() * 100) + 50,
                revenue: Math.random() * 1000 + 200
            });
        }
        return analytics;
    }
    
    // V1 compatibility methods
    async v1TrackContainer(req, res) {
        // Redirect to V2 endpoint
        this.getContainer(req, res);
    }
    
    async v1ListShipments(req, res) {
        res.json({
            message: 'This endpoint is deprecated. Please use /v2/shipments',
            deprecation: {
                sunset: '2025-01-01',
                migration: 'https://developers.rootuip.com/migration/v1-to-v2'
            }
        });
    }
    
    // Get endpoint definitions
    getV2Endpoints() {
        return {
            containers: {
                'GET /containers/:containerId': 'Get container details',
                'GET /containers/:containerId/events': 'Get container events',
                'GET /containers/:containerId/documents': 'Get container documents',
                'POST /containers/:containerId/updates': 'Update container status'
            },
            shipments: {
                'GET /shipments': 'List shipments',
                'GET /shipments/:shipmentId': 'Get shipment details',
                'POST /shipments': 'Create shipment',
                'PUT /shipments/:shipmentId': 'Update shipment',
                'POST /shipments/:shipmentId/documents': 'Upload document'
            },
            bookings: {
                'POST /bookings/quote': 'Get shipping quote',
                'POST /bookings': 'Create booking',
                'GET /bookings/:bookingId': 'Get booking details',
                'PUT /bookings/:bookingId/confirm': 'Confirm booking',
                'DELETE /bookings/:bookingId': 'Cancel booking'
            },
            webhooks: {
                'GET /webhooks': 'List webhooks',
                'POST /webhooks': 'Create webhook',
                'PUT /webhooks/:webhookId': 'Update webhook',
                'DELETE /webhooks/:webhookId': 'Delete webhook',
                'POST /webhooks/:webhookId/test': 'Test webhook'
            }
        };
    }
    
    getV1Endpoints() {
        return {
            tracking: {
                'GET /track/:containerId': 'Track container (deprecated)'
            },
            shipments: {
                'GET /shipments': 'List shipments (deprecated)'
            }
        };
    }
}

module.exports = PartnerAPI;