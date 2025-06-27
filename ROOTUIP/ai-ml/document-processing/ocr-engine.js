/**
 * OCR Processing Engine
 * Simulates intelligent document processing with ML capabilities
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// Document types and their characteristics
const DOCUMENT_TYPES = {
    BILL_OF_LADING: {
        name: 'Bill of Lading',
        confidence: 0.95,
        keywords: ['bill of lading', 'shipper', 'consignee', 'vessel', 'port of loading'],
        entities: ['booking_number', 'container_numbers', 'shipper', 'consignee', 'vessel', 'voyage', 'ports']
    },
    ARRIVAL_NOTICE: {
        name: 'Arrival Notice',
        confidence: 0.93,
        keywords: ['arrival notice', 'eta', 'free time', 'demurrage', 'terminal'],
        entities: ['arrival_date', 'free_time_expiry', 'terminal', 'charges', 'container_numbers']
    },
    INVOICE: {
        name: 'Invoice',
        confidence: 0.96,
        keywords: ['invoice', 'amount due', 'charges', 'payment terms'],
        entities: ['invoice_number', 'amount', 'due_date', 'line_items', 'container_numbers']
    },
    DELIVERY_ORDER: {
        name: 'Delivery Order',
        confidence: 0.94,
        keywords: ['delivery order', 'release', 'pickup', 'authorized'],
        entities: ['release_number', 'container_numbers', 'pickup_location', 'validity_date']
    },
    CUSTOMS_CLEARANCE: {
        name: 'Customs Clearance',
        confidence: 0.92,
        keywords: ['customs', 'clearance', 'duty', 'hs code', 'declaration'],
        entities: ['declaration_number', 'hs_codes', 'duty_amount', 'clearance_date']
    }
};

// Entity patterns for extraction
const ENTITY_PATTERNS = {
    booking_number: /\b(BKG|BOOK|BK)[A-Z0-9]{8,12}\b/gi,
    container_number: /\b[A-Z]{4}\d{7}\b/g,
    invoice_number: /\b(INV|INVOICE)[-\s]?[A-Z0-9]{6,12}\b/gi,
    amount: /(?:USD|EUR|GBP)?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    date: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,
    vessel_name: /(?:vessel|ship|v\/v)[\s:]+([A-Z][A-Z\s]+[A-Z])/gi,
    port_code: /\b[A-Z]{5}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g
};

class OCREngine extends EventEmitter {
    constructor() {
        super();
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Simulated GPU processing capabilities
        this.gpuConfig = {
            enabled: true,
            model: 'NVIDIA Tesla V100',
            memory: '32GB',
            cores: 5120,
            speedMultiplier: 10 // 10x faster than CPU
        };
        
        // Processing statistics
        this.stats = {
            totalProcessed: 0,
            totalTime: 0,
            avgConfidence: 0,
            successRate: 0
        };
    }

    // Process document with OCR
    async processDocument(documentData) {
        const startTime = Date.now();
        const documentId = crypto.randomUUID();
        
        this.emit('processing_started', { documentId, timestamp: new Date() });
        
        try {
            // Step 1: Pre-processing
            const preprocessed = await this.preprocessDocument(documentData);
            
            // Step 2: Text extraction (OCR simulation)
            const ocrResult = await this.performOCR(preprocessed);
            
            // Step 3: Document classification
            const classification = await this.classifyDocument(ocrResult.text);
            
            // Step 4: Entity extraction
            const entities = await this.extractEntities(ocrResult.text, classification.type);
            
            // Step 5: Quality assessment
            const quality = this.assessQuality(ocrResult, classification, entities);
            
            // Step 6: Post-processing
            const finalResult = await this.postProcess({
                documentId,
                ...ocrResult,
                classification,
                entities,
                quality,
                processingTime: Date.now() - startTime,
                gpuAccelerated: this.gpuConfig.enabled
            });
            
            this.updateStats(finalResult);
            this.emit('processing_completed', finalResult);
            
            return finalResult;
            
        } catch (error) {
            this.emit('processing_error', { documentId, error: error.message });
            throw error;
        }
    }

    // Pre-process document
    async preprocessDocument(documentData) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate image preprocessing
                const preprocessed = {
                    ...documentData,
                    enhanced: true,
                    deskewed: true,
                    denoised: true,
                    resolution: '300dpi',
                    colorMode: 'grayscale'
                };
                
                this.emit('preprocessing_complete', {
                    enhancements: ['contrast_adjustment', 'noise_reduction', 'skew_correction'],
                    improvement: '+23%'
                });
                
                resolve(preprocessed);
            }, this.gpuConfig.enabled ? 50 : 500);
        });
    }

    // Perform OCR (simulated)
    async performOCR(preprocessedData) {
        return new Promise((resolve) => {
            const processingTime = this.gpuConfig.enabled ? 200 : 2000;
            
            setTimeout(() => {
                // Generate realistic OCR output
                const text = this.generateRealisticText(preprocessedData.type);
                const confidence = this.calculateConfidence(text);
                
                const result = {
                    text,
                    confidence,
                    pages: 1,
                    words: text.split(/\s+/).length,
                    characters: text.length,
                    regions: this.detectTextRegions(text),
                    processingEngine: this.gpuConfig.enabled ? 'GPU-Accelerated' : 'CPU'
                };
                
                this.emit('ocr_complete', {
                    confidence: confidence,
                    words: result.words,
                    time: processingTime
                });
                
                resolve(result);
            }, processingTime);
        });
    }

    // Generate realistic document text
    generateRealisticText(documentType) {
        const templates = {
            bill_of_lading: `
BILL OF LADING
Booking Number: BKG20240125001
Shipper: Global Electronics Inc.
         1234 Tech Boulevard, San Jose, CA 95110
         Tel: +1-408-555-0100
Consignee: European Distribution Center
          Rotterdamseweg 380, 3199 LM Rotterdam, Netherlands
          Tel: +31-10-555-0200
          
Vessel: MAERSK EMMA    Voyage: V124W
Port of Loading: USLAX - Los Angeles, CA
Port of Discharge: NLRTM - Rotterdam, Netherlands
ETD: 2024-01-25    ETA: 2024-02-15

Container Details:
MAEU1234567 - 40'HC - Electronics - 24,500 kg
MAEU2345678 - 40'HC - Electronics - 23,800 kg
MAEU3456789 - 40'HC - Electronics - 25,200 kg

Special Instructions: Temperature controlled storage required
Free Time: 5 days after discharge
            `,
            arrival_notice: `
ARRIVAL NOTICE

To: Global Logistics Solutions
Date: ${new Date().toISOString().split('T')[0]}

Container(s): MSCU7654321, MSCU8765432
Vessel: MSC OSCAR    Voyage: 245E
Arrived: ${new Date().toISOString().split('T')[0]}
Terminal: APM Terminal, Pier 400, Los Angeles

IMPORTANT DATES:
Last Free Day: ${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
Demurrage Rate: USD 150.00 per day thereafter
Storage Charges: USD 75.00 per day after 10 days

Please arrange pickup promptly to avoid charges.
Terminal Hours: Mon-Fri 0700-1700, Sat 0800-1200
            `,
            invoice: `
INVOICE
Invoice No: INV-2024-00847
Date: ${new Date().toISOString().split('T')[0]}
Due Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

Bill To: Pacific Shipping Corporation
        456 Harbor Drive, Long Beach, CA 90802

Container: HLCU9876543
Services Rendered:

Demurrage Charges (15 days @ $175/day): $2,625.00
Detention Charges (8 days @ $125/day): $1,000.00
Terminal Handling: $450.00
Documentation Fee: $75.00

Subtotal: $4,150.00
Tax (8.25%): $342.38
TOTAL DUE: $4,492.38

Payment Terms: Net 30
            `
        };
        
        return templates[documentType] || templates.bill_of_lading;
    }

    // Calculate OCR confidence
    calculateConfidence(text) {
        // Simulate confidence based on text characteristics
        let confidence = 0.85;
        
        // Boost confidence for clear patterns
        if (text.match(/[A-Z]{4}\d{7}/g)) confidence += 0.05; // Container numbers
        if (text.match(/\b\d{4}-\d{2}-\d{2}\b/g)) confidence += 0.03; // Dates
        if (text.match(/USD\s*\d+/g)) confidence += 0.02; // Amounts
        
        // Add some realistic variance
        confidence += (Math.random() - 0.5) * 0.1;
        
        return Math.max(0.7, Math.min(0.99, confidence));
    }

    // Detect text regions
    detectTextRegions(text) {
        const lines = text.split('\n');
        const regions = [];
        
        let currentRegion = null;
        lines.forEach((line, index) => {
            if (line.trim()) {
                if (!currentRegion) {
                    currentRegion = {
                        startLine: index,
                        lines: []
                    };
                }
                currentRegion.lines.push(line);
            } else if (currentRegion) {
                currentRegion.endLine = index - 1;
                regions.push(currentRegion);
                currentRegion = null;
            }
        });
        
        return regions.map((region, idx) => ({
            id: `region_${idx}`,
            bounds: {
                top: region.startLine * 20,
                left: 50,
                width: 500,
                height: region.lines.length * 20
            },
            confidence: 0.85 + Math.random() * 0.14,
            text: region.lines.join('\n')
        }));
    }

    // Classify document
    async classifyDocument(text) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const scores = {};
                
                // Calculate classification scores
                Object.entries(DOCUMENT_TYPES).forEach(([type, config]) => {
                    let score = 0;
                    
                    // Check for keywords
                    config.keywords.forEach(keyword => {
                        if (text.toLowerCase().includes(keyword)) {
                            score += 0.2;
                        }
                    });
                    
                    // Check for specific patterns
                    if (type === 'BILL_OF_LADING' && text.match(/shipper.*consignee/is)) {
                        score += 0.3;
                    }
                    if (type === 'INVOICE' && text.match(/invoice.*total.*due/is)) {
                        score += 0.3;
                    }
                    
                    scores[type] = Math.min(score, config.confidence);
                });
                
                // Find best match
                const bestMatch = Object.entries(scores).reduce((a, b) => 
                    a[1] > b[1] ? a : b
                );
                
                const result = {
                    type: bestMatch[0],
                    confidence: bestMatch[1],
                    scores: scores,
                    name: DOCUMENT_TYPES[bestMatch[0]].name
                };
                
                this.emit('classification_complete', result);
                resolve(result);
                
            }, this.gpuConfig.enabled ? 100 : 1000);
        });
    }

    // Extract entities
    async extractEntities(text, documentType) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const entities = {};
                const config = DOCUMENT_TYPES[documentType];
                
                if (!config) {
                    resolve(entities);
                    return;
                }
                
                // Extract based on document type
                config.entities.forEach(entityType => {
                    const pattern = ENTITY_PATTERNS[entityType];
                    if (pattern) {
                        const matches = text.match(pattern);
                        if (matches) {
                            entities[entityType] = {
                                values: [...new Set(matches)],
                                confidence: 0.85 + Math.random() * 0.14,
                                pattern: pattern.toString()
                            };
                        }
                    }
                });
                
                // Extract amounts with context
                const amountMatches = text.match(/(?:USD|EUR|GBP)?\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
                if (amountMatches) {
                    entities.amounts = amountMatches.map(amount => {
                        const context = this.getAmountContext(text, amount);
                        return {
                            value: amount,
                            numeric: parseFloat(amount.replace(/[^0-9.-]/g, '')),
                            context: context,
                            type: this.classifyAmount(context)
                        };
                    });
                }
                
                this.emit('extraction_complete', {
                    entityCount: Object.keys(entities).length,
                    documentType: documentType
                });
                
                resolve(entities);
                
            }, this.gpuConfig.enabled ? 150 : 1500);
        });
    }

    // Get context around amount
    getAmountContext(text, amount) {
        const index = text.indexOf(amount);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + amount.length + 50);
        return text.substring(start, end).trim();
    }

    // Classify amount type
    classifyAmount(context) {
        const lowerContext = context.toLowerCase();
        if (lowerContext.includes('demurrage')) return 'demurrage';
        if (lowerContext.includes('detention')) return 'detention';
        if (lowerContext.includes('total')) return 'total';
        if (lowerContext.includes('tax')) return 'tax';
        if (lowerContext.includes('fee')) return 'fee';
        return 'other';
    }

    // Assess quality
    assessQuality(ocrResult, classification, entities) {
        const metrics = {
            textQuality: ocrResult.confidence,
            classificationConfidence: classification.confidence,
            entityCompleteness: this.calculateEntityCompleteness(entities, classification.type),
            overallScore: 0
        };
        
        // Calculate overall score
        metrics.overallScore = (
            metrics.textQuality * 0.4 +
            metrics.classificationConfidence * 0.3 +
            metrics.entityCompleteness * 0.3
        );
        
        // Determine quality level
        if (metrics.overallScore >= 0.9) metrics.level = 'excellent';
        else if (metrics.overallScore >= 0.8) metrics.level = 'good';
        else if (metrics.overallScore >= 0.7) metrics.level = 'fair';
        else metrics.level = 'poor';
        
        return metrics;
    }

    // Calculate entity completeness
    calculateEntityCompleteness(entities, documentType) {
        const config = DOCUMENT_TYPES[documentType];
        if (!config) return 0;
        
        const requiredEntities = config.entities;
        const foundEntities = Object.keys(entities);
        
        return foundEntities.length / requiredEntities.length;
    }

    // Post-process results
    async postProcess(result) {
        // Add business logic insights
        result.insights = [];
        
        // Check for D&D risks
        if (result.entities.free_time_expiry) {
            const freeTimeDate = new Date(result.entities.free_time_expiry.values[0]);
            const daysUntilExpiry = Math.floor((freeTimeDate - new Date()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 2) {
                result.insights.push({
                    type: 'warning',
                    category: 'demurrage_risk',
                    message: `Free time expires in ${daysUntilExpiry} days`,
                    severity: 'high'
                });
            }
        }
        
        // Check for high charges
        if (result.entities.amounts) {
            const highCharges = result.entities.amounts.filter(a => a.numeric > 1000);
            if (highCharges.length > 0) {
                result.insights.push({
                    type: 'alert',
                    category: 'high_charges',
                    message: `${highCharges.length} charges over $1,000 detected`,
                    severity: 'medium'
                });
            }
        }
        
        return result;
    }

    // Update processing statistics
    updateStats(result) {
        this.stats.totalProcessed++;
        this.stats.totalTime += result.processingTime;
        
        const prevAvg = this.stats.avgConfidence;
        this.stats.avgConfidence = (prevAvg * (this.stats.totalProcessed - 1) + result.confidence) / this.stats.totalProcessed;
        
        if (result.quality.overallScore >= 0.8) {
            this.stats.successRate = ((this.stats.successRate * (this.stats.totalProcessed - 1)) + 1) / this.stats.totalProcessed;
        } else {
            this.stats.successRate = (this.stats.successRate * (this.stats.totalProcessed - 1)) / this.stats.totalProcessed;
        }
    }

    // Get processing statistics
    getStats() {
        return {
            ...this.stats,
            avgProcessingTime: this.stats.totalTime / this.stats.totalProcessed || 0,
            gpuEnabled: this.gpuConfig.enabled,
            gpuSpeedup: this.gpuConfig.enabled ? `${this.gpuConfig.speedMultiplier}x` : 'N/A'
        };
    }

    // Toggle GPU acceleration
    toggleGPU(enabled) {
        this.gpuConfig.enabled = enabled;
        this.emit('gpu_toggled', { enabled });
    }
}

module.exports = OCREngine;