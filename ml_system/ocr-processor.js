const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const pdf2img = require('pdf-img-convert');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

class OCRProcessor extends EventEmitter {
    constructor() {
        super();
        this.worker = null;
        this.initialized = false;
        this.processingMetrics = {
            totalProcessed: 0,
            averageTime: 0,
            accuracy: 0,
            lastProcessed: null
        };
    }

    async initialize() {
        try {
            // Initialize Tesseract worker
            this.worker = await Tesseract.createWorker({
                logger: m => this.emit('progress', m),
                langPath: './lang-data',
                cachePath: './cache'
            });

            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            
            // Configure for optimal accuracy
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-.,()/:# ',
                preserve_interword_spaces: '1'
            });

            this.initialized = true;
            this.emit('initialized');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async preprocessImage(imagePath) {
        try {
            const startTime = Date.now();
            
            // Apply image preprocessing for better OCR accuracy
            const processedPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');
            
            await sharp(imagePath)
                .greyscale()
                .normalize()
                .sharpen()
                .threshold(128)
                .resize(2400, null, {
                    kernel: sharp.kernel.lanczos3,
                    withoutEnlargement: false
                })
                .png()
                .toFile(processedPath);

            const preprocessTime = Date.now() - startTime;
            this.emit('preprocessed', { 
                original: imagePath, 
                processed: processedPath,
                time: preprocessTime 
            });

            return processedPath;
        } catch (error) {
            this.emit('error', { stage: 'preprocessing', error });
            throw error;
        }
    }

    async processDocument(filePath, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const results = {
            filename: path.basename(filePath),
            timestamp: new Date().toISOString(),
            type: null,
            text: '',
            entities: {},
            confidence: 0,
            processingTime: 0,
            pages: []
        };

        try {
            const fileExt = path.extname(filePath).toLowerCase();
            
            if (fileExt === '.pdf') {
                // Convert PDF to images
                const pdfImages = await pdf2img.convert(filePath, {
                    width: 2400,
                    height: 3400
                });

                for (let i = 0; i < pdfImages.length; i++) {
                    const imgPath = path.join(path.dirname(filePath), `page_${i + 1}.png`);
                    await fs.writeFile(imgPath, pdfImages[i]);
                    
                    const pageResult = await this.processImage(imgPath);
                    results.pages.push(pageResult);
                    results.text += pageResult.text + '\n\n';
                    
                    // Clean up temp image
                    await fs.unlink(imgPath).catch(() => {});
                }
            } else {
                // Process single image
                const pageResult = await this.processImage(filePath);
                results.pages.push(pageResult);
                results.text = pageResult.text;
            }

            // Classify document type
            results.type = this.classifyDocument(results.text);
            
            // Extract entities
            results.entities = this.extractEntities(results.text, results.type);
            
            // Calculate overall confidence
            results.confidence = this.calculateConfidence(results);
            
            // Update processing metrics
            results.processingTime = Date.now() - startTime;
            this.updateMetrics(results);

            this.emit('processed', results);
            return results;

        } catch (error) {
            this.emit('error', { stage: 'processing', error });
            throw error;
        }
    }

    async processImage(imagePath) {
        try {
            // Preprocess image for better accuracy
            const processedPath = await this.preprocessImage(imagePath);
            
            // Perform OCR
            const { data } = await this.worker.recognize(processedPath);
            
            // Clean up processed image
            await fs.unlink(processedPath).catch(() => {});

            return {
                text: data.text,
                confidence: data.confidence,
                words: data.words.map(word => ({
                    text: word.text,
                    confidence: word.confidence,
                    bbox: word.bbox
                })),
                lines: data.lines.map(line => ({
                    text: line.text,
                    confidence: line.confidence,
                    bbox: line.bbox
                }))
            };
        } catch (error) {
            this.emit('error', { stage: 'OCR', error });
            throw error;
        }
    }

    classifyDocument(text) {
        const textLower = text.toLowerCase();
        const classifications = {
            'bill_of_lading': {
                keywords: ['bill of lading', 'b/l no', 'shipper', 'consignee', 'vessel', 'port of loading', 'port of discharge'],
                score: 0
            },
            'commercial_invoice': {
                keywords: ['invoice', 'invoice no', 'bill to', 'ship to', 'total amount', 'payment terms', 'item description'],
                score: 0
            },
            'packing_list': {
                keywords: ['packing list', 'package', 'carton', 'gross weight', 'net weight', 'dimensions', 'contents'],
                score: 0
            },
            'customs_declaration': {
                keywords: ['customs', 'declaration', 'hs code', 'country of origin', 'customs value', 'duty', 'tariff'],
                score: 0
            },
            'certificate_of_origin': {
                keywords: ['certificate of origin', 'manufactured in', 'produced in', 'chamber of commerce', 'country of origin'],
                score: 0
            },
            'delivery_order': {
                keywords: ['delivery order', 'd/o', 'release', 'pick up', 'container', 'terminal'],
                score: 0
            }
        };

        // Score each document type based on keyword matches
        for (const [docType, config] of Object.entries(classifications)) {
            config.keywords.forEach(keyword => {
                if (textLower.includes(keyword)) {
                    config.score += 1;
                }
            });
        }

        // Find the highest scoring document type
        let maxScore = 0;
        let detectedType = 'unknown';
        
        for (const [docType, config] of Object.entries(classifications)) {
            if (config.score > maxScore) {
                maxScore = config.score;
                detectedType = docType;
            }
        }

        // Require at least 2 keyword matches for classification
        if (maxScore < 2) {
            detectedType = 'unknown';
        }

        return detectedType;
    }

    extractEntities(text, documentType) {
        const entities = {
            dates: [],
            amounts: [],
            references: [],
            addresses: [],
            companies: [],
            containers: [],
            vessels: [],
            ports: [],
            weights: [],
            customFields: {}
        };

        // Extract dates (various formats)
        const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\w{3,9}\s+\d{1,2},?\s+\d{4})\b/g;
        entities.dates = [...text.matchAll(dateRegex)].map(match => ({
            value: match[0],
            confidence: 0.85
        }));

        // Extract monetary amounts
        const amountRegex = /\b(?:USD|US\$|\$|EUR|€|GBP|£)\s*[\d,]+\.?\d*\b|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|US\$|\$|EUR|€|GBP|£)\b/gi;
        entities.amounts = [...text.matchAll(amountRegex)].map(match => ({
            value: match[0],
            confidence: 0.9
        }));

        // Extract reference numbers (B/L, Invoice, etc.)
        const refRegex = /\b(?:B\/L|BL|Invoice|INV|PO|Order|Ref|Reference)[\s:#-]*([A-Z0-9\-\/]+)\b/gi;
        entities.references = [...text.matchAll(refRegex)].map(match => ({
            type: match[0].split(/[\s:#-]/)[0],
            value: match[1],
            confidence: 0.8
        }));

        // Extract container numbers
        const containerRegex = /\b([A-Z]{4}\s?\d{7})\b/g;
        entities.containers = [...text.matchAll(containerRegex)].map(match => ({
            value: match[0],
            confidence: 0.95
        }));

        // Extract weights
        const weightRegex = /\b(\d+(?:[,\.]\d+)?)\s*(?:kg|kgs|lbs|pounds|tons?|MT)\b/gi;
        entities.weights = [...text.matchAll(weightRegex)].map(match => ({
            value: match[0],
            unit: match[0].match(/kg|kgs|lbs|pounds|tons?|MT/i)[0],
            confidence: 0.85
        }));

        // Document-specific entity extraction
        if (documentType === 'bill_of_lading') {
            entities.customFields = this.extractBOLFields(text);
        } else if (documentType === 'commercial_invoice') {
            entities.customFields = this.extractInvoiceFields(text);
        }

        return entities;
    }

    extractBOLFields(text) {
        const fields = {};
        
        // Extract shipper
        const shipperMatch = text.match(/Shipper[:\s]+([^\n]+(?:\n(?!Consignee)[^\n]+)*)/i);
        if (shipperMatch) {
            fields.shipper = {
                value: shipperMatch[1].trim(),
                confidence: 0.8
            };
        }

        // Extract consignee
        const consigneeMatch = text.match(/Consignee[:\s]+([^\n]+(?:\n(?!Notify)[^\n]+)*)/i);
        if (consigneeMatch) {
            fields.consignee = {
                value: consigneeMatch[1].trim(),
                confidence: 0.8
            };
        }

        // Extract vessel name
        const vesselMatch = text.match(/Vessel[:\s]+([^\n]+)/i);
        if (vesselMatch) {
            fields.vessel = {
                value: vesselMatch[1].trim(),
                confidence: 0.85
            };
        }

        // Extract ports
        const polMatch = text.match(/Port of Loading[:\s]+([^\n]+)/i);
        if (polMatch) {
            fields.portOfLoading = {
                value: polMatch[1].trim(),
                confidence: 0.85
            };
        }

        const podMatch = text.match(/Port of Discharge[:\s]+([^\n]+)/i);
        if (podMatch) {
            fields.portOfDischarge = {
                value: podMatch[1].trim(),
                confidence: 0.85
            };
        }

        return fields;
    }

    extractInvoiceFields(text) {
        const fields = {};
        
        // Extract invoice number
        const invMatch = text.match(/Invoice\s*(?:No|Number|#)?[:\s]+([A-Z0-9\-\/]+)/i);
        if (invMatch) {
            fields.invoiceNumber = {
                value: invMatch[1].trim(),
                confidence: 0.9
            };
        }

        // Extract total amount
        const totalMatch = text.match(/Total[:\s]+.*?([\d,]+\.?\d*)/i);
        if (totalMatch) {
            fields.totalAmount = {
                value: totalMatch[1],
                confidence: 0.85
            };
        }

        return fields;
    }

    calculateConfidence(results) {
        let totalConfidence = 0;
        let count = 0;

        // Average OCR confidence from all pages
        results.pages.forEach(page => {
            totalConfidence += page.confidence;
            count++;
        });

        // Factor in entity extraction confidence
        const entities = results.entities;
        Object.values(entities).forEach(entityList => {
            if (Array.isArray(entityList)) {
                entityList.forEach(entity => {
                    if (entity.confidence) {
                        totalConfidence += entity.confidence * 100;
                        count++;
                    }
                });
            }
        });

        // Document classification confidence
        if (results.type !== 'unknown') {
            totalConfidence += 85; // Base confidence for successful classification
            count++;
        }

        return count > 0 ? Math.round(totalConfidence / count) : 0;
    }

    updateMetrics(results) {
        this.processingMetrics.totalProcessed++;
        
        // Update average processing time
        const currentAvg = this.processingMetrics.averageTime;
        const newAvg = ((currentAvg * (this.processingMetrics.totalProcessed - 1)) + results.processingTime) / this.processingMetrics.totalProcessed;
        this.processingMetrics.averageTime = Math.round(newAvg);
        
        // Update accuracy (based on confidence scores)
        const currentAccuracy = this.processingMetrics.accuracy;
        const newAccuracy = ((currentAccuracy * (this.processingMetrics.totalProcessed - 1)) + results.confidence) / this.processingMetrics.totalProcessed;
        this.processingMetrics.accuracy = Math.round(newAccuracy);
        
        this.processingMetrics.lastProcessed = new Date().toISOString();
    }

    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
        }
    }

    getMetrics() {
        return {
            ...this.processingMetrics,
            status: this.initialized ? 'ready' : 'not_initialized'
        };
    }
}

module.exports = OCRProcessor;