// ROOTUIP Enterprise Integration Framework
// Base classes and utilities for carrier integrations

const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');
const { RateLimiter } = require('limiter');

// Base Integration Connector Class
class IntegrationConnector extends EventEmitter {
    constructor(config) {
        super();
        this.name = config.name || 'Unknown Carrier';
        this.carrierId = config.carrierId;
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.baseUrl = config.baseUrl;
        this.environment = config.environment || 'production';
        this.timeout = config.timeout || 30000;
        this.retryAttempts = config.retryAttempts || 3;
        this.rateLimiter = new RateLimiter({
            tokensPerInterval: config.rateLimit || 100,
            interval: "minute"
        });
        
        // Connection state
        this.connected = false;
        this.lastHealthCheck = null;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastError: null
        };
        
        // Initialize HTTP client
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'User-Agent': 'ROOTUIP-Integration/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        // Add request/response interceptors
        this.setupInterceptors();
    }
    
    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            async (config) => {
                // Add authentication
                config = await this.addAuthentication(config);
                
                // Add request ID
                config.headers['X-Request-ID'] = this.generateRequestId();
                
                // Rate limiting
                await this.rateLimiter.removeTokens(1);
                
                // Log request
                this.emit('request', {
                    method: config.method,
                    url: config.url,
                    headers: this.sanitizeHeaders(config.headers)
                });
                
                config.metadata = { startTime: Date.now() };
                return config;
            },
            (error) => {
                this.emit('request-error', error);
                return Promise.reject(error);
            }
        );
        
        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                
                // Update metrics
                this.updateMetrics(true, duration);
                
                // Log response
                this.emit('response', {
                    status: response.status,
                    duration,
                    headers: response.headers
                });
                
                return response;
            },
            async (error) => {
                const duration = error.config?.metadata?.startTime 
                    ? Date.now() - error.config.metadata.startTime 
                    : 0;
                
                // Update metrics
                this.updateMetrics(false, duration);
                this.metrics.lastError = {
                    message: error.message,
                    code: error.code,
                    timestamp: new Date().toISOString()
                };
                
                // Handle specific errors
                if (error.response) {
                    this.emit('response-error', {
                        status: error.response.status,
                        data: error.response.data,
                        duration
                    });
                    
                    // Handle rate limiting
                    if (error.response.status === 429) {
                        const retryAfter = error.response.headers['retry-after'] || 60;
                        await this.handleRateLimit(retryAfter);
                    }
                    
                    // Handle authentication errors
                    if (error.response.status === 401) {
                        await this.refreshAuthentication();
                    }
                }
                
                return Promise.reject(error);
            }
        );
    }
    
    // Abstract methods to be implemented by carrier-specific connectors
    async addAuthentication(config) {
        throw new Error('addAuthentication must be implemented by subclass');
    }
    
    async refreshAuthentication() {
        throw new Error('refreshAuthentication must be implemented by subclass');
    }
    
    async validateCredentials() {
        throw new Error('validateCredentials must be implemented by subclass');
    }
    
    // Common methods
    generateRequestId() {
        return `${this.carrierId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveKeys = ['authorization', 'api-key', 'x-api-key', 'cookie'];
        
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
    
    updateMetrics(success, duration) {
        this.metrics.totalRequests++;
        
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }
        
        // Update average response time
        const prevAvg = this.metrics.averageResponseTime;
        const prevTotal = this.metrics.totalRequests - 1;
        this.metrics.averageResponseTime = (prevAvg * prevTotal + duration) / this.metrics.totalRequests;
    }
    
    async handleRateLimit(retryAfter) {
        this.emit('rate-limit', { retryAfter });
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    }
    
    // Health check
    async healthCheck() {
        try {
            const startTime = Date.now();
            const isHealthy = await this.validateCredentials();
            const duration = Date.now() - startTime;
            
            this.lastHealthCheck = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                responseTime: duration
            };
            
            this.connected = isHealthy;
            this.emit('health-check', this.lastHealthCheck);
            
            return this.lastHealthCheck;
        } catch (error) {
            this.lastHealthCheck = {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
            
            this.connected = false;
            this.emit('health-check', this.lastHealthCheck);
            
            return this.lastHealthCheck;
        }
    }
    
    // Request with retry logic
    async requestWithRetry(requestFunc, retries = this.retryAttempts) {
        let lastError;
        
        for (let i = 0; i <= retries; i++) {
            try {
                return await requestFunc();
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx)
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    throw error;
                }
                
                if (i < retries) {
                    const delay = Math.min(1000 * Math.pow(2, i), 10000); // Exponential backoff
                    this.emit('retry', { attempt: i + 1, delay, error: error.message });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }
    
    // Get metrics
    getMetrics() {
        return {
            ...this.metrics,
            uptime: this.connected ? 
                (this.lastHealthCheck ? 
                    Date.now() - new Date(this.lastHealthCheck.timestamp).getTime() : 0) : 0,
            successRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : 'N/A'
        };
    }
    
    // Connection management
    async connect() {
        this.emit('connecting', { carrier: this.name });
        const health = await this.healthCheck();
        
        if (health.status === 'healthy') {
            this.emit('connected', { carrier: this.name });
            return true;
        } else {
            this.emit('connection-failed', { carrier: this.name, reason: health.error });
            return false;
        }
    }
    
    async disconnect() {
        this.connected = false;
        this.emit('disconnected', { carrier: this.name });
    }
    
    isConnected() {
        return this.connected;
    }
}

// Data Transformer Base Class
class DataTransformer {
    constructor(config = {}) {
        this.config = config;
        this.mappings = config.mappings || {};
    }
    
    // Transform external data to internal format
    async transformInbound(externalData, dataType) {
        throw new Error('transformInbound must be implemented by subclass');
    }
    
    // Transform internal data to external format
    async transformOutbound(internalData, dataType) {
        throw new Error('transformOutbound must be implemented by subclass');
    }
    
    // Common transformation utilities
    mapFields(source, mapping) {
        const result = {};
        
        for (const [targetField, sourceField] of Object.entries(mapping)) {
            const value = this.getNestedValue(source, sourceField);
            if (value !== undefined) {
                this.setNestedValue(result, targetField, value);
            }
        }
        
        return result;
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    
    // Date formatting
    formatDate(date, format = 'ISO') {
        if (!date) return null;
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        
        switch (format) {
            case 'ISO':
                return d.toISOString();
            case 'YYYY-MM-DD':
                return d.toISOString().split('T')[0];
            case 'MM/DD/YYYY':
                return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
            default:
                return d.toISOString();
        }
    }
    
    // Standard transformations
    standardizeContainerNumber(containerNumber) {
        if (!containerNumber) return null;
        return containerNumber.replace(/[^A-Z0-9]/g, '').toUpperCase();
    }
    
    standardizeVesselIMO(imo) {
        if (!imo) return null;
        const cleaned = imo.toString().replace(/[^0-9]/g, '');
        return cleaned.length === 7 ? cleaned : null;
    }
    
    standardizePort(portCode) {
        if (!portCode) return null;
        return portCode.toUpperCase().substring(0, 5);
    }
}

// Integration Registry
class IntegrationRegistry {
    constructor() {
        this.integrations = new Map();
        this.transformers = new Map();
    }
    
    register(carrierId, integrationClass, transformerClass) {
        this.integrations.set(carrierId, integrationClass);
        if (transformerClass) {
            this.transformers.set(carrierId, transformerClass);
        }
    }
    
    createIntegration(carrierId, config) {
        const IntegrationClass = this.integrations.get(carrierId);
        if (!IntegrationClass) {
            throw new Error(`No integration registered for carrier: ${carrierId}`);
        }
        
        const integration = new IntegrationClass(config);
        
        // Attach transformer if available
        const TransformerClass = this.transformers.get(carrierId);
        if (TransformerClass) {
            integration.transformer = new TransformerClass(config.transformerConfig);
        }
        
        return integration;
    }
    
    listIntegrations() {
        return Array.from(this.integrations.keys());
    }
    
    hasIntegration(carrierId) {
        return this.integrations.has(carrierId);
    }
}

// Rate Limiter Manager
class RateLimiterManager {
    constructor() {
        this.limiters = new Map();
    }
    
    createLimiter(key, tokensPerInterval, interval = 'minute') {
        const limiter = new RateLimiter({ tokensPerInterval, interval });
        this.limiters.set(key, limiter);
        return limiter;
    }
    
    getLimiter(key) {
        return this.limiters.get(key);
    }
    
    async checkLimit(key) {
        const limiter = this.limiters.get(key);
        if (!limiter) return true;
        
        const remainingTokens = await limiter.getTokensRemaining();
        return remainingTokens > 0;
    }
}

// Export framework components
module.exports = {
    IntegrationConnector,
    DataTransformer,
    IntegrationRegistry,
    RateLimiterManager
};