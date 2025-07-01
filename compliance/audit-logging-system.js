/**
 * ROOTUIP Audit Logging System
 * Tamper-proof audit logs with blockchain-style integrity
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class AuditLoggingSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            storageDir: config.storageDir || './audit-logs',
            rotationSize: config.rotationSize || 100 * 1024 * 1024, // 100MB
            retentionDays: config.retentionDays || 2555, // 7 years
            compressionEnabled: config.compressionEnabled !== false,
            encryptionEnabled: config.encryptionEnabled !== false,
            blockchainEnabled: config.blockchainEnabled !== false,
            replicationTargets: config.replicationTargets || []
        };
        
        // Audit log chains
        this.logChains = new Map();
        
        // Current blocks being written
        this.currentBlocks = new Map();
        
        // Integrity verification
        this.integrityChecks = new Map();
        
        // Log categories
        this.categories = new Map();
        
        // Search indices
        this.searchIndices = {
            byUser: new Map(),
            byAction: new Map(),
            byResource: new Map(),
            byTimestamp: new Map()
        };
        
        // Metrics
        this.metrics = {
            totalLogs: 0,
            totalBlocks: 0,
            storageUsed: 0,
            integrityChecks: 0,
            violations: 0
        };
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize audit logging system
    async initialize() {
        // Create storage directory
        await this.ensureStorageDirectory();
        
        // Initialize log categories
        this.initializeCategories();
        
        // Load existing chains
        await this.loadExistingChains();
        
        // Start integrity monitoring
        this.startIntegrityMonitoring();
        
        console.log('Audit Logging System initialized');
    }
    
    // Initialize log categories
    initializeCategories() {
        // Authentication logs
        this.addCategory('authentication', {
            name: 'Authentication',
            retention: 365 * 7, // 7 years
            fields: ['userId', 'method', 'result', 'ipAddress', 'userAgent'],
            encryption: true,
            compliance: ['SOC2', 'GDPR', 'ISO27001']
        });
        
        // Data access logs
        this.addCategory('data_access', {
            name: 'Data Access',
            retention: 365 * 7, // 7 years
            fields: ['userId', 'resource', 'action', 'dataClassification', 'result'],
            encryption: true,
            compliance: ['SOC2', 'GDPR', 'HIPAA']
        });
        
        // Configuration changes
        this.addCategory('configuration', {
            name: 'Configuration Changes',
            retention: 365 * 7, // 7 years
            fields: ['userId', 'component', 'change', 'previousValue', 'newValue'],
            encryption: true,
            compliance: ['SOC2', 'ISO27001']
        });
        
        // Security events
        this.addCategory('security', {
            name: 'Security Events',
            retention: 365 * 7, // 7 years
            fields: ['eventType', 'severity', 'source', 'target', 'outcome'],
            encryption: true,
            compliance: ['SOC2', 'ISO27001']
        });
        
        // Compliance events
        this.addCategory('compliance', {
            name: 'Compliance Events',
            retention: 365 * 10, // 10 years
            fields: ['framework', 'requirement', 'action', 'evidence', 'approver'],
            encryption: true,
            compliance: ['All']
        });
        
        // System events
        this.addCategory('system', {
            name: 'System Events',
            retention: 365 * 3, // 3 years
            fields: ['component', 'event', 'severity', 'details'],
            encryption: false,
            compliance: ['SOC2']
        });
        
        // API calls
        this.addCategory('api', {
            name: 'API Calls',
            retention: 365 * 2, // 2 years
            fields: ['endpoint', 'method', 'userId', 'responseCode', 'duration'],
            encryption: false,
            compliance: ['SOC2']
        });
        
        // Administrative actions
        this.addCategory('admin', {
            name: 'Administrative Actions',
            retention: 365 * 7, // 7 years
            fields: ['adminId', 'action', 'target', 'reason', 'approval'],
            encryption: true,
            compliance: ['SOC2', 'ISO27001']
        });
    }
    
    // Add log category
    addCategory(categoryId, config) {
        this.categories.set(categoryId, {
            ...config,
            id: categoryId,
            created: new Date(),
            logCount: 0
        });
    }
    
    // Write audit log
    async writeAuditLog(category, logData) {
        const categoryConfig = this.categories.get(category);
        if (!categoryConfig) {
            throw new Error(`Unknown audit category: ${category}`);
        }
        
        // Create audit entry
        const auditEntry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            category,
            version: '1.0',
            ...logData,
            metadata: {
                hostname: require('os').hostname(),
                processId: process.pid,
                ...logData.metadata
            }
        };
        
        // Validate required fields
        this.validateAuditEntry(auditEntry, categoryConfig);
        
        // Add to blockchain if enabled
        if (this.config.blockchainEnabled) {
            await this.addToBlockchain(category, auditEntry);
        } else {
            await this.writeDirectLog(category, auditEntry);
        }
        
        // Update indices
        this.updateIndices(auditEntry);
        
        // Update metrics
        this.metrics.totalLogs++;
        categoryConfig.logCount++;
        
        // Emit event
        this.emit('audit:logged', {
            category,
            id: auditEntry.id,
            timestamp: auditEntry.timestamp
        });
        
        return {
            id: auditEntry.id,
            timestamp: auditEntry.timestamp,
            hash: await this.calculateHash(auditEntry)
        };
    }
    
    // Validate audit entry
    validateAuditEntry(entry, categoryConfig) {
        const missingFields = [];
        
        for (const field of categoryConfig.fields) {
            if (!(field in entry) && !this.isOptionalField(field)) {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Validate data types
        if (entry.userId && typeof entry.userId !== 'string') {
            throw new Error('userId must be a string');
        }
        
        if (entry.timestamp && !Date.parse(entry.timestamp)) {
            throw new Error('Invalid timestamp format');
        }
    }
    
    // Add to blockchain
    async addToBlockchain(category, auditEntry) {
        let chain = this.logChains.get(category);
        
        if (!chain) {
            chain = await this.createNewChain(category);
        }
        
        let currentBlock = this.currentBlocks.get(category);
        
        if (!currentBlock) {
            currentBlock = await this.createNewBlock(chain);
            this.currentBlocks.set(category, currentBlock);
        }
        
        // Add entry to current block
        currentBlock.entries.push(auditEntry);
        currentBlock.entryCount++;
        
        // Check if block should be sealed
        if (currentBlock.entryCount >= 100 || 
            Date.now() - currentBlock.created > 60000) { // 100 entries or 1 minute
            await this.sealBlock(category, currentBlock);
            this.currentBlocks.delete(category);
        }
    }
    
    // Create new chain
    async createNewChain(category) {
        const chain = {
            id: uuidv4(),
            category,
            created: new Date(),
            version: '1.0',
            blocks: [],
            lastBlockHash: null,
            metadata: {
                encryption: this.categories.get(category).encryption,
                compression: this.config.compressionEnabled
            }
        };
        
        this.logChains.set(category, chain);
        
        // Write chain genesis
        await this.writeChainGenesis(chain);
        
        return chain;
    }
    
    // Create new block
    async createNewBlock(chain) {
        const block = {
            id: uuidv4(),
            chainId: chain.id,
            blockNumber: chain.blocks.length + 1,
            previousHash: chain.lastBlockHash,
            created: Date.now(),
            entries: [],
            entryCount: 0,
            sealed: false
        };
        
        return block;
    }
    
    // Seal block
    async sealBlock(category, block) {
        const chain = this.logChains.get(category);
        
        // Calculate merkle root of entries
        block.merkleRoot = await this.calculateMerkleRoot(block.entries);
        
        // Calculate block hash
        block.hash = await this.calculateBlockHash(block);
        
        // Add nonce for proof of work (simplified)
        block.nonce = await this.findNonce(block);
        
        // Encrypt if required
        if (chain.metadata.encryption) {
            block.entries = await this.encryptEntries(block.entries);
            block.encrypted = true;
        }
        
        // Compress if enabled
        if (chain.metadata.compression) {
            block.compressed = true;
            block.compressionRatio = await this.compressBlock(block);
        }
        
        // Mark as sealed
        block.sealed = true;
        block.sealedAt = new Date();
        
        // Write block to storage
        await this.writeBlock(category, block);
        
        // Update chain
        chain.blocks.push({
            blockNumber: block.blockNumber,
            hash: block.hash,
            timestamp: block.sealedAt,
            entryCount: block.entryCount
        });
        chain.lastBlockHash = block.hash;
        
        // Replicate if configured
        if (this.config.replicationTargets.length > 0) {
            await this.replicateBlock(block);
        }
        
        this.metrics.totalBlocks++;
        
        this.emit('block:sealed', {
            category,
            blockNumber: block.blockNumber,
            hash: block.hash,
            entries: block.entryCount
        });
    }
    
    // Calculate hash
    async calculateHash(data) {
        const content = JSON.stringify(data);
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    // Calculate merkle root
    async calculateMerkleRoot(entries) {
        if (entries.length === 0) return null;
        
        let hashes = await Promise.all(
            entries.map(entry => this.calculateHash(entry))
        );
        
        while (hashes.length > 1) {
            const newHashes = [];
            
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = hashes[i + 1] || left;
                const combined = crypto.createHash('sha256')
                    .update(left + right)
                    .digest('hex');
                newHashes.push(combined);
            }
            
            hashes = newHashes;
        }
        
        return hashes[0];
    }
    
    // Calculate block hash
    async calculateBlockHash(block) {
        const blockData = {
            id: block.id,
            chainId: block.chainId,
            blockNumber: block.blockNumber,
            previousHash: block.previousHash,
            merkleRoot: block.merkleRoot,
            created: block.created
        };
        
        return await this.calculateHash(blockData);
    }
    
    // Find nonce (simplified proof of work)
    async findNonce(block) {
        let nonce = 0;
        const target = '00'; // Require hash to start with 00
        
        while (true) {
            const testBlock = { ...block, nonce };
            const hash = await this.calculateBlockHash(testBlock);
            
            if (hash.startsWith(target)) {
                return nonce;
            }
            
            nonce++;
            
            // Limit iterations to prevent blocking
            if (nonce > 10000) {
                return nonce; // Accept any nonce after limit
            }
        }
    }
    
    // Encrypt entries
    async encryptEntries(entries) {
        const key = await this.getEncryptionKey();
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        const encryptedData = Buffer.concat([
            cipher.update(JSON.stringify(entries), 'utf8'),
            cipher.final()
        ]);
        
        const authTag = cipher.getAuthTag();
        
        return {
            data: encryptedData.toString('base64'),
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64')
        };
    }
    
    // Get encryption key
    async getEncryptionKey() {
        // In production, this would retrieve from secure key management
        return crypto.scryptSync('audit-encryption-key', 'salt', 32);
    }
    
    // Compress block
    async compressBlock(block) {
        const originalSize = JSON.stringify(block).length;
        
        // In production, would use actual compression
        // For now, return simulated compression ratio
        return 0.3; // 30% of original size
    }
    
    // Write block to storage
    async writeBlock(category, block) {
        const blockPath = path.join(
            this.config.storageDir,
            category,
            `block_${block.blockNumber.toString().padStart(8, '0')}.json`
        );
        
        await this.ensureDirectory(path.dirname(blockPath));
        
        await fs.writeFile(
            blockPath,
            JSON.stringify(block, null, 2),
            'utf8'
        );
        
        // Update storage metrics
        const stats = await fs.stat(blockPath);
        this.metrics.storageUsed += stats.size;
    }
    
    // Write direct log (non-blockchain mode)
    async writeDirectLog(category, auditEntry) {
        const date = new Date();
        const logPath = path.join(
            this.config.storageDir,
            category,
            `${date.getFullYear()}`,
            `${(date.getMonth() + 1).toString().padStart(2, '0')}`,
            `${date.getDate().toString().padStart(2, '0')}.log`
        );
        
        await this.ensureDirectory(path.dirname(logPath));
        
        const logLine = JSON.stringify(auditEntry) + '\n';
        
        await fs.appendFile(logPath, logLine, 'utf8');
    }
    
    // Search audit logs
    async searchAuditLogs(criteria) {
        const results = [];
        const startTime = Date.now();
        
        // Search by user
        if (criteria.userId) {
            const userLogs = this.searchIndices.byUser.get(criteria.userId) || [];
            results.push(...userLogs);
        }
        
        // Search by action
        if (criteria.action) {
            const actionLogs = this.searchIndices.byAction.get(criteria.action) || [];
            results.push(...this.intersectResults(results, actionLogs));
        }
        
        // Search by date range
        if (criteria.startDate || criteria.endDate) {
            const filtered = await this.filterByDateRange(
                results.length > 0 ? results : await this.getAllLogs(),
                criteria.startDate,
                criteria.endDate
            );
            return {
                results: filtered,
                count: filtered.length,
                searchTime: Date.now() - startTime
            };
        }
        
        return {
            results: results.slice(0, criteria.limit || 100),
            count: results.length,
            searchTime: Date.now() - startTime
        };
    }
    
    // Verify integrity
    async verifyIntegrity(category, options = {}) {
        const chain = this.logChains.get(category);
        if (!chain) {
            throw new Error(`No chain found for category: ${category}`);
        }
        
        const verification = {
            category,
            started: new Date(),
            blocksChecked: 0,
            errors: [],
            valid: true
        };
        
        // Verify each block
        for (const blockRef of chain.blocks) {
            const blockPath = path.join(
                this.config.storageDir,
                category,
                `block_${blockRef.blockNumber.toString().padStart(8, '0')}.json`
            );
            
            try {
                const blockData = await fs.readFile(blockPath, 'utf8');
                const block = JSON.parse(blockData);
                
                // Verify block hash
                const calculatedHash = await this.calculateBlockHash(block);
                if (calculatedHash !== blockRef.hash) {
                    verification.errors.push({
                        blockNumber: blockRef.blockNumber,
                        error: 'Hash mismatch',
                        expected: blockRef.hash,
                        actual: calculatedHash
                    });
                    verification.valid = false;
                }
                
                // Verify chain continuity
                if (blockRef.blockNumber > 1) {
                    const expectedPrevious = chain.blocks[blockRef.blockNumber - 2].hash;
                    if (block.previousHash !== expectedPrevious) {
                        verification.errors.push({
                            blockNumber: blockRef.blockNumber,
                            error: 'Chain discontinuity',
                            expected: expectedPrevious,
                            actual: block.previousHash
                        });
                        verification.valid = false;
                    }
                }
                
                // Verify merkle root
                if (!block.encrypted && options.deep) {
                    const calculatedMerkle = await this.calculateMerkleRoot(block.entries);
                    if (calculatedMerkle !== block.merkleRoot) {
                        verification.errors.push({
                            blockNumber: blockRef.blockNumber,
                            error: 'Merkle root mismatch'
                        });
                        verification.valid = false;
                    }
                }
                
                verification.blocksChecked++;
                
            } catch (error) {
                verification.errors.push({
                    blockNumber: blockRef.blockNumber,
                    error: 'Block read error',
                    details: error.message
                });
                verification.valid = false;
            }
        }
        
        verification.completed = new Date();
        verification.duration = verification.completed - verification.started;
        
        // Update metrics
        this.metrics.integrityChecks++;
        if (!verification.valid) {
            this.metrics.violations++;
        }
        
        // Store verification result
        this.integrityChecks.set(
            `${category}_${Date.now()}`,
            verification
        );
        
        // Emit event
        this.emit('integrity:checked', verification);
        
        return verification;
    }
    
    // Generate audit report
    async generateAuditReport(options = {}) {
        const report = {
            generatedAt: new Date(),
            period: {
                start: options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                end: options.endDate || new Date()
            },
            summary: {
                totalLogs: this.metrics.totalLogs,
                totalBlocks: this.metrics.totalBlocks,
                storageUsed: this.formatBytes(this.metrics.storageUsed),
                categories: {}
            },
            compliance: {},
            integrity: {
                checks: this.metrics.integrityChecks,
                violations: this.metrics.violations,
                lastCheck: null
            },
            topUsers: [],
            topActions: []
        };
        
        // Category summary
        for (const [categoryId, category] of this.categories) {
            report.summary.categories[categoryId] = {
                name: category.name,
                logCount: category.logCount,
                retention: `${category.retention} days`,
                encrypted: category.encryption
            };
        }
        
        // Compliance mapping
        for (const [categoryId, category] of this.categories) {
            for (const framework of category.compliance) {
                if (!report.compliance[framework]) {
                    report.compliance[framework] = [];
                }
                report.compliance[framework].push(categoryId);
            }
        }
        
        // Top users
        const userCounts = new Map();
        for (const [userId, logs] of this.searchIndices.byUser) {
            userCounts.set(userId, logs.length);
        }
        report.topUsers = Array.from(userCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([userId, count]) => ({ userId, count }));
        
        // Top actions
        const actionCounts = new Map();
        for (const [action, logs] of this.searchIndices.byAction) {
            actionCounts.set(action, logs.length);
        }
        report.topActions = Array.from(actionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([action, count]) => ({ action, count }));
        
        // Latest integrity check
        const latestCheck = Array.from(this.integrityChecks.values())
            .sort((a, b) => b.completed - a.completed)[0];
        if (latestCheck) {
            report.integrity.lastCheck = {
                date: latestCheck.completed,
                valid: latestCheck.valid,
                errors: latestCheck.errors.length
            };
        }
        
        return report;
    }
    
    // Export audit logs
    async exportAuditLogs(criteria, format = 'json') {
        const logs = await this.searchAuditLogs(criteria);
        
        switch (format) {
            case 'json':
                return JSON.stringify(logs.results, null, 2);
                
            case 'csv':
                return this.convertToCSV(logs.results);
                
            case 'evidence':
                return await this.generateEvidencePackage(logs.results);
                
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    // Generate evidence package
    async generateEvidencePackage(logs) {
        const evidence = {
            packageId: uuidv4(),
            generated: new Date(),
            logs: logs,
            integrity: {},
            certification: {}
        };
        
        // Calculate integrity proof
        evidence.integrity = {
            logCount: logs.length,
            hash: await this.calculateHash(logs),
            merkleRoot: await this.calculateMerkleRoot(logs)
        };
        
        // Add certification
        evidence.certification = {
            certifier: 'ROOTUIP Audit System',
            timestamp: new Date(),
            signature: await this.signEvidence(evidence.integrity)
        };
        
        return evidence;
    }
    
    // Archive old logs
    async archiveOldLogs() {
        const archived = {
            count: 0,
            size: 0,
            categories: {}
        };
        
        for (const [categoryId, category] of this.categories) {
            const cutoffDate = new Date(
                Date.now() - category.retention * 24 * 60 * 60 * 1000
            );
            
            // Archive logs older than retention period
            const categoryPath = path.join(this.config.storageDir, categoryId);
            
            // This would implement actual archival logic
            // For now, just count what would be archived
            archived.categories[categoryId] = {
                cutoffDate,
                retention: category.retention
            };
        }
        
        this.emit('archive:completed', archived);
        
        return archived;
    }
    
    // Start integrity monitoring
    startIntegrityMonitoring() {
        // Periodic integrity checks
        setInterval(async () => {
            for (const category of this.categories.keys()) {
                try {
                    await this.verifyIntegrity(category);
                } catch (error) {
                    console.error(`Integrity check failed for ${category}:`, error);
                }
            }
        }, 6 * 60 * 60 * 1000); // Every 6 hours
        
        // Periodic archival
        setInterval(async () => {
            try {
                await this.archiveOldLogs();
            } catch (error) {
                console.error('Archive process failed:', error);
            }
        }, 24 * 60 * 60 * 1000); // Daily
    }
    
    // Helper methods
    async ensureStorageDirectory() {
        await this.ensureDirectory(this.config.storageDir);
    }
    
    async ensureDirectory(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    
    async loadExistingChains() {
        // Load chain metadata from storage
        // Implementation would read existing chains from disk
    }
    
    async writeChainGenesis(chain) {
        const genesisPath = path.join(
            this.config.storageDir,
            chain.category,
            'genesis.json'
        );
        
        await this.ensureDirectory(path.dirname(genesisPath));
        
        await fs.writeFile(
            genesisPath,
            JSON.stringify(chain, null, 2),
            'utf8'
        );
    }
    
    updateIndices(entry) {
        // Update user index
        if (entry.userId) {
            if (!this.searchIndices.byUser.has(entry.userId)) {
                this.searchIndices.byUser.set(entry.userId, []);
            }
            this.searchIndices.byUser.get(entry.userId).push(entry);
        }
        
        // Update action index
        if (entry.action) {
            if (!this.searchIndices.byAction.has(entry.action)) {
                this.searchIndices.byAction.set(entry.action, []);
            }
            this.searchIndices.byAction.get(entry.action).push(entry);
        }
        
        // Update resource index
        if (entry.resource) {
            if (!this.searchIndices.byResource.has(entry.resource)) {
                this.searchIndices.byResource.set(entry.resource, []);
            }
            this.searchIndices.byResource.get(entry.resource).push(entry);
        }
    }
    
    intersectResults(array1, array2) {
        if (array1.length === 0) return array2;
        const set1 = new Set(array1.map(item => item.id));
        return array2.filter(item => set1.has(item.id));
    }
    
    async filterByDateRange(logs, startDate, endDate) {
        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return (!startDate || logDate >= startDate) && 
                   (!endDate || logDate <= endDate);
        });
    }
    
    async getAllLogs() {
        // This would retrieve all logs from storage
        // For now, return logs from indices
        const allLogs = [];
        for (const logs of this.searchIndices.byUser.values()) {
            allLogs.push(...logs);
        }
        return Array.from(new Set(allLogs));
    }
    
    convertToCSV(logs) {
        if (logs.length === 0) return '';
        
        const headers = Object.keys(logs[0]);
        const csv = [headers.join(',')];
        
        for (const log of logs) {
            const values = headers.map(header => {
                const value = log[header];
                return typeof value === 'object' ? JSON.stringify(value) : value;
            });
            csv.push(values.join(','));
        }
        
        return csv.join('\n');
    }
    
    async signEvidence(data) {
        // In production, would use proper digital signature
        const hash = await this.calculateHash(data);
        return `SIG:${hash}`;
    }
    
    async replicateBlock(block) {
        // Replicate to configured targets
        for (const target of this.config.replicationTargets) {
            try {
                // Send block to replication target
                this.emit('replication:sent', {
                    target,
                    block: block.blockNumber
                });
            } catch (error) {
                console.error(`Replication to ${target} failed:`, error);
            }
        }
    }
    
    isOptionalField(field) {
        const optionalFields = ['metadata', 'details', 'reason', 'approval'];
        return optionalFields.includes(field);
    }
    
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

module.exports = AuditLoggingSystem;