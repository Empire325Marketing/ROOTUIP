#!/usr/bin/env node

/**
 * ROOTUIP Integration API Gateway
 * Unified API gateway for all carrier integrations and data sources
 */

const express = require('express');
const axios = require('axios');
const redis = require('redis');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.INTEGRATION_GATEWAY_PORT || 3028;

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per minute
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Integration service endpoints
const INTEGRATION_SERVICES = {
    maersk: {
        url: 'http://localhost:3025',
        name: 'Maersk Live API Integration',
        status: 'unknown',
        productionMode: true,
        dataQuality: 'enhanced_production'
    },
    edi: {
        url: 'http://localhost:3026',
        name: 'EDI Processing Service',
        status: 'unknown'
    },
    email: {
        url: 'http://localhost:3027',
        name: 'Email Monitoring Service',
        status: 'unknown'
    },
    realtime: {
        url: 'http://localhost:3021',
        name: 'Real-Time Container Tracker',
        status: 'unknown'
    }
};

// Data aggregation cache
const aggregatedData = {
    containers: new Map(),
    lastUpdate: null,
    sources: []
};

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for integration gateway');
        
        // Subscribe to real-time updates from all sources
        subscribeToUpdates();
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Subscribe to Redis updates from all integration sources
function subscribeToUpdates() {
    const subscriber = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    subscriber.connect().then(() => {
        subscriber.subscribe('container-updates', (message) => {
            try {
                const updateData = JSON.parse(message);
                aggregateContainerData(updateData);
            } catch (error) {
                console.error('Error processing container update:', error);
            }
        });
        
        console.log('📡 Subscribed to real-time container updates');
    });
}

// Aggregate container data from multiple sources
function aggregateContainerData(newData) {
    const containerId = newData.id || newData.containerId;
    if (!containerId) return;
    
    const existing = aggregatedData.containers.get(containerId) || {
        containerId: containerId,
        sources: [],
        data: {},
        lastUpdate: null,
        confidence: 0
    };
    
    // Add or update source data
    const sourceIndex = existing.sources.findIndex(s => s.name === newData.source);
    const sourceData = {
        name: newData.source,
        data: newData,
        timestamp: new Date().toISOString(),
        reliability: getSourceReliability(newData.source)
    };
    
    if (sourceIndex >= 0) {
        existing.sources[sourceIndex] = sourceData;
    } else {
        existing.sources.push(sourceData);
    }
    
    // Merge data with priority based on source reliability
    existing.data = mergeContainerData(existing.sources);
    existing.lastUpdate = new Date().toISOString();
    existing.confidence = calculateDataConfidence(existing.sources);
    
    aggregatedData.containers.set(containerId, existing);
    aggregatedData.lastUpdate = new Date().toISOString();
    
    console.log(`🔄 Aggregated data for container ${containerId} from ${newData.source}`);
}

// Get source reliability score
function getSourceReliability(source) {
    const reliabilityMap = {
        'maersk_api': 0.95,
        'maersk_demo': 0.7,
        'edi_214': 0.9,
        'edi_315': 0.9,
        'edi_322': 0.85,
        'email_maersk': 0.8,
        'email_msc': 0.8,
        'email_generic': 0.6,
        'real-time-container-tracker': 0.75
    };
    
    return reliabilityMap[source] || 0.5;
}

// Merge container data from multiple sources
function mergeContainerData(sources) {
    if (sources.length === 0) return {};
    
    // Sort sources by reliability and recency
    const sortedSources = sources.sort((a, b) => {
        const reliabilityDiff = b.reliability - a.reliability;
        if (Math.abs(reliabilityDiff) > 0.1) return reliabilityDiff;
        
        // If reliability is similar, prefer more recent data
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    const mergedData = {
        containerId: sortedSources[0].data.containerId || sortedSources[0].data.id,
        sources: sources.map(s => s.name)
    };
    
    // Merge fields with priority to higher reliability sources
    const fields = ['carrier', 'status', 'location', 'vessel', 'voyage', 'eta', 'latitude', 'longitude'];
    
    for (const field of fields) {
        for (const source of sortedSources) {
            if (source.data[field] && !mergedData[field]) {
                mergedData[field] = source.data[field];
                break;
            }
        }
    }
    
    // Always use the most recent timestamp
    mergedData.lastUpdate = sortedSources[0].timestamp;
    
    // Aggregate events from all sources
    mergedData.events = [];
    for (const source of sources) {
        if (source.data.events && Array.isArray(source.data.events)) {
            mergedData.events.push(...source.data.events.map(event => ({
                ...event,
                source: source.name
            })));
        }
    }
    
    // Sort events by timestamp
    mergedData.events.sort((a, b) => new Date(b.timestamp || b.time || 0) - new Date(a.timestamp || a.time || 0));
    
    return mergedData;
}

// Calculate data confidence based on source agreement
function calculateDataConfidence(sources) {
    if (sources.length === 0) return 0;
    if (sources.length === 1) return sources[0].reliability;
    
    // Check agreement on key fields
    const keyFields = ['status', 'location', 'carrier'];
    let agreements = 0;
    let totalChecks = 0;
    
    for (const field of keyFields) {
        const values = sources.map(s => s.data[field]).filter(v => v);
        if (values.length > 1) {
            totalChecks++;
            const uniqueValues = [...new Set(values.map(v => v.toLowerCase()))];
            if (uniqueValues.length === 1) agreements++;
        }
    }
    
    const agreementScore = totalChecks > 0 ? agreements / totalChecks : 1;
    const avgReliability = sources.reduce((sum, s) => sum + s.reliability, 0) / sources.length;
    
    return Math.min(agreementScore * avgReliability * 1.1, 1);
}

// Health check for integration services
async function checkIntegrationServices() {
    for (const [serviceName, config] of Object.entries(INTEGRATION_SERVICES)) {
        try {
            const response = await axios.get(`${config.url}/health`, { timeout: 5000 });
            config.status = response.data.status === 'healthy' ? 'online' : 'degraded';
            config.lastCheck = new Date().toISOString();
        } catch (error) {
            config.status = 'offline';
            config.lastCheck = new Date().toISOString();
            config.error = error.message;
        }
    }
}

// Fetch data from all integration sources
async function fetchFromAllSources(containerId) {
    const results = {};
    
    // Try Maersk Live API integration
    try {
        const response = await axios.get(`${INTEGRATION_SERVICES.maersk.url}/api/track/${containerId}`, { timeout: 15000 });
        if (response.data.success) {
            results.maersk = {
                ...response.data.data,
                dataSource: 'maersk_live_api',
                enhancedProduction: true
            };
        }
    } catch (error) {
        console.log(`⚠️ Maersk API timeout/error for ${containerId} - this is expected during OAuth setup`);
        results.maersk = { 
            error: 'API_TIMEOUT_EXPECTED',
            message: 'Enhanced production data available via direct endpoint'
        };
    }
    
    // Check real-time tracker
    try {
        const response = await axios.get(`${INTEGRATION_SERVICES.realtime.url}/api/containers/${containerId}`, { timeout: 5000 });
        if (response.data.success) {
            results.realtime = response.data.container;
        }
    } catch (error) {
        results.realtime = { error: error.message };
    }
    
    // Check email data
    try {
        const response = await axios.get(`${INTEGRATION_SERVICES.email.url}/api/emails/containers/${containerId}`, { timeout: 5000 });
        if (response.data.success && response.data.emails.length > 0) {
            results.email = response.data.emails;
        }
    } catch (error) {
        results.email = { error: error.message };
    }
    
    return results;
}

// API Endpoints
app.get('/api/containers', async (req, res) => {
    try {
        const containers = Array.from(aggregatedData.containers.values());
        
        res.json({
            success: true,
            containers,
            total: containers.length,
            lastUpdate: aggregatedData.lastUpdate,
            sources: Object.keys(INTEGRATION_SERVICES)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/containers/:containerId', async (req, res) => {
    try {
        const { containerId } = req.params;
        const { refresh = false } = req.query;
        
        // Check aggregated data first
        let aggregated = aggregatedData.containers.get(containerId);
        
        // If no aggregated data or refresh requested, fetch from all sources
        if (!aggregated || refresh === 'true') {
            console.log(`🔍 Fetching ${containerId} from all integration sources`);
            const sourceData = await fetchFromAllSources(containerId);
            
            // Process each source response
            for (const [source, data] of Object.entries(sourceData)) {
                if (data && !data.error) {
                    aggregateContainerData({
                        ...data,
                        source: source === 'maersk' ? 'maersk_api' : source,
                        id: containerId
                    });
                }
            }
            
            aggregated = aggregatedData.containers.get(containerId);
        }
        
        if (aggregated) {
            res.json({
                success: true,
                container: aggregated.data,
                metadata: {
                    sources: aggregated.sources.map(s => s.name),
                    confidence: aggregated.confidence,
                    lastUpdate: aggregated.lastUpdate,
                    sourceCount: aggregated.sources.length
                }
            });
        } else {
            res.status(404).json({ 
                error: 'Container not found in any integrated system',
                containerId: containerId,
                searchedSources: Object.keys(INTEGRATION_SERVICES)
            });
        }
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/containers/:containerId/sources', async (req, res) => {
    try {
        const { containerId } = req.params;
        const sourceData = await fetchFromAllSources(containerId);
        
        res.json({
            success: true,
            containerId,
            sources: sourceData,
            integrationServices: INTEGRATION_SERVICES
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/integrations/status', async (req, res) => {
    try {
        await checkIntegrationServices();
        
        const summary = {
            total: Object.keys(INTEGRATION_SERVICES).length,
            online: Object.values(INTEGRATION_SERVICES).filter(s => s.status === 'online').length,
            offline: Object.values(INTEGRATION_SERVICES).filter(s => s.status === 'offline').length,
            degraded: Object.values(INTEGRATION_SERVICES).filter(s => s.status === 'degraded').length
        };
        
        res.json({
            success: true,
            summary,
            services: INTEGRATION_SERVICES,
            aggregatedContainers: aggregatedData.containers.size,
            lastAggregation: aggregatedData.lastUpdate
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/integrations/:service/test', async (req, res) => {
    try {
        const { service } = req.params;
        const config = INTEGRATION_SERVICES[service];
        
        if (!config) {
            return res.status(404).json({ error: 'Integration service not found' });
        }
        
        const response = await axios.get(`${config.url}/health`, { timeout: 10000 });
        
        res.json({
            success: true,
            service: service,
            status: response.data,
            connectionTest: 'passed'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            service: req.params.service,
            error: error.message,
            connectionTest: 'failed'
        });
    }
});

app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const results = [];
        
        // Search in aggregated data
        for (const [containerId, data] of aggregatedData.containers) {
            if (containerId.toLowerCase().includes(query.toLowerCase()) ||
                data.data.vessel?.toLowerCase().includes(query.toLowerCase()) ||
                data.data.voyage?.toLowerCase().includes(query.toLowerCase()) ||
                data.data.location?.toLowerCase().includes(query.toLowerCase())) {
                results.push(data);
            }
        }
        
        res.json({
            success: true,
            query,
            results,
            count: results.length
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'integration-api-gateway',
        integrationServices: Object.keys(INTEGRATION_SERVICES).length,
        aggregatedContainers: aggregatedData.containers.size,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Periodic health checks
setInterval(checkIntegrationServices, 60000); // Every minute

// Initial health check
setTimeout(checkIntegrationServices, 5000);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Integration API Gateway running on port ${PORT}`);
    console.log(`🔗 Integration services: ${Object.keys(INTEGRATION_SERVICES).join(', ')}`);
    console.log(`📡 Unified API: http://localhost:${PORT}/api/containers`);
    console.log(`🔍 Search API: http://localhost:${PORT}/api/search/MSKU`);
});

module.exports = app;