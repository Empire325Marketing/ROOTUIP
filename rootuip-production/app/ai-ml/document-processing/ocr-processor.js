// ROOTUIP AI/ML - OCR Document Processing System
// Advanced document processing with Tesseract.js and ML classification

const Tesseract = require('tesseract.js');
const fs = require('fs').promises;
const path = require('path');

class OCRProcessor {
    constructor(config) {
        this.config = config || {};
        this.workers = new Map();
        this.maxWorkers = config.maxWorkers || 4;
        this.documentClassifier = new DocumentClassifier();
        this.dataExtractor = new BOLDataExtractor();
        this.confidenceThreshold = config.confidenceThreshold || 0.7;
        
        this.initializeWorkers();
    }

    async initializeWorkers() {
        console.log('[OCRProcessor] Initializing Tesseract workers...');
        
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`[OCR Worker ${i}] Progress: ${(m.progress * 100).toFixed(1)}%`);
                    }
                }
            });
            
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            await worker.setParameters({
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/-:()[]',
                tessedit_pageseg_mode: Tesseract.PSM.AUTO
            });
            
            this.workers.set(`worker_${i}`, {
                worker: worker,
                busy: false,
                lastUsed: Date.now()
            });
        }
        
        console.log(`[OCRProcessor] Initialized ${this.maxWorkers} OCR workers`);
    }

    async processDocument(documentBuffer, filename, options = {}) {
        const startTime = Date.now();
        
        try {
            const result = {
                documentId: this.generateDocumentId(),
                filename: filename,
                processedAt: new Date().toISOString(),
                status: 'processing',
                classification: null,
                extractedData: null,
                confidence: {
                    ocr: 0,
                    classification: 0,
                    extraction: 0,
                    overall: 0
                },
                performance: {
                    processingTime: 0,
                    ocrTime: 0,
                    classificationTime: 0,
                    extractionTime: 0
                },
                beforeAfter: {
                    originalText: '',
                    processedText: '',
                    improvements: []
                }
            };

            // Step 1: OCR Processing
            console.log(`[OCRProcessor] Starting OCR for document: ${filename}`);
            const ocrStart = Date.now();
            
            const ocrResult = await this.performOCR(documentBuffer, options);
            result.beforeAfter.originalText = ocrResult.text;
            result.confidence.ocr = ocrResult.confidence;
            
            result.performance.ocrTime = Date.now() - ocrStart;

            // Step 2: Document Classification
            console.log('[OCRProcessor] Classifying document type...');
            const classStart = Date.now();
            
            const classification = await this.documentClassifier.classify(ocrResult.text, filename);
            result.classification = classification;
            result.confidence.classification = classification.confidence;
            
            result.performance.classificationTime = Date.now() - classStart;

            // Step 3: Data Extraction based on document type
            console.log(`[OCRProcessor] Extracting data for ${classification.type}...`);
            const extractStart = Date.now();
            
            result.extractedData = await this.extractDataByType(
                ocrResult.text, 
                classification.type, 
                options
            );
            result.confidence.extraction = result.extractedData.confidence;
            
            result.performance.extractionTime = Date.now() - extractStart;

            // Step 4: Text Enhancement and Corrections
            result.beforeAfter.processedText = await this.enhanceText(ocrResult.text, classification.type);
            result.beforeAfter.improvements = this.identifyImprovements(
                result.beforeAfter.originalText,
                result.beforeAfter.processedText
            );

            // Calculate overall confidence and performance
            result.confidence.overall = this.calculateOverallConfidence(result.confidence);
            result.performance.processingTime = Date.now() - startTime;
            result.status = 'completed';

            console.log(`[OCRProcessor] Document processed successfully in ${result.performance.processingTime}ms`);
            return result;

        } catch (error) {
            console.error('[OCRProcessor] Document processing failed:', error);
            throw new Error(`Document processing failed: ${error.message}`);
        }
    }

    async performOCR(documentBuffer, options = {}) {
        const worker = await this.getAvailableWorker();
        
        try {
            worker.busy = true;
            
            const { data } = await worker.worker.recognize(documentBuffer, {
                rectangle: options.cropArea || undefined
            });

            // Calculate confidence from word-level data
            const confidence = this.calculateOCRConfidence(data);

            worker.busy = false;
            worker.lastUsed = Date.now();

            return {
                text: data.text,
                confidence: confidence,
                words: data.words,
                blocks: data.blocks,
                symbols: data.symbols
            };

        } catch (error) {
            worker.busy = false;
            throw error;
        }
    }

    async extractDataByType(text, documentType, options = {}) {
        switch (documentType) {
            case 'BILL_OF_LADING':
                return await this.dataExtractor.extractBOLData(text);
            case 'COMMERCIAL_INVOICE':
                return await this.dataExtractor.extractInvoiceData(text);
            case 'PACKING_LIST':
                return await this.dataExtractor.extractPackingListData(text);
            case 'CERTIFICATE_OF_ORIGIN':
                return await this.dataExtractor.extractCOOData(text);
            case 'CUSTOMS_DECLARATION':
                return await this.dataExtractor.extractCustomsData(text);
            default:
                return await this.dataExtractor.extractGenericData(text);
        }
    }

    async enhanceText(originalText, documentType) {
        // Apply document-specific text enhancements
        let enhancedText = originalText;

        // Common corrections
        enhancedText = this.applyCommonCorrections(enhancedText);

        // Document-specific corrections
        switch (documentType) {
            case 'BILL_OF_LADING':
                enhancedText = this.applyBOLCorrections(enhancedText);
                break;
            case 'COMMERCIAL_INVOICE':
                enhancedText = this.applyInvoiceCorrections(enhancedText);
                break;
        }

        return enhancedText;
    }

    applyCommonCorrections(text) {
        let corrected = text;

        // Common OCR corrections
        const corrections = [
            [/(\d)\s+(\d)/g, '$1$2'], // Remove spaces in numbers
            [/([A-Z])\s+([A-Z]{2,})/g, '$1$2'], // Fix spaced uppercase abbreviations
            [/\b0\b/g, 'O'], // Replace standalone 0s with Os in text contexts
            [/\bO\b/g, '0'], // Replace standalone Os with 0s in numeric contexts
            [/([A-Z]{2,4})\s*(\d{6,})/g, '$1$2'], // Fix container number spacing
            [/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g, '$1/$2/$3'], // Standardize dates
            [/\$\s*(\d)/g, '$$$1'], // Fix currency formatting
        ];

        corrections.forEach(([pattern, replacement]) => {
            corrected = corrected.replace(pattern, replacement);
        });

        return corrected;
    }

    applyBOLCorrections(text) {
        let corrected = text;

        // BOL-specific corrections
        const bolCorrections = [
            [/CONTAINER\s*NO?\s*[:.]?\s*([A-Z]{4}\s*\d{7})/gi, 'CONTAINER NO: $1'],
            [/BOOKING\s*NO?\s*[:.]?\s*([A-Z0-9]{8,})/gi, 'BOOKING NO: $1'],
            [/SHIPPER\s*[:.]?\s*/gi, 'SHIPPER: '],
            [/CONSIGNEE\s*[:.]?\s*/gi, 'CONSIGNEE: '],
            [/NOTIFY\s*PARTY\s*[:.]?\s*/gi, 'NOTIFY PARTY: '],
            [/VESSEL\s*[:.]?\s*/gi, 'VESSEL: '],
            [/VOYAGE\s*[:.]?\s*/gi, 'VOYAGE: '],
        ];

        bolCorrections.forEach(([pattern, replacement]) => {
            corrected = corrected.replace(pattern, replacement);
        });

        return corrected;
    }

    applyInvoiceCorrections(text) {
        let corrected = text;

        // Invoice-specific corrections
        const invoiceCorrections = [
            [/INVOICE\s*NO?\s*[:.]?\s*([A-Z0-9-]+)/gi, 'INVOICE NO: $1'],
            [/DATE\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi, 'DATE: $1'],
            [/TOTAL\s*[:.]?\s*\$?\s*(\d+\.?\d*)/gi, 'TOTAL: $$$1'],
            [/QTY\s*[:.]?\s*(\d+)/gi, 'QTY: $1'],
        ];

        invoiceCorrections.forEach(([pattern, replacement]) => {
            corrected = corrected.replace(pattern, replacement);
        });

        return corrected;
    }

    identifyImprovements(originalText, processedText) {
        const improvements = [];
        
        // Compare texts and identify specific improvements
        if (originalText.length !== processedText.length) {
            improvements.push({
                type: 'LENGTH_NORMALIZATION',
                description: 'Text length normalized through spacing corrections',
                impact: Math.abs(originalText.length - processedText.length)
            });
        }

        // Count specific pattern improvements
        const containerMatches = processedText.match(/[A-Z]{4}\d{7}/g) || [];
        if (containerMatches.length > 0) {
            improvements.push({
                type: 'CONTAINER_NUMBER_FORMAT',
                description: `Standardized ${containerMatches.length} container number(s)`,
                impact: containerMatches.length
            });
        }

        const dateMatches = processedText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || [];
        if (dateMatches.length > 0) {
            improvements.push({
                type: 'DATE_FORMAT',
                description: `Standardized ${dateMatches.length} date(s)`,
                impact: dateMatches.length
            });
        }

        return improvements;
    }

    calculateOCRConfidence(data) {
        if (!data.words || data.words.length === 0) return 0;

        const wordConfidences = data.words.map(word => word.confidence);
        const averageConfidence = wordConfidences.reduce((sum, conf) => sum + conf, 0) / wordConfidences.length;
        
        // Normalize to 0-1 scale
        return averageConfidence / 100;
    }

    calculateOverallConfidence(confidenceScores) {
        const weights = {
            ocr: 0.4,
            classification: 0.3,
            extraction: 0.3
        };

        return Object.entries(weights).reduce((total, [key, weight]) => {
            return total + (confidenceScores[key] * weight);
        }, 0);
    }

    async getAvailableWorker() {
        // Find an available worker
        for (const [id, workerInfo] of this.workers.entries()) {
            if (!workerInfo.busy) {
                return workerInfo;
            }
        }

        // If no workers available, wait for one
        return new Promise((resolve) => {
            const checkWorkers = () => {
                for (const [id, workerInfo] of this.workers.entries()) {
                    if (!workerInfo.busy) {
                        resolve(workerInfo);
                        return;
                    }
                }
                setTimeout(checkWorkers, 100);
            };
            checkWorkers();
        });
    }

    generateDocumentId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async shutdown() {
        console.log('[OCRProcessor] Shutting down OCR workers...');
        
        for (const [id, workerInfo] of this.workers.entries()) {
            await workerInfo.worker.terminate();
        }
        
        this.workers.clear();
        console.log('[OCRProcessor] OCR workers shutdown complete');
    }

    getStatistics() {
        return {
            totalWorkers: this.workers.size,
            busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
            confidenceThreshold: this.confidenceThreshold,
            timestamp: new Date().toISOString()
        };
    }
}

// Document Classification System
class DocumentClassifier {
    constructor() {
        this.patterns = this.initializePatterns();
    }

    initializePatterns() {
        return {
            BILL_OF_LADING: {
                keywords: [
                    'bill of lading', 'b/l', 'bol', 'shipper', 'consignee', 'notify party',
                    'vessel', 'voyage', 'container', 'booking', 'freight'
                ],
                patterns: [
                    /bill\s*of\s*lading/i,
                    /b\/l\s*no/i,
                    /container\s*no/i,
                    /booking\s*no/i,
                    /shipper.*consignee/is
                ],
                weight: 1.0
            },
            COMMERCIAL_INVOICE: {
                keywords: [
                    'commercial invoice', 'invoice', 'seller', 'buyer', 'total amount',
                    'quantity', 'unit price', 'description of goods'
                ],
                patterns: [
                    /commercial\s*invoice/i,
                    /invoice\s*no/i,
                    /total\s*amount/i,
                    /unit\s*price/i,
                    /\$\s*[\d,]+\.?\d*/
                ],
                weight: 0.9
            },
            PACKING_LIST: {
                keywords: [
                    'packing list', 'package', 'carton', 'gross weight', 'net weight',
                    'dimensions', 'cbm', 'packages'
                ],
                patterns: [
                    /packing\s*list/i,
                    /gross\s*weight/i,
                    /net\s*weight/i,
                    /\d+\s*packages?/i,
                    /\d+\s*cartons?/i
                ],
                weight: 0.8
            },
            CERTIFICATE_OF_ORIGIN: {
                keywords: [
                    'certificate of origin', 'origin', 'country of origin', 'chamber of commerce',
                    'certify', 'hereby certify'
                ],
                patterns: [
                    /certificate\s*of\s*origin/i,
                    /country\s*of\s*origin/i,
                    /chamber\s*of\s*commerce/i,
                    /hereby\s*certify/i
                ],
                weight: 0.7
            },
            CUSTOMS_DECLARATION: {
                keywords: [
                    'customs declaration', 'customs', 'hs code', 'tariff', 'duty',
                    'customs value', 'import', 'export'
                ],
                patterns: [
                    /customs\s*declaration/i,
                    /hs\s*code/i,
                    /customs\s*value/i,
                    /tariff\s*code/i
                ],
                weight: 0.6
            }
        };
    }

    async classify(text, filename = '') {
        const scores = {};
        const details = {};

        // Analyze each document type
        for (const [type, config] of Object.entries(this.patterns)) {
            let score = 0;
            let matchDetails = {
                keywordMatches: [],
                patternMatches: [],
                filenameMatch: false
            };

            // Check keywords
            const keywordScore = this.scoreKeywords(text, config.keywords);
            matchDetails.keywordMatches = keywordScore.matches;
            score += keywordScore.score * 0.4;

            // Check patterns
            const patternScore = this.scorePatterns(text, config.patterns);
            matchDetails.patternMatches = patternScore.matches;
            score += patternScore.score * 0.5;

            // Check filename
            if (filename) {
                const filenameScore = this.scoreFilename(filename, config.keywords);
                matchDetails.filenameMatch = filenameScore > 0;
                score += filenameScore * 0.1;
            }

            scores[type] = score * config.weight;
            details[type] = matchDetails;
        }

        // Find best match
        const bestType = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        const confidence = scores[bestType];

        return {
            type: confidence > 0.3 ? bestType : 'UNKNOWN',
            confidence: Math.min(confidence, 1.0),
            alternativeTypes: Object.entries(scores)
                .filter(([type, score]) => type !== bestType && score > 0.2)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 2)
                .map(([type, score]) => ({ type, confidence: score })),
            details: details[bestType] || {}
        };
    }

    scoreKeywords(text, keywords) {
        const textLower = text.toLowerCase();
        const matches = [];
        let score = 0;

        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
            const keywordMatches = textLower.match(regex);
            
            if (keywordMatches) {
                matches.push({
                    keyword: keyword,
                    count: keywordMatches.length,
                    positions: this.findPositions(textLower, keyword)
                });
                score += keywordMatches.length * 0.1;
            }
        }

        return {
            score: Math.min(score, 1.0),
            matches: matches
        };
    }

    scorePatterns(text, patterns) {
        const matches = [];
        let score = 0;

        for (const pattern of patterns) {
            const patternMatches = text.match(pattern);
            
            if (patternMatches) {
                matches.push({
                    pattern: pattern.source,
                    matches: patternMatches,
                    count: patternMatches.length
                });
                score += 0.2;
            }
        }

        return {
            score: Math.min(score, 1.0),
            matches: matches
        };
    }

    scoreFilename(filename, keywords) {
        const filenameLower = filename.toLowerCase();
        let score = 0;

        for (const keyword of keywords) {
            if (filenameLower.includes(keyword.toLowerCase().replace(/\s+/g, ''))) {
                score += 0.3;
            }
        }

        return Math.min(score, 1.0);
    }

    findPositions(text, keyword) {
        const positions = [];
        const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
        let match;

        while ((match = regex.exec(text)) !== null) {
            positions.push({
                start: match.index,
                end: match.index + match[0].length
            });
        }

        return positions;
    }
}

// Bill of Lading Data Extractor
class BOLDataExtractor {
    constructor() {
        this.patterns = this.initializeExtractionPatterns();
    }

    initializeExtractionPatterns() {
        return {
            containerNumber: [
                /container\s*no?\.?\s*[:.]?\s*([A-Z]{4}\s*\d{7})/gi,
                /container\s*number\s*[:.]?\s*([A-Z]{4}\s*\d{7})/gi,
                /cntr\s*no?\.?\s*[:.]?\s*([A-Z]{4}\s*\d{7})/gi,
                /([A-Z]{4}\s*\d{7})/g
            ],
            bookingNumber: [
                /booking\s*no?\.?\s*[:.]?\s*([A-Z0-9]{8,})/gi,
                /booking\s*number\s*[:.]?\s*([A-Z0-9]{8,})/gi,
                /bkg\s*no?\.?\s*[:.]?\s*([A-Z0-9]{8,})/gi
            ],
            billOfLadingNumber: [
                /b\/l\s*no?\.?\s*[:.]?\s*([A-Z0-9]{8,})/gi,
                /bill\s*of\s*lading\s*no?\.?\s*[:.]?\s*([A-Z0-9]{8,})/gi,
                /bol\s*no?\.?\s*[:.]?\s*([A-Z0-9]{8,})/gi
            ],
            vessel: [
                /vessel\s*[:.]?\s*([A-Z\s]+)/gi,
                /ship\s*name\s*[:.]?\s*([A-Z\s]+)/gi,
                /m\.?v\.?\s*([A-Z\s]+)/gi
            ],
            voyage: [
                /voyage\s*no?\.?\s*[:.]?\s*([A-Z0-9]+)/gi,
                /voy\s*[:.]?\s*([A-Z0-9]+)/gi
            ],
            shipper: [
                /shipper\s*[:.]?\s*([\s\S]*?)(?=consignee|notify|$)/gi
            ],
            consignee: [
                /consignee\s*[:.]?\s*([\s\S]*?)(?=notify|shipper|$)/gi
            ],
            notifyParty: [
                /notify\s*party\s*[:.]?\s*([\s\S]*?)(?=shipper|consignee|$)/gi
            ],
            portOfLoading: [
                /port\s*of\s*loading\s*[:.]?\s*([A-Z\s,]+)/gi,
                /pol\s*[:.]?\s*([A-Z\s,]+)/gi,
                /loading\s*port\s*[:.]?\s*([A-Z\s,]+)/gi
            ],
            portOfDischarge: [
                /port\s*of\s*discharge\s*[:.]?\s*([A-Z\s,]+)/gi,
                /pod\s*[:.]?\s*([A-Z\s,]+)/gi,
                /discharge\s*port\s*[:.]?\s*([A-Z\s,]+)/gi
            ],
            placeOfDelivery: [
                /place\s*of\s*delivery\s*[:.]?\s*([A-Z\s,]+)/gi,
                /final\s*destination\s*[:.]?\s*([A-Z\s,]+)/gi
            ],
            freightCharges: [
                /freight\s*[:.]?\s*\$?\s*(\d+\.?\d*)/gi,
                /charges\s*[:.]?\s*\$?\s*(\d+\.?\d*)/gi
            ],
            cargoDescription: [
                /description\s*of\s*goods\s*[:.]?\s*([\s\S]*?)(?=gross|net|container|$)/gi,
                /commodity\s*[:.]?\s*([\s\S]*?)(?=gross|net|container|$)/gi
            ]
        };
    }

    async extractBOLData(text) {
        const extractedData = {
            documentType: 'BILL_OF_LADING',
            confidence: 0,
            fields: {},
            rawMatches: {},
            validationErrors: []
        };

        let totalConfidence = 0;
        let fieldsFound = 0;

        // Extract each field
        for (const [fieldName, patterns] of Object.entries(this.patterns)) {
            const fieldResult = this.extractField(text, patterns, fieldName);
            
            if (fieldResult.value) {
                extractedData.fields[fieldName] = fieldResult.value;
                extractedData.rawMatches[fieldName] = fieldResult.matches;
                totalConfidence += fieldResult.confidence;
                fieldsFound++;
            }
        }

        // Calculate overall confidence
        extractedData.confidence = fieldsFound > 0 ? totalConfidence / fieldsFound : 0;

        // Validate extracted data
        extractedData.validationErrors = this.validateBOLData(extractedData.fields);

        // Apply post-processing
        extractedData.fields = this.postProcessBOLFields(extractedData.fields);

        return extractedData;
    }

    extractField(text, patterns, fieldName) {
        const result = {
            value: null,
            confidence: 0,
            matches: []
        };

        for (const pattern of patterns) {
            const matches = [...text.matchAll(pattern)];
            
            if (matches.length > 0) {
                result.matches.push(...matches);
                
                // Take the first valid match
                const match = matches[0];
                const extractedValue = match[1] ? match[1].trim() : match[0].trim();
                
                if (extractedValue) {
                    result.value = this.cleanExtractedValue(extractedValue, fieldName);
                    result.confidence = this.calculateFieldConfidence(extractedValue, fieldName);
                    break;
                }
            }
        }

        return result;
    }

    cleanExtractedValue(value, fieldName) {
        let cleaned = value.trim();

        // Field-specific cleaning
        switch (fieldName) {
            case 'containerNumber':
                cleaned = cleaned.replace(/\s+/g, '').toUpperCase();
                break;
            case 'bookingNumber':
            case 'billOfLadingNumber':
                cleaned = cleaned.replace(/\s+/g, '').toUpperCase();
                break;
            case 'vessel':
                cleaned = cleaned.replace(/\s+/g, ' ').toUpperCase();
                // Remove common prefixes
                cleaned = cleaned.replace(/^(M\.?V\.?\s*|S\.?S\.?\s*)/i, '');
                break;
            case 'shipper':
            case 'consignee':
            case 'notifyParty':
                // Clean up multi-line addresses
                cleaned = cleaned.replace(/\s+/g, ' ').trim();
                cleaned = cleaned.replace(/[\r\n]+/g, ', ');
                break;
            default:
                cleaned = cleaned.replace(/\s+/g, ' ').trim();
        }

        return cleaned;
    }

    calculateFieldConfidence(value, fieldName) {
        let confidence = 0.5; // Base confidence

        // Field-specific confidence adjustments
        switch (fieldName) {
            case 'containerNumber':
                // Check container number format (4 letters + 7 digits)
                if (/^[A-Z]{4}\d{7}$/.test(value.replace(/\s+/g, ''))) {
                    confidence = 0.95;
                } else if (/^[A-Z]{4}/.test(value)) {
                    confidence = 0.7;
                }
                break;
            case 'bookingNumber':
            case 'billOfLadingNumber':
                if (value.length >= 8 && /^[A-Z0-9]+$/.test(value)) {
                    confidence = 0.9;
                } else if (value.length >= 6) {
                    confidence = 0.7;
                }
                break;
            case 'vessel':
                if (value.length > 3 && /^[A-Z\s]+$/.test(value)) {
                    confidence = 0.8;
                }
                break;
            default:
                if (value.length > 0) {
                    confidence = 0.6;
                }
        }

        return confidence;
    }

    validateBOLData(fields) {
        const errors = [];

        // Validate container number
        if (fields.containerNumber) {
            const containerRegex = /^[A-Z]{4}\d{7}$/;
            if (!containerRegex.test(fields.containerNumber.replace(/\s+/g, ''))) {
                errors.push({
                    field: 'containerNumber',
                    message: 'Invalid container number format',
                    expectedFormat: 'ABCD1234567'
                });
            }
        }

        // Validate required fields
        const requiredFields = ['shipper', 'consignee', 'vessel'];
        for (const field of requiredFields) {
            if (!fields[field] || fields[field].length < 3) {
                errors.push({
                    field: field,
                    message: `Missing or incomplete ${field}`,
                    severity: 'warning'
                });
            }
        }

        return errors;
    }

    postProcessBOLFields(fields) {
        const processed = { ...fields };

        // Standardize container number
        if (processed.containerNumber) {
            processed.containerNumber = processed.containerNumber.replace(/\s+/g, '').toUpperCase();
        }

        // Parse vessel and voyage if combined
        if (processed.vessel && processed.vessel.includes('/')) {
            const parts = processed.vessel.split('/');
            processed.vessel = parts[0].trim();
            if (!processed.voyage && parts[1]) {
                processed.voyage = parts[1].trim();
            }
        }

        // Standardize port names
        ['portOfLoading', 'portOfDischarge', 'placeOfDelivery'].forEach(portField => {
            if (processed[portField]) {
                processed[portField] = this.standardizePortName(processed[portField]);
            }
        });

        return processed;
    }

    standardizePortName(portName) {
        // Remove common suffixes and standardize format
        let standardized = portName.toUpperCase().trim();
        standardized = standardized.replace(/\s*,\s*[A-Z]{2}$/g, ''); // Remove country codes
        standardized = standardized.replace(/\s*PORT$/g, ''); // Remove "PORT" suffix
        return standardized;
    }

    // Methods for other document types
    async extractInvoiceData(text) {
        return { documentType: 'COMMERCIAL_INVOICE', confidence: 0.5, fields: {} };
    }

    async extractPackingListData(text) {
        return { documentType: 'PACKING_LIST', confidence: 0.5, fields: {} };
    }

    async extractCOOData(text) {
        return { documentType: 'CERTIFICATE_OF_ORIGIN', confidence: 0.5, fields: {} };
    }

    async extractCustomsData(text) {
        return { documentType: 'CUSTOMS_DECLARATION', confidence: 0.5, fields: {} };
    }

    async extractGenericData(text) {
        return { documentType: 'UNKNOWN', confidence: 0.3, fields: {} };
    }
}

module.exports = { OCRProcessor, DocumentClassifier, BOLDataExtractor };