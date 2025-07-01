// ROOTUIP Container Tracking - CMA CGM API Integration
// CMA CGM vessel schedules and container tracking integration

const BaseCarrierAdapter = require('./base-carrier-adapter');

class CMACGMAdapter extends BaseCarrierAdapter {
    constructor(config) {
        super({
            carrierCode: 'CMDU',
            apiBaseUrl: 'https://api.cma-cgm.com',
            ...config
        });
        
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.bearerToken = null;
        this.tokenExpiry = null;
    }

    async addAuthentication(config) {
        // CMA CGM uses Bearer token authentication
        await this.ensureValidToken();
        
        if (this.bearerToken) {
            config.headers['Authorization'] = `Bearer ${this.bearerToken}`;
        }
        
        // Add API key for additional authentication
        config.headers['X-API-Key'] = this.apiKey;
        
        return config;
    }

    async ensureValidToken() {
        // Check if token is still valid (with 5 minute buffer)
        if (this.bearerToken && this.tokenExpiry && (this.tokenExpiry - Date.now() > 300000)) {
            return;
        }

        // Get new bearer token
        try {
            const authString = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
            
            const tokenResponse = await this.client.post('/oauth/token', {
                grant_type: 'client_credentials',
                scope: 'tracking schedules'
            }, {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.bearerToken = tokenResponse.data.access_token;
            this.tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);
            
            console.log(`[CMDU] Bearer token refreshed, expires in ${tokenResponse.data.expires_in} seconds`);
        } catch (error) {
            console.error('[CMDU] Failed to get bearer token:', error);
            throw new Error('CMA CGM authentication failed');
        }
    }

    async trackContainer(containerNumber) {
        const validation = this.validateContainerNumber(containerNumber);
        if (!validation.valid) {
            throw new Error(`Invalid container number: ${validation.message}`);
        }

        try {
            const response = await this.client.get(`/tracking/v1/container/${validation.normalized}`);
            return this.formatCMACGMResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Container ${containerNumber} not found in CMA CGM system`);
            }
            throw error;
        }
    }

    async trackBillOfLading(blNumber) {
        if (!blNumber || blNumber.trim().length === 0) {
            throw new Error('Bill of Lading number is required');
        }

        try {
            const response = await this.client.get(`/tracking/v1/bill-of-lading/${blNumber.trim()}`);
            return this.formatCMACGMResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Bill of Lading ${blNumber} not found in CMA CGM system`);
            }
            throw error;
        }
    }

    async getVesselSchedule(vesselName, voyageNumber) {
        try {
            const params = {};
            if (vesselName) params.vesselName = vesselName;
            if (voyageNumber) params.voyage = voyageNumber;

            const response = await this.client.get('/schedules/v1/vessel-schedule', { params });
            return this.formatCMACGMVesselSchedule(response.data);
        } catch (error) {
            throw error;
        }
    }

    async getServiceSchedules(serviceCode, fromPort, toPort) {
        try {
            const params = { service: serviceCode };
            if (fromPort) params.originPort = fromPort;
            if (toPort) params.destinationPort = toPort;

            const response = await this.client.get('/schedules/v1/service-schedule', { params });
            return this.formatCMACGMServiceSchedule(response.data);
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
            const response = await this.client.post('/notifications/v1/webhook', {
                containerNumber: validation.normalized,
                webhookEndpoint: webhookUrl,
                eventTypes: ['MILESTONE', 'LOCATION_UPDATE', 'STATUS_CHANGE', 'ETA_CHANGE']
            });

            return {
                subscriptionId: response.data.notificationId,
                containerNumber: validation.normalized,
                webhookUrl: webhookUrl,
                status: 'ACTIVE',
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            throw error;
        }
    }

    formatCMACGMResponse(data) {
        // CMA CGM API response format
        const shipment = data.shipment || data;
        const container = shipment.containers?.[0] || shipment.container || shipment;
        const latestEvent = container.trackingEvents?.[0] || {};
        
        return this.formatTrackingResponse({
            containerNumber: container.containerNumber || container.equipmentNumber,
            containerSize: this.extractContainerSizeCMA(container.equipmentType),
            containerType: container.equipmentType || container.containerType,
            status: latestEvent.milestoneCode || container.status,
            
            currentLocation: {
                name: latestEvent.location?.locationName || container.currentLocation?.name,
                code: latestEvent.location?.UNLocationCode || container.currentLocation?.code,
                country: latestEvent.location?.countryCode || container.currentLocation?.country,
                coordinates: latestEvent.location?.coordinates,
                facility: latestEvent.location?.facilityName || container.currentLocation?.facility
            },
            
            destination: {
                name: shipment.destination?.locationName || container.destination?.name,
                code: shipment.destination?.UNLocationCode || container.destination?.code,
                country: shipment.destination?.countryCode || container.destination?.country
            },
            
            vesselName: latestEvent.transport?.vesselName || container.vessel?.name,
            vesselIMO: latestEvent.transport?.vesselIMO || container.vessel?.imo,
            voyageNumber: latestEvent.transport?.voyageNumber || container.voyage,
            
            events: this.formatCMACGMEvents(container.trackingEvents || []),
            estimatedArrival: container.estimatedTimeOfArrival || shipment.estimatedArrival,
            actualArrival: container.actualTimeOfArrival || shipment.actualArrival,
            lastUpdated: container.lastUpdated || shipment.lastUpdated || new Date().toISOString()
        });
    }

    extractContainerSizeCMA(equipmentType) {
        // Extract size from CMA CGM equipment type
        if (!equipmentType) return null;
        
        // Common CMA CGM equipment type patterns
        const sizePatterns = {
            '20': '20FT',
            '40': '40FT',
            '45': '45FT'
        };
        
        for (const [size, description] of Object.entries(sizePatterns)) {
            if (equipmentType.includes(size)) {
                return description;
            }
        }
        
        return equipmentType;
    }

    formatCMACGMEvents(trackingEvents) {
        return trackingEvents.map(event => ({
            timestamp: event.eventDateTime || event.timestamp,
            status: event.milestoneCode || event.eventCode,
            location: {
                name: event.location?.locationName,
                code: event.location?.UNLocationCode,
                country: event.location?.countryCode
            },
            vessel: event.transport?.vesselName,
            description: event.eventDescription || event.milestoneDescription,
            facilityCode: event.location?.facilityCode,
            transport: {
                mode: event.transport?.modeOfTransport,
                vessel: event.transport?.vesselName,
                voyage: event.transport?.voyageNumber
            }
        }));
    }

    formatCMACGMVesselSchedule(data) {
        const schedules = data.vesselSchedules || [data];
        
        return schedules.map(schedule => ({
            vessel: {
                name: schedule.vesselName,
                imo: schedule.vesselIMO,
                callSign: schedule.callSign,
                flag: schedule.flag
            },
            voyage: schedule.voyageNumber,
            service: schedule.serviceName,
            route: schedule.portRotation?.map(port => ({
                location: {
                    name: port.portName,
                    code: port.UNLocationCode,
                    country: port.countryCode
                },
                arrival: port.estimatedArrival,
                departure: port.estimatedDeparture,
                terminal: port.terminalName,
                berth: port.berth,
                sequenceNumber: port.portSequence
            })),
            capacity: {
                teu: schedule.vesselCapacity?.TEU,
                dwt: schedule.vesselCapacity?.DWT
            },
            lastUpdated: schedule.lastUpdate || new Date().toISOString()
        }));
    }

    formatCMACGMServiceSchedule(data) {
        return {
            service: {
                code: data.serviceCode,
                name: data.serviceName,
                frequency: data.frequency,
                transitTime: data.transitTime
            },
            route: data.routeDetails?.map(leg => ({
                from: {
                    name: leg.originPort?.portName,
                    code: leg.originPort?.UNLocationCode,
                    country: leg.originPort?.countryCode
                },
                to: {
                    name: leg.destinationPort?.portName,
                    code: leg.destinationPort?.UNLocationCode,
                    country: leg.destinationPort?.countryCode
                },
                transitDays: leg.transitDays,
                frequency: leg.frequency
            })),
            vessels: data.vesselsOnService?.map(vessel => ({
                name: vessel.vesselName,
                imo: vessel.vesselIMO,
                capacity: vessel.capacity
            })),
            lastUpdated: data.lastUpdate || new Date().toISOString()
        };
    }

    // CMA CGM-specific webhook handling
    processWebhookData(payload) {
        return {
            carrier: 'CMDU',
            eventType: payload.milestoneCode || payload.eventType,
            containerNumber: payload.containerNumber || payload.equipmentNumber,
            timestamp: payload.eventDateTime || payload.timestamp,
            location: payload.location,
            status: payload.milestoneCode || payload.eventCode,
            vessel: payload.transport?.vesselName,
            description: payload.eventDescription,
            transport: payload.transport,
            rawData: payload
        };
    }

    // Enhanced error handling for CMA CGM-specific errors
    handleApiError(error) {
        const baseError = super.handleApiError(error);
        
        // Add CMA CGM-specific error handling
        if (error.response?.data?.errors) {
            const cmaCgmError = error.response.data.errors[0];
            
            switch (cmaCgmError.code) {
                case 'CONTAINER_NOT_FOUND':
                    baseError.type = 'CONTAINER_NOT_FOUND';
                    baseError.message = 'Container not found in CMA CGM system';
                    break;
                case 'INVALID_EQUIPMENT_NUMBER':
                    baseError.type = 'INVALID_CONTAINER_NUMBER';
                    baseError.message = 'Invalid container number format';
                    break;
                case 'TOKEN_EXPIRED':
                    baseError.type = 'TOKEN_EXPIRED';
                    baseError.message = 'CMA CGM access token expired';
                    // Reset token to force re-authentication
                    this.bearerToken = null;
                    this.tokenExpiry = null;
                    break;
                case 'QUOTA_EXCEEDED':
                    baseError.type = 'QUOTA_EXCEEDED';
                    baseError.message = 'CMA CGM API quota exceeded';
                    break;
                default:
                    baseError.message = cmaCgmError.message || baseError.message;
            }
        }
        
        return baseError;
    }

    // Health check specific to CMA CGM API
    async healthCheck() {
        try {
            // Test authentication
            await this.ensureValidToken();
            
            // Test API endpoint
            const response = await this.client.get('/health/v1/status', { timeout: 5000 });
            
            return {
                carrier: 'CMDU',
                status: 'healthy',
                authentication: 'valid',
                apiStatus: response.data?.status,
                version: response.data?.version,
                responseTime: response.duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                carrier: 'CMDU',
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // CMA CGM-specific methods
    async getPortSchedules(portCode, days = 7) {
        try {
            const response = await this.client.get(`/schedules/v1/port/${portCode}`, {
                params: { days: days }
            });
            
            return response.data.schedule?.map(entry => ({
                vessel: {
                    name: entry.vesselName,
                    imo: entry.vesselIMO
                },
                voyage: entry.voyageNumber,
                service: entry.serviceName,
                eta: entry.estimatedArrival,
                etd: entry.estimatedDeparture,
                terminal: entry.terminal,
                berth: entry.berth
            }));
        } catch (error) {
            throw error;
        }
    }

    async searchVoyages(fromPort, toPort, date) {
        try {
            const response = await this.client.get('/schedules/v1/voyage-search', {
                params: {
                    origin: fromPort,
                    destination: toPort,
                    departureDate: date
                }
            });
            
            return response.data.voyages?.map(voyage => ({
                service: voyage.serviceName,
                vessel: voyage.vesselName,
                voyage: voyage.voyageNumber,
                departure: voyage.departureDate,
                arrival: voyage.arrivalDate,
                transitTime: voyage.transitDays,
                directService: voyage.isDirect
            }));
        } catch (error) {
            throw error;
        }
    }
}

module.exports = CMACGMAdapter;