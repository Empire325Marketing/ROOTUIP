// Error Tracking System for ROOTUIP
// Client-side error monitoring and reporting

const ErrorTracker = {
    // Configuration
    config: {
        apiEndpoint: '/api/errors',
        maxErrors: 100,
        throttleMs: 1000,
        enableConsoleCapture: true,
        enableNetworkCapture: true,
        enableUserActions: true,
        sensitivePatterns: [
            /password/i,
            /token/i,
            /api[_-]?key/i,
            /secret/i,
            /credit[_-]?card/i
        ]
    },

    // Error storage
    errorQueue: [],
    lastError: null,
    errorCount: 0,
    sessionId: null,
    
    // Initialize error tracking
    init() {
        this.sessionId = this.generateSessionId();
        this.setupErrorHandlers();
        this.setupConsoleCapture();
        this.setupNetworkCapture();
        this.setupUserActionTracking();
        this.startHeartbeat();
        
        console.log('Error tracking initialized');
    },

    // Generate unique session ID
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Setup global error handlers
    setupErrorHandlers() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.captureError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error ? event.error.stack : null,
                timestamp: Date.now()
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.captureError({
                type: 'unhandled_promise',
                message: event.reason ? event.reason.toString() : 'Unhandled Promise Rejection',
                stack: event.reason && event.reason.stack ? event.reason.stack : null,
                timestamp: Date.now()
            });
        });
    },

    // Capture console errors
    setupConsoleCapture() {
        if (!this.config.enableConsoleCapture) return;

        const originalError = console.error;
        console.error = (...args) => {
            this.captureError({
                type: 'console',
                level: 'error',
                message: args.map(arg => this.sanitizeData(arg)).join(' '),
                timestamp: Date.now()
            });
            originalError.apply(console, args);
        };

        const originalWarn = console.warn;
        console.warn = (...args) => {
            this.captureError({
                type: 'console',
                level: 'warn',
                message: args.map(arg => this.sanitizeData(arg)).join(' '),
                timestamp: Date.now()
            });
            originalWarn.apply(console, args);
        };
    },

    // Capture network errors
    setupNetworkCapture() {
        if (!this.config.enableNetworkCapture) return;

        // Intercept fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = Date.now();
            try {
                const response = await originalFetch(...args);
                const duration = Date.now() - startTime;
                
                if (!response.ok) {
                    this.captureError({
                        type: 'network',
                        subtype: 'fetch',
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText,
                        duration: duration,
                        timestamp: Date.now()
                    });
                }
                
                return response;
            } catch (error) {
                this.captureError({
                    type: 'network',
                    subtype: 'fetch',
                    url: args[0],
                    message: error.message,
                    duration: Date.now() - startTime,
                    timestamp: Date.now()
                });
                throw error;
            }
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._errorTracker = {
                method: method,
                url: url,
                startTime: null
            };
            return originalOpen.apply(this, [method, url, ...rest]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            this._errorTracker.startTime = Date.now();
            
            this.addEventListener('error', () => {
                ErrorTracker.captureError({
                    type: 'network',
                    subtype: 'xhr',
                    method: this._errorTracker.method,
                    url: this._errorTracker.url,
                    message: 'Network request failed',
                    duration: Date.now() - this._errorTracker.startTime,
                    timestamp: Date.now()
                });
            });
            
            this.addEventListener('load', () => {
                if (this.status >= 400) {
                    ErrorTracker.captureError({
                        type: 'network',
                        subtype: 'xhr',
                        method: this._errorTracker.method,
                        url: this._errorTracker.url,
                        status: this.status,
                        statusText: this.statusText,
                        duration: Date.now() - this._errorTracker.startTime,
                        timestamp: Date.now()
                    });
                }
            });
            
            return originalSend.apply(this, args);
        };
    },

    // Track user actions for context
    setupUserActionTracking() {
        if (!this.config.enableUserActions) return;

        const actions = [];
        const maxActions = 20;

        // Track clicks
        document.addEventListener('click', (event) => {
            const target = event.target;
            const action = {
                type: 'click',
                target: this.getElementSelector(target),
                timestamp: Date.now()
            };
            
            actions.push(action);
            if (actions.length > maxActions) {
                actions.shift();
            }
        });

        // Track form submissions
        document.addEventListener('submit', (event) => {
            const target = event.target;
            const action = {
                type: 'submit',
                target: this.getElementSelector(target),
                timestamp: Date.now()
            };
            
            actions.push(action);
            if (actions.length > maxActions) {
                actions.shift();
            }
        });

        // Store actions for error context
        this.userActions = actions;
    },

    // Get CSS selector for element
    getElementSelector(element) {
        if (!element) return 'unknown';
        
        if (element.id) {
            return '#' + element.id;
        }
        
        if (element.className) {
            return element.tagName.toLowerCase() + '.' + element.className.split(' ').join('.');
        }
        
        return element.tagName.toLowerCase();
    },

    // Capture error with context
    captureError(error) {
        // Throttle errors
        if (this.lastError && Date.now() - this.lastError < this.config.throttleMs) {
            return;
        }

        // Sanitize error data
        error = this.sanitizeData(error);

        // Add context
        error.context = {
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: error.timestamp || Date.now(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            screen: {
                width: screen.width,
                height: screen.height
            },
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            } : null,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null,
            userActions: this.userActions || []
        };

        // Add to queue
        this.errorQueue.push(error);
        this.errorCount++;
        this.lastError = Date.now();

        // Limit queue size
        if (this.errorQueue.length > this.config.maxErrors) {
            this.errorQueue.shift();
        }

        // Send errors if batch is ready
        if (this.errorQueue.length >= 10) {
            this.sendErrors();
        }

        // Log to console in development
        if (window.location.hostname === 'localhost') {
            console.log('Error captured:', error);
        }
    },

    // Sanitize sensitive data
    sanitizeData(data) {
        if (typeof data === 'string') {
            let sanitized = data;
            this.config.sensitivePatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '[REDACTED]');
            });
            return sanitized;
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    // Check if key contains sensitive info
                    let isSensitive = false;
                    this.config.sensitivePatterns.forEach(pattern => {
                        if (pattern.test(key)) {
                            isSensitive = true;
                        }
                    });
                    
                    if (isSensitive) {
                        sanitized[key] = '[REDACTED]';
                    } else {
                        sanitized[key] = this.sanitizeData(data[key]);
                    }
                }
            }
            return sanitized;
        }
        
        return data;
    },

    // Send errors to server
    async sendErrors() {
        if (this.errorQueue.length === 0) return;

        const errors = [...this.errorQueue];
        this.errorQueue = [];

        try {
            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify({
                    errors: errors,
                    sessionId: this.sessionId,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                // Re-queue errors if send failed
                this.errorQueue.unshift(...errors);
            }
        } catch (error) {
            // Re-queue errors if send failed
            this.errorQueue.unshift(...errors);
            console.error('Failed to send errors to server:', error);
        }
    },

    // Heartbeat to send queued errors
    startHeartbeat() {
        setInterval(() => {
            if (this.errorQueue.length > 0) {
                this.sendErrors();
            }
        }, 30000); // Every 30 seconds
    },

    // Manual error capture
    captureException(error, context = {}) {
        this.captureError({
            type: 'manual',
            message: error.message || error.toString(),
            stack: error.stack || null,
            context: context,
            timestamp: Date.now()
        });
    },

    // Get error statistics
    getStats() {
        return {
            sessionId: this.sessionId,
            errorCount: this.errorCount,
            queuedErrors: this.errorQueue.length,
            lastError: this.lastError
        };
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ErrorTracker.init());
} else {
    ErrorTracker.init();
}

// Export for use in other modules
window.ErrorTracker = ErrorTracker;