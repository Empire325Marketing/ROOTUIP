// ROOTUIP Container Tracking - MSC API Integration
// MSC Mediterranean Shipping Company tracking integration

const BaseCarrierAdapter = require('./base-carrier-adapter');

class MSCAdapter extends BaseCarrierAdapter {
    constructor(config) {
        super({
            carrierCode: 'MSCU',
            apiBaseUrl: 'https://api.msc.com',
            ...config
        });
        
        this.username = config.username;
        this.password = config.password;
        this.sessionToken = null;
        this.tokenExpiry = null;
    }

    async addAuthentication(config) {
        // MSC uses session-based authentication
        await this.ensureValidSession();
        
        if (this.sessionToken) {
            config.headers['X-Session-Token'] = this.sessionToken;
        }
        
        return config;
    }

    async ensureValidSession() {
        // Check if session is still valid (with 10 minute buffer)
        if (this.sessionToken && this.tokenExpiry && (this.tokenExpiry - Date.now() > 600000)) {
            return;
        }

        // Create new session
        try {
            const loginResponse = await this.client.post('/api/v1/auth/login', {
                username: this.username,
                password: this.password
            });

            this.sessionToken = loginResponse.data.sessionToken;
            this.tokenExpiry = Date.now() + (loginResponse.data.expiresIn * 1000);
            
            console.log(`[MSCU] Session created, expires in ${loginResponse.data.expiresIn} seconds`);
        } catch (error) {
            console.error('[MSCU] Failed to create session:', error);
            throw new Error('MSC authentication failed');
        }
    }

    async trackContainer(containerNumber) {
        const validation = this.validateContainerNumber(containerNumber);
        if (!validation.valid) {
            throw new Error(`Invalid container number: ${validation.message}`);
        }

        try {
            const response = await this.client.get(`/api/v1/tracking/container/${validation.normalized}`);
            return this.formatMSCResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Container ${containerNumber} not found in MSC system`);
            }
            throw error;
        }
    }

    async trackBillOfLading(blNumber) {
        if (!blNumber || blNumber.trim().length === 0) {
            throw new Error('Bill of Lading number is required');
        }

        try {
            const response = await this.client.get(`/api/v1/tracking/bl/${blNumber.trim()}`);
            return this.formatMSCResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Bill of Lading ${blNumber} not found in MSC system`);
            }
            throw error;
        }
    }

    async getVesselSchedule(vesselName, voyageNumber) {
        try {
            const params = {};
            if (vesselName) params.vesselName = vesselName;
            if (voyageNumber) params.voyage = voyageNumber;

            const response = await this.client.get('/api/v1/schedules/vessel', { params });
            return this.formatMSCVesselSchedule(response.data);
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
            const response = await this.client.post('/api/v1/webhooks/container', {
                containerNumber: validation.normalized,
                callbackUrl: webhookUrl,
                events: ['STATUS_CHANGE', 'LOCATION_UPDATE', 'ETA_UPDATE']
            });

            return {
                subscriptionId: response.data.webhookId,
                containerNumber: validation.normalized,
                webhookUrl: webhookUrl,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            throw error;
        }
    }

    formatMSCResponse(data) {
        // MSC API response format
        const container = data.containerInfo || data;
        const currentStatus = container.statusHistory?.[0] || {};
        
        return this.formatTrackingResponse({
            containerNumber: container.containerNumber,
            containerSize: this.extractContainerSize(container.containerType),
            containerType: container.containerType,
            status: currentStatus.statusCode || container.currentStatus,
            
            currentLocation: {
                name: currentStatus.location?.name || container.currentLocation?.name,
                code: currentStatus.location?.unlocode || container.currentLocation?.unlocode,
                country: currentStatus.location?.country || container.currentLocation?.country,
                coordinates: currentStatus.location?.coordinates,
                facility: currentStatus.location?.facility || container.currentLocation?.facility
            },
            
            destination: {
                name: container.destination?.name,
                code: container.destination?.unlocode,
                country: container.destination?.country
            },
            
            vesselName: container.vessel?.name || currentStatus.vessel?.name,
            vesselIMO: container.vessel?.imoNumber,
            voyageNumber: container.voyage?.number || container.voyageNumber,
            
            events: this.formatMSCEvents(container.statusHistory || []),
            estimatedArrival: container.estimatedArrival || container.eta,
            actualArrival: container.actualArrival,
            lastUpdated: container.lastUpdate || new Date().toISOString()
        });
    }

    extractContainerSize(containerType) {
        // Extract size from MSC container type format
        if (!containerType) return null;
        
        const sizeMatch = containerType.match(/(\d{2})/);
        return sizeMatch ? sizeMatch[1] + 'FT' : null;
    }

    formatMSCEvents(statusHistory) {
        return statusHistory.map(event => ({
            timestamp: event.eventDateTime || event.timestamp,
            status: event.statusCode || event.eventType,
            location: {
                name: event.location?.name,
                code: event.location?.unlocode,
                country: event.location?.country
            },
            vessel: event.vessel?.name,
            description: event.description || event.statusDescription,
            facilityCode: event.location?.facility,
            remarks: event.remarks
        }));
    }

    formatMSCVesselSchedule(data) {
        const schedules = data.schedules || [data];
        
        return schedules.map(schedule => ({
            vessel: {
                name: schedule.vesselName,
                imo: schedule.imoNumber,
                flag: schedule.flag
            },
            voyage: schedule.voyageNumber,
            service: schedule.serviceName,
            route: schedule.portCalls?.map(port => ({
                location: {
                    name: port.portName,
                    code: port.unlocode,
                    country: port.country
                },
                arrival: port.eta,
                departure: port.etd,
                terminal: port.terminal,
                sequenceNumber: port.sequence
            })),
            lastUpdated: schedule.lastUpdate || new Date().toISOString()
        }));
    }

    // MSC-specific webhook handling
    processWebhookData(payload) {
        return {
            carrier: 'MSCU',
            eventType: payload.eventType || payload.statusCode,
            containerNumber: payload.containerNumber,
            timestamp: payload.eventDateTime || payload.timestamp,
            location: payload.location,
            status: payload.statusCode || payload.eventType,
            vessel: payload.vessel,
            description: payload.description,
            rawData: payload
        };
    }

    // Enhanced error handling for MSC-specific errors
    handleApiError(error) {
        const baseError = super.handleApiError(error);
        
        // Add MSC-specific error handling
        if (error.response?.data?.error) {
            const mscError = error.response.data.error;
            
            switch (mscError.code) {
                case 'CONTAINER_NOT_FOUND':
                    baseError.type = 'CONTAINER_NOT_FOUND';
                    baseError.message = 'Container not found in MSC system';
                    break;
                case 'INVALID_CONTAINER_FORMAT':
                    baseError.type = 'INVALID_CONTAINER_NUMBER';
                    baseError.message = 'Invalid container number format';
                    break;
                case 'SESSION_EXPIRED':
                    baseError.type = 'SESSION_EXPIRED';
                    baseError.message = 'MSC session expired';
                    // Reset session token to force re-authentication
                    this.sessionToken = null;
                    this.tokenExpiry = null;
                    break;
                case 'RATE_LIMIT_EXCEEDED':
                    baseError.type = 'RATE_LIMIT_ERROR';
                    baseError.message = 'MSC API rate limit exceeded';
                    break;
                default:
                    baseError.message = mscError.message || baseError.message;
            }
        }
        
        return baseError;
    }

    // Health check specific to MSC API
    async healthCheck() {
        try {
            // Test session
            await this.ensureValidSession();
            
            // Test API endpoint
            const response = await this.client.get('/api/v1/health', { timeout: 5000 });
            
            return {
                carrier: 'MSCU',
                status: 'healthy',
                session: 'valid',
                apiStatus: response.data?.status,
                responseTime: response.duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                carrier: 'MSCU',
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // MSC-specific methods
    async getServiceSchedules(serviceCode) {
        try {
            const response = await this.client.get(`/api/v1/schedules/service/${serviceCode}`);
            return this.formatMSCVesselSchedule(response.data);
        } catch (error) {
            throw error;
        }
    }

    async searchContainersByBL(blNumber) {
        try {
            const response = await this.client.get(`/api/v1/search/containers`, {
                params: { blNumber: blNumber }
            });
            
            return response.data.containers?.map(container => ({
                containerNumber: container.containerNumber,
                containerType: container.containerType,
                sealNumber: container.sealNumber,
                status: container.currentStatus
            })) || [];
        } catch (error) {
            throw error;
        }
    }

    // Logout method to properly terminate session
    async logout() {
        if (this.sessionToken) {
            try {
                await this.client.post('/api/v1/auth/logout');
                console.log('[MSCU] Session terminated successfully');
            } catch (error) {
                console.warn('[MSCU] Failed to terminate session:', error.message);
            } finally {
                this.sessionToken = null;
                this.tokenExpiry = null;
            }
        }
    }
}

module.exports = MSCAdapter;