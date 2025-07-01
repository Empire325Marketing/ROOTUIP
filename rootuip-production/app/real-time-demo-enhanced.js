#!/usr/bin/env node

/**
 * ROOTUIP Enhanced Real-Time Demo Platform
 * Generates realistic container tracking data with live updates
 */

const express = require('express');
const realtimeEmitter = require('./lib/realtime-emitter');
const { logger, metrics } = require('./lib/monitoring');
require('dotenv').config();

const app = express();
const PORT = process.env.DEMO_PLATFORM_PORT || 3001;

// Container simulation data
const containerSimulation = {
    containers: new Map(),
    routes: [
        { from: 'Shanghai', to: 'Los Angeles', duration: 14 },
        { from: 'Singapore', to: 'Rotterdam', duration: 21 },
        { from: 'Hong Kong', to: 'New York', duration: 28 },
        { from: 'Dubai', to: 'Hamburg', duration: 18 },
        { from: 'Tokyo', to: 'Long Beach', duration: 10 }
    ],
    carriers: ['Maersk', 'MSC', 'CMA CGM', 'COSCO', 'Hapag-Lloyd'],
    statuses: [
        { status: 'departed', weight: 0.15 },
        { status: 'in_transit', weight: 0.60 },
        { status: 'arriving', weight: 0.15 },
        { status: 'delivered', weight: 0.10 }
    ]
};

// Initialize container fleet
function initializeContainers(count = 500) {
    for (let i = 0; i < count; i++) {
        const containerNumber = generateContainerNumber();
        const route = containerSimulation.routes[Math.floor(Math.random() * containerSimulation.routes.length)];
        const carrier = containerSimulation.carriers[Math.floor(Math.random() * containerSimulation.carriers.length)];
        const progress = Math.random();
        
        const container = {
            containerNumber,
            carrier,
            origin: route.from,
            destination: route.to,
            status: calculateStatus(progress),
            progress,
            location: calculateLocation(route, progress),
            eta: calculateETA(route, progress),
            riskScore: Math.random() * 0.5, // 0-0.5 initially
            temperature: 2 + Math.random() * 4, // 2-6°C for reefer
            humidity: 45 + Math.random() * 10, // 45-55%
            lastUpdate: new Date(),
            alerts: [],
            documents: generateDocuments(),
            financials: {
                detentionRisk: Math.random() * 0.3,
                demurrageRisk: Math.random() * 0.3,
                estimatedCharges: Math.floor(Math.random() * 5000)
            }
        };
        
        containerSimulation.containers.set(containerNumber, container);
    }
    
    logger.info('Container fleet initialized', { count });
}

// Generate realistic container number
function generateContainerNumber() {
    const prefixes = ['MSKU', 'MSCU', 'CMAU', 'COSU', 'HLCU'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const numbers = Math.floor(Math.random() * 9000000) + 1000000;
    return `${prefix}${numbers}`;
}

// Calculate container status based on progress
function calculateStatus(progress) {
    if (progress < 0.1) return 'departed';
    if (progress < 0.85) return 'in_transit';
    if (progress < 0.95) return 'arriving';
    return 'delivered';
}

// Calculate current location
function calculateLocation(route, progress) {
    const locations = {
        'Shanghai-Los Angeles': ['Shanghai Port', 'East China Sea', 'Pacific Ocean', 'Port of LA'],
        'Singapore-Rotterdam': ['Singapore Port', 'Strait of Malacca', 'Indian Ocean', 'Suez Canal', 'Mediterranean', 'Rotterdam'],
        'Hong Kong-New York': ['Hong Kong Port', 'South China Sea', 'Pacific Ocean', 'Panama Canal', 'Atlantic Ocean', 'Port Newark'],
        'Dubai-Hamburg': ['Jebel Ali', 'Arabian Sea', 'Red Sea', 'Suez Canal', 'Mediterranean', 'Hamburg Port'],
        'Tokyo-Long Beach': ['Tokyo Port', 'Pacific Ocean', 'Port of Long Beach']
    };
    
    const routeKey = `${route.from}-${route.to}`;
    const routeLocations = locations[routeKey] || [route.from, 'In Transit', route.to];
    const locationIndex = Math.floor(progress * (routeLocations.length - 1));
    
    return routeLocations[locationIndex];
}

// Calculate ETA
function calculateETA(route, progress) {
    const remainingDays = Math.ceil(route.duration * (1 - progress));
    const eta = new Date();
    eta.setDate(eta.getDate() + remainingDays);
    return eta;
}

// Generate documents
function generateDocuments() {
    return {
        billOfLading: { status: 'verified', confidence: 0.98 },
        customsDeclaration: { status: 'pending', confidence: 0.85 },
        packingList: { status: 'verified', confidence: 0.95 },
        commercialInvoice: { status: 'processing', confidence: 0.90 }
    };
}

// Real-time update simulation
async function simulateRealTimeUpdates() {
    const containers = Array.from(containerSimulation.containers.values());
    const updateBatch = [];
    
    // Update 10-20 containers per cycle
    const updateCount = Math.floor(Math.random() * 10) + 10;
    const selectedContainers = containers
        .sort(() => Math.random() - 0.5)
        .slice(0, updateCount);
    
    for (const container of selectedContainers) {
        // Progress container
        if (container.status !== 'delivered') {
            container.progress = Math.min(1, container.progress + (Math.random() * 0.05));
            container.status = calculateStatus(container.progress);
            
            const route = containerSimulation.routes.find(r => 
                r.from === container.origin && r.to === container.destination
            );
            
            if (route) {
                container.location = calculateLocation(route, container.progress);
                container.eta = calculateETA(route, container.progress);
            }
        }
        
        // Update risk scores
        const oldRiskScore = container.riskScore;
        container.riskScore = calculateRiskScore(container);
        
        // Temperature fluctuation for reefers
        container.temperature += (Math.random() - 0.5) * 0.5;
        container.temperature = Math.max(0, Math.min(8, container.temperature));
        
        // Check for alerts
        const alerts = checkForAlerts(container);
        if (alerts.length > 0) {
            container.alerts = alerts;
            
            // Emit critical alerts
            for (const alert of alerts) {
                if (alert.severity === 'critical') {
                    await realtimeEmitter.emitCriticalAlert(alert.message, {
                        containerNumber: container.containerNumber,
                        alert
                    });
                }
            }
        }
        
        container.lastUpdate = new Date();
        
        // Prepare update for emission
        updateBatch.push({
            containerNumber: container.containerNumber,
            update: {
                status: container.status,
                location: container.location,
                progress: container.progress,
                eta: container.eta,
                riskScore: container.riskScore,
                temperature: container.temperature,
                alerts: container.alerts
            }
        });
        
        // Emit risk score change if significant
        if (Math.abs(oldRiskScore - container.riskScore) > 0.1) {
            await realtimeEmitter.emitRiskScoreUpdate(
                container.containerNumber,
                container.riskScore,
                calculateRiskFactors(container)
            );
        }
        
        // Record metrics
        metrics.recordBusinessMetric('container_tracked', { 
            containerNumber: container.containerNumber 
        });
    }
    
    // Emit batch updates
    await realtimeEmitter.emitBatchContainerUpdates(updateBatch);
    
    // Emit aggregated metrics
    const aggregatedMetrics = calculateAggregatedMetrics();
    await realtimeEmitter.emitMetrics(aggregatedMetrics);
    
    const kpis = calculateKPIs();
    await realtimeEmitter.emitKPIs(kpis);
}

// Calculate risk score
function calculateRiskScore(container) {
    let riskScore = 0;
    
    // Delay risk
    if (container.progress < 0.8 && container.eta < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) {
        riskScore += 0.3;
    }
    
    // Temperature risk for reefers
    if (container.temperature < 1 || container.temperature > 7) {
        riskScore += 0.25;
    }
    
    // Document risk
    const pendingDocs = Object.values(container.documents).filter(d => d.status === 'pending').length;
    riskScore += pendingDocs * 0.1;
    
    // Financial risk
    riskScore += container.financials.detentionRisk * 0.2;
    riskScore += container.financials.demurrageRisk * 0.2;
    
    // Random fluctuation
    riskScore += (Math.random() - 0.5) * 0.1;
    
    return Math.max(0, Math.min(1, riskScore));
}

// Calculate risk factors
function calculateRiskFactors(container) {
    const factors = [];
    
    if (container.progress < 0.8 && container.eta < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) {
        factors.push({ factor: 'delivery_delay', impact: 0.3 });
    }
    
    if (container.temperature < 1 || container.temperature > 7) {
        factors.push({ factor: 'temperature_deviation', impact: 0.25 });
    }
    
    if (container.financials.detentionRisk > 0.5) {
        factors.push({ factor: 'detention_risk', impact: container.financials.detentionRisk });
    }
    
    return factors;
}

// Check for alerts
function checkForAlerts(container) {
    const alerts = [];
    
    // Temperature alert
    if (container.temperature < 1 || container.temperature > 7) {
        alerts.push({
            type: 'temperature',
            severity: 'critical',
            message: `Temperature out of range: ${container.temperature.toFixed(1)}°C`,
            timestamp: new Date()
        });
    }
    
    // Delay alert
    if (container.progress < 0.8 && container.eta < new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)) {
        alerts.push({
            type: 'delay',
            severity: 'warning',
            message: 'Container at risk of delayed delivery',
            timestamp: new Date()
        });
    }
    
    // High risk alert
    if (container.riskScore > 0.7) {
        alerts.push({
            type: 'high_risk',
            severity: 'critical',
            message: `High risk score: ${(container.riskScore * 100).toFixed(0)}%`,
            timestamp: new Date()
        });
    }
    
    return alerts;
}

// Calculate aggregated metrics
function calculateAggregatedMetrics() {
    const containers = Array.from(containerSimulation.containers.values());
    
    return {
        totalContainers: containers.length,
        activeContainers: containers.filter(c => c.status !== 'delivered').length,
        deliveredToday: containers.filter(c => 
            c.status === 'delivered' && 
            c.lastUpdate > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        averageRiskScore: containers.reduce((sum, c) => sum + c.riskScore, 0) / containers.length,
        criticalAlerts: containers.filter(c => 
            c.alerts.some(a => a.severity === 'critical')
        ).length,
        onTimeDeliveryRate: 0.942, // Simulated
        averageTransitTime: 18.5, // days
        systemUptime: 0.9997
    };
}

// Calculate KPIs
function calculateKPIs() {
    const containers = Array.from(containerSimulation.containers.values());
    const totalValue = containers.reduce((sum, c) => sum + c.financials.estimatedCharges, 0);
    
    return {
        revenueAtRisk: containers
            .filter(c => c.riskScore > 0.5)
            .reduce((sum, c) => sum + c.financials.estimatedCharges, 0),
        potentialSavings: totalValue * 0.15, // 15% savings potential
        detentionFeesAvoided: containers
            .filter(c => c.financials.detentionRisk < 0.2)
            .length * 250, // $250 per container
        customerSatisfactionScore: 4.8, // out of 5
        apiResponseTime: 45 + Math.random() * 10, // ms
        documentProcessingAccuracy: 0.98 + Math.random() * 0.01
    };
}

// API Endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'real-time-demo',
        containers: containerSimulation.containers.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/containers', (req, res) => {
    const containers = Array.from(containerSimulation.containers.values());
    res.json({
        total: containers.length,
        containers: containers.slice(0, 100) // First 100 for demo
    });
});

app.get('/api/containers/:containerNumber', (req, res) => {
    const container = containerSimulation.containers.get(req.params.containerNumber);
    if (container) {
        res.json(container);
    } else {
        res.status(404).json({ error: 'Container not found' });
    }
});

app.get('/api/metrics', (req, res) => {
    res.json(calculateAggregatedMetrics());
});

app.get('/api/kpis', (req, res) => {
    res.json(calculateKPIs());
});

// Start server and simulation
app.listen(PORT, () => {
    logger.info(`🚀 Real-time demo platform running on port ${PORT}`);
    
    // Initialize containers
    initializeContainers(500);
    
    // Start real-time updates every 3 seconds
    setInterval(simulateRealTimeUpdates, 3000);
    
    // Emit system status
    realtimeEmitter.emitSystemStatus('demo-platform', 'online', {
        containers: containerSimulation.containers.size,
        updateInterval: '3s'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Shutting down real-time demo platform');
    await realtimeEmitter.close();
    process.exit(0);
});