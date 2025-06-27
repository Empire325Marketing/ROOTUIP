// Blockchain Document Verification System
// Uses cryptographic hashing to ensure document integrity

class BlockchainDocumentVerification {
    constructor() {
        this.chain = [];
        this.pendingDocuments = [];
        this.currentNodeUrl = 'https://app.rootuip.com';
        this.networkNodes = [];
        this.createGenesisBlock();
    }

    createGenesisBlock() {
        const genesisBlock = {
            index: 1,
            timestamp: Date.now(),
            documents: [],
            nonce: 100,
            hash: '0',
            previousBlockHash: '0'
        };
        this.chain.push(genesisBlock);
    }

    createNewBlock(nonce, previousBlockHash, hash) {
        const newBlock = {
            index: this.chain.length + 1,
            timestamp: Date.now(),
            documents: this.pendingDocuments,
            nonce: nonce,
            hash: hash,
            previousBlockHash: previousBlockHash
        };

        this.pendingDocuments = [];
        this.chain.push(newBlock);
        return newBlock;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    createNewDocument(documentData) {
        const newDocument = {
            id: this.generateDocumentId(),
            timestamp: Date.now(),
            type: documentData.type,
            hash: this.hashDocument(documentData),
            metadata: {
                fileName: documentData.fileName,
                fileSize: documentData.fileSize,
                mimeType: documentData.mimeType,
                uploadedBy: documentData.uploadedBy,
                company: documentData.company,
                shipmentId: documentData.shipmentId,
                documentCategory: documentData.category // BL, Invoice, Packing List, etc.
            },
            verificationHistory: [],
            signatures: []
        };

        return newDocument;
    }

    addDocumentToChain(documentData) {
        const newDocument = this.createNewDocument(documentData);
        this.pendingDocuments.push(newDocument);
        
        // Trigger block creation if threshold reached
        if (this.pendingDocuments.length >= 10) {
            this.mineBlock();
        }
        
        return newDocument;
    }

    hashDocument(documentData) {
        // Simulate SHA-256 hashing
        const dataString = JSON.stringify({
            content: documentData.content,
            fileName: documentData.fileName,
            timestamp: Date.now()
        });
        
        // Simple hash simulation (in production, use crypto library)
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'DOC' + Math.abs(hash).toString(16).toUpperCase().padStart(64, '0');
    }

    hashBlock(previousBlockHash, currentBlockData, nonce) {
        const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        let hash = 0;
        for (let i = 0; i < dataAsString.length; i++) {
            const char = dataAsString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).toUpperCase().padStart(64, '0');
    }

    proofOfWork(previousBlockHash, currentBlockData) {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        while (hash.substring(0, 4) !== '0000') {
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }
        return nonce;
    }

    mineBlock() {
        const lastBlock = this.getLastBlock();
        const previousBlockHash = lastBlock.hash;
        const currentBlockData = {
            documents: this.pendingDocuments,
            index: lastBlock.index + 1
        };
        const nonce = this.proofOfWork(previousBlockHash, currentBlockData);
        const blockHash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        const newBlock = this.createNewBlock(nonce, previousBlockHash, blockHash);
        
        return newBlock;
    }

    verifyDocument(documentId, documentContent) {
        // Search for document in the blockchain
        for (const block of this.chain) {
            for (const doc of block.documents) {
                if (doc.id === documentId) {
                    const currentHash = this.hashDocument({
                        content: documentContent,
                        fileName: doc.metadata.fileName
                    });
                    
                    const verification = {
                        timestamp: Date.now(),
                        valid: currentHash === doc.hash,
                        originalHash: doc.hash,
                        currentHash: currentHash,
                        block: {
                            index: block.index,
                            timestamp: block.timestamp,
                            hash: block.hash
                        }
                    };
                    
                    doc.verificationHistory.push(verification);
                    return verification;
                }
            }
        }
        
        return {
            valid: false,
            error: 'Document not found in blockchain'
        };
    }

    generateDocumentId() {
        return 'DOC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    getDocumentHistory(documentId) {
        for (const block of this.chain) {
            for (const doc of block.documents) {
                if (doc.id === documentId) {
                    return {
                        document: doc,
                        block: {
                            index: block.index,
                            timestamp: block.timestamp,
                            hash: block.hash
                        },
                        verifications: doc.verificationHistory
                    };
                }
            }
        }
        return null;
    }

    addDigitalSignature(documentId, signature) {
        for (const block of this.chain) {
            for (const doc of block.documents) {
                if (doc.id === documentId) {
                    doc.signatures.push({
                        timestamp: Date.now(),
                        signer: signature.signer,
                        publicKey: signature.publicKey,
                        signature: signature.signature,
                        role: signature.role // e.g., 'shipper', 'carrier', 'consignee'
                    });
                    return true;
                }
            }
        }
        return false;
    }

    validateChain() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Validate current block's hash
            const blockHash = this.hashBlock(
                previousBlock.hash,
                { documents: currentBlock.documents, index: currentBlock.index },
                currentBlock.nonce
            );

            if (blockHash !== currentBlock.hash) {
                return false;
            }

            // Validate previous block hash reference
            if (currentBlock.previousBlockHash !== previousBlock.hash) {
                return false;
            }

            // Validate proof of work
            if (blockHash.substring(0, 4) !== '0000') {
                return false;
            }
        }

        return true;
    }

    getChainInfo() {
        return {
            length: this.chain.length,
            totalDocuments: this.chain.reduce((total, block) => total + block.documents.length, 0),
            pendingDocuments: this.pendingDocuments.length,
            isValid: this.validateChain(),
            lastBlock: this.getLastBlock()
        };
    }
}

// Document Types for Shipping
const DocumentTypes = {
    BILL_OF_LADING: 'bill_of_lading',
    COMMERCIAL_INVOICE: 'commercial_invoice',
    PACKING_LIST: 'packing_list',
    CERTIFICATE_OF_ORIGIN: 'certificate_of_origin',
    INSURANCE_CERTIFICATE: 'insurance_certificate',
    CUSTOMS_DECLARATION: 'customs_declaration',
    DANGEROUS_GOODS_DECLARATION: 'dangerous_goods_declaration',
    PHYTOSANITARY_CERTIFICATE: 'phytosanitary_certificate',
    FUMIGATION_CERTIFICATE: 'fumigation_certificate',
    WEIGHT_CERTIFICATE: 'weight_certificate'
};

// Smart Contract Simulator for Document Rules
class DocumentSmartContract {
    constructor() {
        this.rules = this.initializeRules();
    }

    initializeRules() {
        return {
            bill_of_lading: {
                required_fields: ['shipper', 'consignee', 'vessel', 'port_of_loading', 'port_of_discharge'],
                required_signatures: ['shipper', 'carrier'],
                auto_release_conditions: ['payment_confirmed', 'customs_cleared']
            },
            commercial_invoice: {
                required_fields: ['seller', 'buyer', 'items', 'total_value', 'currency'],
                required_signatures: ['seller'],
                validation_rules: ['total_calculation_match', 'currency_valid']
            },
            letter_of_credit: {
                required_fields: ['issuing_bank', 'beneficiary', 'amount', 'expiry_date'],
                required_signatures: ['issuing_bank', 'beneficiary'],
                auto_triggers: ['payment_on_document_presentation']
            }
        };
    }

    validateDocument(documentType, documentData) {
        const rules = this.rules[documentType];
        if (!rules) return { valid: false, errors: ['Unknown document type'] };

        const errors = [];
        
        // Check required fields
        for (const field of rules.required_fields) {
            if (!documentData[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        // Additional validations based on document type
        if (documentType === 'commercial_invoice') {
            if (documentData.items && documentData.total_value) {
                const calculatedTotal = documentData.items.reduce((sum, item) => 
                    sum + (item.quantity * item.unit_price), 0
                );
                if (Math.abs(calculatedTotal - documentData.total_value) > 0.01) {
                    errors.push('Total value does not match item calculations');
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            timestamp: Date.now()
        };
    }

    executeAutoRelease(documentType, conditions) {
        const rules = this.rules[documentType];
        if (!rules || !rules.auto_release_conditions) return false;

        const metConditions = rules.auto_release_conditions.filter(condition => 
            conditions.includes(condition)
        );

        return metConditions.length === rules.auto_release_conditions.length;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BlockchainDocumentVerification,
        DocumentTypes,
        DocumentSmartContract
    };
}