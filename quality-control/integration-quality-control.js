/**
 * ROOTUIP Integration Quality Control
 * Carrier data validation and verification system
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class IntegrationQualityControl extends EventEmitter {
    constructor() {
        super();
        
        // Carrier profiles
        this.carrierProfiles = new Map();
        
        // EDI validation schemas
        this.ediSchemas = new Map();
        
        // API response validators
        this.apiValidators = new Map();
        
        // OCR accuracy tracking
        this.ocrMetrics = {
            overall: { accuracy: 0, processed: 0, errors: 0 },
            byDocumentType: new Map(),
            byField: new Map()
        };
        
        // Data reconciliation engine
        this.reconciliationRules = new Map();
        
        // Quality scores by integration
        this.integrationScores = new Map();
        
        // Initialize components
        this.initializeCarrierProfiles();
        this.initializeEDISchemas();
        this.initializeAPIValidators();
        this.initializeReconciliationRules();
    }
    
    // Initialize carrier profiles
    initializeCarrierProfiles() {
        // Maersk profile
        this.addCarrierProfile('MAERSK', {
            name: 'Maersk Line',
            code: 'MAEU',
            formats: {
                containerId: /^(MAEU|MSKU|TRHU|SEAU)\d{7}$/,
                bookingNumber: /^[0-9]{9,10}$/,
                billOfLading: /^[0-9]{9,10}$/
            },
            apis: {
                tracking: {
                    endpoint: 'https://api.maersk.com/track',
                    rateLimit: 100,
                    authentication: 'oauth2'
                }
            },
            dataQuality: {
                expectedFields: ['container_number', 'status', 'location', 'eta', 'vessel'],
                optionalFields: ['temperature', 'humidity', 'shock_events'],
                updateFrequency: 3600 // seconds
            },
            knownIssues: [
                {
                    type: 'delayed_updates',
                    description: 'Location updates may be delayed by 2-4 hours',
                    workaround: 'Cross-reference with AIS data'
                }
            ]
        });
        
        // MSC profile
        this.addCarrierProfile('MSC', {
            name: 'Mediterranean Shipping Company',
            code: 'MSCU',
            formats: {
                containerId: /^(MSCU|MEDU)\d{7}$/,
                bookingNumber: /^[A-Z]{2}\d{8}$/,
                billOfLading: /^MEDU[A-Z0-9]{8}$/
            },
            apis: {
                tracking: {
                    endpoint: 'https://api.msc.com/track',
                    rateLimit: 50,
                    authentication: 'api_key'
                }
            },
            dataQuality: {
                expectedFields: ['container_id', 'movement_status', 'port', 'arrival_date'],
                optionalFields: ['seal_number', 'weight', 'commodity'],
                updateFrequency: 7200
            }
        });
        
        // CMA CGM profile
        this.addCarrierProfile('CMACGM', {
            name: 'CMA CGM',
            code: 'CMAU',
            formats: {
                containerId: /^(CMAU|CGMU)\d{7}$/,
                bookingNumber: /^[A-Z]{3}\d{9}$/,
                billOfLading: /^CMAU[0-9]{9}$/
            },
            apis: {
                tracking: {
                    endpoint: 'https://api.cma-cgm.com/tracking',
                    rateLimit: 75,
                    authentication: 'bearer_token'
                }
            },
            dataQuality: {
                expectedFields: ['container_ref', 'status_code', 'location_code', 'expected_arrival'],
                optionalFields: ['customs_status', 'documentation_status'],
                updateFrequency: 5400
            }
        });
    }
    
    // Add carrier profile
    addCarrierProfile(carrierId, profile) {
        this.carrierProfiles.set(carrierId, {
            ...profile,
            qualityScore: 100,
            lastValidated: null,
            validationHistory: []
        });
    }
    
    // Initialize EDI schemas
    initializeEDISchemas() {
        // UN/EDIFACT IFTSTA (Status message)
        this.addEDISchema('IFTSTA', {
            type: 'UN/EDIFACT',
            version: 'D.00B',
            segments: {
                UNH: { required: true, fields: ['messageReference', 'messageType'] },
                BGM: { required: true, fields: ['documentType', 'documentNumber'] },
                DTM: { required: true, fields: ['qualifier', 'dateTime'] },
                NAD: { required: true, fields: ['partyQualifier', 'partyId'] },
                EQD: { required: true, fields: ['equipmentType', 'equipmentId'] },
                LOC: { required: true, fields: ['locationQualifier', 'locationId'] },
                STS: { required: true, fields: ['statusType', 'statusCode'] },
                UNT: { required: true, fields: ['segmentCount', 'messageReference'] }
            },
            validation: {
                segmentOrder: ['UNH', 'BGM', 'DTM', 'NAD', 'EQD', 'LOC', 'STS', 'UNT'],
                fieldFormats: {
                    equipmentId: /^[A-Z]{4}\d{7}$/,
                    locationId: /^[A-Z]{5}$/,
                    dateTime: /^\d{12}$/
                }
            }
        });
        
        // X12 315 (Ocean Status)
        this.addEDISchema('315', {
            type: 'ANSI X12',
            version: '004010',
            segments: {
                ST: { required: true, fields: ['transactionSet', 'controlNumber'] },
                B4: { required: true, fields: ['statusCode', 'statusDate', 'statusTime'] },
                N9: { required: false, fields: ['referenceQualifier', 'referenceNumber'] },
                Q2: { required: true, fields: ['vesselCode', 'voyageNumber'] },
                SG: { required: false, loop: true, segments: ['R4', 'DTM', 'N1'] },
                SE: { required: true, fields: ['segmentCount', 'controlNumber'] }
            },
            validation: {
                loopLimits: { SG: 999 },
                conditionalFields: {
                    'B4.statusCode': ['AE', 'AF', 'AR', 'AV', 'CC', 'CD', 'CT', 'CU']
                }
            }
        });
        
        // IFTMCS (Transport Movement)
        this.addEDISchema('IFTMCS', {
            type: 'UN/EDIFACT',
            version: 'D.00B',
            segments: {
                UNH: { required: true },
                BGM: { required: true },
                TDT: { required: true, fields: ['transportStage', 'conveyanceRef'] },
                LOC: { required: true, multiple: true },
                DTM: { required: true, multiple: true },
                EQD: { required: true },
                UNT: { required: true }
            }
        });
    }
    
    // Add EDI schema
    addEDISchema(messageType, schema) {
        this.ediSchemas.set(messageType, schema);
    }
    
    // Initialize API validators
    initializeAPIValidators() {
        // Container tracking response validator
        this.addAPIValidator('container_tracking', {
            requiredFields: [
                'containerId',
                'currentStatus',
                'currentLocation',
                'lastUpdate'
            ],
            optionalFields: [
                'estimatedArrival',
                'actualArrival',
                'events',
                'vessel',
                'voyage'
            ],
            fieldValidation: {
                containerId: {
                    type: 'string',
                    pattern: /^[A-Z]{4}\d{7}$/
                },
                currentStatus: {
                    type: 'string',
                    enum: ['EMPTY', 'LOADED', 'GATE_IN', 'GATE_OUT', 'ON_VESSEL', 'DISCHARGED', 'DELIVERED']
                },
                currentLocation: {
                    type: 'object',
                    properties: {
                        type: { enum: ['PORT', 'VESSEL', 'INLAND'] },
                        code: { type: 'string' },
                        name: { type: 'string' },
                        coordinates: {
                            type: 'object',
                            properties: {
                                latitude: { type: 'number', min: -90, max: 90 },
                                longitude: { type: 'number', min: -180, max: 180 }
                            }
                        }
                    }
                },
                lastUpdate: {
                    type: 'datetime',
                    maxAge: 86400000 // 24 hours
                }
            },
            responseTime: {
                expected: 1000, // ms
                acceptable: 3000,
                timeout: 10000
            }
        });
        
        // Booking response validator
        this.addAPIValidator('booking', {
            requiredFields: [
                'bookingNumber',
                'status',
                'origin',
                'destination',
                'cargo'
            ],
            fieldValidation: {
                status: {
                    type: 'string',
                    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']
                },
                cargo: {
                    type: 'object',
                    properties: {
                        containerType: { enum: ['20GP', '40GP', '40HC', '20RF', '40RF'] },
                        quantity: { type: 'number', min: 1 },
                        weight: { type: 'number', min: 0 },
                        commodity: { type: 'string' }
                    }
                }
            }
        });
        
        // Schedule response validator
        this.addAPIValidator('schedule', {
            requiredFields: [
                'origin',
                'destination',
                'services'
            ],
            arrayValidation: {
                services: {
                    minItems: 1,
                    itemValidation: {
                        vesselName: { type: 'string' },
                        departure: { type: 'datetime' },
                        arrival: { type: 'datetime' },
                        transitTime: { type: 'number', min: 0 }
                    }
                }
            }
        });
    }
    
    // Add API validator
    addAPIValidator(apiType, validator) {
        this.apiValidators.set(apiType, validator);
    }
    
    // Initialize reconciliation rules
    initializeReconciliationRules() {
        // Container status reconciliation
        this.addReconciliationRule('container_status', {
            sources: ['carrier_api', 'edi_message', 'port_system'],
            priority: ['port_system', 'carrier_api', 'edi_message'],
            conflictResolution: 'most_recent',
            rules: [
                {
                    condition: 'all_agree',
                    action: 'accept',
                    confidence: 100
                },
                {
                    condition: 'majority_agree',
                    action: 'accept_majority',
                    confidence: 80
                },
                {
                    condition: 'timestamp_difference',
                    threshold: 3600, // 1 hour
                    action: 'accept_most_recent',
                    confidence: 70
                },
                {
                    condition: 'all_disagree',
                    action: 'flag_for_review',
                    confidence: 0
                }
            ]
        });
        
        // Location reconciliation
        this.addReconciliationRule('location', {
            sources: ['gps_tracking', 'carrier_update', 'port_notification'],
            validation: {
                maxDistance: 50, // km between reported positions
                maxTimeDiff: 7200 // 2 hours
            },
            rules: [
                {
                    condition: 'within_threshold',
                    action: 'average_position',
                    confidence: 90
                },
                {
                    condition: 'gps_available',
                    action: 'prefer_gps',
                    confidence: 95
                },
                {
                    condition: 'large_discrepancy',
                    action: 'investigate',
                    confidence: 50
                }
            ]
        });
        
        // Document reconciliation
        this.addReconciliationRule('document_data', {
            sources: ['ocr_extraction', 'edi_data', 'manual_entry'],
            fieldMapping: {
                'ocr_extraction.container_no': 'edi_data.EQD.equipmentId',
                'ocr_extraction.bol_number': 'edi_data.BGM.documentNumber'
            },
            rules: [
                {
                    field: 'container_number',
                    validation: 'checksum',
                    action: 'validate_and_correct'
                },
                {
                    field: 'amounts',
                    tolerance: 0.01,
                    action: 'accept_if_within_tolerance'
                }
            ]
        });
    }
    
    // Add reconciliation rule
    addReconciliationRule(dataType, rule) {
        this.reconciliationRules.set(dataType, rule);
    }
    
    // Validate carrier data
    async validateCarrierData(carrierId, data, dataType) {
        const profile = this.carrierProfiles.get(carrierId);
        if (!profile) {
            throw new Error(`Unknown carrier: ${carrierId}`);
        }
        
        const validation = {
            id: uuidv4(),
            carrierId,
            dataType,
            timestamp: new Date(),
            valid: true,
            score: 100,
            errors: [],
            warnings: [],
            suggestions: []
        };
        
        // Check format compliance
        if (profile.formats[dataType]) {
            const value = data[dataType];
            if (!profile.formats[dataType].test(value)) {
                validation.valid = false;
                validation.errors.push({
                    field: dataType,
                    message: `Invalid ${dataType} format for ${carrierId}`,
                    expected: profile.formats[dataType].toString(),
                    received: value
                });
                validation.score -= 30;
            }
        }
        
        // Check required fields
        const expectedFields = profile.dataQuality.expectedFields;
        for (const field of expectedFields) {
            if (!data[field]) {
                validation.errors.push({
                    field,
                    message: `Missing required field: ${field}`,
                    severity: 'high'
                });
                validation.score -= 10;
            }
        }
        
        // Check data freshness
        if (data.lastUpdate) {
            const age = Date.now() - new Date(data.lastUpdate).getTime();
            const maxAge = profile.dataQuality.updateFrequency * 1000;
            
            if (age > maxAge) {
                validation.warnings.push({
                    type: 'stale_data',
                    message: `Data is ${Math.floor(age / 3600000)} hours old`,
                    maxAge: `${profile.dataQuality.updateFrequency / 3600} hours`
                });
                validation.score -= 5;
            }
        }
        
        // Update carrier quality score
        await this.updateCarrierQuality(carrierId, validation);
        
        return validation;
    }
    
    // Validate EDI message
    async validateEDIMessage(messageType, ediContent) {
        const schema = this.ediSchemas.get(messageType);
        if (!schema) {
            throw new Error(`Unknown EDI message type: ${messageType}`);
        }
        
        const validation = {
            id: uuidv4(),
            messageType,
            timestamp: new Date(),
            valid: true,
            errors: [],
            warnings: [],
            segments: {}
        };
        
        // Parse EDI content
        const segments = this.parseEDIContent(ediContent, schema.type);
        
        // Validate segments
        for (const [segmentId, segmentSchema] of Object.entries(schema.segments)) {
            const segmentData = segments[segmentId];
            
            if (segmentSchema.required && !segmentData) {
                validation.valid = false;
                validation.errors.push({
                    segment: segmentId,
                    message: `Missing required segment: ${segmentId}`
                });
                continue;
            }
            
            if (segmentData) {
                const segmentValidation = this.validateSegment(segmentData, segmentSchema, schema);
                validation.segments[segmentId] = segmentValidation;
                
                if (!segmentValidation.valid) {
                    validation.valid = false;
                    validation.errors.push(...segmentValidation.errors);
                }
            }
        }
        
        // Validate segment order
        if (schema.validation?.segmentOrder) {
            const actualOrder = Object.keys(segments);
            const expectedOrder = schema.validation.segmentOrder;
            
            if (!this.validateSegmentOrder(actualOrder, expectedOrder)) {
                validation.warnings.push({
                    type: 'segment_order',
                    message: 'Segments are not in expected order',
                    expected: expectedOrder,
                    actual: actualOrder
                });
            }
        }
        
        return validation;
    }
    
    // Parse EDI content
    parseEDIContent(content, ediType) {
        const segments = {};
        
        if (ediType === 'UN/EDIFACT') {
            // Parse EDIFACT format
            const lines = content.split("'");
            for (const line of lines) {
                if (line.trim()) {
                    const parts = line.split('+');
                    const segmentId = parts[0];
                    segments[segmentId] = parts.slice(1);
                }
            }
        } else if (ediType === 'ANSI X12') {
            // Parse X12 format
            const lines = content.split('~');
            for (const line of lines) {
                if (line.trim()) {
                    const parts = line.split('*');
                    const segmentId = parts[0];
                    segments[segmentId] = parts.slice(1);
                }
            }
        }
        
        return segments;
    }
    
    // Validate segment
    validateSegment(segmentData, schema, fullSchema) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };
        
        // Validate fields
        if (schema.fields) {
            schema.fields.forEach((field, index) => {
                const value = segmentData[index];
                
                if (!value && schema.required) {
                    validation.valid = false;
                    validation.errors.push({
                        field,
                        position: index,
                        message: `Missing required field: ${field}`
                    });
                }
                
                // Check field format
                if (value && fullSchema.validation?.fieldFormats?.[field]) {
                    const format = fullSchema.validation.fieldFormats[field];
                    if (!format.test(value)) {
                        validation.valid = false;
                        validation.errors.push({
                            field,
                            value,
                            message: `Invalid format for ${field}`,
                            expected: format.toString()
                        });
                    }
                }
            });
        }
        
        return validation;
    }
    
    // Validate API response
    async validateAPIResponse(apiType, response, metadata = {}) {
        const validator = this.apiValidators.get(apiType);
        if (!validator) {
            throw new Error(`Unknown API type: ${apiType}`);
        }
        
        const validation = {
            id: uuidv4(),
            apiType,
            timestamp: new Date(),
            valid: true,
            score: 100,
            errors: [],
            warnings: [],
            performance: {
                responseTime: metadata.responseTime,
                statusCode: metadata.statusCode
            }
        };
        
        // Check response time
        if (metadata.responseTime) {
            if (metadata.responseTime > validator.responseTime.timeout) {
                validation.valid = false;
                validation.errors.push({
                    type: 'timeout',
                    message: `Response timeout: ${metadata.responseTime}ms`
                });
                validation.score = 0;
            } else if (metadata.responseTime > validator.responseTime.acceptable) {
                validation.warnings.push({
                    type: 'slow_response',
                    message: `Slow response time: ${metadata.responseTime}ms`,
                    expected: validator.responseTime.expected
                });
                validation.score -= 10;
            }
        }
        
        // Validate required fields
        for (const field of validator.requiredFields) {
            if (!this.hasField(response, field)) {
                validation.valid = false;
                validation.errors.push({
                    field,
                    message: `Missing required field: ${field}`
                });
                validation.score -= 15;
            }
        }
        
        // Validate field values
        if (validator.fieldValidation) {
            for (const [field, rules] of Object.entries(validator.fieldValidation)) {
                const value = this.getFieldValue(response, field);
                if (value !== undefined) {
                    const fieldValidation = this.validateFieldValue(value, rules);
                    if (!fieldValidation.valid) {
                        validation.errors.push({
                            field,
                            value,
                            ...fieldValidation.error
                        });
                        validation.score -= 10;
                    }
                }
            }
        }
        
        // Validate arrays
        if (validator.arrayValidation) {
            for (const [field, rules] of Object.entries(validator.arrayValidation)) {
                const array = response[field];
                if (Array.isArray(array)) {
                    if (rules.minItems && array.length < rules.minItems) {
                        validation.errors.push({
                            field,
                            message: `Array must have at least ${rules.minItems} items`
                        });
                        validation.score -= 10;
                    }
                    
                    // Validate each item
                    if (rules.itemValidation) {
                        array.forEach((item, index) => {
                            for (const [itemField, itemRules] of Object.entries(rules.itemValidation)) {
                                const itemValue = item[itemField];
                                const itemValidation = this.validateFieldValue(itemValue, itemRules);
                                if (!itemValidation.valid) {
                                    validation.errors.push({
                                        field: `${field}[${index}].${itemField}`,
                                        value: itemValue,
                                        ...itemValidation.error
                                    });
                                }
                            }
                        });
                    }
                }
            }
        }
        
        validation.score = Math.max(0, validation.score);
        return validation;
    }
    
    // Monitor OCR accuracy
    async monitorOCRAccuracy(documentType, ocrResult, verifiedData) {
        const accuracy = this.calculateOCRAccuracy(ocrResult, verifiedData);
        
        // Update overall metrics
        this.ocrMetrics.overall.processed++;
        this.ocrMetrics.overall.accuracy = 
            (this.ocrMetrics.overall.accuracy * (this.ocrMetrics.overall.processed - 1) + accuracy) / 
            this.ocrMetrics.overall.processed;
        
        // Update document type metrics
        if (!this.ocrMetrics.byDocumentType.has(documentType)) {
            this.ocrMetrics.byDocumentType.set(documentType, {
                accuracy: accuracy,
                processed: 1,
                commonErrors: new Map()
            });
        } else {
            const typeMetrics = this.ocrMetrics.byDocumentType.get(documentType);
            typeMetrics.processed++;
            typeMetrics.accuracy = 
                (typeMetrics.accuracy * (typeMetrics.processed - 1) + accuracy) / typeMetrics.processed;
        }
        
        // Track field-level accuracy
        for (const field of Object.keys(verifiedData)) {
            const fieldAccuracy = this.calculateFieldAccuracy(ocrResult[field], verifiedData[field]);
            
            if (!this.ocrMetrics.byField.has(field)) {
                this.ocrMetrics.byField.set(field, {
                    accuracy: fieldAccuracy,
                    processed: 1,
                    errors: []
                });
            } else {
                const fieldMetrics = this.ocrMetrics.byField.get(field);
                fieldMetrics.processed++;
                fieldMetrics.accuracy = 
                    (fieldMetrics.accuracy * (fieldMetrics.processed - 1) + fieldAccuracy) / fieldMetrics.processed;
                
                // Track common errors
                if (fieldAccuracy < 100 && ocrResult[field] !== verifiedData[field]) {
                    fieldMetrics.errors.push({
                        ocr: ocrResult[field],
                        correct: verifiedData[field],
                        documentType
                    });
                }
            }
        }
        
        // Generate improvement suggestions
        const suggestions = this.generateOCRImprovements(documentType);
        
        return {
            documentType,
            accuracy,
            fieldAccuracy: Object.entries(verifiedData).map(([field, value]) => ({
                field,
                accuracy: this.calculateFieldAccuracy(ocrResult[field], value),
                ocrValue: ocrResult[field],
                correctValue: value
            })),
            suggestions,
            timestamp: new Date()
        };
    }
    
    // Calculate OCR accuracy
    calculateOCRAccuracy(ocrResult, verifiedData) {
        let correctFields = 0;
        let totalFields = 0;
        
        for (const [field, correctValue] of Object.entries(verifiedData)) {
            totalFields++;
            if (this.normalizeValue(ocrResult[field]) === this.normalizeValue(correctValue)) {
                correctFields++;
            }
        }
        
        return totalFields > 0 ? (correctFields / totalFields) * 100 : 0;
    }
    
    // Calculate field accuracy
    calculateFieldAccuracy(ocrValue, correctValue) {
        if (!ocrValue || !correctValue) return 0;
        
        const normalizedOCR = this.normalizeValue(ocrValue);
        const normalizedCorrect = this.normalizeValue(correctValue);
        
        if (normalizedOCR === normalizedCorrect) return 100;
        
        // Calculate character-level accuracy
        const distance = this.levenshteinDistance(normalizedOCR, normalizedCorrect);
        const maxLength = Math.max(normalizedOCR.length, normalizedCorrect.length);
        
        return Math.max(0, (1 - distance / maxLength) * 100);
    }
    
    // Normalize value for comparison
    normalizeValue(value) {
        if (!value) return '';
        return value.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    
    // Levenshtein distance
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    // Reconcile data from multiple sources
    async reconcileData(dataType, sources) {
        const rule = this.reconciliationRules.get(dataType);
        if (!rule) {
            throw new Error(`No reconciliation rule for data type: ${dataType}`);
        }
        
        const reconciliation = {
            id: uuidv4(),
            dataType,
            timestamp: new Date(),
            sources: sources.map(s => ({
                name: s.name,
                timestamp: s.timestamp,
                data: s.data,
                confidence: s.confidence || 100
            })),
            result: null,
            confidence: 0,
            conflicts: [],
            method: null
        };
        
        // Check if all sources agree
        const uniqueValues = new Set(sources.map(s => JSON.stringify(s.data)));
        if (uniqueValues.size === 1) {
            reconciliation.result = sources[0].data;
            reconciliation.confidence = 100;
            reconciliation.method = 'unanimous';
            return reconciliation;
        }
        
        // Apply reconciliation rules
        for (const ruleConfig of rule.rules) {
            const result = await this.applyReconciliationRule(ruleConfig, sources, rule);
            
            if (result.applied) {
                reconciliation.result = result.data;
                reconciliation.confidence = result.confidence;
                reconciliation.method = ruleConfig.action;
                
                if (result.conflicts) {
                    reconciliation.conflicts = result.conflicts;
                }
                
                break;
            }
        }
        
        // If no rule applied, use priority
        if (!reconciliation.result && rule.priority) {
            for (const prioritySource of rule.priority) {
                const source = sources.find(s => s.name === prioritySource);
                if (source) {
                    reconciliation.result = source.data;
                    reconciliation.confidence = 60;
                    reconciliation.method = 'priority_fallback';
                    break;
                }
            }
        }
        
        // Record conflicts
        if (reconciliation.confidence < 100) {
            reconciliation.conflicts = this.identifyConflicts(sources);
        }
        
        this.emit('reconciliation:completed', reconciliation);
        
        return reconciliation;
    }
    
    // Apply reconciliation rule
    async applyReconciliationRule(ruleConfig, sources, rule) {
        switch (ruleConfig.condition) {
            case 'majority_agree':
                return this.applyMajorityRule(sources, ruleConfig);
                
            case 'timestamp_difference':
                return this.applyTimestampRule(sources, ruleConfig);
                
            case 'within_threshold':
                return this.applyThresholdRule(sources, ruleConfig, rule);
                
            case 'gps_available':
                return this.applySourcePreference(sources, 'gps_tracking', ruleConfig);
                
            default:
                return { applied: false };
        }
    }
    
    // Apply majority rule
    applyMajorityRule(sources, ruleConfig) {
        const votes = new Map();
        
        for (const source of sources) {
            const key = JSON.stringify(source.data);
            votes.set(key, (votes.get(key) || 0) + 1);
        }
        
        const majority = Math.ceil(sources.length / 2);
        for (const [dataKey, count] of votes) {
            if (count >= majority) {
                return {
                    applied: true,
                    data: JSON.parse(dataKey),
                    confidence: ruleConfig.confidence
                };
            }
        }
        
        return { applied: false };
    }
    
    // Apply timestamp rule
    applyTimestampRule(sources, ruleConfig) {
        const sortedSources = sources.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        const mostRecent = sortedSources[0];
        const timeDiff = Date.now() - new Date(mostRecent.timestamp).getTime();
        
        if (timeDiff / 1000 <= ruleConfig.threshold) {
            return {
                applied: true,
                data: mostRecent.data,
                confidence: ruleConfig.confidence
            };
        }
        
        return { applied: false };
    }
    
    // Generate OCR improvements
    generateOCRImprovements(documentType) {
        const suggestions = [];
        const typeMetrics = this.ocrMetrics.byDocumentType.get(documentType);
        
        if (!typeMetrics) return suggestions;
        
        // Overall accuracy suggestions
        if (typeMetrics.accuracy < 90) {
            suggestions.push({
                type: 'quality',
                priority: 'high',
                suggestion: 'Consider improving document scan quality or resolution'
            });
        }
        
        // Field-specific suggestions
        for (const [field, metrics] of this.ocrMetrics.byField) {
            if (metrics.accuracy < 85) {
                const commonErrors = this.analyzeCommonErrors(metrics.errors);
                
                suggestions.push({
                    type: 'field_specific',
                    field,
                    priority: 'medium',
                    suggestion: `Field '${field}' has low accuracy (${metrics.accuracy.toFixed(1)}%)`,
                    commonErrors
                });
            }
        }
        
        return suggestions;
    }
    
    // Analyze common errors
    analyzeCommonErrors(errors) {
        const patterns = new Map();
        
        for (const error of errors.slice(-100)) { // Last 100 errors
            const pattern = `${error.ocr} -> ${error.correct}`;
            patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
        }
        
        return Array.from(patterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count }));
    }
    
    // Update carrier quality
    async updateCarrierQuality(carrierId, validation) {
        const profile = this.carrierProfiles.get(carrierId);
        if (!profile) return;
        
        // Update quality score (exponential moving average)
        profile.qualityScore = profile.qualityScore * 0.9 + validation.score * 0.1;
        profile.lastValidated = new Date();
        
        // Add to history
        profile.validationHistory.push({
            timestamp: validation.timestamp,
            score: validation.score,
            errors: validation.errors.length,
            warnings: validation.warnings.length
        });
        
        // Keep only last 100 validations
        if (profile.validationHistory.length > 100) {
            profile.validationHistory.shift();
        }
        
        // Update integration scores
        this.integrationScores.set(carrierId, {
            overall: profile.qualityScore,
            lastUpdated: new Date(),
            trend: this.calculateQualityTrend(profile.validationHistory)
        });
    }
    
    // Calculate quality trend
    calculateQualityTrend(history) {
        if (history.length < 10) return 'stable';
        
        const recent = history.slice(-10);
        const older = history.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.score, 0) / older.length;
        
        const change = recentAvg - olderAvg;
        
        if (change > 5) return 'improving';
        if (change < -5) return 'declining';
        return 'stable';
    }
    
    // Helper methods
    hasField(obj, path) {
        return path.split('.').reduce((o, p) => o?.[p], obj) !== undefined;
    }
    
    getFieldValue(obj, path) {
        return path.split('.').reduce((o, p) => o?.[p], obj);
    }
    
    validateFieldValue(value, rules) {
        if (rules.type) {
            const actualType = typeof value;
            if (rules.type === 'datetime') {
                if (isNaN(Date.parse(value))) {
                    return { valid: false, error: { message: 'Invalid datetime format' } };
                }
            } else if (rules.type !== actualType) {
                return { 
                    valid: false, 
                    error: { message: `Expected type ${rules.type}, got ${actualType}` } 
                };
            }
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
            return { 
                valid: false, 
                error: { message: `Value must be one of: ${rules.enum.join(', ')}` } 
            };
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
            return { 
                valid: false, 
                error: { message: 'Value does not match expected pattern' } 
            };
        }
        
        if (rules.min !== undefined && value < rules.min) {
            return { 
                valid: false, 
                error: { message: `Value must be at least ${rules.min}` } 
            };
        }
        
        if (rules.max !== undefined && value > rules.max) {
            return { 
                valid: false, 
                error: { message: `Value must be at most ${rules.max}` } 
            };
        }
        
        return { valid: true };
    }
    
    validateSegmentOrder(actual, expected) {
        let expectedIndex = 0;
        
        for (const segment of actual) {
            if (segment === expected[expectedIndex]) {
                expectedIndex++;
            }
        }
        
        return expectedIndex === expected.length;
    }
    
    applyThresholdRule(sources, ruleConfig, rule) {
        if (rule.validation?.maxDistance && sources.every(s => s.data.coordinates)) {
            const positions = sources.map(s => s.data.coordinates);
            const center = this.calculateCenterPoint(positions);
            
            // Check if all positions are within threshold
            const allWithinThreshold = positions.every(pos => {
                const distance = this.calculateDistance(
                    center.latitude, center.longitude,
                    pos.latitude, pos.longitude
                );
                return distance <= rule.validation.maxDistance;
            });
            
            if (allWithinThreshold) {
                return {
                    applied: true,
                    data: { coordinates: center },
                    confidence: ruleConfig.confidence
                };
            }
        }
        
        return { applied: false };
    }
    
    applySourcePreference(sources, preferredSource, ruleConfig) {
        const preferred = sources.find(s => s.name === preferredSource);
        if (preferred) {
            return {
                applied: true,
                data: preferred.data,
                confidence: ruleConfig.confidence
            };
        }
        
        return { applied: false };
    }
    
    identifyConflicts(sources) {
        const conflicts = [];
        
        for (let i = 0; i < sources.length; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                if (JSON.stringify(sources[i].data) !== JSON.stringify(sources[j].data)) {
                    conflicts.push({
                        source1: sources[i].name,
                        source2: sources[j].name,
                        difference: this.calculateDifference(sources[i].data, sources[j].data)
                    });
                }
            }
        }
        
        return conflicts;
    }
    
    calculateDifference(data1, data2) {
        const differences = [];
        
        const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);
        
        for (const key of allKeys) {
            if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
                differences.push({
                    field: key,
                    value1: data1[key],
                    value2: data2[key]
                });
            }
        }
        
        return differences;
    }
    
    calculateCenterPoint(positions) {
        const sum = positions.reduce((acc, pos) => ({
            latitude: acc.latitude + pos.latitude,
            longitude: acc.longitude + pos.longitude
        }), { latitude: 0, longitude: 0 });
        
        return {
            latitude: sum.latitude / positions.length,
            longitude: sum.longitude / positions.length
        };
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
}

module.exports = IntegrationQualityControl;