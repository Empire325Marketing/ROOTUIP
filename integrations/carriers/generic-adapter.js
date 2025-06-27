// Generic Carrier Integration Adapter
// Base implementation for carriers without specific API integrations
// Can be customized for any carrier using standard formats (EDI, CSV, XML)

const { IntegrationConnector, DataTransformer } = require('../integration-framework');
const csv = require('csv-parse');
const xml2js = require('xml2js');

// Generic Carrier Connector
class GenericCarrierConnector extends IntegrationConnector {
    constructor(config) {
        super({
            ...config,
            name: config.carrierName || 'Generic Carrier',
            carrierId: config.carrierId || 'GENERIC',
            baseUrl: config.baseUrl || config.apiEndpoint,
            rateLimit: config.rateLimit || 100
        });
        
        this.authMethod = config.authMethod || 'api-key'; // 'api-key', 'basic', 'oauth2', 'custom'
        this.dataFormat = config.dataFormat || 'json'; // 'json', 'xml', 'csv', 'edi'
        this.customHeaders = config.customHeaders || {};
        
        // EDI configuration if applicable
        this.ediConfig = config.ediConfig || {
            version: '004010',
            senderQualifier: 'ZZ',
            senderId: config.senderId,
            receiverQualifier: 'ZZ',
            receiverId: config.receiverId
        };
    }
    
    async addAuthentication(config) {
        switch (this.authMethod) {
            case 'api-key':
                config.headers[this.apiKeyHeader || 'X-API-Key'] = this.apiKey;
                break;
                
            case 'basic':
                const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
                config.headers['Authorization'] = `Basic ${credentials}`;
                break;
                
            case 'bearer':
                config.headers['Authorization'] = `Bearer ${this.apiKey}`;
                break;
                
            case 'custom':
                // Allow custom authentication implementation
                if (this.customAuthHandler) {
                    config = await this.customAuthHandler(config);
                }
                break;
        }
        
        // Add any custom headers
        Object.assign(config.headers, this.customHeaders);
        
        return config;
    }
    
    async refreshAuthentication() {
        // Most generic integrations don't need token refresh
        // Can be overridden for specific implementations
        return true;
    }
    
    async validateCredentials() {
        try {
            // Try a simple endpoint to validate connection
            const testEndpoint = this.config.testEndpoint || '/status';
            const response = await this.client.get(testEndpoint);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    // Data parsing methods
    async parseResponse(response, expectedFormat) {
        const format = expectedFormat || this.dataFormat;
        const data = response.data;
        
        switch (format) {
            case 'json':
                return data; // Already parsed by axios
                
            case 'xml':
                return this.parseXML(data);
                
            case 'csv':
                return this.parseCSV(data);
                
            case 'edi':
                return this.parseEDI(data);
                
            default:
                return data;
        }
    }
    
    async parseXML(xmlData) {
        const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
            normalizeTags: true
        });
        
        return new Promise((resolve, reject) => {
            parser.parseString(xmlData, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
    
    async parseCSV(csvData) {
        return new Promise((resolve, reject) => {
            csv.parse(csvData, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            }, (err, records) => {
                if (err) reject(err);
                else resolve(records);
            });
        });
    }
    
    parseEDI(ediData) {
        // Basic EDI parsing - would need full EDI parser for production
        const segments = ediData.split(/[~\r\n]+/).filter(s => s);
        const parsed = {
            segments: [],
            data: {}
        };
        
        segments.forEach(segment => {
            const elements = segment.split('*');
            const segmentId = elements[0];
            
            parsed.segments.push({
                id: segmentId,
                elements: elements.slice(1)
            });
            
            // Extract common EDI data
            switch (segmentId) {
                case 'B04': // Bill of Lading
                    parsed.data.blNumber = elements[2];
                    parsed.data.shipmentDate = elements[3];
                    break;
                case 'N9': // Reference Numbers
                    if (elements[1] === 'BN') {
                        parsed.data.bookingNumber = elements[2];
                    } else if (elements[1] === 'CN') {
                        parsed.data.containerNumber = elements[2];
                    }
                    break;
                case 'DTM': // Date/Time
                    parsed.data.dates = parsed.data.dates || [];
                    parsed.data.dates.push({
                        qualifier: elements[1],
                        date: elements[2]
                    });
                    break;
            }
        });
        
        return parsed;
    }
    
    // Format data for sending
    async formatRequest(data, format) {
        const requestFormat = format || this.dataFormat;
        
        switch (requestFormat) {
            case 'json':
                return JSON.stringify(data);
                
            case 'xml':
                return this.buildXML(data);
                
            case 'csv':
                return this.buildCSV(data);
                
            case 'edi':
                return this.buildEDI(data);
                
            default:
                return data;
        }
    }
    
    buildXML(data) {
        const builder = new xml2js.Builder({
            rootName: 'Request',
            xmldec: { version: '1.0', encoding: 'UTF-8' }
        });
        return builder.buildObject(data);
    }
    
    buildCSV(data) {
        if (Array.isArray(data)) {
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => 
                Object.values(row).map(v => `"${v}"`).join(',')
            );
            return [headers, ...rows].join('\n');
        } else {
            const headers = Object.keys(data).join(',');
            const values = Object.values(data).map(v => `"${v}"`).join(',');
            return `${headers}\n${values}`;
        }
    }
    
    buildEDI(data) {
        // Build basic EDI format - customize based on carrier requirements
        const segments = [];
        const controlNumber = Date.now().toString().slice(-9);
        
        // ISA - Interchange Control Header
        segments.push(`ISA*00*          *00*          *${this.ediConfig.senderQualifier}*${this.ediConfig.senderId.padEnd(15)}*${this.ediConfig.receiverQualifier}*${this.ediConfig.receiverId.padEnd(15)}*${new Date().toISOString().slice(2,8)}*${new Date().toISOString().slice(11,16).replace(':','')}*U*${this.ediConfig.version}*${controlNumber}*0*P*>`);
        
        // Add data segments based on transaction type
        if (data.transactionType === '304') { // Shipping Instructions
            segments.push(`ST*304*0001`);
            segments.push(`B04*${data.blNumber || ''}*${data.bookingNumber || ''}*${data.shipmentDate || ''}`);
            // Add more segments as needed
            segments.push(`SE*3*0001`);
        }
        
        // IEA - Interchange Control Trailer
        segments.push(`IEA*1*${controlNumber}`);
        
        return segments.join('~');
    }
    
    // Generic tracking method
    async trackShipment(trackingNumber, type = 'auto') {
        return this.requestWithRetry(async () => {
            let endpoint, params;
            
            // Determine tracking type if auto
            if (type === 'auto') {
                type = this.detectTrackingType(trackingNumber);
            }
            
            // Build request based on carrier configuration
            if (this.config.endpoints?.tracking) {
                endpoint = this.config.endpoints.tracking[type] || this.config.endpoints.tracking.default;
            } else {
                endpoint = `/tracking/${type}/${trackingNumber}`;
            }
            
            const response = await this.client.get(endpoint);
            const data = await this.parseResponse(response);
            
            return this.transformer.transformInbound(data, 'tracking');
        });
    }
    
    detectTrackingType(trackingNumber) {
        // Basic detection logic
        if (/^[A-Z]{4}\d{7}$/.test(trackingNumber)) {
            return 'container';
        } else if (/^\d{10,12}$/.test(trackingNumber)) {
            return 'booking';
        } else if (/^[A-Z]{2,3}\d{8,10}$/.test(trackingNumber)) {
            return 'bill-of-lading';
        }
        return 'unknown';
    }
    
    // Generic schedule search
    async getSchedule(origin, destination, date) {
        return this.requestWithRetry(async () => {
            const endpoint = this.config.endpoints?.schedule || '/schedules/search';
            
            const params = {
                origin: origin,
                destination: destination,
                date: date
            };
            
            // Map parameters if custom mapping provided
            if (this.config.parameterMapping?.schedule) {
                const mapped = {};
                for (const [key, value] of Object.entries(params)) {
                    const mappedKey = this.config.parameterMapping.schedule[key] || key;
                    mapped[mappedKey] = value;
                }
                params = mapped;
            }
            
            const response = await this.client.get(endpoint, { params });
            const data = await this.parseResponse(response);
            
            return this.transformer.transformInbound(data, 'schedule');
        });
    }
    
    // File upload method for carriers using file-based integration
    async uploadFile(file, type) {
        return this.requestWithRetry(async () => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            
            const response = await this.client.post('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            return response.data;
        });
    }
    
    // Webhook handler for push-based integrations
    async handleWebhook(payload, signature) {
        // Verify webhook signature if configured
        if (this.config.webhookSecret) {
            const isValid = this.verifyWebhookSignature(payload, signature);
            if (!isValid) {
                throw new Error('Invalid webhook signature');
            }
        }
        
        const data = await this.parseResponse({ data: payload });
        const eventType = data.eventType || data.type || 'unknown';
        
        this.emit('webhook', {
            type: eventType,
            data: data
        });
        
        return this.transformer.transformInbound(data, `webhook-${eventType}`);
    }
    
    verifyWebhookSignature(payload, signature) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return signature === expectedSignature;
    }
}

// Generic Data Transformer
class GenericTransformer extends DataTransformer {
    constructor(config) {
        super(config);
        
        // Allow custom mappings to be provided
        this.mappings = config.mappings || {
            tracking: {
                'trackingNumber': 'tracking_number',
                'status': 'status',
                'location': 'current_location',
                'timestamp': 'last_update',
                'vessel': 'vessel_name',
                'voyage': 'voyage_number',
                'eta': 'estimated_arrival',
                'events': 'tracking_events'
            },
            schedule: {
                'origin': 'origin_port',
                'destination': 'destination_port',
                'departureDate': 'departure_date',
                'arrivalDate': 'arrival_date',
                'transitTime': 'transit_time',
                'services': 'services'
            }
        };
        
        // Status mapping can be customized per carrier
        this.statusMapping = config.statusMapping || {
            'EMPTY': 'empty',
            'FULL': 'full',
            'IN_TRANSIT': 'in_transit',
            'ARRIVED': 'arrived',
            'DELIVERED': 'delivered'
        };
    }
    
    async transformInbound(externalData, dataType) {
        // Check if custom transform function exists
        if (this.config.customTransforms?.[dataType]) {
            return this.config.customTransforms[dataType](externalData);
        }
        
        const mapping = this.mappings[dataType];
        if (!mapping) {
            // If no mapping, return data as-is with metadata
            return {
                ...externalData,
                _source: this.config.carrierId || 'generic',
                _retrievedAt: new Date().toISOString()
            };
        }
        
        const transformed = this.mapFields(externalData, mapping);
        
        // Apply generic transformations
        if (transformed.status && this.statusMapping[transformed.status]) {
            transformed.status = this.statusMapping[transformed.status];
        }
        
        if (transformed.events && Array.isArray(transformed.events)) {
            transformed.events = this.transformEvents(transformed.events);
        }
        
        // Add metadata
        transformed._source = this.config.carrierId || 'generic';
        transformed._retrievedAt = new Date().toISOString();
        
        return transformed;
    }
    
    async transformOutbound(internalData, dataType) {
        // Check if custom transform function exists
        if (this.config.customTransforms?.[`${dataType}-outbound`]) {
            return this.config.customTransforms[`${dataType}-outbound`](internalData);
        }
        
        const reverseMapping = this.createReverseMapping(this.mappings[dataType]);
        return this.mapFields(internalData, reverseMapping);
    }
    
    transformEvents(events) {
        return events.map(event => ({
            type: event.event_type || event.type,
            description: event.description || event.event_description,
            location: event.location || event.place,
            timestamp: event.timestamp || event.datetime,
            status: this.statusMapping[event.status] || event.status
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

// Factory function to create customized generic adapters
function createGenericAdapter(config) {
    const connector = new GenericCarrierConnector(config);
    connector.transformer = new GenericTransformer(config.transformerConfig || {});
    return connector;
}

module.exports = {
    GenericCarrierConnector,
    GenericTransformer,
    createGenericAdapter
};