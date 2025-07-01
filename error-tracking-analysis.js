/**
 * ROOTUIP Error Tracking & Analysis System
 * Stack trace analysis, error aggregation, and intelligent categorization
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Error Tracking Engine
class ErrorTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            environment: config.environment || 'production',
            version: config.version || '1.0.0',
            maxStackTraceDepth: config.maxStackTraceDepth || 50,
            aggregationWindow: config.aggregationWindow || 300000, // 5 minutes
            retentionPeriod: config.retentionPeriod || 30 * 24 * 60 * 60 * 1000, // 30 days
            ...config
        };
        
        this.errors = new Map();
        this.errorGroups = new Map();
        this.errorStats = new Map();
        this.alertRules = new Map();
        
        this.setupDefaultAlertRules();
        this.startPeriodicCleanup();
    }
    
    // Capture and process errors
    captureError(error, context = {}) {
        const errorData = this.processError(error, context);
        const fingerprint = this.generateFingerprint(errorData);
        
        // Store individual error occurrence
        this.errors.set(errorData.id, errorData);
        
        // Group similar errors
        this.groupError(fingerprint, errorData);
        
        // Update statistics
        this.updateErrorStats(fingerprint, errorData);
        
        // Check alert conditions
        this.checkAlertConditions(fingerprint, errorData);
        
        this.emit('error_captured', errorData);
        
        return errorData.id;
    }
    
    processError(error, context) {
        const now = Date.now();
        const stackTrace = this.parseStackTrace(error.stack);
        
        return {
            id: this.generateErrorId(),
            timestamp: now,
            message: error.message,
            type: error.constructor.name,
            code: error.code,
            stack: error.stack,
            parsedStack: stackTrace,
            fingerprint: null, // Will be set by generateFingerprint
            context: {
                userId: context.userId,
                sessionId: context.sessionId,
                requestId: context.requestId,
                traceId: context.traceId,
                spanId: context.spanId,
                url: context.url,
                userAgent: context.userAgent,
                ip: context.ip,
                component: context.component,
                operation: context.operation,
                environment: this.config.environment,
                version: this.config.version,
                ...context
            },
            severity: this.calculateSeverity(error, context),
            tags: this.extractTags(error, context),
            metadata: this.extractMetadata(error, context)
        };
    }
    
    parseStackTrace(stack) {
        if (!stack) return [];
        
        const lines = stack.split('\n');
        const frames = [];
        
        for (let i = 1; i < Math.min(lines.length, this.config.maxStackTraceDepth + 1); i++) {
            const line = lines[i].trim();
            if (!line.startsWith('at ')) continue;
            
            const frame = this.parseStackFrame(line);
            if (frame) {
                frames.push(frame);
            }
        }
        
        return frames;
    }
    
    parseStackFrame(line) {
        // Parse Node.js stack frame format
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                      line.match(/at\s+(.+?):(\d+):(\d+)/) ||
                      line.match(/at\s+(.+)/);
                      
        if (!match) return null;
        
        const hasParens = line.includes('(');
        
        return {
            function: hasParens ? match[1] : '<anonymous>',
            filename: hasParens ? match[2] : match[1],
            lineno: hasParens ? parseInt(match[3]) : parseInt(match[2]),
            colno: hasParens ? parseInt(match[4]) : parseInt(match[3]),
            inApp: this.isInApp(hasParens ? match[2] : match[1])
        };
    }
    
    isInApp(filename) {
        if (!filename) return false;
        
        // Consider files in project directory as "in app"
        return !filename.includes('node_modules') && 
               (filename.startsWith('./') || filename.startsWith('/') || !filename.includes('/'));
    }
    
    generateFingerprint(errorData) {
        // Create fingerprint for grouping similar errors
        const components = [
            errorData.type,
            errorData.message.replace(/\d+/g, 'N'), // Replace numbers with N
            errorData.parsedStack.slice(0, 5).map(frame => 
                `${frame.function}:${frame.filename}:${frame.lineno}`
            ).join('|')
        ];
        
        const fingerprint = crypto
            .createHash('md5')
            .update(components.join('::'))
            .digest('hex');
            
        errorData.fingerprint = fingerprint;
        return fingerprint;
    }
    
    groupError(fingerprint, errorData) {
        if (!this.errorGroups.has(fingerprint)) {
            this.errorGroups.set(fingerprint, {
                fingerprint,
                firstSeen: errorData.timestamp,
                lastSeen: errorData.timestamp,
                count: 0,
                title: this.generateErrorTitle(errorData),
                level: errorData.severity,
                status: 'unresolved',
                assignee: null,
                tags: [...errorData.tags],
                environments: new Set([errorData.context.environment]),
                versions: new Set([errorData.context.version]),
                affectedUsers: new Set(),
                occurrences: [],
                metadata: {}
            });
        }
        
        const group = this.errorGroups.get(fingerprint);
        group.lastSeen = errorData.timestamp;
        group.count++;
        
        if (errorData.context.userId) {
            group.affectedUsers.add(errorData.context.userId);
        }
        
        group.environments.add(errorData.context.environment);
        group.versions.add(errorData.context.version);
        
        // Keep recent occurrences for analysis
        group.occurrences.push({
            id: errorData.id,
            timestamp: errorData.timestamp,
            userId: errorData.context.userId,
            context: errorData.context
        });
        
        // Limit occurrences to prevent memory bloat
        if (group.occurrences.length > 100) {
            group.occurrences = group.occurrences.slice(-100);
        }
        
        this.emit('error_grouped', { fingerprint, group, errorData });
    }
    
    generateErrorTitle(errorData) {
        const frame = errorData.parsedStack.find(f => f.inApp);
        const location = frame ? `${frame.function} (${path.basename(frame.filename)}:${frame.lineno})` : 'Unknown';
        
        return `${errorData.type}: ${errorData.message.slice(0, 100)} in ${location}`;
    }
    
    calculateSeverity(error, context) {
        // Security-related errors
        if (error.type === 'SecurityError' || 
            error.message.includes('unauthorized') ||
            error.message.includes('authentication')) {
            return 'critical';
        }
        
        // System errors
        if (error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.message.includes('database') ||
            error.message.includes('timeout')) {
            return 'high';
        }
        
        // Validation errors
        if (error.type === 'ValidationError' ||
            error.type === 'TypeError' && context.userInput) {
            return 'medium';
        }
        
        // Client errors (4xx)
        if (context.statusCode >= 400 && context.statusCode < 500) {
            return 'low';
        }
        
        // Server errors (5xx)
        if (context.statusCode >= 500) {
            return 'high';
        }
        
        return 'medium';
    }
    
    extractTags(error, context) {
        const tags = new Set();
        
        if (error.code) tags.add(`code:${error.code}`);
        if (context.component) tags.add(`component:${context.component}`);
        if (context.operation) tags.add(`operation:${context.operation}`);
        if (context.url) tags.add(`endpoint:${this.normalizeEndpoint(context.url)}`);
        
        return Array.from(tags);
    }
    
    normalizeEndpoint(url) {
        return url.replace(/\/\d+/g, '/:id').replace(/\?.*/, '');
    }
    
    extractMetadata(error, context) {
        return {
            browser: this.parseBrowser(context.userAgent),
            os: this.parseOS(context.userAgent),
            requestDuration: context.duration,
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
        };
    }
    
    parseBrowser(userAgent) {
        if (!userAgent) return null;
        
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        
        return 'Unknown';
    }
    
    parseOS(userAgent) {
        if (!userAgent) return null;
        
        if (userAgent.includes('Windows')) return 'Windows';
        if (userAgent.includes('Mac')) return 'macOS';
        if (userAgent.includes('Linux')) return 'Linux';
        if (userAgent.includes('Android')) return 'Android';
        if (userAgent.includes('iOS')) return 'iOS';
        
        return 'Unknown';
    }
    
    updateErrorStats(fingerprint, errorData) {
        const now = Date.now();
        const windowStart = now - this.config.aggregationWindow;
        
        if (!this.errorStats.has(fingerprint)) {
            this.errorStats.set(fingerprint, {
                fingerprint,
                windows: []
            });
        }
        
        const stats = this.errorStats.get(fingerprint);
        
        // Remove old windows
        stats.windows = stats.windows.filter(w => w.timestamp > windowStart);
        
        // Find or create current window
        let currentWindow = stats.windows.find(w => 
            w.timestamp > now - 60000 // 1 minute window
        );
        
        if (!currentWindow) {
            currentWindow = {
                timestamp: now,
                count: 0,
                uniqueUsers: new Set(),
                severity: errorData.severity
            };
            stats.windows.push(currentWindow);
        }
        
        currentWindow.count++;
        if (errorData.context.userId) {
            currentWindow.uniqueUsers.add(errorData.context.userId);
        }
    }
    
    setupDefaultAlertRules() {
        // High frequency alerts
        this.alertRules.set('high_frequency', {
            condition: (fingerprint) => {
                const stats = this.errorStats.get(fingerprint);
                if (!stats) return false;
                
                const recentWindows = stats.windows.slice(-5); // Last 5 minutes
                const totalCount = recentWindows.reduce((sum, w) => sum + w.count, 0);
                
                return totalCount > 10;
            },
            severity: 'warning',
            message: 'High error frequency detected'
        });
        
        // Critical error alerts
        this.alertRules.set('critical_error', {
            condition: (fingerprint, errorData) => {
                return errorData.severity === 'critical';
            },
            severity: 'critical',
            message: 'Critical error occurred'
        });
        
        // New error alerts
        this.alertRules.set('new_error', {
            condition: (fingerprint) => {
                const group = this.errorGroups.get(fingerprint);
                return group && group.count === 1;
            },
            severity: 'info',
            message: 'New error type detected'
        });
    }
    
    checkAlertConditions(fingerprint, errorData) {
        this.alertRules.forEach((rule, ruleName) => {
            if (rule.condition(fingerprint, errorData)) {
                this.emit('alert_triggered', {
                    rule: ruleName,
                    severity: rule.severity,
                    message: rule.message,
                    fingerprint,
                    errorData,
                    timestamp: Date.now()
                });
            }
        });
    }
    
    // Error resolution and management
    resolveError(fingerprint, resolution = {}) {
        const group = this.errorGroups.get(fingerprint);
        if (!group) return false;
        
        group.status = 'resolved';
        group.resolution = {
            timestamp: Date.now(),
            resolvedBy: resolution.resolvedBy,
            reason: resolution.reason,
            version: resolution.version
        };
        
        this.emit('error_resolved', { fingerprint, group, resolution });
        return true;
    }
    
    assignError(fingerprint, assignee) {
        const group = this.errorGroups.get(fingerprint);
        if (!group) return false;
        
        group.assignee = assignee;
        group.status = 'assigned';
        
        this.emit('error_assigned', { fingerprint, group, assignee });
        return true;
    }
    
    addNote(fingerprint, note, author) {
        const group = this.errorGroups.get(fingerprint);
        if (!group) return false;
        
        if (!group.notes) group.notes = [];
        
        group.notes.push({
            id: this.generateErrorId(),
            content: note,
            author,
            timestamp: Date.now()
        });
        
        this.emit('note_added', { fingerprint, note, author });
        return true;
    }
    
    // Analytics and reporting
    getErrorStats(timeRange = '24h') {
        const now = Date.now();
        const ranges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };
        
        const rangeMs = ranges[timeRange] || ranges['24h'];
        const startTime = now - rangeMs;
        
        const recentErrors = Array.from(this.errors.values())
            .filter(error => error.timestamp >= startTime);
            
        const errorsByType = {};
        const errorsBySeverity = {};
        const errorsOverTime = {};
        
        recentErrors.forEach(error => {
            // By type
            errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
            
            // By severity
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
            
            // Over time (hourly buckets)
            const hour = Math.floor(error.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
            errorsOverTime[hour] = (errorsOverTime[hour] || 0) + 1;
        });
        
        return {
            timeRange,
            totalErrors: recentErrors.length,
            uniqueErrors: new Set(recentErrors.map(e => e.fingerprint)).size,
            affectedUsers: new Set(recentErrors.map(e => e.context.userId).filter(Boolean)).size,
            errorsByType,
            errorsBySeverity,
            errorsOverTime,
            topErrors: this.getTopErrors(startTime)
        };
    }
    
    getTopErrors(startTime) {
        const recentGroups = Array.from(this.errorGroups.values())
            .filter(group => group.lastSeen >= startTime)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
            
        return recentGroups.map(group => ({
            fingerprint: group.fingerprint,
            title: group.title,
            count: group.count,
            affectedUsers: group.affectedUsers.size,
            lastSeen: group.lastSeen,
            severity: group.level,
            status: group.status
        }));
    }
    
    getErrorDetails(fingerprint) {
        const group = this.errorGroups.get(fingerprint);
        if (!group) return null;
        
        const recentOccurrences = group.occurrences.slice(-10);
        const sampleError = this.errors.get(recentOccurrences[0]?.id);
        
        return {
            ...group,
            affectedUsers: group.affectedUsers.size,
            environments: Array.from(group.environments),
            versions: Array.from(group.versions),
            recentOccurrences,
            sampleError: sampleError ? {
                message: sampleError.message,
                stack: sampleError.stack,
                context: sampleError.context
            } : null
        };
    }
    
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupOldData();
        }, 60 * 60 * 1000); // Every hour
    }
    
    cleanupOldData() {
        const cutoff = Date.now() - this.config.retentionPeriod;
        
        // Clean old errors
        for (const [id, error] of this.errors) {
            if (error.timestamp < cutoff) {
                this.errors.delete(id);
            }
        }
        
        // Clean old error groups
        for (const [fingerprint, group] of this.errorGroups) {
            if (group.lastSeen < cutoff) {
                this.errorGroups.delete(fingerprint);
                this.errorStats.delete(fingerprint);
            }
        }
    }
    
    generateErrorId() {
        return crypto.randomBytes(16).toString('hex');
    }
}

// Error Analysis Engine
class ErrorAnalysisEngine {
    constructor(errorTracker) {
        this.tracker = errorTracker;
        this.patterns = new Map();
        this.correlations = new Map();
        
        this.setupAnalysis();
    }
    
    setupAnalysis() {
        this.tracker.on('error_captured', (error) => {
            this.analyzeError(error);
        });
        
        // Periodic analysis
        setInterval(() => {
            this.performPeriodicAnalysis();
        }, 15 * 60 * 1000); // Every 15 minutes
    }
    
    analyzeError(errorData) {
        this.detectPatterns(errorData);
        this.findCorrelations(errorData);
        this.predictImpact(errorData);
    }
    
    detectPatterns(errorData) {
        // Time-based patterns
        this.analyzeTimePatterns(errorData);
        
        // User behavior patterns
        this.analyzeUserPatterns(errorData);
        
        // Geographic patterns
        this.analyzeGeographicPatterns(errorData);
    }
    
    analyzeTimePatterns(errorData) {
        const hour = new Date(errorData.timestamp).getHours();
        const dayOfWeek = new Date(errorData.timestamp).getDay();
        
        const key = `${errorData.fingerprint}_time`;
        if (!this.patterns.has(key)) {
            this.patterns.set(key, {
                hourly: new Array(24).fill(0),
                daily: new Array(7).fill(0)
            });
        }
        
        const pattern = this.patterns.get(key);
        pattern.hourly[hour]++;
        pattern.daily[dayOfWeek]++;
        
        // Detect anomalies
        const avgHourly = pattern.hourly.reduce((a, b) => a + b, 0) / 24;
        if (pattern.hourly[hour] > avgHourly * 3) {
            this.tracker.emit('pattern_detected', {
                type: 'time_anomaly',
                fingerprint: errorData.fingerprint,
                hour,
                count: pattern.hourly[hour],
                average: avgHourly
            });
        }
    }
    
    analyzeUserPatterns(errorData) {
        if (!errorData.context.userId) return;
        
        const key = `user_${errorData.context.userId}`;
        if (!this.patterns.has(key)) {
            this.patterns.set(key, {
                errorTypes: {},
                totalErrors: 0,
                firstError: errorData.timestamp
            });
        }
        
        const pattern = this.patterns.get(key);
        pattern.errorTypes[errorData.type] = (pattern.errorTypes[errorData.type] || 0) + 1;
        pattern.totalErrors++;
        
        // Detect problematic users
        if (pattern.totalErrors > 10) {
            this.tracker.emit('pattern_detected', {
                type: 'problematic_user',
                userId: errorData.context.userId,
                errorCount: pattern.totalErrors,
                errorTypes: pattern.errorTypes
            });
        }
    }
    
    analyzeGeographicPatterns(errorData) {
        if (!errorData.context.ip) return;
        
        // This would typically use a GeoIP service
        const region = this.getRegionFromIP(errorData.context.ip);
        
        const key = `region_${region}`;
        if (!this.patterns.has(key)) {
            this.patterns.set(key, { count: 0, errors: {} });
        }
        
        const pattern = this.patterns.get(key);
        pattern.count++;
        pattern.errors[errorData.fingerprint] = (pattern.errors[errorData.fingerprint] || 0) + 1;
    }
    
    findCorrelations(errorData) {
        // Find errors that occur together
        const timeWindow = 5 * 60 * 1000; // 5 minutes
        const recentErrors = Array.from(this.tracker.errors.values())
            .filter(e => 
                Math.abs(e.timestamp - errorData.timestamp) < timeWindow &&
                e.id !== errorData.id
            );
            
        recentErrors.forEach(relatedError => {
            const correlationKey = [errorData.fingerprint, relatedError.fingerprint]
                .sort()
                .join('::');
                
            if (!this.correlations.has(correlationKey)) {
                this.correlations.set(correlationKey, {
                    count: 0,
                    confidence: 0
                });
            }
            
            const correlation = this.correlations.get(correlationKey);
            correlation.count++;
            
            // Calculate confidence based on frequency
            const totalOccurrences = Math.max(
                this.tracker.errorGroups.get(errorData.fingerprint)?.count || 1,
                this.tracker.errorGroups.get(relatedError.fingerprint)?.count || 1
            );
            
            correlation.confidence = correlation.count / totalOccurrences;
            
            if (correlation.confidence > 0.7 && correlation.count > 5) {
                this.tracker.emit('correlation_detected', {
                    fingerprints: [errorData.fingerprint, relatedError.fingerprint],
                    confidence: correlation.confidence,
                    count: correlation.count
                });
            }
        });
    }
    
    predictImpact(errorData) {
        const group = this.tracker.errorGroups.get(errorData.fingerprint);
        if (!group) return;
        
        // Predict based on historical data
        const hourlyRate = group.count / ((Date.now() - group.firstSeen) / (60 * 60 * 1000));
        const projectedDailyCount = hourlyRate * 24;
        
        if (projectedDailyCount > 100) {
            this.tracker.emit('impact_prediction', {
                fingerprint: errorData.fingerprint,
                projectedDailyCount,
                severity: 'high',
                recommendation: 'Immediate attention required'
            });
        }
    }
    
    performPeriodicAnalysis() {
        this.generateInsights();
        this.cleanupOldPatterns();
    }
    
    generateInsights() {
        const insights = [];
        
        // Analyze trending errors
        const groups = Array.from(this.tracker.errorGroups.values())
            .filter(g => g.count > 5)
            .sort((a, b) => b.count - a.count);
            
        if (groups.length > 0) {
            insights.push({
                type: 'trending_error',
                title: 'Most frequent error',
                description: `${groups[0].title} has occurred ${groups[0].count} times`,
                actionable: true,
                priority: groups[0].level
            });
        }
        
        // Analyze error velocity
        const recentErrors = Array.from(this.tracker.errors.values())
            .filter(e => e.timestamp > Date.now() - 60 * 60 * 1000); // Last hour
            
        if (recentErrors.length > 50) {
            insights.push({
                type: 'high_error_rate',
                title: 'High error rate detected',
                description: `${recentErrors.length} errors in the last hour`,
                actionable: true,
                priority: 'high'
            });
        }
        
        if (insights.length > 0) {
            this.tracker.emit('insights_generated', insights);
        }
    }
    
    cleanupOldPatterns() {
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        
        for (const [key, pattern] of this.patterns) {
            if (pattern.timestamp && pattern.timestamp < cutoff) {
                this.patterns.delete(key);
            }
        }
    }
    
    getRegionFromIP(ip) {
        // Simplified region detection - would use actual GeoIP service
        if (ip.startsWith('192.168.') || ip.startsWith('10.')) return 'local';
        return 'unknown';
    }
    
    getAnalysisReport() {
        return {
            patternsDetected: this.patterns.size,
            correlationsFound: this.correlations.size,
            topPatterns: this.getTopPatterns(),
            strongCorrelations: this.getStrongCorrelations()
        };
    }
    
    getTopPatterns() {
        return Array.from(this.patterns.entries())
            .slice(0, 10)
            .map(([key, pattern]) => ({ key, pattern }));
    }
    
    getStrongCorrelations() {
        return Array.from(this.correlations.entries())
            .filter(([, correlation]) => correlation.confidence > 0.5)
            .sort(([, a], [, b]) => b.confidence - a.confidence)
            .slice(0, 10);
    }
}

module.exports = {
    ErrorTracker,
    ErrorAnalysisEngine
};