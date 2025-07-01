// ROOTUIP Container Tracking - Hapag-Lloyd API Integration
// Hapag-Lloyd EDI processing and container tracking integration

const BaseCarrierAdapter = require('./base-carrier-adapter');

class HapagLloydAdapter extends BaseCarrierAdapter {
    constructor(config) {
        super({
            carrierCode: 'HLCU',
            apiBaseUrl: 'https://api.hapag-lloyd.com',
            ...config
        });
        
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // EDI specific configuration
        this.ediConfig = {
            enabled: config.ediEnabled || false,
            ftpHost: config.ediFtpHost,
            ftpUsername: config.ediFtpUsername,
            ftpPassword: config.ediFtpPassword,
            ediVersion: config.ediVersion || 'D96A'
        };
    }

    async addAuthentication(config) {
        // Hapag-Lloyd uses OAuth 2.0
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
            const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            
            const tokenResponse = await this.client.post('/auth/oauth2/token', 
                'grant_type=client_credentials&scope=tracking schedules edi',
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = tokenResponse.data.access_token;
            this.tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);
            
            console.log(`[HLCU] Access token refreshed, expires in ${tokenResponse.data.expires_in} seconds`);
        } catch (error) {
            console.error('[HLCU] Failed to get access token:', error);
            throw new Error('Hapag-Lloyd authentication failed');
        }
    }

    async trackContainer(containerNumber) {
        const validation = this.validateContainerNumber(containerNumber);
        if (!validation.valid) {
            throw new Error(`Invalid container number: ${validation.message}`);
        }

        try {
            const response = await this.client.get(`/shipment-tracking/v1/containers/${validation.normalized}`);
            return this.formatHapagLloydResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Container ${containerNumber} not found in Hapag-Lloyd system`);
            }
            throw error;
        }
    }

    async trackBillOfLading(blNumber) {
        if (!blNumber || blNumber.trim().length === 0) {
            throw new Error('Bill of Lading number is required');
        }

        try {
            const response = await this.client.get(`/shipment-tracking/v1/bill-of-lading/${blNumber.trim()}`);
            return this.formatHapagLloydResponse(response.data);
        } catch (error) {
            if (error.status === 404) {
                throw new Error(`Bill of Lading ${blNumber} not found in Hapag-Lloyd system`);
            }
            throw error;
        }
    }

    async getVesselSchedule(vesselName, voyageNumber) {
        try {
            const params = {};
            if (vesselName) params.vesselName = vesselName;
            if (voyageNumber) params.voyage = voyageNumber;

            const response = await this.client.get('/vessel-schedules/v1/schedules', { params });
            return this.formatHapagLloydVesselSchedule(response.data);
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
            const response = await this.client.post('/notifications/v1/subscriptions', {
                equipmentNumber: validation.normalized,
                notificationEndpoint: webhookUrl,
                eventTypes: ['TRANSPORT_EVENT', 'CUSTOMS_EVENT', 'EQUIPMENT_EVENT']
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

    formatHapagLloydResponse(data) {
        // Hapag-Lloyd API response format
        const shipmentDetails = data.shipmentDetails || data;
        const equipment = shipmentDetails.equipments?.[0] || shipmentDetails.equipment || {};
        const latestEvent = equipment.transportEvents?.[0] || {};
        
        return this.formatTrackingResponse({
            containerNumber: equipment.equipmentNumber || equipment.containerNumber,
            containerSize: this.extractContainerSizeHL(equipment.equipmentType),
            containerType: equipment.equipmentType,
            status: latestEvent.eventTypeCode || equipment.status,
            
            currentLocation: {
                name: latestEvent.location?.locationName || equipment.currentLocation?.name,
                code: latestEvent.location?.UNLocationCode || equipment.currentLocation?.code,
                country: latestEvent.location?.countryCode || equipment.currentLocation?.country,
                coordinates: latestEvent.location?.geoCoordinates,
                facility: latestEvent.location?.facilityTypeCode || equipment.currentLocation?.facility
            },
            
            destination: {
                name: shipmentDetails.destination?.locationName,
                code: shipmentDetails.destination?.UNLocationCode,
                country: shipmentDetails.destination?.countryCode
            },
            
            vesselName: latestEvent.transport?.vesselName || equipment.vessel?.name,
            vesselIMO: latestEvent.transport?.vesselIMONumber || equipment.vessel?.imo,
            voyageNumber: latestEvent.transport?.carrierVoyageNumber || equipment.voyage,
            
            events: this.formatHapagLloydEvents(equipment.transportEvents || []),
            estimatedArrival: equipment.estimatedTimeOfArrival || shipmentDetails.estimatedArrival,
            actualArrival: equipment.actualTimeOfArrival || shipmentDetails.actualArrival,
            lastUpdated: equipment.updatedDateTime || shipmentDetails.lastUpdate || new Date().toISOString()
        });
    }

    extractContainerSizeHL(equipmentType) {
        // Extract size from Hapag-Lloyd equipment type
        if (!equipmentType) return null;
        
        // Hapag-Lloyd uses ISO codes
        const isoToSize = {
            '22G1': '20FT',
            '42G1': '40FT',
            '45G1': '40FT',
            'L5G1': '45FT'
        };
        
        return isoToSize[equipmentType] || equipmentType?.substring(0, 2) + 'FT';
    }

    formatHapagLloydEvents(transportEvents) {
        return transportEvents.map(event => ({
            timestamp: event.eventDateTime,
            status: event.eventTypeCode,
            location: {
                name: event.location?.locationName,
                code: event.location?.UNLocationCode,
                country: event.location?.countryCode
            },
            vessel: event.transport?.vesselName,
            description: event.eventDescription || event.eventTypeDescription,
            facilityCode: event.location?.facilityTypeCode,
            transport: {
                mode: event.transport?.modeOfTransportCode,
                vessel: event.transport?.vesselName,
                voyage: event.transport?.carrierVoyageNumber,
                service: event.transport?.carrierServiceCode
            },
            documentNumbers: event.documentReferences,
            remarks: event.remarks
        }));
    }

    formatHapagLloydVesselSchedule(data) {
        const schedules = data.vesselSchedules || [data];
        
        return schedules.map(schedule => ({
            vessel: {
                name: schedule.vesselName,
                imo: schedule.vesselIMONumber,
                mmsi: schedule.vesselMMSI,
                callSign: schedule.vesselCallSign,
                flag: schedule.vesselFlag
            },
            voyage: schedule.carrierVoyageNumber,
            service: schedule.carrierServiceCode,
            route: schedule.transportCalls?.map(call => ({
                location: {
                    name: call.location?.locationName,
                    code: call.location?.UNLocationCode,
                    country: call.location?.countryCode
                },
                arrival: call.estimatedArrivalDate,
                departure: call.estimatedDepartureDate,
                terminal: call.facilityTypeCode,
                callSequence: call.portCallSequenceNumber,
                operationType: call.transportCallTypeCode
            })),
            vesselOperator: schedule.vesselOperatorCarrierCode,
            lastUpdated: schedule.updatedDateTime || new Date().toISOString()
        }));
    }

    // EDI Processing Methods
    async processEDIMessage(ediMessage, messageType) {
        if (!this.ediConfig.enabled) {
            throw new Error('EDI processing is not enabled');
        }

        try {
            const response = await this.client.post('/edi/v1/process', {
                messageType: messageType, // IFTMIN, IFTSTA, CODECO, etc.
                ediVersion: this.ediConfig.ediVersion,
                message: ediMessage
            });

            return this.parseEDIResponse(response.data, messageType);
        } catch (error) {
            throw error;
        }
    }

    parseEDIResponse(ediData, messageType) {
        switch (messageType) {
            case 'IFTMIN': // Instruction message
                return this.parseIFTMIN(ediData);
            case 'IFTSTA': // Status message
                return this.parseIFTSTA(ediData);
            case 'CODECO': // Container discharge/loading order
                return this.parseCODECO(ediData);
            default:
                return ediData;
        }
    }

    parseIFTMIN(ediData) {
        // Parse Hapag-Lloyd IFTMIN message
        return {
            messageType: 'IFTMIN',
            bookingReference: ediData.bookingNumber,
            containers: ediData.containers?.map(container => ({
                number: container.equipmentNumber,
                type: container.equipmentType,
                size: container.equipmentSize,
                grossWeight: container.grossWeight,
                sealNumbers: container.sealNumbers
            })),
            route: ediData.transportStages?.map(stage => ({
                from: stage.placeOfDeparture,
                to: stage.placeOfArrival,
                mode: stage.modeOfTransport,
                vessel: stage.vesselName,
                voyage: stage.voyageNumber
            })),
            parsedAt: new Date().toISOString()
        };
    }

    parseIFTSTA(ediData) {
        // Parse Hapag-Lloyd IFTSTA message
        return {
            messageType: 'IFTSTA',
            equipmentNumber: ediData.equipmentNumber,
            statusCode: ediData.statusCode,
            statusDescription: ediData.statusDescription,
            eventDateTime: ediData.eventDateTime,
            location: {
                name: ediData.locationName,
                code: ediData.locationCode,
                country: ediData.countryCode
            },
            vessel: ediData.vesselName,
            voyage: ediData.voyageNumber,
            parsedAt: new Date().toISOString()
        };
    }

    parseCODECO(ediData) {
        // Parse Hapag-Lloyd CODECO message
        return {
            messageType: 'CODECO',
            functionCode: ediData.functionCode, // 9=discharge, 1=loading
            equipmentNumber: ediData.equipmentNumber,
            equipmentType: ediData.equipmentType,
            fullEmptyIndicator: ediData.fullEmptyIndicator,
            location: {
                name: ediData.locationName,
                code: ediData.locationCode
            },
            vessel: ediData.vesselName,
            voyage: ediData.voyageNumber,
            operationDateTime: ediData.operationDateTime,
            parsedAt: new Date().toISOString()
        };
    }

    // Hapag-Lloyd-specific webhook handling
    processWebhookData(payload) {
        return {
            carrier: 'HLCU',
            eventType: payload.eventTypeCode || payload.eventType,
            containerNumber: payload.equipmentNumber || payload.containerNumber,
            timestamp: payload.eventDateTime || payload.timestamp,
            location: payload.location,
            status: payload.eventTypeCode || payload.statusCode,
            vessel: payload.transport?.vesselName,
            voyage: payload.transport?.carrierVoyageNumber,
            description: payload.eventDescription,
            transport: payload.transport,
            documentReferences: payload.documentReferences,
            rawData: payload
        };
    }

    // Enhanced error handling for Hapag-Lloyd-specific errors
    handleApiError(error) {
        const baseError = super.handleApiError(error);
        
        // Add Hapag-Lloyd-specific error handling
        if (error.response?.data?.errors) {
            const hlError = error.response.data.errors[0];
            
            switch (hlError.code) {
                case 'EQUIPMENT_NOT_FOUND':
                    baseError.type = 'CONTAINER_NOT_FOUND';
                    baseError.message = 'Container not found in Hapag-Lloyd system';
                    break;
                case 'INVALID_EQUIPMENT_NUMBER':
                    baseError.type = 'INVALID_CONTAINER_NUMBER';
                    baseError.message = 'Invalid container number format';
                    break;
                case 'ACCESS_TOKEN_EXPIRED':
                    baseError.type = 'TOKEN_EXPIRED';
                    baseError.message = 'Hapag-Lloyd access token expired';
                    // Reset token to force re-authentication
                    this.accessToken = null;
                    this.tokenExpiry = null;
                    break;
                case 'EDI_PROCESSING_ERROR':
                    baseError.type = 'EDI_PROCESSING_ERROR';
                    baseError.message = 'EDI message processing failed';
                    break;
                default:
                    baseError.message = hlError.message || baseError.message;
            }
        }
        
        return baseError;
    }

    // Health check specific to Hapag-Lloyd API
    async healthCheck() {
        try {
            // Test authentication
            await this.ensureValidToken();
            
            // Test API endpoint
            const response = await this.client.get('/health/v1/status', { timeout: 5000 });
            
            return {
                carrier: 'HLCU',
                status: 'healthy',
                authentication: 'valid',
                apiVersion: response.data?.version,
                ediEnabled: this.ediConfig.enabled,
                responseTime: response.duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                carrier: 'HLCU',
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Hapag-Lloyd-specific methods
    async getBookingDetails(bookingNumber) {
        try {
            const response = await this.client.get(`/bookings/v1/${bookingNumber}`);
            
            return {
                bookingNumber: response.data.bookingNumber,
                bookingStatus: response.data.bookingStatus,
                containers: response.data.equipments?.map(equipment => ({
                    number: equipment.equipmentNumber,
                    type: equipment.equipmentType,
                    size: equipment.equipmentSize,
                    sealNumbers: equipment.sealNumbers
                })),
                route: response.data.transportPlan?.transportStages?.map(stage => ({
                    from: stage.departureLocation,
                    to: stage.arrivalLocation,
                    mode: stage.modeOfTransport,
                    estimatedDeparture: stage.estimatedDepartureDate,
                    estimatedArrival: stage.estimatedArrivalDate
                })),
                cargoDetails: response.data.cargoDetails
            };
        } catch (error) {
            throw error;
        }
    }

    async getPointToPointSchedules(originPort, destinationPort, departureDate) {
        try {
            const response = await this.client.get('/point-to-point-schedules/v1/schedules', {
                params: {
                    originLocationCode: originPort,
                    destinationLocationCode: destinationPort,
                    departureDate: departureDate
                }
            });
            
            return response.data.schedules?.map(schedule => ({
                service: schedule.serviceCode,
                vessel: schedule.vesselName,
                voyage: schedule.voyageNumber,
                departure: schedule.departureDate,
                arrival: schedule.arrivalDate,
                transitTime: schedule.transitDays,
                frequency: schedule.serviceFrequency
            }));
        } catch (error) {
            throw error;
        }
    }
}

module.exports = HapagLloydAdapter;