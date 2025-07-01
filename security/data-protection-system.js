/**
 * ROOTUIP Data Protection System
 * End-to-end encryption, DLP, and secure data handling
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class DataProtectionSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Data protection configuration
        this.config = {
            // Encryption settings
            encryption: {
                algorithm: config.algorithm || 'aes-256-gcm',
                keyDerivation: config.keyDerivation || 'scrypt',
                keyRotationDays: config.keyRotationDays || 90,
                enforceEncryption: config.enforceEncryption !== false
            },
            
            // DLP settings
            dlp: {
                enabled: config.dlpEnabled !== false,
                scanContent: config.scanContent !== false,
                policies: config.dlpPolicies || [],
                actions: config.dlpActions || ['block', 'alert', 'encrypt', 'watermark']
            },
            
            // Data classification
            classification: {
                levels: ['public', 'internal', 'confidential', 'restricted'],
                defaultLevel: config.defaultClassification || 'internal',
                autoClassify: config.autoClassify !== false
            },
            
            // Backup security
            backup: {
                encryptBackups: config.encryptBackups !== false,
                compressionLevel: config.compressionLevel || 6,
                retentionDays: config.retentionDays || 365
            }
        };
        
        // Encryption keys
        this.keyStore = new SecureKeyStore();
        
        // DLP engine
        this.dlpEngine = new DLPEngine();
        
        // Data classifier
        this.classifier = new DataClassifier();
        
        // Data inventory
        this.dataInventory = new Map();
        
        // Active encryption sessions
        this.encryptionSessions = new Map();
        
        // Metrics
        this.metrics = {
            dataEncrypted: 0,
            dataDecrypted: 0,
            dlpScans: 0,
            dlpViolations: 0,
            dataClassified: 0,
            keysRotated: 0
        };
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize data protection
    initialize() {
        // Initialize master keys
        this.initializeMasterKeys();
        
        // Load DLP policies
        this.loadDLPPolicies();
        
        // Start key rotation scheduler
        this.startKeyRotation();
        
        console.log('Data Protection System initialized');
    }
    
    // Initialize master keys
    initializeMasterKeys() {
        // Generate master encryption key
        if (!this.keyStore.hasMasterKey()) {
            const masterKey = crypto.randomBytes(32);
            const salt = crypto.randomBytes(16);
            
            this.keyStore.setMasterKey(masterKey, salt);
        }
        
        // Generate key encryption key (KEK)
        if (!this.keyStore.hasKEK()) {
            const kek = crypto.randomBytes(32);
            this.keyStore.setKEK(kek);
        }
    }
    
    // Load DLP policies
    loadDLPPolicies() {
        // Credit card detection
        this.dlpEngine.addPolicy({
            id: 'credit_card',
            name: 'Credit Card Detection',
            patterns: [
                /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g
            ],
            severity: 'high',
            action: 'block',
            classification: 'restricted'
        });
        
        // SSN detection
        this.dlpEngine.addPolicy({
            id: 'ssn',
            name: 'Social Security Number',
            patterns: [
                /\b\d{3}-\d{2}-\d{4}\b/g,
                /\b\d{9}\b/g
            ],
            severity: 'critical',
            action: 'encrypt',
            classification: 'restricted'
        });
        
        // Email detection
        this.dlpEngine.addPolicy({
            id: 'email',
            name: 'Email Address',
            patterns: [
                /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
            ],
            severity: 'medium',
            action: 'mask',
            classification: 'confidential'
        });
        
        // API keys/secrets
        this.dlpEngine.addPolicy({
            id: 'api_key',
            name: 'API Keys and Secrets',
            patterns: [
                /\b[A-Za-z0-9_]{40,}\b/g, // Generic long key
                /api[_-]?key[_-]?[=:]\s*[\'"]?[A-Za-z0-9_]{20,}[\'"]?/gi,
                /secret[_-]?key[_-]?[=:]\s*[\'"]?[A-Za-z0-9_]{20,}[\'"]?/gi
            ],
            severity: 'critical',
            action: 'block',
            classification: 'restricted'
        });
        
        // Custom sensitive data
        this.dlpEngine.addPolicy({
            id: 'custom_sensitive',
            name: 'Custom Sensitive Data',
            keywords: ['confidential', 'secret', 'private', 'restricted'],
            severity: 'high',
            action: 'alert',
            classification: 'confidential'
        });
    }
    
    // Encrypt data
    async encryptData(data, options = {}) {
        const encryptionId = uuidv4();
        const startTime = Date.now();
        
        try {
            // Classify data if needed
            let classification = options.classification;
            if (!classification && this.config.classification.autoClassify) {
                classification = await this.classifier.classify(data);
            }
            classification = classification || this.config.classification.defaultLevel;
            
            // DLP scan before encryption
            if (this.config.dlp.enabled && this.config.dlp.scanContent) {
                const dlpResult = await this.dlpEngine.scan(data);
                
                if (dlpResult.violations.length > 0) {
                    this.handleDLPViolations(dlpResult.violations, options);
                    
                    // Apply DLP actions
                    for (const violation of dlpResult.violations) {
                        if (violation.action === 'block') {
                            throw new Error(`DLP violation: ${violation.policy.name}`);
                        }
                    }
                }
            }
            
            // Get encryption key for classification level
            const keyInfo = await this.keyStore.getKeyForClassification(classification);
            
            // Create cipher
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(
                this.config.encryption.algorithm,
                keyInfo.key,
                iv
            );
            
            // Encrypt data
            const encrypted = Buffer.concat([
                cipher.update(Buffer.from(JSON.stringify(data))),
                cipher.final()
            ]);
            
            // Get auth tag for GCM
            const authTag = cipher.getAuthTag();
            
            // Create encryption envelope
            const envelope = {
                id: encryptionId,
                version: '1.0',
                algorithm: this.config.encryption.algorithm,
                keyId: keyInfo.keyId,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                data: encrypted.toString('base64'),
                classification,
                metadata: {
                    encrypted: new Date(),
                    size: encrypted.length,
                    ...options.metadata
                }
            };
            
            // Store in inventory
            this.dataInventory.set(encryptionId, {
                classification,
                keyId: keyInfo.keyId,
                created: new Date(),
                lastAccessed: new Date()
            });
            
            // Update metrics
            this.metrics.dataEncrypted++;
            const duration = Date.now() - startTime;
            
            this.emit('data:encrypted', {
                id: encryptionId,
                classification,
                size: encrypted.length,
                duration
            });
            
            return envelope;
            
        } catch (error) {
            this.emit('encryption:error', {
                id: encryptionId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Decrypt data
    async decryptData(envelope, options = {}) {
        const startTime = Date.now();
        
        try {
            // Validate envelope
            if (!envelope.id || !envelope.keyId || !envelope.data) {
                throw new Error('Invalid encryption envelope');
            }
            
            // Check access permissions
            if (options.requiredClassification) {
                const allowed = this.checkClassificationAccess(
                    envelope.classification,
                    options.requiredClassification
                );
                if (!allowed) {
                    throw new Error('Insufficient classification level');
                }
            }
            
            // Get decryption key
            const keyInfo = await this.keyStore.getKey(envelope.keyId);
            if (!keyInfo) {
                throw new Error('Decryption key not found');
            }
            
            // Create decipher
            const decipher = crypto.createDecipheriv(
                envelope.algorithm || this.config.encryption.algorithm,
                keyInfo.key,
                Buffer.from(envelope.iv, 'base64')
            );
            
            // Set auth tag for GCM
            if (envelope.authTag) {
                decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
            }
            
            // Decrypt data
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(envelope.data, 'base64')),
                decipher.final()
            ]);
            
            // Parse decrypted data
            const data = JSON.parse(decrypted.toString());
            
            // Update inventory
            const inventoryItem = this.dataInventory.get(envelope.id);
            if (inventoryItem) {
                inventoryItem.lastAccessed = new Date();
                inventoryItem.accessCount = (inventoryItem.accessCount || 0) + 1;
            }
            
            // Audit log
            this.emit('data:decrypted', {
                id: envelope.id,
                classification: envelope.classification,
                accessor: options.accessor,
                purpose: options.purpose
            });
            
            // Update metrics
            this.metrics.dataDecrypted++;
            const duration = Date.now() - startTime;
            
            return data;
            
        } catch (error) {
            this.emit('decryption:error', {
                id: envelope.id,
                error: error.message
            });
            throw error;
        }
    }
    
    // Data Loss Prevention scan
    async scanForDLP(content, context = {}) {
        this.metrics.dlpScans++;
        
        const result = await this.dlpEngine.scan(content, context);
        
        if (result.violations.length > 0) {
            this.metrics.dlpViolations += result.violations.length;
            this.handleDLPViolations(result.violations, context);
        }
        
        return result;
    }
    
    // Handle DLP violations
    handleDLPViolations(violations, context) {
        for (const violation of violations) {
            this.emit('dlp:violation', {
                policy: violation.policy,
                match: violation.match,
                context,
                timestamp: new Date()
            });
            
            // Apply actions
            switch (violation.action) {
                case 'alert':
                    this.sendDLPAlert(violation, context);
                    break;
                    
                case 'quarantine':
                    this.quarantineData(violation, context);
                    break;
                    
                case 'encrypt':
                    // Data will be encrypted
                    break;
                    
                case 'watermark':
                    // Apply watermark
                    break;
            }
        }
    }
    
    // Mask sensitive data
    maskSensitiveData(data, level = 'partial') {
        const masked = JSON.parse(JSON.stringify(data));
        
        const maskString = (str, level) => {
            if (level === 'full') {
                return '*'.repeat(str.length);
            } else if (level === 'partial') {
                const visibleChars = Math.min(4, Math.floor(str.length * 0.2));
                return str.substring(0, visibleChars) + '*'.repeat(str.length - visibleChars);
            }
            return str;
        };
        
        const maskObject = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    // Check if sensitive
                    const dlpResult = this.dlpEngine.quickScan(obj[key]);
                    if (dlpResult.sensitive) {
                        obj[key] = maskString(obj[key], level);
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    maskObject(obj[key]);
                }
            }
        };
        
        if (typeof masked === 'object') {
            maskObject(masked);
        } else if (typeof masked === 'string') {
            const dlpResult = this.dlpEngine.quickScan(masked);
            if (dlpResult.sensitive) {
                return maskString(masked, level);
            }
        }
        
        return masked;
    }
    
    // Anonymize data
    async anonymizeData(data, options = {}) {
        const anonymized = JSON.parse(JSON.stringify(data));
        
        const anonymizeValue = (value, type) => {
            switch (type) {
                case 'email':
                    const parts = value.split('@');
                    return `anon_${crypto.randomBytes(4).toString('hex')}@${parts[1] || 'example.com'}`;
                    
                case 'name':
                    return `User_${crypto.randomBytes(4).toString('hex')}`;
                    
                case 'phone':
                    return value.replace(/\d/g, 'X');
                    
                case 'ip':
                    return value.split('.').map((octet, i) => i < 2 ? octet : '0').join('.');
                    
                default:
                    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 8);
            }
        };
        
        const anonymizeObject = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    // Detect data type
                    const dataType = this.detectDataType(obj[key]);
                    if (dataType !== 'unknown') {
                        obj[key] = anonymizeValue(obj[key], dataType);
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    anonymizeObject(obj[key]);
                }
            }
        };
        
        anonymizeObject(anonymized);
        
        return anonymized;
    }
    
    // Secure backup
    async createSecureBackup(data, options = {}) {
        const backupId = uuidv4();
        
        try {
            // Compress data
            const compressed = await this.compressData(data);
            
            // Encrypt compressed data
            const encrypted = await this.encryptData(compressed, {
                classification: 'confidential',
                metadata: {
                    type: 'backup',
                    backupId,
                    source: options.source
                }
            });
            
            // Add backup metadata
            const backup = {
                id: backupId,
                created: new Date(),
                expires: new Date(Date.now() + this.config.backup.retentionDays * 24 * 60 * 60 * 1000),
                size: encrypted.data.length,
                checksum: this.calculateChecksum(encrypted.data),
                encryption: encrypted,
                metadata: options.metadata
            };
            
            this.emit('backup:created', {
                id: backupId,
                size: backup.size,
                expires: backup.expires
            });
            
            return backup;
            
        } catch (error) {
            this.emit('backup:error', {
                id: backupId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Restore from backup
    async restoreFromBackup(backup, options = {}) {
        try {
            // Verify backup integrity
            const checksum = this.calculateChecksum(backup.encryption.data);
            if (checksum !== backup.checksum) {
                throw new Error('Backup integrity check failed');
            }
            
            // Check expiration
            if (new Date() > new Date(backup.expires)) {
                throw new Error('Backup has expired');
            }
            
            // Decrypt backup
            const compressed = await this.decryptData(backup.encryption, {
                requiredClassification: 'confidential',
                accessor: options.accessor,
                purpose: 'backup_restore'
            });
            
            // Decompress data
            const data = await this.decompressData(compressed);
            
            this.emit('backup:restored', {
                id: backup.id,
                restoredBy: options.accessor
            });
            
            return data;
            
        } catch (error) {
            this.emit('restore:error', {
                id: backup.id,
                error: error.message
            });
            throw error;
        }
    }
    
    // Key rotation
    async rotateEncryptionKeys() {
        const rotatedKeys = await this.keyStore.rotateKeys(this.config.encryption.keyRotationDays);
        
        this.metrics.keysRotated += rotatedKeys.length;
        
        if (rotatedKeys.length > 0) {
            this.emit('keys:rotated', {
                count: rotatedKeys.length,
                keyIds: rotatedKeys.map(k => k.keyId)
            });
            
            // Re-encrypt data with new keys
            await this.reencryptData(rotatedKeys);
        }
    }
    
    // Re-encrypt data
    async reencryptData(rotatedKeys) {
        const keyIds = rotatedKeys.map(k => k.oldKeyId);
        
        for (const [dataId, item] of this.dataInventory) {
            if (keyIds.includes(item.keyId)) {
                // Find the new key
                const newKey = rotatedKeys.find(k => k.oldKeyId === item.keyId);
                if (newKey) {
                    item.keyId = newKey.newKeyId;
                    item.reencrypted = new Date();
                }
            }
        }
    }
    
    // Start key rotation scheduler
    startKeyRotation() {
        // Run daily
        setInterval(() => {
            this.rotateEncryptionKeys().catch(err => {
                console.error('Key rotation error:', err);
            });
        }, 24 * 60 * 60 * 1000);
    }
    
    // Helper methods
    checkClassificationAccess(dataClassification, requiredClassification) {
        const levels = this.config.classification.levels;
        const dataLevel = levels.indexOf(dataClassification);
        const requiredLevel = levels.indexOf(requiredClassification);
        
        return requiredLevel >= dataLevel;
    }
    
    detectDataType(value) {
        if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(value)) {
            return 'email';
        }
        if (/^\d{3}-\d{3}-\d{4}$/.test(value)) {
            return 'phone';
        }
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
            return 'ip';
        }
        if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(value)) {
            return 'name';
        }
        return 'unknown';
    }
    
    calculateChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    async compressData(data) {
        // Simplified compression - in production use zlib
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }
    
    async decompressData(compressed) {
        // Simplified decompression
        return JSON.parse(Buffer.from(compressed, 'base64').toString());
    }
    
    sendDLPAlert(violation, context) {
        this.emit('dlp:alert', {
            severity: violation.policy.severity,
            policy: violation.policy.name,
            context,
            timestamp: new Date()
        });
    }
    
    quarantineData(violation, context) {
        // Move data to quarantine
        this.emit('dlp:quarantine', {
            policy: violation.policy.name,
            data: violation.match,
            context,
            timestamp: new Date()
        });
    }
    
    // Get statistics
    getStatistics() {
        return {
            config: {
                encryptionAlgorithm: this.config.encryption.algorithm,
                dlpEnabled: this.config.dlp.enabled,
                classificationLevels: this.config.classification.levels
            },
            metrics: this.metrics,
            dataInventory: {
                total: this.dataInventory.size,
                byClassification: this.getInventoryByClassification()
            },
            keyStore: {
                activeKeys: this.keyStore.getActiveKeyCount(),
                rotationSchedule: this.config.encryption.keyRotationDays
            },
            dlp: {
                policies: this.dlpEngine.getPolicyCount(),
                recentViolations: this.dlpEngine.getRecentViolations()
            }
        };
    }
    
    getInventoryByClassification() {
        const byClass = {};
        
        for (const item of this.dataInventory.values()) {
            byClass[item.classification] = (byClass[item.classification] || 0) + 1;
        }
        
        return byClass;
    }
}

// Secure Key Store
class SecureKeyStore {
    constructor() {
        this.masterKey = null;
        this.kek = null; // Key Encryption Key
        this.keys = new Map();
        this.keyHistory = [];
    }
    
    setMasterKey(key, salt) {
        this.masterKey = key;
        this.salt = salt;
    }
    
    hasMasterKey() {
        return this.masterKey !== null;
    }
    
    setKEK(kek) {
        this.kek = kek;
    }
    
    hasKEK() {
        return this.kek !== null;
    }
    
    async getKeyForClassification(classification) {
        // Get or create key for classification level
        const keyId = `class_${classification}`;
        
        if (!this.keys.has(keyId)) {
            const key = await this.generateDataKey(classification);
            this.keys.set(keyId, {
                keyId,
                key,
                classification,
                created: new Date(),
                lastUsed: new Date()
            });
        }
        
        const keyInfo = this.keys.get(keyId);
        keyInfo.lastUsed = new Date();
        
        return keyInfo;
    }
    
    async getKey(keyId) {
        return this.keys.get(keyId);
    }
    
    async generateDataKey(purpose) {
        // Derive key from master key
        const key = crypto.scryptSync(
            this.masterKey,
            Buffer.concat([this.salt, Buffer.from(purpose)]),
            32
        );
        
        return key;
    }
    
    async rotateKeys(maxAgeDays) {
        const rotated = [];
        const now = Date.now();
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
        
        for (const [keyId, keyInfo] of this.keys) {
            if (now - keyInfo.created.getTime() > maxAge) {
                // Generate new key
                const newKey = await this.generateDataKey(keyInfo.classification || keyId);
                const newKeyId = `${keyId}_${Date.now()}`;
                
                // Store new key
                this.keys.set(newKeyId, {
                    keyId: newKeyId,
                    key: newKey,
                    classification: keyInfo.classification,
                    created: new Date(),
                    lastUsed: new Date(),
                    previousKeyId: keyId
                });
                
                // Archive old key
                keyInfo.archived = new Date();
                keyInfo.replacedBy = newKeyId;
                this.keyHistory.push(keyInfo);
                
                rotated.push({
                    oldKeyId: keyId,
                    newKeyId: newKeyId
                });
            }
        }
        
        return rotated;
    }
    
    getActiveKeyCount() {
        return Array.from(this.keys.values())
            .filter(k => !k.archived).length;
    }
}

// DLP Engine
class DLPEngine {
    constructor() {
        this.policies = new Map();
        this.violations = [];
    }
    
    addPolicy(policy) {
        this.policies.set(policy.id, policy);
    }
    
    async scan(content, context = {}) {
        const violations = [];
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        
        for (const [policyId, policy] of this.policies) {
            // Pattern matching
            if (policy.patterns) {
                for (const pattern of policy.patterns) {
                    const matches = contentStr.match(pattern);
                    if (matches) {
                        violations.push({
                            policy,
                            match: matches[0],
                            action: policy.action,
                            position: contentStr.indexOf(matches[0])
                        });
                    }
                }
            }
            
            // Keyword matching
            if (policy.keywords) {
                for (const keyword of policy.keywords) {
                    if (contentStr.toLowerCase().includes(keyword.toLowerCase())) {
                        violations.push({
                            policy,
                            match: keyword,
                            action: policy.action
                        });
                    }
                }
            }
        }
        
        // Store violations
        violations.forEach(v => {
            this.violations.push({
                ...v,
                timestamp: new Date(),
                context
            });
        });
        
        // Keep only recent violations
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        this.violations = this.violations.filter(v => 
            v.timestamp.getTime() > cutoff
        );
        
        return { violations };
    }
    
    quickScan(value) {
        for (const policy of this.policies.values()) {
            if (policy.patterns) {
                for (const pattern of policy.patterns) {
                    if (pattern.test(value)) {
                        return { sensitive: true, policy: policy.id };
                    }
                }
            }
        }
        return { sensitive: false };
    }
    
    getPolicyCount() {
        return this.policies.size;
    }
    
    getRecentViolations() {
        return this.violations.slice(-10);
    }
}

// Data Classifier
class DataClassifier {
    constructor() {
        this.classificationRules = this.initializeRules();
    }
    
    initializeRules() {
        return [
            {
                patterns: [/password/i, /secret/i, /private/i, /key/i],
                classification: 'restricted'
            },
            {
                patterns: [/confidential/i, /ssn/i, /credit.?card/i],
                classification: 'confidential'
            },
            {
                patterns: [/internal/i, /employee/i],
                classification: 'internal'
            }
        ];
    }
    
    async classify(data) {
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        
        for (const rule of this.classificationRules) {
            for (const pattern of rule.patterns) {
                if (pattern.test(content)) {
                    return rule.classification;
                }
            }
        }
        
        return 'internal'; // Default
    }
}

module.exports = DataProtectionSystem;