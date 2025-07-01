// ROOTUIP Container Tracking - Maersk API Integration
// Real Maersk Track & Trace API integration

const BaseCarrierAdapter = require('./base-carrier-adapter');

class MaerskAdapter extends BaseCarrierAdapter {
    constructor(config) {
        super({
            carrierCode: 'MAEU',
            apiBaseUrl: 'https://api.maersk.com',
            ...config
        });
        
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async addAuthentication(config) {
        // Ensure we have a valid access token
        await this.ensureValidToken();
        
        if (this.accessToken) {
            config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        
        return config;
    }

    async ensureValidToken() {
        // Check if token is still valid (with 5 minute buffer)
        if (this.accessToken && this.tokenExpiry && (this.tokenExpiry - Date.now() > 300000)) {
            return;
        }

        // Get new access token
        try {
            const tokenResponse = await this.client.post('/api/oauth2/access_token', {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = tokenResponse.data.access_token;
            this.tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);
            
            console.log(`[MAEU] Access token refreshed, expires in ${tokenResponse.data.expires_in} seconds`);
        } catch (error) {
            console.error('[MAEU] Failed to get access token:', error);
            throw new Error('Maersk authentication failed');
        }
    }

    async trackContainer(containerNumber) {
        const validation = this.validateContainerNumber(containerNumber);
        if (!validation.valid) {
            throw new Error(`Invalid container number: ${validation.message}`);
        }

        try {
            const response = await this.client.get(`/api/track-and-trace/container/${validation.normalized}`);
            return this.formatMaerskResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Container ${containerNumber} not found in Maersk system`);
            }
            throw error;
        }
    }

    async trackBillOfLading(blNumber) {
        if (!blNumber || blNumber.trim().length === 0) {
            throw new Error('Bill of Lading number is required');
        }

        try {
            const response = await this.client.get(`/api/track-and-trace/bill-of-lading/${blNumber.trim()}`);
            return this.formatMaerskResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Bill of Lading ${blNumber} not found in Maersk system`);
            }
            throw error;
        }
    }

    async getVesselSchedule(vesselName, voyageNumber) {
        try {
            const params = { vessel_name: vesselName };
            if (voyageNumber) {
                params.voyage_number = voyageNumber;
            }

            const response = await this.client.get('/api/vessel-schedules', { params });
            return this.formatVesselSchedule(response.data);
        } catch (error) {
            throw error;
        }
    }

    async subscribeToUpdates(containerNumber, webhookUrl) {
        const validation = this.validateContainerNumber(containerNumber);
        if (!validation.valid) {
            throw new Error(`Invalid container number: ${validation.message}`);
        }

        try {
            const response = await this.client.post('/api/track-and-trace/subscriptions', {
                containerNumber: validation.normalized,
                webhookUrl: webhookUrl,
                eventTypes: ['ALL']
            });

            return {
                subscriptionId: response.data.subscriptionId,
                containerNumber: validation.normalized,
                webhookUrl: webhookUrl,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            throw error;
        }
    }

    formatMaerskResponse(data) {
        // Handle different response formats from Maersk API
        const containerData = data.containers?.[0] || data;
        
        return this.formatTrackingResponse({
            containerNumber: containerData.containerNumber || containerData.equipment?.equipmentNumber,
            containerSize: containerData.equipment?.ISOEquipmentCode?.slice(0, 2),
            containerType: containerData.equipment?.ISOEquipmentCode,
            status: containerData.transportEvents?.[0]?.eventType || containerData.status,
            
            currentLocation: {
                name: this.getCurrentLocation(containerData)?.locationName,
                code: this.getCurrentLocation(containerData)?.UNLocationCode,
                country: this.getCurrentLocation(containerData)?.countryCode,
                facility: this.getCurrentLocation(containerData)?.facilityCode
            },
            
            destination: {
                name: containerData.destinationLocation?.locationName,
                code: containerData.destinationLocation?.UNLocationCode,
                country: containerData.destinationLocation?.countryCode
            },
            
            vesselName: containerData.vessel?.vesselName || containerData.transportMode?.vesselName,
            vesselIMO: containerData.vessel?.vesselIMONumber,
            voyageNumber: containerData.voyage?.voyageNumber,
            
            events: this.formatMaerskEvents(containerData.transportEvents || []),
            estimatedArrival: containerData.estimatedTimeOfArrival,
            actualArrival: containerData.actualTimeOfArrival,
            lastUpdated: containerData.updatedDateTime || new Date().toISOString()
        });
    }

    getCurrentLocation(containerData) {
        // Get the most recent transport event to determine current location
        const events = containerData.transportEvents || [];
        if (events.length === 0) return null;

        // Sort by event date and get the most recent
        const sortedEvents = events.sort((a, b) => new Date(b.eventDateTime) - new Date(a.eventDateTime));
        return sortedEvents[0].location;
    }

    formatMaerskEvents(events) {
        return events.map(event => ({
            timestamp: event.eventDateTime,
            status: event.eventType,
            location: {
                name: event.location?.locationName,
                code: event.location?.UNLocationCode,
                country: event.location?.countryCode
            },
            vessel: event.transportMode?.vesselName,
            description: event.eventTypeDescription || event.description,
            facilityCode: event.location?.facilityCode,
            delayReason: event.delayReasonCode
        }));
    }

    formatVesselSchedule(data) {
        const schedules = data.vesselSchedules || [data];
        
        return schedules.map(schedule => ({
            vessel: {
                name: schedule.vesselName,
                imo: schedule.vesselIMONumber,
                callSign: schedule.callSign
            },
            voyage: schedule.voyageNumber,
            service: schedule.serviceName,
            route: schedule.route?.map(port => ({
                location: {
                    name: port.locationName,
                    code: port.UNLocationCode,
                    country: port.countryCode
                },
                arrival: port.estimatedArrival,
                departure: port.estimatedDeparture,
                terminal: port.terminalCode
            })),
            lastUpdated: schedule.updatedDateTime || new Date().toISOString()
        }));
    }

    // Maersk-specific webhook handling
    processWebhookData(payload) {
        // Validate webhook signature if provided
        if (payload.signature && this.webhookSecret) {
            const isValid = this.validateWebhook(payload.data, payload.signature, this.webhookSecret);
            if (!isValid) {
                throw new Error('Invalid webhook signature');
            }
        }

        // Process the webhook data
        return {
            carrier: 'MAEU',
            eventType: payload.eventType,
            containerNumber: payload.containerNumber,
            timestamp: payload.eventDateTime,
            location: payload.location,
            status: payload.transportEventTypeCode,
            vessel: payload.vessel,
            rawData: payload
        };
    }

    // Enhanced error handling for Maersk-specific errors
    handleApiError(error) {
        const baseError = super.handleApiError(error);
        
        // Add Maersk-specific error handling
        if (error.response?.data?.errorCode) {
            const maerskError = error.response.data;
            
            switch (maerskError.errorCode) {
                case 'CONTAINER_NOT_FOUND':
                    baseError.type = 'CONTAINER_NOT_FOUND';
                    baseError.message = 'Container not found in Maersk system';
                    break;
                case 'INVALID_CONTAINER_NUMBER':
                    baseError.type = 'INVALID_CONTAINER_NUMBER';
                    baseError.message = 'Invalid container number format';
                    break;
                case 'SUBSCRIPTION_LIMIT_EXCEEDED':
                    baseError.type = 'SUBSCRIPTION_LIMIT_EXCEEDED';
                    baseError.message = 'Maximum subscriptions limit reached';
                    break;
                default:
                    baseError.message = maerskError.errorMessage || baseError.message;
            }
        }
        
        return baseError;
    }

    // Health check specific to Maersk API
    async healthCheck() {
        try {
            // Test authentication
            await this.ensureValidToken();
            
            // Test API endpoint
            const response = await this.client.get('/api/health', { timeout: 5000 });
            
            return {
                carrier: 'MAEU',
                status: 'healthy',
                authentication: 'valid',
                apiVersion: response.data?.version,
                responseTime: response.duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                carrier: 'MAEU',
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = MaerskAdapter;