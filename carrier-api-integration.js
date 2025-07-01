// ROOTUIP Carrier API Integration Framework
// Real-time container tracking with OAuth 2.0 authentication

const express = require('express');
const axios = require('axios');
const Redis = require('redis');
const { Pool } = require('pg');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class CarrierAPIIntegration {
    constructor() {
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/carrier-api.log' }),
                new winston.transports.Console()
            ]
        });
        
        this.carrierAdapters = new Map();
        this.activeConnections = new Set();
        this.syncInterval = 30000; // 30 seconds
        
        this.initializeCarriers();
        this.startRealTimeSync();
    }
    
    initializeCarriers() {
        // Initialize Maersk adapter
        this.carrierAdapters.set('MAEU', new MaerskAdapter({
            clientId: process.env.MAERSK_CLIENT_ID,
            clientSecret: process.env.MAERSK_CLIENT_SECRET,
            oauthUrl: process.env.MAERSK_OAUTH_URL,
            apiBaseUrl: process.env.MAERSK_API_BASE_URL,
            redis: this.redis,
            logger: this.logger
        }));
        
        // Initialize MSC adapter (placeholder for future implementation)
        this.carrierAdapters.set('MSC', new MSCAdapter({
            redis: this.redis,
            logger: this.logger
        }));
        
        // Initialize CMA CGM adapter (placeholder)
        this.carrierAdapters.set('CMACGM', new CMAAdapter({
            redis: this.redis,
            logger: this.logger
        }));
        
        // Initialize Hapag-Lloyd adapter (placeholder)
        this.carrierAdapters.set('HAPAG', new HapagAdapter({
            redis: this.redis,
            logger: this.logger
        }));
    }
    
    async authenticateCarrier(carrierCode, credentials) {
        const adapter = this.carrierAdapters.get(carrierCode);
        if (!adapter) {
            throw new Error(`Carrier ${carrierCode} not supported`);
        }
        
        try {
            const result = await adapter.authenticate(credentials);
            await this.storeCarrierAuth(carrierCode, result);
            this.logger.info(`Successfully authenticated with ${carrierCode}`);
            return result;
        } catch (error) {
            this.logger.error(`Authentication failed for ${carrierCode}:`, error);
            throw error;
        }
    }
    
    async storeCarrierAuth(carrierCode, authData) {
        const key = `carrier_auth:${carrierCode}`;
        await this.redis.setex(key, authData.expires_in || 3600, JSON.stringify(authData));
    }
    
    async getCarrierAuth(carrierCode) {
        const key = `carrier_auth:${carrierCode}`;
        const authData = await this.redis.get(key);
        return authData ? JSON.parse(authData) : null;
    }
    
    async trackContainer(containerNumber, carrierCode) {
        const adapter = this.carrierAdapters.get(carrierCode);
        if (!adapter) {
            throw new Error(`Carrier ${carrierCode} not supported`);
        }
        
        try {
            // Check cache first
            const cacheKey = `container:${carrierCode}:${containerNumber}`;
            const cachedData = await this.redis.get(cacheKey);
            
            if (cachedData) {
                const data = JSON.parse(cachedData);
                if (Date.now() - data.timestamp < 300000) { // 5 minutes cache
                    return data.tracking;
                }
            }
            
            // Fetch fresh data
            const authData = await this.getCarrierAuth(carrierCode);
            if (!authData) {
                throw new Error(`No authentication found for ${carrierCode}`);
            }
            
            const trackingData = await adapter.trackContainer(containerNumber, authData);
            const normalizedData = this.normalizeTrackingData(trackingData, carrierCode);
            
            // Cache the result
            await this.redis.setex(cacheKey, 300, JSON.stringify({
                tracking: normalizedData,
                timestamp: Date.now()
            }));
            
            // Store in database
            await this.updateContainerInDatabase(containerNumber, normalizedData);
            
            return normalizedData;
        } catch (error) {
            this.logger.error(`Container tracking failed for ${containerNumber} on ${carrierCode}:`, error);
            throw error;
        }
    }
    
    normalizeTrackingData(rawData, carrierCode) {
        const adapter = this.carrierAdapters.get(carrierCode);
        return adapter.normalizeData(rawData);
    }
    
    async updateContainerInDatabase(containerNumber, trackingData) {
        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Update container record
            const updateQuery = `
                UPDATE containers 
                SET 
                    status = $1,
                    current_location = $2,
                    estimated_arrival = $3,
                    vessel_name = $4,
                    voyage_number = $5,
                    port_of_loading = $6,
                    port_of_discharge = $7,
                    last_api_update = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE container_number = $8
            `;
            
            await client.query(updateQuery, [
                trackingData.status,
                trackingData.currentLocation,
                trackingData.estimatedArrival,
                trackingData.vesselName,
                trackingData.voyageNumber,
                trackingData.portOfLoading,
                trackingData.portOfDischarge,
                containerNumber
            ]);
            
            // Insert container events
            if (trackingData.events && trackingData.events.length > 0) {
                for (const event of trackingData.events) {
                    const eventQuery = `
                        INSERT INTO container_events 
                        (container_id, event_type, event_description, location, event_timestamp, carrier_reported, metadata)
                        VALUES ((SELECT id FROM containers WHERE container_number = $1), $2, $3, $4, $5, true, $6)
                        ON CONFLICT (container_id, event_timestamp, event_type) DO NOTHING
                    `;
                    
                    await client.query(eventQuery, [
                        containerNumber,
                        event.type,
                        event.description,
                        event.location,
                        event.timestamp,
                        JSON.stringify(event.metadata || {})
                    ]);
                }
            }
            
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    async startRealTimeSync() {
        this.logger.info('Starting real-time container synchronization');
        
        setInterval(async () => {
            try {
                const activeContainers = await this.getActiveContainers();
                
                for (const container of activeContainers) {
                    if (this.activeConnections.has(container.container_number)) {
                        continue; // Already being processed
                    }
                    
                    this.activeConnections.add(container.container_number);
                    
                    // Process in background
                    this.processContainerUpdate(container)
                        .catch(error => {
                            this.logger.error(`Failed to update container ${container.container_number}:`, error);
                        })
                        .finally(() => {
                            this.activeConnections.delete(container.container_number);
                        });
                }
            } catch (error) {
                this.logger.error('Real-time sync error:', error);
            }
        }, this.syncInterval);
    }
    
    async getActiveContainers() {
        const query = `
            SELECT container_number, carrier_code, company_id
            FROM containers 
            WHERE status IN ('In Transit', 'At Port', 'Loading', 'Discharged')
            AND last_api_update < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
            ORDER BY estimated_arrival ASC
            LIMIT 100
        `;
        
        const result = await this.db.query(query);
        return result.rows;
    }
    
    async processContainerUpdate(container) {
        try {
            const trackingData = await this.trackContainer(
                container.container_number, 
                container.carrier_code
            );
            
            // Check for alerts
            await this.checkForAlerts(container, trackingData);
            
            // Emit real-time update
            this.emitRealtimeUpdate(container.company_id, container.container_number, trackingData);
            
        } catch (error) {
            this.logger.error(`Container update failed for ${container.container_number}:`, error);
        }
    }
    
    async checkForAlerts(container, trackingData) {
        const riskFactors = this.calculateRiskFactors(trackingData);
        
        if (riskFactors.detentionRisk > 70) {
            await this.createAlert(container, 'detention_risk', 'high', 
                `High detention risk detected for container ${container.container_number}`, 
                riskFactors.estimatedCost);
        }
        
        if (riskFactors.demurrageRisk > 70) {
            await this.createAlert(container, 'demurrage_risk', 'high',
                `High demurrage risk detected for container ${container.container_number}`,
                riskFactors.estimatedCost);
        }
        
        if (trackingData.delayDays > 2) {
            await this.createAlert(container, 'delay', 'medium',
                `Container ${container.container_number} delayed by ${trackingData.delayDays} days`,
                0);
        }
    }
    
    calculateRiskFactors(trackingData) {
        // AI-based risk calculation logic
        let detentionRisk = 0;
        let demurrageRisk = 0;
        let estimatedCost = 0;
        
        // Port congestion factor
        if (trackingData.portCongestion === 'high') {
            detentionRisk += 30;
            demurrageRisk += 25;
        }
        
        // Weather delay factor
        if (trackingData.weatherDelay) {
            detentionRisk += 20;
            demurrageRisk += 15;
        }
        
        // Free days remaining
        const freeDaysRemaining = trackingData.freeDaysRemaining || 0;
        if (freeDaysRemaining <= 1) {
            detentionRisk += 40;
            demurrageRisk += 35;
        }
        
        // Estimate costs based on risk
        if (detentionRisk > 60) {
            estimatedCost += 15000; // Average detention cost
        }
        if (demurrageRisk > 60) {
            estimatedCost += 20000; // Average demurrage cost
        }
        
        return {
            detentionRisk: Math.min(detentionRisk, 100),
            demurrageRisk: Math.min(demurrageRisk, 100),
            estimatedCost
        };
    }
    
    async createAlert(container, alertType, severity, message, estimatedCost) {
        const query = `
            INSERT INTO alerts (company_id, container_id, alert_type, severity, title, message, potential_cost, status)
            VALUES ($1, (SELECT id FROM containers WHERE container_number = $2), $3, $4, $5, $6, $7, 'active')
            ON CONFLICT (company_id, container_id, alert_type) 
            DO UPDATE SET 
                severity = EXCLUDED.severity,
                message = EXCLUDED.message,
                potential_cost = EXCLUDED.potential_cost,
                created_at = CURRENT_TIMESTAMP
        `;
        
        await this.db.query(query, [
            container.company_id,
            container.container_number,
            alertType,
            severity,
            `${severity.toUpperCase()}: ${alertType.replace('_', ' ')}`,
            message,
            estimatedCost
        ]);
    }
    
    emitRealtimeUpdate(companyId, containerNumber, trackingData) {
        // WebSocket emission logic would go here
        // For now, we'll cache the update for WebSocket clients
        const updateData = {
            type: 'container_update',
            companyId,
            containerNumber,
            data: trackingData,
            timestamp: Date.now()
        };
        
        this.redis.publish(`company:${companyId}:updates`, JSON.stringify(updateData));
    }
    
    // API Routes
    setupRoutes(app) {
        // Rate limiting
        const apiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        
        app.use('/api/carriers', apiLimiter);
        app.use('/api/carriers', helmet());
        
        // Authenticate with carrier
        app.post('/api/carriers/:carrierCode/auth', async (req, res) => {
            try {
                const { carrierCode } = req.params;
                const credentials = req.body;
                
                const result = await this.authenticateCarrier(carrierCode, credentials);
                res.json({ success: true, data: result });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });
        
        // Track container
        app.get('/api/carriers/:carrierCode/track/:containerNumber', async (req, res) => {
            try {
                const { carrierCode, containerNumber } = req.params;
                
                const trackingData = await this.trackContainer(containerNumber, carrierCode);
                res.json({ success: true, data: trackingData });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });
        
        // Get carrier status
        app.get('/api/carriers/status', async (req, res) => {
            try {
                const status = {};
                
                for (const [code, adapter] of this.carrierAdapters) {
                    const authData = await this.getCarrierAuth(code);
                    status[code] = {
                        connected: !!authData,
                        lastAuth: authData?.timestamp || null,
                        supported: adapter.isSupported()
                    };
                }
                
                res.json({ success: true, data: status });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        // Manual sync trigger
        app.post('/api/carriers/sync/:containerNumber', async (req, res) => {
            try {
                const { containerNumber } = req.params;
                
                // Get container info
                const containerQuery = 'SELECT * FROM containers WHERE container_number = $1';
                const containerResult = await this.db.query(containerQuery, [containerNumber]);
                
                if (containerResult.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Container not found' });
                }
                
                const container = containerResult.rows[0];
                await this.processContainerUpdate(container);
                
                res.json({ success: true, message: 'Sync initiated' });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });
    }
}

// Maersk API Adapter
class MaerskAdapter {
    constructor(config) {
        this.config = config;
        this.redis = config.redis;
        this.logger = config.logger;
    }
    
    async authenticate(credentials) {
        try {
            const authResponse = await axios.post(this.config.oauthUrl, {
                grant_type: 'client_credentials',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            return {
                access_token: authResponse.data.access_token,
                expires_in: authResponse.data.expires_in,
                timestamp: Date.now()
            };
        } catch (error) {
            throw new Error(`Maersk authentication failed: ${error.message}`);
        }
    }
    
    async trackContainer(containerNumber, authData) {
        try {
            const response = await axios.get(
                `${this.config.apiBaseUrl}/track/v1/containers/${containerNumber}`,
                {
                    headers: {
                        'Authorization': `Bearer ${authData.access_token}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            return response.data;
        } catch (error) {
            throw new Error(`Maersk tracking failed: ${error.message}`);
        }
    }
    
    normalizeData(rawData) {
        // Convert Maersk API response to standard format
        return {
            status: this.mapStatus(rawData.transportStatus),
            currentLocation: rawData.currentLocation?.description || '',
            estimatedArrival: rawData.estimatedTimeOfArrival,
            vesselName: rawData.vesselName,
            voyageNumber: rawData.voyageNumber,
            portOfLoading: rawData.portOfLoading?.description,
            portOfDischarge: rawData.portOfDischarge?.description,
            events: rawData.events?.map(event => ({
                type: event.eventType,
                description: event.description,
                location: event.location?.description,
                timestamp: event.eventDateTime,
                metadata: {
                    facilityCode: event.facilityCode,
                    transportMode: event.transportMode
                }
            })) || [],
            freeDaysRemaining: rawData.freeDaysRemaining || 0,
            portCongestion: this.assessPortCongestion(rawData),
            weatherDelay: this.checkWeatherDelay(rawData),
            delayDays: this.calculateDelayDays(rawData)
        };
    }
    
    mapStatus(transportStatus) {
        const statusMap = {
            'IN_TRANSIT': 'In Transit',
            'AT_PORT': 'At Port',
            'DELIVERED': 'Delivered',
            'LOADING': 'Loading',
            'DISCHARGED': 'Discharged'
        };
        return statusMap[transportStatus] || transportStatus;
    }
    
    assessPortCongestion(rawData) {
        // Logic to assess port congestion based on delays and events
        return 'medium'; // Placeholder
    }
    
    checkWeatherDelay(rawData) {
        // Check for weather-related delays in events
        return false; // Placeholder
    }
    
    calculateDelayDays(rawData) {
        // Calculate delay based on original vs current ETA
        return 0; // Placeholder
    }
    
    isSupported() {
        return true;
    }
}

// Placeholder adapters for other carriers
class MSCAdapter {
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
    }
    
    async authenticate() {
        throw new Error('MSC API integration not yet implemented');
    }
    
    async trackContainer() {
        throw new Error('MSC API integration not yet implemented');
    }
    
    normalizeData(rawData) {
        return rawData;
    }
    
    isSupported() {
        return false;
    }
}

class CMAAdapter {
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
    }
    
    async authenticate() {
        throw new Error('CMA CGM API integration not yet implemented');
    }
    
    async trackContainer() {
        throw new Error('CMA CGM API integration not yet implemented');
    }
    
    normalizeData(rawData) {
        return rawData;
    }
    
    isSupported() {
        return false;
    }
}

class HapagAdapter {
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
    }
    
    async authenticate() {
        throw new Error('Hapag-Lloyd API integration not yet implemented');
    }
    
    async trackContainer() {
        throw new Error('Hapag-Lloyd API integration not yet implemented');
    }
    
    normalizeData(rawData) {
        return rawData;
    }
    
    isSupported() {
        return false;
    }
}

module.exports = CarrierAPIIntegration;