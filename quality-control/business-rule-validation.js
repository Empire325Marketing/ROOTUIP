/**
 * ROOTUIP Business Rule Validation
 * Complex business logic validation and compliance monitoring
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class BusinessRuleValidation extends EventEmitter {
    constructor() {
        super();
        
        // Business rules registry
        this.businessRules = new Map();
        
        // Compliance profiles
        this.complianceProfiles = new Map();
        
        // Validation history
        this.validationHistory = [];
        
        // Rule execution metrics
        this.ruleMetrics = new Map();
        
        // Initialize core business rules
        this.initializeBusinessRules();
        
        // Initialize compliance profiles
        this.initializeComplianceProfiles();
    }
    
    // Initialize business rules
    initializeBusinessRules() {
        // Container number validation rules
        this.addBusinessRule('container_number_validation', {
            category: 'identifier',
            priority: 'critical',
            description: 'Validate container number format and check digit',
            rules: [
                {
                    name: 'iso6346_format',
                    condition: (data) => {
                        const containerNumber = data.containerNumber || data.containerId;
                        return /^[A-Z]{3}[UJZ]\d{6}\d$/.test(containerNumber);
                    },
                    message: 'Container number must follow ISO 6346 format',
                    severity: 'error'
                },
                {
                    name: 'check_digit_validation',
                    condition: (data) => {
                        const containerNumber = data.containerNumber || data.containerId;
                        return this.validateContainerCheckDigit(containerNumber);
                    },
                    message: 'Invalid container number check digit',
                    severity: 'error',
                    autoCorrect: true,
                    corrector: (data) => {
                        const containerNumber = data.containerNumber || data.containerId;
                        return this.correctContainerCheckDigit(containerNumber);
                    }
                }
            ]
        });
        
        // Date and time consistency rules
        this.addBusinessRule('date_time_consistency', {
            category: 'temporal',
            priority: 'high',
            description: 'Ensure date and time consistency across events',
            rules: [
                {
                    name: 'departure_before_arrival',
                    condition: (data) => {
                        if (!data.departureDate || !data.arrivalDate) return true;
                        return new Date(data.departureDate) < new Date(data.arrivalDate);
                    },
                    message: 'Departure date must be before arrival date',
                    severity: 'error'
                },
                {
                    name: 'loading_before_departure',
                    condition: (data) => {
                        if (!data.loadingDate || !data.departureDate) return true;
                        return new Date(data.loadingDate) <= new Date(data.departureDate);
                    },
                    message: 'Loading must occur before departure',
                    severity: 'error'
                },
                {
                    name: 'reasonable_transit_time',
                    condition: (data) => {
                        if (!data.origin || !data.destination || !data.departureDate || !data.arrivalDate) return true;
                        
                        const transitTime = this.calculateTransitTime(
                            data.origin, 
                            data.destination, 
                            data.departureDate, 
                            data.arrivalDate
                        );
                        
                        const expected = this.getExpectedTransitTime(data.origin, data.destination, data.transportMode);
                        return transitTime >= expected.min && transitTime <= expected.max;
                    },
                    message: 'Transit time outside reasonable range',
                    severity: 'warning',
                    metadata: (data) => {
                        const expected = this.getExpectedTransitTime(data.origin, data.destination, data.transportMode);
                        return { expectedRange: `${expected.min}-${expected.max} days` };
                    }
                }
            ]
        });
        
        // Geographic validation rules
        this.addBusinessRule('geographic_validation', {
            category: 'location',
            priority: 'high',
            description: 'Validate geographic coordinates and locations',
            rules: [
                {
                    name: 'valid_coordinates',
                    condition: (data) => {
                        if (!data.latitude || !data.longitude) return true;
                        return data.latitude >= -90 && data.latitude <= 90 &&
                               data.longitude >= -180 && data.longitude <= 180;
                    },
                    message: 'Invalid geographic coordinates',
                    severity: 'error'
                },
                {
                    name: 'port_code_validation',
                    condition: (data) => {
                        if (!data.portCode) return true;
                        return this.validatePortCode(data.portCode);
                    },
                    message: 'Invalid UN/LOCODE port code',
                    severity: 'error',
                    suggestion: (data) => {
                        return this.suggestPortCode(data.portCode, data.country);
                    }
                },
                {
                    name: 'coordinates_match_port',
                    condition: (data) => {
                        if (!data.portCode || !data.latitude || !data.longitude) return true;
                        return this.validatePortCoordinates(data.portCode, data.latitude, data.longitude);
                    },
                    message: 'Coordinates do not match port location',
                    severity: 'warning',
                    metadata: (data) => {
                        const expected = this.getPortCoordinates(data.portCode);
                        return { 
                            expectedCoordinates: expected,
                            distance: this.calculateDistance(
                                data.latitude, data.longitude,
                                expected.latitude, expected.longitude
                            )
                        };
                    }
                }
            ]
        });
        
        // Currency and unit validation rules
        this.addBusinessRule('currency_unit_validation', {
            category: 'financial',
            priority: 'medium',
            description: 'Validate currency codes and unit conversions',
            rules: [
                {
                    name: 'valid_currency_code',
                    condition: (data) => {
                        if (!data.currency) return true;
                        return this.validateCurrencyCode(data.currency);
                    },
                    message: 'Invalid ISO 4217 currency code',
                    severity: 'error'
                },
                {
                    name: 'reasonable_cargo_value',
                    condition: (data) => {
                        if (!data.cargoValue || !data.cargoType) return true;
                        const range = this.getCargoValueRange(data.cargoType, data.quantity);
                        return data.cargoValue >= range.min && data.cargoValue <= range.max;
                    },
                    message: 'Cargo value outside reasonable range',
                    severity: 'warning',
                    metadata: (data) => {
                        const range = this.getCargoValueRange(data.cargoType, data.quantity);
                        return { expectedRange: `${range.min}-${range.max} ${data.currency}` };
                    }
                },
                {
                    name: 'weight_limit_validation',
                    condition: (data) => {
                        if (!data.weight || !data.containerType) return true;
                        const limit = this.getWeightLimit(data.containerType);
                        return data.weight <= limit;
                    },
                    message: 'Weight exceeds container capacity',
                    severity: 'error',
                    metadata: (data) => {
                        return { maxWeight: this.getWeightLimit(data.containerType) };
                    }
                }
            ]
        });
        
        // Business logic compliance rules
        this.addBusinessRule('business_logic_compliance', {
            category: 'compliance',
            priority: 'high',
            description: 'Ensure compliance with business logic requirements',
            rules: [
                {
                    name: 'dangerous_goods_documentation',
                    condition: (data) => {
                        if (!data.isDangerousGoods) return true;
                        return data.dgDeclaration && data.imdgCode && data.unNumber;
                    },
                    message: 'Dangerous goods require proper documentation',
                    severity: 'critical',
                    requiredFields: ['dgDeclaration', 'imdgCode', 'unNumber', 'packingGroup']
                },
                {
                    name: 'reefer_temperature_range',
                    condition: (data) => {
                        if (!data.containerType || !data.containerType.includes('RF')) return true;
                        return data.setTemperature >= -30 && data.setTemperature <= 30;
                    },
                    message: 'Reefer temperature outside valid range',
                    severity: 'error',
                    metadata: { validRange: '-30°C to +30°C' }
                },
                {
                    name: 'customs_clearance_sequence',
                    condition: (data) => {
                        if (!data.events) return true;
                        return this.validateCustomsSequence(data.events);
                    },
                    message: 'Invalid customs clearance sequence',
                    severity: 'error',
                    expectedSequence: ['arrival_notice', 'customs_declaration', 'inspection', 'clearance', 'release']
                }
            ]
        });
        
        // Document validation rules
        this.addBusinessRule('document_validation', {
            category: 'documentation',
            priority: 'high',
            description: 'Validate shipping documents and references',
            rules: [
                {
                    name: 'bill_of_lading_format',
                    condition: (data) => {
                        if (!data.billOfLading) return true;
                        return this.validateBillOfLading(data.billOfLading, data.carrier);
                    },
                    message: 'Invalid bill of lading format',
                    severity: 'error'
                },
                {
                    name: 'hs_code_validation',
                    condition: (data) => {
                        if (!data.hsCode) return true;
                        return /^\d{6,10}$/.test(data.hsCode);
                    },
                    message: 'Invalid HS code format',
                    severity: 'error',
                    autoCorrect: true,
                    corrector: (data) => {
                        return data.hsCode.replace(/[^\d]/g, '').substring(0, 10);
                    }
                },
                {
                    name: 'invoice_completeness',
                    condition: (data) => {
                        if (!data.commercialInvoice) return true;
                        const required = ['invoiceNumber', 'date', 'seller', 'buyer', 'items', 'totalValue'];
                        return required.every(field => data.commercialInvoice[field]);
                    },
                    message: 'Commercial invoice missing required fields',
                    severity: 'error'
                }
            ]
        });
    }
    
    // Add business rule
    addBusinessRule(ruleId, ruleConfig) {
        this.businessRules.set(ruleId, {
            ...ruleConfig,
            id: ruleId,
            enabled: true,
            executionCount: 0,
            failureCount: 0,
            lastExecuted: null
        });
    }
    
    // Initialize compliance profiles
    initializeComplianceProfiles() {
        // IMO compliance profile
        this.addComplianceProfile('IMO', {
            name: 'International Maritime Organization',
            description: 'IMO regulations compliance',
            rules: [
                'container_number_validation',
                'dangerous_goods_documentation',
                'weight_limit_validation'
            ],
            requiredScore: 100
        });
        
        // US Customs compliance profile
        this.addComplianceProfile('US_CUSTOMS', {
            name: 'US Customs and Border Protection',
            description: 'CBP compliance requirements',
            rules: [
                'document_validation',
                'customs_clearance_sequence',
                'bill_of_lading_format'
            ],
            requiredScore: 95
        });
        
        // EU compliance profile
        this.addComplianceProfile('EU_CUSTOMS', {
            name: 'European Union Customs',
            description: 'EU customs compliance',
            rules: [
                'document_validation',
                'currency_unit_validation',
                'hs_code_validation'
            ],
            requiredScore: 95
        });
    }
    
    // Add compliance profile
    addComplianceProfile(profileId, profile) {
        this.complianceProfiles.set(profileId, {
            ...profile,
            id: profileId,
            lastChecked: null,
            complianceHistory: []
        });
    }
    
    // Validate data against business rules
    async validateBusinessRules(data, options = {}) {
        const validation = {
            id: uuidv4(),
            timestamp: new Date(),
            valid: true,
            score: 100,
            violations: [],
            warnings: [],
            suggestions: [],
            corrections: [],
            metadata: {}
        };
        
        // Select rules to apply
        const rulesToApply = options.rules || Array.from(this.businessRules.keys());
        
        // Apply each rule
        for (const ruleId of rulesToApply) {
            const rule = this.businessRules.get(ruleId);
            if (!rule || !rule.enabled) continue;
            
            if (options.category && rule.category !== options.category) continue;
            
            const ruleResult = await this.executeRule(rule, data);
            
            // Update metrics
            rule.executionCount++;
            rule.lastExecuted = new Date();
            
            if (!ruleResult.passed) {
                rule.failureCount++;
                validation.valid = false;
                
                // Add violations or warnings based on severity
                for (const violation of ruleResult.violations) {
                    if (violation.severity === 'error' || violation.severity === 'critical') {
                        validation.violations.push({
                            ruleId,
                            ruleName: violation.name,
                            message: violation.message,
                            severity: violation.severity,
                            metadata: violation.metadata
                        });
                        validation.score -= violation.severity === 'critical' ? 20 : 10;
                    } else if (violation.severity === 'warning') {
                        validation.warnings.push({
                            ruleId,
                            ruleName: violation.name,
                            message: violation.message,
                            metadata: violation.metadata
                        });
                        validation.score -= 5;
                    }
                    
                    // Add suggestions
                    if (violation.suggestion) {
                        validation.suggestions.push({
                            ruleId,
                            ruleName: violation.name,
                            suggestion: violation.suggestion
                        });
                    }
                    
                    // Add corrections
                    if (violation.correction) {
                        validation.corrections.push({
                            ruleId,
                            ruleName: violation.name,
                            field: violation.field,
                            originalValue: violation.originalValue,
                            correctedValue: violation.correction
                        });
                    }
                }
            }
        }
        
        // Check compliance profiles
        if (options.complianceProfiles) {
            validation.compliance = await this.checkCompliance(data, options.complianceProfiles);
        }
        
        validation.score = Math.max(0, validation.score);
        
        // Store in history
        this.validationHistory.push({
            timestamp: validation.timestamp,
            score: validation.score,
            violations: validation.violations.length,
            warnings: validation.warnings.length
        });
        
        // Keep only last 1000 validations
        if (this.validationHistory.length > 1000) {
            this.validationHistory.shift();
        }
        
        this.emit('validation:completed', validation);
        
        return validation;
    }
    
    // Execute a business rule
    async executeRule(rule, data) {
        const result = {
            passed: true,
            violations: []
        };
        
        for (const subRule of rule.rules) {
            try {
                const conditionMet = await subRule.condition(data);
                
                if (!conditionMet) {
                    result.passed = false;
                    
                    const violation = {
                        name: subRule.name,
                        message: subRule.message,
                        severity: subRule.severity
                    };
                    
                    // Add metadata if available
                    if (subRule.metadata) {
                        violation.metadata = await subRule.metadata(data);
                    }
                    
                    // Generate suggestion if available
                    if (subRule.suggestion) {
                        violation.suggestion = await subRule.suggestion(data);
                    }
                    
                    // Apply auto-correction if enabled
                    if (subRule.autoCorrect && subRule.corrector) {
                        const correction = await subRule.corrector(data);
                        violation.correction = correction;
                        violation.field = subRule.field || 'value';
                        violation.originalValue = data[violation.field];
                    }
                    
                    result.violations.push(violation);
                }
            } catch (error) {
                console.error(`Error executing rule ${subRule.name}:`, error);
                result.violations.push({
                    name: subRule.name,
                    message: `Rule execution error: ${error.message}`,
                    severity: 'error'
                });
            }
        }
        
        return result;
    }
    
    // Check compliance profiles
    async checkCompliance(data, profileIds) {
        const compliance = {};
        
        for (const profileId of profileIds) {
            const profile = this.complianceProfiles.get(profileId);
            if (!profile) continue;
            
            const profileValidation = await this.validateBusinessRules(data, {
                rules: profile.rules
            });
            
            const complianceResult = {
                profileId,
                profileName: profile.name,
                score: profileValidation.score,
                passed: profileValidation.score >= profile.requiredScore,
                requiredScore: profile.requiredScore,
                violations: profileValidation.violations,
                checkedAt: new Date()
            };
            
            // Update profile history
            profile.lastChecked = new Date();
            profile.complianceHistory.push({
                timestamp: complianceResult.checkedAt,
                score: complianceResult.score,
                passed: complianceResult.passed
            });
            
            compliance[profileId] = complianceResult;
        }
        
        return compliance;
    }
    
    // Container number validation helpers
    validateContainerCheckDigit(containerNumber) {
        if (!containerNumber || containerNumber.length !== 11) return false;
        
        const prefix = containerNumber.substring(0, 10);
        const checkDigit = parseInt(containerNumber.substring(10));
        
        const calculated = this.calculateContainerCheckDigit(prefix);
        return calculated === checkDigit;
    }
    
    calculateContainerCheckDigit(prefix) {
        const charValues = {
            'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17,
            'H': 18, 'I': 19, 'J': 20, 'K': 21, 'L': 23, 'M': 24, 'N': 25,
            'O': 26, 'P': 27, 'Q': 28, 'R': 29, 'S': 30, 'T': 31, 'U': 32,
            'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38
        };
        
        let sum = 0;
        for (let i = 0; i < prefix.length; i++) {
            const char = prefix[i];
            const value = charValues[char] || parseInt(char);
            sum += value * Math.pow(2, i);
        }
        
        return sum % 11 % 10;
    }
    
    correctContainerCheckDigit(containerNumber) {
        if (!containerNumber || containerNumber.length < 10) return containerNumber;
        
        const prefix = containerNumber.substring(0, 10);
        const correctDigit = this.calculateContainerCheckDigit(prefix);
        
        return prefix + correctDigit;
    }
    
    // Transit time helpers
    calculateTransitTime(origin, destination, departureDate, arrivalDate) {
        const departure = new Date(departureDate);
        const arrival = new Date(arrivalDate);
        const diffTime = Math.abs(arrival - departure);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    
    getExpectedTransitTime(origin, destination, mode = 'ocean') {
        // Simplified transit time expectations
        const routes = {
            'CNSHA-USOAK': { ocean: { min: 12, max: 18 } },
            'CNSHA-DEHAM': { ocean: { min: 25, max: 35 } },
            'SGSIN-USOAK': { ocean: { min: 15, max: 22 } },
            'DEHAM-USNYC': { ocean: { min: 7, max: 12 } }
        };
        
        const routeKey = `${origin}-${destination}`;
        const reverseKey = `${destination}-${origin}`;
        
        return routes[routeKey]?.[mode] || routes[reverseKey]?.[mode] || 
               { min: 1, max: 60 }; // Default range
    }
    
    // Port validation helpers
    validatePortCode(portCode) {
        // Validate UN/LOCODE format (2 letter country + 3 letter location)
        return /^[A-Z]{2}[A-Z0-9]{3}$/.test(portCode);
    }
    
    suggestPortCode(invalidCode, country) {
        // Simple suggestion based on common mistakes
        const suggestions = [];
        
        // If missing country code
        if (invalidCode.length === 3 && country) {
            suggestions.push(country.toUpperCase() + invalidCode.toUpperCase());
        }
        
        // Common port mappings
        const commonPorts = {
            'SHA': 'CNSHA',
            'SIN': 'SGSIN',
            'HAM': 'DEHAM',
            'RTM': 'NLRTM',
            'LAX': 'USLAX',
            'NYC': 'USNYC'
        };
        
        const upperCode = invalidCode.toUpperCase();
        if (commonPorts[upperCode]) {
            suggestions.push(commonPorts[upperCode]);
        }
        
        return suggestions;
    }
    
    getPortCoordinates(portCode) {
        const portCoordinates = {
            'CNSHA': { latitude: 31.2304, longitude: 121.4737 },
            'SGSIN': { latitude: 1.3521, longitude: 103.8198 },
            'DEHAM': { latitude: 53.5511, longitude: 9.9937 },
            'NLRTM': { latitude: 51.9244, longitude: 4.4777 },
            'USLAX': { latitude: 33.7701, longitude: -118.1937 },
            'USNYC': { latitude: 40.7128, longitude: -74.0060 }
        };
        
        return portCoordinates[portCode] || { latitude: 0, longitude: 0 };
    }
    
    validatePortCoordinates(portCode, latitude, longitude) {
        const expected = this.getPortCoordinates(portCode);
        const distance = this.calculateDistance(latitude, longitude, expected.latitude, expected.longitude);
        
        // Allow 50km tolerance
        return distance <= 50;
    }
    
    // Currency validation helpers
    validateCurrencyCode(currency) {
        const validCurrencies = [
            'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD',
            'SEK', 'NOK', 'DKK', 'NZD', 'ZAR', 'MXN', 'INR', 'BRL', 'RUB', 'KRW'
        ];
        
        return validCurrencies.includes(currency.toUpperCase());
    }
    
    // Cargo value validation helpers
    getCargoValueRange(cargoType, quantity = 1) {
        const ranges = {
            'electronics': { min: 1000, max: 1000000 },
            'textiles': { min: 500, max: 100000 },
            'machinery': { min: 5000, max: 5000000 },
            'food': { min: 100, max: 50000 },
            'chemicals': { min: 1000, max: 500000 },
            'automotive': { min: 10000, max: 2000000 }
        };
        
        const baseRange = ranges[cargoType.toLowerCase()] || { min: 100, max: 1000000 };
        
        return {
            min: baseRange.min * quantity,
            max: baseRange.max * quantity
        };
    }
    
    // Weight limit helpers
    getWeightLimit(containerType) {
        const limits = {
            '20GP': 28180,  // kg
            '40GP': 28750,
            '40HC': 28620,
            '20RF': 27400,
            '40RF': 27700,
            '20OT': 28180,
            '40OT': 28750,
            '20FR': 28180,
            '40FR': 39700
        };
        
        return limits[containerType] || 28000; // Default limit
    }
    
    // Customs sequence validation
    validateCustomsSequence(events) {
        const customsEvents = events
            .filter(e => e.type && e.type.includes('customs'))
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        const expectedSequence = ['arrival_notice', 'customs_declaration', 'clearance'];
        let sequenceIndex = 0;
        
        for (const event of customsEvents) {
            if (event.type === expectedSequence[sequenceIndex]) {
                sequenceIndex++;
            }
        }
        
        return sequenceIndex === expectedSequence.length;
    }
    
    // Bill of lading validation
    validateBillOfLading(billOfLading, carrier) {
        const patterns = {
            'MAERSK': /^[0-9]{9,10}$/,
            'MSC': /^MEDU[A-Z0-9]{8}$/,
            'CMA CGM': /^CMAU[0-9]{9}$/,
            'COSCO': /^COSU[0-9]{9}$/,
            'EVERGREEN': /^EGLV[0-9]{9}$/
        };
        
        const pattern = patterns[carrier];
        if (!pattern) return true; // Unknown carrier, accept
        
        return pattern.test(billOfLading);
    }
    
    // Distance calculation
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
    
    // Generate validation report
    async generateValidationReport(options = {}) {
        const report = {
            timestamp: new Date(),
            period: options.period || '24h',
            summary: {
                totalValidations: this.validationHistory.length,
                averageScore: 0,
                violationRate: 0,
                warningRate: 0
            },
            rulePerformance: {},
            complianceStatus: {},
            trends: []
        };
        
        // Calculate summary metrics
        if (this.validationHistory.length > 0) {
            const totalScore = this.validationHistory.reduce((sum, v) => sum + v.score, 0);
            const totalViolations = this.validationHistory.reduce((sum, v) => sum + v.violations, 0);
            const totalWarnings = this.validationHistory.reduce((sum, v) => sum + v.warnings, 0);
            
            report.summary.averageScore = totalScore / this.validationHistory.length;
            report.summary.violationRate = (totalViolations / this.validationHistory.length) * 100;
            report.summary.warningRate = (totalWarnings / this.validationHistory.length) * 100;
        }
        
        // Rule performance
        for (const [ruleId, rule] of this.businessRules) {
            report.rulePerformance[ruleId] = {
                name: rule.description,
                executionCount: rule.executionCount,
                failureCount: rule.failureCount,
                failureRate: rule.executionCount > 0 ? 
                    (rule.failureCount / rule.executionCount) * 100 : 0,
                lastExecuted: rule.lastExecuted
            };
        }
        
        // Compliance status
        for (const [profileId, profile] of this.complianceProfiles) {
            const recent = profile.complianceHistory.slice(-10);
            report.complianceStatus[profileId] = {
                name: profile.name,
                lastChecked: profile.lastChecked,
                recentCompliance: recent.filter(h => h.passed).length / recent.length * 100,
                trend: this.calculateComplianceTrend(profile.complianceHistory)
            };
        }
        
        return report;
    }
    
    // Calculate compliance trend
    calculateComplianceTrend(history) {
        if (history.length < 10) return 'stable';
        
        const recent = history.slice(-5);
        const older = history.slice(-10, -5);
        
        const recentRate = recent.filter(h => h.passed).length / recent.length;
        const olderRate = older.filter(h => h.passed).length / older.length;
        
        if (recentRate > olderRate + 0.1) return 'improving';
        if (recentRate < olderRate - 0.1) return 'declining';
        return 'stable';
    }
    
    // Apply corrections
    async applyCorrections(data, corrections) {
        const correctedData = JSON.parse(JSON.stringify(data)); // Deep clone
        const appliedCorrections = [];
        
        for (const correction of corrections) {
            try {
                // Apply the correction
                this.setFieldValue(correctedData, correction.field, correction.correctedValue);
                
                appliedCorrections.push({
                    ...correction,
                    applied: true,
                    timestamp: new Date()
                });
            } catch (error) {
                appliedCorrections.push({
                    ...correction,
                    applied: false,
                    error: error.message
                });
            }
        }
        
        return {
            originalData: data,
            correctedData,
            appliedCorrections,
            timestamp: new Date()
        };
    }
    
    // Helper to set nested field values
    setFieldValue(obj, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const target = parts.reduce((o, p) => {
            if (!o[p]) o[p] = {};
            return o[p];
        }, obj);
        target[last] = value;
    }
}

module.exports = BusinessRuleValidation;