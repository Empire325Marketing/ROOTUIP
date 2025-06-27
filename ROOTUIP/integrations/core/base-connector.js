/**
 * Base Connector Class for Carrier Integrations
 * Provides common functionality for all carrier connections
 */

const EventEmitter = require('events');
const axios = require('axios');
const { Parser } = require('xml2js');
const csv = require('csv-parse');
const winston = require('winston');
const { Pool } = require('pg');
const crypto = require('crypto');

// Integration status enum
const IntegrationStatus = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
    CONNECTING: 'connecting',
    RATE_LIMITED: 'rate_limited',
    MAINTENANCE: 'maintenance'
};

// Data types enum
const DataType = {
    CONTAINER_STATUS: 'container_status',
    DD_CHARGES: 'dd_charges',
    BOOKING: 'booking',
    INVOICE: 'invoice',
    SCHEDULE: 'schedule',
    PORT_EVENT: 'port_event'
};

// Base Carrier Connector Class
class BaseCarrierConnector extends EventEmitter {
    constructor(config) {
        super();
        
        this.carrierId = config.carrierId;
        this.carrierName = config.carrierName;
        this.companyId = config.companyId;
        this.integrationId = config.integrationId;
        
        // Configuration
        this.config = {
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            username: config.username,
            password: config.password,
            rateLimit: config.rateLimit || 100, // requests per minute
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000, // ms
            timeout: config.timeout || 30000, // 30 seconds
            ...config
        };
        
        // State management
        this.status = IntegrationStatus.DISCONNECTED;
        this.lastSync = null;
        this.errorCount = 0;
        this.successCount = 0;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            dataProcessed: 0,
            lastError: null
        };
        
        // Rate limiting
        this.requestQueue = [];
        this.requestCount = 0;
        this.rateLimitReset = Date.now() + 60000; // 1 minute window
        
        // Database connection
        this.db = new Pool(config.database);
        
        // Logger setup
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { 
                carrierId: this.carrierId,
                integrationId: this.integrationId,
                companyId: this.companyId
            },
            transports: [
                new winston.transports.File({ 
                    filename: `logs/integrations/${this.carrierId}-error.log`, 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: `logs/integrations/${this.carrierId}.log` 
                }),
                new winston.transports.Console({ level: 'debug' })
            ]
        });
        
        // HTTP client setup
        this.httpClient = axios.create({
            baseURL: this.config.apiUrl,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'UIP-Integration/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        // Setup request/response interceptors
        this.setupInterceptors();
    }

    // Setup HTTP interceptors for logging and metrics
    setupInterceptors() {
        // Request interceptor
        this.httpClient.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                this.logger.debug('API Request', {
                    method: config.method,
                    url: config.url,
                    params: config.params
                });
                return config;
            },
            (error) => {
                this.logger.error('Request Error', error);
                return Promise.reject(error);
            }
        );
        
        // Response interceptor
        this.httpClient.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                this.updateMetrics(true, duration);
                
                this.logger.debug('API Response', {
                    status: response.status,
                    duration: duration,
                    dataSize: JSON.stringify(response.data).length
                });
                
                return response;
            },
            async (error) => {
                const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
                this.updateMetrics(false, duration, error);
                
                this.logger.error('Response Error', {
                    status: error.response?.status,
                    message: error.message,
                    duration: duration
                });
                
                // Handle rate limiting
                if (error.response?.status === 429) {
                    this.handleRateLimit(error.response);
                }
                
                return Promise.reject(error);
            }
        );
    }

    // Update integration metrics
    updateMetrics(success, responseTime, error = null) {
        this.metrics.totalRequests++;
        
        if (success) {
            this.metrics.successfulRequests++;
            this.successCount++;
        } else {
            this.metrics.failedRequests++;
            this.errorCount++;
            this.metrics.lastError = {
                timestamp: new Date(),
                message: error?.message || 'Unknown error',
                status: error?.response?.status
            };
        }
        
        // Calculate rolling average response time
        this.metrics.avgResponseTime = 
            (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
            this.metrics.totalRequests;
    }

    // Rate limiting handler
    async executeWithRateLimit(requestFn) {
        // Check if rate limit window has reset
        if (Date.now() > this.rateLimitReset) {
            this.requestCount = 0;
            this.rateLimitReset = Date.now() + 60000;
        }
        
        // Check if we've hit the rate limit
        if (this.requestCount >= this.config.rateLimit) {
            const waitTime = this.rateLimitReset - Date.now();
            this.logger.warn(`Rate limit reached. Waiting ${waitTime}ms`);
            this.status = IntegrationStatus.RATE_LIMITED;
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.status = IntegrationStatus.CONNECTED;
            this.requestCount = 0;
            this.rateLimitReset = Date.now() + 60000;
        }
        
        this.requestCount++;
        return await requestFn();
    }

    // Retry logic with exponential backoff
    async executeWithRetry(requestFn, attempts = this.config.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await requestFn();
            } catch (error) {
                const isLastAttempt = i === attempts - 1;
                
                if (isLastAttempt || !this.isRetryableError(error)) {
                    throw error;
                }
                
                const delay = this.config.retryDelay * Math.pow(2, i);
                this.logger.warn(`Request failed, retrying in ${delay}ms`, {
                    attempt: i + 1,
                    maxAttempts: attempts,
                    error: error.message
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Check if error is retryable
    isRetryableError(error) {
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return (
            !error.response || 
            retryableStatuses.includes(error.response.status) ||
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT'
        );
    }

    // Handle rate limit response
    handleRateLimit(response) {
        const retryAfter = response.headers['retry-after'];
        if (retryAfter) {
            const waitTime = isNaN(retryAfter) 
                ? new Date(retryAfter).getTime() - Date.now()
                : parseInt(retryAfter) * 1000;
            
            this.rateLimitReset = Date.now() + waitTime;
            this.logger.warn(`Rate limited. Retry after ${waitTime}ms`);
        }
    }

    // Abstract methods to be implemented by specific carriers
    async authenticate() {
        throw new Error('authenticate() must be implemented by carrier connector');
    }

    async fetchContainerStatus(containerNumber) {
        throw new Error('fetchContainerStatus() must be implemented by carrier connector');
    }

    async fetchDDCharges(startDate, endDate) {
        throw new Error('fetchDDCharges() must be implemented by carrier connector');
    }

    async fetchBookings(startDate, endDate) {
        throw new Error('fetchBookings() must be implemented by carrier connector');
    }

    // Common methods
    async connect() {
        try {
            this.status = IntegrationStatus.CONNECTING;
            this.emit('connecting');
            
            await this.authenticate();
            
            this.status = IntegrationStatus.CONNECTED;
            this.lastSync = new Date();
            this.emit('connected');
            
            await this.saveConnectionStatus();
            
            this.logger.info('Successfully connected to carrier', {
                carrier: this.carrierName,
                timestamp: this.lastSync
            });
            
            return true;
        } catch (error) {
            this.status = IntegrationStatus.ERROR;
            this.emit('error', error);
            
            this.logger.error('Failed to connect to carrier', {
                carrier: this.carrierName,
                error: error.message
            });
            
            throw error;
        }
    }

    async disconnect() {
        this.status = IntegrationStatus.DISCONNECTED;
        this.emit('disconnected');
        await this.saveConnectionStatus();
        
        this.logger.info('Disconnected from carrier', {
            carrier: this.carrierName
        });
    }

    // Save connection status to database
    async saveConnectionStatus() {
        try {
            await this.db.query(`
                UPDATE carrier_integrations 
                SET 
                    status = $1,
                    last_sync = $2,
                    error_count = $3,
                    success_count = $4,
                    metrics = $5,
                    updated_at = NOW()
                WHERE id = $6
            `, [
                this.status,
                this.lastSync,
                this.errorCount,
                this.successCount,
                JSON.stringify(this.metrics),
                this.integrationId
            ]);
        } catch (error) {
            this.logger.error('Failed to save connection status', error);
        }
    }

    // Process and save raw data
    async processData(dataType, rawData, metadata = {}) {
        const startTime = Date.now();
        
        try {
            // Generate unique data hash
            const dataHash = this.generateDataHash(dataType, rawData);
            
            // Check for duplicates
            const isDuplicate = await this.checkDuplicate(dataHash);
            if (isDuplicate) {
                this.logger.debug('Duplicate data detected, skipping', { dataHash });
                return { status: 'duplicate', dataHash };
            }
            
            // Standardize data format
            const standardizedData = await this.standardizeData(dataType, rawData);
            
            // Calculate data quality score
            const qualityScore = this.calculateQualityScore(standardizedData);
            
            // Save to database
            const result = await this.saveData(dataType, standardizedData, {
                ...metadata,
                rawData: rawData,
                dataHash: dataHash,
                qualityScore: qualityScore,
                processingTime: Date.now() - startTime
            });
            
            // Update metrics
            this.metrics.dataProcessed++;
            
            // Emit event for real-time updates
            this.emit('dataProcessed', {
                type: dataType,
                id: result.id,
                timestamp: new Date()
            });
            
            return {
                status: 'success',
                id: result.id,
                qualityScore: qualityScore,
                processingTime: Date.now() - startTime
            };
            
        } catch (error) {
            this.logger.error('Data processing error', {
                dataType: dataType,
                error: error.message
            });
            
            // Save error record
            await this.saveProcessingError(dataType, rawData, error);
            
            throw error;
        }
    }

    // Generate hash for duplicate detection
    generateDataHash(dataType, data) {
        const content = JSON.stringify({
            type: dataType,
            data: data,
            carrier: this.carrierId
        });
        
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    // Check for duplicate data
    async checkDuplicate(dataHash) {
        const result = await this.db.query(`
            SELECT id FROM integration_data 
            WHERE data_hash = $1 AND created_at > NOW() - INTERVAL '7 days'
        `, [dataHash]);
        
        return result.rows.length > 0;
    }

    // Standardize data format (to be overridden by specific implementations)
    async standardizeData(dataType, rawData) {
        // Default implementation - override in specific connectors
        return {
            carrier: this.carrierId,
            type: dataType,
            timestamp: new Date(),
            data: rawData
        };
    }

    // Calculate data quality score
    calculateQualityScore(data) {
        let score = 100;
        const requiredFields = this.getRequiredFields(data.type);
        
        // Check for missing required fields
        for (const field of requiredFields) {
            if (!this.getNestedValue(data, field)) {
                score -= 10;
            }
        }
        
        // Check for data freshness
        if (data.timestamp) {
            const age = Date.now() - new Date(data.timestamp).getTime();
            const hoursSinceUpdate = age / (1000 * 60 * 60);
            
            if (hoursSinceUpdate > 24) score -= 20;
            else if (hoursSinceUpdate > 12) score -= 10;
            else if (hoursSinceUpdate > 6) score -= 5;
        }
        
        return Math.max(0, score);
    }

    // Get required fields for data type
    getRequiredFields(dataType) {
        const fieldMap = {
            [DataType.CONTAINER_STATUS]: [
                'containerNumber', 'status', 'location', 'timestamp'
            ],
            [DataType.DD_CHARGES]: [
                'containerNumber', 'chargeType', 'amount', 'currency', 'startDate'
            ],
            [DataType.BOOKING]: [
                'bookingNumber', 'origin', 'destination', 'containers'
            ],
            [DataType.INVOICE]: [
                'invoiceNumber', 'amount', 'currency', 'dueDate'
            ]
        };
        
        return fieldMap[dataType] || [];
    }

    // Get nested object value
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    // Save processed data
    async saveData(dataType, standardizedData, metadata) {
        const result = await this.db.query(`
            INSERT INTO integration_data (
                integration_id, company_id, data_type, data,
                raw_data, data_hash, quality_score, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [
            this.integrationId,
            this.companyId,
            dataType,
            JSON.stringify(standardizedData),
            JSON.stringify(metadata.rawData),
            metadata.dataHash,
            metadata.qualityScore,
            JSON.stringify(metadata)
        ]);
        
        return { id: result.rows[0].id };
    }

    // Save processing error
    async saveProcessingError(dataType, rawData, error) {
        try {
            await this.db.query(`
                INSERT INTO integration_errors (
                    integration_id, company_id, data_type,
                    error_message, error_stack, raw_data
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                this.integrationId,
                this.companyId,
                dataType,
                error.message,
                error.stack,
                JSON.stringify(rawData)
            ]);
        } catch (dbError) {
            this.logger.error('Failed to save processing error', dbError);
        }
    }

    // Parse different file formats
    async parseFile(filePath, format) {
        const fs = require('fs').promises;
        const content = await fs.readFile(filePath, 'utf-8');
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.parse(content);
                
            case 'xml':
                const xmlParser = new Parser({ explicitArray: false });
                return await xmlParser.parseStringPromise(content);
                
            case 'csv':
                return new Promise((resolve, reject) => {
                    csv.parse(content, {
                        columns: true,
                        skip_empty_lines: true
                    }, (err, records) => {
                        if (err) reject(err);
                        else resolve(records);
                    });
                });
                
            case 'edi':
                return this.parseEDI(content);
                
            default:
                throw new Error(`Unsupported file format: ${format}`);
        }
    }

    // Parse EDI format (basic implementation)
    parseEDI(content) {
        const segments = content.split(/[\r\n]+/);
        const result = { segments: [] };
        
        for (const segment of segments) {
            const elements = segment.split('*');
            if (elements.length > 0) {
                result.segments.push({
                    id: elements[0],
                    elements: elements.slice(1)
                });
            }
        }
        
        return result;
    }

    // Get integration health status
    async getHealthStatus() {
        const healthCheck = {
            status: this.status,
            lastSync: this.lastSync,
            metrics: this.metrics,
            errors: {
                count: this.errorCount,
                lastError: this.metrics.lastError
            },
            performance: {
                avgResponseTime: Math.round(this.metrics.avgResponseTime),
                successRate: this.metrics.totalRequests > 0 
                    ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
                    : '0%'
            }
        };
        
        // Test connection if not recently checked
        if (!this.lastSync || Date.now() - this.lastSync.getTime() > 300000) { // 5 minutes
            try {
                await this.authenticate();
                healthCheck.connectionTest = 'passed';
            } catch (error) {
                healthCheck.connectionTest = 'failed';
                healthCheck.connectionError = error.message;
            }
        }
        
        return healthCheck;
    }
}

module.exports = {
    BaseCarrierConnector,
    IntegrationStatus,
    DataType
};