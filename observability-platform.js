/**
 * ROOTUIP Observability Platform
 * Distributed tracing, log aggregation, and performance analysis
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Distributed Tracing System
class DistributedTracer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            serviceName: config.serviceName || 'rootuip-service',
            version: config.version || '1.0.0',
            environment: config.environment || 'production',
            sampleRate: config.sampleRate || 0.1,
            maxSpansPerTrace: config.maxSpansPerTrace || 100,
            ...config
        };
        
        this.activeTraces = new Map();
        this.traceBuffer = [];
        this.spanBuffer = [];
        this.correlationContext = new Map();
        
        this.setupTraceContext();
    }
    
    setupTraceContext() {
        // Create async context for trace propagation
        this.asyncLocalStorage = require('async_hooks').AsyncLocalStorage || null;
        if (this.asyncLocalStorage) {
            this.storage = new this.asyncLocalStorage();
        }
    }
    
    // Start a new trace
    startTrace(operationName, tags = {}) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        
        const trace = {
            traceId,
            operationName,
            startTime: Date.now(),
            startTimeHR: process.hrtime(),
            tags: {
                service: this.config.serviceName,
                version: this.config.version,
                environment: this.config.environment,
                ...tags
            },
            spans: [],
            baggage: {},
            sampled: Math.random() < this.config.sampleRate
        };
        
        const rootSpan = this.createSpan(traceId, null, spanId, operationName, tags);
        trace.spans.push(rootSpan);
        trace.rootSpanId = spanId;
        
        this.activeTraces.set(traceId, trace);
        
        if (this.storage) {
            return this.storage.run({ traceId, spanId }, () => {
                return { traceId, spanId };
            });
        }
        
        return { traceId, spanId };
    }
    
    // Create a child span
    startSpan(operationName, parentContext = null, tags = {}) {
        let traceId, parentSpanId;
        
        if (parentContext) {
            traceId = parentContext.traceId;
            parentSpanId = parentContext.spanId;
        } else if (this.storage) {
            const context = this.storage.getStore();
            if (context) {
                traceId = context.traceId;
                parentSpanId = context.spanId;
            }
        }
        
        if (!traceId) {
            // Start new trace if no context
            return this.startTrace(operationName, tags);
        }
        
        const trace = this.activeTraces.get(traceId);
        if (!trace || !trace.sampled) {
            return { traceId, spanId: this.generateSpanId() };
        }
        
        const spanId = this.generateSpanId();
        const span = this.createSpan(traceId, parentSpanId, spanId, operationName, tags);
        
        trace.spans.push(span);
        
        if (this.storage) {
            return this.storage.run({ traceId, spanId }, () => {
                return { traceId, spanId };
            });
        }
        
        return { traceId, spanId };
    }
    
    createSpan(traceId, parentSpanId, spanId, operationName, tags = {}) {
        return {
            traceId,
            spanId,
            parentSpanId,
            operationName,
            startTime: Date.now(),
            startTimeHR: process.hrtime(),
            tags: { ...tags },
            logs: [],
            status: 'ok',
            duration: null
        };
    }
    
    // Finish a span
    finishSpan(context, tags = {}, logs = []) {
        if (!context || !context.traceId || !context.spanId) return;
        
        const trace = this.activeTraces.get(context.traceId);
        if (!trace || !trace.sampled) return;
        
        const span = trace.spans.find(s => s.spanId === context.spanId);
        if (!span) return;
        
        const hrDiff = process.hrtime(span.startTimeHR);
        span.duration = hrDiff[0] * 1000 + hrDiff[1] / 1000000; // Convert to milliseconds
        span.endTime = Date.now();
        span.tags = { ...span.tags, ...tags };
        span.logs = [...span.logs, ...logs];
        
        this.emit('span_finished', span);
        
        // Check if this is the root span
        if (span.spanId === trace.rootSpanId) {
            this.finishTrace(context.traceId);
        }
    }
    
    // Finish entire trace
    finishTrace(traceId) {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return;
        
        const hrDiff = process.hrtime(trace.startTimeHR);
        trace.duration = hrDiff[0] * 1000 + hrDiff[1] / 1000000;
        trace.endTime = Date.now();
        
        if (trace.sampled) {
            this.traceBuffer.push(trace);
            this.emit('trace_finished', trace);
        }
        
        this.activeTraces.delete(traceId);
        
        // Flush if buffer is full
        if (this.traceBuffer.length >= 50) {
            this.flushTraces();
        }
    }
    
    // Add log to current span
    logToSpan(context, level, message, fields = {}) {
        if (!context || !context.traceId || !context.spanId) return;
        
        const trace = this.activeTraces.get(context.traceId);
        if (!trace || !trace.sampled) return;
        
        const span = trace.spans.find(s => s.spanId === context.spanId);
        if (!span) return;
        
        span.logs.push({
            timestamp: Date.now(),
            level,
            message,
            fields
        });
    }
    
    // Set baggage (cross-service metadata)
    setBaggage(context, key, value) {
        if (!context || !context.traceId) return;
        
        const trace = this.activeTraces.get(context.traceId);
        if (trace) {
            trace.baggage[key] = value;
        }
    }
    
    getBaggage(context, key) {
        if (!context || !context.traceId) return null;
        
        const trace = this.activeTraces.get(context.traceId);
        return trace ? trace.baggage[key] : null;
    }
    
    // Extract trace context from headers (for HTTP requests)
    extractContext(headers) {
        const traceId = headers['x-trace-id'] || headers['traceid'];
        const spanId = headers['x-span-id'] || headers['spanid'];
        const sampled = headers['x-sampled'] === '1';
        
        if (traceId && spanId) {
            return { traceId, spanId, sampled };
        }
        
        return null;
    }
    
    // Inject trace context into headers
    injectContext(context, headers = {}) {
        if (context && context.traceId && context.spanId) {
            headers['x-trace-id'] = context.traceId;
            headers['x-span-id'] = context.spanId;
            headers['x-sampled'] = '1';
        }
        
        return headers;
    }
    
    flushTraces() {
        if (this.traceBuffer.length === 0) return;
        
        const traces = [...this.traceBuffer];
        this.traceBuffer = [];
        
        this.emit('traces_flush', traces);
    }
    
    generateTraceId() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    generateSpanId() {
        return crypto.randomBytes(8).toString('hex');
    }
    
    // Get current trace context
    getCurrentContext() {
        if (this.storage) {
            return this.storage.getStore();
        }
        return null;
    }
}

// Log Aggregation System
class LogAggregator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            logLevel: config.logLevel || 'info',
            bufferSize: config.bufferSize || 1000,
            flushInterval: config.flushInterval || 10000,
            enableConsole: config.enableConsole !== false,
            enableFile: config.enableFile || false,
            logFile: config.logFile || 'logs/application.log',
            structured: config.structured !== false,
            ...config
        };
        
        this.logBuffer = [];
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            fatal: 4
        };
        
        this.currentLevel = this.logLevels[this.config.logLevel];
        this.setupFileLogging();
        this.startPeriodicFlush();
    }
    
    setupFileLogging() {
        if (this.config.enableFile) {
            const logDir = path.dirname(this.config.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }
    
    log(level, message, metadata = {}, context = null) {
        const levelNum = this.logLevels[level];
        if (levelNum < this.currentLevel) return;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            metadata,
            pid: process.pid,
            hostname: require('os').hostname(),
            service: this.config.serviceName || 'rootuip'
        };
        
        // Add trace context if available
        if (context && context.traceId) {
            logEntry.traceId = context.traceId;
            logEntry.spanId = context.spanId;
        }
        
        // Add structured logging fields
        if (this.config.structured) {
            logEntry.fields = this.extractStructuredFields(metadata);
        }
        
        this.logBuffer.push(logEntry);
        
        if (this.config.enableConsole) {
            this.writeToConsole(logEntry);
        }
        
        if (this.logBuffer.length >= this.config.bufferSize) {
            this.flush();
        }
        
        this.emit('log_entry', logEntry);
    }
    
    debug(message, metadata = {}, context = null) {
        this.log('debug', message, metadata, context);
    }
    
    info(message, metadata = {}, context = null) {
        this.log('info', message, metadata, context);
    }
    
    warn(message, metadata = {}, context = null) {
        this.log('warn', message, metadata, context);
    }
    
    error(message, metadata = {}, context = null) {
        this.log('error', message, metadata, context);
    }
    
    fatal(message, metadata = {}, context = null) {
        this.log('fatal', message, metadata, context);
    }
    
    extractStructuredFields(metadata) {
        const fields = {};
        
        if (metadata.userId) fields.userId = metadata.userId;
        if (metadata.sessionId) fields.sessionId = metadata.sessionId;
        if (metadata.requestId) fields.requestId = metadata.requestId;
        if (metadata.operation) fields.operation = metadata.operation;
        if (metadata.duration) fields.duration = metadata.duration;
        if (metadata.statusCode) fields.statusCode = metadata.statusCode;
        if (metadata.userAgent) fields.userAgent = metadata.userAgent;
        if (metadata.ip) fields.ip = metadata.ip;
        
        return fields;
    }
    
    writeToConsole(logEntry) {
        const colors = {
            DEBUG: '\x1b[36m', // Cyan
            INFO: '\x1b[32m',  // Green
            WARN: '\x1b[33m',  // Yellow
            ERROR: '\x1b[31m', // Red
            FATAL: '\x1b[35m'  // Magenta
        };
        
        const resetColor = '\x1b[0m';
        const color = colors[logEntry.level] || '';
        
        const message = this.config.structured 
            ? JSON.stringify(logEntry)
            : `${logEntry.timestamp} ${color}[${logEntry.level}]${resetColor} ${logEntry.message}`;
            
        console.log(message);
    }
    
    startPeriodicFlush() {
        setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }
    
    flush() {
        if (this.logBuffer.length === 0) return;
        
        const logs = [...this.logBuffer];
        this.logBuffer = [];
        
        if (this.config.enableFile) {
            this.writeToFile(logs);
        }
        
        this.emit('logs_flush', logs);
    }
    
    writeToFile(logs) {
        const logLines = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
        
        fs.appendFile(this.config.logFile, logLines, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });
    }
    
    // Search logs (for basic log analysis)
    searchLogs(query, options = {}) {
        const {
            level,
            startTime,
            endTime,
            traceId,
            userId,
            limit = 100
        } = options;
        
        // This is a basic implementation
        // In production, you'd use Elasticsearch or similar
        return new Promise((resolve) => {
            // Simulate log search
            setTimeout(() => {
                resolve([]);
            }, 100);
        });
    }
}

// Performance Bottleneck Analyzer
class PerformanceAnalyzer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.metrics = new Map();
        this.bottlenecks = [];
        this.analysisWindow = config.analysisWindow || 300000; // 5 minutes
        this.thresholds = {
            slowQuery: config.slowQueryThreshold || 1000,
            highCPU: config.highCPUThreshold || 80,
            highMemory: config.highMemoryThreshold || 85,
            highErrorRate: config.highErrorRateThreshold || 0.05
        };
        
        this.startAnalysis();
    }
    
    recordPerformanceMetric(type, value, metadata = {}) {
        const key = `${type}_${Date.now()}`;
        this.metrics.set(key, {
            type,
            value,
            metadata,
            timestamp: Date.now()
        });
        
        // Clean old metrics
        this.cleanOldMetrics();
        
        // Analyze for bottlenecks
        this.analyzeBottlenecks(type, value, metadata);
    }
    
    analyzeBottlenecks(type, value, metadata) {
        switch (type) {
            case 'database_query':
                if (value > this.thresholds.slowQuery) {
                    this.reportBottleneck('slow_database_query', {
                        duration: value,
                        query: metadata.query,
                        severity: value > this.thresholds.slowQuery * 2 ? 'high' : 'medium'
                    });
                }
                break;
                
            case 'api_response_time':
                if (value > 2000) {
                    this.reportBottleneck('slow_api_response', {
                        duration: value,
                        endpoint: metadata.endpoint,
                        severity: value > 5000 ? 'high' : 'medium'
                    });
                }
                break;
                
            case 'memory_usage':
                if (value > this.thresholds.highMemory) {
                    this.reportBottleneck('high_memory_usage', {
                        usage: value,
                        process: metadata.process,
                        severity: value > 95 ? 'critical' : 'high'
                    });
                }
                break;
                
            case 'cpu_usage':
                if (value > this.thresholds.highCPU) {
                    this.reportBottleneck('high_cpu_usage', {
                        usage: value,
                        process: metadata.process,
                        severity: value > 95 ? 'critical' : 'high'
                    });
                }
                break;
        }
    }
    
    reportBottleneck(type, details) {
        const bottleneck = {
            id: this.generateId(),
            type,
            details,
            timestamp: Date.now(),
            resolved: false
        };
        
        this.bottlenecks.push(bottleneck);
        this.emit('bottleneck_detected', bottleneck);
        
        // Auto-resolve after analysis window
        setTimeout(() => {
            bottleneck.resolved = true;
        }, this.analysisWindow);
    }
    
    startAnalysis() {
        setInterval(() => {
            this.performPeriodicAnalysis();
        }, 60000); // Every minute
    }
    
    performPeriodicAnalysis() {
        const now = Date.now();
        const windowStart = now - this.analysisWindow;
        
        // Analyze trends
        this.analyzeTrends(windowStart, now);
        
        // Detect patterns
        this.detectPatterns(windowStart, now);
        
        // Generate recommendations
        this.generateRecommendations();
    }
    
    analyzeTrends(startTime, endTime) {
        const metrics = Array.from(this.metrics.values())
            .filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
            
        const trends = {};
        
        metrics.forEach(metric => {
            if (!trends[metric.type]) {
                trends[metric.type] = [];
            }
            trends[metric.type].push(metric.value);
        });
        
        Object.entries(trends).forEach(([type, values]) => {
            if (values.length < 2) return;
            
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            
            this.emit('trend_analysis', {
                type,
                average: avg,
                maximum: max,
                minimum: min,
                count: values.length,
                period: { startTime, endTime }
            });
        });
    }
    
    detectPatterns(startTime, endTime) {
        // Detect recurring performance issues
        const bottlenecks = this.bottlenecks
            .filter(b => b.timestamp >= startTime && b.timestamp <= endTime)
            .reduce((acc, bottleneck) => {
                acc[bottleneck.type] = (acc[bottleneck.type] || 0) + 1;
                return acc;
            }, {});
            
        Object.entries(bottlenecks).forEach(([type, count]) => {
            if (count >= 3) {
                this.emit('pattern_detected', {
                    type,
                    occurrences: count,
                    period: { startTime, endTime },
                    severity: count >= 10 ? 'high' : 'medium'
                });
            }
        });
    }
    
    generateRecommendations() {
        const activeBottlenecks = this.bottlenecks.filter(b => !b.resolved);
        const recommendations = [];
        
        activeBottlenecks.forEach(bottleneck => {
            switch (bottleneck.type) {
                case 'slow_database_query':
                    recommendations.push({
                        type: 'optimization',
                        priority: 'high',
                        suggestion: 'Consider adding database indexes or optimizing query structure',
                        target: bottleneck.details.query
                    });
                    break;
                    
                case 'high_memory_usage':
                    recommendations.push({
                        type: 'resource',
                        priority: 'medium',
                        suggestion: 'Consider increasing memory allocation or optimizing memory usage',
                        target: bottleneck.details.process
                    });
                    break;
            }
        });
        
        if (recommendations.length > 0) {
            this.emit('recommendations_generated', recommendations);
        }
    }
    
    cleanOldMetrics() {
        const cutoff = Date.now() - (this.analysisWindow * 2);
        
        for (const [key, metric] of this.metrics) {
            if (metric.timestamp < cutoff) {
                this.metrics.delete(key);
            }
        }
    }
    
    generateId() {
        return crypto.randomBytes(8).toString('hex');
    }
    
    getPerformanceReport() {
        const now = Date.now();
        const windowStart = now - this.analysisWindow;
        
        const recentBottlenecks = this.bottlenecks
            .filter(b => b.timestamp >= windowStart)
            .length;
            
        const activeBottlenecks = this.bottlenecks
            .filter(b => !b.resolved)
            .length;
            
        return {
            timestamp: now,
            activeBottlenecks,
            recentBottlenecks,
            topBottlenecks: this.getTopBottlenecks(),
            systemHealth: this.calculateSystemHealth()
        };
    }
    
    getTopBottlenecks() {
        const counts = this.bottlenecks.reduce((acc, bottleneck) => {
            acc[bottleneck.type] = (acc[bottleneck.type] || 0) + 1;
            return acc;
        }, {});
        
        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
    }
    
    calculateSystemHealth() {
        const activeBottlenecks = this.bottlenecks.filter(b => !b.resolved);
        const criticalBottlenecks = activeBottlenecks.filter(b => b.details.severity === 'critical');
        
        if (criticalBottlenecks.length > 0) return 'critical';
        if (activeBottlenecks.length > 5) return 'degraded';
        if (activeBottlenecks.length > 0) return 'warning';
        return 'healthy';
    }
}

module.exports = {
    DistributedTracer,
    LogAggregator,
    PerformanceAnalyzer
};