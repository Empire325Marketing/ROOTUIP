/**
 * ROOTUIP Web Application Firewall (WAF)
 * Advanced threat protection and request filtering
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class WebApplicationFirewall extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // WAF configuration
        this.config = {
            enabled: config.enabled !== false,
            mode: config.mode || 'block', // block, monitor, learn
            logLevel: config.logLevel || 'info',
            customRules: config.customRules || [],
            whitelistIPs: config.whitelistIPs || [],
            blacklistIPs: config.blacklistIPs || [],
            rateLimit: config.rateLimit || {
                windowMs: 60000, // 1 minute
                maxRequests: 100,
                blockDuration: 300000 // 5 minutes
            }
        };
        
        // Rule sets
        this.ruleSets = new Map();
        
        // Attack signatures
        this.signatures = new Map();
        
        // Request history for rate limiting
        this.requestHistory = new Map();
        
        // Blocked IPs
        this.blockedIPs = new Map();
        
        // Security metrics
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            attacksDetected: {},
            topAttackers: new Map(),
            ruleHits: new Map()
        };
        
        // Initialize WAF rules
        this.initializeRules();
        
        // Initialize attack signatures
        this.initializeSignatures();
        
        // Start cleanup interval
        this.startCleanup();
    }
    
    // Initialize WAF rules
    initializeRules() {
        // OWASP Core Rule Set
        this.addRuleSet('owasp_crs', {
            name: 'OWASP Core Rule Set',
            version: '3.3.0',
            enabled: true,
            rules: [
                // SQL Injection
                {
                    id: 'sql_injection_1',
                    name: 'SQL Injection Attack',
                    category: 'SQL Injection',
                    severity: 'critical',
                    pattern: /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|eval)\b.*\b(from|where|table|database|column|schema)\b)/gi,
                    action: 'block',
                    targets: ['query', 'body', 'headers', 'cookies']
                },
                {
                    id: 'sql_injection_2',
                    name: 'SQL Meta-Characters',
                    category: 'SQL Injection',
                    severity: 'high',
                    pattern: /('|(--|#|\/\*|\*\/|@@|@|char|nchar|varchar|nvarchar|alter|begin|cast|create|cursor|declare|delete|drop|end|exec|execute|fetch|insert|kill|select|sys|sysobjects|syscolumns|table|update))/gi,
                    action: 'block',
                    targets: ['query', 'body']
                },
                
                // XSS Attacks
                {
                    id: 'xss_1',
                    name: 'XSS Script Tag',
                    category: 'Cross-Site Scripting',
                    severity: 'high',
                    pattern: /<script[^>]*>[\s\S]*?<\/script>/gi,
                    action: 'block',
                    targets: ['query', 'body', 'headers']
                },
                {
                    id: 'xss_2',
                    name: 'XSS Event Handlers',
                    category: 'Cross-Site Scripting',
                    severity: 'high',
                    pattern: /\bon\w+\s*=\s*["']?[^"']*["']?/gi,
                    action: 'block',
                    targets: ['query', 'body']
                },
                {
                    id: 'xss_3',
                    name: 'XSS JavaScript Protocol',
                    category: 'Cross-Site Scripting',
                    severity: 'high',
                    pattern: /javascript\s*:/gi,
                    action: 'block',
                    targets: ['query', 'body']
                },
                
                // Command Injection
                {
                    id: 'cmd_injection_1',
                    name: 'OS Command Injection',
                    category: 'Command Injection',
                    severity: 'critical',
                    pattern: /(\||;|&|`|\$\(|\$\{|<\(|>\(|\\n|\\r)/g,
                    action: 'block',
                    targets: ['query', 'body']
                },
                
                // Path Traversal
                {
                    id: 'path_traversal_1',
                    name: 'Directory Traversal',
                    category: 'Path Traversal',
                    severity: 'high',
                    pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/gi,
                    action: 'block',
                    targets: ['query', 'body', 'path']
                },
                
                // XXE Injection
                {
                    id: 'xxe_1',
                    name: 'XML External Entity',
                    category: 'XXE Injection',
                    severity: 'high',
                    pattern: /<!ENTITY\s+\S+\s+SYSTEM/gi,
                    action: 'block',
                    targets: ['body']
                },
                
                // LDAP Injection
                {
                    id: 'ldap_injection_1',
                    name: 'LDAP Injection',
                    category: 'LDAP Injection',
                    severity: 'high',
                    pattern: /(\(|\)|\||&|!|=|~|\*|:|\||\\)/g,
                    action: 'block',
                    targets: ['query', 'body']
                }
            ]
        });
        
        // Custom ROOTUIP Rules
        this.addRuleSet('rootuip_custom', {
            name: 'ROOTUIP Custom Rules',
            version: '1.0.0',
            enabled: true,
            rules: [
                // API Rate Limiting
                {
                    id: 'api_rate_limit',
                    name: 'API Rate Limit',
                    category: 'Rate Limiting',
                    severity: 'medium',
                    condition: (req) => this.checkRateLimit(req),
                    action: 'block',
                    message: 'Rate limit exceeded'
                },
                
                // Suspicious User-Agent
                {
                    id: 'suspicious_ua',
                    name: 'Suspicious User-Agent',
                    category: 'Bot Detection',
                    severity: 'low',
                    pattern: /(sqlmap|nikto|havij|commix|nmap|masscan|bot|crawler|spider)/gi,
                    action: 'monitor',
                    targets: ['headers.user-agent']
                },
                
                // Large Request Body
                {
                    id: 'large_body',
                    name: 'Oversized Request',
                    category: 'DoS Protection',
                    severity: 'medium',
                    condition: (req) => req.body && JSON.stringify(req.body).length > 1048576, // 1MB
                    action: 'block',
                    message: 'Request body too large'
                },
                
                // Suspicious File Upload
                {
                    id: 'file_upload',
                    name: 'Malicious File Upload',
                    category: 'File Security',
                    severity: 'high',
                    pattern: /\.(exe|dll|bat|cmd|com|pif|scr|vbs|js|jar|zip|rar)/gi,
                    action: 'block',
                    targets: ['files']
                }
            ]
        });
        
        // Geographic Restrictions
        this.addRuleSet('geo_restrictions', {
            name: 'Geographic Restrictions',
            version: '1.0.0',
            enabled: false,
            rules: [
                {
                    id: 'geo_block',
                    name: 'Geographic Blocking',
                    category: 'Access Control',
                    severity: 'medium',
                    condition: (req) => this.checkGeoBlock(req),
                    action: 'block',
                    message: 'Access denied from your location'
                }
            ]
        });
    }
    
    // Initialize attack signatures
    initializeSignatures() {
        // SQL Injection Signatures
        this.addSignature('sqli_union', {
            name: 'UNION SELECT Attack',
            pattern: /union\s+select/gi,
            score: 10,
            category: 'SQL Injection'
        });
        
        this.addSignature('sqli_comment', {
            name: 'SQL Comment Attack',
            pattern: /(--|#|\/\*)/g,
            score: 5,
            category: 'SQL Injection'
        });
        
        // XSS Signatures
        this.addSignature('xss_alert', {
            name: 'Alert Box XSS',
            pattern: /alert\s*\(/gi,
            score: 8,
            category: 'XSS'
        });
        
        this.addSignature('xss_document', {
            name: 'Document Object XSS',
            pattern: /document\.(cookie|write|location)/gi,
            score: 9,
            category: 'XSS'
        });
        
        // Command Injection Signatures
        this.addSignature('cmd_shell', {
            name: 'Shell Command',
            pattern: /(bash|sh|cmd|powershell)/gi,
            score: 7,
            category: 'Command Injection'
        });
        
        // Scanner Detection
        this.addSignature('scanner_sqlmap', {
            name: 'SQLMap Scanner',
            pattern: /sqlmap/gi,
            score: 10,
            category: 'Scanner'
        });
        
        this.addSignature('scanner_nikto', {
            name: 'Nikto Scanner',
            pattern: /nikto/gi,
            score: 10,
            category: 'Scanner'
        });
    }
    
    // Add rule set
    addRuleSet(id, ruleSet) {
        this.ruleSets.set(id, {
            ...ruleSet,
            id,
            hits: 0,
            blocked: 0
        });
    }
    
    // Add signature
    addSignature(id, signature) {
        this.signatures.set(id, {
            ...signature,
            id,
            matches: 0
        });
    }
    
    // Process request through WAF
    async processRequest(req, res, next) {
        const requestId = uuidv4();
        const startTime = Date.now();
        
        // Create request context
        const context = {
            id: requestId,
            timestamp: new Date(),
            ip: this.getClientIP(req),
            method: req.method,
            path: req.path,
            headers: req.headers,
            query: req.query,
            body: req.body,
            cookies: req.cookies,
            blocked: false,
            violations: [],
            score: 0
        };
        
        try {
            // Check IP whitelist/blacklist
            const ipCheck = this.checkIPLists(context.ip);
            if (ipCheck.action === 'block') {
                return this.blockRequest(context, res, 'IP Blacklisted');
            }
            if (ipCheck.action === 'allow') {
                return next(); // Whitelisted IPs bypass WAF
            }
            
            // Check if IP is temporarily blocked
            if (this.blockedIPs.has(context.ip)) {
                const blockInfo = this.blockedIPs.get(context.ip);
                if (Date.now() < blockInfo.until) {
                    return this.blockRequest(context, res, 'Temporarily blocked');
                } else {
                    this.blockedIPs.delete(context.ip);
                }
            }
            
            // Process through rule sets
            for (const [ruleSetId, ruleSet] of this.ruleSets) {
                if (!ruleSet.enabled) continue;
                
                const violations = await this.processRuleSet(context, ruleSet);
                context.violations.push(...violations);
            }
            
            // Calculate threat score
            context.score = this.calculateThreatScore(context);
            
            // Determine action based on mode and score
            const action = this.determineAction(context);
            
            // Update metrics
            this.updateMetrics(context);
            
            // Log request
            this.logRequest(context);
            
            // Take action
            if (action === 'block') {
                return this.blockRequest(context, res);
            } else if (action === 'challenge') {
                return this.challengeRequest(context, res, next);
            } else {
                // Monitor mode or passed
                if (context.violations.length > 0) {
                    this.emit('threat:detected', {
                        requestId,
                        ip: context.ip,
                        violations: context.violations,
                        score: context.score
                    });
                }
                return next();
            }
            
        } catch (error) {
            console.error('WAF Error:', error);
            // Fail open in case of errors
            return next();
        }
    }
    
    // Process rule set
    async processRuleSet(context, ruleSet) {
        const violations = [];
        
        for (const rule of ruleSet.rules) {
            try {
                let matched = false;
                
                // Check pattern-based rules
                if (rule.pattern && rule.targets) {
                    for (const target of rule.targets) {
                        const value = this.getTargetValue(context, target);
                        if (value && rule.pattern.test(value)) {
                            matched = true;
                            break;
                        }
                    }
                }
                
                // Check condition-based rules
                if (rule.condition && typeof rule.condition === 'function') {
                    matched = await rule.condition(context);
                }
                
                if (matched) {
                    violations.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        category: rule.category,
                        severity: rule.severity,
                        action: rule.action,
                        message: rule.message || `Violated rule: ${rule.name}`
                    });
                    
                    // Update rule hit count
                    const hitKey = `${ruleSet.id}.${rule.id}`;
                    this.metrics.ruleHits.set(
                        hitKey,
                        (this.metrics.ruleHits.get(hitKey) || 0) + 1
                    );
                    
                    ruleSet.hits++;
                    if (rule.action === 'block') {
                        ruleSet.blocked++;
                    }
                }
                
            } catch (error) {
                console.error(`Error processing rule ${rule.id}:`, error);
            }
        }
        
        return violations;
    }
    
    // Get target value from request
    getTargetValue(context, target) {
        const parts = target.split('.');
        let value = context;
        
        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return null;
            }
        }
        
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
    
    // Calculate threat score
    calculateThreatScore(context) {
        let score = 0;
        
        // Base score from violations
        for (const violation of context.violations) {
            switch (violation.severity) {
                case 'critical': score += 10; break;
                case 'high': score += 7; break;
                case 'medium': score += 4; break;
                case 'low': score += 2; break;
            }
        }
        
        // Check against signatures
        const content = JSON.stringify(context);
        for (const [sigId, signature] of this.signatures) {
            if (signature.pattern.test(content)) {
                score += signature.score;
                signature.matches++;
                
                context.violations.push({
                    signatureId: sigId,
                    signatureName: signature.name,
                    category: signature.category,
                    score: signature.score
                });
            }
        }
        
        // Reputation-based scoring
        const ipReputation = this.getIPReputation(context.ip);
        score += ipReputation.score;
        
        return Math.min(score, 100); // Cap at 100
    }
    
    // Determine action based on context
    determineAction(context) {
        // Critical violations always block
        const hasCritical = context.violations.some(v => v.severity === 'critical');
        if (hasCritical) return 'block';
        
        // Check mode
        if (this.config.mode === 'monitor') return 'monitor';
        if (this.config.mode === 'learn') return 'learn';
        
        // Score-based decision
        if (context.score >= 50) return 'block';
        if (context.score >= 30) return 'challenge';
        if (context.score >= 10) return 'monitor';
        
        return 'allow';
    }
    
    // Block request
    blockRequest(context, res, reason) {
        context.blocked = true;
        this.metrics.blockedRequests++;
        
        // Update attacker tracking
        this.updateAttackerInfo(context.ip, context);
        
        // Log blocked request
        this.emit('request:blocked', {
            requestId: context.id,
            ip: context.ip,
            path: context.path,
            reason: reason || 'Security policy violation',
            violations: context.violations,
            score: context.score
        });
        
        // Send response
        res.status(403).json({
            error: 'Forbidden',
            message: 'Request blocked by security policy',
            requestId: context.id
        });
    }
    
    // Challenge request (e.g., CAPTCHA)
    challengeRequest(context, res, next) {
        // For now, just add a delay (in production, would implement CAPTCHA)
        setTimeout(() => {
            next();
        }, 2000);
    }
    
    // Check rate limiting
    checkRateLimit(context) {
        const ip = context.ip;
        const now = Date.now();
        
        // Get request history for IP
        if (!this.requestHistory.has(ip)) {
            this.requestHistory.set(ip, []);
        }
        
        const history = this.requestHistory.get(ip);
        
        // Remove old entries
        const windowStart = now - this.config.rateLimit.windowMs;
        const recentRequests = history.filter(timestamp => timestamp > windowStart);
        
        // Add current request
        recentRequests.push(now);
        this.requestHistory.set(ip, recentRequests);
        
        // Check limit
        if (recentRequests.length > this.config.rateLimit.maxRequests) {
            // Block IP temporarily
            this.blockedIPs.set(ip, {
                reason: 'rate_limit',
                since: now,
                until: now + this.config.rateLimit.blockDuration,
                requests: recentRequests.length
            });
            
            return true;
        }
        
        return false;
    }
    
    // Check IP lists
    checkIPLists(ip) {
        if (this.config.whitelistIPs.includes(ip)) {
            return { action: 'allow', list: 'whitelist' };
        }
        
        if (this.config.blacklistIPs.includes(ip)) {
            return { action: 'block', list: 'blacklist' };
        }
        
        return { action: 'check', list: 'none' };
    }
    
    // Get IP reputation
    getIPReputation(ip) {
        const attackerInfo = this.metrics.topAttackers.get(ip);
        
        if (!attackerInfo) {
            return { score: 0, reputation: 'unknown' };
        }
        
        // Calculate reputation based on history
        const attackRatio = attackerInfo.blocked / attackerInfo.requests;
        
        if (attackRatio > 0.8) return { score: 20, reputation: 'malicious' };
        if (attackRatio > 0.5) return { score: 10, reputation: 'suspicious' };
        if (attackRatio > 0.2) return { score: 5, reputation: 'questionable' };
        
        return { score: 0, reputation: 'clean' };
    }
    
    // Update attacker information
    updateAttackerInfo(ip, context) {
        if (!this.metrics.topAttackers.has(ip)) {
            this.metrics.topAttackers.set(ip, {
                ip,
                requests: 0,
                blocked: 0,
                violations: [],
                firstSeen: new Date(),
                lastSeen: new Date()
            });
        }
        
        const info = this.metrics.topAttackers.get(ip);
        info.requests++;
        if (context.blocked) info.blocked++;
        info.violations.push(...context.violations.map(v => v.category));
        info.lastSeen = new Date();
        
        // Keep only top 1000 attackers
        if (this.metrics.topAttackers.size > 1000) {
            // Remove least active attacker
            let minRequests = Infinity;
            let removeIp = null;
            
            for (const [attackerIp, attackerInfo] of this.metrics.topAttackers) {
                if (attackerInfo.requests < minRequests) {
                    minRequests = attackerInfo.requests;
                    removeIp = attackerIp;
                }
            }
            
            if (removeIp) {
                this.metrics.topAttackers.delete(removeIp);
            }
        }
    }
    
    // Update metrics
    updateMetrics(context) {
        this.metrics.totalRequests++;
        
        // Track attack types
        for (const violation of context.violations) {
            const category = violation.category;
            this.metrics.attacksDetected[category] = 
                (this.metrics.attacksDetected[category] || 0) + 1;
        }
    }
    
    // Log request
    logRequest(context) {
        const logLevel = context.blocked ? 'warn' : 
                        context.violations.length > 0 ? 'info' : 'debug';
        
        if (this.shouldLog(logLevel)) {
            const log = {
                timestamp: context.timestamp,
                requestId: context.id,
                ip: context.ip,
                method: context.method,
                path: context.path,
                blocked: context.blocked,
                score: context.score,
                violations: context.violations.length,
                violationDetails: context.violations
            };
            
            this.emit('log', { level: logLevel, data: log });
        }
    }
    
    // Check if should log based on level
    shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] >= levels[this.config.logLevel];
    }
    
    // Get client IP
    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress ||
               req.socket.remoteAddress;
    }
    
    // Start cleanup interval
    startCleanup() {
        setInterval(() => {
            // Clean old request history
            const now = Date.now();
            const cutoff = now - 3600000; // 1 hour
            
            for (const [ip, history] of this.requestHistory) {
                const filtered = history.filter(timestamp => timestamp > cutoff);
                if (filtered.length === 0) {
                    this.requestHistory.delete(ip);
                } else {
                    this.requestHistory.set(ip, filtered);
                }
            }
            
            // Clean expired blocks
            for (const [ip, blockInfo] of this.blockedIPs) {
                if (now > blockInfo.until) {
                    this.blockedIPs.delete(ip);
                }
            }
            
        }, 60000); // Every minute
    }
    
    // Get WAF statistics
    getStatistics() {
        const stats = {
            enabled: this.config.enabled,
            mode: this.config.mode,
            metrics: {
                ...this.metrics,
                topAttackers: Array.from(this.metrics.topAttackers.entries())
                    .sort((a, b) => b[1].blocked - a[1].blocked)
                    .slice(0, 10)
                    .map(([ip, info]) => ({
                        ip,
                        requests: info.requests,
                        blocked: info.blocked,
                        ratio: (info.blocked / info.requests * 100).toFixed(1) + '%'
                    }))
            },
            rules: {},
            currentlyBlocked: this.blockedIPs.size
        };
        
        // Add rule statistics
        for (const [ruleSetId, ruleSet] of this.ruleSets) {
            stats.rules[ruleSetId] = {
                name: ruleSet.name,
                enabled: ruleSet.enabled,
                hits: ruleSet.hits,
                blocked: ruleSet.blocked
            };
        }
        
        return stats;
    }
    
    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('config:updated', this.config);
    }
    
    // Add custom rule
    addCustomRule(rule) {
        const customRuleSet = this.ruleSets.get('rootuip_custom');
        if (customRuleSet) {
            customRuleSet.rules.push({
                id: `custom_${Date.now()}`,
                ...rule
            });
            this.emit('rule:added', rule);
        }
    }
    
    // Express middleware
    middleware() {
        return (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            
            this.processRequest(req, res, next);
        };
    }
}

module.exports = WebApplicationFirewall;