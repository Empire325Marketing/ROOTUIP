#!/usr/bin/env node

/**
 * ROOTUIP AI-Powered Document Intelligence System
 * Automated classification, extraction, and workflow automation
 */

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const Tesseract = require('tesseract.js');
const cv = require('opencv4nodejs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const { Worker } = require('worker_threads');
const crypto = require('crypto');

class AIDocumentProcessor {
    constructor(config = {}) {
        this.config = {
            modelPath: config.modelPath || './models',
            languages: config.languages || ['eng', 'spa', 'fra', 'deu', 'chi_sim'],
            confidenceThreshold: config.confidenceThreshold || 0.85,
            maxWorkers: config.maxWorkers || 4,
            enableHandwriting: config.enableHandwriting !== false,
            enableOCR: config.enableOCR !== false,
            ...config
        };
        
        // AI Models
        this.models = {
            classification: null,
            extraction: null,
            handwriting: null,
            layout: null
        };
        
        // NLP components
        this.tokenizer = new natural.WordTokenizer();
        this.stemmer = natural.PorterStemmer;
        this.classifier = new natural.BayesClassifier();
        
        // Document types
        this.documentTypes = this.initializeDocumentTypes();
        
        // Industry formats
        this.industryFormats = this.initializeIndustryFormats();
        
        // Extraction patterns
        this.extractionPatterns = this.initializeExtractionPatterns();
        
        // Worker pool for parallel processing
        this.workerPool = [];
        
        // Statistics
        this.stats = {
            processed: 0,
            classified: 0,
            extracted: 0,
            errors: 0
        };
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize document types
    initializeDocumentTypes() {
        return {
            // Shipping documents
            'bill_of_lading': {
                name: 'Bill of Lading',
                industry: 'shipping',
                keywords: ['bill of lading', 'b/l', 'shipper', 'consignee', 'vessel', 'port'],
                fields: ['blNumber', 'shipper', 'consignee', 'vessel', 'voyage', 'portOfLoading', 'portOfDischarge', 'containers']
            },
            'commercial_invoice': {
                name: 'Commercial Invoice',
                industry: 'trade',
                keywords: ['invoice', 'seller', 'buyer', 'amount', 'payment terms'],
                fields: ['invoiceNumber', 'date', 'seller', 'buyer', 'items', 'totalAmount', 'currency', 'paymentTerms']
            },
            'packing_list': {
                name: 'Packing List',
                industry: 'shipping',
                keywords: ['packing list', 'packages', 'weight', 'dimensions'],
                fields: ['packingListNumber', 'packages', 'grossWeight', 'netWeight', 'dimensions', 'contents']
            },
            'air_waybill': {
                name: 'Air Waybill',
                industry: 'air_freight',
                keywords: ['air waybill', 'awb', 'flight', 'airport', 'iata'],
                fields: ['awbNumber', 'airline', 'flight', 'origin', 'destination', 'pieces', 'weight', 'chargeableWeight']
            },
            'sea_waybill': {
                name: 'Sea Waybill',
                industry: 'ocean_freight',
                keywords: ['sea waybill', 'swb', 'carrier', 'vessel', 'container'],
                fields: ['swbNumber', 'carrier', 'vessel', 'voyage', 'containers', 'portOfLoading', 'portOfDischarge']
            },
            'certificate_of_origin': {
                name: 'Certificate of Origin',
                industry: 'trade',
                keywords: ['certificate of origin', 'country of origin', 'manufacturer'],
                fields: ['certificateNumber', 'exporter', 'importer', 'countryOfOrigin', 'goods', 'hsCode']
            },
            'dangerous_goods': {
                name: 'Dangerous Goods Declaration',
                industry: 'hazmat',
                keywords: ['dangerous goods', 'hazmat', 'un number', 'class', 'imdg'],
                fields: ['unNumber', 'properShippingName', 'class', 'packingGroup', 'quantity', 'emergencyContact']
            },
            'customs_declaration': {
                name: 'Customs Declaration',
                industry: 'customs',
                keywords: ['customs', 'declaration', 'hs code', 'duty', 'tariff'],
                fields: ['declarationNumber', 'importer', 'exporter', 'goods', 'hsCode', 'value', 'duty']
            },
            'delivery_order': {
                name: 'Delivery Order',
                industry: 'logistics',
                keywords: ['delivery order', 'd/o', 'release', 'pickup'],
                fields: ['orderNumber', 'carrier', 'consignee', 'containers', 'pickupLocation', 'releaseDate']
            },
            'warehouse_receipt': {
                name: 'Warehouse Receipt',
                industry: 'warehousing',
                keywords: ['warehouse receipt', 'storage', 'receipt number', 'location'],
                fields: ['receiptNumber', 'warehouse', 'goods', 'quantity', 'location', 'receiptDate', 'storageCharges']
            }
        };
    }
    
    // Initialize industry formats
    initializeIndustryFormats() {
        return {
            // Healthcare
            'hl7': {
                name: 'Health Level 7',
                parser: this.parseHL7,
                fields: ['messageType', 'patientId', 'patientName', 'dateTime', 'facility']
            },
            'dicom': {
                name: 'Digital Imaging and Communications in Medicine',
                parser: this.parseDICOM,
                fields: ['studyId', 'patientId', 'modality', 'studyDate', 'institution']
            },
            
            // Financial
            'swift': {
                name: 'SWIFT Message',
                parser: this.parseSWIFT,
                fields: ['messageType', 'sender', 'receiver', 'amount', 'currency', 'reference']
            },
            'fix': {
                name: 'Financial Information eXchange',
                parser: this.parseFIX,
                fields: ['messageType', 'senderCompId', 'targetCompId', 'orderQty', 'price']
            },
            
            // Manufacturing
            'step': {
                name: 'Standard for Exchange of Product Data',
                parser: this.parseSTEP,
                fields: ['productId', 'productName', 'manufacturer', 'revision', 'date']
            },
            
            // Logistics
            'iftmin': {
                name: 'Instruction Message (EDIFACT)',
                parser: this.parseIFTMIN,
                fields: ['messageRef', 'shipper', 'consignee', 'transportMode', 'equipment']
            },
            'x12_204': {
                name: 'Motor Carrier Load Tender (X12)',
                parser: this.parseX12_204,
                fields: ['shipmentId', 'pickupDate', 'deliveryDate', 'origin', 'destination']
            }
        };
    }
    
    // Initialize extraction patterns
    initializeExtractionPatterns() {
        return {
            // Common patterns
            email: /[\w.-]+@[\w.-]+\.\w+/g,
            phone: /[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/g,
            date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
            
            // Shipping specific
            containerNumber: /[A-Z]{4}\d{7}/g,
            blNumber: /(B\/L|BL|BOL)[\s#:]*([A-Z0-9-]+)/gi,
            vesselName: /(?:M\/V|MV|S\/S|SS)\s+([A-Z][A-Z\s]+)/gi,
            portCode: /\b[A-Z]{5}\b/g,
            
            // Financial
            amount: /[$€£¥]\s*[\d,]+\.?\d*/g,
            invoiceNumber: /(?:Invoice|Inv)[\s#:]*([A-Z0-9-]+)/gi,
            poNumber: /(?:P\.O\.|PO|Purchase Order)[\s#:]*([A-Z0-9-]+)/gi,
            
            // Identifiers
            taxId: /\d{2}-\d{7}|\d{3}-\d{2}-\d{4}/g,
            iataCode: /\b[A-Z]{3}\b/g,
            unLocode: /\b[A-Z]{2}\s?[A-Z]{3}\b/g,
            hsCode: /\d{4}\.\d{2}(\.\d{2})?/g
        };
    }
    
    // Initialize system
    async initialize() {
        console.log('Initializing AI Document Processor...');
        
        // Load AI models
        await this.loadModels();
        
        // Train classifier with sample data
        await this.trainClassifier();
        
        // Initialize OCR engine
        await this.initializeOCR();
        
        // Create worker pool
        this.createWorkerPool();
        
        console.log('AI Document Processor initialized');
    }
    
    // Load AI models
    async loadModels() {
        try {
            // Document classification model
            this.models.classification = await tf.loadLayersModel(
                `file://${this.config.modelPath}/classification/model.json`
            );
            
            // Field extraction model
            this.models.extraction = await tf.loadLayersModel(
                `file://${this.config.modelPath}/extraction/model.json`
            );
            
            // Handwriting recognition model
            if (this.config.enableHandwriting) {
                this.models.handwriting = await tf.loadLayersModel(
                    `file://${this.config.modelPath}/handwriting/model.json`
                );
            }
            
            // Document layout analysis model
            this.models.layout = await tf.loadLayersModel(
                `file://${this.config.modelPath}/layout/model.json`
            );
            
        } catch (error) {
            console.warn('Some models could not be loaded, using fallback methods');
        }
    }
    
    // Train classifier
    async trainClassifier() {
        // Train with document type samples
        for (const [type, config] of Object.entries(this.documentTypes)) {
            for (const keyword of config.keywords) {
                this.classifier.addDocument(keyword, type);
            }
        }
        
        this.classifier.train();
    }
    
    // Initialize OCR
    async initializeOCR() {
        if (!this.config.enableOCR) return;
        
        // Initialize Tesseract workers
        this.ocrScheduler = Tesseract.createScheduler();
        
        for (let i = 0; i < this.config.maxWorkers; i++) {
            const worker = Tesseract.createWorker();
            await worker.load();
            await worker.loadLanguage(this.config.languages.join('+'));
            await worker.initialize(this.config.languages.join('+'));
            this.ocrScheduler.addWorker(worker);
        }
    }
    
    // Create worker pool
    createWorkerPool() {
        for (let i = 0; i < this.config.maxWorkers; i++) {
            const worker = new Worker(`
                const { parentPort } = require('worker_threads');
                
                parentPort.on('message', async (task) => {
                    try {
                        let result;
                        switch (task.type) {
                            case 'extract':
                                result = await extractFields(task.data);
                                break;
                            case 'classify':
                                result = await classifyDocument(task.data);
                                break;
                        }
                        parentPort.postMessage({ id: task.id, success: true, result });
                    } catch (error) {
                        parentPort.postMessage({ id: task.id, success: false, error: error.message });
                    }
                });
                
                async function extractFields(data) {
                    // Field extraction logic
                    return { fields: {} };
                }
                
                async function classifyDocument(data) {
                    // Classification logic
                    return { type: 'unknown' };
                }
            `, { eval: true });
            
            this.workerPool.push(worker);
        }
    }
    
    // Process document
    async processDocument(documentPath, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log(`Processing document: ${documentPath}`);
            
            // Read document
            const documentData = await this.readDocument(documentPath);
            
            // Pre-process document
            const preprocessed = await this.preprocessDocument(documentData);
            
            // Classify document
            const classification = await this.classifyDocument(preprocessed);
            console.log(`Document classified as: ${classification.type} (confidence: ${classification.confidence})`);
            
            // Extract text if needed
            let textContent = preprocessed.text;
            if (!textContent && this.config.enableOCR) {
                textContent = await this.performOCR(preprocessed.image);
            }
            
            // Extract fields
            const extraction = await this.extractFields(textContent, classification.type);
            
            // Detect handwriting if enabled
            let handwritingResults = null;
            if (this.config.enableHandwriting && preprocessed.image) {
                handwritingResults = await this.detectHandwriting(preprocessed.image);
            }
            
            // Apply workflow rules
            const workflowActions = await this.applyWorkflowRules(classification, extraction);
            
            // Generate result
            const result = {
                success: true,
                documentPath,
                classification,
                extraction,
                handwriting: handwritingResults,
                workflow: workflowActions,
                processingTime: Date.now() - startTime,
                metadata: {
                    pages: documentData.pages || 1,
                    size: documentData.size,
                    format: documentData.format
                }
            };
            
            this.stats.processed++;
            
            return result;
            
        } catch (error) {
            this.stats.errors++;
            console.error('Document processing error:', error);
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }
    
    // Read document
    async readDocument(documentPath) {
        const extension = documentPath.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'pdf':
                return await this.readPDF(documentPath);
            case 'doc':
            case 'docx':
                return await this.readWord(documentPath);
            case 'xls':
            case 'xlsx':
                return await this.readExcel(documentPath);
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'tiff':
                return await this.readImage(documentPath);
            default:
                return await this.readText(documentPath);
        }
    }
    
    // Read PDF
    async readPDF(filePath) {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        
        return {
            format: 'pdf',
            text: data.text,
            pages: data.numpages,
            info: data.info,
            size: dataBuffer.length
        };
    }
    
    // Read Word document
    async readWord(filePath) {
        const result = await mammoth.extractRawText({ path: filePath });
        
        return {
            format: 'word',
            text: result.value,
            messages: result.messages,
            size: (await fs.stat(filePath)).size
        };
    }
    
    // Read Excel
    async readExcel(filePath) {
        const workbook = xlsx.readFile(filePath);
        const sheets = {};
        
        for (const sheetName of workbook.SheetNames) {
            sheets[sheetName] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
        
        return {
            format: 'excel',
            sheets,
            text: JSON.stringify(sheets),
            size: (await fs.stat(filePath)).size
        };
    }
    
    // Read image
    async readImage(filePath) {
        const image = await cv.imreadAsync(filePath);
        
        return {
            format: 'image',
            image,
            width: image.cols,
            height: image.rows,
            channels: image.channels,
            size: (await fs.stat(filePath)).size
        };
    }
    
    // Preprocess document
    async preprocessDocument(documentData) {
        const preprocessed = {
            text: documentData.text || '',
            format: documentData.format,
            metadata: {}
        };
        
        // Clean text
        if (preprocessed.text) {
            preprocessed.text = this.cleanText(preprocessed.text);
            preprocessed.tokens = this.tokenizer.tokenize(preprocessed.text.toLowerCase());
        }
        
        // Process image if available
        if (documentData.image) {
            preprocessed.image = await this.preprocessImage(documentData.image);
        }
        
        return preprocessed;
    }
    
    // Clean text
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/[^\x00-\x7F]/g, '')
            .trim();
    }
    
    // Preprocess image
    async preprocessImage(image) {
        // Convert to grayscale
        let processed = await image.cvtColorAsync(cv.COLOR_BGR2GRAY);
        
        // Apply threshold
        processed = await processed.thresholdAsync(0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        
        // Noise removal
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        processed = await processed.morphologyExAsync(kernel, cv.MORPH_CLOSE);
        
        return processed;
    }
    
    // Classify document
    async classifyDocument(preprocessed) {
        this.stats.classified++;
        
        // Try AI model first
        if (this.models.classification && preprocessed.image) {
            return await this.classifyWithAI(preprocessed);
        }
        
        // Fallback to NLP classification
        return await this.classifyWithNLP(preprocessed);
    }
    
    // Classify with AI
    async classifyWithAI(preprocessed) {
        const imageTensor = tf.browser.fromPixels(preprocessed.image);
        const normalized = imageTensor.div(255.0);
        const batched = normalized.expandDims(0);
        
        const predictions = await this.models.classification.predict(batched).data();
        const maxIndex = predictions.indexOf(Math.max(...predictions));
        const confidence = predictions[maxIndex];
        
        const documentTypes = Object.keys(this.documentTypes);
        
        return {
            type: documentTypes[maxIndex],
            confidence,
            alternatives: this.getAlternatives(predictions, documentTypes)
        };
    }
    
    // Classify with NLP
    async classifyWithNLP(preprocessed) {
        if (!preprocessed.text) {
            return { type: 'unknown', confidence: 0 };
        }
        
        const classification = this.classifier.classify(preprocessed.text);
        const classifications = this.classifier.getClassifications(preprocessed.text);
        
        return {
            type: classification,
            confidence: classifications[0].value,
            alternatives: classifications.slice(1, 4).map(c => ({
                type: c.label,
                confidence: c.value
            }))
        };
    }
    
    // Perform OCR
    async performOCR(image) {
        if (!this.config.enableOCR) return '';
        
        const { data: { text } } = await this.ocrScheduler.addJob('recognize', image);
        
        return text;
    }
    
    // Extract fields
    async extractFields(text, documentType) {
        this.stats.extracted++;
        
        const documentConfig = this.documentTypes[documentType];
        if (!documentConfig) {
            return { fields: {}, confidence: 0 };
        }
        
        const fields = {};
        
        // Extract using patterns
        for (const fieldName of documentConfig.fields) {
            const value = await this.extractField(text, fieldName, documentType);
            if (value) {
                fields[fieldName] = value;
            }
        }
        
        // Extract using AI if available
        if (this.models.extraction) {
            const aiFields = await this.extractFieldsWithAI(text, documentType);
            Object.assign(fields, aiFields);
        }
        
        return {
            fields,
            confidence: Object.keys(fields).length / documentConfig.fields.length
        };
    }
    
    // Extract specific field
    async extractField(text, fieldName, documentType) {
        // Use predefined patterns
        const patterns = {
            blNumber: this.extractionPatterns.blNumber,
            containerNumber: this.extractionPatterns.containerNumber,
            invoiceNumber: this.extractionPatterns.invoiceNumber,
            amount: this.extractionPatterns.amount,
            email: this.extractionPatterns.email,
            phone: this.extractionPatterns.phone,
            date: this.extractionPatterns.date
        };
        
        const pattern = patterns[fieldName];
        if (pattern) {
            const matches = text.match(pattern);
            if (matches && matches.length > 0) {
                return matches[0];
            }
        }
        
        // Use context-based extraction
        return this.extractFieldByContext(text, fieldName);
    }
    
    // Extract field by context
    extractFieldByContext(text, fieldName) {
        const contextPatterns = {
            shipper: /(?:shipper|consignor)[\s:]+([^\n]+)/i,
            consignee: /(?:consignee|receiver)[\s:]+([^\n]+)/i,
            vessel: /(?:vessel|ship)[\s:]+([^\n]+)/i,
            portOfLoading: /(?:port of loading|pol)[\s:]+([^\n]+)/i,
            portOfDischarge: /(?:port of discharge|pod)[\s:]+([^\n]+)/i
        };
        
        const pattern = contextPatterns[fieldName];
        if (pattern) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return null;
    }
    
    // Detect handwriting
    async detectHandwriting(image) {
        if (!this.config.enableHandwriting || !this.models.handwriting) {
            return null;
        }
        
        try {
            // Detect handwritten regions
            const regions = await this.detectHandwrittenRegions(image);
            
            // Process each region
            const results = [];
            for (const region of regions) {
                const text = await this.recognizeHandwriting(region);
                results.push({
                    text,
                    confidence: region.confidence,
                    bounds: region.bounds
                });
            }
            
            return {
                detected: results.length > 0,
                regions: results
            };
            
        } catch (error) {
            console.error('Handwriting detection error:', error);
            return null;
        }
    }
    
    // Detect handwritten regions
    async detectHandwrittenRegions(image) {
        // Use contour detection to find potential handwritten areas
        const binary = await image.thresholdAsync(127, 255, cv.THRESH_BINARY_INV);
        const contours = await binary.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        const regions = [];
        
        for (const contour of contours) {
            const rect = contour.boundingRect();
            
            // Filter by size and aspect ratio
            if (rect.width > 50 && rect.height > 20) {
                const roi = image.getRegion(rect);
                
                // Check if region contains handwriting
                const isHandwritten = await this.isHandwritten(roi);
                
                if (isHandwritten.confidence > 0.7) {
                    regions.push({
                        image: roi,
                        bounds: rect,
                        confidence: isHandwritten.confidence
                    });
                }
            }
        }
        
        return regions;
    }
    
    // Check if region is handwritten
    async isHandwritten(roi) {
        if (!this.models.handwriting) {
            return { confidence: 0 };
        }
        
        const tensor = tf.browser.fromPixels(roi);
        const normalized = tensor.div(255.0);
        const batched = normalized.expandDims(0);
        
        const prediction = await this.models.handwriting.predict(batched).data();
        
        return {
            confidence: prediction[0],
            isHandwritten: prediction[0] > 0.5
        };
    }
    
    // Recognize handwriting
    async recognizeHandwriting(region) {
        // Use specialized OCR for handwriting
        const { data: { text } } = await Tesseract.recognize(
            region.image,
            'eng',
            {
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,',
                tessedit_ocr_engine_mode: 2 // Use LSTM engine
            }
        );
        
        return text;
    }
    
    // Apply workflow rules
    async applyWorkflowRules(classification, extraction) {
        const actions = [];
        
        // Document-specific workflows
        switch (classification.type) {
            case 'bill_of_lading':
                if (extraction.fields.blNumber) {
                    actions.push({
                        action: 'create_shipment',
                        data: {
                            blNumber: extraction.fields.blNumber,
                            shipper: extraction.fields.shipper,
                            consignee: extraction.fields.consignee
                        }
                    });
                }
                break;
                
            case 'commercial_invoice':
                if (extraction.fields.invoiceNumber && extraction.fields.totalAmount) {
                    actions.push({
                        action: 'create_invoice',
                        data: extraction.fields
                    });
                    
                    if (extraction.fields.totalAmount > 10000) {
                        actions.push({
                            action: 'flag_high_value',
                            reason: 'Invoice amount exceeds threshold'
                        });
                    }
                }
                break;
                
            case 'dangerous_goods':
                actions.push({
                    action: 'alert_hazmat',
                    priority: 'high',
                    data: extraction.fields
                });
                break;
        }
        
        // General workflows
        if (classification.confidence < this.config.confidenceThreshold) {
            actions.push({
                action: 'manual_review',
                reason: 'Low classification confidence'
            });
        }
        
        if (extraction.confidence < 0.7) {
            actions.push({
                action: 'verify_extraction',
                fields: Object.keys(extraction.fields).filter(f => !extraction.fields[f])
            });
        }
        
        return actions;
    }
    
    // Process multiple documents
    async processDocuments(documentPaths, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 10;
        
        for (let i = 0; i < documentPaths.length; i += batchSize) {
            const batch = documentPaths.slice(i, i + batchSize);
            
            const batchResults = await Promise.all(
                batch.map(path => this.processDocument(path, options))
            );
            
            results.push(...batchResults);
            
            // Progress callback
            if (options.onProgress) {
                options.onProgress({
                    processed: results.length,
                    total: documentPaths.length,
                    percentage: (results.length / documentPaths.length) * 100
                });
            }
        }
        
        return {
            results,
            summary: this.generateSummary(results)
        };
    }
    
    // Generate processing summary
    generateSummary(results) {
        const summary = {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            byType: {},
            avgProcessingTime: 0,
            requiresAction: []
        };
        
        let totalTime = 0;
        
        for (const result of results) {
            if (result.success) {
                // Count by type
                const type = result.classification.type;
                summary.byType[type] = (summary.byType[type] || 0) + 1;
                
                // Calculate average time
                totalTime += result.processingTime;
                
                // Check for required actions
                if (result.workflow && result.workflow.length > 0) {
                    summary.requiresAction.push({
                        document: result.documentPath,
                        actions: result.workflow
                    });
                }
            }
        }
        
        summary.avgProcessingTime = totalTime / summary.successful;
        
        return summary;
    }
    
    // Get alternatives
    getAlternatives(predictions, types) {
        const sorted = predictions
            .map((score, index) => ({ type: types[index], confidence: score }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(1, 4);
        
        return sorted;
    }
    
    // Get statistics
    getStatistics() {
        return {
            ...this.stats,
            accuracy: this.stats.classified > 0 ? 
                (this.stats.extracted / this.stats.classified) : 0,
            errorRate: this.stats.processed > 0 ? 
                (this.stats.errors / this.stats.processed) : 0
        };
    }
    
    // Cleanup
    async cleanup() {
        // Terminate OCR workers
        if (this.ocrScheduler) {
            await this.ocrScheduler.terminate();
        }
        
        // Terminate worker pool
        for (const worker of this.workerPool) {
            await worker.terminate();
        }
    }
}

module.exports = AIDocumentProcessor;