// Maersk Line Integration Adapter
// Implements connection to Maersk's API for shipment tracking and booking

const { IntegrationConnector, DataTransformer } = require('../integration-framework');
const crypto = require('crypto');

// Maersk API Connector
class MaerskConnector extends IntegrationConnector {
    constructor(config) {
        super({
            ...config,
            name: 'Maersk Line',
            carrierId: 'MAEU',
            baseUrl: config.baseUrl || 'https://api.maersk.com/v1',
            rateLimit: 300 // 300 requests per minute
        });
        
        this.customerId = config.customerId;
        this.consumerKey = config.consumerKey;
        this.consumerSecret = config.consumerSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
    }
    
    async addAuthentication(config) {
        // Check if we need to refresh token
        if (!this.accessToken || this.isTokenExpired()) {
            await this.refreshAuthentication();
        }
        
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        config.headers['Consumer-Key'] = this.consumerKey;
        config.headers['X-Customer-ID'] = this.customerId;
        
        return config;
    }
    
    async refreshAuthentication() {
        try {
            const response = await this.client.post('/oauth/token', {
                grant_type: 'client_credentials',
                client_id: this.consumerKey,
                client_secret: this.consumerSecret
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            this.emit('auth-refreshed', { carrier: this.name });
            return true;
        } catch (error) {
            this.emit('auth-error', { carrier: this.name, error: error.message });
            throw new Error(`Maersk authentication failed: ${error.message}`);
        }
    }
    
    isTokenExpired() {
        if (!this.tokenExpiry) return true;
        return Date.now() >= (this.tokenExpiry - 60000); // Refresh 1 minute before expiry
    }
    
    async validateCredentials() {
        try {
            const response = await this.client.get('/customers/profile');
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    // Tracking methods
    async trackShipment(trackingNumber, type = 'container') {
        return this.requestWithRetry(async () => {
            const endpoint = type === 'container' ? '/tracking/containers' : '/tracking/bookings';
            const response = await this.client.get(`${endpoint}/${trackingNumber}`);
            
            return this.transformer.transformInbound(response.data, 'tracking');
        });
    }
    
    async trackMultipleShipments(trackingNumbers, type = 'container') {
        return this.requestWithRetry(async () => {
            const endpoint = type === 'container' ? '/tracking/containers/batch' : '/tracking/bookings/batch';
            const response = await this.client.post(endpoint, {
                trackingNumbers: trackingNumbers
            });
            
            return response.data.map(item => 
                this.transformer.transformInbound(item, 'tracking')
            );
        });
    }
    
    // Schedule methods
    async getSchedule(origin, destination, date) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get('/schedules/point-to-point', {
                params: {
                    originPort: origin,
                    destinationPort: destination,
                    departureDate: date
                }
            });
            
            return this.transformer.transformInbound(response.data, 'schedule');
        });
    }
    
    async getVesselSchedule(vesselCode, voyageNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/schedules/vessels/${vesselCode}/voyages/${voyageNumber}`);
            return this.transformer.transformInbound(response.data, 'vessel-schedule');
        });
    }
    
    // Booking methods
    async createBooking(bookingData) {
        return this.requestWithRetry(async () => {
            const externalData = await this.transformer.transformOutbound(bookingData, 'booking');
            const response = await this.client.post('/bookings', externalData);
            return this.transformer.transformInbound(response.data, 'booking-confirmation');
        });
    }
    
    async getBooking(bookingNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/bookings/${bookingNumber}`);
            return this.transformer.transformInbound(response.data, 'booking');
        });
    }
    
    async updateBooking(bookingNumber, updates) {
        return this.requestWithRetry(async () => {
            const externalData = await this.transformer.transformOutbound(updates, 'booking-update');
            const response = await this.client.patch(`/bookings/${bookingNumber}`, externalData);
            return this.transformer.transformInbound(response.data, 'booking-confirmation');
        });
    }
    
    // Document methods
    async getShippingInstructions(bookingNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/documents/shipping-instructions/${bookingNumber}`);
            return this.transformer.transformInbound(response.data, 'shipping-instructions');
        });
    }
    
    async getBillOfLading(blNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/documents/bill-of-lading/${blNumber}`, {
                responseType: 'arraybuffer'
            });
            
            return {
                documentType: 'bill-of-lading',
                blNumber: blNumber,
                content: response.data,
                contentType: response.headers['content-type']
            };
        });
    }
    
    // Equipment methods
    async getEquipmentAvailability(location, equipmentType, quantity) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get('/equipment/availability', {
                params: {
                    location: location,
                    equipmentType: equipmentType,
                    quantity: quantity
                }
            });
            
            return this.transformer.transformInbound(response.data, 'equipment-availability');
        });
    }
}

// Maersk Data Transformer
class MaerskTransformer extends DataTransformer {
    constructor(config) {
        super(config);
        
        // Define field mappings
        this.mappings = {
            tracking: {
                'trackingNumber': 'containerNumber',
                'status': 'transportStatus.status',
                'statusDescription': 'transportStatus.description',
                'location': 'transportStatus.location.facility',
                'locationCode': 'transportStatus.location.UNLocationCode',
                'timestamp': 'transportStatus.timestamp',
                'vessel': 'transport.vessel.name',
                'voyage': 'transport.voyage',
                'eta': 'estimatedTimeOfArrival',
                'events': 'transportEvents'
            },
            schedule: {
                'origin': 'pointFrom.facility',
                'originCode': 'pointFrom.UNLocationCode',
                'destination': 'pointTo.facility', 
                'destinationCode': 'pointTo.UNLocationCode',
                'departureDate': 'departureDateTime',
                'arrivalDate': 'arrivalDateTime',
                'transitTime': 'transitTime',
                'services': 'transportLegs'
            },
            booking: {
                'bookingNumber': 'carrierBookingReference',
                'status': 'bookingStatus',
                'shipper': 'parties.shipper',
                'consignee': 'parties.consignee',
                'origin': 'placeOfReceipt',
                'destination': 'placeOfDelivery',
                'containers': 'equipment',
                'commodity': 'commodity.description',
                'weight': 'commodity.weight',
                'requestedDate': 'requestedDepartureDate'
            }
        };
    }
    
    async transformInbound(externalData, dataType) {
        const mapping = this.mappings[dataType];
        if (!mapping) {
            throw new Error(`No mapping defined for data type: ${dataType}`);
        }
        
        const transformed = this.mapFields(externalData, mapping);
        
        // Apply specific transformations based on data type
        switch (dataType) {
            case 'tracking':
                transformed.events = this.transformTrackingEvents(externalData.transportEvents);
                transformed.status = this.normalizeStatus(transformed.status);
                break;
                
            case 'schedule':
                transformed.services = this.transformTransportLegs(externalData.transportLegs);
                transformed.transitTimeDays = this.calculateTransitDays(
                    transformed.departureDate,
                    transformed.arrivalDate
                );
                break;
                
            case 'booking':
                transformed.containers = this.transformEquipment(externalData.equipment);
                transformed.totalTEU = this.calculateTEU(transformed.containers);
                break;
        }
        
        // Add metadata
        transformed._source = 'maersk';
        transformed._retrievedAt = new Date().toISOString();
        
        return transformed;
    }
    
    async transformOutbound(internalData, dataType) {
        // Reverse transformation for sending data to Maersk
        const reverseMapping = this.createReverseMapping(this.mappings[dataType]);
        const transformed = this.mapFields(internalData, reverseMapping);
        
        // Apply Maersk-specific formatting
        switch (dataType) {
            case 'booking':
                transformed.equipment = this.formatEquipmentForMaersk(internalData.containers);
                transformed.commodity = {
                    description: internalData.commodity,
                    weight: {
                        value: internalData.weight,
                        unit: 'KGM'
                    }
                };
                break;
                
            case 'booking-update':
                // Only include changed fields
                const allowedFields = ['equipment', 'commodity', 'requestedDepartureDate'];
                Object.keys(transformed).forEach(key => {
                    if (!allowedFields.includes(key)) {
                        delete transformed[key];
                    }
                });
                break;
        }
        
        return transformed;
    }
    
    // Helper methods
    transformTrackingEvents(events) {
        if (!Array.isArray(events)) return [];
        
        return events.map(event => ({
            type: event.eventType,
            description: event.description,
            location: event.location?.facility,
            locationCode: event.location?.UNLocationCode,
            timestamp: event.eventDateTime,
            actualEvent: event.eventClassifierCode === 'ACT'
        }));
    }
    
    normalizeStatus(maerskStatus) {
        const statusMap = {
            'RELEASED': 'available',
            'GATED_IN': 'gate_in',
            'LOADED': 'loaded',
            'DISCHARGED': 'discharged',
            'GATED_OUT': 'gate_out',
            'EMPTY_RETURNED': 'returned',
            'IN_TRANSIT': 'in_transit'
        };
        
        return statusMap[maerskStatus] || maerskStatus?.toLowerCase();
    }
    
    transformTransportLegs(legs) {
        if (!Array.isArray(legs)) return [];
        
        return legs.map(leg => ({
            mode: leg.transportMode,
            vessel: leg.vessel?.vesselName,
            voyageNumber: leg.voyageNumber,
            origin: leg.loadLocation?.facility,
            destination: leg.dischargeLocation?.facility,
            departure: leg.departureDateTime,
            arrival: leg.arrivalDateTime
        }));
    }
    
    transformEquipment(equipment) {
        if (!Array.isArray(equipment)) return [];
        
        return equipment.map(eq => ({
            type: eq.ISOEquipmentCode,
            size: eq.ISOEquipmentCode?.substring(0, 2),
            quantity: eq.numberOfContainers || 1,
            commodityWeight: eq.commodityWeight?.value,
            tareWeight: eq.tareWeight?.value
        }));
    }
    
    calculateTEU(containers) {
        return containers.reduce((total, container) => {
            const size = parseInt(container.size);
            const teuFactor = size === 20 ? 1 : size === 40 ? 2 : 0;
            return total + (teuFactor * container.quantity);
        }, 0);
    }
    
    calculateTransitDays(departure, arrival) {
        if (!departure || !arrival) return null;
        
        const depDate = new Date(departure);
        const arrDate = new Date(arrival);
        const diffMs = arrDate - depDate;
        
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    
    formatEquipmentForMaersk(containers) {
        return containers.map(container => ({
            ISOEquipmentCode: container.type,
            numberOfContainers: container.quantity
        }));
    }
    
    createReverseMapping(mapping) {
        const reverse = {};
        for (const [key, value] of Object.entries(mapping)) {
            reverse[value] = key;
        }
        return reverse;
    }
}

module.exports = {
    MaerskConnector,
    MaerskTransformer
};