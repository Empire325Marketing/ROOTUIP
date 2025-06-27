/**
 * Generic Carrier Template
 * Configurable template for carriers without specific API implementations
 * Supports multiple data formats: API, EDI, CSV, Email
 */

const { BaseCarrierConnector, DataType } = require('../core/base-connector');
const { parseString } = require('xml2js');
const csvParse = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const moment = require('moment');

class GenericCarrierConnector extends BaseCarrierConnector {
    constructor(config) {
        super({
            ...config,
            carrierId: config.carrierId || 'generic',
            carrierName: config.carrierName || 'Generic Carrier'
        });
        
        // Configurable integration methods
        this.integrationType = config.integrationType || 'api'; // api, file, email, manual
        this.dataFormat = config.dataFormat || 'json'; // json, xml, csv, excel, edi
        
        // Field mappings - customizable per carrier
        this.fieldMappings = {
            container: config.fieldMappings?.container || {
                number: 'containerNumber',
                status: 'status',
                location: 'location',
                timestamp: 'eventDate',
                vessel: 'vesselName',
                voyage: 'voyageNumber'
            },
            charges: config.fieldMappings?.charges || {
                container: 'containerNumber',
                type: 'chargeType',
                amount: 'chargeAmount',
                currency: 'currency',
                startDate: 'periodStart',
                endDate: 'periodEnd',
                days: 'chargeDays'
            },
            booking: config.fieldMappings?.booking || {
                number: 'bookingNumber',
                status: 'bookingStatus',
                origin: 'portOfLoading',
                destination: 'portOfDischarge',
                containers: 'containerList'
            }
        };
        
        // Status mapping - customizable per carrier
        this.statusMapping = config.statusMapping || {
            'GATE-IN': 'gate_in',
            'GATE-OUT': 'gate_out',
            'LOAD': 'loaded',
            'DISCHARGE': 'discharged',
            'EMPTY': 'empty_returned',
            'FULL': 'full_received'
        };
        
        // File monitoring configuration
        this.fileConfig = {
            watchDirectory: config.watchDirectory || '/data/carriers/' + this.carrierId,
            processedDirectory: config.processedDirectory || '/data/carriers/' + this.carrierId + '/processed',
            filePatterns: config.filePatterns || {
                status: /status.*\.(csv|xlsx|xml|edi)$/i,
                charges: /charges.*\.(csv|xlsx|xml|edi)$/i,
                booking: /booking.*\.(csv|xlsx|xml|edi)$/i
            }
        };
        
        // Email configuration
        this.emailConfig = {
            sender: config.emailSender,
            subjectPatterns: config.emailSubjectPatterns || {
                status: /container.*status|tracking/i,
                charges: /demurrage|detention|charges/i,
                booking: /booking.*confirm/i
            }
        };
        
        // Date format patterns
        this.dateFormats = config.dateFormats || [
            'YYYY-MM-DD',
            'DD/MM/YYYY',
            'MM/DD/YYYY',
            'YYYYMMDD',
            'DD-MMM-YYYY'
        ];
    }

    // Simple authentication for generic carriers
    async authenticate() {
        try {
            this.logger.info(`Authenticating with ${this.carrierName}`);
            
            switch (this.integrationType) {
                case 'api':
                    return await this.authenticateAPI();
                case 'file':
                    return await this.validateFileAccess();
                case 'email':
                    return await this.validateEmailConfig();
                case 'manual':
                    return true; // No auth needed for manual upload
                default:
                    throw new Error(`Unknown integration type: ${this.integrationType}`);
            }
            
        } catch (error) {
            this.logger.error(`${this.carrierName} authentication failed`, error);
            throw error;
        }
    }

    // API authentication (basic auth, API key, or OAuth)
    async authenticateAPI() {
        if (this.config.authType === 'basic') {
            this.httpClient.defaults.auth = {
                username: this.config.username,
                password: this.config.password
            };
        } else if (this.config.authType === 'apikey') {
            this.httpClient.defaults.headers[this.config.apiKeyHeader || 'X-API-Key'] = this.config.apiKey;
        } else if (this.config.authType === 'bearer') {
            this.httpClient.defaults.headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
        }
        
        // Test authentication with a simple request
        if (this.config.authTestEndpoint) {
            await this.httpClient.get(this.config.authTestEndpoint);
        }
        
        return true;
    }

    // Validate file system access
    async validateFileAccess() {
        const fs = require('fs').promises;
        
        try {
            await fs.access(this.fileConfig.watchDirectory);
            await fs.access(this.fileConfig.processedDirectory);
            return true;
        } catch (error) {
            throw new Error(`File system access error: ${error.message}`);
        }
    }

    // Validate email configuration
    async validateEmailConfig() {
        if (!this.emailConfig.sender) {
            throw new Error('Email sender pattern not configured');
        }
        return true;
    }

    // Fetch container status
    async fetchContainerStatus(containerNumber) {
        switch (this.integrationType) {
            case 'api':
                return await this.fetchContainerStatusAPI(containerNumber);
            case 'file':
                return await this.fetchContainerStatusFile(containerNumber);
            default:
                throw new Error(`Container status not supported for ${this.integrationType}`);
        }
    }

    // Fetch container status via API
    async fetchContainerStatusAPI(containerNumber) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                const endpoint = (this.config.endpoints?.tracking || '/tracking')
                    .replace('{containerNumber}', containerNumber);
                
                const response = await this.httpClient.get(endpoint);
                
                const trackingData = await this.parseResponse(response.data, 'container');
                
                await this.processData(DataType.CONTAINER_STATUS, trackingData, {
                    containerNumber: containerNumber,
                    source: 'api'
                });
                
                return trackingData;
            });
        });
    }

    // Fetch container status from files
    async fetchContainerStatusFile(containerNumber) {
        const files = await this.getUnprocessedFiles('status');
        
        for (const file of files) {
            const data = await this.parseFile(file.path, this.dataFormat);
            const containers = this.extractContainers(data);
            
            const containerData = containers.find(c => 
                this.getFieldValue(c, this.fieldMappings.container.number) === containerNumber
            );
            
            if (containerData) {
                const trackingData = this.mapContainerData(containerData);
                
                await this.processData(DataType.CONTAINER_STATUS, trackingData, {
                    containerNumber: containerNumber,
                    source: 'file',
                    fileName: file.name
                });
                
                return trackingData;
            }
        }
        
        return null;
    }

    // Parse response based on format
    async parseResponse(data, type) {
        switch (this.dataFormat) {
            case 'json':
                return this.parseJSON(data, type);
            case 'xml':
                return this.parseXML(data, type);
            case 'csv':
                return this.parseCSV(data, type);
            default:
                return data;
        }
    }

    // Parse JSON response
    parseJSON(data, type) {
        if (type === 'container') {
            return this.mapContainerData(data);
        } else if (type === 'charges') {
            return this.mapChargeData(data);
        } else if (type === 'booking') {
            return this.mapBookingData(data);
        }
        return data;
    }

    // Parse XML response
    async parseXML(data, type) {
        return new Promise((resolve, reject) => {
            parseString(data, { explicitArray: false }, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    const parsed = this.flattenXML(result);
                    resolve(this.parseJSON(parsed, type));
                }
            });
        });
    }

    // Flatten XML structure
    flattenXML(obj, prefix = '') {
        let flattened = {};
        
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                Object.assign(flattened, this.flattenXML(obj[key], prefix + key + '.'));
            } else {
                flattened[prefix + key] = obj[key];
            }
        }
        
        return flattened;
    }

    // Parse CSV response
    parseCSV(data, type) {
        const records = csvParse.parse(data, {
            columns: true,
            skip_empty_lines: true
        });
        
        if (records.length === 0) return null;
        
        if (type === 'container') {
            return this.mapContainerData(records[0]);
        } else if (type === 'charges') {
            return records.map(r => this.mapChargeData(r));
        }
        
        return records;
    }

    // Map container data using field mappings
    mapContainerData(data) {
        const mapping = this.fieldMappings.container;
        
        return {
            containerNumber: this.getFieldValue(data, mapping.number),
            status: this.mapStatus(this.getFieldValue(data, mapping.status)),
            location: {
                port: this.getFieldValue(data, mapping.location),
                terminal: this.getFieldValue(data, mapping.terminal),
                country: this.getFieldValue(data, mapping.country)
            },
            timestamp: this.parseDate(this.getFieldValue(data, mapping.timestamp)),
            vessel: {
                name: this.getFieldValue(data, mapping.vessel),
                voyage: this.getFieldValue(data, mapping.voyage)
            },
            events: this.extractEvents(data)
        };
    }

    // Map charge data using field mappings
    mapChargeData(data) {
        const mapping = this.fieldMappings.charges;
        
        return {
            containerNumber: this.getFieldValue(data, mapping.container),
            chargeType: this.getFieldValue(data, mapping.type)?.toLowerCase(),
            amount: parseFloat(this.getFieldValue(data, mapping.amount) || 0),
            currency: this.getFieldValue(data, mapping.currency),
            startDate: this.parseDate(this.getFieldValue(data, mapping.startDate)),
            endDate: this.parseDate(this.getFieldValue(data, mapping.endDate)),
            days: parseInt(this.getFieldValue(data, mapping.days) || 0),
            status: 'pending'
        };
    }

    // Map booking data using field mappings
    mapBookingData(data) {
        const mapping = this.fieldMappings.booking;
        
        return {
            bookingNumber: this.getFieldValue(data, mapping.number),
            status: this.getFieldValue(data, mapping.status),
            origin: {
                port: this.getFieldValue(data, mapping.origin)
            },
            destination: {
                port: this.getFieldValue(data, mapping.destination)
            },
            containers: this.extractContainerList(data, mapping.containers)
        };
    }

    // Get field value with multiple possible paths
    getFieldValue(data, fieldPath) {
        if (!fieldPath) return null;
        
        // Support multiple possible field names
        const paths = Array.isArray(fieldPath) ? fieldPath : [fieldPath];
        
        for (const path of paths) {
            const value = path.split('.').reduce((obj, key) => obj?.[key], data);
            if (value !== undefined && value !== null) {
                return value;
            }
        }
        
        return null;
    }

    // Map status codes
    mapStatus(status) {
        if (!status) return 'unknown';
        
        const upperStatus = status.toUpperCase();
        
        // Check exact match
        if (this.statusMapping[upperStatus]) {
            return this.statusMapping[upperStatus];
        }
        
        // Check partial match
        for (const [key, value] of Object.entries(this.statusMapping)) {
            if (upperStatus.includes(key) || key.includes(upperStatus)) {
                return value;
            }
        }
        
        return status.toLowerCase();
    }

    // Parse dates with multiple format support
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Try each configured date format
        for (const format of this.dateFormats) {
            const parsed = moment(dateStr, format, true);
            if (parsed.isValid()) {
                return parsed.toISOString();
            }
        }
        
        // Try parsing as standard date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
        
        return null;
    }

    // Extract events from data
    extractEvents(data) {
        // Look for common event array fields
        const eventFields = ['events', 'history', 'movements', 'statusHistory'];
        
        for (const field of eventFields) {
            const events = data[field];
            if (Array.isArray(events)) {
                return events.map(event => ({
                    type: this.mapStatus(event.status || event.type),
                    location: event.location || event.port,
                    timestamp: this.parseDate(event.date || event.timestamp),
                    description: event.description || event.remarks
                }));
            }
        }
        
        return [];
    }

    // Extract container list
    extractContainerList(data, fieldPath) {
        const containers = this.getFieldValue(data, fieldPath);
        
        if (!containers) return [];
        
        if (Array.isArray(containers)) {
            return containers.map(c => ({
                number: c.containerNumber || c.number,
                type: c.type || c.containerType,
                size: c.size || c.containerSize
            }));
        }
        
        // Handle comma-separated list
        if (typeof containers === 'string' && containers.includes(',')) {
            return containers.split(',').map(num => ({
                number: num.trim()
            }));
        }
        
        return [];
    }

    // Get unprocessed files
    async getUnprocessedFiles(type) {
        const fs = require('fs').promises;
        const files = await fs.readdir(this.fileConfig.watchDirectory);
        
        const pattern = this.fileConfig.filePatterns[type];
        
        return files
            .filter(file => pattern.test(file))
            .map(file => ({
                name: file,
                path: `${this.fileConfig.watchDirectory}/${file}`
            }));
    }

    // Process file upload
    async processFileUpload(file, type) {
        try {
            const data = await this.parseFile(file.path, this.dataFormat);
            
            switch (type) {
                case 'status':
                    return await this.processStatusFile(data);
                case 'charges':
                    return await this.processChargesFile(data);
                case 'booking':
                    return await this.processBookingFile(data);
                default:
                    throw new Error(`Unknown file type: ${type}`);
            }
            
        } catch (error) {
            this.logger.error('File processing error', error);
            throw error;
        }
    }

    // Process status file
    async processStatusFile(data) {
        const containers = this.extractContainers(data);
        const results = [];
        
        for (const container of containers) {
            const trackingData = this.mapContainerData(container);
            
            const result = await this.processData(DataType.CONTAINER_STATUS, trackingData, {
                source: 'file_upload'
            });
            
            results.push(result);
        }
        
        return {
            processed: results.length,
            results: results
        };
    }

    // Extract containers from various data structures
    extractContainers(data) {
        // Handle array of containers
        if (Array.isArray(data)) {
            return data;
        }
        
        // Look for common container array fields
        const containerFields = ['containers', 'data', 'records', 'items'];
        
        for (const field of containerFields) {
            if (data[field] && Array.isArray(data[field])) {
                return data[field];
            }
        }
        
        // Single container
        return [data];
    }

    // Override standardizeData for generic formatting
    async standardizeData(dataType, rawData) {
        const standardized = await super.standardizeData(dataType, rawData);
        
        // Add generic carrier fields
        standardized.carrier = this.carrierId.toUpperCase();
        standardized.source = `${this.carrierName} (${this.integrationType})`;
        
        return standardized;
    }

    // Get carrier-specific metadata
    getCarrierMetadata() {
        return {
            carrier: this.carrierName,
            carrierCode: this.carrierId.toUpperCase(),
            integrationType: this.integrationType,
            dataFormat: this.dataFormat,
            supportedFeatures: this.getSupportedFeatures(),
            fieldMappings: this.fieldMappings,
            statusMapping: this.statusMapping
        };
    }

    // Get supported features based on configuration
    getSupportedFeatures() {
        const features = [];
        
        if (this.integrationType === 'api' || this.integrationType === 'file') {
            features.push('container_tracking');
        }
        
        if (this.config.endpoints?.charges || this.fileConfig.filePatterns.charges) {
            features.push('dd_charges');
        }
        
        if (this.config.endpoints?.booking || this.fileConfig.filePatterns.booking) {
            features.push('booking_management');
        }
        
        if (this.integrationType === 'file') {
            features.push('file_upload');
        }
        
        if (this.integrationType === 'email') {
            features.push('email_processing');
        }
        
        return features;
    }
}

module.exports = GenericCarrierConnector;