/**
 * ROOTUIP Document Processing Simulator
 * Simulates OCR and intelligent document extraction
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class DocumentProcessorSimulator extends EventEmitter {
    constructor() {
        super();
        
        this.documentTypes = {
            'BILL_OF_LADING': {
                name: 'Bill of Lading',
                requiredFields: ['shipper', 'consignee', 'containerNumber', 'portOfLoading', 'portOfDischarge', 'commodity'],
                avgProcessingTime: 2500,
                avgOCRConfidence: 0.92
            },
            'COMMERCIAL_INVOICE': {
                name: 'Commercial Invoice',
                requiredFields: ['invoiceNumber', 'invoiceDate', 'seller', 'buyer', 'totalAmount', 'currency', 'items'],
                avgProcessingTime: 3000,
                avgOCRConfidence: 0.94
            },
            'PACKING_LIST': {
                name: 'Packing List',
                requiredFields: ['packageCount', 'totalWeight', 'totalVolume', 'items', 'marks'],
                avgProcessingTime: 2000,
                avgOCRConfidence: 0.93
            },
            'CERTIFICATE_OF_ORIGIN': {
                name: 'Certificate of Origin',
                requiredFields: ['exporterName', 'importerName', 'countryOfOrigin', 'certifyingAuthority', 'certificationDate'],
                avgProcessingTime: 1800,
                avgOCRConfidence: 0.91
            },
            'ARRIVAL_NOTICE': {
                name: 'Arrival Notice',
                requiredFields: ['vesselName', 'voyageNumber', 'eta', 'containerNumber', 'freeTime', 'demurrageRate'],
                avgProcessingTime: 2200,
                avgOCRConfidence: 0.95
            },
            'DELIVERY_ORDER': {
                name: 'Delivery Order',
                requiredFields: ['containerNumber', 'releaseTo', 'validUntil', 'terminal', 'specialInstructions'],
                avgProcessingTime: 1500,
                avgOCRConfidence: 0.96
            }
        };

        this.ocrPatterns = {
            containerNumber: /[A-Z]{4}\d{7}/g,
            bookingNumber: /\d{9,10}/g,
            vesselName: /[A-Z\s]+(?:MAERSK|MSC|CMA|EVERGREEN|ONE|HAPAG)/gi,
            portCode: /[A-Z]{5}/g,
            date: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g,
            amount: /[$€£¥]\s*[\d,]+\.?\d*/g,
            weight: /\d+\.?\d*\s*(KG|MT|LBS)/gi,
            volume: /\d+\.?\d*\s*(CBM|M3|CFT)/gi
        };

        this.processingQueue = [];
        this.processedDocuments = new Map();
    }

    /**
     * Simulate document upload and processing
     */
    async processDocument(documentData) {
        const processingId = crypto.randomUUID();
        const startTime = Date.now();
        
        // Add to queue
        this.processingQueue.push(processingId);
        
        // Emit processing started event
        this.emit('processing:started', {
            processingId,
            documentType: documentData.type,
            fileName: documentData.fileName,
            timestamp: new Date().toISOString()
        });

        try {
            // Simulate OCR processing delay
            const docConfig = this.documentTypes[documentData.type] || this.documentTypes.BILL_OF_LADING;
            await this.simulateProcessingDelay(docConfig.avgProcessingTime);

            // Generate OCR results
            const ocrResults = this.simulateOCR(documentData, docConfig);
            
            // Extract structured data
            const extractedData = this.extractStructuredData(ocrResults, docConfig);
            
            // Validate extracted data
            const validation = this.validateExtractedData(extractedData, docConfig);
            
            // Generate final result
            const result = {
                processingId,
                status: 'completed',
                processingTime: Date.now() - startTime,
                document: {
                    type: documentData.type,
                    fileName: documentData.fileName,
                    fileSize: documentData.fileSize || Math.floor(Math.random() * 5000000) + 500000,
                    pageCount: documentData.pageCount || Math.floor(Math.random() * 5) + 1
                },
                ocr: ocrResults,
                extractedData,
                validation,
                metadata: {
                    timestamp: new Date().toISOString(),
                    engineVersion: '2.1.0',
                    modelVersion: 'rootuip-ocr-v3'
                }
            };

            // Store result
            this.processedDocuments.set(processingId, result);
            
            // Remove from queue
            this.processingQueue = this.processingQueue.filter(id => id !== processingId);
            
            // Emit completion event
            this.emit('processing:completed', result);
            
            return result;

        } catch (error) {
            const errorResult = {
                processingId,
                status: 'failed',
                error: error.message,
                processingTime: Date.now() - startTime
            };
            
            this.emit('processing:failed', errorResult);
            return errorResult;
        }
    }

    simulateOCR(documentData, docConfig) {
        const baseConfidence = docConfig.avgOCRConfidence;
        const pages = [];

        const pageCount = documentData.pageCount || 1;
        
        for (let i = 0; i < pageCount; i++) {
            const pageResult = {
                pageNumber: i + 1,
                confidence: baseConfidence + (Math.random() * 0.08 - 0.04), // +/- 4% variation
                textBlocks: this.generateTextBlocks(documentData, docConfig),
                boundingBoxes: this.generateBoundingBoxes(documentData),
                language: 'en',
                orientation: 0,
                skewAngle: (Math.random() * 2 - 1).toFixed(2)
            };
            
            pages.push(pageResult);
        }

        return {
            overallConfidence: pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length,
            pages,
            processingEngine: 'ROOTUIP-OCR-Engine',
            enhancementsApplied: ['deskew', 'denoise', 'contrast_adjustment']
        };
    }

    generateTextBlocks(documentData, docConfig) {
        const blocks = [];
        const documentType = documentData.type;

        // Generate header block
        blocks.push({
            id: 'header',
            text: this.generateDocumentHeader(documentType),
            confidence: 0.95 + Math.random() * 0.05,
            bbox: { x: 50, y: 50, width: 500, height: 100 }
        });

        // Generate field blocks based on document type
        if (documentType === 'BILL_OF_LADING') {
            blocks.push(...this.generateBillOfLadingBlocks());
        } else if (documentType === 'COMMERCIAL_INVOICE') {
            blocks.push(...this.generateCommercialInvoiceBlocks());
        } else if (documentType === 'ARRIVAL_NOTICE') {
            blocks.push(...this.generateArrivalNoticeBlocks());
        } else {
            blocks.push(...this.generateGenericDocumentBlocks(docConfig));
        }

        return blocks;
    }

    generateDocumentHeader(type) {
        const headers = {
            'BILL_OF_LADING': 'BILL OF LADING\nFOR COMBINED TRANSPORT OR PORT TO PORT SHIPMENT',
            'COMMERCIAL_INVOICE': 'COMMERCIAL INVOICE\nFOR CUSTOMS AND STATISTICAL PURPOSES',
            'PACKING_LIST': 'PACKING LIST\nDETAILED CARGO MANIFEST',
            'CERTIFICATE_OF_ORIGIN': 'CERTIFICATE OF ORIGIN\nCHAMBER OF COMMERCE',
            'ARRIVAL_NOTICE': 'ARRIVAL NOTICE / FREIGHT INVOICE',
            'DELIVERY_ORDER': 'DELIVERY ORDER\nAUTHORIZATION FOR CARGO RELEASE'
        };

        return headers[type] || 'SHIPPING DOCUMENT';
    }

    generateBillOfLadingBlocks() {
        const blocks = [];
        const containerNumber = this.generateRealisticContainerNumber();
        const bookingNumber = Math.floor(Math.random() * 900000000) + 100000000;

        blocks.push({
            id: 'shipper',
            text: `SHIPPER:\nACME ELECTRONICS CORP\n123 EXPORT LANE\nSHANGHAI, CHINA 200000\nTEL: +86-21-5555-0000`,
            confidence: 0.92 + Math.random() * 0.06,
            bbox: { x: 50, y: 180, width: 300, height: 120 }
        });

        blocks.push({
            id: 'consignee',
            text: `CONSIGNEE:\nGLOBAL IMPORTS LLC\n456 COMMERCE DRIVE\nLOS ANGELES, CA 90012 USA\nTEL: +1-310-555-0000`,
            confidence: 0.91 + Math.random() * 0.07,
            bbox: { x: 50, y: 320, width: 300, height: 120 }
        });

        blocks.push({
            id: 'container_details',
            text: `CONTAINER NO: ${containerNumber}\nSEAL NO: SEAL${Math.floor(Math.random() * 9000000) + 1000000}\nBOOKING NO: ${bookingNumber}`,
            confidence: 0.95 + Math.random() * 0.04,
            bbox: { x: 400, y: 180, width: 250, height: 80 }
        });

        blocks.push({
            id: 'voyage_details',
            text: `VESSEL: MAERSK EDINBURGH\nVOYAGE: 123W\nPORT OF LOADING: SHANGHAI, CHINA\nPORT OF DISCHARGE: LOS ANGELES, USA`,
            confidence: 0.93 + Math.random() * 0.05,
            bbox: { x: 50, y: 460, width: 400, height: 100 }
        });

        blocks.push({
            id: 'commodity',
            text: `COMMODITY:\nELECTRONIC COMPONENTS\n500 CARTONS\nGROSS WEIGHT: 12,500 KG\nVOLUME: 45.5 CBM`,
            confidence: 0.90 + Math.random() * 0.08,
            bbox: { x: 50, y: 580, width: 350, height: 120 }
        });

        return blocks;
    }

    generateCommercialInvoiceBlocks() {
        const blocks = [];
        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
        const totalAmount = (Math.random() * 50000 + 10000).toFixed(2);

        blocks.push({
            id: 'invoice_header',
            text: `INVOICE NO: ${invoiceNumber}\nDATE: ${new Date().toLocaleDateString()}\nTERMS: FOB SHANGHAI`,
            confidence: 0.96,
            bbox: { x: 400, y: 180, width: 250, height: 80 }
        });

        blocks.push({
            id: 'seller_info',
            text: `SELLER:\nACME ELECTRONICS CORP\n123 EXPORT LANE\nSHANGHAI, CHINA`,
            confidence: 0.94,
            bbox: { x: 50, y: 180, width: 300, height: 100 }
        });

        blocks.push({
            id: 'buyer_info',
            text: `BUYER:\nGLOBAL IMPORTS LLC\n456 COMMERCE DRIVE\nLOS ANGELES, CA USA`,
            confidence: 0.93,
            bbox: { x: 50, y: 300, width: 300, height: 100 }
        });

        blocks.push({
            id: 'line_items',
            text: `DESCRIPTION                QTY    UNIT PRICE    TOTAL\nElectronic Components      500    $${(totalAmount/500).toFixed(2)}     $${totalAmount}\n\nTOTAL AMOUNT: USD ${totalAmount}`,
            confidence: 0.91,
            bbox: { x: 50, y: 420, width: 600, height: 150 }
        });

        return blocks;
    }

    generateArrivalNoticeBlocks() {
        const blocks = [];
        const eta = new Date();
        eta.setDate(eta.getDate() + Math.floor(Math.random() * 7) + 1);

        blocks.push({
            id: 'vessel_info',
            text: `VESSEL: MAERSK EDINBURGH\nVOYAGE: 123W\nETA: ${eta.toLocaleDateString()} ${eta.toLocaleTimeString()}`,
            confidence: 0.95,
            bbox: { x: 50, y: 180, width: 300, height: 80 }
        });

        blocks.push({
            id: 'container_info',
            text: `CONTAINER: ${this.generateRealisticContainerNumber()}\nSIZE/TYPE: 40HC\nDISCHARGE PORT: LOS ANGELES`,
            confidence: 0.94,
            bbox: { x: 400, y: 180, width: 250, height: 80 }
        });

        blocks.push({
            id: 'free_time',
            text: `FREE TIME: 5 DAYS\nDEMURRAGE RATE: USD 125.00 PER DAY\nSTORAGE START: ${new Date(eta.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
            confidence: 0.92,
            bbox: { x: 50, y: 300, width: 400, height: 100 }
        });

        blocks.push({
            id: 'charges',
            text: `OCEAN FREIGHT: USD 2,500.00\nDOCUMENTATION FEE: USD 75.00\nTERMINAL HANDLING: USD 350.00\nTOTAL DUE: USD 2,925.00`,
            confidence: 0.93,
            bbox: { x: 50, y: 420, width: 300, height: 120 }
        });

        return blocks;
    }

    generateGenericDocumentBlocks(docConfig) {
        const blocks = [];
        
        docConfig.requiredFields.forEach((field, index) => {
            blocks.push({
                id: field,
                text: `${field.toUpperCase()}: ${this.generateFieldValue(field)}`,
                confidence: 0.88 + Math.random() * 0.10,
                bbox: { 
                    x: 50 + (index % 2) * 300, 
                    y: 200 + Math.floor(index / 2) * 80, 
                    width: 280, 
                    height: 60 
                }
            });
        });

        return blocks;
    }

    generateFieldValue(fieldName) {
        const fieldValues = {
            shipper: 'ACME ELECTRONICS CORP',
            consignee: 'GLOBAL IMPORTS LLC',
            containerNumber: this.generateRealisticContainerNumber(),
            portOfLoading: 'SHANGHAI, CHINA',
            portOfDischarge: 'LOS ANGELES, USA',
            commodity: 'ELECTRONIC COMPONENTS',
            invoiceNumber: `INV-${Math.floor(Math.random() * 900000) + 100000}`,
            totalAmount: `USD ${(Math.random() * 50000 + 10000).toFixed(2)}`,
            vesselName: 'MAERSK EDINBURGH',
            eta: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
        };

        return fieldValues[fieldName] || `Sample ${fieldName}`;
    }

    generateBoundingBoxes(documentData) {
        // Generate visual bounding boxes for UI display
        const boxes = [];
        const fieldCount = Math.floor(Math.random() * 8) + 5;

        for (let i = 0; i < fieldCount; i++) {
            boxes.push({
                id: `bbox_${i}`,
                coordinates: {
                    x: Math.floor(Math.random() * 500) + 50,
                    y: Math.floor(Math.random() * 600) + 150,
                    width: Math.floor(Math.random() * 200) + 100,
                    height: Math.floor(Math.random() * 50) + 30
                },
                confidence: 0.85 + Math.random() * 0.15,
                type: ['text', 'table', 'image', 'barcode'][Math.floor(Math.random() * 2)] // Mostly text
            });
        }

        return boxes;
    }

    extractStructuredData(ocrResults, docConfig) {
        const extractedData = {};
        const allText = ocrResults.pages.map(p => 
            p.textBlocks.map(b => b.text).join('\n')
        ).join('\n');

        // Extract container numbers
        const containerMatches = allText.match(this.ocrPatterns.containerNumber);
        if (containerMatches) {
            extractedData.containerNumbers = [...new Set(containerMatches)];
        }

        // Extract booking numbers
        const bookingMatches = allText.match(this.ocrPatterns.bookingNumber);
        if (bookingMatches) {
            extractedData.bookingNumbers = [...new Set(bookingMatches)];
        }

        // Extract dates
        const dateMatches = allText.match(this.ocrPatterns.date);
        if (dateMatches) {
            extractedData.dates = dateMatches.map(d => this.normalizeDate(d));
        }

        // Extract amounts
        const amountMatches = allText.match(this.ocrPatterns.amount);
        if (amountMatches) {
            extractedData.amounts = amountMatches.map(a => ({
                raw: a,
                value: parseFloat(a.replace(/[$€£¥,]/g, '')),
                currency: a.match(/[$€£¥]/)?.[0] || '$'
            }));
        }

        // Extract weights
        const weightMatches = allText.match(this.ocrPatterns.weight);
        if (weightMatches) {
            extractedData.weights = weightMatches.map(w => ({
                raw: w,
                value: parseFloat(w.match(/[\d.]+/)[0]),
                unit: w.match(/(KG|MT|LBS)/i)[0].toUpperCase()
            }));
        }

        // Extract document-specific fields
        extractedData.documentSpecific = this.extractDocumentSpecificFields(allText, docConfig);

        return extractedData;
    }

    extractDocumentSpecificFields(text, docConfig) {
        const fields = {};

        // Simple extraction based on patterns
        if (text.includes('SHIPPER:')) {
            fields.shipper = text.split('SHIPPER:')[1].split('\n').slice(0, 3).join(', ').trim();
        }

        if (text.includes('CONSIGNEE:')) {
            fields.consignee = text.split('CONSIGNEE:')[1].split('\n').slice(0, 3).join(', ').trim();
        }

        if (text.includes('VESSEL:')) {
            fields.vesselName = text.split('VESSEL:')[1].split('\n')[0].trim();
        }

        if (text.includes('ETA:')) {
            fields.eta = text.split('ETA:')[1].split('\n')[0].trim();
        }

        if (text.includes('FREE TIME:')) {
            fields.freeTime = text.split('FREE TIME:')[1].split('\n')[0].trim();
        }

        if (text.includes('DEMURRAGE RATE:')) {
            fields.demurrageRate = text.split('DEMURRAGE RATE:')[1].split('\n')[0].trim();
        }

        return fields;
    }

    normalizeDate(dateStr) {
        // Simple date normalization
        const cleaned = dateStr.replace(/[-\/]/g, '/');
        try {
            const date = new Date(cleaned);
            return date.toISOString().split('T')[0];
        } catch {
            return dateStr;
        }
    }

    validateExtractedData(extractedData, docConfig) {
        const validation = {
            isValid: true,
            completeness: 0,
            errors: [],
            warnings: [],
            suggestions: []
        };

        // Check required fields
        let foundFields = 0;
        docConfig.requiredFields.forEach(field => {
            if (extractedData.documentSpecific && extractedData.documentSpecific[field]) {
                foundFields++;
            } else {
                validation.errors.push({
                    field,
                    message: `Required field '${field}' not found or extracted`
                });
            }
        });

        validation.completeness = (foundFields / docConfig.requiredFields.length) * 100;

        // Validate container numbers
        if (extractedData.containerNumbers) {
            extractedData.containerNumbers.forEach(cn => {
                if (!this.isValidContainerNumber(cn)) {
                    validation.warnings.push({
                        field: 'containerNumber',
                        value: cn,
                        message: 'Container number may be invalid'
                    });
                }
            });
        }

        // Check data quality
        if (validation.completeness < 80) {
            validation.isValid = false;
            validation.suggestions.push('Document quality may be poor. Consider re-scanning at higher resolution.');
        }

        if (validation.completeness < 60) {
            validation.suggestions.push('Many required fields missing. Ensure correct document type is selected.');
        }

        return validation;
    }

    isValidContainerNumber(containerNumber) {
        // ISO 6346 validation (simplified)
        if (!/^[A-Z]{4}\d{7}$/.test(containerNumber)) {
            return false;
        }
        return true;
    }

    generateRealisticContainerNumber() {
        const prefixes = ['MSKU', 'MSCU', 'CMAU', 'HLXU', 'ONEU', 'EGLV'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const numbers = Math.floor(Math.random() * 9000000) + 1000000;
        return `${prefix}${numbers}`;
    }

    simulateProcessingDelay(baseTime) {
        // Add realistic variation to processing time
        const variation = baseTime * 0.2;
        const actualTime = baseTime + (Math.random() * variation * 2 - variation);
        return new Promise(resolve => setTimeout(resolve, actualTime));
    }

    // Get processing statistics
    getProcessingStats() {
        const completed = Array.from(this.processedDocuments.values());
        
        if (completed.length === 0) {
            return {
                totalProcessed: 0,
                avgProcessingTime: 0,
                avgConfidence: 0,
                successRate: 0
            };
        }

        const successful = completed.filter(d => d.status === 'completed');
        
        return {
            totalProcessed: completed.length,
            currentlyProcessing: this.processingQueue.length,
            successful: successful.length,
            failed: completed.length - successful.length,
            avgProcessingTime: successful.reduce((sum, d) => sum + d.processingTime, 0) / successful.length,
            avgConfidence: successful.reduce((sum, d) => sum + d.ocr.overallConfidence, 0) / successful.length,
            successRate: (successful.length / completed.length) * 100,
            documentTypes: this.getDocumentTypeStats(successful)
        };
    }

    getDocumentTypeStats(documents) {
        const stats = {};
        
        documents.forEach(doc => {
            const type = doc.document.type;
            if (!stats[type]) {
                stats[type] = {
                    count: 0,
                    avgProcessingTime: 0,
                    avgConfidence: 0
                };
            }
            
            stats[type].count++;
            stats[type].avgProcessingTime += doc.processingTime;
            stats[type].avgConfidence += doc.ocr.overallConfidence;
        });

        // Calculate averages
        Object.keys(stats).forEach(type => {
            stats[type].avgProcessingTime /= stats[type].count;
            stats[type].avgConfidence /= stats[type].count;
        });

        return stats;
    }

    // Batch processing
    async processBatch(documents) {
        const results = [];
        
        for (const doc of documents) {
            const result = await this.processDocument(doc);
            results.push(result);
            
            // Small delay between documents
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return {
            batchId: crypto.randomUUID(),
            totalDocuments: documents.length,
            successful: results.filter(r => r.status === 'completed').length,
            failed: results.filter(r => r.status === 'failed').length,
            results,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = DocumentProcessorSimulator;