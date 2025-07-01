/**
 * ROOTUIP Data Quality Framework
 * Real-time data validation and quality management
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class DataQualityFramework extends EventEmitter {
    constructor() {
        super();
        
        // Validation rules registry
        this.validationRules = new Map();
        
        // Quality metrics
        this.qualityMetrics = {
            overall: { score: 0, lastUpdated: null },
            byDataType: new Map(),
            bySource: new Map(),
            trends: []
        };
        
        // Data profiles
        this.dataProfiles = new Map();
        
        // Anomaly detection
        this.anomalyDetectors = new Map();
        
        // Quality thresholds
        this.qualityThresholds = {
            critical: 95,   // >= 95% quality score
            acceptable: 85, // >= 85% quality score
            warning: 75,    // >= 75% quality score
            poor: 0         // < 75% quality score
        };
        
        // Initialize core validation rules
        this.initializeValidationRules();
        
        // Initialize anomaly detectors
        this.initializeAnomalyDetectors();
    }
    
    // Initialize validation rules
    initializeValidationRules() {
        // Container data validation rules
        this.addValidationRule('container', {
            containerId: {
                required: true,
                type: 'string',
                pattern: /^[A-Z]{4}\d{7}$/,
                description: 'Container ID must be 4 letters followed by 7 digits'
            },
            status: {
                required: true,
                type: 'string',
                enum: ['empty', 'loaded', 'in_transit', 'at_port', 'delivered', 'damaged', 'lost'],
                description: 'Container status must be valid'
            },
            location: {
                required: true,
                type: 'object',
                properties: {
                    latitude: { type: 'number', min: -90, max: 90 },
                    longitude: { type: 'number', min: -180, max: 180 },
                    timestamp: { type: 'date', maxAge: 3600000 } // Max 1 hour old
                }
            },
            weight: {
                required: false,
                type: 'number',
                min: 0,
                max: 30000, // Max 30 tons
                unit: 'kg'
            }
        });
        
        // Shipment data validation rules
        this.addValidationRule('shipment', {
            shipmentId: {
                required: true,
                type: 'string',
                pattern: /^SHIP-\d{4}-\d{6}$/,
                unique: true
            },
            origin: {
                required: true,
                type: 'object',
                properties: {
                    port: { type: 'string', pattern: /^[A-Z]{5}$/ },
                    country: { type: 'string', length: 2 },
                    date: { type: 'date', notFuture: true }
                }
            },
            destination: {
                required: true,
                type: 'object',
                properties: {
                    port: { type: 'string', pattern: /^[A-Z]{5}$/ },
                    country: { type: 'string', length: 2 },
                    eta: { type: 'date', afterField: 'origin.date' }
                }
            },
            cargo: {
                required: true,
                type: 'object',
                properties: {
                    description: { type: 'string', minLength: 3, maxLength: 500 },
                    hsCode: { type: 'string', pattern: /^\d{6,10}$/ },
                    value: { type: 'number', min: 0 },
                    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'CNY', 'JPY'] }
                }
            }
        });
        
        // Document data validation rules
        this.addValidationRule('document', {
            documentId: {
                required: true,
                type: 'string',
                format: 'uuid'
            },
            type: {
                required: true,
                type: 'string',
                enum: ['bill_of_lading', 'commercial_invoice', 'packing_list', 'certificate_of_origin', 'customs_declaration']
            },
            fileSize: {
                required: true,
                type: 'number',
                max: 10485760 // 10MB max
            },
            checksum: {
                required: true,
                type: 'string',
                pattern: /^[a-f0-9]{64}$/ // SHA256
            }
        });
        
        // Tracking event validation rules
        this.addValidationRule('tracking_event', {
            eventId: {
                required: true,
                type: 'string',
                format: 'uuid'
            },
            timestamp: {
                required: true,
                type: 'date',
                notFuture: true,
                maxAge: 86400000 // Max 24 hours old
            },
            eventType: {
                required: true,
                type: 'string',
                enum: ['departure', 'arrival', 'loading', 'unloading', 'customs_clearance', 'gate_in', 'gate_out']
            },
            location: {
                required: true,
                type: 'object',
                customValidator: this.validateLocation.bind(this)
            }
        });
    }
    
    // Add validation rule
    addValidationRule(dataType, rules) {
        this.validationRules.set(dataType, rules);
    }
    
    // Validate data
    async validateData(dataType, data, options = {}) {
        const startTime = Date.now();
        const validationResult = {
            id: uuidv4(),
            dataType,
            timestamp: new Date(),
            valid: true,
            score: 100,
            errors: [],
            warnings: [],
            suggestions: [],
            metadata: {}
        };
        
        // Get validation rules
        const rules = this.validationRules.get(dataType);
        if (!rules) {
            validationResult.valid = false;
            validationResult.errors.push({
                field: '_dataType',
                message: `No validation rules defined for data type: ${dataType}`
            });
            return validationResult;
        }
        
        // Validate each field
        for (const [field, rule] of Object.entries(rules)) {
            const fieldResult = await this.validateField(field, data[field], rule, data);
            
            if (fieldResult.errors.length > 0) {
                validationResult.valid = false;
                validationResult.errors.push(...fieldResult.errors);
            }
            
            validationResult.warnings.push(...fieldResult.warnings);
            validationResult.suggestions.push(...fieldResult.suggestions);
            
            // Update score
            validationResult.score = Math.min(validationResult.score, fieldResult.score);
        }
        
        // Check for anomalies
        if (options.checkAnomalies) {
            const anomalies = await this.detectAnomalies(dataType, data);
            if (anomalies.length > 0) {
                validationResult.warnings.push(...anomalies.map(a => ({
                    type: 'anomaly',
                    field: a.field,
                    message: a.description,
                    severity: a.severity
                })));
                
                // Adjust score based on anomaly severity
                const maxSeverity = Math.max(...anomalies.map(a => a.severity));
                validationResult.score = Math.max(0, validationResult.score - (maxSeverity * 10));
            }
        }
        
        // Calculate quality score
        validationResult.qualityLevel = this.getQualityLevel(validationResult.score);
        
        // Update metrics
        await this.updateQualityMetrics(dataType, validationResult);
        
        // Emit validation event
        this.emit('validation:completed', validationResult);
        
        // Add performance metadata
        validationResult.metadata.validationTime = Date.now() - startTime;
        
        return validationResult;
    }
    
    // Validate individual field
    async validateField(fieldName, value, rule, fullData) {
        const result = {
            field: fieldName,
            score: 100,
            errors: [],
            warnings: [],
            suggestions: []
        };
        
        // Check required
        if (rule.required && (value === null || value === undefined || value === '')) {
            result.errors.push({
                field: fieldName,
                rule: 'required',
                message: `${fieldName} is required`
            });
            result.score = 0;
            return result;
        }
        
        // Skip validation if not required and empty
        if (!rule.required && (value === null || value === undefined || value === '')) {
            return result;
        }
        
        // Type validation
        if (rule.type && !this.validateType(value, rule.type)) {
            result.errors.push({
                field: fieldName,
                rule: 'type',
                message: `${fieldName} must be of type ${rule.type}`
            });
            result.score -= 30;
        }
        
        // Pattern validation
        if (rule.pattern && !rule.pattern.test(value)) {
            result.errors.push({
                field: fieldName,
                rule: 'pattern',
                message: `${fieldName} does not match required pattern: ${rule.description || rule.pattern}`
            });
            result.score -= 20;
        }
        
        // Enum validation
        if (rule.enum && !rule.enum.includes(value)) {
            result.errors.push({
                field: fieldName,
                rule: 'enum',
                message: `${fieldName} must be one of: ${rule.enum.join(', ')}`
            });
            result.score -= 20;
        }
        
        // Min/Max validation
        if (rule.min !== undefined && value < rule.min) {
            result.errors.push({
                field: fieldName,
                rule: 'min',
                message: `${fieldName} must be at least ${rule.min}`
            });
            result.score -= 15;
        }
        
        if (rule.max !== undefined && value > rule.max) {
            result.errors.push({
                field: fieldName,
                rule: 'max',
                message: `${fieldName} must be at most ${rule.max}`
            });
            result.score -= 15;
        }
        
        // Length validation
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            result.errors.push({
                field: fieldName,
                rule: 'minLength',
                message: `${fieldName} must be at least ${rule.minLength} characters`
            });
            result.score -= 10;
        }
        
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            result.warnings.push({
                field: fieldName,
                rule: 'maxLength',
                message: `${fieldName} exceeds recommended length of ${rule.maxLength} characters`
            });
            result.score -= 5;
        }
        
        // Date validation
        if (rule.type === 'date') {
            const date = new Date(value);
            
            if (rule.notFuture && date > new Date()) {
                result.errors.push({
                    field: fieldName,
                    rule: 'notFuture',
                    message: `${fieldName} cannot be in the future`
                });
                result.score -= 20;
            }
            
            if (rule.maxAge) {
                const age = Date.now() - date.getTime();
                if (age > rule.maxAge) {
                    result.warnings.push({
                        field: fieldName,
                        rule: 'maxAge',
                        message: `${fieldName} is older than ${rule.maxAge / 1000} seconds`
                    });
                    result.score -= 10;
                }
            }
        }
        
        // Custom validation
        if (rule.customValidator) {
            const customResult = await rule.customValidator(value, fullData);
            if (!customResult.valid) {
                result.errors.push({
                    field: fieldName,
                    rule: 'custom',
                    message: customResult.message
                });
                result.score -= customResult.penalty || 20;
            }
        }
        
        // Nested object validation
        if (rule.properties && typeof value === 'object') {
            for (const [nestedField, nestedRule] of Object.entries(rule.properties)) {
                const nestedResult = await this.validateField(
                    `${fieldName}.${nestedField}`,
                    value[nestedField],
                    nestedRule,
                    fullData
                );
                
                result.errors.push(...nestedResult.errors);
                result.warnings.push(...nestedResult.warnings);
                result.suggestions.push(...nestedResult.suggestions);
                result.score = Math.min(result.score, nestedResult.score);
            }
        }
        
        result.score = Math.max(0, result.score);
        return result;
    }
    
    // Type validation
    validateType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null;
            case 'array':
                return Array.isArray(value);
            case 'date':
                return !isNaN(Date.parse(value));
            default:
                return true;
        }
    }
    
    // Custom location validator
    validateLocation(location, data) {
        if (!location || typeof location !== 'object') {
            return { valid: false, message: 'Location must be an object' };
        }
        
        // Check for required fields
        if (location.type === 'coordinates') {
            if (!location.latitude || !location.longitude) {
                return { valid: false, message: 'Coordinates must have latitude and longitude' };
            }
            
            // Validate coordinate ranges
            if (location.latitude < -90 || location.latitude > 90) {
                return { valid: false, message: 'Latitude must be between -90 and 90' };
            }
            
            if (location.longitude < -180 || location.longitude > 180) {
                return { valid: false, message: 'Longitude must be between -180 and 180' };
            }
        } else if (location.type === 'port') {
            if (!location.portCode || !/^[A-Z]{5}$/.test(location.portCode)) {
                return { valid: false, message: 'Port code must be 5 uppercase letters' };
            }
        }
        
        return { valid: true };
    }
    
    // Initialize anomaly detectors
    initializeAnomalyDetectors() {
        // Container weight anomaly detector
        this.addAnomalyDetector('container_weight', {
            field: 'weight',
            type: 'statistical',
            method: 'zscore',
            threshold: 3, // 3 standard deviations
            windowSize: 1000,
            description: 'Detect abnormal container weights'
        });
        
        // Transit time anomaly detector
        this.addAnomalyDetector('transit_time', {
            field: 'transitTime',
            type: 'statistical',
            method: 'iqr', // Interquartile range
            multiplier: 1.5,
            description: 'Detect unusually long or short transit times'
        });
        
        // Location jump anomaly detector
        this.addAnomalyDetector('location_jump', {
            field: 'location',
            type: 'custom',
            validator: this.detectLocationJump.bind(this),
            description: 'Detect impossible location changes'
        });
        
        // Value anomaly detector
        this.addAnomalyDetector('cargo_value', {
            field: 'cargo.value',
            type: 'threshold',
            min: 100,
            max: 10000000, // $10M max
            description: 'Detect unusual cargo values'
        });
    }
    
    // Add anomaly detector
    addAnomalyDetector(name, config) {
        this.anomalyDetectors.set(name, {
            ...config,
            history: [],
            statistics: {}
        });
    }
    
    // Detect anomalies
    async detectAnomalies(dataType, data) {
        const anomalies = [];
        
        for (const [name, detector] of this.anomalyDetectors) {
            try {
                const anomaly = await this.runAnomalyDetector(detector, data);
                if (anomaly) {
                    anomalies.push({
                        detector: name,
                        field: detector.field,
                        value: this.getFieldValue(data, detector.field),
                        severity: anomaly.severity || 5,
                        description: anomaly.description || detector.description,
                        suggestion: anomaly.suggestion
                    });
                }
            } catch (error) {
                console.error(`Anomaly detector ${name} failed:`, error);
            }
        }
        
        return anomalies;
    }
    
    // Run anomaly detector
    async runAnomalyDetector(detector, data) {
        const value = this.getFieldValue(data, detector.field);
        if (value === undefined || value === null) return null;
        
        switch (detector.type) {
            case 'statistical':
                return this.detectStatisticalAnomaly(detector, value);
                
            case 'threshold':
                return this.detectThresholdAnomaly(detector, value);
                
            case 'custom':
                return detector.validator(value, data);
                
            default:
                return null;
        }
    }
    
    // Statistical anomaly detection
    detectStatisticalAnomaly(detector, value) {
        // Add to history
        detector.history.push(value);
        if (detector.history.length > detector.windowSize) {
            detector.history.shift();
        }
        
        // Need minimum samples
        if (detector.history.length < 30) return null;
        
        // Calculate statistics
        const stats = this.calculateStatistics(detector.history);
        detector.statistics = stats;
        
        if (detector.method === 'zscore') {
            const zscore = Math.abs((value - stats.mean) / stats.stdDev);
            if (zscore > detector.threshold) {
                return {
                    severity: Math.min(10, Math.floor(zscore)),
                    description: `Value ${value} is ${zscore.toFixed(1)} standard deviations from mean`,
                    suggestion: `Expected range: ${(stats.mean - detector.threshold * stats.stdDev).toFixed(2)} to ${(stats.mean + detector.threshold * stats.stdDev).toFixed(2)}`
                };
            }
        } else if (detector.method === 'iqr') {
            const lowerBound = stats.q1 - detector.multiplier * stats.iqr;
            const upperBound = stats.q3 + detector.multiplier * stats.iqr;
            
            if (value < lowerBound || value > upperBound) {
                return {
                    severity: 6,
                    description: `Value ${value} is outside expected range`,
                    suggestion: `Expected range: ${lowerBound.toFixed(2)} to ${upperBound.toFixed(2)}`
                };
            }
        }
        
        return null;
    }
    
    // Threshold anomaly detection
    detectThresholdAnomaly(detector, value) {
        if (detector.min !== undefined && value < detector.min) {
            return {
                severity: 7,
                description: `Value ${value} is below minimum threshold ${detector.min}`,
                suggestion: `Verify if this unusually low value is correct`
            };
        }
        
        if (detector.max !== undefined && value > detector.max) {
            return {
                severity: 7,
                description: `Value ${value} exceeds maximum threshold ${detector.max}`,
                suggestion: `Verify if this unusually high value is correct`
            };
        }
        
        return null;
    }
    
    // Location jump detection
    detectLocationJump(currentLocation, data) {
        // Get previous location from history
        const previousLocation = data.previousLocation;
        if (!previousLocation) return null;
        
        // Calculate distance
        const distance = this.calculateDistance(
            previousLocation.latitude,
            previousLocation.longitude,
            currentLocation.latitude,
            currentLocation.longitude
        );
        
        // Calculate time difference
        const timeDiff = (new Date(currentLocation.timestamp) - new Date(previousLocation.timestamp)) / 1000; // seconds
        
        // Calculate speed (km/h)
        const speed = (distance / timeDiff) * 3600;
        
        // Check for impossible speeds (> 1000 km/h for ships)
        if (speed > 1000) {
            return {
                severity: 9,
                description: `Impossible location change: ${distance.toFixed(2)}km in ${timeDiff}s (${speed.toFixed(0)}km/h)`,
                suggestion: 'Verify location data accuracy'
            };
        }
        
        return null;
    }
    
    // Data cleansing and normalization
    async cleanseData(dataType, data, options = {}) {
        const cleansedData = JSON.parse(JSON.stringify(data)); // Deep clone
        const changes = [];
        
        // Get validation rules
        const rules = this.validationRules.get(dataType);
        if (!rules) return { data: cleansedData, changes };
        
        // Apply cleansing rules
        for (const [field, rule] of Object.entries(rules)) {
            const value = this.getFieldValue(cleansedData, field);
            
            // Trim strings
            if (rule.type === 'string' && typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed !== value) {
                    this.setFieldValue(cleansedData, field, trimmed);
                    changes.push({
                        field,
                        action: 'trim',
                        before: value,
                        after: trimmed
                    });
                }
            }
            
            // Normalize case
            if (rule.uppercase && typeof value === 'string') {
                const upper = value.toUpperCase();
                if (upper !== value) {
                    this.setFieldValue(cleansedData, field, upper);
                    changes.push({
                        field,
                        action: 'uppercase',
                        before: value,
                        after: upper
                    });
                }
            }
            
            // Fix common patterns
            if (rule.pattern && typeof value === 'string') {
                const fixed = this.fixCommonPatterns(value, rule.pattern, field);
                if (fixed !== value) {
                    this.setFieldValue(cleansedData, field, fixed);
                    changes.push({
                        field,
                        action: 'pattern_fix',
                        before: value,
                        after: fixed
                    });
                }
            }
            
            // Convert units
            if (rule.unit && options.convertUnits) {
                const converted = this.convertUnit(value, data.unit, rule.unit);
                if (converted !== value) {
                    this.setFieldValue(cleansedData, field, converted);
                    changes.push({
                        field,
                        action: 'unit_conversion',
                        before: `${value} ${data.unit}`,
                        after: `${converted} ${rule.unit}`
                    });
                }
            }
        }
        
        // Apply business logic corrections
        if (options.applyBusinessRules) {
            const businessRuleChanges = await this.applyBusinessRules(dataType, cleansedData);
            changes.push(...businessRuleChanges);
        }
        
        return {
            originalData: data,
            cleansedData,
            changes,
            timestamp: new Date()
        };
    }
    
    // Fix common patterns
    fixCommonPatterns(value, pattern, field) {
        // Container ID fixing
        if (field === 'containerId') {
            // Remove spaces and special characters
            let fixed = value.replace(/[^A-Z0-9]/gi, '');
            
            // Ensure uppercase
            fixed = fixed.toUpperCase();
            
            // Fix common OCR errors
            fixed = fixed.replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '5');
            
            // Ensure correct format
            if (fixed.length === 11) {
                return fixed.substring(0, 4) + fixed.substring(4);
            }
        }
        
        // Port code fixing
        if (field.includes('port') && pattern.test('[A-Z]{5}')) {
            return value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 5);
        }
        
        return value;
    }
    
    // Unit conversion
    convertUnit(value, fromUnit, toUnit) {
        const conversions = {
            weight: {
                kg: { kg: 1, lb: 2.20462, ton: 0.001 },
                lb: { kg: 0.453592, lb: 1, ton: 0.000453592 },
                ton: { kg: 1000, lb: 2204.62, ton: 1 }
            },
            length: {
                m: { m: 1, ft: 3.28084, cm: 100 },
                ft: { m: 0.3048, ft: 1, cm: 30.48 },
                cm: { m: 0.01, ft: 0.0328084, cm: 1 }
            },
            temperature: {
                C: { C: (v) => v, F: (v) => v * 9/5 + 32, K: (v) => v + 273.15 },
                F: { C: (v) => (v - 32) * 5/9, F: (v) => v, K: (v) => (v - 32) * 5/9 + 273.15 },
                K: { C: (v) => v - 273.15, F: (v) => (v - 273.15) * 9/5 + 32, K: (v) => v }
            }
        };
        
        // Find conversion category
        for (const [category, units] of Object.entries(conversions)) {
            if (units[fromUnit] && units[fromUnit][toUnit]) {
                const converter = units[fromUnit][toUnit];
                return typeof converter === 'function' ? converter(value) : value * converter;
            }
        }
        
        return value;
    }
    
    // Apply business rules
    async applyBusinessRules(dataType, data) {
        const changes = [];
        
        if (dataType === 'shipment') {
            // Ensure destination date is after origin date
            if (data.origin?.date && data.destination?.eta) {
                const originDate = new Date(data.origin.date);
                const destDate = new Date(data.destination.eta);
                
                if (destDate <= originDate) {
                    // Add minimum transit time (1 day)
                    data.destination.eta = new Date(originDate.getTime() + 24 * 60 * 60 * 1000);
                    changes.push({
                        field: 'destination.eta',
                        action: 'business_rule',
                        rule: 'min_transit_time',
                        before: destDate,
                        after: data.destination.eta
                    });
                }
            }
        }
        
        return changes;
    }
    
    // Calculate statistics
    calculateStatistics(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const n = sorted.length;
        
        const mean = values.reduce((sum, v) => sum + v, 0) / n;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        
        const q1 = sorted[Math.floor(n * 0.25)];
        const q2 = sorted[Math.floor(n * 0.5)];
        const q3 = sorted[Math.floor(n * 0.75)];
        
        return {
            mean,
            median: q2,
            stdDev,
            q1,
            q2,
            q3,
            iqr: q3 - q1,
            min: sorted[0],
            max: sorted[n - 1]
        };
    }
    
    // Calculate distance between coordinates
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
    
    // Get field value from nested object
    getFieldValue(obj, path) {
        return path.split('.').reduce((o, p) => o?.[p], obj);
    }
    
    // Set field value in nested object
    setFieldValue(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((o, p) => {
            if (!o[p]) o[p] = {};
            return o[p];
        }, obj);
        target[last] = value;
    }
    
    // Get quality level
    getQualityLevel(score) {
        if (score >= this.qualityThresholds.critical) return 'critical';
        if (score >= this.qualityThresholds.acceptable) return 'acceptable';
        if (score >= this.qualityThresholds.warning) return 'warning';
        return 'poor';
    }
    
    // Update quality metrics
    async updateQualityMetrics(dataType, validationResult) {
        // Update overall score
        const currentOverall = this.qualityMetrics.overall.score || 0;
        this.qualityMetrics.overall.score = (currentOverall * 0.9 + validationResult.score * 0.1);
        this.qualityMetrics.overall.lastUpdated = new Date();
        
        // Update by data type
        if (!this.qualityMetrics.byDataType.has(dataType)) {
            this.qualityMetrics.byDataType.set(dataType, {
                score: validationResult.score,
                count: 1,
                errors: validationResult.errors.length,
                warnings: validationResult.warnings.length
            });
        } else {
            const typeMetrics = this.qualityMetrics.byDataType.get(dataType);
            typeMetrics.score = (typeMetrics.score * typeMetrics.count + validationResult.score) / (typeMetrics.count + 1);
            typeMetrics.count++;
            typeMetrics.errors += validationResult.errors.length;
            typeMetrics.warnings += validationResult.warnings.length;
        }
        
        // Add to trends
        this.qualityMetrics.trends.push({
            timestamp: new Date(),
            score: validationResult.score,
            dataType
        });
        
        // Keep only last 1000 trend points
        if (this.qualityMetrics.trends.length > 1000) {
            this.qualityMetrics.trends.shift();
        }
        
        // Emit metrics update
        this.emit('metrics:updated', this.qualityMetrics);
    }
    
    // Generate quality report
    async generateQualityReport(options = {}) {
        const report = {
            timestamp: new Date(),
            period: options.period || '24h',
            overall: {
                score: this.qualityMetrics.overall.score,
                level: this.getQualityLevel(this.qualityMetrics.overall.score),
                trend: this.calculateTrend()
            },
            byDataType: {},
            topIssues: [],
            recommendations: []
        };
        
        // Data type breakdown
        for (const [type, metrics] of this.qualityMetrics.byDataType) {
            report.byDataType[type] = {
                score: metrics.score,
                level: this.getQualityLevel(metrics.score),
                validations: metrics.count,
                errorRate: (metrics.errors / metrics.count * 100).toFixed(2) + '%',
                warningRate: (metrics.warnings / metrics.count * 100).toFixed(2) + '%'
            };
        }
        
        // Generate recommendations
        report.recommendations = this.generateRecommendations();
        
        return report;
    }
    
    // Calculate trend
    calculateTrend() {
        if (this.qualityMetrics.trends.length < 10) return 'stable';
        
        const recent = this.qualityMetrics.trends.slice(-10);
        const older = this.qualityMetrics.trends.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, t) => sum + t.score, 0) / recent.length;
        const olderAvg = older.reduce((sum, t) => sum + t.score, 0) / older.length;
        
        const change = recentAvg - olderAvg;
        
        if (change > 5) return 'improving';
        if (change < -5) return 'declining';
        return 'stable';
    }
    
    // Generate recommendations
    generateRecommendations() {
        const recommendations = [];
        
        // Check overall score
        if (this.qualityMetrics.overall.score < this.qualityThresholds.acceptable) {
            recommendations.push({
                priority: 'high',
                category: 'overall',
                recommendation: 'Overall data quality is below acceptable levels. Review validation rules and data sources.'
            });
        }
        
        // Check specific data types
        for (const [type, metrics] of this.qualityMetrics.byDataType) {
            if (metrics.score < this.qualityThresholds.warning) {
                recommendations.push({
                    priority: 'medium',
                    category: type,
                    recommendation: `${type} data quality needs improvement. Error rate: ${(metrics.errors / metrics.count * 100).toFixed(2)}%`
                });
            }
        }
        
        return recommendations;
    }
}

module.exports = DataQualityFramework;