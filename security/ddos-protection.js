/**
 * ROOTUIP DDoS Protection System
 * Advanced distributed denial-of-service attack mitigation
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class DDoSProtection extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // DDoS protection configuration
        this.config = {
            enabled: config.enabled !== false,
            // Traffic thresholds
            thresholds: {
                requestsPerSecond: config.requestsPerSecond || 100,
                requestsPerMinute: config.requestsPerMinute || 1000,
                connectionLimit: config.connectionLimit || 10000,
                bandwidthLimit: config.bandwidthLimit || 1024 * 1024 * 100, // 100MB/s
                packetRate: config.packetRate || 50000 // packets per second
            },
            // Protection mechanisms
            protection: {
                synCookies: config.synCookies !== false,
                connectionThrottling: config.connectionThrottling !== false,
                blackholing: config.blackholing !== false,
                rateLimiting: config.rateLimiting !== false,
                geoBlocking: config.geoBlocking || false,
                challengeResponse: config.challengeResponse !== false
            },
            // Auto-mitigation
            autoMitigation: {
                enabled: config.autoMitigation !== false,
                sensitivity: config.sensitivity || 'medium',
                escalationLevels: ['monitor', 'challenge', 'throttle', 'block']
            }
        };
        
        // Traffic analysis
        this.trafficAnalysis = {
            currentLevel: 'normal',
            patterns: new Map(),
            anomalies: [],
            baseline: {
                avgRequestsPerSecond: 10,
                avgBandwidth: 1024 * 1024, // 1MB/s
                avgConnections: 100
            }
        };
        
        // Attack detection
        this.attackDetection = {
            active: false,
            type: null,
            severity: null,
            startTime: null,
            mitigationLevel: 0
        };
        
        // Connection tracking
        this.connections = new Map();
        this.connectionHistory = new Map();
        
        // Blacklist/Whitelist
        this.blacklist = new Set();
        this.whitelist = new Set(config.whitelist || []);
        
        // Metrics
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            challengesSent: 0,
            challengesPassed: 0,
            attacksDetected: 0,
            attacksMitigated: 0,
            falsePositives: 0
        };
        
        // Start monitoring
        this.startMonitoring();
    }
    
    // Start traffic monitoring
    startMonitoring() {
        // Traffic analysis interval
        this.monitoringInterval = setInterval(() => {
            this.analyzeTraffic();
            this.detectAttacks();
            this.applyMitigation();
        }, 1000); // Every second
        
        // Cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldData();
        }, 60000); // Every minute
        
        console.log('DDoS Protection monitoring started');
    }
    
    // Process incoming request
    async processRequest(req, res, next) {
        const ip = this.getClientIP(req);
        const now = Date.now();
        
        // Check whitelist
        if (this.whitelist.has(ip)) {
            return next();
        }
        
        // Check blacklist
        if (this.blacklist.has(ip)) {
            return this.blockRequest(res, 'Blacklisted IP');
        }
        
        // Track connection
        const connectionId = this.trackConnection(ip, req);
        
        // Update metrics
        this.metrics.totalRequests++;
        
        // Check if under attack
        if (this.attackDetection.active) {
            const action = await this.getMitigationAction(ip, req);
            
            switch (action) {
                case 'block':
                    return this.blockRequest(res, 'DDoS protection active');
                    
                case 'challenge':
                    return await this.challengeRequest(req, res, next);
                    
                case 'throttle':
                    return this.throttleRequest(req, res, next);
                    
                case 'monitor':
                default:
                    // Continue with monitoring
            }
        }
        
        // Check rate limits
        const rateLimitCheck = this.checkRateLimits(ip);
        if (!rateLimitCheck.passed) {
            return this.blockRequest(res, rateLimitCheck.reason);
        }
        
        // Continue to next middleware
        next();
    }
    
    // Track connection
    trackConnection(ip, req) {
        const connectionId = uuidv4();
        const now = Date.now();
        
        // Initialize connection tracking for IP
        if (!this.connections.has(ip)) {
            this.connections.set(ip, {
                active: 0,
                total: 0,
                firstSeen: now,
                lastSeen: now,
                requests: [],
                bandwidth: 0,
                suspicious: false
            });
        }
        
        const connection = this.connections.get(ip);
        connection.active++;
        connection.total++;
        connection.lastSeen = now;
        
        // Track request
        connection.requests.push({
            id: connectionId,
            timestamp: now,
            method: req.method,
            path: req.path,
            size: parseInt(req.headers['content-length'] || 0)
        });
        
        // Update bandwidth
        connection.bandwidth += parseInt(req.headers['content-length'] || 0);
        
        // Keep only recent requests (last 60 seconds)
        const cutoff = now - 60000;
        connection.requests = connection.requests.filter(r => r.timestamp > cutoff);
        
        // Check for suspicious patterns
        this.checkSuspiciousPatterns(ip, connection);
        
        return connectionId;
    }
    
    // Check for suspicious patterns
    checkSuspiciousPatterns(ip, connection) {
        const patterns = [];
        
        // Rapid request pattern
        if (connection.requests.length > 100) {
            const timeSpan = Date.now() - connection.requests[0].timestamp;
            const requestRate = connection.requests.length / (timeSpan / 1000);
            
            if (requestRate > 50) {
                patterns.push({
                    type: 'rapid_requests',
                    rate: requestRate,
                    severity: 'high'
                });
            }
        }
        
        // Same endpoint flooding
        const pathCounts = {};
        connection.requests.forEach(req => {
            pathCounts[req.path] = (pathCounts[req.path] || 0) + 1;
        });
        
        const maxPathCount = Math.max(...Object.values(pathCounts));
        if (maxPathCount > 50) {
            patterns.push({
                type: 'endpoint_flooding',
                count: maxPathCount,
                severity: 'medium'
            });
        }
        
        // HTTP method anomaly
        const methodCounts = {};
        connection.requests.forEach(req => {
            methodCounts[req.method] = (methodCounts[req.method] || 0) + 1;
        });
        
        if (methodCounts['POST'] > 100 || methodCounts['PUT'] > 100) {
            patterns.push({
                type: 'method_anomaly',
                methods: methodCounts,
                severity: 'medium'
            });
        }
        
        // Update pattern tracking
        if (patterns.length > 0) {
            connection.suspicious = true;
            this.trafficAnalysis.patterns.set(ip, patterns);
            
            this.emit('suspicious:pattern', {
                ip,
                patterns,
                connection
            });
        }
    }
    
    // Analyze traffic
    analyzeTraffic() {
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        const oneMinuteAgo = now - 60000;
        
        // Calculate current metrics
        let totalRequestsPerSecond = 0;
        let totalRequestsPerMinute = 0;
        let totalBandwidth = 0;
        let activeConnections = 0;
        
        for (const [ip, connection] of this.connections) {
            const recentRequests = connection.requests.filter(r => r.timestamp > oneSecondAgo);
            const minuteRequests = connection.requests.filter(r => r.timestamp > oneMinuteAgo);
            
            totalRequestsPerSecond += recentRequests.length;
            totalRequestsPerMinute += minuteRequests.length;
            totalBandwidth += recentRequests.reduce((sum, r) => sum + r.size, 0);
            
            if (connection.active > 0) {
                activeConnections++;
            }
        }
        
        // Update traffic analysis
        this.trafficAnalysis.current = {
            requestsPerSecond: totalRequestsPerSecond,
            requestsPerMinute: totalRequestsPerMinute,
            bandwidth: totalBandwidth,
            connections: activeConnections,
            timestamp: now
        };
        
        // Detect anomalies
        this.detectAnomalies();
    }
    
    // Detect traffic anomalies
    detectAnomalies() {
        const current = this.trafficAnalysis.current;
        const baseline = this.trafficAnalysis.baseline;
        const anomalies = [];
        
        // Check request rate anomaly
        const rpsRatio = current.requestsPerSecond / baseline.avgRequestsPerSecond;
        if (rpsRatio > 10) {
            anomalies.push({
                type: 'request_rate_spike',
                severity: rpsRatio > 50 ? 'critical' : 'high',
                value: current.requestsPerSecond,
                baseline: baseline.avgRequestsPerSecond,
                ratio: rpsRatio
            });
        }
        
        // Check bandwidth anomaly
        const bwRatio = current.bandwidth / baseline.avgBandwidth;
        if (bwRatio > 10) {
            anomalies.push({
                type: 'bandwidth_spike',
                severity: bwRatio > 50 ? 'critical' : 'high',
                value: current.bandwidth,
                baseline: baseline.avgBandwidth,
                ratio: bwRatio
            });
        }
        
        // Check connection anomaly
        const connRatio = current.connections / baseline.avgConnections;
        if (connRatio > 10) {
            anomalies.push({
                type: 'connection_spike',
                severity: connRatio > 50 ? 'critical' : 'high',
                value: current.connections,
                baseline: baseline.avgConnections,
                ratio: connRatio
            });
        }
        
        // Geographic concentration check
        const geoConcentration = this.checkGeographicConcentration();
        if (geoConcentration.concentrated) {
            anomalies.push({
                type: 'geographic_concentration',
                severity: 'medium',
                country: geoConcentration.topCountry,
                percentage: geoConcentration.percentage
            });
        }
        
        this.trafficAnalysis.anomalies = anomalies;
    }
    
    // Detect attacks
    detectAttacks() {
        const anomalies = this.trafficAnalysis.anomalies;
        const patterns = Array.from(this.trafficAnalysis.patterns.values()).flat();
        
        // Determine if under attack
        const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
        const highAnomalies = anomalies.filter(a => a.severity === 'high');
        
        let attackType = null;
        let severity = null;
        
        // Detect specific attack types
        if (criticalAnomalies.length > 0) {
            // Check for volumetric attack
            const volumetric = criticalAnomalies.find(a => 
                a.type === 'request_rate_spike' || a.type === 'bandwidth_spike'
            );
            if (volumetric) {
                attackType = 'volumetric';
                severity = 'critical';
            }
        }
        
        // Check for application layer attack
        const rapidPatterns = patterns.filter(p => p.type === 'rapid_requests');
        const floodingPatterns = patterns.filter(p => p.type === 'endpoint_flooding');
        
        if (rapidPatterns.length > 10 || floodingPatterns.length > 5) {
            attackType = attackType || 'application_layer';
            severity = severity || 'high';
        }
        
        // Check for SYN flood
        const connectionAnomaly = anomalies.find(a => a.type === 'connection_spike');
        if (connectionAnomaly && connectionAnomaly.ratio > 20) {
            attackType = 'syn_flood';
            severity = 'critical';
        }
        
        // Update attack detection
        if (attackType) {
            if (!this.attackDetection.active) {
                // New attack detected
                this.attackDetection = {
                    active: true,
                    type: attackType,
                    severity: severity,
                    startTime: Date.now(),
                    mitigationLevel: 1
                };
                
                this.metrics.attacksDetected++;
                
                this.emit('attack:detected', {
                    type: attackType,
                    severity: severity,
                    anomalies: anomalies,
                    patterns: patterns
                });
            } else {
                // Update existing attack
                this.attackDetection.severity = severity;
            }
        } else if (this.attackDetection.active) {
            // Attack ended
            const duration = Date.now() - this.attackDetection.startTime;
            
            this.emit('attack:ended', {
                type: this.attackDetection.type,
                duration: duration,
                mitigated: true
            });
            
            this.attackDetection = {
                active: false,
                type: null,
                severity: null,
                startTime: null,
                mitigationLevel: 0
            };
            
            this.metrics.attacksMitigated++;
        }
    }
    
    // Apply mitigation
    applyMitigation() {
        if (!this.attackDetection.active || !this.config.autoMitigation.enabled) {
            return;
        }
        
        const attack = this.attackDetection;
        const sensitivity = this.config.autoMitigation.sensitivity;
        
        // Determine mitigation level based on attack severity and duration
        const duration = Date.now() - attack.startTime;
        let targetLevel = 1;
        
        if (attack.severity === 'critical') {
            targetLevel = 3; // Maximum mitigation
        } else if (attack.severity === 'high') {
            targetLevel = duration > 30000 ? 3 : 2; // Escalate after 30 seconds
        } else {
            targetLevel = duration > 60000 ? 2 : 1; // Escalate after 1 minute
        }
        
        // Apply sensitivity adjustment
        if (sensitivity === 'low') {
            targetLevel = Math.max(1, targetLevel - 1);
        } else if (sensitivity === 'high') {
            targetLevel = Math.min(3, targetLevel + 1);
        }
        
        // Update mitigation level
        if (targetLevel !== attack.mitigationLevel) {
            attack.mitigationLevel = targetLevel;
            
            const action = this.config.autoMitigation.escalationLevels[targetLevel];
            
            this.emit('mitigation:changed', {
                level: targetLevel,
                action: action,
                attack: attack
            });
            
            // Apply specific mitigations
            this.applyMitigationLevel(targetLevel);
        }
    }
    
    // Apply specific mitigation level
    applyMitigationLevel(level) {
        switch (level) {
            case 3: // Block
                // Enable aggressive blocking
                this.config.protection.blackholing = true;
                // Block suspicious IPs
                for (const [ip, patterns] of this.trafficAnalysis.patterns) {
                    if (patterns.some(p => p.severity === 'high')) {
                        this.blacklist.add(ip);
                    }
                }
                break;
                
            case 2: // Throttle
                // Enable connection throttling
                this.config.protection.connectionThrottling = true;
                // Reduce rate limits
                this.config.thresholds.requestsPerSecond = 
                    Math.floor(this.config.thresholds.requestsPerSecond * 0.5);
                break;
                
            case 1: // Challenge
                // Enable challenge-response
                this.config.protection.challengeResponse = true;
                break;
                
            case 0: // Monitor
            default:
                // Just monitoring
        }
    }
    
    // Get mitigation action for request
    async getMitigationAction(ip, req) {
        const level = this.attackDetection.mitigationLevel;
        const connection = this.connections.get(ip);
        
        // Check if IP is suspicious
        if (connection && connection.suspicious) {
            if (level >= 3) return 'block';
            if (level >= 2) return 'throttle';
            return 'challenge';
        }
        
        // Check patterns
        const patterns = this.trafficAnalysis.patterns.get(ip);
        if (patterns && patterns.some(p => p.severity === 'high')) {
            if (level >= 2) return 'block';
            return 'challenge';
        }
        
        // Default action based on level
        if (level >= 3) return 'challenge';
        if (level >= 2) return 'throttle';
        
        return 'monitor';
    }
    
    // Challenge request
    async challengeRequest(req, res, next) {
        const ip = this.getClientIP(req);
        const challengeId = uuidv4();
        
        // Generate challenge
        const challenge = this.generateChallenge();
        
        // Store challenge
        if (!this.challengeStore) {
            this.challengeStore = new Map();
        }
        
        this.challengeStore.set(challengeId, {
            ip,
            challenge,
            timestamp: Date.now(),
            attempts: 0
        });
        
        this.metrics.challengesSent++;
        
        // Check if client provided a valid response
        const response = req.headers['x-ddos-challenge-response'];
        if (response) {
            const valid = await this.validateChallenge(ip, response);
            if (valid) {
                this.metrics.challengesPassed++;
                return next();
            }
        }
        
        // Send challenge
        res.status(429).json({
            error: 'Too Many Requests',
            challenge: {
                id: challengeId,
                type: challenge.type,
                data: challenge.data
            },
            message: 'Please complete the challenge to continue'
        });
    }
    
    // Generate challenge
    generateChallenge() {
        // Simple proof-of-work challenge
        const difficulty = 4; // Number of leading zeros required
        const nonce = crypto.randomBytes(16).toString('hex');
        
        return {
            type: 'proof_of_work',
            data: {
                nonce,
                difficulty,
                algorithm: 'sha256'
            }
        };
    }
    
    // Validate challenge response
    async validateChallenge(ip, response) {
        // Validate proof of work
        try {
            const { nonce, solution } = JSON.parse(response);
            const hash = crypto.createHash('sha256')
                .update(nonce + solution)
                .digest('hex');
            
            return hash.startsWith('0000'); // 4 zeros
        } catch (error) {
            return false;
        }
    }
    
    // Throttle request
    throttleRequest(req, res, next) {
        // Add delay based on current load
        const delay = Math.min(5000, this.attackDetection.mitigationLevel * 1000);
        
        setTimeout(() => {
            next();
        }, delay);
    }
    
    // Block request
    blockRequest(res, reason) {
        this.metrics.blockedRequests++;
        
        res.status(403).json({
            error: 'Forbidden',
            message: reason || 'Request blocked by DDoS protection'
        });
    }
    
    // Check rate limits
    checkRateLimits(ip) {
        const connection = this.connections.get(ip);
        if (!connection) {
            return { passed: true };
        }
        
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        const oneMinuteAgo = now - 60000;
        
        // Check requests per second
        const recentRequests = connection.requests.filter(r => r.timestamp > oneSecondAgo);
        if (recentRequests.length > this.config.thresholds.requestsPerSecond) {
            return {
                passed: false,
                reason: 'Rate limit exceeded (requests per second)'
            };
        }
        
        // Check requests per minute
        const minuteRequests = connection.requests.filter(r => r.timestamp > oneMinuteAgo);
        if (minuteRequests.length > this.config.thresholds.requestsPerMinute) {
            return {
                passed: false,
                reason: 'Rate limit exceeded (requests per minute)'
            };
        }
        
        // Check bandwidth
        const recentBandwidth = recentRequests.reduce((sum, r) => sum + r.size, 0);
        if (recentBandwidth > this.config.thresholds.bandwidthLimit) {
            return {
                passed: false,
                reason: 'Bandwidth limit exceeded'
            };
        }
        
        return { passed: true };
    }
    
    // Check geographic concentration
    checkGeographicConcentration() {
        // Simplified - in production would use GeoIP
        const countries = {};
        let total = 0;
        
        for (const [ip, connection] of this.connections) {
            const country = this.getCountryFromIP(ip);
            countries[country] = (countries[country] || 0) + 1;
            total++;
        }
        
        const topCountry = Object.entries(countries)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (topCountry && total > 100) {
            const percentage = (topCountry[1] / total) * 100;
            if (percentage > 70) {
                return {
                    concentrated: true,
                    topCountry: topCountry[0],
                    percentage
                };
            }
        }
        
        return { concentrated: false };
    }
    
    // Get country from IP (simplified)
    getCountryFromIP(ip) {
        // In production, would use a GeoIP database
        return 'US';
    }
    
    // Get client IP
    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress ||
               req.socket.remoteAddress;
    }
    
    // Cleanup old data
    cleanupOldData() {
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;
        
        // Cleanup connections
        for (const [ip, connection] of this.connections) {
            if (connection.lastSeen < fiveMinutesAgo && connection.active === 0) {
                this.connections.delete(ip);
            }
        }
        
        // Cleanup patterns
        for (const [ip, patterns] of this.trafficAnalysis.patterns) {
            if (!this.connections.has(ip)) {
                this.trafficAnalysis.patterns.delete(ip);
            }
        }
        
        // Cleanup challenges
        if (this.challengeStore) {
            for (const [id, challenge] of this.challengeStore) {
                if (challenge.timestamp < fiveMinutesAgo) {
                    this.challengeStore.delete(id);
                }
            }
        }
    }
    
    // Get statistics
    getStatistics() {
        return {
            protection: {
                enabled: this.config.enabled,
                level: this.attackDetection.mitigationLevel,
                underAttack: this.attackDetection.active,
                attackType: this.attackDetection.type,
                attackDuration: this.attackDetection.active ? 
                    Date.now() - this.attackDetection.startTime : 0
            },
            traffic: {
                current: this.trafficAnalysis.current,
                baseline: this.trafficAnalysis.baseline,
                anomalies: this.trafficAnalysis.anomalies.length,
                level: this.trafficAnalysis.currentLevel
            },
            metrics: this.metrics,
            connections: {
                active: this.connections.size,
                suspicious: Array.from(this.connections.values())
                    .filter(c => c.suspicious).length,
                blacklisted: this.blacklist.size
            },
            topAttackers: this.getTopAttackers()
        };
    }
    
    // Get top attackers
    getTopAttackers() {
        return Array.from(this.connections.entries())
            .filter(([ip, conn]) => conn.suspicious)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10)
            .map(([ip, conn]) => ({
                ip,
                requests: conn.total,
                firstSeen: new Date(conn.firstSeen),
                patterns: this.trafficAnalysis.patterns.get(ip) || []
            }));
    }
    
    // Update baseline (for learning mode)
    updateBaseline(metrics) {
        const alpha = 0.1; // Learning rate
        
        this.trafficAnalysis.baseline.avgRequestsPerSecond = 
            (1 - alpha) * this.trafficAnalysis.baseline.avgRequestsPerSecond +
            alpha * metrics.requestsPerSecond;
            
        this.trafficAnalysis.baseline.avgBandwidth = 
            (1 - alpha) * this.trafficAnalysis.baseline.avgBandwidth +
            alpha * metrics.bandwidth;
            
        this.trafficAnalysis.baseline.avgConnections = 
            (1 - alpha) * this.trafficAnalysis.baseline.avgConnections +
            alpha * metrics.connections;
    }
    
    // Express middleware
    middleware() {
        return (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            
            this.processRequest(req, res, next).catch(err => {
                console.error('DDoS Protection Error:', err);
                next(); // Fail open
            });
        };
    }
    
    // Stop monitoring
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        console.log('DDoS Protection stopped');
    }
}

module.exports = DDoSProtection;