const fs = require('fs').promises;
const path = require('path');

class FeatureEngineering {
    constructor() {
        // Feature definitions for ML models
        this.featureDefinitions = {
            // Numerical features
            numerical: [
                'transit_time_days',
                'port_congestion_index',
                'carrier_reliability_score',
                'documentation_completeness',
                'customs_complexity_score',
                'container_value_usd',
                'days_until_eta',
                'historical_dd_rate',
                'route_risk_score',
                'seasonal_risk_factor'
            ],
            // Categorical features
            categorical: [
                'origin_port',
                'destination_port',
                'carrier_name',
                'cargo_type',
                'documentation_status',
                'customs_clearance_type',
                'container_size',
                'shipment_priority'
            ],
            // Time-based features
            temporal: [
                'day_of_week',
                'month',
                'quarter',
                'is_holiday_period',
                'is_peak_season'
            ],
            // Engineered features
            engineered: [
                'risk_composite_score',
                'historical_performance_ratio',
                'route_congestion_product',
                'time_pressure_index',
                'documentation_risk_factor'
            ]
        };

        // Feature scaling parameters (learned from training data)
        this.scalingParams = {
            mean: {},
            std: {},
            min: {},
            max: {}
        };

        // Feature importance scores (from model training)
        this.featureImportance = {};
    }

    /**
     * Extract features from raw shipment data
     */
    async extractFeatures(shipmentData) {
        const features = {};

        // Extract numerical features
        features.transit_time_days = this.calculateTransitTime(shipmentData);
        features.port_congestion_index = await this.getPortCongestion(shipmentData.destination_port);
        features.carrier_reliability_score = await this.getCarrierReliability(shipmentData.carrier);
        features.documentation_completeness = this.calculateDocCompleteness(shipmentData.documents);
        features.customs_complexity_score = this.calculateCustomsComplexity(shipmentData);
        features.container_value_usd = parseFloat(shipmentData.cargo_value) || 0;
        features.days_until_eta = this.calculateDaysUntilETA(shipmentData.eta);
        features.historical_dd_rate = await this.getHistoricalDDRate(shipmentData);
        features.route_risk_score = await this.calculateRouteRisk(shipmentData);
        features.seasonal_risk_factor = this.calculateSeasonalRisk(shipmentData.eta);

        // Extract categorical features
        features.origin_port = shipmentData.origin_port;
        features.destination_port = shipmentData.destination_port;
        features.carrier_name = shipmentData.carrier;
        features.cargo_type = shipmentData.cargo_type || 'general';
        features.documentation_status = this.getDocumentationStatus(shipmentData.documents);
        features.customs_clearance_type = shipmentData.customs_type || 'standard';
        features.container_size = shipmentData.container_size || '40ft';
        features.shipment_priority = shipmentData.priority || 'normal';

        // Extract temporal features
        const etaDate = new Date(shipmentData.eta);
        features.day_of_week = etaDate.getDay();
        features.month = etaDate.getMonth() + 1;
        features.quarter = Math.ceil(features.month / 3);
        features.is_holiday_period = this.isHolidayPeriod(etaDate);
        features.is_peak_season = this.isPeakSeason(etaDate);

        // Create engineered features
        features.risk_composite_score = this.calculateCompositeRisk(features);
        features.historical_performance_ratio = await this.getPerformanceRatio(shipmentData);
        features.route_congestion_product = features.route_risk_score * features.port_congestion_index;
        features.time_pressure_index = this.calculateTimePressure(features);
        features.documentation_risk_factor = this.calculateDocRisk(features);

        return features;
    }

    /**
     * Prepare features for ML model input
     */
    prepareForModel(features) {
        // Numerical features - normalize
        const numericalVector = this.featureDefinitions.numerical.map(feat => {
            const value = features[feat] || 0;
            return this.normalizeFeature(feat, value);
        });

        // Categorical features - one-hot encode
        const categoricalVector = this.encodeCategoricalFeatures(features);

        // Temporal features - cyclical encoding
        const temporalVector = this.encodeTemporalFeatures(features);

        // Engineered features - already normalized
        const engineeredVector = this.featureDefinitions.engineered.map(feat => {
            return features[feat] || 0;
        });

        // Combine all features
        return [
            ...numericalVector,
            ...categoricalVector,
            ...temporalVector,
            ...engineeredVector
        ];
    }

    /**
     * Calculate transit time in days
     */
    calculateTransitTime(shipmentData) {
        if (shipmentData.transit_time_days) {
            return shipmentData.transit_time_days;
        }
        
        const origin = shipmentData.origin_port;
        const destination = shipmentData.destination_port;
        
        // Use route-based estimates
        const routeTimes = {
            'CNSHA-USLAX': 14,
            'CNSHA-USNYC': 32,
            'SGSIN-USLAX': 16,
            'DEHAM-USNYC': 10,
            'NLRTM-USLGX': 18
        };
        
        const route = `${origin}-${destination}`;
        return routeTimes[route] || 21; // Default 21 days
    }

    /**
     * Get port congestion index (0-1)
     */
    async getPortCongestion(port) {
        // In production, this would fetch real-time data
        const congestionData = {
            'USLAX': 0.75, // Los Angeles - high congestion
            'USLGB': 0.80, // Long Beach - very high
            'USNYC': 0.45, // New York - moderate
            'USSAV': 0.35, // Savannah - low
            'USHOU': 0.40, // Houston - moderate
            'USOAK': 0.55, // Oakland - moderate-high
            'USSEA': 0.30, // Seattle - low
            'USMIA': 0.25  // Miami - low
        };
        
        return congestionData[port] || 0.5;
    }

    /**
     * Get carrier reliability score (0-1)
     */
    async getCarrierReliability(carrier) {
        // Based on historical performance data
        const reliabilityScores = {
            'Maersk': 0.92,
            'MSC': 0.88,
            'CMA CGM': 0.86,
            'COSCO': 0.84,
            'Hapag-Lloyd': 0.90,
            'ONE': 0.87,
            'Evergreen': 0.85,
            'Yang Ming': 0.83,
            'HMM': 0.82,
            'ZIM': 0.80
        };
        
        return reliabilityScores[carrier] || 0.75;
    }

    /**
     * Calculate documentation completeness
     */
    calculateDocCompleteness(documents) {
        if (!documents || !Array.isArray(documents)) return 0;
        
        const requiredDocs = [
            'bill_of_lading',
            'commercial_invoice',
            'packing_list',
            'certificate_of_origin',
            'customs_declaration'
        ];
        
        const presentDocs = documents.filter(doc => 
            requiredDocs.includes(doc.type) && doc.status === 'verified'
        );
        
        return presentDocs.length / requiredDocs.length;
    }

    /**
     * Calculate customs complexity score
     */
    calculateCustomsComplexity(shipmentData) {
        let complexity = 0;
        
        // Number of different products
        const productCount = shipmentData.products?.length || 1;
        complexity += Math.min(productCount / 100, 0.3);
        
        // Special requirements
        if (shipmentData.requires_inspection) complexity += 0.2;
        if (shipmentData.hazmat) complexity += 0.15;
        if (shipmentData.requires_fumigation) complexity += 0.1;
        if (shipmentData.requires_special_license) complexity += 0.15;
        
        // Country-specific complexity
        const complexCountries = ['CN', 'IN', 'BR', 'RU'];
        if (complexCountries.includes(shipmentData.origin_country)) {
            complexity += 0.1;
        }
        
        return Math.min(complexity, 1);
    }

    /**
     * Calculate days until ETA
     */
    calculateDaysUntilETA(eta) {
        const etaDate = new Date(eta);
        const today = new Date();
        const diffTime = etaDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Get historical D&D rate for route/carrier combination
     */
    async getHistoricalDDRate(shipmentData) {
        // In production, query historical database
        const baseRate = 0.15; // 15% industry average
        
        // Adjust based on carrier
        const carrierAdjustment = {
            'Maersk': 0.8,
            'MSC': 0.85,
            'CMA CGM': 0.9,
            'COSCO': 0.95,
            'Hapag-Lloyd': 0.82,
            'ONE': 0.88,
            'Evergreen': 0.92
        };
        
        const adjustment = carrierAdjustment[shipmentData.carrier] || 1;
        return baseRate * adjustment;
    }

    /**
     * Calculate route-specific risk score
     */
    async calculateRouteRisk(shipmentData) {
        const origin = shipmentData.origin_port;
        const destination = shipmentData.destination_port;
        
        // High-risk routes based on historical data
        const routeRisks = {
            'CNSHA-USLAX': 0.7,  // High volume, congestion
            'CNSHA-USLGB': 0.75, // Very high congestion
            'VNSGN-USLAX': 0.65, // Documentation issues
            'INBOM-USNYC': 0.6,  // Customs complexity
            'SGSIN-USSEA': 0.3,  // Low risk
            'DEHAM-USHOU': 0.35, // Moderate risk
            'NLRTM-USSAV': 0.25  // Low risk
        };
        
        const route = `${origin}-${destination}`;
        return routeRisks[route] || 0.5;
    }

    /**
     * Calculate seasonal risk factor
     */
    calculateSeasonalRisk(eta) {
        const date = new Date(eta);
        const month = date.getMonth() + 1;
        
        // Peak season risks
        const seasonalRisks = {
            1: 0.4,   // January - post-holiday
            2: 0.3,   // February - low
            3: 0.3,   // March - low
            4: 0.35,  // April - slight increase
            5: 0.4,   // May - moderate
            6: 0.45,  // June - summer increase
            7: 0.5,   // July - summer peak
            8: 0.6,   // August - back-to-school
            9: 0.7,   // September - pre-holiday buildup
            10: 0.8,  // October - holiday shipping
            11: 0.9,  // November - Black Friday/holiday
            12: 0.85  // December - holiday peak
        };
        
        return seasonalRisks[month] || 0.5;
    }

    /**
     * Check if date falls in holiday period
     */
    isHolidayPeriod(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        // Major holiday periods
        if (month === 11 && day >= 20) return true; // Thanksgiving
        if (month === 12 && day <= 26) return true; // Christmas
        if (month === 1 && day <= 5) return true;   // New Year
        if (month === 7 && day <= 7) return true;   // July 4th
        if (month === 2 && day >= 10 && day <= 20) return true; // Chinese New Year (approx)
        
        return false;
    }

    /**
     * Check if date falls in peak shipping season
     */
    isPeakSeason(date) {
        const month = date.getMonth() + 1;
        return month >= 8 && month <= 11; // August to November
    }

    /**
     * Get documentation status
     */
    getDocumentationStatus(documents) {
        if (!documents || documents.length === 0) return 'missing';
        
        const allVerified = documents.every(doc => doc.status === 'verified');
        if (allVerified) return 'complete';
        
        const someVerified = documents.some(doc => doc.status === 'verified');
        if (someVerified) return 'partial';
        
        return 'unverified';
    }

    /**
     * Calculate composite risk score
     */
    calculateCompositeRisk(features) {
        // Weighted combination of risk factors
        const weights = {
            port_congestion_index: 0.20,
            transit_time_days: 0.15,
            documentation_completeness: 0.25,
            carrier_reliability_score: -0.18, // Negative because higher is better
            customs_complexity_score: 0.12,
            seasonal_risk_factor: 0.10,
            route_risk_score: 0.16
        };
        
        let compositeScore = 0;
        for (const [feature, weight] of Object.entries(weights)) {
            const value = features[feature] || 0;
            compositeScore += value * weight;
        }
        
        // Normalize to 0-1 range
        return Math.max(0, Math.min(1, compositeScore));
    }

    /**
     * Get historical performance ratio
     */
    async getPerformanceRatio(shipmentData) {
        // Ratio of on-time deliveries for this route/carrier
        // In production, query historical database
        const basePerformance = 0.85;
        
        // Adjust based on carrier and route
        const carrierBonus = await this.getCarrierReliability(shipmentData.carrier) - 0.85;
        const routePenalty = await this.calculateRouteRisk(shipmentData) * 0.2;
        
        return Math.max(0.5, Math.min(1, basePerformance + carrierBonus - routePenalty));
    }

    /**
     * Calculate time pressure index
     */
    calculateTimePressure(features) {
        const daysUntilETA = features.days_until_eta || 0;
        const transitTime = features.transit_time_days || 21;
        
        // Higher pressure when close to ETA relative to transit time
        const remainingRatio = daysUntilETA / transitTime;
        
        if (remainingRatio < 0.2) return 1.0;    // Very high pressure
        if (remainingRatio < 0.4) return 0.8;    // High pressure
        if (remainingRatio < 0.6) return 0.6;    // Moderate pressure
        if (remainingRatio < 0.8) return 0.4;    // Low pressure
        return 0.2; // Very low pressure
    }

    /**
     * Calculate documentation risk factor
     */
    calculateDocRisk(features) {
        const completeness = features.documentation_completeness || 0;
        const status = features.documentation_status || 'missing';
        
        let risk = 1 - completeness;
        
        // Adjust based on status
        if (status === 'missing') risk *= 1.5;
        else if (status === 'unverified') risk *= 1.2;
        else if (status === 'partial') risk *= 1.1;
        
        return Math.min(1, risk);
    }

    /**
     * Normalize numerical feature
     */
    normalizeFeature(featureName, value) {
        // Z-score normalization
        const mean = this.scalingParams.mean[featureName] || 0;
        const std = this.scalingParams.std[featureName] || 1;
        
        return (value - mean) / std;
    }

    /**
     * One-hot encode categorical features
     */
    encodeCategoricalFeatures(features) {
        const encoded = [];
        
        // Pre-defined categorical mappings
        const portMapping = this.getPortMapping();
        const carrierMapping = this.getCarrierMapping();
        
        // Encode origin port
        const originEncoded = this.oneHotEncode(
            features.origin_port, 
            Object.keys(portMapping)
        );
        encoded.push(...originEncoded);
        
        // Encode destination port
        const destEncoded = this.oneHotEncode(
            features.destination_port,
            Object.keys(portMapping)
        );
        encoded.push(...destEncoded);
        
        // Encode carrier
        const carrierEncoded = this.oneHotEncode(
            features.carrier_name,
            Object.keys(carrierMapping)
        );
        encoded.push(...carrierEncoded);
        
        // Other categorical features
        const cargoTypes = ['general', 'reefer', 'hazmat', 'oversized', 'valuable'];
        const cargoEncoded = this.oneHotEncode(features.cargo_type, cargoTypes);
        encoded.push(...cargoEncoded);
        
        return encoded;
    }

    /**
     * Cyclical encoding for temporal features
     */
    encodeTemporalFeatures(features) {
        const encoded = [];
        
        // Day of week (0-6) - cyclical
        const dayRadians = (2 * Math.PI * features.day_of_week) / 7;
        encoded.push(Math.sin(dayRadians), Math.cos(dayRadians));
        
        // Month (1-12) - cyclical
        const monthRadians = (2 * Math.PI * (features.month - 1)) / 12;
        encoded.push(Math.sin(monthRadians), Math.cos(monthRadians));
        
        // Quarter (1-4) - cyclical
        const quarterRadians = (2 * Math.PI * (features.quarter - 1)) / 4;
        encoded.push(Math.sin(quarterRadians), Math.cos(quarterRadians));
        
        // Binary features
        encoded.push(features.is_holiday_period ? 1 : 0);
        encoded.push(features.is_peak_season ? 1 : 0);
        
        return encoded;
    }

    /**
     * Generic one-hot encoding
     */
    oneHotEncode(value, categories) {
        const encoded = new Array(categories.length).fill(0);
        const index = categories.indexOf(value);
        if (index >= 0) {
            encoded[index] = 1;
        }
        return encoded;
    }

    /**
     * Get port mapping for encoding
     */
    getPortMapping() {
        return {
            // US Ports
            'USLAX': 0, 'USLGB': 1, 'USNYC': 2, 'USSAV': 3,
            'USHOU': 4, 'USOAK': 5, 'USSEA': 6, 'USMIA': 7,
            // Asian Ports
            'CNSHA': 8, 'SGSIN': 9, 'HKHKG': 10, 'JPYOK': 11,
            'KRPUS': 12, 'TWKHH': 13, 'VNSGN': 14, 'THBKK': 15,
            // European Ports
            'DEHAM': 16, 'NLRTM': 17, 'BEANR': 18, 'GBFXT': 19,
            'FRLEH': 20, 'ITGOA': 21, 'ESBCN': 22, 'GRATH': 23,
            // Other
            'OTHER': 24
        };
    }

    /**
     * Get carrier mapping for encoding
     */
    getCarrierMapping() {
        return {
            'Maersk': 0,
            'MSC': 1,
            'CMA CGM': 2,
            'COSCO': 3,
            'Hapag-Lloyd': 4,
            'ONE': 5,
            'Evergreen': 6,
            'Yang Ming': 7,
            'HMM': 8,
            'ZIM': 9,
            'Other': 10
        };
    }

    /**
     * Load scaling parameters from training
     */
    async loadScalingParams() {
        try {
            const paramsPath = path.join(__dirname, 'models', 'scaling_params.json');
            const params = await fs.readFile(paramsPath, 'utf8');
            this.scalingParams = JSON.parse(params);
        } catch (error) {
            console.log('Using default scaling parameters');
            // Set default parameters
            this.setDefaultScalingParams();
        }
    }

    /**
     * Set default scaling parameters
     */
    setDefaultScalingParams() {
        // Default mean and std for numerical features
        this.scalingParams = {
            mean: {
                transit_time_days: 18,
                port_congestion_index: 0.5,
                carrier_reliability_score: 0.85,
                documentation_completeness: 0.9,
                customs_complexity_score: 0.3,
                container_value_usd: 50000,
                days_until_eta: 14,
                historical_dd_rate: 0.15,
                route_risk_score: 0.5,
                seasonal_risk_factor: 0.5
            },
            std: {
                transit_time_days: 7,
                port_congestion_index: 0.2,
                carrier_reliability_score: 0.1,
                documentation_completeness: 0.15,
                customs_complexity_score: 0.2,
                container_value_usd: 30000,
                days_until_eta: 10,
                historical_dd_rate: 0.05,
                route_risk_score: 0.2,
                seasonal_risk_factor: 0.2
            }
        };
    }

    /**
     * Get feature vector size
     */
    getFeatureVectorSize() {
        const numerical = this.featureDefinitions.numerical.length;
        const ports = Object.keys(this.getPortMapping()).length;
        const carriers = Object.keys(this.getCarrierMapping()).length;
        const cargoTypes = 5;
        const temporal = 8; // 6 cyclical + 2 binary
        const engineered = this.featureDefinitions.engineered.length;
        
        return numerical + (ports * 2) + carriers + cargoTypes + temporal + engineered;
    }
}

module.exports = FeatureEngineering;