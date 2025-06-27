/**
 * Data Processing Pipeline
 * Real-time data ingestion, standardization, and quality management
 */

const EventEmitter = require('events');
const { Pool } = require('pg');
const winston = require('winston');
const crypto = require('crypto');
const moment = require('moment');

// Data quality thresholds
const QualityThresholds = {
    EXCELLENT: 90,
    GOOD: 75,
    FAIR: 60,
    POOR: 40
};

// Processing status
const ProcessingStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    DUPLICATE: 'duplicate'
};

class DataProcessingPipeline extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = config;
        this.db = new Pool(config.database);
        
        // Processing queues
        this.queues = {
            high: [],    // Real-time critical data
            normal: [],  // Standard processing
            low: []      // Batch processing
        };
        
        // Processing metrics
        this.metrics = {
            processed: 0,
            duplicates: 0,
            errors: 0,
            avgProcessingTime: 0,
            avgQualityScore: 0
        };
        
        // Logger setup
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'data-pipeline' },
            transports: [
                new winston.transports.File({ filename: 'logs/pipeline-error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/pipeline.log' }),
                new winston.transports.Console({ level: 'debug' })
            ]
        });
        
        // Standardization rules
        this.standardizationRules = {
            containerNumber: this.standardizeContainerNumber,
            dates: this.standardizeDates,
            locations: this.standardizeLocations,
            amounts: this.standardizeAmounts,
            status: this.standardizeStatus
        };
        
        // Start processing loop
        this.startProcessing();
    }

    // Start the processing loop
    startProcessing() {
        setInterval(() => this.processQueues(), 1000); // Process every second
    }

    // Add data to processing queue
    async enqueue(data, priority = 'normal') {
        const item = {
            id: crypto.randomUUID(),
            data: data,
            priority: priority,
            timestamp: new Date(),
            attempts: 0
        };
        
        this.queues[priority].push(item);
        this.emit('dataQueued', { id: item.id, priority });
        
        return item.id;
    }

    // Process queued items
    async processQueues() {
        // Process high priority first
        if (this.queues.high.length > 0) {
            await this.processItem(this.queues.high.shift());
        }
        
        // Then normal priority
        if (this.queues.normal.length > 0) {
            await this.processItem(this.queues.normal.shift());
        }
        
        // Finally low priority
        if (this.queues.low.length > 0 && this.queues.normal.length === 0) {
            await this.processItem(this.queues.low.shift());
        }
    }

    // Process a single item
    async processItem(item) {
        if (!item) return;
        
        const startTime = Date.now();
        
        try {
            // Update processing status
            await this.updateProcessingStatus(item.id, ProcessingStatus.PROCESSING);
            
            // Step 1: Duplicate detection
            const isDuplicate = await this.detectDuplicate(item.data);
            if (isDuplicate) {
                this.metrics.duplicates++;
                await this.updateProcessingStatus(item.id, ProcessingStatus.DUPLICATE);
                this.emit('duplicateDetected', { id: item.id, data: item.data });
                return;
            }
            
            // Step 2: Data validation
            const validation = await this.validateData(item.data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Step 3: Data standardization
            const standardized = await this.standardizeData(item.data);
            
            // Step 4: Data enrichment
            const enriched = await this.enrichData(standardized);
            
            // Step 5: Quality scoring
            const qualityScore = await this.calculateQualityScore(enriched);
            
            // Step 6: Data merging (if applicable)
            const merged = await this.mergeWithExisting(enriched);
            
            // Step 7: Store processed data
            const result = await this.storeProcessedData(merged, {
                processingId: item.id,
                qualityScore: qualityScore,
                processingTime: Date.now() - startTime
            });
            
            // Update metrics
            this.updateMetrics(true, Date.now() - startTime, qualityScore);
            
            // Update status
            await this.updateProcessingStatus(item.id, ProcessingStatus.COMPLETED);
            
            // Emit completion event
            this.emit('processingCompleted', {
                id: item.id,
                resultId: result.id,
                qualityScore: qualityScore,
                processingTime: Date.now() - startTime
            });
            
        } catch (error) {
            this.logger.error('Processing error', {
                itemId: item.id,
                error: error.message,
                stack: error.stack
            });
            
            // Retry logic
            if (item.attempts < 3) {
                item.attempts++;
                this.queues[item.priority].push(item);
                this.logger.info(`Retrying item ${item.id}, attempt ${item.attempts}`);
            } else {
                await this.updateProcessingStatus(item.id, ProcessingStatus.FAILED);
                await this.storeProcessingError(item, error);
                this.updateMetrics(false, Date.now() - startTime, 0);
            }
        }
    }

    // Detect duplicate data
    async detectDuplicate(data) {
        // Generate content hash
        const contentHash = this.generateContentHash(data);
        
        // Check if hash exists in recent data
        const result = await this.db.query(`
            SELECT id FROM processed_data 
            WHERE content_hash = $1 
            AND created_at > NOW() - INTERVAL '7 days'
            LIMIT 1
        `, [contentHash]);
        
        return result.rows.length > 0;
    }

    // Generate content hash for duplicate detection
    generateContentHash(data) {
        // Extract key fields for hashing
        const keyData = {
            type: data.type,
            carrier: data.carrier,
            containerNumber: data.containerNumber,
            timestamp: data.timestamp,
            status: data.status,
            location: data.location
        };
        
        const content = JSON.stringify(keyData, Object.keys(keyData).sort());
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    // Validate data
    async validateData(data) {
        const errors = [];
        
        // Check required fields based on data type
        const requiredFields = this.getRequiredFields(data.type);
        
        for (const field of requiredFields) {
            if (!this.getNestedValue(data, field)) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        // Validate specific field formats
        if (data.containerNumber && !this.isValidContainerNumber(data.containerNumber)) {
            errors.push('Invalid container number format');
        }
        
        if (data.amount && isNaN(parseFloat(data.amount))) {
            errors.push('Invalid amount format');
        }
        
        if (data.timestamp && !moment(data.timestamp).isValid()) {
            errors.push('Invalid timestamp format');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Get required fields by data type
    getRequiredFields(dataType) {
        const fieldMap = {
            'container_status': ['containerNumber', 'status', 'timestamp'],
            'dd_charges': ['containerNumber', 'chargeType', 'amount', 'currency'],
            'booking': ['bookingNumber', 'origin', 'destination'],
            'invoice': ['invoiceNumber', 'amount', 'currency']
        };
        
        return fieldMap[dataType] || [];
    }

    // Validate container number format
    isValidContainerNumber(containerNumber) {
        // ISO 6346 standard: 4 letters + 7 digits
        const regex = /^[A-Z]{4}\d{7}$/;
        return regex.test(containerNumber);
    }

    // Standardize data
    async standardizeData(data) {
        const standardized = { ...data };
        
        // Apply standardization rules
        if (standardized.containerNumber) {
            standardized.containerNumber = this.standardizeContainerNumber(standardized.containerNumber);
        }
        
        if (standardized.timestamp) {
            standardized.timestamp = this.standardizeDates(standardized.timestamp);
        }
        
        if (standardized.location) {
            standardized.location = await this.standardizeLocations(standardized.location);
        }
        
        if (standardized.amount) {
            standardized.amount = this.standardizeAmounts(standardized.amount);
        }
        
        if (standardized.status) {
            standardized.status = this.standardizeStatus(standardized.status);
        }
        
        // Recursively standardize nested objects
        for (const key in standardized) {
            if (typeof standardized[key] === 'object' && standardized[key] !== null && !Array.isArray(standardized[key])) {
                standardized[key] = await this.standardizeData(standardized[key]);
            }
        }
        
        return standardized;
    }

    // Standardize container numbers
    standardizeContainerNumber(containerNumber) {
        if (!containerNumber) return null;
        
        // Remove spaces and convert to uppercase
        let cleaned = containerNumber.toUpperCase().replace(/\s+/g, '');
        
        // Fix common OCR errors
        cleaned = cleaned
            .replace(/O/g, '0')  // O -> 0 in digit portion
            .replace(/I/g, '1')  // I -> 1 in digit portion
            .replace(/S/g, '5')  // S -> 5 in digit portion
            .replace(/[^A-Z0-9]/g, ''); // Remove special characters
        
        // Validate format
        if (cleaned.length === 11 && /^[A-Z]{4}\d{7}$/.test(cleaned)) {
            return cleaned;
        }
        
        return containerNumber; // Return original if can't standardize
    }

    // Standardize dates
    standardizeDates(dateValue) {
        if (!dateValue) return null;
        
        // Try multiple date formats
        const formats = [
            'YYYY-MM-DD',
            'DD/MM/YYYY',
            'MM/DD/YYYY',
            'YYYY-MM-DD HH:mm:ss',
            'DD-MMM-YYYY',
            'YYYYMMDD'
        ];
        
        for (const format of formats) {
            const parsed = moment(dateValue, format, true);
            if (parsed.isValid()) {
                return parsed.toISOString();
            }
        }
        
        // Try parsing as standard date
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
        
        return dateValue; // Return original if can't parse
    }

    // Standardize locations
    async standardizeLocations(location) {
        if (!location) return null;
        
        const standardized = typeof location === 'string' ? { port: location } : { ...location };
        
        // Standardize port codes
        if (standardized.port) {
            standardized.port = await this.standardizePortCode(standardized.port);
        }
        
        // Add missing location data from database
        if (standardized.port && !standardized.country) {
            const portData = await this.getPortData(standardized.port);
            if (portData) {
                standardized.country = portData.country;
                standardized.unlocode = portData.unlocode;
                standardized.coordinates = portData.coordinates;
            }
        }
        
        return standardized;
    }

    // Standardize port codes
    async standardizePortCode(portCode) {
        if (!portCode) return null;
        
        // Convert to uppercase and trim
        let cleaned = portCode.toUpperCase().trim();
        
        // Common port code mappings
        const portMappings = {
            'LA': 'USLAX',
            'LONG BEACH': 'USLGB',
            'NEW YORK': 'USNYC',
            'SHANGHAI': 'CNSHA',
            'SINGAPORE': 'SGSIN',
            'ROTTERDAM': 'NLRTM',
            'HAMBURG': 'DEHAM'
        };
        
        if (portMappings[cleaned]) {
            return portMappings[cleaned];
        }
        
        // Check if it's already a valid UN/LOCODE (5 characters: 2 country + 3 location)
        if (/^[A-Z]{2}[A-Z0-9]{3}$/.test(cleaned)) {
            return cleaned;
        }
        
        return cleaned;
    }

    // Get port data from database
    async getPortData(portCode) {
        try {
            const result = await this.db.query(`
                SELECT code, name, country, unlocode, latitude, longitude
                FROM ports
                WHERE code = $1 OR unlocode = $1
                LIMIT 1
            `, [portCode]);
            
            if (result.rows.length > 0) {
                const port = result.rows[0];
                return {
                    code: port.code,
                    name: port.name,
                    country: port.country,
                    unlocode: port.unlocode,
                    coordinates: {
                        lat: port.latitude,
                        lng: port.longitude
                    }
                };
            }
        } catch (error) {
            this.logger.error('Port data lookup error', error);
        }
        
        return null;
    }

    // Standardize amounts
    standardizeAmounts(amount) {
        if (!amount) return null;
        
        // Remove currency symbols and commas
        const cleaned = amount.toString()
            .replace(/[$€£¥,]/g, '')
            .trim();
        
        const parsed = parseFloat(cleaned);
        
        return isNaN(parsed) ? null : parsed;
    }

    // Standardize status values
    standardizeStatus(status) {
        if (!status) return null;
        
        const cleaned = status.toString().toLowerCase().trim();
        
        // Status mappings
        const statusMap = {
            'gate in': 'gate_in',
            'gate-in': 'gate_in',
            'gatein': 'gate_in',
            'gate out': 'gate_out',
            'gate-out': 'gate_out',
            'gateout': 'gate_out',
            'loaded': 'loaded',
            'load': 'loaded',
            'discharged': 'discharged',
            'discharge': 'discharged',
            'on rail': 'on_rail',
            'rail': 'on_rail',
            'empty': 'empty_returned',
            'full': 'full_received'
        };
        
        return statusMap[cleaned] || cleaned;
    }

    // Enrich data with additional information
    async enrichData(data) {
        const enriched = { ...data };
        
        // Add processing metadata
        enriched._metadata = {
            processedAt: new Date(),
            dataVersion: '1.0',
            pipeline: 'standard'
        };
        
        // Enrich based on data type
        switch (data.type) {
            case 'container_status':
                enriched._enriched = await this.enrichContainerStatus(data);
                break;
            case 'dd_charges':
                enriched._enriched = await this.enrichDDCharges(data);
                break;
            case 'booking':
                enriched._enriched = await this.enrichBooking(data);
                break;
        }
        
        return enriched;
    }

    // Enrich container status data
    async enrichContainerStatus(data) {
        const enrichment = {};
        
        // Calculate days at location
        if (data.timestamp) {
            const daysSince = moment().diff(moment(data.timestamp), 'days');
            enrichment.daysAtLocation = daysSince;
        }
        
        // Add free time information
        if (data.lastFreeDate) {
            const freeTimeRemaining = moment(data.lastFreeDate).diff(moment(), 'days');
            enrichment.freeTimeRemaining = Math.max(0, freeTimeRemaining);
            enrichment.freeTimeExpired = freeTimeRemaining < 0;
        }
        
        // Predict next status
        enrichment.predictedNextStatus = this.predictNextStatus(data.status);
        
        return enrichment;
    }

    // Enrich D&D charges data
    async enrichDDCharges(data) {
        const enrichment = {};
        
        // Calculate charge breakdown
        if (data.amount && data.days) {
            enrichment.dailyRate = data.amount / data.days;
        }
        
        // Check dispute eligibility
        enrichment.disputeEligible = await this.checkDisputeEligibility(data);
        
        // Add charge category
        enrichment.category = data.amount > 5000 ? 'high_value' : 
                             data.amount > 1000 ? 'medium_value' : 'low_value';
        
        return enrichment;
    }

    // Enrich booking data
    async enrichBooking(data) {
        const enrichment = {};
        
        // Calculate transit time
        if (data.vessel?.etd && data.vessel?.eta) {
            const transitDays = moment(data.vessel.eta).diff(moment(data.vessel.etd), 'days');
            enrichment.transitTime = transitDays;
        }
        
        // Add route information
        if (data.origin?.port && data.destination?.port) {
            enrichment.route = `${data.origin.port}-${data.destination.port}`;
        }
        
        return enrichment;
    }

    // Predict next container status
    predictNextStatus(currentStatus) {
        const statusFlow = {
            'gate_in': 'loaded',
            'loaded': 'discharged',
            'discharged': 'gate_out',
            'gate_out': 'empty_returned',
            'on_rail': 'off_rail'
        };
        
        return statusFlow[currentStatus] || null;
    }

    // Check dispute eligibility
    async checkDisputeEligibility(charge) {
        // Basic dispute eligibility rules
        if (charge.chargeType === 'demurrage') {
            // Check for holidays, port congestion, etc.
            return true; // Simplified for demo
        }
        
        if (charge.chargeType === 'detention' && charge.days > 14) {
            // Extended detention may be disputable
            return true;
        }
        
        return false;
    }

    // Calculate quality score
    async calculateQualityScore(data) {
        let score = 100;
        const issues = [];
        
        // Check data completeness
        const requiredFields = this.getRequiredFields(data.type);
        const missingFields = requiredFields.filter(field => !this.getNestedValue(data, field));
        score -= missingFields.length * 10;
        if (missingFields.length > 0) {
            issues.push(`Missing fields: ${missingFields.join(', ')}`);
        }
        
        // Check data freshness
        if (data.timestamp) {
            const age = moment().diff(moment(data.timestamp), 'hours');
            if (age > 48) {
                score -= 20;
                issues.push('Data older than 48 hours');
            } else if (age > 24) {
                score -= 10;
                issues.push('Data older than 24 hours');
            }
        }
        
        // Check data consistency
        if (data.type === 'dd_charges') {
            if (data.amount && data.days && data.dailyRate) {
                const calculatedAmount = data.days * data.dailyRate;
                if (Math.abs(calculatedAmount - data.amount) > 0.01) {
                    score -= 15;
                    issues.push('Inconsistent charge calculation');
                }
            }
        }
        
        // Check for anomalies
        if (data.amount && data.amount > 100000) {
            score -= 10;
            issues.push('Unusually high amount');
        }
        
        // Store quality issues
        if (issues.length > 0) {
            data._qualityIssues = issues;
        }
        
        return Math.max(0, score);
    }

    // Merge with existing data
    async mergeWithExisting(data) {
        // Check for existing related data
        const existing = await this.findExistingData(data);
        
        if (!existing) {
            return data;
        }
        
        // Merge strategy based on data type
        switch (data.type) {
            case 'container_status':
                return this.mergeContainerStatus(existing, data);
            case 'dd_charges':
                return this.mergeDDCharges(existing, data);
            default:
                return data; // No merge for other types
        }
    }

    // Find existing related data
    async findExistingData(data) {
        try {
            let query, params;
            
            switch (data.type) {
                case 'container_status':
                    query = `
                        SELECT * FROM container_tracking 
                        WHERE container_number = $1 
                        AND carrier = $2
                        ORDER BY timestamp DESC 
                        LIMIT 1
                    `;
                    params = [data.containerNumber, data.carrier];
                    break;
                    
                case 'dd_charges':
                    query = `
                        SELECT * FROM dd_charges 
                        WHERE container_number = $1 
                        AND charge_type = $2
                        AND start_date = $3
                        LIMIT 1
                    `;
                    params = [data.containerNumber, data.chargeType, data.startDate];
                    break;
                    
                default:
                    return null;
            }
            
            const result = await this.db.query(query, params);
            return result.rows.length > 0 ? result.rows[0] : null;
            
        } catch (error) {
            this.logger.error('Error finding existing data', error);
            return null;
        }
    }

    // Merge container status
    mergeContainerStatus(existing, newData) {
        // Only update if new data is more recent
        if (moment(newData.timestamp).isAfter(existing.timestamp)) {
            return {
                ...existing,
                ...newData,
                previousStatus: existing.status,
                previousLocation: existing.location,
                _merged: true
            };
        }
        
        return existing;
    }

    // Merge D&D charges
    mergeDDCharges(existing, newData) {
        // Merge charge updates
        const merged = {
            ...existing,
            ...newData,
            _merged: true
        };
        
        // Keep history of changes
        merged._history = existing._history || [];
        merged._history.push({
            timestamp: new Date(),
            previousAmount: existing.amount,
            newAmount: newData.amount
        });
        
        return merged;
    }

    // Store processed data
    async storeProcessedData(data, metadata) {
        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Store in processed data table
            const result = await client.query(`
                INSERT INTO processed_data (
                    type, carrier, data, content_hash,
                    quality_score, processing_time, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [
                data.type,
                data.carrier,
                JSON.stringify(data),
                this.generateContentHash(data),
                metadata.qualityScore,
                metadata.processingTime,
                JSON.stringify(metadata)
            ]);
            
            const processedId = result.rows[0].id;
            
            // Store in specific tables based on type
            await this.storeTypeSpecificData(client, data, processedId);
            
            await client.query('COMMIT');
            
            return { id: processedId };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Store type-specific data
    async storeTypeSpecificData(client, data, processedId) {
        switch (data.type) {
            case 'container_status':
                await client.query(`
                    INSERT INTO container_tracking (
                        processed_id, container_number, carrier, status,
                        location, timestamp, vessel_name, voyage_number, data
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (container_number, carrier) 
                    DO UPDATE SET 
                        status = EXCLUDED.status,
                        location = EXCLUDED.location,
                        timestamp = EXCLUDED.timestamp,
                        vessel_name = EXCLUDED.vessel_name,
                        voyage_number = EXCLUDED.voyage_number,
                        data = EXCLUDED.data,
                        updated_at = NOW()
                `, [
                    processedId,
                    data.containerNumber,
                    data.carrier,
                    data.status,
                    JSON.stringify(data.location),
                    data.timestamp,
                    data.vessel?.name,
                    data.vessel?.voyage,
                    JSON.stringify(data)
                ]);
                break;
                
            case 'dd_charges':
                await client.query(`
                    INSERT INTO dd_charges (
                        processed_id, container_number, carrier, charge_type,
                        amount, currency, start_date, end_date, days, status, data
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    processedId,
                    data.containerNumber,
                    data.carrier,
                    data.chargeType,
                    data.amount,
                    data.currency,
                    data.startDate,
                    data.endDate,
                    data.days,
                    data.status || 'pending',
                    JSON.stringify(data)
                ]);
                break;
        }
    }

    // Update processing status
    async updateProcessingStatus(processingId, status) {
        try {
            await this.db.query(`
                UPDATE processing_queue 
                SET status = $1, updated_at = NOW()
                WHERE id = $2
            `, [status, processingId]);
        } catch (error) {
            this.logger.error('Failed to update processing status', error);
        }
    }

    // Store processing error
    async storeProcessingError(item, error) {
        try {
            await this.db.query(`
                INSERT INTO processing_errors (
                    processing_id, error_message, error_stack,
                    data, attempts
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                item.id,
                error.message,
                error.stack,
                JSON.stringify(item.data),
                item.attempts
            ]);
        } catch (dbError) {
            this.logger.error('Failed to store processing error', dbError);
        }
    }

    // Update metrics
    updateMetrics(success, processingTime, qualityScore) {
        this.metrics.processed++;
        
        if (!success) {
            this.metrics.errors++;
        }
        
        // Update average processing time
        this.metrics.avgProcessingTime = 
            (this.metrics.avgProcessingTime * (this.metrics.processed - 1) + processingTime) / 
            this.metrics.processed;
        
        // Update average quality score
        if (qualityScore > 0) {
            this.metrics.avgQualityScore = 
                (this.metrics.avgQualityScore * (this.metrics.processed - 1) + qualityScore) / 
                this.metrics.processed;
        }
    }

    // Get nested object value
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    // Get pipeline metrics
    getMetrics() {
        return {
            ...this.metrics,
            queueSizes: {
                high: this.queues.high.length,
                normal: this.queues.normal.length,
                low: this.queues.low.length
            },
            successRate: this.metrics.processed > 0 
                ? ((this.metrics.processed - this.metrics.errors) / this.metrics.processed * 100).toFixed(2) + '%'
                : '0%',
            qualityLevel: this.getQualityLevel(this.metrics.avgQualityScore)
        };
    }

    // Get quality level description
    getQualityLevel(score) {
        if (score >= QualityThresholds.EXCELLENT) return 'Excellent';
        if (score >= QualityThresholds.GOOD) return 'Good';
        if (score >= QualityThresholds.FAIR) return 'Fair';
        if (score >= QualityThresholds.POOR) return 'Poor';
        return 'Critical';
    }
}

module.exports = DataProcessingPipeline;