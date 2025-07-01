#!/usr/bin/env node

/**
 * ROOTUIP Enterprise Demo Platform
 * Sophisticated Fortune 500 demonstration environment with real-time updates
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');
const cors = require('cors');
const path = require('path');
const realtimeEmitter = require('./lib/realtime-emitter');
const { logger } = require('./lib/monitoring');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.DEMO_PLATFORM_PORT || 3001;

// Socket.IO for real-time updates
const io = socketIo(server, {
    cors: {
        origin: ["https://rootuip.com", "https://demo.rootuip.com", "http://localhost:*"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Redis client for real-time data
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'demo-ui')));

// Enterprise data simulation
const enterpriseData = {
    containers: new Map(),
    vessels: new Map(),
    users: new Map(),
    alerts: [],
    performance: {
        accuracy: 94.2,
        processingTime: 1.3,
        apiUptime: 99.97,
        dataFreshness: 98.1
    },
    analytics: {
        totalContainers: 847293,
        activeShipments: 23847,
        carriersConnected: 47,
        alertsToday: 12
    }
};

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for enterprise demo platform');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Initialize enterprise demo data
function initializeEnterpriseData() {
    console.log('🏗️ Initializing enterprise demo data...');
    
    // Create sophisticated container dataset
    const carriers = ['Maersk', 'MSC', 'CMA CGM', 'COSCO', 'Hapag-Lloyd', 'ONE', 'Yang Ming', 'Evergreen'];
    const routes = [
        'Asia-Europe', 'Transpacific', 'Asia-Mediterranean', 'Europe-US East Coast',
        'Asia-US West Coast', 'Intra-Asia', 'Europe-South America', 'Middle East-Europe'
    ];
    const statuses = ['In Transit', 'At Port', 'Loading', 'Unloading', 'Customs', 'Delivered'];
    const ports = [
        { name: 'Shanghai', code: 'CNSHA', country: 'China', lat: 31.2304, lng: 121.4737 },
        { name: 'Singapore', code: 'SGSIN', country: 'Singapore', lat: 1.2966, lng: 103.8006 },
        { name: 'Rotterdam', code: 'NLRTM', country: 'Netherlands', lat: 51.9225, lng: 4.47917 },
        { name: 'Los Angeles', code: 'USLAX', country: 'United States', lat: 33.7461, lng: -118.2481 },
        { name: 'Hamburg', code: 'DEHAM', country: 'Germany', lat: 53.5511, lng: 9.9937 },
        { name: 'Antwerp', code: 'BEANR', country: 'Belgium', lat: 51.2993, lng: 4.4910 },
        { name: 'Busan', code: 'KRPUS', country: 'South Korea', lat: 35.1796, lng: 129.0756 },
        { name: 'Long Beach', code: 'USLGB', country: 'United States', lat: 33.7701, lng: -118.1937 }
    ];

    // Generate 500 realistic containers
    for (let i = 0; i < 500; i++) {
        const carrier = carriers[Math.floor(Math.random() * carriers.length)];
        const route = routes[Math.floor(Math.random() * routes.length)];
        const currentPort = ports[Math.floor(Math.random() * ports.length)];
        const destinationPort = ports[Math.floor(Math.random() * ports.length)];
        
        const containerNum = generateContainerNumber(carrier);
        const riskScore = Math.floor(Math.random() * 100);
        
        const container = {
            id: containerNum,
            carrier: carrier,
            route: route,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            currentLocation: currentPort,
            destination: destinationPort,
            eta: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000),
            etd: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            vessel: generateVesselName(carrier),
            voyage: generateVoyageNumber(),
            riskScore: riskScore,
            riskLevel: riskScore > 80 ? 'high' : riskScore > 50 ? 'medium' : 'low',
            riskFactors: generateRiskFactors(riskScore),
            aiPrediction: generateAIPrediction(),
            performance: generatePerformanceMetrics(),
            lastUpdate: new Date(),
            cargo: generateCargoInfo(),
            documentation: generateDocumentationStatus(),
            realTimeData: {
                speed: Math.floor(Math.random() * 25 + 10),
                heading: Math.floor(Math.random() * 360),
                weather: generateWeatherData(currentPort.lat, currentPort.lng)
            }
        };
        
        enterpriseData.containers.set(containerNum, container);
    }
    
    console.log(`✅ Generated ${enterpriseData.containers.size} enterprise containers`);
}

function generateContainerNumber(carrier) {
    const prefixes = {
        'Maersk': 'MAEU',
        'MSC': 'MSCU',
        'CMA CGM': 'CMAU',
        'COSCO': 'COSU',
        'Hapag-Lloyd': 'HLBU',
        'ONE': 'ONEU',
        'Yang Ming': 'YMLU',
        'Evergreen': 'EVGU'
    };
    
    const prefix = prefixes[carrier] || 'GENR';
    const number = Math.floor(Math.random() * 9000000 + 1000000);
    return `${prefix}${number}`;
}

function generateVesselName(carrier) {
    const vesselNames = {
        'Maersk': ['Maersk Sentosa', 'Madrid Maersk', 'Maersk Gibraltar', 'Maersk Kensington'],
        'MSC': ['MSC Gulsun', 'MSC Mina', 'MSC Lucinda', 'MSC Isabella'],
        'CMA CGM': ['CMA CGM Antoine de Saint Exupery', 'CMA CGM Jacques Saade', 'CMA CGM Champs Elysees'],
        'COSCO': ['COSCO Shipping Universe', 'COSCO Shipping Galaxy', 'COSCO Shipping Solar'],
        'Hapag-Lloyd': ['Hapag-Lloyd Berlin', 'Hapag-Lloyd Hamburg', 'Hapag-Lloyd Munich']
    };
    
    const names = vesselNames[carrier] || ['Generic Vessel'];
    return names[Math.floor(Math.random() * names.length)];
}

function generateVoyageNumber() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter1 = letters[Math.floor(Math.random() * letters.length)];
    const letter2 = letters[Math.floor(Math.random() * letters.length)];
    const number = Math.floor(Math.random() * 9000 + 1000);
    return `${letter1}${letter2}${number}`;
}

function generateRiskFactors(riskScore) {
    const factors = [];
    
    if (riskScore > 70) {
        factors.push(
            { factor: 'Port Congestion', impact: 'High', score: 85 },
            { factor: 'Weather Delays', impact: 'Medium', score: 65 },
            { factor: 'Documentation Issues', impact: 'Low', score: 25 }
        );
    } else if (riskScore > 40) {
        factors.push(
            { factor: 'Customs Delays', impact: 'Medium', score: 55 },
            { factor: 'Schedule Variance', impact: 'Low', score: 35 }
        );
    } else {
        factors.push(
            { factor: 'On Schedule', impact: 'Positive', score: -20 },
            { factor: 'Optimal Route', impact: 'Positive', score: -15 }
        );
    }
    
    return factors;
}

function generateAIPrediction() {
    return {
        arrivalPrediction: {
            confidence: Math.floor(Math.random() * 20 + 80),
            variance: Math.floor(Math.random() * 48),
            factors: ['Historical Performance', 'Weather Patterns', 'Port Efficiency', 'Route Optimization']
        },
        riskAssessment: {
            probability: Math.floor(Math.random() * 100),
            timeline: Math.floor(Math.random() * 14 + 1),
            mitigation: ['Alternative Routing', 'Priority Processing', 'Carrier Coordination']
        }
    };
}

function generatePerformanceMetrics() {
    return {
        onTimePerformance: Math.floor(Math.random() * 30 + 70),
        costEfficiency: Math.floor(Math.random() * 25 + 75),
        documentAccuracy: Math.floor(Math.random() * 15 + 85),
        carrierReliability: Math.floor(Math.random() * 20 + 80)
    };
}

function generateCargoInfo() {
    const commodities = ['Electronics', 'Automotive Parts', 'Textiles', 'Machinery', 'Consumer Goods', 'Chemicals', 'Food Products'];
    const containerTypes = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF'];
    
    return {
        commodity: commodities[Math.floor(Math.random() * commodities.length)],
        containerType: containerTypes[Math.floor(Math.random() * containerTypes.length)],
        weight: Math.floor(Math.random() * 25000 + 5000),
        value: Math.floor(Math.random() * 500000 + 50000),
        hazardous: Math.random() > 0.9
    };
}

function generateDocumentationStatus() {
    const documents = ['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Insurance Certificate'];
    const statuses = ['Complete', 'Pending', 'Missing', 'Under Review'];
    
    return documents.map(doc => ({
        document: doc,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        lastUpdate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }));
}

function generateWeatherData(lat, lng) {
    return {
        condition: ['Clear', 'Cloudy', 'Rain', 'Storm'][Math.floor(Math.random() * 4)],
        temperature: Math.floor(Math.random() * 30 + 10),
        windSpeed: Math.floor(Math.random() * 20 + 5),
        visibility: Math.floor(Math.random() * 10 + 5),
        seaState: Math.floor(Math.random() * 6 + 1)
    };
}

// Real-time data simulation
function startRealTimeSimulation() {
    console.log('🔄 Starting real-time enterprise data simulation...');
    
    // Update container data every 30 seconds
    setInterval(() => {
        updateContainerData();
        broadcastUpdates();
    }, 30000);
    
    // Generate alerts every 2 minutes
    setInterval(() => {
        generateRealtimeAlert();
    }, 120000);
    
    // Update performance metrics every 5 minutes
    setInterval(() => {
        updatePerformanceMetrics();
    }, 300000);
}

function updateContainerData() {
    let updatedCount = 0;
    
    for (const [id, container] of enterpriseData.containers) {
        // 20% chance each container gets updated
        if (Math.random() < 0.2) {
            // Update risk score with slight variation
            const riskChange = (Math.random() - 0.5) * 10;
            container.riskScore = Math.max(0, Math.min(100, container.riskScore + riskChange));
            container.riskLevel = container.riskScore > 80 ? 'high' : container.riskScore > 50 ? 'medium' : 'low';
            
            // Update location slightly
            if (container.realTimeData) {
                container.realTimeData.speed = Math.floor(Math.random() * 25 + 10);
                container.realTimeData.heading = Math.floor(Math.random() * 360);
            }
            
            container.lastUpdate = new Date();
            updatedCount++;
        }
    }
    
    if (updatedCount > 0) {
        console.log(`📊 Updated ${updatedCount} containers with real-time data`);
    }
}

function generateRealtimeAlert() {
    const alertTypes = [
        'High Risk Container Detected',
        'Port Congestion Alert',
        'Weather Delay Forecast',
        'Documentation Missing',
        'Customs Hold',
        'Schedule Deviation',
        'Temperature Breach'
    ];
    
    const severities = ['low', 'medium', 'high', 'critical'];
    const containers = Array.from(enterpriseData.containers.keys());
    
    const alert = {
        id: 'ALERT-' + Date.now(),
        type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        container: containers[Math.floor(Math.random() * containers.length)],
        message: generateAlertMessage(),
        timestamp: new Date(),
        acknowledged: false
    };
    
    enterpriseData.alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (enterpriseData.alerts.length > 50) {
        enterpriseData.alerts = enterpriseData.alerts.slice(0, 50);
    }
    
    console.log(`🚨 Generated alert: ${alert.type} for ${alert.container}`);
}

function generateAlertMessage() {
    const messages = [
        'Container experiencing delays due to port congestion',
        'High-value cargo requires additional security measures',
        'Weather conditions may impact scheduled arrival',
        'Missing documentation detected - action required',
        'Container selected for customs inspection',
        'Vessel deviating from planned route',
        'Temperature-sensitive cargo threshold exceeded'
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
}

function updatePerformanceMetrics() {
    // Slight random updates to performance metrics
    enterpriseData.performance.accuracy += (Math.random() - 0.5) * 0.5;
    enterpriseData.performance.processingTime += (Math.random() - 0.5) * 0.2;
    enterpriseData.performance.apiUptime += (Math.random() - 0.5) * 0.1;
    enterpriseData.performance.dataFreshness += (Math.random() - 0.5) * 0.8;
    
    // Keep within realistic bounds
    enterpriseData.performance.accuracy = Math.max(90, Math.min(99, enterpriseData.performance.accuracy));
    enterpriseData.performance.processingTime = Math.max(0.8, Math.min(3.0, enterpriseData.performance.processingTime));
    enterpriseData.performance.apiUptime = Math.max(99.5, Math.min(100, enterpriseData.performance.apiUptime));
    enterpriseData.performance.dataFreshness = Math.max(95, Math.min(100, enterpriseData.performance.dataFreshness));
    
    console.log(`📈 Updated performance metrics - Accuracy: ${enterpriseData.performance.accuracy.toFixed(1)}%`);
}

function broadcastUpdates() {
    const updateData = {
        type: 'REAL_TIME_UPDATE',
        timestamp: new Date(),
        performance: enterpriseData.performance,
        analytics: {
            ...enterpriseData.analytics,
            alertsToday: enterpriseData.alerts.filter(a => 
                new Date(a.timestamp).toDateString() === new Date().toDateString()
            ).length
        },
        recentAlerts: enterpriseData.alerts.slice(0, 5)
    };
    
    io.emit('enterprise-update', updateData);
}

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`👤 Client connected to enterprise demo: ${socket.id}`);
    
    // Send initial data
    socket.emit('initial-data', {
        performance: enterpriseData.performance,
        analytics: enterpriseData.analytics,
        recentAlerts: enterpriseData.alerts.slice(0, 10),
        totalContainers: enterpriseData.containers.size
    });
    
    // Handle container tracking requests
    socket.on('track-container', (containerNumber) => {
        const container = enterpriseData.containers.get(containerNumber);
        if (container) {
            socket.emit('container-data', container);
        } else {
            socket.emit('container-not-found', { container: containerNumber });
        }
    });
    
    // Handle dashboard filter requests
    socket.on('dashboard-filter', (filters) => {
        const filteredContainers = filterContainers(filters);
        socket.emit('filtered-data', filteredContainers);
    });
    
    socket.on('disconnect', () => {
        console.log(`👤 Client disconnected: ${socket.id}`);
    });
});

function filterContainers(filters) {
    let filtered = Array.from(enterpriseData.containers.values());
    
    if (filters.carrier) {
        filtered = filtered.filter(c => c.carrier === filters.carrier);
    }
    
    if (filters.riskLevel) {
        filtered = filtered.filter(c => c.riskLevel === filters.riskLevel);
    }
    
    if (filters.status) {
        filtered = filtered.filter(c => c.status === filters.status);
    }
    
    return filtered.slice(0, 100); // Limit to 100 for performance
}

// API Endpoints
app.get('/api/enterprise/dashboard', (req, res) => {
    res.json({
        success: true,
        performance: enterpriseData.performance,
        analytics: enterpriseData.analytics,
        alerts: enterpriseData.alerts.slice(0, 20),
        timestamp: new Date()
    });
});

app.get('/api/enterprise/containers', (req, res) => {
    const { limit = 50, offset = 0, carrier, status, riskLevel } = req.query;
    
    let containers = Array.from(enterpriseData.containers.values());
    
    // Apply filters
    if (carrier) containers = containers.filter(c => c.carrier === carrier);
    if (status) containers = containers.filter(c => c.status === status);
    if (riskLevel) containers = containers.filter(c => c.riskLevel === riskLevel);
    
    // Pagination
    const total = containers.length;
    containers = containers.slice(offset, offset + parseInt(limit));
    
    res.json({
        success: true,
        containers,
        total,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit)
    });
});

app.get('/api/enterprise/container/:id', (req, res) => {
    const container = enterpriseData.containers.get(req.params.id);
    if (container) {
        res.json({ success: true, container });
    } else {
        res.status(404).json({ success: false, error: 'Container not found' });
    }
});

app.get('/api/enterprise/analytics/risk', (req, res) => {
    const containers = Array.from(enterpriseData.containers.values());
    
    const riskAnalytics = {
        distribution: {
            high: containers.filter(c => c.riskLevel === 'high').length,
            medium: containers.filter(c => c.riskLevel === 'medium').length,
            low: containers.filter(c => c.riskLevel === 'low').length
        },
        trends: generateRiskTrends(),
        topRisks: containers
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 10)
            .map(c => ({ id: c.id, score: c.riskScore, factors: c.riskFactors }))
    };
    
    res.json({ success: true, analytics: riskAnalytics });
});

function generateRiskTrends() {
    const trends = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        trends.push({
            date: date.toISOString().split('T')[0],
            high: Math.floor(Math.random() * 20 + 10),
            medium: Math.floor(Math.random() * 50 + 30),
            low: Math.floor(Math.random() * 100 + 50)
        });
    }
    return trends;
}

app.get('/api/enterprise/performance/forecast', (req, res) => {
    const forecast = generatePerformanceForecast();
    res.json({ success: true, forecast });
});

function generatePerformanceForecast() {
    const forecast = [];
    for (let i = 0; i < 14; i++) {
        const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        forecast.push({
            date: date.toISOString().split('T')[0],
            predictedDeliveries: Math.floor(Math.random() * 100 + 150),
            confidenceInterval: [
                Math.floor(Math.random() * 20 + 130),
                Math.floor(Math.random() * 20 + 200)
            ],
            riskFactors: Math.random() > 0.7 ? ['Weather', 'Port Congestion'] : []
        });
    }
    return forecast;
}

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'enterprise-demo-platform',
        containers: enterpriseData.containers.size,
        alerts: enterpriseData.alerts.length,
        connectedClients: io.sockets.sockets.size,
        uptime: process.uptime()
    });
});

// Initialize and start
initializeEnterpriseData();
startRealTimeSimulation();

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Enterprise Demo Platform running on port ${PORT}`);
    console.log(`📊 Simulating ${enterpriseData.containers.size} containers with real-time updates`);
    console.log(`🔄 WebSocket connections enabled for live dashboards`);
    console.log(`⚡ Real-time updates every 30 seconds`);
    console.log(`🌐 Demo Dashboard: http://localhost:${PORT}/dashboard`);
});

module.exports = app;