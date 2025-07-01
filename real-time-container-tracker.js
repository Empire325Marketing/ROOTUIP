#!/usr/bin/env node

/**
 * ROOTUIP Real-Time Container Tracking Service
 * Live container status updates and D&D risk monitoring
 */

const express = require('express');
const redis = require('redis');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.CONTAINER_TRACKER_PORT || 3021;

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());

// Container tracking data
const trackedContainers = new Map();
const carrierAPIs = {
    maersk: 'https://api.maersk.com/track',
    msc: 'https://api.msc.com/track',
    hapag: 'https://api.hapag-lloyd.com/track'
};

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for container tracking');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// D&D Risk Calculation Algorithm
function calculateDemurrageRisk(container) {
    let riskScore = 0;
    
    // Time at port factor
    const hoursAtPort = container.hoursAtPort || 0;
    if (hoursAtPort > 168) riskScore += 0.4; // 7+ days
    else if (hoursAtPort > 120) riskScore += 0.3; // 5+ days
    else if (hoursAtPort > 72) riskScore += 0.2; // 3+ days
    
    // Port congestion factor
    const congestionLevel = container.portCongestion || 'low';
    if (congestionLevel === 'high') riskScore += 0.3;
    else if (congestionLevel === 'medium') riskScore += 0.2;
    
    // Documentation status
    if (container.documentsIncomplete) riskScore += 0.2;
    
    // Weather conditions
    if (container.weatherDelay) riskScore += 0.1;
    
    // Historical performance of port
    const portPerformance = container.portEfficiency || 0.9;
    riskScore += (1 - portPerformance) * 0.2;
    
    // Customs processing time
    const customsDelay = container.customsProcessingHours || 0;
    if (customsDelay > 48) riskScore += 0.15;
    
    return Math.min(Math.max(riskScore, 0), 1); // Clamp between 0 and 1
}

// Real-time container update function
async function updateContainerStatus(containerId, newData) {
    try {
        const existingContainer = trackedContainers.get(containerId) || {};
        
        const updatedContainer = {
            ...existingContainer,
            ...newData,
            id: containerId,
            lastUpdate: new Date().toISOString(),
            demurrageRisk: calculateDemurrageRisk({ ...existingContainer, ...newData }),
            riskLevel: getRiskLevel(calculateDemurrageRisk({ ...existingContainer, ...newData }))
        };
        
        trackedContainers.set(containerId, updatedContainer);
        
        // Publish to Redis for real-time updates
        await redisClient.publish('container-updates', JSON.stringify(updatedContainer));
        
        // Check for alerts
        await checkForAlerts(updatedContainer);
        
        console.log(`📦 Container ${containerId} updated - Risk: ${(updatedContainer.demurrageRisk * 100).toFixed(1)}%`);
        
        return updatedContainer;
    } catch (error) {
        console.error('Error updating container:', error);
        throw error;
    }
}

function getRiskLevel(riskScore) {
    if (riskScore >= 0.7) return 'critical';
    if (riskScore >= 0.4) return 'warning';
    if (riskScore >= 0.2) return 'caution';
    return 'low';
}

// Alert checking
async function checkForAlerts(container) {
    const alerts = [];
    
    if (container.demurrageRisk >= 0.7) {
        alerts.push({
            type: 'critical',
            message: `Container ${container.id} has critical demurrage risk (${(container.demurrageRisk * 100).toFixed(1)}%)`,
            containerId: container.id,
            priority: 1
        });
    } else if (container.demurrageRisk >= 0.4) {
        alerts.push({
            type: 'warning',
            message: `Container ${container.id} approaching demurrage threshold (${(container.demurrageRisk * 100).toFixed(1)}%)`,
            containerId: container.id,
            priority: 2
        });
    }
    
    if (container.temperature && (parseFloat(container.temperature) > 25 || parseFloat(container.temperature) < -10)) {
        alerts.push({
            type: 'warning',
            message: `Container ${container.id} temperature out of range: ${container.temperature}°C`,
            containerId: container.id,
            priority: 2
        });
    }
    
    if (container.status === 'Delayed') {
        alerts.push({
            type: 'info',
            message: `Container ${container.id} is delayed at ${container.location}`,
            containerId: container.id,
            priority: 3
        });
    }
    
    // Publish alerts
    for (const alert of alerts) {
        await redisClient.publish('alerts', JSON.stringify(alert));
    }
}

// Simulate real-time tracking updates
async function simulateRealTimeTracking() {
    const containers = [
        {
            id: 'MSKU1234567',
            carrier: 'Maersk',
            vessel: 'Ever Given',
            voyage: 'MS240615',
            origin: 'Singapore',
            destination: 'Los Angeles',
            cargoType: 'Electronics'
        },
        {
            id: 'MSCU2345678',
            carrier: 'MSC',
            vessel: 'MSC Gülsün',
            voyage: 'MC240620',
            origin: 'Rotterdam',
            destination: 'New York',
            cargoType: 'Automotive'
        },
        {
            id: 'HLBU3456789',
            carrier: 'Hapag-Lloyd',
            vessel: 'Berlin Express',
            voyage: 'HL240625',
            origin: 'Hamburg',
            destination: 'Shanghai',
            cargoType: 'Machinery'
        },
        {
            id: 'EVGU4567890',
            carrier: 'Evergreen',
            vessel: 'Ever Golden',
            voyage: 'EG240630',
            origin: 'Los Angeles',
            destination: 'Tokyo',
            cargoType: 'Consumer Goods'
        }
    ];
    
    const locations = [
        { name: 'Singapore Port', lat: 1.2966, lng: 103.8006 },
        { name: 'Los Angeles Port', lat: 33.7461, lng: -118.2481 },
        { name: 'Rotterdam Port', lat: 51.9225, lng: 4.47917 },
        { name: 'Hamburg Port', lat: 53.5458, lng: 9.9679 },
        { name: 'Shanghai Port', lat: 31.2304, lng: 121.4737 },
        { name: 'New York Port', lat: 40.6892, lng: -74.0445 },
        { name: 'Tokyo Port', lat: 35.6762, lng: 139.6503 },
        { name: 'Suez Canal', lat: 30.0444, lng: 31.2357 },
        { name: 'Panama Canal', lat: 9.0820, lng: -79.6805 },
        { name: 'At Sea - Pacific', lat: 20.0, lng: -140.0 },
        { name: 'At Sea - Atlantic', lat: 30.0, lng: -50.0 }
    ];
    
    const statuses = ['In Transit', 'At Port', 'Loading', 'Unloading', 'Customs Clearance', 'Discharged', 'Available for Pickup'];
    
    // Initialize containers
    for (const container of containers) {
        await updateContainerStatus(container.id, {
            ...container,
            status: 'In Transit',
            location: locations[Math.floor(Math.random() * locations.length)].name,
            latitude: locations[Math.floor(Math.random() * locations.length)].lat,
            longitude: locations[Math.floor(Math.random() * locations.length)].lng,
            hoursAtPort: Math.floor(Math.random() * 200),
            portCongestion: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            documentsIncomplete: Math.random() < 0.3,
            weatherDelay: Math.random() < 0.2,
            portEfficiency: Math.random() * 0.3 + 0.7,
            customsProcessingHours: Math.floor(Math.random() * 72),
            temperature: (Math.random() * 30 - 5).toFixed(1),
            humidity: (Math.random() * 40 + 40).toFixed(1),
            eta: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        });
    }
    
    // Update containers every 30 seconds
    setInterval(async () => {
        for (const container of containers) {
            const currentData = trackedContainers.get(container.id);
            if (!currentData) continue;
            
            const updates = {};
            
            // Random status change
            if (Math.random() < 0.3) {
                updates.status = statuses[Math.floor(Math.random() * statuses.length)];
            }
            
            // Random location change
            if (Math.random() < 0.2) {
                const newLocation = locations[Math.floor(Math.random() * locations.length)];
                updates.location = newLocation.name;
                updates.latitude = newLocation.lat + (Math.random() - 0.5) * 0.1;
                updates.longitude = newLocation.lng + (Math.random() - 0.5) * 0.1;
            }
            
            // Update time at port
            if (currentData.status === 'At Port' || currentData.status === 'Loading' || currentData.status === 'Unloading') {
                updates.hoursAtPort = (currentData.hoursAtPort || 0) + 0.5;
            }
            
            // Random environmental changes
            if (Math.random() < 0.4) {
                updates.temperature = (parseFloat(currentData.temperature) + (Math.random() - 0.5) * 2).toFixed(1);
                updates.humidity = Math.max(20, Math.min(90, parseFloat(currentData.humidity) + (Math.random() - 0.5) * 5)).toFixed(1);
            }
            
            // Update congestion levels
            if (Math.random() < 0.1) {
                updates.portCongestion = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
            }
            
            // Document status changes
            if (Math.random() < 0.05) {
                updates.documentsIncomplete = Math.random() < 0.3;
            }
            
            if (Object.keys(updates).length > 0) {
                await updateContainerStatus(container.id, updates);
            }
        }
    }, 30000); // Every 30 seconds
}

// API Endpoints
app.get('/api/containers', (req, res) => {
    const containers = Array.from(trackedContainers.values());
    res.json({
        success: true,
        containers,
        total: containers.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/containers/:id', (req, res) => {
    const container = trackedContainers.get(req.params.id);
    if (!container) {
        return res.status(404).json({ error: 'Container not found' });
    }
    res.json({ success: true, container });
});

app.post('/api/containers/:id/update', async (req, res) => {
    try {
        const container = await updateContainerStatus(req.params.id, req.body);
        res.json({ success: true, container });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/containers/:id/risk', (req, res) => {
    const container = trackedContainers.get(req.params.id);
    if (!container) {
        return res.status(404).json({ error: 'Container not found' });
    }
    
    res.json({
        success: true,
        containerId: req.params.id,
        riskScore: container.demurrageRisk,
        riskLevel: container.riskLevel,
        factors: {
            hoursAtPort: container.hoursAtPort,
            portCongestion: container.portCongestion,
            documentsIncomplete: container.documentsIncomplete,
            weatherDelay: container.weatherDelay,
            customsProcessingHours: container.customsProcessingHours
        }
    });
});

app.get('/api/alerts', async (req, res) => {
    try {
        const alerts = [];
        for (const container of trackedContainers.values()) {
            if (container.demurrageRisk >= 0.4) {
                alerts.push({
                    type: container.demurrageRisk >= 0.7 ? 'critical' : 'warning',
                    containerId: container.id,
                    message: `Demurrage risk: ${(container.demurrageRisk * 100).toFixed(1)}%`,
                    riskScore: container.demurrageRisk
                });
            }
        }
        res.json({ success: true, alerts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'real-time-container-tracker',
        trackedContainers: trackedContainers.size,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Real-Time Container Tracker running on port ${PORT}`);
    console.log(`📦 Container tracking API: http://localhost:${PORT}/api/containers`);
    console.log(`🚨 Alerts API: http://localhost:${PORT}/api/alerts`);
    
    // Start simulation
    setTimeout(simulateRealTimeTracking, 2000);
});

module.exports = app;