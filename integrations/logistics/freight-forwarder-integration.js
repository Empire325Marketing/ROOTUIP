/**
 * ROOTUIP Freight Forwarder Integration
 * Connects with major freight forwarding platforms
 */

const EventEmitter = require('events');
const axios = require('axios');

class FreightForwarderIntegration extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            provider: config.provider, // 'flexport', 'freightos', 'shipwell', 'cargowise', 'magaya'
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            secretKey: config.secretKey,
            environment: config.environment || 'production',
            timeout: config.timeout || 30000
        };
        
        // Provider-specific configurations
        this.providerConfigs = {
            flexport: {
                baseUrl: 'https://api.flexport.com/v3',
                authType: 'api_key',
                endpoints: {
                    shipments: '/shipments',
                    quotes: '/ocean/quotes',
                    bookings: '/ocean/bookings',
                    tracking: '/shipments/{id}/tracking_events',
                    documents: '/shipments/{id}/documents'
                }
            },
            freightos: {
                baseUrl: 'https://api.freightos.com/v1',
                authType: 'oauth2',
                endpoints: {
                    quotes: '/quotes',
                    bookings: '/bookings',
                    tracking: '/tracking',
                    rates: '/rates'
                }
            },
            shipwell: {
                baseUrl: 'https://api.shipwell.com/v2',
                authType: 'bearer',
                endpoints: {
                    shipments: '/shipments',
                    quotes: '/quotes',
                    tracking: '/shipments/{id}/tracking',
                    carriers: '/carriers'
                }
            },
            cargowise: {
                baseUrl: 'https://api.cargowise.com/v3',
                authType: 'oauth2',
                endpoints: {
                    shipments: '/universal/v1/shipment',
                    tracking: '/universal/v1/tracking',
                    documents: '/universal/v1/document',
                    consignments: '/universal/v1/consignment'
                }
            },
            magaya: {
                baseUrl: 'https://api.magaya.com/live-tracking/v1',
                authType: 'api_key',
                endpoints: {
                    shipments: '/shipments',
                    tracking: '/tracking',
                    quotes: '/quotes'
                }
            }
        };
        
        this.currentProvider = this.providerConfigs[this.config.provider];
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Shipment cache
        this.shipmentCache = new Map();
        
        // Rate shopping cache
        this.rateCache = new Map();
        this.rateCacheExpiry = 3600000; // 1 hour
    }
    
    // Connect to freight forwarder system
    async connect() {
        try {
            await this.authenticate();
            this.emit('connected', { provider: this.config.provider });
            return { success: true, provider: this.config.provider };
        } catch (error) {
            this.emit('error', { type: 'connection', error: error.message });
            throw error;
        }
    }
    
    // Authenticate with provider
    async authenticate() {
        const provider = this.currentProvider;
        
        if (provider.authType === 'oauth2') {
            const authResponse = await axios.post(`${provider.baseUrl}/oauth/token`, {
                grant_type: 'client_credentials',
                client_id: this.config.apiKey,
                client_secret: this.config.secretKey
            });
            
            this.accessToken = authResponse.data.access_token;
            this.tokenExpiry = Date.now() + (authResponse.data.expires_in * 1000);
            
        } else if (provider.authType === 'api_key' || provider.authType === 'bearer') {
            this.accessToken = this.config.apiKey;
        }
    }
    
    // Get freight quotes
    async getFreightQuotes(quoteRequest) {
        try {
            await this.ensureAuthenticated();
            
            // Check cache first
            const cacheKey = this.generateCacheKey(quoteRequest);
            const cached = this.rateCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.rateCacheExpiry) {
                return cached.quotes;
            }
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}${provider.endpoints.quotes}`;
            
            // Transform request data
            const transformedRequest = await this.transformQuoteRequest(quoteRequest);
            
            const response = await this.makeRequest('POST', endpoint, transformedRequest);
            
            // Transform response
            const quotes = await this.transformQuoteResponse(response.data);
            
            // Cache quotes
            this.rateCache.set(cacheKey, {
                quotes,
                timestamp: Date.now()
            });
            
            this.emit('quotes:received', {
                quote_count: quotes.length,
                request_id: response.data.request_id
            });
            
            return quotes;
            
        } catch (error) {
            this.emit('error', { type: 'quote_request', error: error.message });
            throw error;
        }
    }
    
    // Create shipment booking
    async createBooking(bookingData) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}${provider.endpoints.bookings}`;
            
            // Transform booking data
            const transformedData = await this.transformBookingData(bookingData);
            
            const response = await this.makeRequest('POST', endpoint, transformedData);
            
            // Cache shipment
            this.shipmentCache.set(response.data.shipment_id, {
                booking_data: bookingData,
                provider_data: response.data,
                created_at: new Date(),
                status: 'booked'
            });
            
            this.emit('booking:created', {
                shipment_id: response.data.shipment_id,
                booking_reference: response.data.booking_reference,
                status: response.data.status
            });
            
            return {
                success: true,
                shipment_id: response.data.shipment_id,
                booking_reference: response.data.booking_reference,
                container_numbers: response.data.container_numbers || [],
                vessel_info: response.data.vessel_info,
                estimated_departure: response.data.estimated_departure,
                estimated_arrival: response.data.estimated_arrival,
                total_cost: response.data.total_cost,
                currency: response.data.currency
            };
            
        } catch (error) {
            this.emit('error', { type: 'booking_creation', error: error.message });
            throw error;
        }
    }
    
    // Track shipment
    async trackShipment(shipmentId) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = provider.endpoints.tracking.replace('{id}', shipmentId);
            const url = `${provider.baseUrl}${endpoint}`;
            
            const response = await this.makeRequest('GET', url);
            
            // Transform tracking data
            const trackingInfo = await this.transformTrackingData(response.data);
            
            // Update cache
            if (this.shipmentCache.has(shipmentId)) {
                const cached = this.shipmentCache.get(shipmentId);
                cached.last_tracking_update = new Date();
                cached.current_status = trackingInfo.current_status;
            }
            
            this.emit('tracking:updated', {
                shipment_id: shipmentId,
                status: trackingInfo.current_status,
                location: trackingInfo.current_location
            });
            
            return trackingInfo;
            
        } catch (error) {
            this.emit('error', { type: 'tracking', error: error.message });
            throw error;
        }
    }
    
    // Get shipment documents
    async getShipmentDocuments(shipmentId) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = provider.endpoints.documents.replace('{id}', shipmentId);
            const url = `${provider.baseUrl}${endpoint}`;
            
            const response = await this.makeRequest('GET', url);
            
            const documents = response.data.documents.map(doc => ({
                document_id: doc.id,
                type: doc.type,
                name: doc.name,
                download_url: doc.download_url,
                created_date: doc.created_date,
                file_size: doc.file_size,
                format: doc.format
            }));
            
            this.emit('documents:retrieved', {
                shipment_id: shipmentId,
                document_count: documents.length
            });
            
            return {
                shipment_id: shipmentId,
                documents
            };
            
        } catch (error) {
            this.emit('error', { type: 'document_retrieval', error: error.message });
            throw error;
        }
    }
    
    // Schedule pickup
    async schedulePickup(pickupRequest) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}/pickups`;
            
            const pickupData = {
                shipment_reference: pickupRequest.shipment_reference,
                pickup_address: pickupRequest.pickup_address,
                pickup_date: pickupRequest.pickup_date,
                pickup_time_window: pickupRequest.pickup_time_window,
                contact_info: pickupRequest.contact_info,
                special_instructions: pickupRequest.special_instructions,
                cargo_details: pickupRequest.cargo_details
            };
            
            const response = await this.makeRequest('POST', endpoint, pickupData);
            
            this.emit('pickup:scheduled', {
                pickup_id: response.data.pickup_id,
                shipment_reference: pickupRequest.shipment_reference,
                scheduled_date: response.data.scheduled_date
            });
            
            return {
                success: true,
                pickup_id: response.data.pickup_id,
                confirmation_number: response.data.confirmation_number,
                scheduled_date: response.data.scheduled_date,
                pickup_window: response.data.pickup_window,
                driver_info: response.data.driver_info
            };
            
        } catch (error) {
            this.emit('error', { type: 'pickup_scheduling', error: error.message });
            throw error;
        }
    }
    
    // Get container status
    async getContainerStatus(containerNumber) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}/containers/${containerNumber}/status`;
            
            const response = await this.makeRequest('GET', endpoint);
            
            return {
                container_number: containerNumber,
                status: response.data.status,
                location: response.data.current_location,
                vessel: response.data.vessel_info,
                estimated_departure: response.data.estimated_departure,
                estimated_arrival: response.data.estimated_arrival,
                last_free_day: response.data.last_free_day,
                demurrage_days: response.data.demurrage_days,
                holds: response.data.holds || []
            };
            
        } catch (error) {
            this.emit('error', { type: 'container_status', error: error.message });
            throw error;
        }
    }
    
    // Search for available vessels
    async searchVessels(searchCriteria) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}/vessels/search`;
            
            const searchData = {
                origin_port: searchCriteria.origin_port,
                destination_port: searchCriteria.destination_port,
                departure_date_from: searchCriteria.departure_date_from,
                departure_date_to: searchCriteria.departure_date_to,
                service_type: searchCriteria.service_type,
                carrier_preferences: searchCriteria.carrier_preferences
            };
            
            const response = await this.makeRequest('POST', endpoint, searchData);
            
            const vessels = response.data.vessels.map(vessel => ({
                vessel_name: vessel.name,
                imo_number: vessel.imo,
                carrier: vessel.carrier,
                service: vessel.service,
                departure_date: vessel.departure_date,
                arrival_date: vessel.arrival_date,
                transit_time: vessel.transit_time,
                available_space: vessel.available_space,
                booking_cutoff: vessel.booking_cutoff
            }));
            
            return {
                search_criteria: searchCriteria,
                vessels,
                total_results: vessels.length
            };
            
        } catch (error) {
            this.emit('error', { type: 'vessel_search', error: error.message });
            throw error;
        }
    }
    
    // Transform quote request
    async transformQuoteRequest(request) {
        const provider = this.config.provider;
        
        const baseRequest = {
            origin: {
                port_code: request.origin_port,
                country_code: request.origin_country,
                city: request.origin_city
            },
            destination: {
                port_code: request.destination_port,
                country_code: request.destination_country,
                city: request.destination_city
            },
            cargo: {
                commodity: request.commodity,
                weight: request.total_weight,
                volume: request.total_volume,
                pieces: request.piece_count,
                container_type: request.container_type,
                dangerous_goods: request.dangerous_goods || false
            },
            service_requirements: {
                service_type: request.service_type || 'FCL',
                incoterm: request.incoterm,
                ready_date: request.ready_date,
                delivery_date: request.required_delivery_date
            }
        };
        
        // Provider-specific transformations
        switch (provider) {
            case 'flexport':
                return {
                    ...baseRequest,
                    quote_type: 'ocean_freight',
                    includes_insurance: request.include_insurance || false
                };
                
            case 'freightos':
                return {
                    ...baseRequest,
                    shipment_type: 'ocean',
                    quote_validity: 30
                };
                
            case 'shipwell':
                return {
                    ...baseRequest,
                    mode: 'ocean',
                    priority: request.priority || 'standard'
                };
                
            default:
                return baseRequest;
        }
    }
    
    // Transform quote response
    async transformQuoteResponse(data) {
        const provider = this.config.provider;
        
        let quotes = [];
        
        switch (provider) {
            case 'flexport':
                quotes = data.quotes.map(quote => ({
                    quote_id: quote.id,
                    carrier: quote.carrier_name,
                    service: quote.service_name,
                    total_cost: quote.total_cost.amount,
                    currency: quote.total_cost.currency,
                    transit_time: quote.transit_time_days,
                    departure_date: quote.departure_date,
                    arrival_date: quote.arrival_date,
                    validity: quote.valid_until,
                    cost_breakdown: quote.cost_breakdown
                }));
                break;
                
            case 'freightos':
                quotes = data.rates.map(rate => ({
                    quote_id: rate.rate_id,
                    carrier: rate.carrier,
                    service: rate.service,
                    total_cost: rate.total_price,
                    currency: rate.currency,
                    transit_time: rate.transit_time,
                    departure_date: rate.departure,
                    arrival_date: rate.arrival,
                    validity: rate.validity_date
                }));
                break;
                
            default:
                quotes = data.quotes || [];
        }
        
        return quotes.sort((a, b) => a.total_cost - b.total_cost);
    }
    
    // Transform booking data
    async transformBookingData(data) {
        const provider = this.config.provider;
        
        const baseBooking = {
            quote_id: data.selected_quote_id,
            shipper_info: data.shipper,
            consignee_info: data.consignee,
            notify_party: data.notify_party,
            cargo_details: data.cargo,
            service_instructions: data.instructions,
            pickup_details: data.pickup,
            delivery_details: data.delivery
        };
        
        switch (provider) {
            case 'flexport':
                return {
                    ...baseBooking,
                    booking_type: 'ocean',
                    commercial_invoice_required: true
                };
                
            case 'cargowise':
                return {
                    ...baseBooking,
                    job_type: 'ocean_import',
                    company_id: this.config.company_id
                };
                
            default:
                return baseBooking;
        }
    }
    
    // Transform tracking data
    async transformTrackingData(data) {
        const events = data.events ? data.events.map(event => ({
            timestamp: event.timestamp,
            location: event.location,
            status: event.status,
            description: event.description,
            vessel: event.vessel_name,
            voyage: event.voyage_number
        })) : [];
        
        return {
            shipment_id: data.shipment_id,
            current_status: data.current_status,
            current_location: data.current_location,
            estimated_arrival: data.estimated_arrival,
            actual_departure: data.actual_departure,
            actual_arrival: data.actual_arrival,
            events: events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
            containers: data.containers || []
        };
    }
    
    // Generate cache key
    generateCacheKey(request) {
        const keyData = {
            origin: request.origin_port,
            destination: request.destination_port,
            weight: request.total_weight,
            volume: request.total_volume,
            service: request.service_type,
            date: request.ready_date ? request.ready_date.split('T')[0] : null
        };
        
        return Buffer.from(JSON.stringify(keyData)).toString('base64');
    }
    
    // Make HTTP request
    async makeRequest(method, url, data = null, options = {}) {
        const config = {
            method,
            url,
            timeout: this.config.timeout,
            headers: {
                'Authorization': this.currentProvider.authType === 'bearer' ? 
                    `Bearer ${this.accessToken}` : 
                    `${this.currentProvider.authType === 'api_key' ? 'X-API-Key' : 'Authorization'}: ${this.accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'ROOTUIP-Integration/1.0',
                ...options.headers
            }
        };
        
        if (data) {
            if (method === 'GET') {
                config.params = data;
            } else {
                config.data = data;
            }
        }
        
        return await axios(config);
    }
    
    // Ensure authentication is valid
    async ensureAuthenticated() {
        if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
            await this.authenticate();
        }
    }
    
    // Health check
    async healthCheck() {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}/health`;
            
            await this.makeRequest('GET', endpoint);
            
            return { healthy: true, provider: this.config.provider };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
    
    // Execute operation
    async execute(operation, data, options = {}) {
        switch (operation) {
            case 'get_quotes':
                return await this.getFreightQuotes(data);
            case 'create_booking':
                return await this.createBooking(data);
            case 'track_shipment':
                return await this.trackShipment(data.shipment_id);
            case 'get_documents':
                return await this.getShipmentDocuments(data.shipment_id);
            case 'schedule_pickup':
                return await this.schedulePickup(data);
            case 'get_container_status':
                return await this.getContainerStatus(data.container_number);
            case 'search_vessels':
                return await this.searchVessels(data);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    
    // Disconnect
    async disconnect() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.shipmentCache.clear();
        this.rateCache.clear();
        this.emit('disconnected');
    }
}

module.exports = FreightForwarderIntegration;