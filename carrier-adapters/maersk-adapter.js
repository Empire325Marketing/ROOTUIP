// Maersk Line API Adapter
// Production-ready integration with Maersk API using OAuth 2.0

const axios = require('axios');
const BaseCarrierAdapter = require('./base-adapter');

class MaerskAdapter extends BaseCarrierAdapter {
    constructor(config) {
        super({
            carrierCode: 'MAEU',
            carrierName: 'Maersk Line',
            apiVersion: 'v1',
            rateLimit: { requests: 50, period: 60000 }, // 50 requests per minute
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 2000,
            ...config
        });
        
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.oauthUrl = config.oauthUrl || 'https://api.maersk.com/oauth2/access_token';
        this.apiBaseUrl = config.apiBaseUrl || 'https://api.maersk.com';
        
        // Maersk-specific endpoints
        this.endpoints = {
            oauth: '/oauth2/access_token',
            tracking: '/track/v1/containers',
            shipments: '/track/v1/shipments',
            schedules: '/schedules/v1/point-to-point',
            ports: '/locations/v1/ports',
            vessels: '/vessels/v1/vessels'
        };
        
        this.validateConfig();
    }
    
    validateConfig() {
        super.validateConfig();
        
        if (!this.clientId || !this.clientSecret) {
            throw new Error('Maersk adapter requires clientId and clientSecret');
        }
    }
    
    async authenticate(credentials = {}) {
        await this.checkRateLimit();
        
        const startTime = Date.now();
        
        try {
            const authPayload = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: credentials.clientId || this.clientId,
                client_secret: credentials.clientSecret || this.clientSecret
            });
            
            const response = await axios.post(this.oauthUrl, authPayload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            });
            
            const authData = {
                access_token: response.data.access_token,
                token_type: response.data.token_type || 'Bearer',
                expires_in: response.data.expires_in || 3600,
                expires_at: Date.now() + ((response.data.expires_in || 3600) * 1000),
                scope: response.data.scope,
                timestamp: Date.now()
            };
            
            // Cache the token
            await this.cacheAuthToken(authData);
            
            this.logRequest('POST', this.oauthUrl, true, Date.now() - startTime);
            
            return authData;
            
        } catch (error) {
            this.logRequest('POST', this.oauthUrl, false, Date.now() - startTime, error);
            this.handleAPIError(error, 'authentication');
        }
    }
    
    async trackContainer(containerNumber, authData) {
        const validatedContainerNumber = this.validateContainerNumber(containerNumber);
        this.validateAuthData(authData);
        await this.checkRateLimit();
        
        const startTime = Date.now();
        const trackingUrl = `${this.apiBaseUrl}${this.endpoints.tracking}/${validatedContainerNumber}`;
        
        try {
            const response = await axios.get(trackingUrl, {
                headers: {
                    'Authorization': `${authData.token_type} ${authData.access_token}`,
                    'Accept': 'application/json',
                    'Consumer-Key': this.clientId
                },
                timeout: this.timeout
            });
            
            this.logRequest('GET', trackingUrl, true, Date.now() - startTime);
            
            return response.data;
            
        } catch (error) {
            this.logRequest('GET', trackingUrl, false, Date.now() - startTime, error);
            this.handleAPIError(error, 'container_tracking');
        }
    }
    
    async trackShipment(shipmentId, authData) {
        this.validateAuthData(authData);
        await this.checkRateLimit();
        
        const startTime = Date.now();
        const shipmentUrl = `${this.apiBaseUrl}${this.endpoints.shipments}/${shipmentId}`;
        
        try {
            const response = await axios.get(shipmentUrl, {
                headers: {
                    'Authorization': `${authData.token_type} ${authData.access_token}`,
                    'Accept': 'application/json',
                    'Consumer-Key': this.clientId
                },
                timeout: this.timeout
            });
            
            this.logRequest('GET', shipmentUrl, true, Date.now() - startTime);
            
            return response.data;
            
        } catch (error) {
            this.logRequest('GET', shipmentUrl, false, Date.now() - startTime, error);
            this.handleAPIError(error, 'shipment_tracking');
        }
    }
    
    async getSchedules(fromPort, toPort, authData, params = {}) {
        this.validateAuthData(authData);
        await this.checkRateLimit();
        
        const startTime = Date.now();
        const scheduleUrl = `${this.apiBaseUrl}${this.endpoints.schedules}`;
        
        const queryParams = new URLSearchParams({
            fromPort,
            toPort,
            ...params
        });
        
        try {
            const response = await axios.get(`${scheduleUrl}?${queryParams}`, {
                headers: {
                    'Authorization': `${authData.token_type} ${authData.access_token}`,
                    'Accept': 'application/json',
                    'Consumer-Key': this.clientId
                },
                timeout: this.timeout
            });
            
            this.logRequest('GET', scheduleUrl, true, Date.now() - startTime);
            
            return response.data;
            
        } catch (error) {
            this.logRequest('GET', scheduleUrl, false, Date.now() - startTime, error);
            this.handleAPIError(error, 'schedule_query');
        }
    }
    
    normalizeData(rawData) {
        const normalized = this.createStandardResponse();
        
        try {
            // Basic container information
            normalized.containerNumber = rawData.containerNumber || rawData.container_number;
            normalized.status = this.mapStatus(rawData.transportStatus || rawData.status);
            
            // Location information
            if (rawData.currentLocation) {
                normalized.currentLocation = this.formatLocation(rawData.currentLocation);
            }
            
            // Vessel information
            normalized.vesselName = rawData.vesselName;
            normalized.voyageNumber = rawData.voyageNumber;
            
            // Port information
            if (rawData.portOfLoading) {
                normalized.portOfLoading = this.formatLocation(rawData.portOfLoading);
            }
            if (rawData.portOfDischarge) {
                normalized.portOfDischarge = this.formatLocation(rawData.portOfDischarge);
            }
            if (rawData.finalDestination) {
                normalized.finalDestination = this.formatLocation(rawData.finalDestination);
            }
            
            // Dates
            normalized.estimatedArrival = this.parseDate(rawData.estimatedTimeOfArrival);
            normalized.actualArrival = this.parseDate(rawData.actualTimeOfArrival);
            
            // Events
            if (rawData.events && Array.isArray(rawData.events)) {
                normalized.events = rawData.events.map(event => this.normalizeEvent(event));
            }
            
            // Free time and charges
            normalized.freeDaysRemaining = rawData.freeDaysRemaining || 0;
            normalized.detentionCharges = this.parseAmount(rawData.detentionCharges);
            normalized.demurrageCharges = this.parseAmount(rawData.demurrageCharges);
            normalized.totalCharges = normalized.detentionCharges + normalized.demurrageCharges;
            
            // Risk assessment
            normalized.riskFactors = this.assessRiskFactors(rawData);
            
            // Update metadata
            normalized.metadata.lastUpdate = new Date().toISOString();
            normalized.metadata.originalData = rawData;
            
            return normalized;
            
        } catch (error) {
            this.logger.error('Data normalization error', {
                carrier: this.carrierCode,
                error: error.message,
                rawData: JSON.stringify(rawData).substring(0, 500)
            });
            
            // Return basic structure with error indication
            normalized.status = 'Data Error';
            normalized.metadata.error = error.message;
            return normalized;
        }
    }
    
    mapStatus(transportStatus) {
        const statusMap = {
            'IN_TRANSIT': 'In Transit',
            'AT_PORT': 'At Port',
            'DELIVERED': 'Delivered',
            'LOADING': 'Loading',
            'DISCHARGED': 'Discharged',
            'EMPTY_RETURNED': 'Empty Returned',
            'GATED_OUT': 'Gated Out',
            'GATED_IN': 'Gated In',
            'CUSTOMS_HOLD': 'Customs Hold',
            'AVAILABLE_FOR_PICKUP': 'Available for Pickup'
        };
        
        return statusMap[transportStatus] || transportStatus || 'Unknown';
    }
    
    formatLocation(locationData) {
        if (typeof locationData === 'string') {
            return locationData;
        }
        
        if (locationData && typeof locationData === 'object') {
            const parts = [
                locationData.description,
                locationData.city,
                locationData.country
            ].filter(Boolean);
            
            return parts.join(', ');
        }
        
        return null;
    }
    
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date.toISOString();
        } catch (error) {
            return null;
        }
    }
    
    parseAmount(amount) {
        if (typeof amount === 'number') return amount;
        if (typeof amount === 'string') {
            const parsed = parseFloat(amount.replace(/[^0-9.-]/g, ''));
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }
    
    normalizeEvent(eventData) {
        return this.createStandardEvent({
            type: this.mapEventType(eventData.eventType),
            description: eventData.description || eventData.eventDescription,
            location: this.formatLocation(eventData.location),
            timestamp: this.parseDate(eventData.eventDateTime || eventData.timestamp),
            facilityCode: eventData.facilityCode,
            transportMode: eventData.transportMode,
            metadata: {
                maerskEventType: eventData.eventType,
                vesselName: eventData.vesselName,
                voyageNumber: eventData.voyageNumber,
                facilityTypeCode: eventData.facilityTypeCode,
                documentTypeCode: eventData.documentTypeCode
            }
        });
    }
    
    mapEventType(maerskEventType) {
        const eventMap = {
            'LOAD': 'loaded',
            'DISC': 'discharged',
            'GATE-OUT': 'gated_out',
            'GATE-IN': 'gated_in',
            'DEPART': 'departed',
            'ARRIVE': 'arrived',
            'CUSTOMS': 'customs_clearance',
            'DELAY': 'delayed'
        };
        
        return eventMap[maerskEventType] || maerskEventType?.toLowerCase() || 'unknown';
    }
    
    assessRiskFactors(rawData) {
        const riskFactors = {
            portCongestion: 'unknown',
            weatherDelay: false,
            vesselDelay: false,
            customsIssues: false
        };
        
        // Analyze events for risk indicators
        if (rawData.events && Array.isArray(rawData.events)) {
            const delayEvents = rawData.events.filter(event => 
                event.eventType === 'DELAY' || 
                event.description?.toLowerCase().includes('delay')
            );
            
            riskFactors.vesselDelay = delayEvents.length > 0;
            
            const customsEvents = rawData.events.filter(event =>
                event.eventType === 'CUSTOMS' ||
                event.description?.toLowerCase().includes('customs') ||
                event.description?.toLowerCase().includes('hold')
            );
            
            riskFactors.customsIssues = customsEvents.length > 0;
        }
        
        // Assess port congestion based on location and delays
        if (rawData.currentLocation) {
            const location = rawData.currentLocation.description || rawData.currentLocation;
            const congestedPorts = ['Los Angeles', 'Long Beach', 'Shanghai', 'Rotterdam'];
            
            if (congestedPorts.some(port => location.includes(port))) {
                riskFactors.portCongestion = 'medium';
            }
        }
        
        // Check for weather-related delays
        if (rawData.events) {
            const weatherEvents = rawData.events.filter(event =>
                event.description?.toLowerCase().includes('weather') ||
                event.description?.toLowerCase().includes('storm')
            );
            
            riskFactors.weatherDelay = weatherEvents.length > 0;
        }
        
        return riskFactors;
    }
    
    async executeRequest(url, options) {
        return await axios.request({
            url,
            ...options
        });
    }
    
    async testConnectivity() {
        try {
            // Test basic connectivity to Maersk API
            const response = await axios.get(`${this.apiBaseUrl}/health`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            // If health endpoint doesn't exist, try OAuth endpoint
            try {
                const response = await axios.options(this.oauthUrl, {
                    timeout: 5000
                });
                return true;
            } catch (optionsError) {
                throw new Error('Cannot connect to Maersk API');
            }
        }
    }
    
    isSupported() {
        return !!(this.clientId && this.clientSecret);
    }
    
    getCapabilities() {
        return {
            tracking: true,
            shipmentTracking: true,
            schedules: true,
            realTimeUpdates: true,
            eventHistory: true,
            riskAssessment: true,
            authentication: 'oauth2',
            rateLimit: this.rateLimit
        };
    }
    
    async getPortInformation(portCode, authData) {
        this.validateAuthData(authData);
        await this.checkRateLimit();
        
        const startTime = Date.now();
        const portUrl = `${this.apiBaseUrl}${this.endpoints.ports}/${portCode}`;
        
        try {
            const response = await axios.get(portUrl, {
                headers: {
                    'Authorization': `${authData.token_type} ${authData.access_token}`,
                    'Accept': 'application/json',
                    'Consumer-Key': this.clientId
                },
                timeout: this.timeout
            });
            
            this.logRequest('GET', portUrl, true, Date.now() - startTime);
            
            return response.data;
            
        } catch (error) {
            this.logRequest('GET', portUrl, false, Date.now() - startTime, error);
            this.handleAPIError(error, 'port_information');
        }
    }
    
    async getVesselInformation(vesselName, authData) {
        this.validateAuthData(authData);
        await this.checkRateLimit();
        
        const startTime = Date.now();
        const vesselUrl = `${this.apiBaseUrl}${this.endpoints.vessels}`;
        
        try {
            const response = await axios.get(`${vesselUrl}?vesselName=${encodeURIComponent(vesselName)}`, {
                headers: {
                    'Authorization': `${authData.token_type} ${authData.access_token}`,
                    'Accept': 'application/json',
                    'Consumer-Key': this.clientId
                },
                timeout: this.timeout
            });
            
            this.logRequest('GET', vesselUrl, true, Date.now() - startTime);
            
            return response.data;
            
        } catch (error) {
            this.logRequest('GET', vesselUrl, false, Date.now() - startTime, error);
            this.handleAPIError(error, 'vessel_information');
        }
    }
}

module.exports = MaerskAdapter;