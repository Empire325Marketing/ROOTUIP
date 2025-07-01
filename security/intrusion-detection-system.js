/**
 * ROOTUIP Intrusion Detection and Prevention System (IDS/IPS)
 * Real-time threat detection and automated response
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class IntrusionDetectionSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // IDS/IPS configuration
        this.config = {
            mode: config.mode || 'detect-and-prevent', // detect-only, detect-and-prevent
            sensitivity: config.sensitivity || 'medium', // low, medium, high
            learning: config.learning || false,
            autoResponse: config.autoResponse !== false,
            quarantine: config.quarantine !== false
        };
        
        // Detection engines
        this.engines = {
            signature: new SignatureEngine(),
            anomaly: new AnomalyEngine(),
            behavioral: new BehavioralEngine(),
            heuristic: new HeuristicEngine()
        };
        
        // Threat intelligence
        this.threatIntel = {
            indicators: new Map(),
            feeds: config.threatFeeds || [],
            lastUpdate: null
        };
        
        // Active threats
        this.threats = new Map();
        
        // Session tracking
        this.sessions = new Map();
        
        // Quarantine
        this.quarantine = new Map();
        
        // Metrics
        this.metrics = {
            eventsProcessed: 0,
            threatsDetected: 0,
            threatsPrevented: 0,
            falsePositives: 0,
            detectionRate: 0,
            responseTime: 0
        };
        
        // Initialize threat intelligence
        this.initializeThreatIntel();
        
        // Start detection engines
        this.startEngines();
    }
    
    // Initialize threat intelligence
    initializeThreatIntel() {
        // Known malicious IPs
        this.addIndicator('ip', '1.2.3.4', {
            type: 'malicious_ip',
            severity: 'high',
            source: 'threat_feed',
            tags: ['botnet', 'scanner']
        });
        
        // Known malicious domains
        this.addIndicator('domain', 'malicious-site.com', {
            type: 'malicious_domain',
            severity: 'critical',
            source: 'threat_feed',
            tags: ['phishing', 'malware']
        });
        
        // Known attack patterns
        this.addIndicator('pattern', 'SELECT * FROM users WHERE', {
            type: 'sql_injection',
            severity: 'high',
            source: 'signature',
            tags: ['sqli', 'database']
        });
        
        // File hashes
        this.addIndicator('hash', 'd41d8cd98f00b204e9800998ecf8427e', {
            type: 'malware',
            severity: 'critical',
            source: 'antivirus',
            tags: ['trojan', 'backdoor']
        });
        
        // User agents
        this.addIndicator('user_agent', 'sqlmap', {
            type: 'scanner',
            severity: 'medium',
            source: 'signature',
            tags: ['vulnerability_scanner']
        });
    }
    
    // Add threat indicator
    addIndicator(type, value, metadata) {
        const key = `${type}:${value}`;
        this.threatIntel.indicators.set(key, {
            type,
            value,
            ...metadata,
            added: new Date()
        });
    }
    
    // Start detection engines
    startEngines() {
        // Configure engines based on sensitivity
        const sensitivityConfig = {
            low: { threshold: 0.8, learning: 0.1 },
            medium: { threshold: 0.6, learning: 0.2 },
            high: { threshold: 0.4, learning: 0.3 }
        };
        
        const config = sensitivityConfig[this.config.sensitivity];
        
        // Initialize each engine
        Object.values(this.engines).forEach(engine => {
            engine.configure(config);
            engine.on('threat', (threat) => this.handleThreatDetection(threat));
        });
        
        console.log('Intrusion Detection System started');
    }
    
    // Process security event
    async processEvent(event) {
        const eventId = uuidv4();
        const startTime = Date.now();
        
        // Create enriched event
        const enrichedEvent = {
            id: eventId,
            timestamp: new Date(),
            ...event,
            session: this.getOrCreateSession(event),
            indicators: []
        };
        
        try {
            // Check threat intelligence
            const intelMatches = this.checkThreatIntel(enrichedEvent);
            enrichedEvent.indicators.push(...intelMatches);
            
            // Process through detection engines
            const detections = await this.runDetectionEngines(enrichedEvent);
            
            // Correlate detections
            const threats = this.correlateDetections(detections, enrichedEvent);
            
            // Handle detected threats
            for (const threat of threats) {
                await this.handleThreat(threat, enrichedEvent);
            }
            
            // Update metrics
            this.metrics.eventsProcessed++;
            this.metrics.responseTime = 
                (this.metrics.responseTime * 0.9) + ((Date.now() - startTime) * 0.1);
            
            // Learn from event if enabled
            if (this.config.learning) {
                this.learnFromEvent(enrichedEvent);
            }
            
            return {
                eventId,
                threats: threats.length,
                action: enrichedEvent.action || 'allowed'
            };
            
        } catch (error) {
            console.error('IDS Error:', error);
            this.emit('error', { eventId, error: error.message });
            return { eventId, error: error.message };
        }
    }
    
    // Get or create session
    getOrCreateSession(event) {
        const sessionKey = `${event.sourceIP}:${event.destIP || 'local'}`;
        
        if (!this.sessions.has(sessionKey)) {
            this.sessions.set(sessionKey, {
                id: uuidv4(),
                sourceIP: event.sourceIP,
                destIP: event.destIP,
                startTime: Date.now(),
                events: [],
                score: 0,
                tags: []
            });
        }
        
        const session = this.sessions.get(sessionKey);
        session.lastActivity = Date.now();
        session.events.push({
            timestamp: Date.now(),
            type: event.type,
            data: event.data
        });
        
        // Keep only last 100 events
        if (session.events.length > 100) {
            session.events.shift();
        }
        
        return session;
    }
    
    // Check threat intelligence
    checkThreatIntel(event) {
        const matches = [];
        
        // Check IP indicators
        if (event.sourceIP) {
            const ipIndicator = this.threatIntel.indicators.get(`ip:${event.sourceIP}`);
            if (ipIndicator) {
                matches.push({
                    type: 'threat_intel',
                    indicator: ipIndicator,
                    field: 'sourceIP',
                    value: event.sourceIP
                });
            }
        }
        
        // Check domain indicators
        if (event.domain) {
            const domainIndicator = this.threatIntel.indicators.get(`domain:${event.domain}`);
            if (domainIndicator) {
                matches.push({
                    type: 'threat_intel',
                    indicator: domainIndicator,
                    field: 'domain',
                    value: event.domain
                });
            }
        }
        
        // Check user agent
        if (event.userAgent) {
            for (const [key, indicator] of this.threatIntel.indicators) {
                if (key.startsWith('user_agent:') && 
                    event.userAgent.toLowerCase().includes(indicator.value.toLowerCase())) {
                    matches.push({
                        type: 'threat_intel',
                        indicator: indicator,
                        field: 'userAgent',
                        value: event.userAgent
                    });
                }
            }
        }
        
        // Check patterns in request data
        if (event.data) {
            const dataStr = JSON.stringify(event.data);
            for (const [key, indicator] of this.threatIntel.indicators) {
                if (key.startsWith('pattern:') && dataStr.includes(indicator.value)) {
                    matches.push({
                        type: 'threat_intel',
                        indicator: indicator,
                        field: 'data',
                        pattern: indicator.value
                    });
                }
            }
        }
        
        return matches;
    }
    
    // Run detection engines
    async runDetectionEngines(event) {
        const detections = [];
        
        // Run each engine in parallel
        const enginePromises = Object.entries(this.engines).map(async ([name, engine]) => {
            try {
                const result = await engine.analyze(event);
                if (result.detected) {
                    detections.push({
                        engine: name,
                        ...result
                    });
                }
            } catch (error) {
                console.error(`Engine ${name} error:`, error);
            }
        });
        
        await Promise.all(enginePromises);
        
        return detections;
    }
    
    // Correlate detections
    correlateDetections(detections, event) {
        const threats = [];
        
        // Group detections by type
        const grouped = {};
        detections.forEach(detection => {
            const type = detection.threatType || 'unknown';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(detection);
        });
        
        // Create threats from correlated detections
        for (const [type, typeDetections] of Object.entries(grouped)) {
            // Calculate confidence based on multiple detections
            const confidence = this.calculateConfidence(typeDetections);
            
            // Determine severity
            const severity = this.determineSeverity(typeDetections, event);
            
            if (confidence >= 0.5) { // Confidence threshold
                threats.push({
                    id: uuidv4(),
                    type,
                    severity,
                    confidence,
                    detections: typeDetections,
                    indicators: event.indicators,
                    timestamp: new Date()
                });
            }
        }
        
        return threats;
    }
    
    // Calculate confidence
    calculateConfidence(detections) {
        if (detections.length === 0) return 0;
        
        // Weight by engine reliability
        const engineWeights = {
            signature: 0.9,
            anomaly: 0.7,
            behavioral: 0.8,
            heuristic: 0.6
        };
        
        let totalWeight = 0;
        let totalScore = 0;
        
        detections.forEach(detection => {
            const weight = engineWeights[detection.engine] || 0.5;
            totalWeight += weight;
            totalScore += weight * detection.confidence;
        });
        
        return totalWeight > 0 ? totalScore / totalWeight : 0;
    }
    
    // Determine severity
    determineSeverity(detections, event) {
        // Check for critical indicators
        if (event.indicators.some(i => i.indicator.severity === 'critical')) {
            return 'critical';
        }
        
        // Check detection severities
        const severities = detections.map(d => d.severity || 'low');
        
        if (severities.includes('critical')) return 'critical';
        if (severities.includes('high')) return 'high';
        if (severities.includes('medium')) return 'medium';
        
        return 'low';
    }
    
    // Handle detected threat
    async handleThreat(threat, event) {
        // Store threat
        this.threats.set(threat.id, threat);
        this.metrics.threatsDetected++;
        
        // Emit threat event
        this.emit('threat:detected', threat);
        
        // Determine response
        if (this.config.mode === 'detect-only') {
            return;
        }
        
        // Auto-response if enabled
        if (this.config.autoResponse) {
            const response = await this.determineResponse(threat, event);
            await this.executeResponse(response, threat, event);
        }
    }
    
    // Determine response
    async determineResponse(threat, event) {
        const responses = [];
        
        // Based on threat severity
        switch (threat.severity) {
            case 'critical':
                responses.push('block', 'quarantine', 'alert');
                break;
            case 'high':
                responses.push('block', 'alert');
                break;
            case 'medium':
                responses.push('challenge', 'monitor');
                break;
            case 'low':
                responses.push('monitor');
                break;
        }
        
        // Based on threat type
        switch (threat.type) {
            case 'malware':
                responses.push('quarantine', 'scan');
                break;
            case 'intrusion_attempt':
                responses.push('block', 'trace');
                break;
            case 'data_exfiltration':
                responses.push('block', 'alert');
                break;
        }
        
        return [...new Set(responses)]; // Remove duplicates
    }
    
    // Execute response
    async executeResponse(responses, threat, event) {
        for (const response of responses) {
            try {
                switch (response) {
                    case 'block':
                        await this.blockSource(event.sourceIP, threat);
                        event.action = 'blocked';
                        this.metrics.threatsPrevented++;
                        break;
                        
                    case 'quarantine':
                        await this.quarantineContent(event, threat);
                        event.action = 'quarantined';
                        break;
                        
                    case 'alert':
                        await this.sendAlert(threat, event);
                        break;
                        
                    case 'challenge':
                        event.action = 'challenge';
                        break;
                        
                    case 'scan':
                        await this.deepScan(event, threat);
                        break;
                        
                    case 'trace':
                        await this.traceSource(event.sourceIP);
                        break;
                        
                    case 'monitor':
                        event.session.monitored = true;
                        break;
                }
                
                this.emit('response:executed', {
                    response,
                    threat,
                    event: event.id
                });
                
            } catch (error) {
                console.error(`Response ${response} failed:`, error);
            }
        }
    }
    
    // Response actions
    async blockSource(ip, threat) {
        // Add to blocklist
        this.emit('block:ip', {
            ip,
            reason: threat.type,
            duration: 3600000 // 1 hour
        });
    }
    
    async quarantineContent(event, threat) {
        this.quarantine.set(event.id, {
            event,
            threat,
            timestamp: new Date(),
            status: 'quarantined'
        });
    }
    
    async sendAlert(threat, event) {
        this.emit('alert', {
            severity: threat.severity,
            threat,
            event,
            message: `${threat.type} detected from ${event.sourceIP}`
        });
    }
    
    async deepScan(event, threat) {
        // Trigger deep packet inspection or file scanning
        this.emit('scan:request', {
            target: event.data,
            reason: threat.type
        });
    }
    
    async traceSource(ip) {
        // Initiate traceback
        this.emit('trace:request', { ip });
    }
    
    // Learn from event
    learnFromEvent(event) {
        // Update behavioral baselines
        if (event.session) {
            this.engines.behavioral.updateBaseline(event.session);
        }
        
        // Update anomaly detection models
        if (!event.threats || event.threats.length === 0) {
            this.engines.anomaly.addNormalBehavior(event);
        }
    }
    
    // Get statistics
    getStatistics() {
        return {
            mode: this.config.mode,
            sensitivity: this.config.sensitivity,
            metrics: this.metrics,
            engines: {
                signature: this.engines.signature.getStats(),
                anomaly: this.engines.anomaly.getStats(),
                behavioral: this.engines.behavioral.getStats(),
                heuristic: this.engines.heuristic.getStats()
            },
            threats: {
                active: this.threats.size,
                byType: this.getThreatsByType(),
                bySeverity: this.getThreatsBySeverity()
            },
            sessions: {
                active: this.sessions.size,
                monitored: Array.from(this.sessions.values())
                    .filter(s => s.monitored).length
            },
            quarantine: this.quarantine.size
        };
    }
    
    // Get threats by type
    getThreatsByType() {
        const byType = {};
        for (const threat of this.threats.values()) {
            byType[threat.type] = (byType[threat.type] || 0) + 1;
        }
        return byType;
    }
    
    // Get threats by severity
    getThreatsBySeverity() {
        const bySeverity = {};
        for (const threat of this.threats.values()) {
            bySeverity[threat.severity] = (bySeverity[threat.severity] || 0) + 1;
        }
        return bySeverity;
    }
}

// Signature-based detection engine
class SignatureEngine extends EventEmitter {
    constructor() {
        super();
        this.signatures = new Map();
        this.stats = {
            signaturesLoaded: 0,
            matches: 0
        };
        
        this.loadSignatures();
    }
    
    configure(config) {
        this.config = config;
    }
    
    loadSignatures() {
        // Load attack signatures
        this.addSignature({
            id: 'sqli_001',
            name: 'SQL Injection - UNION SELECT',
            pattern: /union.*select.*from/gi,
            type: 'sql_injection',
            severity: 'high'
        });
        
        this.addSignature({
            id: 'xss_001',
            name: 'XSS - Script Tag',
            pattern: /<script[^>]*>.*<\/script>/gi,
            type: 'cross_site_scripting',
            severity: 'high'
        });
        
        this.addSignature({
            id: 'rce_001',
            name: 'Remote Code Execution',
            pattern: /(\bexec\b|\bsystem\b|\beval\b).*\(/gi,
            type: 'code_execution',
            severity: 'critical'
        });
        
        this.addSignature({
            id: 'traversal_001',
            name: 'Directory Traversal',
            pattern: /\.\.[\/\\]/g,
            type: 'path_traversal',
            severity: 'medium'
        });
        
        this.stats.signaturesLoaded = this.signatures.size;
    }
    
    addSignature(signature) {
        this.signatures.set(signature.id, signature);
    }
    
    async analyze(event) {
        const matches = [];
        const content = JSON.stringify(event.data || '');
        
        for (const [id, signature] of this.signatures) {
            if (signature.pattern.test(content)) {
                matches.push({
                    signatureId: id,
                    name: signature.name,
                    type: signature.type,
                    severity: signature.severity
                });
                this.stats.matches++;
            }
        }
        
        if (matches.length > 0) {
            return {
                detected: true,
                threatType: matches[0].type,
                severity: matches[0].severity,
                confidence: 0.9,
                matches
            };
        }
        
        return { detected: false };
    }
    
    getStats() {
        return this.stats;
    }
}

// Anomaly detection engine
class AnomalyEngine extends EventEmitter {
    constructor() {
        super();
        this.baseline = {
            requestRate: { mean: 10, stdDev: 5 },
            payloadSize: { mean: 1024, stdDev: 512 },
            paramCount: { mean: 3, stdDev: 2 }
        };
        this.stats = {
            anomaliesDetected: 0,
            baselineUpdates: 0
        };
    }
    
    configure(config) {
        this.config = config;
        this.threshold = config.threshold;
    }
    
    async analyze(event) {
        const anomalies = [];
        
        // Check request rate anomaly
        if (event.session) {
            const requestRate = event.session.events.length;
            const zScore = this.calculateZScore(
                requestRate,
                this.baseline.requestRate.mean,
                this.baseline.requestRate.stdDev
            );
            
            if (Math.abs(zScore) > 3) {
                anomalies.push({
                    type: 'request_rate',
                    value: requestRate,
                    zScore
                });
            }
        }
        
        // Check payload size
        const payloadSize = JSON.stringify(event.data || '').length;
        const payloadZScore = this.calculateZScore(
            payloadSize,
            this.baseline.payloadSize.mean,
            this.baseline.payloadSize.stdDev
        );
        
        if (Math.abs(payloadZScore) > 3) {
            anomalies.push({
                type: 'payload_size',
                value: payloadSize,
                zScore: payloadZScore
            });
        }
        
        if (anomalies.length > 0) {
            this.stats.anomaliesDetected++;
            
            // Determine threat type based on anomalies
            let threatType = 'anomaly';
            if (anomalies.some(a => a.type === 'request_rate' && a.zScore > 5)) {
                threatType = 'dos_attempt';
            }
            
            return {
                detected: true,
                threatType,
                severity: 'medium',
                confidence: Math.min(0.9, anomalies.length * 0.3),
                anomalies
            };
        }
        
        return { detected: false };
    }
    
    calculateZScore(value, mean, stdDev) {
        return (value - mean) / stdDev;
    }
    
    addNormalBehavior(event) {
        // Update baseline with exponential moving average
        const alpha = this.config.learning || 0.1;
        
        const requestRate = event.session ? event.session.events.length : 0;
        this.baseline.requestRate.mean = 
            (1 - alpha) * this.baseline.requestRate.mean + alpha * requestRate;
        
        const payloadSize = JSON.stringify(event.data || '').length;
        this.baseline.payloadSize.mean = 
            (1 - alpha) * this.baseline.payloadSize.mean + alpha * payloadSize;
        
        this.stats.baselineUpdates++;
    }
    
    getStats() {
        return {
            ...this.stats,
            baseline: this.baseline
        };
    }
}

// Behavioral analysis engine
class BehavioralEngine extends EventEmitter {
    constructor() {
        super();
        this.profiles = new Map();
        this.stats = {
            profilesCreated: 0,
            deviationsDetected: 0
        };
    }
    
    configure(config) {
        this.config = config;
    }
    
    async analyze(event) {
        if (!event.session) {
            return { detected: false };
        }
        
        const profile = this.getOrCreateProfile(event.session.sourceIP);
        const deviations = this.checkDeviations(event, profile);
        
        if (deviations.length > 0) {
            this.stats.deviationsDetected++;
            
            return {
                detected: true,
                threatType: 'behavioral_anomaly',
                severity: deviations.some(d => d.severity === 'high') ? 'high' : 'medium',
                confidence: Math.min(0.8, deviations.length * 0.2),
                deviations
            };
        }
        
        // Update profile
        this.updateProfile(profile, event);
        
        return { detected: false };
    }
    
    getOrCreateProfile(ip) {
        if (!this.profiles.has(ip)) {
            this.profiles.set(ip, {
                ip,
                created: Date.now(),
                behavior: {
                    methods: {},
                    paths: {},
                    userAgents: new Set(),
                    schedule: new Array(24).fill(0)
                }
            });
            this.stats.profilesCreated++;
        }
        
        return this.profiles.get(ip);
    }
    
    checkDeviations(event, profile) {
        const deviations = [];
        const hour = new Date().getHours();
        
        // Check unusual access time
        if (profile.behavior.schedule[hour] === 0) {
            deviations.push({
                type: 'unusual_time',
                severity: 'low',
                hour
            });
        }
        
        // Check new user agent
        if (event.userAgent && !profile.behavior.userAgents.has(event.userAgent)) {
            deviations.push({
                type: 'new_user_agent',
                severity: 'medium',
                userAgent: event.userAgent
            });
        }
        
        // Check unusual method
        if (event.method && !profile.behavior.methods[event.method]) {
            deviations.push({
                type: 'unusual_method',
                severity: 'medium',
                method: event.method
            });
        }
        
        return deviations;
    }
    
    updateProfile(profile, event) {
        const hour = new Date().getHours();
        profile.behavior.schedule[hour]++;
        
        if (event.method) {
            profile.behavior.methods[event.method] = 
                (profile.behavior.methods[event.method] || 0) + 1;
        }
        
        if (event.path) {
            profile.behavior.paths[event.path] = 
                (profile.behavior.paths[event.path] || 0) + 1;
        }
        
        if (event.userAgent) {
            profile.behavior.userAgents.add(event.userAgent);
        }
    }
    
    updateBaseline(session) {
        // Update session baseline
    }
    
    getStats() {
        return this.stats;
    }
}

// Heuristic detection engine
class HeuristicEngine extends EventEmitter {
    constructor() {
        super();
        this.rules = [];
        this.stats = {
            rulesEvaluated: 0,
            heuristicsTriggered: 0
        };
        
        this.loadRules();
    }
    
    configure(config) {
        this.config = config;
    }
    
    loadRules() {
        // Suspicious behavior rules
        this.rules.push({
            name: 'Rapid Parameter Fuzzing',
            check: (event) => {
                if (!event.session) return false;
                const recentEvents = event.session.events.slice(-10);
                const uniqueParams = new Set();
                
                recentEvents.forEach(e => {
                    if (e.data && e.data.params) {
                        Object.keys(e.data.params).forEach(p => uniqueParams.add(p));
                    }
                });
                
                return uniqueParams.size > 20;
            },
            type: 'parameter_fuzzing',
            severity: 'medium'
        });
        
        this.rules.push({
            name: 'Credential Stuffing Pattern',
            check: (event) => {
                if (!event.path || !event.session) return false;
                const loginAttempts = event.session.events.filter(e => 
                    e.data && e.data.path && e.data.path.includes('login')
                );
                return loginAttempts.length > 5;
            },
            type: 'credential_stuffing',
            severity: 'high'
        });
        
        this.rules.push({
            name: 'Data Exfiltration Pattern',
            check: (event) => {
                if (!event.data || !event.session) return false;
                const largeResponses = event.session.events.filter(e =>
                    e.data && e.data.responseSize > 1048576 // 1MB
                );
                return largeResponses.length > 3;
            },
            type: 'data_exfiltration',
            severity: 'critical'
        });
    }
    
    async analyze(event) {
        const triggered = [];
        
        for (const rule of this.rules) {
            this.stats.rulesEvaluated++;
            
            try {
                if (rule.check(event)) {
                    triggered.push({
                        rule: rule.name,
                        type: rule.type,
                        severity: rule.severity
                    });
                    this.stats.heuristicsTriggered++;
                }
            } catch (error) {
                // Rule evaluation error
            }
        }
        
        if (triggered.length > 0) {
            return {
                detected: true,
                threatType: triggered[0].type,
                severity: triggered[0].severity,
                confidence: Math.min(0.7, triggered.length * 0.25),
                rules: triggered
            };
        }
        
        return { detected: false };
    }
    
    getStats() {
        return this.stats;
    }
}

module.exports = IntrusionDetectionSystem;