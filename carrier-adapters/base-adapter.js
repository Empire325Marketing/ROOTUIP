// Base Carrier Adapter Class
// Defines the interface and common functionality for all carrier API adapters

class BaseCarrierAdapter {
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
        this.redis = config.redis;
        this.carrierCode = config.carrierCode;
        this.carrierName = config.carrierName;
        this.apiVersion = config.apiVersion || 'v1';
        this.rateLimit = config.rateLimit || { requests: 100, period: 60000 }; // 100 req/min default
        this.timeout = config.timeout || 30000; // 30 seconds
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 second
    }
    
    // Abstract methods - must be implemented by subclasses
    async authenticate(credentials) {
        throw new Error(`authenticate() method must be implemented by ${this.carrierCode} adapter`);
    }
    
    async trackContainer(containerNumber, authData) {
        throw new Error(`trackContainer() method must be implemented by ${this.carrierCode} adapter`);
    }
    
    normalizeData(rawData) {
        throw new Error(`normalizeData() method must be implemented by ${this.carrierCode} adapter`);
    }
    
    // Common utility methods
    async makeRequest(url, options = {}) {
        const requestOptions = {
            timeout: this.timeout,
            ...options
        };
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const response = await this.executeRequest(url, requestOptions);
                return response;
            } catch (error) {
                if (attempt === this.retryAttempts) {
                    throw error;
                }
                
                // Check if error is retryable
                if (this.isRetryableError(error)) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    await this.sleep(delay);
                    continue;
                }
                
                throw error;
            }
        }
    }
    
    async executeRequest(url, options) {
        // This will be implemented by each adapter with their preferred HTTP client
        throw new Error('executeRequest() must be implemented by subclass');
    }
    
    isRetryableError(error) {
        if (!error.response) return true; // Network errors are retryable
        
        const status = error.response.status;
        return status >= 500 || status === 429; // Server errors and rate limiting
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async checkRateLimit() {
        const key = `rate_limit:${this.carrierCode}`;
        const current = await this.redis.get(key);
        
        if (current && parseInt(current) >= this.rateLimit.requests) {
            const ttl = await this.redis.ttl(key);
            throw new Error(`Rate limit exceeded for ${this.carrierCode}. Reset in ${ttl} seconds`);
        }
        
        // Increment counter
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, Math.ceil(this.rateLimit.period / 1000));
        await pipeline.exec();
    }
    
    async cacheAuthToken(tokenData) {
        const key = `auth:${this.carrierCode}`;
        const expiresIn = tokenData.expires_in || 3600;
        await this.redis.setex(key, expiresIn - 60, JSON.stringify(tokenData)); // 60s buffer
    }
    
    async getCachedAuthToken() {
        const key = `auth:${this.carrierCode}`;
        const tokenData = await this.redis.get(key);
        return tokenData ? JSON.parse(tokenData) : null;
    }
    
    logRequest(method, url, success, duration, error = null) {
        const logData = {
            carrier: this.carrierCode,
            method,
            url,
            success,
            duration,
            timestamp: new Date().toISOString()
        };
        
        if (error) {
            logData.error = error.message;
            logData.errorCode = error.code;
        }
        
        if (success) {
            this.logger.info('API request successful', logData);
        } else {
            this.logger.error('API request failed', logData);
        }
    }
    
    // Standard data normalization structure
    createStandardResponse(rawData) {
        return {
            containerNumber: null,
            status: 'Unknown',
            currentLocation: null,
            estimatedArrival: null,
            actualArrival: null,
            vesselName: null,
            voyageNumber: null,
            portOfLoading: null,
            portOfDischarge: null,
            finalDestination: null,
            events: [],
            freeDaysRemaining: 0,
            detentionCharges: 0,
            demurrageCharges: 0,
            totalCharges: 0,
            riskFactors: {
                portCongestion: 'unknown',
                weatherDelay: false,
                vesselDelay: false,
                customsIssues: false
            },
            metadata: {
                carrier: this.carrierCode,
                lastUpdate: new Date().toISOString(),
                apiVersion: this.apiVersion,
                dataSource: 'carrier_api'
            }
        };
    }
    
    // Standard event structure
    createStandardEvent(eventData) {
        return {
            type: eventData.type || 'unknown',
            description: eventData.description || '',
            location: eventData.location || '',
            coordinates: eventData.coordinates || null,
            timestamp: eventData.timestamp || new Date().toISOString(),
            facilityCode: eventData.facilityCode || null,
            transportMode: eventData.transportMode || null,
            metadata: eventData.metadata || {}
        };
    }
    
    // Validation methods
    validateContainerNumber(containerNumber) {
        if (!containerNumber || typeof containerNumber !== 'string') {
            throw new Error('Container number is required and must be a string');
        }
        
        // Basic container number format validation
        const containerRegex = /^[A-Z]{4}[0-9]{6,7}$/;
        if (!containerRegex.test(containerNumber.replace(/\s/g, ''))) {
            throw new Error('Invalid container number format');
        }
        
        return containerNumber.replace(/\s/g, '').toUpperCase();
    }
    
    validateAuthData(authData) {
        if (!authData || !authData.access_token) {
            throw new Error('Valid authentication data with access_token is required');
        }
        
        // Check if token is expired
        if (authData.expires_at && Date.now() > authData.expires_at) {
            throw new Error('Authentication token has expired');
        }
        
        return true;
    }
    
    // Error handling
    handleAPIError(error, context) {
        const errorInfo = {
            carrier: this.carrierCode,
            context,
            timestamp: new Date().toISOString()
        };
        
        if (error.response) {
            errorInfo.status = error.response.status;
            errorInfo.statusText = error.response.statusText;
            errorInfo.data = error.response.data;
        } else if (error.request) {
            errorInfo.type = 'network_error';
            errorInfo.message = 'No response received from carrier API';
        } else {
            errorInfo.type = 'configuration_error';
            errorInfo.message = error.message;
        }
        
        this.logger.error('Carrier API error', errorInfo);
        
        // Throw standardized error
        const standardError = new Error(`${this.carrierCode} API Error: ${error.message}`);
        standardError.carrier = this.carrierCode;
        standardError.originalError = error;
        standardError.context = context;
        
        throw standardError;
    }
    
    // Health check
    async healthCheck() {
        try {
            // Basic connectivity test - implement in subclass
            await this.testConnectivity();
            return {
                carrier: this.carrierCode,
                status: 'healthy',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                carrier: this.carrierCode,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    async testConnectivity() {
        // Override in subclass with actual connectivity test
        return true;
    }
    
    // Performance metrics
    getPerformanceMetrics() {
        return {
            carrier: this.carrierCode,
            rateLimit: this.rateLimit,
            timeout: this.timeout,
            retryAttempts: this.retryAttempts,
            supported: this.isSupported()
        };
    }
    
    isSupported() {
        // Override in subclass
        return false;
    }
    
    // Configuration validation
    validateConfig() {
        const required = ['carrierCode', 'carrierName'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
        }
        
        return true;
    }
}

module.exports = BaseCarrierAdapter;