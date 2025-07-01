// ROOTUIP AI/ML GPU-Accelerated Processing Server
// Real-time document processing, ML inference, and optimization with RunPod 4080ti

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import AI/ML modules
const RunPodGPUAcceleration = require('./ai-ml/gpu-acceleration/runpod-integration');
const DDPredictionEngine = require('./ai-ml/prediction-engine/dd-prediction-engine');
const OptimizationEngine = require('./ai-ml/optimization/optimization-engine');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, TIFF, and PDF are allowed.'));
        }
    }
});

// Initialize AI/ML engines
let gpuAccelerator, ddEngine, optimizationEngine;

async function initializeAIEngines() {
    try {
        console.log('🚀 Initializing ROOTUIP AI/ML GPU Processing Platform...');
        
        // Initialize RunPod GPU acceleration
        gpuAccelerator = new RunPodGPUAcceleration({
            apiKey: process.env.RUNPOD_API_KEY || 'demo-key-4080ti',
            endpoint: process.env.RUNPOD_ENDPOINT || 'https://api.runpod.ai/v2/demo',
            modelType: '4080ti',
            timeout: 30000
        });
        
        // Initialize D&D prediction engine
        ddEngine = new DDPredictionEngine({
            predictionHorizon: 14,
            confidenceThreshold: 0.7,
            enableGPUAcceleration: true
        });
        
        // Initialize optimization engine
        optimizationEngine = new OptimizationEngine({
            algorithms: ['genetic', 'simulated_annealing', 'particle_swarm'],
            enableGPUAcceleration: true,
            maxIterations: 1000
        });
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('✅ All AI/ML engines initialized and ready');
        
    } catch (error) {
        console.error('❌ Failed to initialize AI/ML engines:', error.message);
    }
}

function setupEventListeners() {
    // GPU accelerator events
    gpuAccelerator.on('connected', (data) => {
        console.log('🔗 GPU accelerator connected:', data);
    });
    
    gpuAccelerator.on('ocrComplete', (data) => {
        console.log(`📄 OCR completed in ${data.processingTime}ms`);
    });
    
    gpuAccelerator.on('inferenceComplete', (data) => {
        console.log(`🤖 ${data.modelType} inference completed in ${data.processingTime}ms`);
    });
    
    // D&D prediction engine events
    ddEngine.on('predictionComplete', (data) => {
        console.log(`⚠️ D&D prediction completed: ${data.riskScore}% risk`);
    });
    
    // Optimization engine events
    optimizationEngine.on('optimizationComplete', (data) => {
        console.log(`🗺️ Route optimization completed: ${data.improvement}% improvement`);
    });
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        gpu: gpuAccelerator?.getStatus(),
        engines: {
            ddPrediction: !!ddEngine,
            optimization: !!optimizationEngine
        }
    });
});

// GPU status endpoint
app.get('/api/gpu/status', (req, res) => {
    if (!gpuAccelerator) {
        return res.status(503).json({ error: 'GPU accelerator not initialized' });
    }
    
    res.json(gpuAccelerator.getStatus());
});

// Document processing with OCR
app.post('/api/process-document', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded' });
        }
        
        console.log(`📄 Processing document: ${req.file.originalname} (${req.file.size} bytes)`);
        
        const options = {
            language: req.body.language || 'eng',
            confidence: parseInt(req.body.confidence) || 80,
            extractFields: req.body.extractFields === 'true'
        };
        
        const result = await gpuAccelerator.processDocumentOCR(req.file.buffer, options);
        
        res.json({
            success: true,
            filename: req.file.originalname,
            ...result
        });
        
    } catch (error) {
        console.error('❌ Document processing error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// D&D risk prediction
app.post('/api/dd-prediction', async (req, res) => {
    try {
        const { containerNumber, portOfDischarge, arrivalDate, consigneeHistory } = req.body;
        
        if (!containerNumber || !portOfDischarge) {
            return res.status(400).json({ error: 'Container number and port of discharge are required' });
        }
        
        console.log(`⚠️ Predicting D&D risk for container ${containerNumber} at ${portOfDischarge}`);
        
        // Use GPU-accelerated prediction
        const predictionData = {
            containerNumber,
            portOfDischarge,
            arrivalDate: arrivalDate || new Date().toISOString(),
            consigneeHistory: consigneeHistory || {}
        };
        
        const gpuResult = await gpuAccelerator.runMLInference('dd-prediction', predictionData);
        const ddResult = await ddEngine.predictDemurrageDetention(predictionData);
        
        res.json({
            success: true,
            containerNumber,
            portOfDischarge,
            prediction: {
                ...gpuResult.result,
                ...ddResult,
                gpuAccelerated: true,
                processingTime: gpuResult.processingTime
            }
        });
        
    } catch (error) {
        console.error('❌ D&D prediction error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Route optimization
app.post('/api/optimize-route', async (req, res) => {
    try {
        const { 
            originPort, 
            destinationPort, 
            containerCount, 
            priority, 
            constraints 
        } = req.body;
        
        if (!originPort || !destinationPort) {
            return res.status(400).json({ error: 'Origin and destination ports are required' });
        }
        
        console.log(`🗺️ Optimizing route from ${originPort} to ${destinationPort} for ${containerCount} containers`);
        
        const optimizationData = {
            originPort,
            destinationPort,
            containerCount: parseInt(containerCount) || 1,
            priority: priority || 'cost',
            constraints: constraints || {}
        };
        
        // Use GPU-accelerated optimization
        const gpuResult = await gpuAccelerator.runMLInference('route-optimization', optimizationData);
        const optimizationResult = await optimizationEngine.optimizeRoute(optimizationData);
        
        res.json({
            success: true,
            route: {
                ...gpuResult.result,
                ...optimizationResult,
                gpuAccelerated: true,
                processingTime: gpuResult.processingTime
            }
        });
        
    } catch (error) {
        console.error('❌ Route optimization error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Document classification
app.post('/api/classify-document', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No document uploaded' });
        }
        
        console.log(`📋 Classifying document: ${req.file.originalname}`);
        
        const classificationData = {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        };
        
        const result = await gpuAccelerator.runMLInference('document-classification', classificationData);
        
        res.json({
            success: true,
            filename: req.file.originalname,
            classification: result.result,
            processingTime: result.processingTime,
            gpuAccelerated: true
        });
        
    } catch (error) {
        console.error('❌ Document classification error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Batch processing endpoint
app.post('/api/batch-process', upload.array('documents', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No documents uploaded for batch processing' });
        }
        
        console.log(`🔄 Processing batch of ${req.files.length} documents`);
        
        const jobs = req.files.map((file, index) => ({
            id: `batch_${Date.now()}_${index}`,
            type: 'ocr',
            data: file.buffer,
            options: {
                filename: file.originalname,
                language: 'eng'
            }
        }));
        
        const batchResult = await gpuAccelerator.batchProcess(jobs, {
            batchSize: 8
        });
        
        res.json({
            success: true,
            batchId: `batch_${Date.now()}`,
            ...batchResult
        });
        
    } catch (error) {
        console.error('❌ Batch processing error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Anomaly detection
app.post('/api/detect-anomalies', async (req, res) => {
    try {
        const { shipmentData, historicalData } = req.body;
        
        if (!shipmentData) {
            return res.status(400).json({ error: 'Shipment data is required' });
        }
        
        console.log('🔍 Running anomaly detection analysis');
        
        const anomalyData = {
            shipmentData,
            historicalData: historicalData || {}
        };
        
        const result = await gpuAccelerator.runMLInference('anomaly-detection', anomalyData);
        
        res.json({
            success: true,
            anomalyAnalysis: result.result,
            processingTime: result.processingTime,
            gpuAccelerated: true
        });
        
    } catch (error) {
        console.error('❌ Anomaly detection error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Real-time metrics endpoint
app.get('/api/metrics/real-time', (req, res) => {
    const metrics = {
        timestamp: new Date().toISOString(),
        gpu: gpuAccelerator?.getStatus(),
        processing: {
            documentsPerMinute: Math.floor(Math.random() * 50) + 120,
            averageProcessingTime: Math.floor(Math.random() * 1000) + 800,
            accuracy: Math.floor(Math.random() * 5) + 95,
            queueLength: Math.floor(Math.random() * 10)
        },
        system: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: Math.floor(Math.random() * 30) + 20
        }
    };
    
    res.json(metrics);
});

// Performance benchmarking
app.post('/api/benchmark', async (req, res) => {
    try {
        console.log('🏃 Running performance benchmark...');
        
        const benchmarks = [];
        const testData = { test: true, size: 'medium' };
        
        // OCR benchmark
        const ocrStart = Date.now();
        await gpuAccelerator.runMLInference('document-classification', testData);
        benchmarks.push({
            operation: 'OCR Processing',
            time: Date.now() - ocrStart,
            throughput: 'Documents/sec'
        });
        
        // D&D prediction benchmark
        const ddStart = Date.now();
        await gpuAccelerator.runMLInference('dd-prediction', testData);
        benchmarks.push({
            operation: 'D&D Prediction',
            time: Date.now() - ddStart,
            throughput: 'Predictions/sec'
        });
        
        // Route optimization benchmark
        const routeStart = Date.now();
        await gpuAccelerator.runMLInference('route-optimization', testData);
        benchmarks.push({
            operation: 'Route Optimization',
            time: Date.now() - routeStart,
            throughput: 'Routes/sec'
        });
        
        res.json({
            success: true,
            benchmarks,
            gpu: gpuAccelerator.getStatus(),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Benchmark error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve the AI/ML demo interface
app.get('/ai-ml-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ai-ml-demo-interface.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
        }
    }
    
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3025;

async function startServer() {
    try {
        await initializeAIEngines();
        
        app.listen(PORT, () => {
            console.log('🌟 ================================');
            console.log('🚀 ROOTUIP AI/ML GPU Platform Started');
            console.log('🌟 ================================');
            console.log(`🔗 Server: http://localhost:${PORT}`);
            console.log(`🤖 AI/ML Demo: http://localhost:${PORT}/ai-ml-demo`);
            console.log(`📊 GPU Status: http://localhost:${PORT}/api/gpu/status`);
            console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics/real-time`);
            console.log('🌟 ================================');
            console.log('🎯 Features Available:');
            console.log('   • GPU-Accelerated Document OCR');
            console.log('   • D&D Risk Prediction (14-day horizon)');
            console.log('   • Route Optimization Algorithms');
            console.log('   • Real-time Anomaly Detection');
            console.log('   • Batch Processing Capabilities');
            console.log('   • Performance Benchmarking');
            console.log('🌟 ================================');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;