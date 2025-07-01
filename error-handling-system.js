/**
 * ROOTUIP Enterprise Error Handling & Resilience System
 * Advanced error handling with circuit breakers, retry logic, and monitoring
 */

const EventEmitter = require('events');

// Circuit Breaker Implementation
class CircuitBreaker extends EventEmitter {
    constructor(service, options = {}) {
        super();
        this.service = service;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttempt = Date.now();
        
        // Configuration
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 60000; // 1 minute
        this.monitor = options.monitor;
        
        this.setupMonitoring();
    }
    
    async execute(operation, ...args) {
        if (this.state === 'OPEN') {
            if (this.nextAttempt > Date.now()) {
                const error = new CircuitBreakerError(`Circuit breaker OPEN for ${this.service}`);
                this.monitor?.recordError(error, 'circuit_breaker_open');
                throw error;
            } else {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
                this.emit('stateChange', { service: this.service, state: 'HALF_OPEN' });
            }
        }
        
        try {
            const result = await operation(...args);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }
    
    onSuccess() {
        this.failureCount = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.state = 'CLOSED';
                this.emit('stateChange', { service: this.service, state: 'CLOSED' });
                this.monitor?.recordMetric('circuit_breaker_closed', 1, { service: this.service });
            }
        }
    }
    
    onFailure(error) {
        this.failureCount++;
        this.monitor?.recordError(error, 'service_failure', { service: this.service });
        
        if (this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            this.emit('stateChange', { service: this.service, state: 'OPEN' });
        } else if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            this.emit('stateChange', { service: this.service, state: 'OPEN' });
            this.monitor?.recordMetric('circuit_breaker_opened', 1, { service: this.service });
        }
    }
    
    setupMonitoring() {
        this.on('stateChange', (data) => {
            this.monitor?.recordEvent('circuit_breaker_state_change', data);
        });
    }
}

// Intelligent Retry Logic with Exponential Backoff
class RetryHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000;
        this.maxDelay = options.maxDelay || 30000;
        this.jitter = options.jitter || 0.1;
        this.retryCondition = options.retryCondition || this.defaultRetryCondition;
        this.monitor = options.monitor;
    }
    
    async execute(operation, context = {}) {
        let lastError;
        let attempt = 0;
        
        while (attempt <= this.maxRetries) {
            try {
                const result = await operation();
                
                if (attempt > 0) {
                    this.monitor?.recordMetric('retry_success', 1, {
                        operation: context.operation,
                        attempts: attempt + 1
                    });
                }
                
                return result;
            } catch (error) {
                lastError = error;
                attempt++;
                
                this.monitor?.recordError(error, 'retry_attempt', {
                    operation: context.operation,
                    attempt: attempt,
                    maxRetries: this.maxRetries
                });
                
                if (attempt > this.maxRetries || !this.retryCondition(error)) {
                    break;
                }
                
                const delay = this.calculateDelay(attempt);
                await this.sleep(delay);
            }
        }
        
        this.monitor?.recordMetric('retry_exhausted', 1, {
            operation: context.operation,
            attempts: attempt
        });
        
        throw lastError;
    }
    
    calculateDelay(attempt) {
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
        const jitterRange = exponentialDelay * this.jitter;
        const jitter = (Math.random() - 0.5) * jitterRange;
        
        return Math.min(exponentialDelay + jitter, this.maxDelay);
    }
    
    defaultRetryCondition(error) {
        // Retry on temporary failures, network issues, timeouts
        return error.code === 'ECONNRESET' ||
               error.code === 'ETIMEDOUT' ||
               error.code === 'ENOTFOUND' ||
               (error.status >= 500 && error.status < 600) ||
               error.status === 429; // Rate limited
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Error Categorization and Escalation
class ErrorCategorizer {
    constructor(monitor) {
        this.monitor = monitor;
        this.escalationRules = new Map();
        this.setupDefaultRules();
    }
    
    setupDefaultRules() {
        // Critical errors - immediate escalation
        this.escalationRules.set('CRITICAL', {
            threshold: 1,
            timeWindow: 0,
            channels: ['pagerduty', 'slack-critical'],
            autoResolve: false
        });
        
        // High severity - escalate after 3 occurrences in 5 minutes
        this.escalationRules.set('HIGH', {
            threshold: 3,
            timeWindow: 300000, // 5 minutes
            channels: ['slack-alerts', 'email'],
            autoResolve: true
        });
        
        // Medium severity - escalate after 10 occurrences in 15 minutes
        this.escalationRules.set('MEDIUM', {
            threshold: 10,
            timeWindow: 900000, // 15 minutes
            channels: ['slack-monitoring'],
            autoResolve: true
        });
    }
    
    categorizeError(error, context = {}) {
        const category = {
            severity: this.determineSeverity(error, context),
            type: this.determineType(error),
            component: context.component || 'unknown',
            userMessage: this.generateUserMessage(error),
            resolutionSteps: this.getResolutionSteps(error),
            metadata: {
                timestamp: new Date().toISOString(),
                traceId: context.traceId,
                userId: context.userId,
                sessionId: context.sessionId
            }
        };
        
        this.monitor?.recordError(error, 'categorized_error', category);
        this.checkEscalation(category);
        
        return category;
    }
    
    determineSeverity(error, context) {
        // Critical: Security breaches, data corruption, complete service failure
        if (error.type === 'SecurityError' || 
            error.message.includes('data corruption') ||
            context.component === 'authentication' && error.status === 500) {
            return 'CRITICAL';
        }
        
        // High: Service unavailable, payment failures, user-blocking errors
        if (error.status >= 500 || 
            error.type === 'PaymentError' ||
            error.message.includes('database connection')) {
            return 'HIGH';
        }
        
        // Medium: Validation errors, rate limiting, partial failures
        if (error.status >= 400 && error.status < 500) {
            return 'MEDIUM';
        }
        
        return 'LOW';
    }
    
    determineType(error) {
        if (error.code?.startsWith('ECONN')) return 'NETWORK';
        if (error.status >= 400 && error.status < 500) return 'CLIENT';
        if (error.status >= 500) return 'SERVER';
        if (error.type === 'ValidationError') return 'VALIDATION';
        if (error.type === 'AuthenticationError') return 'AUTH';
        return 'UNKNOWN';
    }
    
    generateUserMessage(error) {
        const messageMap = {
            'NETWORK': 'We\'re experiencing connectivity issues. Please try again in a moment.',
            'CLIENT': 'There was an issue with your request. Please check your input and try again.',
            'SERVER': 'We\'re experiencing technical difficulties. Our team has been notified.',
            'VALIDATION': 'Please check your input and ensure all required fields are completed correctly.',
            'AUTH': 'Authentication failed. Please log in again.',
            'UNKNOWN': 'An unexpected error occurred. Please try again or contact support.'
        };
        
        const type = this.determineType(error);
        return messageMap[type] || messageMap['UNKNOWN'];
    }
    
    getResolutionSteps(error) {
        const stepsMap = {
            'NETWORK': [
                'Check your internet connection',
                'Try refreshing the page',
                'If the problem persists, contact support'
            ],
            'CLIENT': [
                'Verify all required fields are filled',
                'Check data format requirements',
                'Ensure you have necessary permissions'
            ],
            'SERVER': [
                'Our technical team has been automatically notified',
                'Please try again in a few minutes',
                'Contact support if the issue continues'
            ],
            'AUTH': [
                'Log out and log back in',
                'Clear your browser cache',
                'Reset your password if needed'
            ]
        };
        
        const type = this.determineType(error);
        return stepsMap[type] || ['Contact support for assistance'];
    }
    
    checkEscalation(errorCategory) {
        const rule = this.escalationRules.get(errorCategory.severity);
        if (!rule) return;
        
        // Implementation would check error frequency and trigger escalation
        // This is a simplified version
        if (errorCategory.severity === 'CRITICAL') {
            this.escalate(errorCategory, rule);
        }
    }
    
    escalate(errorCategory, rule) {
        rule.channels.forEach(channel => {
            this.monitor?.sendAlert(channel, {
                severity: errorCategory.severity,
                message: `${errorCategory.severity} error in ${errorCategory.component}`,
                error: errorCategory,
                timestamp: errorCategory.metadata.timestamp
            });
        });
    }
}

// Graceful Degradation Manager
class DegradationManager {
    constructor(monitor) {
        this.monitor = monitor;
        this.services = new Map();
        this.degradationModes = new Map();
        this.setupDegradationModes();
    }
    
    setupDegradationModes() {
        // Container tracking degradation
        this.degradationModes.set('container-tracking', {
            fallback: 'cached-data',
            features: ['real-time-updates'],
            message: 'Showing cached tracking data. Real-time updates temporarily unavailable.'
        });
        
        // API rate limiting degradation
        this.degradationModes.set('api-gateway', {
            fallback: 'queue-requests',
            features: ['immediate-response'],
            message: 'High traffic detected. Requests are being queued for processing.'
        });
        
        // Payment processing degradation
        this.degradationModes.set('payments', {
            fallback: 'manual-processing',
            features: ['auto-billing'],
            message: 'Payment processing temporarily delayed. Your request has been queued.'
        });
    }
    
    registerService(serviceName, healthCheck, fallbackHandler) {
        this.services.set(serviceName, {
            healthCheck,
            fallbackHandler,
            isHealthy: true,
            lastCheck: Date.now(),
            degraded: false
        });
    }
    
    async checkServiceHealth(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) return false;
        
        try {
            const isHealthy = await service.healthCheck();
            service.isHealthy = isHealthy;
            service.lastCheck = Date.now();
            
            if (!isHealthy && !service.degraded) {
                this.enterDegradedMode(serviceName);
            } else if (isHealthy && service.degraded) {
                this.exitDegradedMode(serviceName);
            }
            
            return isHealthy;
        } catch (error) {
            this.monitor?.recordError(error, 'health_check_failed', { service: serviceName });
            service.isHealthy = false;
            if (!service.degraded) {
                this.enterDegradedMode(serviceName);
            }
            return false;
        }
    }
    
    enterDegradedMode(serviceName) {
        const service = this.services.get(serviceName);
        const mode = this.degradationModes.get(serviceName);
        
        if (service && mode) {
            service.degraded = true;
            this.monitor?.recordEvent('service_degraded', {
                service: serviceName,
                fallback: mode.fallback,
                disabledFeatures: mode.features
            });
            
            this.monitor?.sendAlert('slack-monitoring', {
                severity: 'WARNING',
                message: `Service ${serviceName} entered degraded mode: ${mode.message}`
            });
        }
    }
    
    exitDegradedMode(serviceName) {
        const service = this.services.get(serviceName);
        
        if (service && service.degraded) {
            service.degraded = false;
            this.monitor?.recordEvent('service_recovered', { service: serviceName });
            
            this.monitor?.sendAlert('slack-monitoring', {
                severity: 'INFO',
                message: `Service ${serviceName} recovered from degraded mode`
            });
        }
    }
    
    async executeWithFallback(serviceName, operation, fallbackOperation) {
        const service = this.services.get(serviceName);
        
        if (!service || service.degraded) {
            this.monitor?.recordMetric('fallback_execution', 1, { service: serviceName });
            return await fallbackOperation();
        }
        
        try {
            return await operation();
        } catch (error) {
            this.monitor?.recordError(error, 'service_operation_failed', { service: serviceName });
            await this.checkServiceHealth(serviceName);
            return await fallbackOperation();
        }
    }
}

// Custom Error Classes
class CircuitBreakerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CircuitBreakerError';
        this.type = 'INFRASTRUCTURE';
    }
}

class DegradedServiceError extends Error {
    constructor(message, serviceName) {
        super(message);
        this.name = 'DegradedServiceError';
        this.type = 'SERVICE_DEGRADED';
        this.serviceName = serviceName;
    }
}

// Main Error Handling Service
class ErrorHandlingService {
    constructor(monitor) {
        this.monitor = monitor;
        this.circuitBreakers = new Map();
        this.retryHandler = new RetryHandler({ monitor });
        this.categorizer = new ErrorCategorizer(monitor);
        this.degradationManager = new DegradationManager(monitor);
        
        this.setupGlobalErrorHandlers();
    }
    
    createCircuitBreaker(serviceName, options = {}) {
        const breaker = new CircuitBreaker(serviceName, { ...options, monitor: this.monitor });
        this.circuitBreakers.set(serviceName, breaker);
        return breaker;
    }
    
    async executeWithResilience(serviceName, operation, options = {}) {
        const breaker = this.circuitBreakers.get(serviceName);
        const context = { operation: serviceName, ...options.context };
        
        if (breaker) {
            return await breaker.execute(async () => {
                return await this.retryHandler.execute(operation, context);
            });
        } else {
            return await this.retryHandler.execute(operation, context);
        }
    }
    
    handleError(error, context = {}) {
        const categorizedError = this.categorizer.categorizeError(error, context);
        
        // Log structured error data
        this.monitor?.recordError(error, 'handled_error', {
            category: categorizedError,
            context: context
        });
        
        return categorizedError;
    }
    
    setupGlobalErrorHandlers() {
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.monitor?.recordError(reason, 'unhandled_rejection', {
                promise: promise.toString()
            });
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.monitor?.recordError(error, 'uncaught_exception');
            // In production, you might want to gracefully shutdown here
        });
    }
}

module.exports = {
    ErrorHandlingService,
    CircuitBreaker,
    RetryHandler,
    ErrorCategorizer,
    DegradationManager,
    CircuitBreakerError,
    DegradedServiceError
};