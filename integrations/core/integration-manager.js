/**
 * ROOTUIP Integration Manager
 * Central hub for managing all third-party integrations
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class IntegrationManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 5000,
            timeout: config.timeout || 30000,
            rateLimiting: config.rateLimiting !== false,
            monitoring: config.monitoring !== false,
            encryption: config.encryption !== false
        };
        
        // Integration registry
        this.integrations = new Map();
        
        // Active connections
        this.connections = new Map();
        
        // Data transformation engine
        this.transformationEngine = new DataTransformationEngine();
        
        // Message queue for async processing
        this.messageQueue = [];
        this.processingQueue = false;
        
        // Metrics and monitoring
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            integrationStats: new Map(),
            errorLog: []
        };
        
        // Rate limiting
        this.rateLimiters = new Map();
        
        // Initialize manager
        this.initialize();
    }
    
    // Initialize integration manager
    initialize() {
        // Start queue processor
        this.startQueueProcessor();
        
        // Start health checker
        this.startHealthChecker();
        
        // Start metrics collection
        this.startMetricsCollection();
        
        console.log('Integration Manager initialized');
    }
    
    // Register integration
    registerIntegration(integration) {
        const id = integration.id || uuidv4();
        
        const integrationConfig = {
            id,
            name: integration.name,
            type: integration.type,
            category: integration.category,
            version: integration.version || '1.0.0',
            status: 'registered',
            config: integration.config || {},
            endpoints: integration.endpoints || {},
            authentication: integration.authentication || {},
            rateLimit: integration.rateLimit || { requests: 100, window: 60000 },
            dataMapping: integration.dataMapping || {},
            webhooks: integration.webhooks || [],
            retryPolicy: integration.retryPolicy || this.config,
            lastHealthCheck: null,
            healthStatus: 'unknown',
            instance: integration.instance
        };
        
        this.integrations.set(id, integrationConfig);
        
        // Initialize rate limiter
        this.rateLimiters.set(id, {
            requests: [],
            limit: integrationConfig.rateLimit.requests,
            window: integrationConfig.rateLimit.window
        });
        
        // Initialize metrics
        this.metrics.integrationStats.set(id, {
            requests: 0,
            successes: 0,
            failures: 0,
            avgResponseTime: 0,
            lastRequest: null,
            errors: []
        });
        
        this.emit('integration:registered', { id, name: integration.name });
        
        return id;
    }
    
    // Connect to integration
    async connectIntegration(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }
        
        try {
            integration.status = 'connecting';
            
            // Initialize connection
            if (integration.instance && typeof integration.instance.connect === 'function') {
                await integration.instance.connect();
            }
            
            // Test connection
            const healthCheck = await this.performHealthCheck(integrationId);
            
            if (healthCheck.healthy) {
                integration.status = 'connected';
                integration.lastConnected = new Date();
                this.connections.set(integrationId, {
                    connectedAt: new Date(),
                    lastActivity: new Date()
                });
                
                this.emit('integration:connected', { id: integrationId, name: integration.name });
            } else {
                throw new Error('Health check failed');
            }
            
        } catch (error) {
            integration.status = 'error';
            integration.lastError = error.message;
            this.emit('integration:error', { id: integrationId, error: error.message });
            throw error;
        }
    }
    
    // Execute integration request
    async executeRequest(integrationId, operation, data = {}, options = {}) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }
        
        const requestId = uuidv4();
        const startTime = Date.now();
        
        try {
            // Check rate limiting
            if (this.config.rateLimiting && !this.checkRateLimit(integrationId)) {
                throw new Error('Rate limit exceeded');
            }
            
            // Check if connected
            if (integration.status !== 'connected') {
                await this.connectIntegration(integrationId);
            }
            
            // Transform input data
            const transformedData = await this.transformationEngine.transform(
                data,
                integration.dataMapping.input || {},
                'input'
            );
            
            // Execute request
            let result;
            if (integration.instance && typeof integration.instance.execute === 'function') {
                result = await this.executeWithRetry(
                    integrationId,
                    () => integration.instance.execute(operation, transformedData, options)
                );
            } else {
                throw new Error('Integration instance not available');
            }
            
            // Transform output data
            const transformedResult = await this.transformationEngine.transform(
                result,
                integration.dataMapping.output || {},
                'output'
            );
            
            // Update metrics
            const responseTime = Date.now() - startTime;
            this.updateMetrics(integrationId, true, responseTime);
            
            // Log successful request
            this.emit('request:success', {
                requestId,
                integrationId,
                operation,
                responseTime,
                dataSize: JSON.stringify(transformedResult).length
            });
            
            return {
                requestId,
                success: true,
                data: transformedResult,
                responseTime,
                timestamp: new Date()
            };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateMetrics(integrationId, false, responseTime, error.message);
            
            this.emit('request:error', {
                requestId,
                integrationId,
                operation,
                error: error.message,
                responseTime
            });
            
            throw error;
        }
    }
    
    // Execute with retry logic
    async executeWithRetry(integrationId, operation) {
        const integration = this.integrations.get(integrationId);
        const retryPolicy = integration.retryPolicy;
        
        for (let attempt = 1; attempt <= retryPolicy.retryAttempts; attempt++) {
            try {
                return await Promise.race([
                    operation(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout')), retryPolicy.timeout)
                    )
                ]);
            } catch (error) {
                if (attempt === retryPolicy.retryAttempts) {
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, retryPolicy.retryDelay * attempt));
                
                this.emit('request:retry', {
                    integrationId,
                    attempt,
                    error: error.message
                });
            }
        }
    }
    
    // Check rate limiting
    checkRateLimit(integrationId) {
        const rateLimiter = this.rateLimiters.get(integrationId);
        if (!rateLimiter) return true;
        
        const now = Date.now();
        const windowStart = now - rateLimiter.window;
        
        // Remove old requests
        rateLimiter.requests = rateLimiter.requests.filter(time => time > windowStart);
        
        // Check if under limit
        if (rateLimiter.requests.length >= rateLimiter.limit) {
            return false;
        }
        
        // Add current request
        rateLimiter.requests.push(now);
        return true;
    }
    
    // Perform health check
    async performHealthCheck(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            return { healthy: false, error: 'Integration not found' };
        }
        
        try {
            let healthResult = { healthy: true };
            
            if (integration.instance && typeof integration.instance.healthCheck === 'function') {
                healthResult = await integration.instance.healthCheck();
            }
            
            integration.lastHealthCheck = new Date();
            integration.healthStatus = healthResult.healthy ? 'healthy' : 'unhealthy';
            
            this.emit('health:check', {
                integrationId,
                healthy: healthResult.healthy,
                details: healthResult
            });
            
            return healthResult;
            
        } catch (error) {
            integration.healthStatus = 'error';
            integration.lastError = error.message;
            
            return {
                healthy: false,
                error: error.message
            };
        }
    }
    
    // Queue message for async processing
    queueMessage(integrationId, operation, data, options = {}) {
        const messageId = uuidv4();
        
        this.messageQueue.push({
            id: messageId,
            integrationId,
            operation,
            data,
            options,
            timestamp: new Date(),
            attempts: 0,
            maxAttempts: options.maxAttempts || 3
        });
        
        this.emit('message:queued', { messageId, integrationId, operation });
        
        return messageId;
    }
    
    // Start queue processor
    startQueueProcessor() {
        setInterval(async () => {
            if (this.processingQueue || this.messageQueue.length === 0) {
                return;
            }
            
            this.processingQueue = true;
            
            try {
                const message = this.messageQueue.shift();
                
                try {
                    const result = await this.executeRequest(
                        message.integrationId,
                        message.operation,
                        message.data,
                        message.options
                    );
                    
                    this.emit('message:processed', {
                        messageId: message.id,
                        success: true,
                        result
                    });
                    
                } catch (error) {
                    message.attempts++;
                    
                    if (message.attempts < message.maxAttempts) {
                        // Re-queue for retry
                        this.messageQueue.push(message);
                    } else {
                        this.emit('message:failed', {
                            messageId: message.id,
                            error: error.message,
                            attempts: message.attempts
                        });
                    }
                }
                
            } finally {
                this.processingQueue = false;
            }
            
        }, 1000); // Process every second
    }
    
    // Start health checker
    startHealthChecker() {
        setInterval(async () => {
            for (const [integrationId, integration] of this.integrations) {
                if (integration.status === 'connected') {
                    await this.performHealthCheck(integrationId);
                }
            }
        }, 60000); // Check every minute
    }
    
    // Start metrics collection
    startMetricsCollection() {
        setInterval(() => {
            this.emit('metrics:update', this.getMetrics());
        }, 10000); // Update every 10 seconds
    }
    
    // Update metrics
    updateMetrics(integrationId, success, responseTime, error = null) {
        this.metrics.totalRequests++;
        
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
            if (error) {
                this.metrics.errorLog.push({
                    timestamp: new Date(),
                    integrationId,
                    error
                });
                
                // Keep only last 100 errors
                if (this.metrics.errorLog.length > 100) {
                    this.metrics.errorLog.shift();
                }
            }
        }
        
        // Update average response time
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
            this.metrics.totalRequests;
        
        // Update integration-specific metrics
        const integrationStats = this.metrics.integrationStats.get(integrationId);
        if (integrationStats) {
            integrationStats.requests++;
            if (success) {
                integrationStats.successes++;
            } else {
                integrationStats.failures++;
                integrationStats.errors.push({
                    timestamp: new Date(),
                    error
                });
                
                // Keep only last 10 errors per integration
                if (integrationStats.errors.length > 10) {
                    integrationStats.errors.shift();
                }
            }
            
            integrationStats.avgResponseTime = 
                (integrationStats.avgResponseTime * (integrationStats.requests - 1) + responseTime) / 
                integrationStats.requests;
            
            integrationStats.lastRequest = new Date();
        }
    }
    
    // Get metrics
    getMetrics() {
        return {
            overall: {
                totalRequests: this.metrics.totalRequests,
                successfulRequests: this.metrics.successfulRequests,
                failedRequests: this.metrics.failedRequests,
                successRate: this.metrics.totalRequests > 0 ? 
                    (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : 
                    '0%',
                averageResponseTime: Math.round(this.metrics.averageResponseTime),
                queueSize: this.messageQueue.length
            },
            integrations: Array.from(this.metrics.integrationStats.entries()).map(([id, stats]) => {
                const integration = this.integrations.get(id);
                return {
                    id,
                    name: integration.name,
                    status: integration.status,
                    healthStatus: integration.healthStatus,
                    requests: stats.requests,
                    successes: stats.successes,
                    failures: stats.failures,
                    successRate: stats.requests > 0 ? 
                        (stats.successes / stats.requests * 100).toFixed(2) + '%' : 
                        '0%',
                    avgResponseTime: Math.round(stats.avgResponseTime),
                    lastRequest: stats.lastRequest,
                    recentErrors: stats.errors.slice(-3)
                };
            }),
            recentErrors: this.metrics.errorLog.slice(-10)
        };
    }
    
    // Get integration list
    getIntegrations() {
        return Array.from(this.integrations.values()).map(integration => ({
            id: integration.id,
            name: integration.name,
            type: integration.type,
            category: integration.category,
            status: integration.status,
            healthStatus: integration.healthStatus,
            lastHealthCheck: integration.lastHealthCheck,
            lastConnected: integration.lastConnected,
            version: integration.version
        }));
    }
    
    // Disconnect integration
    async disconnectIntegration(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (!integration) {
            throw new Error(`Integration ${integrationId} not found`);
        }
        
        try {
            if (integration.instance && typeof integration.instance.disconnect === 'function') {
                await integration.instance.disconnect();
            }
            
            integration.status = 'disconnected';
            this.connections.delete(integrationId);
            
            this.emit('integration:disconnected', { id: integrationId, name: integration.name });
            
        } catch (error) {
            integration.status = 'error';
            integration.lastError = error.message;
            throw error;
        }
    }
    
    // Remove integration
    removeIntegration(integrationId) {
        const integration = this.integrations.get(integrationId);
        if (integration) {
            this.integrations.delete(integrationId);
            this.connections.delete(integrationId);
            this.rateLimiters.delete(integrationId);
            this.metrics.integrationStats.delete(integrationId);
            
            this.emit('integration:removed', { id: integrationId, name: integration.name });
        }
    }
}

// Data Transformation Engine
class DataTransformationEngine {
    constructor() {
        this.transformers = new Map();
        this.initializeDefaultTransformers();
    }
    
    // Initialize default transformers
    initializeDefaultTransformers() {
        // Date transformers
        this.addTransformer('date_iso', (value) => new Date(value).toISOString());
        this.addTransformer('date_unix', (value) => Math.floor(new Date(value).getTime() / 1000));
        this.addTransformer('unix_date', (value) => new Date(value * 1000).toISOString());
        
        // String transformers
        this.addTransformer('uppercase', (value) => String(value).toUpperCase());
        this.addTransformer('lowercase', (value) => String(value).toLowerCase());
        this.addTransformer('trim', (value) => String(value).trim());
        
        // Number transformers
        this.addTransformer('to_number', (value) => Number(value));
        this.addTransformer('to_string', (value) => String(value));
        this.addTransformer('round', (value, decimals = 2) => Number(value).toFixed(decimals));
        
        // Array transformers
        this.addTransformer('join', (value, separator = ',') => Array.isArray(value) ? value.join(separator) : value);
        this.addTransformer('split', (value, separator = ',') => String(value).split(separator));
        
        // Object transformers
        this.addTransformer('extract', (value, path) => this.extractValue(value, path));
        this.addTransformer('merge', (value, additional) => ({ ...value, ...additional }));
    }
    
    // Add transformer
    addTransformer(name, transformer) {
        this.transformers.set(name, transformer);
    }
    
    // Transform data
    async transform(data, mapping, direction = 'input') {
        if (!mapping || Object.keys(mapping).length === 0) {
            return data;
        }
        
        const result = {};
        
        for (const [targetField, sourceConfig] of Object.entries(mapping)) {
            try {
                let value = data;
                
                // Extract source value
                if (typeof sourceConfig === 'string') {
                    value = this.extractValue(data, sourceConfig);
                } else if (typeof sourceConfig === 'object') {
                    const sourcePath = sourceConfig.source || sourceConfig.field;
                    value = this.extractValue(data, sourcePath);
                    
                    // Apply transformers
                    if (sourceConfig.transformers) {
                        for (const transformerConfig of sourceConfig.transformers) {
                            const transformerName = typeof transformerConfig === 'string' ? 
                                transformerConfig : transformerConfig.name;
                            const transformerArgs = transformerConfig.args || [];
                            
                            const transformer = this.transformers.get(transformerName);
                            if (transformer) {
                                value = await transformer(value, ...transformerArgs);
                            }
                        }
                    }
                    
                    // Apply default value if needed
                    if (value === undefined || value === null) {
                        value = sourceConfig.default;
                    }
                }
                
                // Set target value
                this.setNestedValue(result, targetField, value);
                
            } catch (error) {
                console.warn(`Transformation error for field ${targetField}:`, error.message);
                
                // Use default value if specified
                if (typeof sourceConfig === 'object' && sourceConfig.default !== undefined) {
                    this.setNestedValue(result, targetField, sourceConfig.default);
                }
            }
        }
        
        return result;
    }
    
    // Extract value from nested object
    extractValue(obj, path) {
        if (!path) return obj;
        
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
            if (value && typeof value === 'object') {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    // Set nested value
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
}

module.exports = { IntegrationManager, DataTransformationEngine };