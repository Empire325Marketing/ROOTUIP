// AI/ML Demo API - Server-side endpoints
const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(express.json());

// Configure file upload
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
        }
    }
});

// Document Processing Endpoints
app.post('/api/ai/process-document', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Simulate document processing with realistic timings
        const useGPU = Math.random() > 0.2; // 80% GPU usage
        const processingTime = useGPU ? 
            Math.random() * 2000 + 500 : // GPU: 0.5-2.5 seconds
            Math.random() * 15000 + 5000; // CPU: 5-20 seconds

        // Simulate processing delay
        setTimeout(() => {
            const result = processDocument(req.file, useGPU, processingTime);
            res.json(result);
        }, processingTime);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// D&D Risk Prediction Endpoint
app.post('/api/ai/predict-dd-risk', async (req, res) => {
    try {
        const { containerId, freeTimeRemaining, portCode, carrierCode } = req.body;
        
        const riskAnalysis = calculateDDRisk({
            containerId,
            freeTimeRemaining,
            portCode,
            carrierCode
        });

        res.json(riskAnalysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Port Congestion Forecast Endpoint
app.get('/api/ai/port-forecast/:portCode', async (req, res) => {
    try {
        const { portCode } = req.params;
        const { days = 7 } = req.query;

        const forecast = generatePortForecast(portCode, parseInt(days));
        res.json(forecast);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Container Delay Prediction Endpoint
app.post('/api/ai/predict-delay', async (req, res) => {
    try {
        const { containers, route, carrier } = req.body;
        
        const predictions = containers.map(container => ({
            containerId: container.id,
            currentETA: container.eta,
            predictedDelay: predictDelay(container, route, carrier),
            confidence: Math.random() * 0.15 + 0.8, // 80-95% confidence
            factors: analyzeDelayFactors(container, route, carrier)
        }));

        res.json({ predictions, timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cost Optimization Endpoint
app.post('/api/ai/optimize-costs', async (req, res) => {
    try {
        const { shipmentData } = req.body;
        
        const optimization = {
            currentCosts: calculateCurrentCosts(shipmentData),
            optimizedCosts: calculateOptimizedCosts(shipmentData),
            savings: {},
            recommendations: generateCostRecommendations(shipmentData),
            confidence: Math.random() * 0.1 + 0.85 // 85-95% confidence
        };

        optimization.savings = {
            amount: optimization.currentCosts.total - optimization.optimizedCosts.total,
            percentage: ((optimization.currentCosts.total - optimization.optimizedCosts.total) / optimization.currentCosts.total * 100).toFixed(1)
        };

        res.json(optimization);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ML Model Performance Metrics Endpoint
app.get('/api/ai/model-metrics', (req, res) => {
    const metrics = {
        models: {
            documentProcessing: {
                accuracy: 94.3 + (Math.random() - 0.5) * 2,
                precision: 92.1 + (Math.random() - 0.5) * 2,
                recall: 95.8 + (Math.random() - 0.5) * 2,
                f1Score: 0.89 + (Math.random() - 0.5) * 0.05,
                lastTrained: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                predictionsToday: Math.floor(Math.random() * 5000) + 10000
            },
            riskPrediction: {
                accuracy: 91.7 + (Math.random() - 0.5) * 2,
                precision: 89.4 + (Math.random() - 0.5) * 2,
                recall: 93.2 + (Math.random() - 0.5) * 2,
                f1Score: 0.87 + (Math.random() - 0.5) * 0.05,
                lastTrained: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                predictionsToday: Math.floor(Math.random() * 3000) + 8000
            },
            portCongestion: {
                accuracy: 88.9 + (Math.random() - 0.5) * 2,
                precision: 86.7 + (Math.random() - 0.5) * 2,
                recall: 90.1 + (Math.random() - 0.5) * 2,
                f1Score: 0.84 + (Math.random() - 0.5) * 0.05,
                lastTrained: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
                predictionsToday: Math.floor(Math.random() * 2000) + 5000
            }
        },
        overall: {
            totalPredictions: Math.floor(Math.random() * 10000) + 25000,
            avgResponseTime: (Math.random() * 100 + 150).toFixed(0) + 'ms',
            uptime: '99.98%',
            lastUpdated: new Date().toISOString()
        }
    };

    res.json(metrics);
});

// Automation Rule Engine Endpoint
app.post('/api/ai/execute-rules', async (req, res) => {
    try {
        const { data, rules } = req.body;
        
        const results = {
            rulesEvaluated: rules.length,
            rulesTriggered: 0,
            actions: [],
            executionTime: 0
        };

        const startTime = Date.now();

        // Evaluate each rule
        for (const rule of rules) {
            if (evaluateRule(rule, data)) {
                results.rulesTriggered++;
                const action = executeAction(rule.action, data);
                results.actions.push(action);
            }
        }

        results.executionTime = Date.now() - startTime;
        results.success = true;

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper Functions

function processDocument(file, useGPU, processingTime) {
    const documentTypes = {
        'pdf': ['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Customs Declaration'],
        'image': ['Container Photo', 'Damage Report', 'Seal Verification', 'Loading Document']
    };

    const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'image';
    const docType = documentTypes[fileType][Math.floor(Math.random() * documentTypes[fileType].length)];
    
    const confidence = Math.random() * 0.08 + 0.90; // 90-98% confidence
    
    return {
        documentId: generateDocumentId(),
        fileName: file.originalname,
        fileSize: file.size,
        processedAt: new Date().toISOString(),
        processingTime: processingTime,
        accelerationUsed: useGPU ? 'GPU' : 'CPU',
        speedImprovement: useGPU ? '10x' : 'baseline',
        
        classification: {
            type: docType,
            confidence: confidence
        },
        
        ocr: {
            confidence: confidence + (Math.random() * 0.02),
            textExtracted: true,
            language: 'en',
            qualityScore: (confidence * 100).toFixed(1)
        },
        
        entities: generateExtractedEntities(docType),
        
        validation: {
            status: confidence > 0.85 ? 'passed' : 'needs_review',
            issues: confidence > 0.85 ? [] : ['Low confidence score']
        }
    };
}

function calculateDDRisk(data) {
    const { containerId, freeTimeRemaining, portCode, carrierCode } = data;
    
    // Risk factors
    const portCongestion = getPortCongestion(portCode);
    const carrierReliability = getCarrierReliability(carrierCode);
    const timeRisk = Math.max(0, 100 - (freeTimeRemaining * 10)); // Higher risk as time decreases
    
    // Calculate composite risk score
    const riskScore = (
        timeRisk * 0.4 +
        portCongestion * 0.3 +
        (100 - carrierReliability) * 0.3
    );

    const riskLevel = 
        riskScore >= 80 ? 'CRITICAL' :
        riskScore >= 60 ? 'HIGH' :
        riskScore >= 40 ? 'MEDIUM' :
        riskScore >= 20 ? 'LOW' : 'MINIMAL';

    return {
        containerId,
        riskScore: riskScore.toFixed(1),
        riskLevel,
        confidence: (Math.random() * 0.1 + 0.85).toFixed(2), // 85-95%
        factors: {
            timeRemaining: {
                value: freeTimeRemaining,
                impact: timeRisk.toFixed(1),
                weight: 0.4
            },
            portCongestion: {
                value: portCongestion.toFixed(1),
                impact: portCongestion,
                weight: 0.3
            },
            carrierPerformance: {
                value: carrierReliability.toFixed(1),
                impact: (100 - carrierReliability).toFixed(1),
                weight: 0.3
            }
        },
        recommendations: generateRiskRecommendations(riskScore, freeTimeRemaining),
        estimatedCharges: calculateEstimatedCharges(riskScore, freeTimeRemaining),
        preventionProbability: Math.max(0.1, (100 - riskScore) / 100)
    };
}

function generatePortForecast(portCode, days) {
    const baselineData = {
        'USLAX': { baseline: 65, volatility: 15 },
        'USNYC': { baseline: 45, volatility: 10 },
        'USLGB': { baseline: 55, volatility: 12 },
        'USSEA': { baseline: 40, volatility: 8 },
        'USHOU': { baseline: 35, volatility: 8 }
    };

    const portData = baselineData[portCode] || { baseline: 50, volatility: 10 };
    const forecast = [];

    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        const dayOfWeek = date.getDay();
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.8 : 1.2;
        
        const congestion = Math.max(0, Math.min(100,
            portData.baseline + 
            (Math.random() - 0.5) * portData.volatility * 2 * weekendFactor
        ));

        forecast.push({
            date: date.toISOString().split('T')[0],
            congestionLevel: congestion.toFixed(1),
            severity: 
                congestion > 80 ? 'SEVERE' :
                congestion > 60 ? 'HIGH' :
                congestion > 40 ? 'MODERATE' : 'LOW',
            estimatedWaitTime: (congestion * 0.15).toFixed(1) + ' hours',
            recommendations: generateCongestionRecommendations(congestion)
        });
    }

    return {
        portCode,
        portName: getPortName(portCode),
        forecast,
        confidence: (Math.random() * 0.1 + 0.8).toFixed(2), // 80-90%
        lastUpdated: new Date().toISOString(),
        dataSource: 'ML Model v2.4 (Historical + Real-time)'
    };
}

function predictDelay(container, route, carrier) {
    const baseDelay = Math.random() * 48; // 0-48 hours base delay
    const routeComplexity = getRouteComplexity(route);
    const carrierPerformance = getCarrierReliability(carrier);
    
    const predictedDelay = baseDelay * 
        (1 + routeComplexity / 100) * 
        (2 - carrierPerformance / 100);

    return {
        hours: Math.round(predictedDelay),
        probability: Math.random() * 0.2 + 0.7, // 70-90%
        range: {
            min: Math.round(predictedDelay * 0.7),
            max: Math.round(predictedDelay * 1.3)
        }
    };
}

// Utility functions
function generateDocumentId() {
    return 'DOC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateExtractedEntities(docType) {
    const entityTemplates = {
        'Bill of Lading': {
            containerNumbers: ['MSKU' + Math.floor(Math.random() * 9000000 + 1000000)],
            shippingLine: 'MAERSK LINE',
            vessel: 'MAERSK ' + ['BROOKLYN', 'EDINBURGH', 'DENVER', 'OHIO'][Math.floor(Math.random() * 4)],
            voyage: Math.floor(Math.random() * 900 + 100) + 'W',
            portOfLoading: ['SHANGHAI', 'NINGBO', 'QINGDAO'][Math.floor(Math.random() * 3)],
            portOfDischarge: ['LOS ANGELES', 'LONG BEACH', 'NEW YORK'][Math.floor(Math.random() * 3)]
        },
        'Commercial Invoice': {
            invoiceNumber: 'INV-2025-' + Math.floor(Math.random() * 9000 + 1000),
            totalAmount: '$' + (Math.floor(Math.random() * 90000 + 10000)).toLocaleString(),
            shipper: ['ACME CORP', 'GLOBAL TRADE CO', 'PACIFIC EXPORTS'][Math.floor(Math.random() * 3)],
            consignee: ['US IMPORTS LLC', 'AMERICAN TRADE INC', 'WEST COAST DIST'][Math.floor(Math.random() * 3)]
        }
    };

    return entityTemplates[docType] || {};
}

function getPortCongestion(portCode) {
    const congestionLevels = {
        'USLAX': 65 + Math.random() * 20,
        'USNYC': 45 + Math.random() * 15,
        'USLGB': 55 + Math.random() * 15,
        'USSEA': 40 + Math.random() * 10,
        'USHOU': 35 + Math.random() * 10
    };
    return congestionLevels[portCode] || 50 + Math.random() * 20;
}

function getCarrierReliability(carrierCode) {
    const reliability = {
        'MAERSK': 85 + Math.random() * 10,
        'MSC': 80 + Math.random() * 10,
        'CMA': 82 + Math.random() * 8,
        'COSCO': 78 + Math.random() * 10,
        'EVERGREEN': 83 + Math.random() * 7
    };
    return reliability[carrierCode] || 75 + Math.random() * 15;
}

function getRouteComplexity(route) {
    // Simplified route complexity calculation
    const transhipments = route.transhipments || 0;
    const distance = route.distance || 5000;
    return Math.min(100, transhipments * 20 + distance / 200);
}

function generateRiskRecommendations(riskScore, freeTime) {
    const recommendations = [];
    
    if (riskScore >= 80) {
        recommendations.push({
            priority: 'URGENT',
            action: 'Schedule immediate container pickup',
            timeframe: '< 4 hours',
            impact: 'Prevent critical D&D charges'
        });
    } else if (riskScore >= 60) {
        recommendations.push({
            priority: 'HIGH',
            action: 'Arrange pickup within 24 hours',
            timeframe: '< 24 hours',
            impact: 'Minimize accumulating charges'
        });
    }
    
    if (freeTime < 48) {
        recommendations.push({
            priority: 'MEDIUM',
            action: 'Request free time extension',
            timeframe: '< 48 hours',
            impact: 'Gain additional buffer time'
        });
    }
    
    return recommendations;
}

function calculateEstimatedCharges(riskScore, freeTime) {
    const dailyRate = 250; // Base daily rate
    const riskMultiplier = riskScore / 100;
    const daysAtRisk = Math.max(0, 5 - (freeTime / 24));
    
    return {
        detention: Math.round(dailyRate * daysAtRisk * riskMultiplier * 0.6),
        demurrage: Math.round(dailyRate * daysAtRisk * riskMultiplier * 0.4),
        total: Math.round(dailyRate * daysAtRisk * riskMultiplier),
        currency: 'USD'
    };
}

function getPortName(portCode) {
    const portNames = {
        'USLAX': 'Los Angeles, CA',
        'USNYC': 'New York, NY',
        'USLGB': 'Long Beach, CA',
        'USSEA': 'Seattle, WA',
        'USHOU': 'Houston, TX'
    };
    return portNames[portCode] || portCode;
}

function generateCongestionRecommendations(congestionLevel) {
    if (congestionLevel > 70) {
        return 'Consider alternative pickup times or expedited processing';
    } else if (congestionLevel > 50) {
        return 'Schedule appointments during off-peak hours';
    }
    return 'Normal operations - standard scheduling recommended';
}

function calculateCurrentCosts(shipmentData) {
    return {
        detention: 15000,
        demurrage: 12000,
        storage: 5000,
        handling: 3000,
        total: 35000
    };
}

function calculateOptimizedCosts(shipmentData) {
    return {
        detention: 1500,
        demurrage: 1200,
        storage: 500,
        handling: 3000,
        total: 6200
    };
}

function generateCostRecommendations(shipmentData) {
    return [
        {
            action: 'Implement predictive pickup scheduling',
            savings: '$8,500',
            effort: 'Low',
            timeframe: 'Immediate'
        },
        {
            action: 'Automate free time extension requests',
            savings: '$4,200',
            effort: 'Medium',
            timeframe: '1 week'
        },
        {
            action: 'Optimize carrier selection',
            savings: '$3,800',
            effort: 'Medium',
            timeframe: '2 weeks'
        }
    ];
}

function evaluateRule(rule, data) {
    // Simplified rule evaluation
    switch (rule.condition.type) {
        case 'risk_threshold':
            return data.riskScore >= rule.condition.value;
        case 'time_threshold':
            return data.freeTime <= rule.condition.value;
        case 'cost_threshold':
            return data.estimatedCost >= rule.condition.value;
        default:
            return false;
    }
}

function executeAction(action, data) {
    return {
        actionType: action.type,
        status: 'executed',
        timestamp: new Date().toISOString(),
        result: action.type === 'notification' ? 'Alert sent' : 'Action completed'
    };
}

// Health check endpoint
app.get('/api/ai/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ai-ml-demo',
        version: '2.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`AI/ML Demo API running on port ${PORT}`);
});

module.exports = app;