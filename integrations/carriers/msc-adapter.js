// MSC (Mediterranean Shipping Company) Integration Adapter
// Implements connection to MSC's API for shipment tracking and booking

const { IntegrationConnector, DataTransformer } = require('../integration-framework');
const soap = require('soap');
const xml2js = require('xml2js');

// MSC API Connector
class MSCConnector extends IntegrationConnector {
    constructor(config) {
        super({
            ...config,
            name: 'Mediterranean Shipping Company',
            carrierId: 'MSCU',
            baseUrl: config.baseUrl || 'https://api.msc.com/services',
            rateLimit: 200 // 200 requests per minute
        });
        
        this.username = config.username;
        this.password = config.password;
        this.accountNumber = config.accountNumber;
        this.soapClient = null;
        this.wsdlUrl = config.wsdlUrl || `${this.baseUrl}/MSCServices?wsdl`;
    }
    
    async initializeSoapClient() {
        if (!this.soapClient) {
            try {
                this.soapClient = await soap.createClientAsync(this.wsdlUrl);
                this.soapClient.setSecurity(new soap.WSSecurity(this.username, this.password));
            } catch (error) {
                throw new Error(`Failed to initialize MSC SOAP client: ${error.message}`);
            }
        }
        return this.soapClient;
    }
    
    async addAuthentication(config) {
        // For REST endpoints
        config.headers['Authorization'] = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
        config.headers['X-MSC-Account'] = this.accountNumber;
        
        return config;
    }
    
    async refreshAuthentication() {
        // MSC uses basic auth, no token refresh needed
        return true;
    }
    
    async validateCredentials() {
        try {
            // Test with a simple API call
            const response = await this.client.get('/account/validate');
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    // Tracking methods
    async trackShipment(trackingNumber, type = 'container') {
        if (type === 'container') {
            return this.trackContainer(trackingNumber);
        } else {
            return this.trackBooking(trackingNumber);
        }
    }
    
    async trackContainer(containerNumber) {
        return this.requestWithRetry(async () => {
            const client = await this.initializeSoapClient();
            
            const args = {
                ContainerTrackingRequest: {
                    AccountNumber: this.accountNumber,
                    ContainerNumber: containerNumber,
                    IncludeHistory: true
                }
            };
            
            const [result] = await client.TrackContainerAsync(args);
            return this.transformer.transformInbound(result, 'container-tracking');
        });
    }
    
    async trackBooking(bookingNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/tracking/bookings/${bookingNumber}`);
            return this.transformer.transformInbound(response.data, 'booking-tracking');
        });
    }
    
    async trackMultipleContainers(containerNumbers) {
        return this.requestWithRetry(async () => {
            const client = await this.initializeSoapClient();
            
            const args = {
                MultiContainerTrackingRequest: {
                    AccountNumber: this.accountNumber,
                    ContainerNumbers: {
                        ContainerNumber: containerNumbers
                    }
                }
            };
            
            const [result] = await client.TrackMultipleContainersAsync(args);
            return result.Containers.map(container => 
                this.transformer.transformInbound(container, 'container-tracking')
            );
        });
    }
    
    // Schedule methods
    async getSchedule(origin, destination, date) {
        return this.requestWithRetry(async () => {
            const response = await this.client.post('/schedules/search', {
                originPort: origin,
                destinationPort: destination,
                departureDate: date,
                directOnly: false
            });
            
            return this.transformer.transformInbound(response.data, 'schedule');
        });
    }
    
    async getVesselSchedule(vesselCode, voyageNumber) {
        return this.requestWithRetry(async () => {
            const client = await this.initializeSoapClient();
            
            const args = {
                VesselScheduleRequest: {
                    VesselCode: vesselCode,
                    VoyageNumber: voyageNumber
                }
            };
            
            const [result] = await client.GetVesselScheduleAsync(args);
            return this.transformer.transformInbound(result, 'vessel-schedule');
        });
    }
    
    // Booking methods
    async createBooking(bookingData) {
        return this.requestWithRetry(async () => {
            const externalData = await this.transformer.transformOutbound(bookingData, 'booking');
            
            const response = await this.client.post('/bookings/create', {
                ...externalData,
                accountNumber: this.accountNumber
            });
            
            return this.transformer.transformInbound(response.data, 'booking-confirmation');
        });
    }
    
    async getBooking(bookingNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/bookings/${bookingNumber}`);
            return this.transformer.transformInbound(response.data, 'booking');
        });
    }
    
    async cancelBooking(bookingNumber, reason) {
        return this.requestWithRetry(async () => {
            const response = await this.client.post(`/bookings/${bookingNumber}/cancel`, {
                cancellationReason: reason,
                accountNumber: this.accountNumber
            });
            
            return this.transformer.transformInbound(response.data, 'cancellation-confirmation');
        });
    }
    
    // Rate methods
    async getQuote(quoteRequest) {
        return this.requestWithRetry(async () => {
            const externalData = await this.transformer.transformOutbound(quoteRequest, 'quote-request');
            
            const response = await this.client.post('/rates/quote', {
                ...externalData,
                accountNumber: this.accountNumber
            });
            
            return this.transformer.transformInbound(response.data, 'quote');
        });
    }
    
    async getContractRates(origin, destination) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get('/rates/contract', {
                params: {
                    accountNumber: this.accountNumber,
                    originPort: origin,
                    destinationPort: destination
                }
            });
            
            return this.transformer.transformInbound(response.data, 'contract-rates');
        });
    }
    
    // Document methods
    async getBillOfLading(blNumber) {
        return this.requestWithRetry(async () => {
            const client = await this.initializeSoapClient();
            
            const args = {
                BillOfLadingRequest: {
                    AccountNumber: this.accountNumber,
                    BLNumber: blNumber,
                    Format: 'PDF'
                }
            };
            
            const [result] = await client.GetBillOfLadingAsync(args);
            
            return {
                documentType: 'bill-of-lading',
                blNumber: blNumber,
                content: Buffer.from(result.Document, 'base64'),
                contentType: 'application/pdf'
            };
        });
    }
    
    async getContainerManifest(containerNumber) {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/documents/manifest/${containerNumber}`, {
                responseType: 'arraybuffer'
            });
            
            return {
                documentType: 'container-manifest',
                containerNumber: containerNumber,
                content: response.data,
                contentType: response.headers['content-type']
            };
        });
    }
}

// MSC Data Transformer
class MSCTransformer extends DataTransformer {
    constructor(config) {
        super(config);
        
        this.mappings = {
            'container-tracking': {
                'trackingNumber': 'ContainerNumber',
                'status': 'Status.Code',
                'statusDescription': 'Status.Description',
                'location': 'CurrentLocation.LocationName',
                'locationCode': 'CurrentLocation.UNLocode',
                'timestamp': 'Status.DateTime',
                'vessel': 'VesselName',
                'voyage': 'VoyageNumber',
                'eta': 'EstimatedArrival',
                'pod': 'PortOfDischarge',
                'pol': 'PortOfLoading',
                'events': 'TrackingHistory.Event'
            },
            'schedule': {
                'origin': 'Origin.PortName',
                'originCode': 'Origin.PortCode',
                'destination': 'Destination.PortName',
                'destinationCode': 'Destination.PortCode',
                'departureDate': 'DepartureDate',
                'arrivalDate': 'ArrivalDate',
                'transitTime': 'TransitDays',
                'services': 'Routes',
                'directService': 'IsDirect'
            },
            'booking': {
                'bookingNumber': 'BookingReference',
                'status': 'BookingStatus',
                'shipper': 'Shipper',
                'consignee': 'Consignee',
                'origin': 'PlaceOfReceipt',
                'destination': 'PlaceOfDelivery',
                'containers': 'ContainerDetails',
                'commodity': 'Commodity',
                'totalWeight': 'TotalWeight',
                'paymentTerms': 'PaymentTerms'
            },
            'quote': {
                'quoteNumber': 'QuoteReference',
                'validFrom': 'ValidityFrom',
                'validTo': 'ValidityTo',
                'totalAmount': 'TotalCharge.Amount',
                'currency': 'TotalCharge.Currency',
                'charges': 'ChargeBreakdown',
                'transitTime': 'EstimatedTransitDays',
                'service': 'ServiceType'
            }
        };
    }
    
    async transformInbound(externalData, dataType) {
        const mapping = this.mappings[dataType];
        if (!mapping) {
            throw new Error(`No mapping defined for data type: ${dataType}`);
        }
        
        // Handle SOAP response structure
        const data = externalData.Body ? externalData.Body : externalData;
        
        const transformed = this.mapFields(data, mapping);
        
        // Apply specific transformations
        switch (dataType) {
            case 'container-tracking':
                transformed.events = this.transformMSCEvents(data.TrackingHistory?.Event);
                transformed.status = this.normalizeMSCStatus(transformed.status);
                transformed.lastFreeDate = this.extractLastFreeDate(data);
                break;
                
            case 'schedule':
                transformed.services = this.transformMSCRoutes(data.Routes);
                transformed.totalCO2 = data.EnvironmentalData?.CO2Emissions;
                break;
                
            case 'booking':
                transformed.containers = this.transformMSCContainers(data.ContainerDetails);
                transformed.specialRequirements = this.extractSpecialRequirements(data);
                break;
                
            case 'quote':
                transformed.charges = this.transformMSCCharges(data.ChargeBreakdown);
                transformed.inclusions = this.extractInclusions(data);
                break;
        }
        
        // Add metadata
        transformed._source = 'msc';
        transformed._retrievedAt = new Date().toISOString();
        
        return transformed;
    }
    
    async transformOutbound(internalData, dataType) {
        const reverseMapping = this.createReverseMapping(this.mappings[dataType]);
        const transformed = this.mapFields(internalData, reverseMapping);
        
        // Apply MSC-specific formatting
        switch (dataType) {
            case 'booking':
                transformed.ContainerDetails = this.formatContainersForMSC(internalData.containers);
                transformed.Commodity = {
                    Description: internalData.commodity,
                    HSCode: internalData.hsCode,
                    Weight: {
                        Value: internalData.weight,
                        Unit: 'KGS'
                    }
                };
                break;
                
            case 'quote-request':
                transformed.CommodityDetails = {
                    Description: internalData.commodity,
                    Weight: internalData.weight,
                    Volume: internalData.volume,
                    Quantity: internalData.containerQuantity
                };
                transformed.ContainerType = internalData.containerType;
                break;
        }
        
        return transformed;
    }
    
    // Helper methods
    transformMSCEvents(events) {
        if (!Array.isArray(events)) return [];
        
        return events.map(event => ({
            type: event.EventType,
            description: event.Description,
            location: event.Location?.LocationName,
            locationCode: event.Location?.UNLocode,
            timestamp: event.DateTime,
            vessel: event.VesselName,
            voyage: event.VoyageNumber,
            isActual: event.EventStatus === 'ACTUAL'
        }));
    }
    
    normalizeMSCStatus(mscStatus) {
        const statusMap = {
            'EMP': 'empty',
            'FCL': 'full',
            'RLS': 'released',
            'GTI': 'gate_in',
            'LOD': 'loaded',
            'DIS': 'discharged',
            'GTO': 'gate_out',
            'RET': 'returned',
            'TRA': 'in_transit'
        };
        
        return statusMap[mscStatus] || mscStatus?.toLowerCase();
    }
    
    transformMSCRoutes(routes) {
        if (!Array.isArray(routes)) return [];
        
        return routes.map(route => ({
            routeNumber: route.RouteNumber,
            legs: route.Legs?.map(leg => ({
                mode: leg.TransportMode,
                from: leg.From.PortName,
                fromCode: leg.From.PortCode,
                to: leg.To.PortName,
                toCode: leg.To.PortCode,
                vessel: leg.VesselName,
                voyage: leg.VoyageNumber,
                departure: leg.DepartureDateTime,
                arrival: leg.ArrivalDateTime
            })),
            totalTransitTime: route.TotalTransitDays,
            transhipments: route.NumberOfTranshipments
        }));
    }
    
    transformMSCContainers(containers) {
        if (!Array.isArray(containers)) return [];
        
        return containers.map(container => ({
            containerNumber: container.ContainerNumber,
            type: container.ContainerType,
            size: container.Size,
            isoCode: container.ISOCode,
            sealNumber: container.SealNumber,
            weight: container.GrossWeight?.Value,
            weightUnit: container.GrossWeight?.Unit,
            status: container.Status
        }));
    }
    
    transformMSCCharges(charges) {
        if (!Array.isArray(charges)) return [];
        
        return charges.map(charge => ({
            type: charge.ChargeType,
            description: charge.Description,
            amount: charge.Amount,
            currency: charge.Currency,
            basis: charge.ChargeBasis,
            isIncluded: charge.IncludedInQuote === 'Y'
        }));
    }
    
    extractLastFreeDate(data) {
        const demurrageInfo = data.DemurrageInformation;
        if (!demurrageInfo) return null;
        
        return {
            date: demurrageInfo.LastFreeDate,
            daysRemaining: demurrageInfo.FreeDaysRemaining,
            demurrageRate: demurrageInfo.DailyRate
        };
    }
    
    extractSpecialRequirements(data) {
        const requirements = [];
        
        if (data.IsReefer === 'Y') {
            requirements.push({
                type: 'reefer',
                temperature: data.ReeferTemperature,
                temperatureUnit: data.TemperatureUnit
            });
        }
        
        if (data.IsDangerous === 'Y') {
            requirements.push({
                type: 'dangerous',
                unNumber: data.UNNumber,
                imoClass: data.IMOClass
            });
        }
        
        if (data.IsOverDimension === 'Y') {
            requirements.push({
                type: 'over-dimension',
                details: data.OverDimensionDetails
            });
        }
        
        return requirements;
    }
    
    extractInclusions(data) {
        const inclusions = [];
        const inclusionMap = {
            'THC': 'Terminal Handling Charges',
            'DOC': 'Documentation Fee',
            'BAF': 'Bunker Adjustment Factor',
            'CAF': 'Currency Adjustment Factor'
        };
        
        Object.keys(inclusionMap).forEach(key => {
            if (data[`Includes${key}`] === 'Y') {
                inclusions.push(inclusionMap[key]);
            }
        });
        
        return inclusions;
    }
    
    formatContainersForMSC(containers) {
        return containers.map(container => ({
            ContainerType: container.type,
            Quantity: container.quantity,
            Size: container.size,
            SpecialRequirements: container.specialRequirements
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
    MSCConnector,
    MSCTransformer
};